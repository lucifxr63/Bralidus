/**
 * Ingesta de estadísticas del Poder Judicial.
 *
 * Consulta las series elegidas de `estadisticaservices.pjud.cl`, las normaliza
 * a un formato común y las escribe en `pjud_estadisticas` (base de Bralidus,
 * para que api-v1 pueda servirlas).
 *
 * Reemplaza al webhook pasivo `webhook-pjud`, que esperaba que un proveedor
 * empujara datos que nunca llegaron. La API se consulta directo y sin
 * autenticación — ver docs/PJUD_API_HALLAZGOS.md.
 *
 * QUÉ NO INGIERE, Y POR QUÉ IMPORTA DECIRLO
 * -----------------------------------------
 * Esta es inteligencia judicial AGREGADA. No hay causas individuales, partes,
 * escritos ni movimientos procesales: la API no los expone. Que quede escrito
 * acá para que nadie lo venda como seguimiento de expedientes.
 */

import { bralidusQuery } from '../infrastructure/database/client/pg-client.js';
import { logger } from '../infrastructure/logging/logger.js';
import { sendOpsAlert } from '../infrastructure/ops-alert/ops-alert.js';
import { syncLogRepository } from '../modules/sync/infrastructure/sync-log.repository.js';
import { deriveRunStatus } from '../modules/sync/domain/run-status.js';
import {
  fetchSerie,
  seriesAIngerir,
  tieneDatos,
  PJUD_DELAY_MS,
  type FilaPjud,
} from '../infrastructure/pjud/pjud.client.js';

const JOB_NAME = 'sync-pjud';
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

interface FilaNormalizada {
  categoria: string;
  subcategoria: string | null;
  /**
   * Año DE LA FILA, no el de la consulta.
   *
   * Varias series (`ejecucion`, `evolucion`, `versus`, `dotacion_*`, `becas`,
   * `proyecto`, `consejo`) devuelven el histórico completo en una sola
   * respuesta: el mismo ITEM repetido con distinto `ANO`. Usar el año de la
   * consulta como clave hacía que 30 filas de 2015-2024 colapsaran en 3 por el
   * UNIQUE — se perdía todo el histórico y sólo sobrevivía el último upsert.
   */
  anio: number | null;
  valor: number | null;
  valorAnterior: number | null;
  variacion: string | null;
}

const aNumero = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Aplana las cuatro formas que devuelve la API a una sola.
 *
 * Las claves de la fuente traen acentos y espacios (`Categoría`, `Variación %`),
 * así que se acceden citadas. El orden de los `??` no es casual: va de la forma
 * más específica a la más genérica para que una fila con `ITEM` y `key` a la vez
 * no se clasifique mal.
 */
export function normalizar(f: FilaPjud): FilaNormalizada | null {
  const categoria =
    (f['Categoría'] as string) ??
    (f['Región'] as string) ??
    (f['ITEM'] as string) ??
    (f['RECURSOS'] as string) ??
    (f['key'] != null ? String(f['key']) : null);

  // Sin categoría la fila no es direccionable: se descarta en vez de inventarle
  // una clave sintética que rompería el upsert.
  if (categoria == null || categoria === '') return null;

  // Algunas series usan `key` como AÑO (dotacion_*: {key:2015, text:"Masculino"}).
  // Ahí el año no está en ANO sino en la propia clave.
  const keyComoAnio = Number(f['key']);
  const esKeyAnio = Number.isInteger(keyComoAnio) && keyComoAnio >= 1990 && keyComoAnio <= 2100;

  return {
    categoria: String(categoria),
    subcategoria:
      (f['text'] as string) ??
      (f['UNIDAD'] as string) ??
      (f['TIPO'] as string) ??
      (f['LIBRO'] as string) ??
      null,
    anio: aNumero(f['ANO'] ?? f['Ano'] ?? (esKeyAnio ? keyComoAnio : null)),
    valor: aNumero(f['value'] ?? f['MONTO'] ?? f['Anio_actual'] ?? f['TOTAL']),
    valorAnterior: aNumero(f['Anio_anterior']),
    variacion: (f['Variación %'] as string) ?? (f['Porcentaje'] as string) ?? null,
  };
}

