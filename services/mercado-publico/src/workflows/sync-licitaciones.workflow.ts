import {
  planSyncRun,
  startSyncRun,
  beginLicitacionesDate,
  syncLicitacionesDateSlice,
  completeLicitacionesDate,
  isoToDate,
  type SyncJobOptions,
  type SyncRunPlan,
  type LicitacionSliceResult,
} from '../jobs/sync-licitaciones.job.js';
import { notifyIngested } from '../infrastructure/licitus-callback/licitus-callback.js';
import { env } from '../app/env.js';
import { syncProgress } from '../jobs/sync-progress.store.js';
import { logger } from '../infrastructure/logging/logger.js';

/**
 * Sync de licitaciones como Workflow durable (Vercel Workflow DevKit).
 *
 * Portado desde el `WorkflowEntrypoint` de Cloudflare. Cambios respecto al
 * original, y por qué:
 *
 *  - `step.do(name, fn)` → funciones marcadas `"use step"`. El nombre del step
 *    ya no se construye a mano (`sync-lic-${iso}-${offset}`): el runtime
 *    identifica cada invocación por posición en el event log.
 *  - `withDb(this.env, ...)` desapareció: no hay Hyperdrive ni pool por
 *    request — `pg-client.ts` es un singleton (ver su docblock).
 *  - El step de auto-analysis pasó a ser el callback a Licitus.
 *  - **El cuerpo del workflow ya no lee `env`**: corre en un sandbox sin acceso
 *    completo a Node (no hay `process.env`). Toda la config que la orquestación
 *    necesita (tamaño de chunk, umbral de aborto) se resuelve dentro del step
 *    `planStep` y viaja en su valor de retorno.
 *
 * Se conserva el chunking por slices: aunque el límite de CPU de Cloudflare ya
 * no aplica, es lo que mantiene cada step barato y reintentable de forma
 * independiente, y permite reanudar una fecha por donde iba.
 */

interface PlannedRun {
  plan: SyncRunPlan | null;
  chunkSize: number;
  abortErrorRate: number;
}

async function planStep(options: SyncJobOptions): Promise<PlannedRun> {
  'use step';
  const plan = await planSyncRun(options);
  if (plan) await startSyncRun(plan, options);
  return {
    plan,
    chunkSize: env.SYNC_LIC_CHUNK_SIZE,
    abortErrorRate: env.SYNC_ABORT_ERROR_RATE,
  };
}

async function beginDateStep(
  iso: string,
  activeJobName: string,
): Promise<{ logId: string; isoFecha: string }> {
  'use step';
  return beginLicitacionesDate(isoToDate(iso), activeJobName);
}

async function syncSliceStep(
  iso: string,
  offset: number,
  limit: number,
  prefilterOptions: SyncRunPlan['prefilterOptions'],
  dateIndex: number,
  carry: { found: number; totalRaw: number; prefilterMetadata: Record<string, unknown> },
): Promise<LicitacionSliceResult> {
  'use step';

  // El abort viaja por la tabla job_progress: el endpoint admin lo marca y cada
  // slice lo relee antes de procesar. Se conserva del diseño original.
  if (await syncProgress.refreshAbort()) {
    return {
      found: carry.found,
      totalRaw: carry.totalRaw,
      processed: 0,
      succeeded: 0,
      skipped: 0,
      failed: 0,
      newIds: [],
      failedDetails: [],
      prefilterMetadata: carry.prefilterMetadata,
      aborted: true,
    };
  }

  syncProgress.updateStats({ currentDateIndex: dateIndex });
  return syncLicitacionesDateSlice(isoToDate(iso), offset, limit, prefilterOptions);
}
// Cada slice hace I/O contra MP: vale reintentar, pero no eternamente.
syncSliceStep.maxRetries = 2;

async function completeDateStep(
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
  'use step';
  await completeLicitacionesDate(logId, isoFecha, totals);
}

async function notifyStep(opportunityIds: string[]): Promise<void> {
  'use step';
  await notifyIngested(opportunityIds);
}

async function finishStep(
  activeJobName: string,
  totalIngested: number,
  aborted: boolean,
  dates: number,
  maxItems?: number,
): Promise<void> {
  'use step';
  if (maxItems && totalIngested >= maxItems) {
    syncProgress.log(`⚙ Límite de ${maxItems} licitaciones alcanzado — deteniendo`);
  }
  await syncProgress.finish(aborted ? 'Sincronización abortada' : 'Sincronización completada');
  logger.info({ totalIngested, aborted, dates }, `[${activeJobName}] Workflow run finished`);
}

export async function syncLicitacionesWorkflow(options: SyncJobOptions = {}): Promise<unknown> {
  'use workflow';

  const { plan, chunkSize, abortErrorRate } = await planStep(options);
  if (!plan) return { skipped: true, reason: 'job already running' };

  let totalIngested = 0;
  let aborted = false;
  const perDate: Array<{ date: string; succeeded: number; failed: number }> = [];

  for (let i = 0; i < plan.isoDates.length; i++) {
    const iso = plan.isoDates[i]!;

    const { logId, isoFecha } = await beginDateStep(iso, plan.activeJobName);

    let offset = 0;
    let found = 0;
    let totalRaw = 0;
    let processed = 0;
    let succeeded = 0;
    let skipped = 0;
    const failedDetails: Array<{ codigo: string; error: string }> = [];
    const newIds: string[] = [];
    let prefilterMetadata: Record<string, unknown> = {};
    let dateAborted = false;

    for (;;) {
      const r = await syncSliceStep(iso, offset, chunkSize, plan.prefilterOptions, i + 1, {
        found,
        totalRaw,
        prefilterMetadata,
      });

      found = r.found;
      totalRaw = r.totalRaw;
      processed += r.processed;
      succeeded += r.succeeded;
      skipped += r.skipped;
      failedDetails.push(...r.failedDetails);
      newIds.push(...r.newIds);
      prefilterMetadata = r.prefilterMetadata;

      if (r.aborted) {
        dateAborted = true;
        break;
      }

      // Auto-abort si la tasa de error real (sin contar skipped) supera el umbral.
      const processedReal = succeeded + failedDetails.length;
      if (processedReal >= 20 && failedDetails.length / processedReal > abortErrorRate) {
        dateAborted = true;
        break;
      }

      offset += chunkSize;
      if (offset >= found) break;
    }

    await completeDateStep(logId, isoFecha, {
      totalRaw,
      processed,
      succeeded,
      skipped,
      failedDetails,
      prefilterMetadata,
      aborted: dateAborted,
    });

    // Post-proceso en Licitus, en su propio step (no mezclar con el sync).
    if (newIds.length > 0) {
      await notifyStep(newIds);
    }

    totalIngested += succeeded;
    perDate.push({ date: iso, succeeded, failed: failedDetails.length });

    if (dateAborted) {
      aborted = true;
      break;
    }
    if (options.maxItems && totalIngested >= options.maxItems) break;
  }

  await finishStep(plan.activeJobName, totalIngested, aborted, perDate.length, options.maxItems);

  return { totalIngested, aborted, perDate };
}
