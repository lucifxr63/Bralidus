/**
 * Ingesta de las causas de la Corte Suprema (endpoints `_detalle`).
 *
 * POR QUÉ ES UN JOB APARTE DE sync-pjud
 * -------------------------------------
 * `sync-pjud` ingiere SERIES: pares categoría/valor, decenas de filas por
 * respuesta, todas a `pjud_estadisticas`. Esto es otra cosa: causa por causa,
 * hasta 95.075 filas y 36 MB en una sola respuesta, a `pjud_suprema_detalle`.
 * Comparten la fuente y nada más.
 *
 * MEDIDO ANTES DE ESCRIBIRLO (2026-07-31, año 2024)
 * -------------------------------------------------
 *   inventario_suprema_detalle         7.469 filas ·  2,2 MB · 0,4 s
 *   ingresos_recursos_suprema_detalle 62.009 filas · 21,1 MB · 3,0 s
 *   terminos_suprema_detalle          95.075 filas · 36,5 MB · 5,3 s
 *
 * La descarga NO es el problema — la fuente es rápida. El cuello es la
 * escritura: 95.075 filas de a una son 95.075 viajes a la base, que es como
 * inserta `sync-pjud` y acá no sirve. Se escribe por lotes de LOTE_FILAS.
 *
 * Cada serie corre en su propio step del workflow (ver
 * sync-pjud-suprema.workflow.ts), así que cada una tiene su propio techo de
 * 300 s en vez de compartir uno.
 */

import { bralidusQuery } from '../infrastructure/database/client/pg-client.js';
import { logger } from '../infrastructure/logging/logger.js';
import { sendOpsAlert } from '../infrastructure/ops-alert/ops-alert.js';
import { syncLogRepository } from '../modules/sync/infrastructure/sync-log.repository.js';
import { deriveRunStatus } from '../modules/sync/domain/run-status.js';
import {
  fetchSerie,
  seriesSupremaDetalle,
  PJUD_DETALLE_TIMEOUT_MS,
  type FilaPjud,
} from '../infrastructure/pjud/pjud.client.js';

const JOB_NAME = 'sync-pjud-suprema';

/**
 * Filas por INSERT. 500 x 17 columnas = 8.500 parámetros, holgado bajo el tope
 * de 65.535 de Postgres. Subirlo mucho no acelera: el costo pasa a ser armar el
 * arreglo en memoria mientras el payload de 36 MB todavía está vivo.
 */
const LOTE_FILAS = 500;

const COLUMNAS = [
  'serie',
  'anio',
  'libro',
  'rol',
  'ano_rol',
  'recursos',
  'agrupador_recursos',
  'cod_recurso',
  'tipo_recurso',
  'fecha_ingreso',
  'fecha_fallo',
  'grupo_termino',
  'sala_fallo',
  'descripcion_sala',
  'materia',
  'materia_proteccion',
  'raw',
] as const;

const texto = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

const entero = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

/**
 * Fecha en el formato que devuelve la fuente (`2023-12-20`).
 *
 * Se valida en vez de pasarla cruda: una fecha basura haría fallar el INSERT del
 * LOTE ENTERO, no de la fila. Con 95.075 filas, una sola mal formada tiraría
 * abajo 500.
 */