export async function runSyncPjudJob(anio?: number): Promise<void> {
  // 2025 vino vacío en todas las series probadas: el corte de datos de la
  // fuente es el año anterior completo.
  const anioObjetivo = anio ?? new Date().getFullYear() - 1;

  const cleared = await syncLogRepository.clearStaleRunning(JOB_NAME, 120);
  if (cleared > 0) logger.warn({ cleared }, `[${JOB_NAME}] candados huérfanos liberados`);
  if (await syncLogRepository.hasRunningJob(JOB_NAME)) {
    logger.warn(`[${JOB_NAME}] Job already running — skipping tick`);
    return;
  }

  const logId = await syncLogRepository.create({
    jobName: JOB_NAME,
    fechaConsultada: new Date().toISOString().slice(0, 10),
    metadata: { anio: anioObjetivo },
  });

  const series = seriesAIngerir(anioObjetivo);
  let escritas = 0;
  let fallidas = 0;
  const vacias: string[] = [];

  try {
    for (const s of series) {
      const filas = await fetchSerie(s.path);

      if (!tieneDatos(filas)) {
        // Vacío no es error de red: la serie respondió, simplemente no publica.
        // Se cuenta aparte para poder avisar sin marcar la corrida como rota.
        vacias.push(s.serie);
        logger.info({ serie: s.serie }, `[${JOB_NAME}] serie sin datos`);
        await sleep(PJUD_DELAY_MS);
        continue;
      }

      const normalizadas = filas!
        .map((f) => ({ n: normalizar(f), raw: f }))
        .filter((x): x is { n: FilaNormalizada; raw: FilaPjud } => x.n != null);

      for (const { n, raw } of normalizadas) {
        try {
          await bralidusQuery(
            `INSERT INTO pjud_estadisticas
               (serie, anio, categoria, subcategoria, valor, valor_anterior, variacion, payload, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
             -- Misma expresión que el índice pjud_estadisticas_unica: en
             -- Postgres NULL no colisiona consigo mismo, así que sin COALESCE
             -- toda fila con anio o subcategoria nulos se re-insertaba en cada
             -- corrida en vez de refrescarse (medido: duplicó todo a la segunda).
             ON CONFLICT (serie, COALESCE(anio, -1), categoria, COALESCE(subcategoria, ''))
             DO UPDATE SET
               valor          = EXCLUDED.valor,
               valor_anterior = EXCLUDED.valor_anterior,
               variacion      = EXCLUDED.variacion,
               payload        = EXCLUDED.payload,
               updated_at     = now()`,
            [
              s.serie,
              // El año de la fila manda: preserva el histórico que varias series
              // devuelven completo en una sola respuesta (ver FilaNormalizada).
              n.anio ?? (s.porAnio ? anioObjetivo : null),
              n.categoria,
              n.subcategoria,
              n.valor,
              n.valorAnterior,
              n.variacion,
              JSON.stringify(raw),
            ],
          );
          escritas++;
        } catch (err) {
          fallidas++;
          logger.warn({ serie: s.serie, categoria: n.categoria, err }, `[${JOB_NAME}] fallo al escribir fila`);
        }
      }

      logger.info({ serie: s.serie, filas: normalizadas.length }, `[${JOB_NAME}] serie ingerida`);
      await sleep(PJUD_DELAY_MS);
    }

    const status = deriveRunStatus({ succeeded: escritas, failed: fallidas });
    await syncLogRepository.complete(logId, {
      status,
      totalFound: series.length,
      totalProcessed: series.length,
      totalSucceeded: escritas,
      totalFailed: fallidas,
      metadata: { anio: anioObjetivo, seriesVacias: vacias },
    });

    // Que una serie deje de publicar no rompe la ingesta, pero es exactamente
    // el tipo de deterioro que se vuelve invisible si nadie lo dice.
    if (vacias.length > 0) {
      void sendOpsAlert({
        level: 'warn',
        // Va a la sala de PJUD y no a degradación general: es información sobre
        // ESTA fuente, y ahí es donde se lee junto a su latido.
        channel: 'pjud',
        title: `PJUD: ${vacias.length} serie(s) sin datos`,
        detail: `Año ${anioObjetivo}. Respondieron 200 pero vacías:\n${vacias.join(', ')}`,
        dedupeKey: `pjud-vacias:${anioObjetivo}`,
      });
    }

    logger.info({ escritas, fallidas, vacias: vacias.length }, `[${JOB_NAME}] ingesta completa`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error({ error }, `[${JOB_NAME}] Fatal error`);
    await syncLogRepository.complete(logId, {
      status: 'failed',
      totalFound: series.length,
      totalProcessed: escritas + fallidas,
      totalSucceeded: escritas,
      totalFailed: fallidas,
      errorDetails: [{ fatal: error }],
    });
  }
}
