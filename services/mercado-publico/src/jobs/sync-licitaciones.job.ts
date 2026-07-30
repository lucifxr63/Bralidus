import { env } from '../app/env.js';
import { logger } from '../infrastructure/logging/logger.js';
import { mercadoPublicoClient } from '../infrastructure/mercado-publico/mercado-publico.client.js';
import type { MpLicitacionRaw } from '../infrastructure/mercado-publico/mercado-publico.types.js';
import { ingestLicitacionUseCase } from '../modules/opportunities/application/ingest-licitacion.use-case.js';
import { supplierProfileRepository } from '../modules/supplier-profile/infrastructure/supplier-profile.repository.js';
import { syncLogRepository } from '../modules/sync/infrastructure/sync-log.repository.js';
import { deriveRunStatus } from '../modules/sync/domain/run-status.js';
import { syncProgress } from './sync-progress.store.js';
import { notifyIngested } from '../infrastructure/licitus-callback/licitus-callback.js';
import {
  prefilterListado,
  parseStatusFilter,
  type PrefilterOptions,
  type StatusFilter,
} from './sync-prefilter.js';
import { AppError } from '../shared/errors/app-error.js';

const JOB_NAME = 'sync-licitaciones';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// ── Helpers ───────────────────────────────────────────────────

function toMpDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${d}${m}${y}`; // API de MP espera DDMMAAAA
}

function toIsoDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// ── Fetching ──────────────────────────────────────────────────

async function fetchListadoForDate(fecha: string, quiet = false): Promise<MpLicitacionRaw[]> {
  const listado: MpLicitacionRaw[] = [];
  let pagina = 1;

  logger.info({ fecha }, `[${JOB_NAME}] Fetching listado for date`);
  if (!quiet) syncProgress.log(`Consultando MP fecha ${fecha}...`);

  while (true) {
    const response = await mercadoPublicoClient.getLicitacionesByFecha(fecha, pagina);
    const items = response.Listado ?? [];

    if (items.length === 0) break;

    listado.push(...items);

    if (!quiet)
      syncProgress.log(
        `  Página ${pagina}: ${items.length} licitaciones (total: ${listado.length}/${response.Cantidad})`,
      );
    logger.debug(
      { fecha, pagina, pageCount: items.length, totalSoFar: listado.length },
      `[${JOB_NAME}] Page fetched`,
    );

    if (listado.length >= response.Cantidad) break;

    pagina++;
  }

  if (!quiet) syncProgress.log(`✓ ${listado.length} licitaciones en el listado de ${fecha}`);
  logger.info({ fecha, total: listado.length }, `[${JOB_NAME}] Listado fetched`);
  return listado;
}

// ── Processing ────────────────────────────────────────────────

interface BatchResult {
  succeeded: string[];
  succeededIds: string[]; // opportunity UUIDs for auto-analysis
  skipped: string[];      // NOT_FOUND en MP — esperado, no cuenta como error
  failed: Array<{ codigo: string; error: string }>;
}

async function processItem(
  codigo: string,
): Promise<{ status: 'ok'; id: string } | { status: 'skipped' } | { status: 'error'; error: string }> {
  try {
    const opportunity = await ingestLicitacionUseCase.execute(codigo, () =>
      syncProgress.isAbortRequested(),
    );
    return { status: 'ok', id: opportunity.id };
  } catch (err) {
    // NOT_FOUND = licitación no disponible individualmente en la API de MP
    // (borrador, cancelada, restringida). Es un comportamiento esperado del API.
    if (err instanceof AppError && err.code === 'NOT_FOUND') {
      return { status: 'skipped' };
    }
    const error = err instanceof Error ? err.message : String(err);
    return { status: 'error', error };
  }
}

async function processBatch(
  codigos: string[],
  batchIndex: number,
  totalBatches: number,
): Promise<BatchResult & { aborted: boolean }> {
  const result: BatchResult & { aborted: boolean } = {
    succeeded: [],
    succeededIds: [],
    skipped: [],
    failed: [],
    aborted: false,
  };
  const concurrency = env.SYNC_CONCURRENCY;

  syncProgress.log(
    `  Batch ${batchIndex}/${totalBatches}: ${codigos.length} licitaciones (concurrencia ${concurrency})...`,
  );

  for (let i = 0; i < codigos.length; i += concurrency) {
    if (await syncProgress.refreshAbort()) {
      result.aborted = true;
      return result;
    }

    const slice = codigos.slice(i, i + concurrency);

    // Procesamiento real en paralelo — todos los items del slice al mismo tiempo
    const settled = await Promise.allSettled(slice.map((c) => processItem(c)));

    for (let j = 0; j < slice.length; j++) {
      const codigo = slice[j]!;
      const outcome = settled[j]!;

      if (outcome.status === 'rejected') {
        // Promise.allSettled no debería rechazar (processItem atrapa todo), pero por si acaso
        const error = String(outcome.reason);
        logger.warn({ codigo, error }, `[${JOB_NAME}] Unexpected rejection`);
        result.failed.push({ codigo, error });
        continue;
      }

      const r = outcome.value;
      if (r.status === 'ok') {
        result.succeeded.push(codigo);
        result.succeededIds.push(r.id);
      } else if (r.status === 'skipped') {
        result.skipped.push(codigo);
      } else {
        logger.warn({ codigo, error: r.error }, `[${JOB_NAME}] Failed to ingest licitacion`);
        result.failed.push({ codigo, error: r.error });
        syncProgress.log(`  ✗ ${codigo}: ${r.error.slice(0, 80)}`);
      }
    }

    if (env.SYNC_REQUEST_DELAY_MS > 0) {
      await sleep(env.SYNC_REQUEST_DELAY_MS);
    }
  }

  return result;
}

// ── Per-date sync ─────────────────────────────────────────────

export interface DateSyncResult {
  found: number;
  processed: number;
  succeeded: number;
  skipped: number;
  failed: number;
  aborted: boolean;
}

export async function syncForDate(
  date: Date,
  activeJobName: string,
  prefilterOptions: PrefilterOptions,
): Promise<DateSyncResult> {
  const mpFecha = toMpDateString(date);
  const isoFecha = toIsoDateString(date);

  const logId = await syncLogRepository.create({
    jobName: activeJobName,
    fechaConsultada: isoFecha,
    metadata: { mpFecha },
  });

  let totalFound = 0;
  let totalProcessed = 0;
  let totalSucceeded = 0;
  let totalSkipped = 0;
  let prefilterMetadata: Record<string, unknown> = {};
  const allFailed: Array<{ codigo: string; error: string }> = [];
  const allNewIds: string[] = [];

  try {
    const listado = await fetchListadoForDate(mpFecha);
    totalFound = listado.length;

    const prefiltered = prefilterListado(listado, prefilterOptions);
    const codigos = prefiltered.codigos;
    prefilterMetadata = {
      discardedByStatus: prefiltered.discardedByStatus,
      discardedByPrescore: prefiltered.discardedByPrescore,
      discardedByTipo: prefiltered.discardedByTipo,
      discardedByTitle: prefiltered.discardedByTitle,
    };

    const totalDiscarded =
      prefiltered.discardedByStatus +
      prefiltered.discardedByPrescore +
      prefiltered.discardedByTipo +
      prefiltered.discardedByTitle;
    if (totalDiscarded > 0) {
      const parts = [
        prefiltered.discardedByStatus > 0 ? `${prefiltered.discardedByStatus} por estado` : null,
        prefiltered.discardedByTipo > 0 ? `${prefiltered.discardedByTipo} por tipo` : null,
        prefiltered.discardedByTitle > 0 ? `${prefiltered.discardedByTitle} por texto` : null,
        prefiltered.discardedByPrescore > 0
          ? `${prefiltered.discardedByPrescore} por pre-score`
          : null,
      ].filter(Boolean);
      syncProgress.log(`⏭ Pre-filtro: ${parts.join(', ')} → ${codigos.length} a ingestar`);
      logger.info(
        { fecha: mpFecha, totalFound, ...prefilterMetadata, toIngest: codigos.length },
        `[${JOB_NAME}] Prefilter applied`,
      );
    }

    if (codigos.length === 0) {
      await syncLogRepository.complete(logId, {
        status: 'success',
        totalFound,
        totalProcessed: 0,
        totalSucceeded: 0,
        totalFailed: 0,
        metadata: prefilterMetadata,
      });
      return { found: totalFound, processed: 0, succeeded: 0, skipped: 0, failed: 0, aborted: false };
    }

    const batches = chunk(codigos, env.SYNC_BATCH_SIZE);
    logger.info(
      { fecha: mpFecha, total: codigos.length, batches: batches.length },
      `[${JOB_NAME}] Processing batches`,
    );
    syncProgress.log(`Procesando ${codigos.length} licitaciones en ${batches.length} batches...`);
    syncProgress.updateStats({ totalFound, totalBatches: batches.length, currentDate: isoFecha });

    let abortedMidDate = false;
    for (let i = 0; i < batches.length; i++) {
      // Check abort between batches (relee el flag desde DB)
      if (await syncProgress.refreshAbort()) {
        syncProgress.log(`🛑 Abort detectado — deteniendo en batch ${i + 1}/${batches.length}`);
        abortedMidDate = true;
        break;
      }

      const batch = batches[i]!;
      const batchResult = await processBatch(batch, i + 1, batches.length);
      totalProcessed += batch.length;
      totalSucceeded += batchResult.succeeded.length;
      totalSkipped += batchResult.skipped.length;
      allFailed.push(...batchResult.failed);
      allNewIds.push(...batchResult.succeededIds);
      syncProgress.updateStats({
        totalProcessed,
        totalSucceeded,
        totalFailed: allFailed.length,
        currentBatch: i + 1,
      });
      syncProgress.log(
        `  ✓ Batch ${i + 1}/${batches.length} — ${batchResult.succeeded.length} ok, ${batchResult.skipped.length} sin datos, ${batchResult.failed.length} errores`,
      );

      if (batchResult.aborted) {
        syncProgress.log(`🛑 Abort detectado dentro del batch ${i + 1}`);
        abortedMidDate = true;
        break;
      }

      // Auto-abort si la tasa de error real (sin contar skipped) es muy alta
      const processedReal = totalSucceeded + allFailed.length;
      if (processedReal >= 20) {
        const errorRate = allFailed.length / processedReal;
        if (errorRate > env.SYNC_ABORT_ERROR_RATE) {
          const msg = `🛑 Tasa de error ${(errorRate * 100).toFixed(0)}% supera umbral ${(env.SYNC_ABORT_ERROR_RATE * 100).toFixed(0)}% — abortando sync`;
          syncProgress.log(msg);
          logger.warn({ errorRate, threshold: env.SYNC_ABORT_ERROR_RATE, allFailed: allFailed.length, processedReal }, `[${JOB_NAME}] Auto-abort triggered by high error rate`);
          abortedMidDate = true;
          break;
        }
      }
    }

    const totalFailed = allFailed.length;
    const status = deriveRunStatus({
      succeeded: totalSucceeded,
      failed: totalFailed,
      aborted: abortedMidDate,
    });

    await syncLogRepository.complete(logId, {
      status,
      totalFound,
      totalProcessed,
      totalSucceeded,
      totalFailed,
      totalSkipped,
      errorCodes: allFailed.map((f) => f.codigo),
      errorDetails: allFailed.map((f) => ({ codigo: f.codigo, error: f.error })),
      metadata: prefilterMetadata,
    });

    syncProgress.log(
      `✓ Fecha ${isoFecha}: ${totalSucceeded} guardadas, ${totalSkipped} sin datos en MP, ${totalFailed} errores reales (${status})`,
    );
    logger.info(
      { fecha: mpFecha, status, totalFound, totalSucceeded, totalFailed },
      `[${JOB_NAME}] Date sync complete`,
    );

    // Post-proceso (análisis LLM + matching + notificaciones) vive en Licitus:
    // aquí solo se le avisa qué se ingestó. Awaited a propósito — en serverless
    // una promesa suelta muere con la invocación. notifyIngested nunca lanza.
    if (allNewIds.length > 0) {
      await notifyIngested(allNewIds);
    }

    return {
      found: totalFound,
      processed: totalProcessed,
      succeeded: totalSucceeded,
      skipped: totalSkipped,
      failed: totalFailed,
      aborted: abortedMidDate,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error({ fecha: mpFecha, error }, `[${JOB_NAME}] Fatal error for date`);
    syncProgress.log(`✗ Error fatal en ${isoFecha}: ${error}`);

    await syncLogRepository.complete(logId, {
      status: 'failed',
      totalFound,
      totalProcessed,
      totalSucceeded,
      totalFailed: totalFound - totalSucceeded,
      errorDetails: [{ fatal: error }],
    });

    return {
      found: totalFound,
      processed: totalProcessed,
      succeeded: totalSucceeded,
      skipped: totalSkipped,
      failed: totalFound - totalSucceeded,
      aborted: false,
    };
  }
}

// ── Per-date sync EN CHUNKS (para el Workflow de Cloudflare) ───────────────────
//
// Cada slice corre en su propio step = invocación fresca del Worker con su propio
// presupuesto de CPU. Así una fecha con cientos/miles de licitaciones (cada una
// con su fetch de DETALLE + normalización, mucho más caro por item que una OC que
// se procesa desde memoria) no excede el CPU limit en un único step. El slice
// re-consulta el listado (I/O barato) + re-aplica el pre-filtro, y solo procesa su
// porción de códigos. Un reintento del step resume por slice.

export interface LicitacionSliceResult {
  /** Total de códigos POST-prefiltro (para que el caller sepa cuándo parar). */
  found: number;
  /** Listado crudo de MP (para totalFound del sync_log). */
  totalRaw: number;
  processed: number;
  succeeded: number;
  skipped: number;
  failed: number;
  /** UUIDs de opportunities nuevas — para auto-analysis. */
  newIds: string[];
  failedDetails: Array<{ codigo: string; error: string }>;
  prefilterMetadata: Record<string, unknown>;
  aborted: boolean;
}

/** Crea el sync_log de la fecha (marca 'running'). Devuelve el id para el complete. */
export async function beginLicitacionesDate(
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

/**
 * Procesa el slice [offset, offset+limit) de las licitaciones (post-prefiltro) de
 * la fecha. Re-fetch quiet del listado + re-prefiltro (I/O barato, CPU acotado al
 * procesamiento de la porción). Devuelve `found` = códigos post-prefiltro.
 */
export async function syncLicitacionesDateSlice(
  date: Date,
  offset: number,
  limit: number,
  prefilterOptions: PrefilterOptions,
): Promise<LicitacionSliceResult> {
  const mpFecha = toMpDateString(date);
  const isoFecha = toIsoDateString(date);

  const listado = await fetchListadoForDate(mpFecha, true);
  const totalRaw = listado.length;
  const prefiltered = prefilterListado(listado, prefilterOptions);
  const codigos = prefiltered.codigos;
  const prefilterMetadata: Record<string, unknown> = {
    discardedByStatus: prefiltered.discardedByStatus,
    discardedByPrescore: prefiltered.discardedByPrescore,
    discardedByTipo: prefiltered.discardedByTipo,
    discardedByTitle: prefiltered.discardedByTitle,
  };

  // Log del pre-filtro y stats solo en el primer slice de la fecha (evita spam).
  if (offset === 0) {
    const totalDiscarded =
      prefiltered.discardedByStatus +
      prefiltered.discardedByPrescore +
      prefiltered.discardedByTipo +
      prefiltered.discardedByTitle;
    if (totalDiscarded > 0) {
      syncProgress.log(
        `⏭ Pre-filtro (${isoFecha}): ${totalDiscarded} descartadas → ${codigos.length} a ingestar`,
      );
    }
    syncProgress.updateStats({
      totalFound: totalRaw,
      totalBatches: Math.max(1, Math.ceil(codigos.length / env.SYNC_BATCH_SIZE)),
      currentDate: isoFecha,
    });
  }

  const sliceCodigos = codigos.slice(offset, offset + limit);
  if (sliceCodigos.length === 0) {
    return {
      found: codigos.length,
      totalRaw,
      processed: 0,
      succeeded: 0,
      skipped: 0,
      failed: 0,
      newIds: [],
      failedDetails: [],
      prefilterMetadata,
      aborted: false,
    };
  }

  const batches = chunk(sliceCodigos, env.SYNC_BATCH_SIZE);
  const globalTotalBatches = Math.max(1, Math.ceil(codigos.length / env.SYNC_BATCH_SIZE));
  const baseBatchIndex = Math.floor(offset / env.SYNC_BATCH_SIZE);

  syncProgress.log(
    `Slice licitaciones ${offset + 1}-${offset + sliceCodigos.length}/${codigos.length} (fecha ${mpFecha})...`,
  );

  let succeeded = 0;
  let skipped = 0;
  const failedDetails: Array<{ codigo: string; error: string }> = [];
  const newIds: string[] = [];
  let aborted = false;

  for (let i = 0; i < batches.length; i++) {
    if (await syncProgress.refreshAbort()) {
      aborted = true;
      break;
    }
    const r = await processBatch(batches[i]!, baseBatchIndex + i + 1, globalTotalBatches);
    succeeded += r.succeeded.length;
    skipped += r.skipped.length;
    failedDetails.push(...r.failed);
    newIds.push(...r.succeededIds);
    if (r.aborted) {
      aborted = true;
      break;
    }
  }

  return {
    found: codigos.length,
    totalRaw,
    processed: sliceCodigos.length,
    succeeded,
    skipped,
    failed: failedDetails.length,
    newIds,
    failedDetails,
    prefilterMetadata,
    aborted,
  };
}

/** Completa el sync_log de la fecha con los totales acumulados de todos los slices. */
export async function completeLicitacionesDate(
  logId: string,
  isoFecha: string,
  totals: {
    totalRaw: number;
    processed: number;
    succeeded: number;
    skipped: number;
    failedDetails: Array<{ codigo: string; error: string }>;
    prefilterMetadata: Record<string, unknown>;
    aborted: boolean;
  },
): Promise<void> {
  const failed = totals.failedDetails.length;
  const status = deriveRunStatus({
    succeeded: totals.succeeded,
    failed,
    aborted: totals.aborted,
  });

  await syncLogRepository.complete(logId, {
    status,
    totalFound: totals.totalRaw,
    totalProcessed: totals.processed,
    totalSucceeded: totals.succeeded,
    totalFailed: failed,
    totalSkipped: totals.skipped,
    errorCodes: totals.failedDetails.map((f) => f.codigo),
    errorDetails: totals.failedDetails.map((f) => ({ codigo: f.codigo, error: f.error })),
    metadata: { ...totals.prefilterMetadata, chunked: true },
  });

  syncProgress.log(
    `✓ Fecha ${isoFecha}: ${totals.succeeded} guardadas, ${totals.skipped} sin datos en MP, ${failed} errores reales (${status})`,
  );
  logger.info(
    {
      isoFecha,
      status,
      totalFound: totals.totalRaw,
      totalSucceeded: totals.succeeded,
      totalFailed: failed,
    },
    `[${JOB_NAME}] Date sync complete (chunked)`,
  );
}

// ── Main job ──────────────────────────────────────────────────

export interface SyncJobOptions {
  /** Número de días hacia atrás a procesar (0 = solo hoy). Default: env.SYNC_LOOKBACK_DAYS */
  daysBack?: number;
  /** Fecha específica ISO (YYYY-MM-DD). Si se provee, ignora daysBack y solo procesa esa fecha. */
  specificDate?: string;
  /** Rango histórico - Fecha inicio ISO (YYYY-MM-DD). */
  startDate?: string;
  /** Rango histórico - Fecha fin ISO (YYYY-MM-DD). */
  endDate?: string;
  /** Límite máximo de licitaciones a ingestar (corta al llegar). */
  maxItems?: number;
  /** Si true, saltea fechas que ya tienen sync exitoso en sync_logs. */
  skipAlreadySynced?: boolean;
  /** Permite saltar la validación dura de un solo job permitiendo paralelismo si su nombre es distinto. */
  jobNameOverride?: string;
  /**
   * CodigoEstado permitidos del listado, o 'all' para no filtrar.
   * Default: env.SYNC_STATUS_CODES. El backfill histórico usa 'all'
   * para capturar cerradas/adjudicadas (alimentan buyer profiles).
   */
  statusFilter?: StatusFilter;
  /** Solo ingestar estos tipos de licitación (L1, LE, LP, LQ, LR, B2, CO, E2, CD). */
  tenderTypes?: string[];
  /** Solo ingestar licitaciones cuyo título contenga este texto (insensible a acentos). */
  titleKeyword?: string;
}

// ── Planificación (compartida entre el runner Node y el Workflow) ───────────

export interface SyncRunPlan {
  activeJobName: string;
  /** Fechas ISO (YYYY-MM-DD) — serializables como params de un Workflow step. */
  isoDates: string[];
  prefilterOptions: PrefilterOptions;
}

/** Convierte ISO YYYY-MM-DD a Date en mediodía UTC (evita off-by-one de TZ). */
export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d, 12));
}

function computeDates(options: SyncJobOptions): Date[] {
  const now = new Date();
  const dates: Date[] = [];

  if (options.startDate && options.endDate) {
    const start = new Date(options.startDate + 'T12:00:00Z');
    const end = new Date(options.endDate + 'T12:00:00Z');
    // Iteramos de inicio a fin incrementalmente
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }
  } else if (options.specificDate) {
    dates.push(isoToDate(options.specificDate));
  } else {
    const lookback = options.daysBack ?? env.SYNC_LOOKBACK_DAYS;
    for (let i = lookback; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      dates.push(d);
    }
  }

  return dates;
}

/**
 * Resuelve fechas + pre-filtro para una corrida. Retorna null si ya hay un
 * job del mismo nombre corriendo (anti-solapamiento vía sync_logs).
 */
export async function planSyncRun(options: SyncJobOptions = {}): Promise<SyncRunPlan | null> {
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

  let dates = computeDates(options);

  if (options.skipAlreadySynced) {
    const filtered: Date[] = [];
    for (const d of dates) {
      const iso = toIsoDateString(d);
      const alreadySynced = await syncLogRepository.hasSuccessForDate(activeJobName, iso);
      if (alreadySynced) {
        logger.info({ iso }, `[${activeJobName}] Skipping date — already synced`);
      } else {
        filtered.push(d);
      }
    }
    dates = filtered;
  }

  // ── Resolver pre-filtro para toda la corrida ────────────────
  const statusFilter = options.statusFilter ?? parseStatusFilter(env.SYNC_STATUS_CODES);
  let prescoreKeywords: string[] | null = null;
  if (env.SYNC_PRESCORE_ENABLED) {
    try {
      prescoreKeywords = await supplierProfileRepository.findAllKeywords();
    } catch (err) {
      logger.warn({ err }, `[${activeJobName}] Failed to load keywords for prescore — disabled`);
    }
  }

  return {
    activeJobName,
    isoDates: dates.map(toIsoDateString),
    prefilterOptions: {
      statusFilter,
      prescoreKeywords,
      tenderTypes: options.tenderTypes,
      titleKeyword: options.titleKeyword,
    },
  };
}

/** Inicializa la fila de progreso y anuncia la corrida. */
export async function startSyncRun(plan: SyncRunPlan, options: SyncJobOptions = {}): Promise<void> {
  await syncProgress.start(plan.activeJobName);
  syncProgress.updateStats({ totalDates: plan.isoDates.length, currentDateIndex: 0 });
  syncProgress.log(`Fechas a procesar (${plan.isoDates.length}): ${plan.isoDates.join(', ')}`);
  const { statusFilter, prescoreKeywords } = plan.prefilterOptions;
  if (statusFilter !== 'all') {
    syncProgress.log(`⚙ Filtro de estado: CodigoEstado ∈ [${statusFilter.join(', ')}]`);
  }
  if (prescoreKeywords) {
    syncProgress.log(`⚙ Pre-score activo con ${prescoreKeywords.length} keywords agregadas`);
  }
  if (options.maxItems) syncProgress.log(`⚙ Límite de licitaciones: ${options.maxItems}`);

  logger.info({ dates: plan.isoDates, options }, `[${plan.activeJobName}] Starting run`);
}

export async function runSyncLicitacionesJob(options: SyncJobOptions = {}): Promise<void> {
  const plan = await planSyncRun(options);
  if (!plan) return;

  await startSyncRun(plan, options);

  let totalIngested = 0;
  let aborted = false;

  for (let i = 0; i < plan.isoDates.length; i++) {
    // Check abort between dates (relee el flag desde DB)
    if (await syncProgress.refreshAbort()) {
      syncProgress.log('🛑 Sync abortado por solicitud del usuario');
      logger.info(`[${plan.activeJobName}] Aborted by user request`);
      aborted = true;
      break;
    }

    syncProgress.updateStats({ currentDateIndex: i + 1 });
    const result = await syncForDate(
      isoToDate(plan.isoDates[i]!),
      plan.activeJobName,
      plan.prefilterOptions,
    );
    totalIngested += result.succeeded;
    if (result.aborted) aborted = true;

    if (options.maxItems && totalIngested >= options.maxItems) {
      syncProgress.log(`⚙ Límite de ${options.maxItems} licitaciones alcanzado — deteniendo`);
      break;
    }
  }

  aborted = aborted || syncProgress.isAbortRequested();
  await syncProgress.finish(
    aborted ? 'Sincronización abortada' : 'Sincronización completada',
    plan.activeJobName,
  );
  logger.info(`[${plan.activeJobName}] Run finished`);
}
