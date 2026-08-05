import { env } from '../app/env.js';
import { logger } from '../infrastructure/logging/logger.js';
import {
  compraAgilClient,
  clampPageSize,
  isQuotaExhausted,
  PAGE_SIZE_MIN,
} from '../infrastructure/mercado-publico/compra-agil.client.js';
import type { CompraAgilListItem } from '../infrastructure/mercado-publico/compra-agil.types.js';
import { ingestCompraAgilUseCase } from '../modules/opportunities/application/ingest-compra-agil.use-case.js';
import { syncLogRepository } from '../modules/sync/infrastructure/sync-log.repository.js';
import { deriveRunStatus } from '../modules/sync/domain/run-status.js';
import {
  partirVentana,
  totalEstimado,
  tramosTruncados,
  type Tramo,
} from '../modules/sync/domain/window-split.js';
import { syncProgress } from './sync-progress.store.js';
import { notifyIngested } from '../infrastructure/licitus-callback/licitus-callback.js';
// `bralidusQuery` y NO `query`: esta última apunta al pool de Licitus, y
// `mp_ofertas` / `mp_extraer_ofertas()` viven en la base de Bralidus/Animus
// (Supabase). Con el pool equivocado esto fallaría cada noche con "function
// does not exist" — y como la llamada está en un try/catch para no tumbar el
// sync, habría fallado EN SILENCIO y la tabla nunca se habría actualizado.
import { bralidusQuery } from '../infrastructure/database/client/pg-client.js';
import { sendOpsAlert } from '../infrastructure/ops-alert/ops-alert.js';

/**
 * Sync de Compras Ágiles (procesos COT) desde la API v2 de Mercado Público.
 *
 * Estructura calcada de `sync-ordenes.job.ts` (plan → begin → slices → complete)
 * para que el Workflow de Cloudflare pueda trocearlo en steps durables y el
 * panel de admin muestre el progreso igual que los otros syncs.
 *
 * Diferencia clave con los otros jobs: el slicing es POR PÁGINA del listado
 * remoto, no sobre un array en memoria — la API pagina server-side.
 */

const JOB_NAME = 'sync-compra-agil';

/**
 * Tope de fallos guardados en `sync_logs.error_details`. Una fecha con 4.400
 * procesos puede fallar entera; guardar 4.400 objetos en una columna JSONB
 * infla la fila sin agregar información — los primeros 50 ya dicen QUÉ falla.
 */
const MAX_FAILURES_RECORDED = 50;

/**
 * Techo duro de `total_resultados` de la API v2. **No es un límite nuestro.**
 *
 * Medido contra producción el 2026-08-05, mismo instante, mismo ticket:
 *
 *   ventana   3 h → total_resultados      0
 *   ventana   6 h → total_resultados     18
 *   ventana  26 h → total_resultados 10.000  (200 páginas)
 *   ventana  72 h → total_resultados 10.000  (200 páginas)
 *
 * Una ventana tres veces más ancha devuelve el mismo número: es un tope, no un
 * conteo. La página 201 responde `success: OK` con cero items — no un 400, no un
 * error. O sea que al pasarse, la API no avisa: deja de haber datos.
 *
 * POR QUÉ IMPORTA
 * ---------------
 * El bucle de paginación corta en `offset >= found`. Con `found` topado en
 * 10.000, una ventana que en realidad contiene 14.000 procesos termina
 * ordenadamente habiendo ingerido 10.000 y reporta éxito. Los 4.000 que faltan
 * no aparecen en ningún contador ni en ningún log: la corrida se ve perfecta.
 *
 * Por eso `capReached` fuerza 'partial' y avisa. Un dato truncado es un dato
 * incompleto, y decir "success" sobre él es exactamente el fallo silencioso que
 * este servicio arrastra.
 */
export const RESULT_CAP = 10_000;

/** Un fallo de ingesta, con el código que lo identifica en Mercado Público. */
export interface SliceFailure {
  codigo: string;
  error: string;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function toIsoDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d, 12));
}

// ── Ventana de consulta ───────────────────────────────────────

/**
 * La API exige SIEMPRE una ventana de cambios (Grupo 1); sin ella responde 400
 * aunque se envíe la de publicación. Para obtener exactamente lo publicado en
 * un día D se intersecta:
 *   publicado_desde/hasta = el día D completo
 *   cambio_desde = D  (todo lo publicado en D cambió en D o después)
 *   cambio_hasta = instante de inicio de la corrida (fijo, no `now`)
 *
 * `cambioHasta` viaja en el plan en vez de recalcularse por slice: los steps de
 * un Workflow se reintentan y re-consultan el listado, y un extremo móvil
 * correría la paginación entre reintentos.
 */
type QueryWindow = {
  publicadoDesde?: string;
  publicadoHasta?: string;
  cambioDesde: string;
  cambioHasta: string;
};

