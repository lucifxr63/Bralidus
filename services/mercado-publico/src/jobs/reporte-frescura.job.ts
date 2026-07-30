/**
 * Reporte de frescura de datos — el canal que habría cazado la caída.
 *
 * POR QUÉ EXISTE
 * --------------
 * Un job puede correr "bien" y el dato envejecer igual. Pasó dos veces:
 *
 *  · /data/macro sirvió indicadores del 2026-05-08 durante 82 días con todo en
 *    verde, porque nadie invocaba la función que los escribe.
 *  · La ingesta de Mercado Público estuvo detenida del 2026-07-26 al 29 sin un
 *    solo mensaje: sólo se avisaba en caso de fallo, y el fallo ocurría antes
 *    de poder reportarse.
 *
 * Ninguna alerta por evento cubre eso. Lo que lo cubre es preguntar
 * periódicamente "¿cuán viejo está cada cosa?" y publicarlo, aunque la
 * respuesta sea buena. Es además el único mensaje de la sala de control que se
 * puede mostrar a alguien de afuera: los otros sirven para depurar, este cuenta
 * el estado.
 *
 * Es de sólo lectura: no dispara jobs ni escribe en ninguna base.
 */

import { query, bralidusQuery } from '../infrastructure/database/client/pg-client.js';
import { logger } from '../infrastructure/logging/logger.js';
import { sendOpsAlert } from '../infrastructure/ops-alert/ops-alert.js';

const JOB_NAME = 'reporte-frescura';

/** Días de antigüedad a partir de los cuales una fuente se marca degradada. */
const UMBRAL_DIAS = { licitaciones: 2, ordenes: 3 } as const;

/**
 * Jobs que se esperan corriendo de forma recurrente. Lista EXPLÍCITA a propósito.
 *
 * Derivarla de los job_name que existan en sync_logs mete ruido: ahí también
 * quedan campañas puntuales (`sync-historical-*`, `backfill-compra-agil`) y
 * pruebas (`sync-ordenes-e2etest`), que aparecen "sin correr hace 23 días" sin
 * que eso signifique nada. El primer reporte real las delató como 4 falsas
 * alarmas de 7 — y un canal que grita en falso es un canal que se ignora.
 *
 * Si se agenda un job nuevo, hay que agregarlo acá.
 */
const JOBS_AGENDADOS = [
  'sync-licitaciones',
  'sync-ordenes',
  'sync-compra-agil',
  'refresh-opportunities',
  'enrich-ordenes',
] as const;

interface Fila {
  etiqueta: string;
  valor: string;
  detalle: string;
  estado: '✅' | '⚠️' | '❌';
}

const num = (n: unknown): string => Number(n ?? 0).toLocaleString('es-CL');

function diasDesde(fecha: unknown): number | null {
  if (!fecha) return null;
  return Math.floor((Date.now() - new Date(fecha as string).getTime()) / 86_400_000);
}

function semaforo(dias: number | null, umbral: number): '✅' | '⚠️' | '❌' {
  if (dias == null) return '❌';
  return dias <= umbral ? '✅' : '⚠️';
}