const fecha = (v: unknown): string | null => {
  const s = texto(v);
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

/**
 * Clave de conflicto de una fila, igual a la del índice único.
 *
 * Se necesita en JS y no sólo en SQL porque Postgres rechaza el statement
 * ENTERO si un mismo INSERT intenta upsertar dos veces la misma clave
 * ("ON CONFLICT DO UPDATE command cannot affect row a second time").
 */
function claveConflicto(f: FilaPjud): string {
  return [
    texto(f['LIBRO']) ?? '',
    entero(f['ROL']) ?? -1,
    entero(f['ANO_ROL']) ?? -1,
    fecha(f['FECHA_FALLO']) ?? '1900-01-01',
  ].join('|');
}

/**
 * Índices de las filas que hay que ESCRIBIR, sin repetidas.
 *
 * POR QUÉ ES DEDUPLICACIÓN Y NO UN LUJO: la fuente publica filas duplicadas de
 * verdad. En 2025, `terminos_suprema_detalle` trae dos veces la causa
 * Criminal|59045|2024 fallada el 2025-12-15 — idénticas en los 14 campos, no dos
 * términos distintos. Las dos caían en el mismo lote de 500 y Postgres rechaza
 * el INSERT COMPLETO ante una clave repetida ("ON CONFLICT DO UPDATE command
 * cannot affect row a second time"), así que UNA fila repetida por la fuente
 * costaba 500 filas perdidas.
 *
 * Se detectó comparando lo escrito contra la fuente: 51.550 vs 52.050. El job no
 * había fallado — cada lote roto se anota y se sigue, que es lo correcto, pero
 * sin esa comparación la pérdida pasaba inadvertida.
 *
 * POR QUÉ DEVUELVE ÍNDICES Y NO FILAS: la versión anterior construía un
 * `Map<clave, fila>` y devolvía `[...map.values()]`, o sea una segunda copia
 * completa del arreglo. Con los 52.049 de 2025 daba igual; con los 243.775 de
 * 2023 (~90 MB de JSON) duplicar el arreglo en memoria es justo lo que hace
 * reventar una función serverless. Un Set de claves y un arreglo de índices
 * pesan una fracción.
 */
function indicesUnicos(filas: FilaPjud[]): number[] {
  const vistas = new Map<string, number>();
  for (let i = 0; i < filas.length; i++) vistas.set(claveConflicto(filas[i]!), i);
  // Ordenados para conservar el orden original de la fuente, que hace los logs
  // legibles cuando hay que ubicar un lote que fallo.
  return [...vistas.values()].sort((a, b) => a - b);
}

function aParametros(serie: string, anio: number, f: FilaPjud): unknown[] {
  return [
    serie,
    anio,
    texto(f['LIBRO']),
    entero(f['ROL']),
    entero(f['ANO_ROL']),
    texto(f['RECURSOS']),
    texto(f['AGRUPADOR_RECURSOS']),
    texto(f['COD_RECURSO']),
    texto(f['TIPO_RECURSO']),
    fecha(f['FECHA_INGRESO']),
    fecha(f['FECHA_FALLO']),
    texto(f['GRUPO_TERMINO']),
    entero(f['SALA_FALLO']),
    texto(f['DESCRIPCION_SALA']),
    texto(f['MATERIA']),
    texto(f['MATERIA_PROTECCION']),
    JSON.stringify(f),
  ];
}

/** Escribe un lote en un solo INSERT multi-fila. Devuelve cuántas escribió. */
async function escribirLote(filas: unknown[][]): Promise<number> {
  if (filas.length === 0) return 0;

  const anchos = COLUMNAS.length;
  const values = filas
    .map((_, i) => `(${COLUMNAS.map((_, j) => `$${i * anchos + j + 1}`).join(',')}, now())`)
    .join(',');

  await bralidusQuery(
    `INSERT INTO pjud_suprema_detalle (${COLUMNAS.join(',')}, updated_at)
     VALUES ${values}
     -- Misma expresión que el índice pjud_suprema_detalle_identidad. El
     -- COALESCE no es cosmético: en Postgres NULL no colisiona consigo mismo,
     -- así que sin él las filas sin libro o sin rol se re-insertarían en cada
     -- corrida en vez de refrescarse.
     --
     -- fecha_fallo va en la clave porque una causa puede terminarse MÁS DE UNA
     -- VEZ: en 2024 hay 11 causas con dos términos (p. ej. Familia|241225|2023,
     -- "Inadmisibles" en enero y "Rechazados" en diciembre). Sin ese campo el
     -- upsert las pisaría y se perderían términos sin ningún error.
     ON CONFLICT (serie, anio, COALESCE(libro,''), COALESCE(rol,-1),
                  COALESCE(ano_rol,-1), COALESCE(fecha_fallo, date '1900-01-01'))
     DO UPDATE SET
       recursos           = EXCLUDED.recursos,
       agrupador_recursos = EXCLUDED.agrupador_recursos,
       cod_recurso        = EXCLUDED.cod_recurso,
       tipo_recurso       = EXCLUDED.tipo_recurso,
       fecha_ingreso      = EXCLUDED.fecha_ingreso,
       grupo_termino      = EXCLUDED.grupo_termino,
       sala_fallo         = EXCLUDED.sala_fallo,
       descripcion_sala   = EXCLUDED.descripcion_sala,
       materia            = EXCLUDED.materia,
       materia_proteccion = EXCLUDED.materia_proteccion,
       raw                = EXCLUDED.raw,
       updated_at         = now()`,
    filas.flat(),
  );
  return filas.length;
}

export interface ResultadoSerieSuprema {
  serie: string;
  /** Filas que devolvió la fuente, repetidas incluidas. */
  filasFuente: number;
  /** Cuántas de esas eran repeticiones exactas de otra. */
  repetidasEnFuente: number;
  escritas: number;
  fallidas: number;
  error: string | null;
}

/**
 * Ingiere UNA serie. El workflow la llama una vez por cada una para que cada
 * cual tenga su propio presupuesto de tiempo.
 */
export async function ingerirSerieSuprema(
  serie: string,
  anio: number,
): Promise<ResultadoSerieSuprema> {
  const base: ResultadoSerieSuprema = {
    serie,
    filasFuente: 0,
    repetidasEnFuente: 0,
    escritas: 0,
    fallidas: 0,
    error: null,
  };

  const def = seriesSupremaDetalle(anio).find((s) => s.serie === serie);
  if (!def) return { ...base, error: `serie desconocida: ${serie}` };

  // Techo propio: estas series pesan hasta 36 MB y el default de 30 s no
  // alcanza para bajarlas y parsearlas desde la función.
  const filas = await fetchSerie(def.path, PJUD_DETALLE_TIMEOUT_MS);
  if (filas == null) return { ...base, error: 'la fuente no respondió' };

  base.filasFuente = filas.length;
  if (filas.length === 0) {
    // 200 con [] es la forma que tiene esta API de decir "no publiqué nada".
    // Tratarlo como éxito haría que una serie discontinuada pase inadvertida.
    return { ...base, error: 'la fuente devolvió 0 filas' };
  }

  let escritas = 0;
  let fallidas = 0;

  // Se deduplica sobre la serie ENTERA, no lote por lote: dos filas con la
  // misma clave podrían caer en lotes distintos y ahí el problema no es el
  // error de Postgres sino escribir dos veces lo mismo.
  const indices = indicesUnicos(filas);
  const repetidasEnFuente = filas.length - indices.length;
  if (repetidasEnFuente > 0) {
    logger.info(
      { serie, repetidasEnFuente },
      `[${JOB_NAME}] la fuente trae filas repetidas; se conserva una de cada`,
    );
  }

  for (let i = 0; i < indices.length; i += LOTE_FILAS) {
    const lote = indices
      .slice(i, i + LOTE_FILAS)
      .map((idx) => aParametros(serie, anio, filas[idx]!));
    try {
      escritas += await escribirLote(lote);
    } catch (err) {
      // Un lote que revienta no debe abortar la serie: se anota y sigue. Con
      // 190 lotes, perder uno es 0,5 % — abortar sería perder el resto.
      fallidas += lote.length;
      logger.warn(
        { serie, desde: i, tamano: lote.length, err },
        `[${JOB_NAME}] lote fallido`,
      );
    }
  }

  return { ...base, repetidasEnFuente, escritas, fallidas };
}

/**
 * Abre la corrida: resuelve el año, toma el lock y crea el log.
 *
 * Va aparte del resto porque el workflow necesita una serie por step (cada uno
 * con su propio techo de 300 s) y el cuerpo de un `'use workflow'` tiene que ser
 * determinista: `new Date()` no puede vivir ahí.
 *
 * Devuelve `logId: null` si hay que saltarse la corrida.
 */
export async function abrirCorridaSuprema(
  anio?: number,
): Promise<{ anio: number; logId: string | null; series: string[] }> {
  const anioObjetivo = anio ?? new Date().getFullYear() - 1;
  const series = seriesSupremaDetalle(anioObjetivo).map((s) => s.serie);

  const cleared = await syncLogRepository.clearStaleRunning(JOB_NAME, 120);
  if (cleared > 0) logger.warn({ cleared }, `[${JOB_NAME}] limpiados logs colgados`);
  if (await syncLogRepository.hasRunningJob(JOB_NAME)) {
    logger.warn(`[${JOB_NAME}] ya hay una corrida en curso — se salta`);
    return { anio: anioObjetivo, logId: null, series: [] };
  }

  const logId = await syncLogRepository.create({
    jobName: JOB_NAME,
    fechaConsultada: `${anioObjetivo}-12-31`,
    metadata: { anio: anioObjetivo },
  });

  return { anio: anioObjetivo, logId, series };
}

/** Cierra la corrida: completa el log y publica el aviso con la cuadratura. */
export async function cerrarCorridaSuprema(
  logId: string,
  anioObjetivo: number,
  resultados: ResultadoSerieSuprema[],
): Promise<void> {
  const escritas = resultados.reduce((a, r) => a + r.escritas, 0);
  const fallidas = resultados.reduce((a, r) => a + r.fallidas, 0);
  const conError = resultados.filter((r) => r.error !== null);

  const status = deriveRunStatus({ succeeded: escritas, failed: fallidas + conError.length });

  await syncLogRepository.complete(logId, {
    status,
    totalFound: resultados.reduce((a, r) => a + r.filasFuente, 0),
    totalProcessed: escritas + fallidas,
    totalSucceeded: escritas,
    totalFailed: fallidas,
    ...(conError.length > 0
      ? {
          errorCodes: ['SERIE_SIN_DATOS'],
          errorDetails: conError.map((r) => ({ serie: r.serie, error: r.error })),
        }
      : {}),
    metadata: {
      anio: anioObjetivo,
      porSerie: resultados.map((r) => ({
        serie: r.serie,
        fuente: r.filasFuente,
        escritas: r.escritas,
      })),
    },
  });

  // Cuadratura explícita: escritas + repetidas debería dar exactamente lo que
  // entregó la fuente. Cualquier otra diferencia es pérdida, y tiene que
  // gritarlo — así se descubrió que una fila repetida por la fuente estaba
  // costando 500 filas por lote rechazado.
  const descuadre = resultados.reduce(
    (a, r) => a + (r.error ? 0 : r.filasFuente - r.repetidasEnFuente - r.escritas),
    0,
  );
  const repetidas = resultados.reduce((a, r) => a + r.repetidasEnFuente, 0);

  await sendOpsAlert({
    level: status === 'success' && descuadre === 0 ? 'info' : 'warn',
    channel: 'pjud',
    title: `Corte Suprema · ${escritas.toLocaleString('es-CL')} causas · ${anioObjetivo}`,
    detail:
      descuadre !== 0
        ? `⚠️ **Faltan ${descuadre.toLocaleString('es-CL')} filas sin explicación.** No son repeticiones de la fuente: se perdieron al escribir.`
        : conError.length > 0
          ? `${conError.length} serie(s) sin datos: ${conError.map((r) => r.serie).join(', ')}`
          : `Ingeridas las ${resultados.length} series de detalle.` +
            (repetidas > 0
              ? ` La fuente trajo ${repetidas} fila(s) repetida(s), se conservó una de cada.`
              : ''),
    fields: resultados.map((r) => ({
      name: r.serie.replace('_suprema_detalle', '').replace('_recursos', ''),
      value: r.error
        ? `⚠️ ${r.error}`
        : `${r.escritas.toLocaleString('es-CL')} de ${r.filasFuente.toLocaleString('es-CL')}` +
          (r.repetidasEnFuente > 0 ? `\n(${r.repetidasEnFuente} repetida(s) en origen)` : ''),
      inline: true,
    })),
    footer: `${JOB_NAME} · año ${anioObjetivo}`,
    dedupeKey: `pjud-suprema:${anioObjetivo}`,
  });

  logger.info({ anio: anioObjetivo, escritas, fallidas }, `[${JOB_NAME}] corrida completa`);
}
