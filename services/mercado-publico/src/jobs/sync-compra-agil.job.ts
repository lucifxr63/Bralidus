import { env } from '../app/env.js';
import { logger } from '../infrastructure/logging/logger.js';
import {
  compraAgilClient,
  clampPageSize,
  isQuotaExhausted,
} from '../infrastructure/mercado-publico/compra-agil.client.js';
import type { CompraAgilListItem } from '../infrastructure/mercado-publico/compra-agil.types.js';
import { ingestCompraAgilUseCase } from '../modules/opportunities/application/ingest-compra-agil.use-case.js';
import { syncLogRepository } from '../modules/sync/infrastructure/sync-log.repository.js';
import { syncProgress } from './sync-progress.store.js';
import { notifyIngested } from '../infrastructure/licitus-callback/licitus-callback.js';

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
function buildIncrementalWindow(cambioHasta: string, hours: number): QueryWindow {
  const hasta = new Date(cambioHasta);
  const desde = new Date(hasta.getTime() - hours * 3_600_000);
  return { cambioDesde: desde.toISOString(), cambioHasta };
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
): Promise<{ succeeded: number; failed: number; newIds: string[]; aborted: boolean; quotaExhausted: boolean }> {
  let succeeded = 0;
  let failed = 0;
  let quotaExhausted = false;
  const newIds: string[] = [];
  const concurrency = skipDetalle ? 1 : env.COMPRA_AGIL_CONCURRENCY;

  for (let i = 0; i < items.length; i += concurrency) {
    if (syncProgress.isAbortRequested()) {
      return { succeeded, failed, newIds, aborted: true, quotaExhausted };
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
      logger.warn(
        { codigo: wave[j]!.codigo, error },
        `[${JOB_NAME}] Failed to ingest compra ágil`,
      );
    }

    if (quotaExhausted) {
      syncProgress.log('🛑 Cuota diaria de la API Compra Ágil agotada — deteniendo');
      return { succeeded, failed, newIds, aborted: true, quotaExhausted: true };
    }

    if (!skipDetalle && env.SYNC_REQUEST_DELAY_MS > 0) {
      await sleep(env.SYNC_REQUEST_DELAY_MS);
    }
  }

  return { succeeded, failed, newIds, aborted: false, quotaExhausted: false };
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
  },
): Promise<CompraAgilSliceResult> {
  const pageSize = clampPageSize(limit);
  const numeroPagina = Math.floor(offset / pageSize) + 1;
  const window = opts.incrementalHours
    ? buildIncrementalWindow(opts.cambioHasta, opts.incrementalHours)
    : buildDateWindow(date, opts.cambioHasta);

  const empty = (found: number): CompraAgilSliceResult => ({
    found,
    processed: 0,
    succeeded: 0,
    failed: 0,
    newIds: [],
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
  const items = payload.items ?? [];
  if (items.length === 0) return empty(found);

  const scope = opts.incrementalHours
    ? `cambios ${opts.incrementalHours}h`
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
    aborted: r.aborted,
    quotaExhausted: r.quotaExhausted,
  };
}

/** Completa el sync_log de la fecha con los totales acumulados de los slices. */
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
  },
): Promise<void> {
  const { found, succeeded, failed, aborted, errored } = totals;
  const status = errored
    ? succeeded > 0
      ? 'partial'
      : 'failed'
    : aborted
      ? 'partial'
      : failed === 0
        ? 'success'
        : succeeded === 0
          ? 'failed'
          : 'partial';

  await syncLogRepository.complete(logId, {
    status,
    totalFound: found,
    totalProcessed: succeeded + failed,
    totalSucceeded: succeeded,
    totalFailed: failed,
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

export interface CompraAgilRunPlan {
  activeJobName: string;
  /** Fechas ISO (YYYY-MM-DD) — serializables como params de un Workflow step. */
  isoDates: string[];
  /** Extremo superior FIJO de la ventana de cambios (ver buildDateWindow). */
  cambioHasta: string;
  estados?: string[];
  skipAutoAnalysis: boolean;
  skipDetalle: boolean;
  /** > 0 = modo incremental; isoDates contiene una sola entrada (hoy). */
  incrementalHours?: number;
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

  // En incremental la "fecha" es solo la etiqueta del sync_log: la ventana real
  // la define cambio_desde/cambio_hasta, no el día.
  let dates = options.incrementalHours ? [new Date()] : computeDates(options);

  if (options.skipAlreadySynced && !options.incrementalHours) {
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
    isoDates: dates.map(toIsoDateString),
    cambioHasta: new Date().toISOString(),
    estados: options.estados,
    skipAutoAnalysis: options.skipAutoAnalysis ?? false,
    skipDetalle: options.skipDetalle ?? false,
    incrementalHours: options.incrementalHours,
  };
}

/** Inicializa la fila de progreso y anuncia la corrida. */
export async function startCompraAgilRun(plan: CompraAgilRunPlan): Promise<void> {
  await syncProgress.start(plan.activeJobName);
  syncProgress.updateStats({ totalDates: plan.isoDates.length, currentDateIndex: 0 });
  if (plan.incrementalHours) {
    syncProgress.log(
      `Modo incremental: compras ágiles cambiadas en las últimas ${plan.incrementalHours}h`,
    );
  } else {
    syncProgress.log(
      `Fechas de compras ágiles a procesar (${plan.isoDates.length}): ${plan.isoDates.join(', ')}`,
    );
  }
  if (plan.estados?.length) syncProgress.log(`⚙ Estados: ${plan.estados.join(', ')}`);
  if (plan.skipAutoAnalysis) syncProgress.log('⚙ Auto-análisis desactivado para esta corrida');
  if (plan.skipDetalle) syncProgress.log('⚠ Sin fetch de detalle: no habrá UNSPSC ni descripción');
  logger.info({ dates: plan.isoDates }, `[${plan.activeJobName}] Starting run`);
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

  for (let i = 0; i < plan.isoDates.length && !aborted; i++) {
    const iso = plan.isoDates[i]!;
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
    const newIds: string[] = [];

    try {
      for (;;) {
        const r = await syncCompraAgilDateSlice(date, offset, pageSize, {
          cambioHasta: plan.cambioHasta,
          estados: plan.estados,
          skipDetalle: plan.skipDetalle,
          incrementalHours: plan.incrementalHours,
        });

        found = r.found;
        succeeded += r.succeeded;
        failed += r.failed;
        newIds.push(...r.newIds);

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
      const error = err instanceof Error ? err.message : String(err);
      logger.error({ iso, error }, `[${plan.activeJobName}] Date failed — continuing`);
      syncProgress.log(`✗ Fecha ${iso} falló (${error}) — continúo con la siguiente`);
    }

    totalIngested += succeeded;
    await completeCompraAgilDate(logId, isoFecha, {
      found,
      succeeded,
      failed,
      aborted: dateAborted,
      errored: dateErrored,
    });

    // Post-proceso en Licitus (ver licitus-callback). `skipAutoAnalysis` se
    // conserva: sigue significando "no dispares el post-proceso" (backfills).
    if (newIds.length > 0 && !plan.skipAutoAnalysis) {
      await notifyIngested(newIds);
    }

    if (dateAborted) aborted = true;
  }

  aborted = aborted || syncProgress.isAbortRequested();
  const msg = quotaExhausted
    ? 'Sincronización detenida: cuota diaria de la API agotada'
    : aborted
      ? 'Sincronización abortada'
      : 'Sincronización completada';
  await syncProgress.finish(msg);
  logger.info({ totalIngested, aborted, quotaExhausted }, `[${plan.activeJobName}] Run finished`);
}
