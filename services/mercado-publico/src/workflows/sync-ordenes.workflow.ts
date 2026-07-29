import { sleep } from 'workflow';
import {
  planOrdenesRun,
  startOrdenesRun,
  beginOrdenesDate,
  syncOrdenesDateSlice,
  completeOrdenesDate,
  isoToDate,
  type SyncJobOptions,
  type OcSyncRunPlan,
  type OcSliceResult,
} from '../jobs/sync-ordenes.job.js';
import { runEnrichOrdenesJob } from '../jobs/enrich-ordenes.job.js';
import { env } from '../app/env.js';
import { syncProgress } from '../jobs/sync-progress.store.js';
import { logger } from '../infrastructure/logging/logger.js';

/**
 * Sync de órdenes de compra como Workflow durable — un step por slice de fecha.
 *
 * Portado desde Cloudflare (ver notas en `sync-licitaciones.workflow.ts`). El
 * escalonamiento con `step.sleep` pasa a `sleep()` de Workflow DevKit, que
 * suspende el run sin consumir recursos.
 */

export type SyncOrdenesParams = SyncJobOptions & {
  /**
   * Espera durable antes de empezar. Venía del límite de crons de Cloudflare
   * (licitaciones y órdenes disparaban en el mismo tick); se conserva porque
   * sigue cumpliendo su función real: no golpear la API de MP con ambos syncs
   * a la vez.
   */
  delayMinutes?: number;
};

interface PlannedRun {
  plan: OcSyncRunPlan | null;
  chunkSize: number;
  enrichEnabled: boolean;
}

async function planStep(options: SyncJobOptions): Promise<PlannedRun> {
  'use step';
  const plan = await planOrdenesRun(options);
  if (plan) await startOrdenesRun(plan);
  return { plan, chunkSize: env.SYNC_OC_CHUNK_SIZE, enrichEnabled: env.ENRICH_OC_ENABLED };
}

async function beginDateStep(
  iso: string,
  activeJobName: string,
): Promise<{ logId: string; isoFecha: string }> {
  'use step';
  return beginOrdenesDate(isoToDate(iso), activeJobName);
}

async function syncSliceStep(
  iso: string,
  offset: number,
  limit: number,
  dateIndex: number,
  carryFound: number,
): Promise<OcSliceResult> {
  'use step';
  if (await syncProgress.refreshAbort()) {
    return { found: carryFound, processed: 0, succeeded: 0, failed: 0, aborted: true };
  }
  syncProgress.updateStats({ currentDateIndex: dateIndex });
  return syncOrdenesDateSlice(isoToDate(iso), offset, limit);
}
syncSliceStep.maxRetries = 2;

async function completeDateStep(
  logId: string,
  isoFecha: string,
  totals: { found: number; succeeded: number; failed: number; aborted: boolean; errored: boolean },
): Promise<void> {
  'use step';
  await completeOrdenesDate(logId, isoFecha, totals);
}

async function logDateFailureStep(
  activeJobName: string,
  iso: string,
  error: string,
): Promise<void> {
  'use step';
  logger.error({ iso, error }, `[${activeJobName}] Date failed after retries — continuing`);
  syncProgress.log(`✗ Fecha ${iso} falló tras reintentos (${error}) — continúo con la siguiente`);
}

async function finishStep(activeJobName: string, aborted: boolean, dates: number): Promise<void> {
  'use step';
  await syncProgress.finish(aborted ? 'Sincronización abortada' : 'Sincronización completada');
  logger.info({ aborted, dates }, `[${activeJobName}] Workflow run finished`);
}

async function enrichStep(): Promise<void> {
  'use step';
  await runEnrichOrdenesJob();
}
enrichStep.maxRetries = 1;

export async function syncOrdenesWorkflow(params: SyncOrdenesParams = {}): Promise<unknown> {
  'use workflow';

  const { delayMinutes, ...options } = params;

  if (delayMinutes && delayMinutes > 0) {
    await sleep(`${delayMinutes}m`);
  }

  const { plan, chunkSize, enrichEnabled } = await planStep(options);
  if (!plan) return { skipped: true, reason: 'job already running' };

  let aborted = false;
  const perDate: Array<{ date: string; succeeded: number; failed: number }> = [];

  for (let i = 0; i < plan.isoDates.length; i++) {
    const iso = plan.isoDates[i]!;

    const { logId, isoFecha } = await beginDateStep(iso, plan.activeJobName);

    let offset = 0;
    let found = 0;
    let succeeded = 0;
    let failed = 0;
    let dateAborted = false;
    let dateErrored = false;

    try {
      for (;;) {
        const r = await syncSliceStep(iso, offset, chunkSize, i + 1, found);

        found = r.found;
        succeeded += r.succeeded;
        failed += r.failed;

        if (r.aborted) {
          dateAborted = true;
          break;
        }
        offset += chunkSize;
        if (offset >= found) break;
      }
    } catch (err) {
      // Una fecha que agota los reintentos del step NO debe tumbar el run
      // completo: sin este catch el workflow moría aquí, su sync_log quedaba
      // 'running' huérfano, las fechas restantes no se sincronizaban y el
      // enriquecimiento final no corría NUNCA (así estuvo muerto del 15 al 19
      // de julio de 2026). Se conserva tal cual del original.
      dateErrored = true;
      const error = err instanceof Error ? err.message : String(err);
      await logDateFailureStep(plan.activeJobName, iso, error);
    }

    await completeDateStep(logId, isoFecha, {
      found,
      succeeded,
      failed,
      aborted: dateAborted,
      errored: dateErrored,
    });

    perDate.push({ date: iso, succeeded, failed });

    if (dateAborted) {
      aborted = true;
      break;
    }
  }

  await finishStep(plan.activeJobName, aborted, perDate.length);

  // Enriquecimiento por detalle de las OCs sin proveedor, en step propio.
  if (!aborted && enrichEnabled) {
    await enrichStep();
  }

  return { aborted, perDate };
}