function buildDateWindow(date: Date, cambioHasta: string): QueryWindow {
  const iso = toIsoDateString(date);
  return {
    publicadoDesde: `${iso}T00:00:00Z`,
    publicadoHasta: `${iso}T23:59:59Z`,
    cambioDesde: `${iso}T00:00:00Z`,
    cambioHasta,
  };
}

/**
 * Modo incremental: todo lo que CAMBIÓ en las últimas N horas, sin filtrar por
 * fecha de publicación. Es el modo que la propia guía recomienda para mantener
 * una base local al día, y para el cron diario es estrictamente mejor que barrer
 * por fecha de publicación:
 *
 * - Es más barato. Medido el 25-jul-2026: 2.098 procesos cambiados en 24 h
 *   contra 3.305 publicados en 48 h (el equivalente con lookback=2).
 * - Es lo único que mantiene el estado al día. Filtrando por publicación, una
 *   Compra Ágil que cierra después de la ventana de lookback se queda
 *   'Publicada' para siempre en nuestra base: `refresh-opportunities` re-consulta
 *   licitaciones por la API v1 y no cubre los COT.
 */
/**
 * Ventana de un tramo ya calculado por `partirVentana`.
 *
 * REEMPLAZA a la ventana incremental de una sola pieza que había acá. Esa
 * construía `[hasta - N horas, hasta]` y la consultaba entera, lo que con el
 * techo de 10.000 de la API significaba truncar sin enterarse. Se eliminó en vez
 * de dejarla como fallback: un camino que ya no se recorre es exactamente lo que
 * este servicio viene pagando caro (la extracción de ofertas vivió meses en una
 * función que no llamaba nadie).
 */
function buildTramoWindow(tramo: TramoPlano): QueryWindow {
  return { cambioDesde: tramo.desde, cambioHasta: tramo.hasta };
}

/**
 * Cuántas compras ágiles cambiaron en un rango. Es la sonda de `partirVentana`.
 *
 * Pide `tamano_pagina` mínimo a propósito: el número sale de
 * `paginacion.total_resultados`, que viene igual con 10 items que con 50, y cada
 * sondeo gasta cuota diaria.
 */
async function contarCambios(desde: Date, hasta: Date): Promise<number> {
  const payload = await compraAgilClient.list({
    cambioDesde: desde.toISOString(),
    cambioHasta: hasta.toISOString(),
    numeroPagina: 1,
    tamanoPagina: PAGE_SIZE_MIN,
  });
  return payload.paginacion?.total_resultados ?? 0;
}

// ── Procesamiento de una página ───────────────────────────────

/**
 * Procesa una página en olas de `COMPRA_AGIL_CONCURRENCY` en paralelo.
 *
 * La API v1 castiga la concurrencia con 429 ("peticiones simultáneas"), por eso
 * el sync de licitaciones va casi secuencial. La v2 NO: su único 429 es la cuota
 * diaria. Medido contra producción, 6 detalles concurrentes tardan 4,6 s contra
 * ~14 s secuenciales, sin un solo rechazo — el detalle es ~2 s de latencia pura.
 */
async function processItems(
  items: CompraAgilListItem[],
  skipDetalle: boolean,
): Promise<{
  succeeded: number;
  failed: number;
  newIds: string[];
  failures: SliceFailure[];
  aborted: boolean;
  quotaExhausted: boolean;
}> {
  let succeeded = 0;
  let failed = 0;
  let quotaExhausted = false;
  const newIds: string[] = [];
  const failures: SliceFailure[] = [];
  const concurrency = skipDetalle ? 1 : env.COMPRA_AGIL_CONCURRENCY;

  for (let i = 0; i < items.length; i += concurrency) {
    if (syncProgress.isAbortRequested()) {
      return { succeeded, failed, newIds, failures, aborted: true, quotaExhausted };
    }

    const wave = items.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      wave.map((item) => ingestCompraAgilUseCase.execute(item, { skipDetalle })),
    );

    for (let j = 0; j < wave.length; j++) {
      const outcome = settled[j]!;
      if (outcome.status === 'fulfilled') {
        succeeded++;
        newIds.push(outcome.value.id);
        continue;
      }
      // Cuota agotada: no tiene sentido seguir pidiendo detalles hoy. Se marca y
      // se corta al terminar la ola (los que ya salieron igual se aprovechan).
      if (isQuotaExhausted(outcome.reason)) {
        quotaExhausted = true;
        continue;
      }
      failed++;
      const error =
        outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
      // Se ACUMULA además de loguearse: el log vive en stdout de una invocación
      // serverless que nadie va a leer tres días después. Lo que queda es
      // `sync_logs.error_details` (ver nota en completeCompraAgilDate).
      if (failures.length < MAX_FAILURES_RECORDED) failures.push({ codigo: wave[j]!.codigo, error });
      logger.warn(
        { codigo: wave[j]!.codigo, error },
        `[${JOB_NAME}] Failed to ingest compra ágil`,
      );
    }

    if (quotaExhausted) {
      syncProgress.log('🛑 Cuota diaria de la API Compra Ágil agotada — deteniendo');
      return { succeeded, failed, newIds, failures, aborted: true, quotaExhausted: true };
    }

    if (!skipDetalle && env.SYNC_REQUEST_DELAY_MS > 0) {
      await sleep(env.SYNC_REQUEST_DELAY_MS);
    }
  }

  return { succeeded, failed, newIds, failures, aborted: false, quotaExhausted: false };
}

