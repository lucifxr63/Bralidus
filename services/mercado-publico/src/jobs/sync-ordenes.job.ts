import { env } from '../app/env.js';
import { logger } from '../infrastructure/logging/logger.js';
import { mercadoPublicoClient } from '../infrastructure/mercado-publico/mercado-publico.client.js';
import { ingestOrdenCompraUseCase } from '../modules/purchase-orders/application/ingest-orden-compra.use-case.js';
import { syncLogRepository } from '../modules/sync/infrastructure/sync-log.repository.js';
import { syncProgress } from './sync-progress.store.js';
import type { MpOrdenCompraRaw } from '../infrastructure/mercado-publico/mercado-publico.types.js';

const JOB_NAME = 'sync-ordenes';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function toMpDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${d}${m}${y}`;
}

function toIsoDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
  return chunks;
}

// ── Fetch all OC raw objects from the list (no individual requests) ──────────

async function fetchAllOCsForDate(fecha: string, quiet = false): Promise<MpOrdenCompraRaw[]> {
  const all: MpOrdenCompraRaw[] = [];
  let pagina = 1;

  if (!quiet) syncProgress.log(`Consultando OCs MP fecha ${fecha}...`);

  while (true) {
    const response = await mercadoPublicoClient.getOrdenesCompraByFecha(fecha, pagina);
    const items = response.Listado ?? [];
    if (items.length === 0) break;

    all.push(...items);

    if (!quiet)
      syncProgress.log(`  Página ${pagina}: ${items.length} OCs (total: ${all.length}/${response.Cantidad})`);
    logger.debug({ fecha, pagina, pageCount: items.length, total: all.length }, `[${JOB_NAME}] Page fetched`);

    if (all.length >= response.Cantidad) break;
    pagina++;

    // Delay entre páginas para no saturar
    if (env.SYNC_REQUEST_DELAY_MS > 0) await sleep(env.SYNC_REQUEST_DELAY_MS);
  }

  if (!quiet) syncProgress.log(`✓ ${all.length} OCs obtenidas para ${fecha}`);
  return all;
}

// ── Process batch using raw data already in memory ───────────────────────────

async function processBatch(
  batch: MpOrdenCompraRaw[],
  batchIndex: number,
  totalBatches: number,
): Promise<{ succeeded: number; failed: number; aborted: boolean }> {
  let succeeded = 0;
  let failed = 0;

  syncProgress.log(`  Batch ${batchIndex}/${totalBatches}: ${batch.length} OCs...`);

  for (const raw of batch) {
    if (syncProgress.isAbortRequested()) return { succeeded, failed, aborted: true };

    try {
      await ingestOrdenCompraUseCase.executeFromRaw(raw);
      succeeded++;
    } catch (err) {
      failed++;
      const error = err instanceof Error ? err.message : String(err);
      logger.warn({ codigo: raw.Codigo, error }, `[${JOB_NAME}] Failed to ingest OC`);
    }

    // Delay entre inserts para no saturar la DB en bulk
    if (env.SYNC_REQUEST_DELAY_MS > 0) await sleep(Math.min(env.SYNC_REQUEST_DELAY_MS, 100));
  }

  syncProgress.log(`  ✓ Batch ${batchIndex}/${totalBatches} — ${succeeded} ok, ${failed} errores`);
  return { succeeded, failed, aborted: false };
}

// ── Per-date sync ─────────────────────────────────────────────────────────────

export interface OcDateSyncResult {
  found: number;
  succeeded: number;
  failed: number;
  aborted: boolean;
}

export async function syncOrdenesForDate(
  date: Date,
  activeJobName: string,
): Promise<OcDateSyncResult> {
  const mpFecha = toMpDateString(date);
  const isoFecha = toIsoDateString(date);

  const logId = await syncLogRepository.create({
    jobName: activeJobName,
    fechaConsultada: isoFecha,
    metadata: { mpFecha },
  });

  let totalFound = 0;
  let totalSucceeded = 0;
  let totalFailed = 0;

  try {
    const ocs = await fetchAllOCsForDate(mpFecha);
    totalFound = ocs.length;

    if (ocs.length === 0) {
      await syncLogRepository.complete(logId, { status: 'success', totalFound: 0, totalProcessed: 0, totalSucceeded: 0, totalFailed: 0 });
      return { found: 0, succeeded: 0, failed: 0, aborted: false };
    }

    const batches = chunk(ocs, env.SYNC_BATCH_SIZE);
    syncProgress.log(`Procesando ${ocs.length} OCs en ${batches.length} batches (sin requests extra a MP)...`);
    syncProgress.updateStats({ totalFound, totalBatches: batches.length, currentDate: isoFecha });

    let abortedMidDate = false;
    for (let i = 0; i < batches.length; i++) {
      // Relee el flag de abort desde DB en cada borde de batch
      if (await syncProgress.refreshAbort()) {
        abortedMidDate = true;
        break;
      }

      const result = await processBatch(batches[i]!, i + 1, batches.length);
      totalSucceeded += result.succeeded;
      totalFailed += result.failed;

      syncProgress.updateStats({ totalProcessed: (i + 1) * env.SYNC_BATCH_SIZE, totalSucceeded, totalFailed, currentBatch: i + 1 });

      if (result.aborted) { abortedMidDate = true; break; }
    }

    const status = abortedMidDate ? 'partial' : totalFailed === 0 ? 'success' : totalSucceeded === 0 ? 'failed' : 'partial';

    await syncLogRepository.complete(logId, {
      status,
      totalFound,
      totalProcessed: totalSucceeded + totalFailed,
      totalSucceeded,
      totalFailed,
    });

    syncProgress.log(`✓ Fecha ${isoFecha}: ${totalSucceeded}/${totalFound} OCs guardadas, ${totalFailed} errores (${status})`);
    logger.info({ fecha: mpFecha, status, totalFound, totalSucceeded, totalFailed }, `[${JOB_NAME}] Date sync complete`);

    return { found: totalFound, succeeded: totalSucceeded, failed: totalFailed, aborted: abortedMidDate };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error({ fecha: mpFecha, error }, `[${JOB_NAME}] Fatal error for date`);
    syncProgress.log(`✗ Error fatal en ${isoFecha}: ${error}`);
    await syncLogRepository.complete(logId, { status: 'failed', totalFound, totalProcessed: 0, totalSucceeded: 0, totalFailed: totalFound });
    return { found: totalFound, succeeded: 0, failed: totalFound, aborted: false };
  }
}

// ── Per-date sync EN CHUNKS (para el Workflow de Cloudflare) ───────────────────
//
// Cada slice corre en su propio step = invocación fresca del Worker con su propio
// presupuesto de CPU. Así una fecha con miles de OCs (que en un solo step excede
// el CPU limit) se procesa en varios steps durables. El slice re-consulta el
// listado (I/O barato) y solo NORMALIZA/persiste su porción (CPU acotado).

export interface OcSliceResult {
  found: number; // total de OCs de la fecha (para que el caller sepa cuándo parar)
  processed: number;
  succeeded: number;
  failed: number;
  aborted: boolean;
}

/** Crea el sync_log de la fecha (marca 'running'). Devuelve el id para el complete. */
export async function beginOrdenesDate(
  date: Date,
  activeJobName: string,
): Promise<{ logId: string; isoFecha: string }> {
  const isoFecha = toIsoDateString(date);
  const mpFecha = toMpDateString(date);
  const logId = await syncLogRepository.create({
    jobName: activeJobName,
    fechaConsultada: isoFecha,
    metadata: { mpFecha, chunked: true },
  });
  return { logId, isoFecha };
}

/** Procesa el slice [offset, offset+limit) de las OCs de la fecha. Re-fetch quiet. */
export async function syncOrdenesDateSlice(
  date: Date,
  offset: number,
  limit: number,
): Promise<OcSliceResult> {
  const mpFecha = toMpDateString(date);
  const all = await fetchAllOCsForDate(mpFecha, true);
  const slice = all.slice(offset, offset + limit);

  if (slice.length === 0) {
    return { found: all.length, processed: 0, succeeded: 0, failed: 0, aborted: false };
  }

  const batches = chunk(slice, env.SYNC_BATCH_SIZE);
  const globalTotalBatches = Math.max(1, Math.ceil(all.length / env.SYNC_BATCH_SIZE));
  const baseBatchIndex = Math.floor(offset / env.SYNC_BATCH_SIZE);

  syncProgress.log(
    `Slice OCs ${offset + 1}-${offset + slice.length}/${all.length} (fecha ${mpFecha})...`,
  );

  let succeeded = 0;
  let failed = 0;
  let aborted = false;
  for (let i = 0; i < batches.length; i++) {
    if (await syncProgress.refreshAbort()) {
      aborted = true;
      break;
    }
    const r = await processBatch(batches[i]!, baseBatchIndex + i + 1, globalTotalBatches);
    succeeded += r.succeeded;
    failed += r.failed;
    if (r.aborted) {
      aborted = true;
      break;
    }
  }

  return { found: all.length, processed: slice.length, succeeded, failed, aborted };
}

/** Completa el sync_log de la fecha con los totales acumulados de todos los slices. */
export async function completeOrdenesDate(
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

  syncProgress.log(`✓ Fecha ${isoFecha}: ${succeeded}/${found} OCs guardadas, ${failed} errores (${status})`);
  logger.info({ isoFecha, status, found, succeeded, failed }, `[${JOB_NAME}] Date sync complete (chunked)`);
}

// ── Main job ──────────────────────────────────────────────────────────────────

export interface SyncJobOptions {
  daysBack?: number;
  specificDate?: string;
  startDate?: string;
  endDate?: string;
  maxItems?: number;
  skipAlreadySynced?: boolean;
  jobNameOverride?: string;
}

export interface OcSyncRunPlan {
  activeJobName: string;
  /** Fechas ISO (YYYY-MM-DD) — serializables como params de un Workflow step. */
  isoDates: string[];
}

export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d, 12));
}

/**
 * Resuelve las fechas de la corrida. Retorna null si ya hay un job del mismo
 * nombre corriendo (anti-solapamiento vía sync_logs).
 */
export async function planOrdenesRun(options: SyncJobOptions = {}): Promise<OcSyncRunPlan | null> {
  const activeJobName = options.jobNameOverride ?? JOB_NAME;
  // Auto-sanea huérfanos 'running' >2h (crashes previos) antes del anti-solapamiento.
  // En el Worker de CF no corre el bootstrap de Node que limpiaría estos registros.
  const cleared = await syncLogRepository.clearStaleRunning(activeJobName, 120);
  if (cleared > 0) logger.warn({ cleared }, `[${activeJobName}] Cleared stale running logs`);
  const isRunning = await syncLogRepository.hasRunningJob(activeJobName);
  if (isRunning) {
    logger.warn(`[${activeJobName}] Job already running — skipping tick`);
    return null;
  }

  const now = new Date();
  let dates: Date[] = [];

  if (options.startDate && options.endDate) {
    const start = new Date(options.startDate + 'T12:00:00Z');
    const end = new Date(options.endDate + 'T12:00:00Z');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) dates.push(new Date(d));
  } else if (options.specificDate) {
    dates = [isoToDate(options.specificDate)];
  } else {
    const lookback = options.daysBack ?? env.SYNC_LOOKBACK_DAYS;
    for (let i = lookback; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      dates.push(d);
    }
  }

  if (options.skipAlreadySynced) {
    const filtered: Date[] = [];
    for (const d of dates) {
      const iso = toIsoDateString(d);
      const already = await syncLogRepository.hasSuccessForDate(activeJobName, iso);
      if (already) logger.info({ iso }, `[${activeJobName}] Skipping date — already synced`);
      else filtered.push(d);
    }
    dates = filtered;
  }

  return { activeJobName, isoDates: dates.map(toIsoDateString) };
}

/** Inicializa la fila de progreso y anuncia la corrida. */
export async function startOrdenesRun(plan: OcSyncRunPlan): Promise<void> {
  await syncProgress.start(plan.activeJobName);
  syncProgress.updateStats({ totalDates: plan.isoDates.length, currentDateIndex: 0 });
  syncProgress.log(`Fechas OCs a procesar (${plan.isoDates.length}): ${plan.isoDates.join(', ')}`);
  logger.info({ dates: plan.isoDates }, `[${plan.activeJobName}] Starting run`);
}

export async function runSyncOrdenesJob(options: SyncJobOptions = {}): Promise<void> {
  const plan = await planOrdenesRun(options);
  if (!plan) return;

  await startOrdenesRun(plan);

  let aborted = false;
  for (let i = 0; i < plan.isoDates.length; i++) {
    // Relee el flag de abort desde DB entre fechas
    if (await syncProgress.refreshAbort()) {
      syncProgress.log('🛑 Sync abortado');
      aborted = true;
      break;
    }
    syncProgress.updateStats({ currentDateIndex: i + 1 });
    const result = await syncOrdenesForDate(isoToDate(plan.isoDates[i]!), plan.activeJobName);
    if (result.aborted) aborted = true;
  }

  aborted = aborted || syncProgress.isAbortRequested();
  await syncProgress.finish(aborted ? 'Sincronización abortada' : 'Sincronización completada');
  logger.info(`[${plan.activeJobName}] Run finished`);
}