export async function runReporteFrescuraJob(): Promise<void> {
  const filas: Fila[] = [];

  try {
    // ── Licitus: lo que la ingesta escribe ───────────────────────────────────
    const licRow = await query<{
      opps: number; cot: number; ocs: number;
      ult_pub: string | null; ult_oc: string | null;
      sin_enriquecer: number;
    }>(
      `SELECT (SELECT count(*) FROM opportunities)::int                                  AS opps,
              (SELECT count(*) FROM opportunities WHERE source_type='compra_agil')::int  AS cot,
              (SELECT count(*) FROM purchase_orders)::int                                AS ocs,
              (SELECT max(published_at) FROM opportunities)                              AS ult_pub,
              (SELECT max(issued_at) FROM purchase_orders)                               AS ult_oc,
              (SELECT count(*) FROM purchase_orders
                WHERE supplier_code IS NULL AND enrichment_attempts < 5)::int            AS sin_enriquecer`,
      [],
    );
    const lic = licRow[0];

    if (lic) {
      const dPub = diasDesde(lic.ult_pub);
      const dOc = diasDesde(lic.ult_oc);
      filas.push({
        etiqueta: 'Licitaciones (Licitus)',
        valor: num(lic.opps),
        detalle: `última publicación hace ${dPub ?? '?'}d · COT ${num(lic.cot)}`,
        estado: semaforo(dPub, UMBRAL_DIAS.licitaciones),
      });
      filas.push({
        etiqueta: 'Órdenes de compra',
        valor: num(lic.ocs),
        detalle: `última OC hace ${dOc ?? '?'}d`,
        estado: semaforo(dOc, UMBRAL_DIAS.ordenes),
      });
      filas.push({
        etiqueta: 'Cola de enriquecimiento',
        valor: num(lic.sin_enriquecer),
        detalle: lic.sin_enriquecer > 1000 ? 'backlog alto' : 'al día',
        estado: lic.sin_enriquecer > 1000 ? '⚠️' : '✅',
      });
    }

    // ── Última corrida de cada job AGENDADO ──────────────────────────────────
    const jobs = await query<{
      job_name: string; status: string; started_at: string | null; finished_at: string | null;
    }>(
      `SELECT DISTINCT ON (job_name) job_name, status, started_at, finished_at
         FROM sync_logs WHERE job_name = ANY($1) ORDER BY job_name, started_at DESC`,
      [[...JOBS_AGENDADOS]],
    );

    const viejos = jobs.filter((j) => {
      // Corriendo AHORA es lo más fresco que puede estar: su finished_at es
      // null y tratarlo como antigüedad infinita lo marcaba como caído.
      if (j.status === 'running') return false;
      return (diasDesde(j.finished_at ?? j.started_at) ?? 99) > 2;
    });
    // Un job agendado que nunca aparecio en sync_logs tampoco corrió.
    const vistos = new Set(jobs.map((j) => j.job_name));
    const nuncaCorrieron = JOBS_AGENDADOS.filter((j) => !vistos.has(j));
    const problemas = [...viejos.map((j) => j.job_name), ...nuncaCorrieron];

    filas.push({
      etiqueta: 'Jobs agendados',
      valor: `${JOBS_AGENDADOS.length - problemas.length}/${JOBS_AGENDADOS.length}`,
      detalle: problemas.length ? `sin correr: ${problemas.join(', ')}` : 'todos al día',
      estado: problemas.length === 0 ? '✅' : '⚠️',
    });

    // ── Paridad con la tabla canónica de Bralidus ────────────────────────────
    // El dual-write debería mantenerlas iguales; un desfase indica que uno de
    // los dos destinos dejó de recibir.
    try {
      const canon = await bralidusQuery<{ n: number }>(
        `SELECT count(*)::int AS n FROM licitaciones_mercado_publico`,
        [],
      );
      const desfase = (lic?.opps ?? 0) - (canon[0]?.n ?? 0);
      filas.push({
        etiqueta: 'Tabla canónica (Bralidus)',
        valor: num(canon[0]?.n),
        detalle: desfase === 0 ? 'en paridad con Licitus' : `desfase ${desfase > 0 ? '+' : ''}${desfase}`,
        estado: desfase === 0 ? '✅' : '⚠️',
      });
    } catch (err) {
      filas.push({
        etiqueta: 'Tabla canónica (Bralidus)',
        valor: '—',
        detalle: 'no se pudo consultar',
        estado: '❌',
      });
      logger.warn({ err }, `[${JOB_NAME}] canónica inaccesible`);
    }

    // ── Publicación ──────────────────────────────────────────────────────────
    const degradadas = filas.filter((f) => f.estado !== '✅').length;

    // Cada fuente es un campo del embed: el semáforo va en el nombre y el dato
    // en el valor, así Discord los alinea en columnas y el estado se ve sin
    // leer. Un bloque de texto plano obliga a recorrerlo entero.
    const campos = filas.map((f) => ({
      name: `${f.estado} ${f.etiqueta}`,
      value: `**${f.valor}**\n${f.detalle}`,
      inline: true,
    }));

    // Encabezado con el veredicto primero: es lo único que hay que leer si todo
    // está bien.
    const resumen = degradadas === 0
      ? '**Todo al día.** Ninguna fuente requiere atención.'
      : `**${degradadas} de ${filas.length} fuentes** requieren atención.`;

    await sendOpsAlert({
      level: degradadas === 0 ? 'info' : 'warn',
      channel: 'frescura',
      title: `Frescura de datos · ${new Date().toISOString().slice(0, 10)}`,
      detail: resumen,
      fields: campos,
      footer: `${filas.length} fuentes medidas`,
      // Un reporte por día: la clave lleva la fecha para que el dedupe de 30 min
      // no bloquee el del día siguiente pero sí un doble disparo del mismo día.
      dedupeKey: `frescura:${new Date().toISOString().slice(0, 10)}`,
    });

    logger.info({ filas: filas.length, degradadas }, `[${JOB_NAME}] reporte publicado`);
  } catch (err) {
    // El reporte no debe tumbar nada, pero su propio fallo sí es un incidente:
    // sin él se pierde justamente la señal de que algo envejeció.
    const error = err instanceof Error ? err.message : String(err);
    logger.error({ error }, `[${JOB_NAME}] fallo al armar el reporte`);
    void sendOpsAlert({
      level: 'error',
      channel: 'incidentes',
      title: 'El reporte de frescura falló',
      detail: `Sin este reporte no hay señal de datos envejecidos.\n${error.slice(0, 200)}`,
      dedupeKey: 'frescura-fallo',
    });
  }
}