// ── Slice (unidad de trabajo de un step del Workflow) ─────────

export interface CompraAgilSliceResult {
  /** Total de procesos de la fecha, para que el caller sepa cuándo parar. */
  found: number;
  processed: number;
  succeeded: number;
  failed: number;
  /** UUIDs nuevos — para auto-analysis. */
  newIds: string[];
  /** Qué falló y por qué. Viaja hasta `sync_logs.error_details`. */
  failures: SliceFailure[];
  /** La ventana topó los 10.000 de la API: hay datos que no vamos a ver. */
  capReached: boolean;
  aborted: boolean;
  quotaExhausted: boolean;
}

/** Crea el sync_log de la fecha (marca 'running'). Devuelve el id para el complete. */
export async function beginCompraAgilDate(
  date: Date,
  activeJobName: string,
): Promise<{ logId: string; isoFecha: string }> {
  const isoFecha = toIsoDateString(date);
  const logId = await syncLogRepository.create({
    jobName: activeJobName,
    fechaConsultada: isoFecha,
    metadata: { source: 'api2/compra-agil', chunked: true },
  });
  return { logId, isoFecha };
}

/**
 * Procesa el slice [offset, offset+limit) de la fecha. `limit` debe ser el
 * tamaño de página (10..50) para que la aritmética offset→página cierre.
 */
export async function syncCompraAgilDateSlice(
  date: Date,
  offset: number,
  limit: number,
  opts: {
    cambioHasta: string;
    estados?: string[];
    skipDetalle?: boolean;
    /** Si viene, se ignora `date` y se consulta por ventana de cambios. */
    incrementalHours?: number;
    /**
     * Tramo ya acotado bajo el techo de la API. Tiene prioridad sobre todo lo
     * demás: es el único modo que garantiza no truncar (ver window-split.ts).
     */
    tramo?: TramoPlano;
  },
): Promise<CompraAgilSliceResult> {
  const pageSize = clampPageSize(limit);
  const numeroPagina = Math.floor(offset / pageSize) + 1;
  // En modo incremental el plan SIEMPRE produce tramos, así que `tramo` viene
  // puesto; el modo fecha (backfills) es el que consulta por publicación.
  const window = opts.tramo ? buildTramoWindow(opts.tramo) : buildDateWindow(date, opts.cambioHasta);

  const empty = (found: number): CompraAgilSliceResult => ({
    found,
    processed: 0,
    succeeded: 0,
    failed: 0,
    newIds: [],
    failures: [],
    capReached: found >= RESULT_CAP,
    aborted: false,
    quotaExhausted: false,
  });

  let payload;
  try {
    payload = await compraAgilClient.list({
      ...window,
      estados: opts.estados,
      numeroPagina,
      tamanoPagina: pageSize,
      // Estable para un backfill por fecha de publicación. El default
      // (FechaUltimaModificacion) reordena las páginas si algo cambia mientras
      // se pagina, y se perderían procesos entre slices.
      ordenarPor: 'FechaPublicacion',
    });
  } catch (err) {
    if (isQuotaExhausted(err)) {
      return { ...empty(0), aborted: true, quotaExhausted: true };
    }
    throw err;
  }

  const found = payload.paginacion?.total_resultados ?? 0;
  const capReached = found >= RESULT_CAP;
  const items = payload.items ?? [];
  if (items.length === 0) return empty(found);

  // Se avisa una sola vez, en la primera página: repetirlo en las 200 llenaría
  // el canal con el mismo hecho.
  if (capReached && numeroPagina === 1) {
    syncProgress.log(
      `⚠ La ventana topó los ${RESULT_CAP.toLocaleString('es-CL')} resultados de la API — ` +
        `hay procesos que esta corrida NO va a ver. Achicar la ventana.`,
    );
  }

  // El tramo concreto y no "cambios 26h": si una franja falla, el registro tiene
  // que decir CUÁL, no el nombre del modo.
  const scope = opts.tramo
    ? `${opts.tramo.desde.slice(11, 16)}–${opts.tramo.hasta.slice(11, 16)} UTC del ${opts.tramo.desde.slice(0, 10)}`
    : toIsoDateString(date);
  syncProgress.log(
    `Slice compra ágil ${offset + 1}-${offset + items.length}/${found} (${scope})...`,
  );

  const r = await processItems(items, opts.skipDetalle ?? false);

  syncProgress.log(
    `  ✓ Página ${numeroPagina} — ${r.succeeded} ok, ${r.failed} errores`,
  );

  return {
    found,
    processed: items.length,
    succeeded: r.succeeded,
    failed: r.failed,
    newIds: r.newIds,
    failures: r.failures,
    capReached,
    aborted: r.aborted,
    quotaExhausted: r.quotaExhausted,
  };
}

/**
 * Completa el sync_log de la fecha con los totales acumulados de los slices.
 *
 * POR QUÉ VIAJAN LOS ERRORES HASTA ACÁ
 * ------------------------------------
 * Hasta el 2026-08-05 esta función no pasaba `errorCodes` ni `errorDetails`, así
 * que las 13 corridas fallidas de `sync-compra-agil` quedaron con
 * `error_details = []`: el status decía "failed" y no había una sola pista de
 * por qué. Dos de ellas ardieron 27,4 minutos exactos —1641 y 1643 segundos, la
 * misma escalera de timeouts— y fueron indiagnosticables durante semanas.
 *
 * El mensaje SÍ se escribía, pero a stdout de una invocación serverless que
 * nadie lee tres días después. `sync-licitaciones` ya guardaba el detalle (31 de
 * 38 fallos); acá el cableado nunca se hizo. El repositorio lo soportaba desde
 * siempre — incluso manda el primer error a Discord al marcar 'failed'.
 */
export async function completeCompraAgilDate(
  logId: string,
  isoFecha: string,
  totals: {
    found: number;
    succeeded: number;
    failed: number;
    aborted: boolean;
    /** La fecha reventó por error de step (p.ej. CPU limit) — nunca es 'success'. */
    errored?: boolean;
    /** Fallos por proceso, acumulados de los slices. */
    failures?: SliceFailure[];
    /** Mensaje de la excepción que tumbó la fecha entera, si la hubo. */
    fatalError?: string;
    /** La ventana topó el techo de la API: el dato quedó truncado. */
    capReached?: boolean;
  },
): Promise<void> {
  const {
    found,
    succeeded,
    failed,
    aborted,
    errored,
    failures = [],
    fatalError,
    capReached = false,
  } = totals;
  // `errored` (la fecha reventó por error de step) nunca puede ser 'success'.
  const base = errored
    ? succeeded > 0
      ? 'partial'
      : 'failed'
    : deriveRunStatus({ succeeded, failed, aborted, found });

  // Topar el techo de la API significa que quedaron procesos afuera, aunque
  // todo lo que sí se pidió haya entrado bien. 'success' sobre un dato truncado
  // es mentira; degradar a 'partial' es exactamente lo que 'partial' significa.
  const status = capReached && base === 'success' ? 'partial' : base;

  // El fatal va PRIMERO: el repositorio manda `errorDetails[0]` a Discord, y lo
  // que explica una fecha caída es la excepción, no el primer proceso que falló.
  const errorDetails: Record<string, unknown>[] = [
    ...(fatalError ? [{ fatal: fatalError }] : []),
    ...(capReached
      ? [{ truncado: `La ventana topó los ${RESULT_CAP} resultados de la API v2`, found }]
      : []),
    ...failures.map((f) => ({ codigo: f.codigo, error: f.error })),
  ];

  if (capReached) {
    void sendOpsAlert({
      level: 'warn',
      channel: 'degradacion',
      title: 'Ventana de Compra Ágil truncada por el techo de la API',
      detail:
        `La consulta de ${isoFecha} devolvió ${found} resultados, que es el techo de ` +
        `${RESULT_CAP} de la API v2 — el número real es MAYOR y esos procesos no se ` +
        `ingirieron. Hay que achicar la ventana (partirla en tramos) para verlos.`,
      dedupeKey: `compra-agil-cap:${isoFecha}`,
    });
  }

  await syncLogRepository.complete(logId, {
    status,
    totalFound: found,
    totalProcessed: succeeded + failed,
    totalSucceeded: succeeded,
    totalFailed: failed,
    errorCodes: failures.map((f) => f.codigo),
    errorDetails,
  });

  syncProgress.log(
    `✓ Fecha ${isoFecha}: ${succeeded}/${found} compras ágiles guardadas, ${failed} errores (${status})`,
  );
  logger.info({ isoFecha, status, found, succeeded, failed }, `[${JOB_NAME}] Date sync complete`);
}

// ── Planificación ─────────────────────────────────────────────

export interface CompraAgilJobOptions {
  /** Días hacia atrás a procesar (0 = solo hoy). Default: COMPRA_AGIL_LOOKBACK_DAYS. */
  daysBack?: number;
  specificDate?: string;
  startDate?: string;
  endDate?: string;
  /** Estados a ingerir. Vacío/undefined = todos (alimenta buyer profiles). */
  estados?: string[];
  maxItems?: number;
  skipAlreadySynced?: boolean;
  jobNameOverride?: string;
  /**
   * El backfill lo activa: disparar análisis LLM y notificaciones sobre miles de
   * procesos históricos quemaría presupuesto y llenaría de ruido a los usuarios.
   */
  skipAutoAnalysis?: boolean;
  /** Omite el fetch de detalle (sin UNSPSC ni descripción). Solo para diagnóstico. */
  skipDetalle?: boolean;
  /**
   * Modo incremental: trae lo que cambió en las últimas N horas en vez de barrer
   * por fecha de publicación. Es el modo del cron diario (ver buildIncrementalWindow).
   * Ignora daysBack/startDate/endDate.
   */
  incrementalHours?: number;
}

/** Tramo de tiempo plano, serializable como parámetro de un Workflow step. */
export interface TramoPlano {
  desde: string;
  hasta: string;
  /** Lo que la sonda dijo que hay. Para comparar contra lo ingerido. */
  estimado: number;
  /** No se pudo bajar del techo ni al mínimo: va a quedar incompleto. */
  truncado: boolean;
}

/**
 * Una unidad de trabajo del plan: lo que se abre como un `sync_log` y se pagina
 * de punta a punta.
 *
 * - Modo fecha (backfills): una unidad por día, sin `tramo`.
 * - Modo incremental: una unidad por TRAMO de la ventana de cambios.
 *
 * `iso` es sólo la etiqueta que va a `fecha_consultada`; en modo incremental la
 * ventana real la define el tramo, no el día.
 */
export interface UnidadDeTrabajo {
  iso: string;
  tramo?: TramoPlano;
}

export interface CompraAgilRunPlan {
  activeJobName: string;
  /** Serializables como params de un Workflow step. */
  unidades: UnidadDeTrabajo[];
  /** Extremo superior FIJO de la ventana de cambios (ver buildDateWindow). */
  cambioHasta: string;
  estados?: string[];
  skipAutoAnalysis: boolean;
  skipDetalle: boolean;
  /** > 0 = modo incremental; las unidades son tramos. */
  incrementalHours?: number;
  /** Sondeos gastados al partir la ventana, para vigilar el costo en cuota. */
  sondeos?: number;
}

function computeDates(options: CompraAgilJobOptions): Date[] {
  const now = new Date();
  const dates: Date[] = [];

  if (options.startDate && options.endDate) {
    const start = new Date(options.startDate + 'T12:00:00Z');
    const end = new Date(options.endDate + 'T12:00:00Z');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) dates.push(new Date(d));
  } else if (options.specificDate) {
    dates.push(isoToDate(options.specificDate));
  } else {
    const lookback = options.daysBack ?? env.COMPRA_AGIL_LOOKBACK_DAYS;
    for (let i = lookback; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      dates.push(d);
    }
  }

  return dates;
}

/** Resuelve fechas + ventana. Null si ya hay un job del mismo nombre corriendo. */
/**
 * Normaliza a `mp_ofertas` / `mp_oferta_items` la competencia que viene enterrada
 * en `raw_payload->detalle->proveedores_cotizando`: quién cotizó, cuánto, quién
 * ganó y por qué se declaró inadmisible al resto.
 *
 * ESTÁ ACÁ Y NO INLINE EN EL JOB porque el camino que corre en producción es el
 * Workflow, y el Workflow NO llama a `runSyncCompraAgilJob` — usa las funciones
 * de slice. La primera versión metió esto dentro de esa función monolítica, que
 * hoy no la invoca nadie: el deploy salió bien, el sync corrió, y la extracción
 * nunca se ejecutó porque vivía en código muerto. Exportada, la llaman los dos
 * caminos y no hay lógica duplicada que se desincronice.
 *
 * Idempotente: reconstruye completo desde el payload, que es la fuente de verdad.
 * No relanza el error — un fallo acá no debe tumbar un sync cuyos datos crudos ya
 * están guardados—, pero sí avisa a operaciones para que no sea silencioso.
 */
export async function extraerOfertasCompraAgil(activeJobName: string): Promise<void> {
  try {
    const [extraccion] = await bralidusQuery<{ ofertas_insertadas: string; items_insertados: string }>(
      'select * from public.mp_extraer_ofertas()',
    );
    logger.info(
      { ofertas: extraccion?.ofertas_insertadas, items: extraccion?.items_insertados },
      `[${activeJobName}] Ofertas extraídas del payload`,
    );
    syncProgress.log(
      `⚙ Competencia extraída: ${extraccion?.ofertas_insertadas ?? 0} ofertas, ${extraccion?.items_insertados ?? 0} líneas`,
    );
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error({ error }, `[${activeJobName}] Falló la extracción de ofertas — el sync sigue`);
    syncProgress.log(`✗ La extracción de ofertas falló (${error}). Los datos crudos quedaron guardados.`);
    void sendOpsAlert({
      level: 'error',
      channel: 'degradacion',
      title: 'La extracción de ofertas de compra ágil falló',
      detail:
        `mp_extraer_ofertas() no corrió (${error}). Los datos crudos quedaron guardados en ` +
        `raw_payload, pero mp_ofertas / mp_oferta_items se quedan con la foto anterior y ` +
        `/mercado-publico/ofertas y /precios devuelven datos viejos hasta que se repare.`,
      dedupeKey: 'mp-extraccion-ofertas',
    });
  }
}

export async function planCompraAgilRun(
  options: CompraAgilJobOptions = {},
): Promise<CompraAgilRunPlan | null> {
  const activeJobName = options.jobNameOverride ?? JOB_NAME;

  const cleared = await syncLogRepository.clearStaleRunning(activeJobName, 120);
  if (cleared > 0) logger.warn({ cleared }, `[${activeJobName}] Cleared stale running logs`);
  if (await syncLogRepository.hasRunningJob(activeJobName)) {
    logger.warn(`[${activeJobName}] Job already running — skipping tick`);
    return null;
  }

  const cambioHasta = new Date().toISOString();

  // Modo incremental por defecto cuando no se pidió un rango explícito.
  //
  // Hasta el 2026-08-05 esto no se activaba NUNCA: `incrementalHours` no lo
  // pasaba ningún caller y `COMPRA_AGIL_INCREMENTAL_HOURS` no la leía nadie. El
  // cron manda `{}`, así que corría en modo fecha con lookback=2 y
  // re-sincronizaba 3 días cada noche — cada fecha se sincronizó entre 2 y 4
  // veces. Cuarenta líneas explicando por qué el incremental era mejor, y era
  // código muerto.
  //
  // No se activa si el caller pidió fechas: un backfill de enero tiene que
  // barrer por publicación, no traer "lo que cambió en las últimas 26 h".
  const pidioFechas =
    options.specificDate != null ||
    (options.startDate != null && options.endDate != null) ||
    options.daysBack != null;

  // El flag va SEPARADO de `pidioFechas`: apagado, el cron vuelve al modo fecha
  // de siempre, pero un caller que pida `incrementalHours` explícitamente igual
  // lo obtiene (para probarlo a mano sin cambiar el comportamiento del cron).
  const incrementalPorDefecto =
    env.COMPRA_AGIL_INCREMENTAL_ENABLED && !pidioFechas
      ? env.COMPRA_AGIL_INCREMENTAL_HOURS
      : undefined;
  const incrementalHours = options.incrementalHours ?? incrementalPorDefecto;

  if (incrementalHours) {
    const { unidades, sondeos } = await planificarTramos(
      activeJobName,
      cambioHasta,
      incrementalHours,
    );
    return {
      activeJobName,
      unidades,
      cambioHasta,
      estados: options.estados,
      skipAutoAnalysis: options.skipAutoAnalysis ?? false,
      skipDetalle: options.skipDetalle ?? false,
      incrementalHours,
      sondeos,
    };
  }

  let dates = computeDates(options);

  if (options.skipAlreadySynced) {
    const filtered: Date[] = [];
    for (const d of dates) {
      const iso = toIsoDateString(d);
      if (await syncLogRepository.hasSuccessForDate(activeJobName, iso)) {
        logger.info({ iso }, `[${activeJobName}] Skipping date — already synced`);
      } else {
        filtered.push(d);
      }
    }
    dates = filtered;
  }

  return {
    activeJobName,
    unidades: dates.map((d) => ({ iso: toIsoDateString(d) })),
    cambioHasta,
    estados: options.estados,
    skipAutoAnalysis: options.skipAutoAnalysis ?? false,
    skipDetalle: options.skipDetalle ?? false,
  };
}

/**
 * Parte la ventana de cambios en tramos que quepan bajo el techo de la API.
 *
 * Cada tramo es una unidad de trabajo con su propio `sync_log`: si uno revienta,
 * los demás siguen, y en el registro queda qué franja horaria falló.
 */
async function planificarTramos(
  activeJobName: string,
  cambioHasta: string,
  horas: number,
): Promise<{ unidades: UnidadDeTrabajo[]; sondeos: number }> {
  const hasta = new Date(cambioHasta);
  const desde = new Date(hasta.getTime() - horas * 3_600_000);

  let particion;
  try {
    particion = await partirVentana(desde, hasta, contarCambios, { cap: RESULT_CAP });
  } catch (err) {
    // Cuota agotada SONDEANDO. Verificado el 2026-08-05: la API responde
    // `success: NOK` + código 429 con `payload: null`.
    //
    // Se atrapa acá y se devuelve un plan vacío en vez de dejar que la excepción
    // suba: si sube, revienta el step de planificación y la corrida entera queda
    // como error, cuando en realidad no hay nada roto — se acabó la cuota del
    // día y mañana sigue. Es el mismo trato que ya reciben los slices.
    //
    // OJO al tocar `contarCambios`: si alguna vez devolviera 0 ante un error en
    // vez de lanzar, la ventana entera se daría por vacía, el sync no ingeriría
    // nada y cerraría en verde. Que `compraAgilClient.list` lance ante NOK es lo
    // único que separa "no hay nada" de "no pudimos preguntar".
    if (isQuotaExhausted(err)) {
      logger.warn(`[${activeJobName}] Cuota agotada al sondear la ventana — sin tramos`);
      syncProgress.log('🛑 Cuota diaria agotada al planificar — la corrida no arranca');
      void sendOpsAlert({
        level: 'warn',
        channel: 'degradacion',
        title: 'Cuota de la API Compra Ágil agotada al planificar los tramos',
        detail:
          'No se alcanzó a sondear la ventana. La corrida no ingiere nada y retoma ' +
          'en el próximo día calendario, cuando la cuota se restablece.',
        dedupeKey: 'compra-agil-quota-plan',
      });
      return { unidades: [], sondeos: 0 };
    }
    throw err;
  }

  const { tramos, sondeos, incompleto } = particion;

  const truncados = tramosTruncados(tramos);
  if (truncados.length > 0 || incompleto) {
    // Que la ventana no se haya podido partir del todo es exactamente el
    // escenario que este mecanismo existe para no tragarse en silencio.
    void sendOpsAlert({
      level: 'error',
      channel: 'degradacion',
      title: 'No se pudo partir la ventana de Compra Ágil bajo el techo de la API',
      detail:
        (incompleto ? `Se agotó el presupuesto de ${sondeos} sondeos explorando. ` : '') +
        (truncados.length > 0
          ? `${truncados.length} tramo(s) siguen en el techo de ${RESULT_CAP} aun al mínimo ` +
            `subdivisible: ${truncados.map((t) => `${t.desde}→${t.hasta}`).join(', ')}. `
          : '') +
        'Esos procesos NO se van a ingerir en esta corrida.',
      dedupeKey: `compra-agil-particion:${cambioHasta.slice(0, 13)}`,
    });
  }

  logger.info(
    { tramos: tramos.length, sondeos, estimado: totalEstimado(tramos), truncados: truncados.length },
    `[${activeJobName}] Ventana de ${horas}h partida en tramos`,
  );

  return {
    unidades: tramos.map((t: Tramo) => ({
      // Etiqueta legible en `fecha_consultada`: día + hora de inicio del tramo.
      // Es TEXT, así que aguanta el sufijo y el panel sigue mostrando el día.
      iso: t.desde.slice(0, 10),
      tramo: { desde: t.desde, hasta: t.hasta, estimado: t.estimado, truncado: t.truncado },
    })),
    sondeos,
  };
}

/** Inicializa la fila de progreso y anuncia la corrida. */
export async function startCompraAgilRun(plan: CompraAgilRunPlan): Promise<void> {
  await syncProgress.start(plan.activeJobName);
  syncProgress.updateStats({ totalDates: plan.unidades.length, currentDateIndex: 0 });
  if (plan.incrementalHours) {
    const estimado = plan.unidades.reduce((a, u) => a + (u.tramo?.estimado ?? 0), 0);
    syncProgress.log(
      `Modo incremental: ${plan.incrementalHours}h de cambios, partidas en ` +
        `${plan.unidades.length} tramo(s) bajo el techo de ${RESULT_CAP} ` +
        `(${plan.sondeos ?? 0} sondeos, ~${estimado.toLocaleString('es-CL')} procesos)`,
    );
    const truncados = plan.unidades.filter((u) => u.tramo?.truncado).length;
    if (truncados > 0) {
      syncProgress.log(`⚠ ${truncados} tramo(s) siguen topados: su dato va a quedar incompleto`);
    }
  } else {
    const isos = plan.unidades.map((u) => u.iso);
    syncProgress.log(`Fechas de compras ágiles a procesar (${isos.length}): ${isos.join(', ')}`);
  }
  if (plan.estados?.length) syncProgress.log(`⚙ Estados: ${plan.estados.join(', ')}`);
  if (plan.skipAutoAnalysis) syncProgress.log('⚙ Auto-análisis desactivado para esta corrida');
  if (plan.skipDetalle) syncProgress.log('⚠ Sin fetch de detalle: no habrá UNSPSC ni descripción');
  logger.info({ unidades: plan.unidades.length }, `[${plan.activeJobName}] Starting run`);
}

/** Cuenta cuántas compras ágiles hay en el rango sin ingerir nada (dry-run). */
export async function countCompraAgilForDates(
  isoDates: string[],
  estados?: string[],
): Promise<Array<{ iso: string; total: number }>> {
  const cambioHasta = new Date().toISOString();
  const out: Array<{ iso: string; total: number }> = [];

  for (const iso of isoDates) {
    const window = buildDateWindow(isoToDate(iso), cambioHasta);
    const payload = await compraAgilClient.list({
      ...window,
      estados,
      numeroPagina: 1,
      tamanoPagina: 10,
      ordenarPor: 'FechaPublicacion',
    });
    out.push({ iso, total: payload.paginacion?.total_resultados ?? 0 });
    if (env.SYNC_REQUEST_DELAY_MS > 0) await sleep(env.SYNC_REQUEST_DELAY_MS);
  }

  return out;
}

// ── Main job (ruta Node: scripts/backfill) ────────────────────

export async function runSyncCompraAgilJob(options: CompraAgilJobOptions = {}): Promise<void> {
  const plan = await planCompraAgilRun(options);
  if (!plan) return;

  await startCompraAgilRun(plan);

  const pageSize = clampPageSize(env.COMPRA_AGIL_CHUNK_SIZE);
  let totalIngested = 0;
  let aborted = false;
  let quotaExhausted = false;

  for (let i = 0; i < plan.unidades.length && !aborted; i++) {
    const unidad = plan.unidades[i]!;
    const iso = unidad.iso;
    const date = isoToDate(iso);

    if (await syncProgress.refreshAbort()) {
      syncProgress.log('🛑 Sync abortado por solicitud del usuario');
      aborted = true;
      break;
    }

    syncProgress.updateStats({ currentDateIndex: i + 1, currentDate: iso });
    const { logId, isoFecha } = await beginCompraAgilDate(date, plan.activeJobName);

    let offset = 0;
    let found = 0;
    let succeeded = 0;
    let failed = 0;
    let dateAborted = false;
    let dateErrored = false;
    let fatalError: string | undefined;
    let capReached = false;
    const newIds: string[] = [];
    const failures: SliceFailure[] = [];

    try {
      for (;;) {
        const r = await syncCompraAgilDateSlice(date, offset, pageSize, {
          cambioHasta: plan.cambioHasta,
          estados: plan.estados,
          skipDetalle: plan.skipDetalle,
          incrementalHours: plan.incrementalHours,
          tramo: unidad.tramo,
        });

        found = r.found;
        succeeded += r.succeeded;
        failed += r.failed;
        newIds.push(...r.newIds);
        failures.push(...r.failures);
        capReached = capReached || r.capReached;

        if (r.quotaExhausted) {
          quotaExhausted = true;
          dateAborted = true;
          break;
        }
        if (r.aborted) {
          dateAborted = true;
          break;
        }

        offset += pageSize;
        if (offset >= found || r.processed === 0) break;

        if (options.maxItems && totalIngested + succeeded >= options.maxItems) {
          syncProgress.log(`⚙ Límite de ${options.maxItems} alcanzado — deteniendo`);
          dateAborted = true;
          aborted = true;
          break;
        }
      }
    } catch (err) {
      dateErrored = true;
      fatalError = err instanceof Error ? err.message : String(err);
      logger.error({ iso, error: fatalError }, `[${plan.activeJobName}] Date failed — continuing`);
      syncProgress.log(`✗ Fecha ${iso} falló (${fatalError}) — continúo con la siguiente`);
    }

    totalIngested += succeeded;
    await completeCompraAgilDate(logId, isoFecha, {
      found,
      succeeded,
      failed,
      aborted: dateAborted,
      errored: dateErrored,
      failures,
      fatalError,
      capReached,
    });

    // Post-proceso en Licitus (ver licitus-callback). `skipAutoAnalysis` se
    // conserva: sigue significando "no dispares el post-proceso" (backfills).
    if (newIds.length > 0 && !plan.skipAutoAnalysis) {
      await notifyIngested(newIds);
    }

    if (dateAborted) aborted = true;
  }

  aborted = aborted || syncProgress.isAbortRequested();

  await extraerOfertasCompraAgil(plan.activeJobName);

  const msg = quotaExhausted
    ? 'Sincronización detenida: cuota diaria de la API agotada'
    : aborted
      ? 'Sincronización abortada'
      : 'Sincronización completada';
  await syncProgress.finish(msg);
  logger.info({ totalIngested, aborted, quotaExhausted }, `[${plan.activeJobName}] Run finished`);
}
