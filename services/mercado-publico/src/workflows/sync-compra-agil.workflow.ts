import { sleep } from 'workflow';
import {
  planCompraAgilRun,
  startCompraAgilRun,
  beginCompraAgilDate,
  syncCompraAgilDateSlice,
  completeCompraAgilDate,
  extraerOfertasCompraAgil,
  isoToDate,
  type CompraAgilJobOptions,
  type CompraAgilRunPlan,
  type CompraAgilSliceResult,
} from '../jobs/sync-compra-agil.job.js';
import { notifyIngested } from '../infrastructure/licitus-callback/licitus-callback.js';
import { clampPageSize } from '../infrastructure/mercado-publico/compra-agil.client.js';
import { env } from '../app/env.js';
import { syncProgress } from '../jobs/sync-progress.store.js';
import { logger } from '../infrastructure/logging/logger.js';

/**
 * Sync de Compras Ágiles (API v2) como Workflow durable — un step por página.
 *
 * Portado desde Cloudflare (ver notas en `sync-licitaciones.workflow.ts`).
 * Particularidad propia: la API v2 tiene CUOTA DIARIA, así que un slice puede
 * devolver `quotaExhausted` y eso corta el run entero de forma limpia (no es
 * un error: es "ya no queda cuota hoy").
 */

export type SyncCompraAgilParams = CompraAgilJobOptions & {
  /** Espera durable antes de empezar — escalonamiento respecto al sync de licitaciones. */
  delayMinutes?: number;
};

interface PlannedRun {
  plan: CompraAgilRunPlan | null;
  pageSize: number;
}

async function planStep(options: CompraAgilJobOptions): Promise<PlannedRun> {
  'use step';
  const plan = await planCompraAgilRun(options);
  if (plan) await startCompraAgilRun(plan);
  // clampPageSize: la API v2 solo admite tamano_pagina 10..50.
  return { plan, pageSize: clampPageSize(env.COMPRA_AGIL_CHUNK_SIZE) };
}

async function beginDateStep(
  iso: string,
  activeJobName: string,
): Promise<{ logId: string; isoFecha: string }> {
  'use step';
  return beginCompraAgilDate(isoToDate(iso), activeJobName);
}

async function syncSliceStep(
  iso: string,
  offset: number,
  pageSize: number,
  dateIndex: number,
  carryFound: number,
  sliceOptions: {
    cambioHasta: CompraAgilRunPlan['cambioHasta'];
    estados: CompraAgilRunPlan['estados'];
    skipDetalle: CompraAgilRunPlan['skipDetalle'];
    incrementalHours: CompraAgilRunPlan['incrementalHours'];
  },
): Promise<CompraAgilSliceResult> {
  'use step';
  if (await syncProgress.refreshAbort()) {
    return {
      found: carryFound,
      processed: 0,
      succeeded: 0,
      failed: 0,
      newIds: [],
      aborted: true,
      quotaExhausted: false,
    };
  }
  syncProgress.updateStats({ currentDateIndex: dateIndex, currentDate: iso });
  return syncCompraAgilDateSlice(isoToDate(iso), offset, pageSize, sliceOptions);
}
syncSliceStep.maxRetries = 2;

async function completeDateStep(
  logId: string,
  isoFecha: string,
  totals: { found: number; succeeded: number; failed: number; aborted: boolean; errored: boolean },
): Promise<void> {
  'use step';
  await completeCompraAgilDate(logId, isoFecha, totals);
}

async function logDateFailureStep(
  activeJobName: string,
  iso: string,
  error: string,
): Promise<void> {
  'use step';
  logger.error({ iso, error }, `[${activeJobName}] Date failed after retries`);
  syncProgress.log(`✗ Fecha ${iso} falló tras reintentos (${error}) — continúo`);
}

async function notifyStep(opportunityIds: string[]): Promise<void> {
  'use step';
  await notifyIngested(opportunityIds);
}
notifyStep.maxRetries = 1;

/**
 * Extraer la competencia del payload recién ingerido.
 *
 * Va como STEP propio y no dentro de finishStep: cada step corre en su propia
 * invocación con su propio presupuesto, y esto reconstruye ~7.000 ofertas y
 * ~18.000 líneas de producto. Metido junto al cierre, un run grande podría
 * agotar el tiempo del step y dejar el sync sin marcar como terminado.
 *
 * Antes de finishStep para que el mensaje de "Sincronización completada" sea
 * verdad: cuando aparece, las ofertas ya están extraídas.
 */
async function extraerOfertasStep(activeJobName: string): Promise<void> {
  'use step';
  await extraerOfertasCompraAgil(activeJobName);
}

async function finishStep(
  activeJobName: string,
  aborted: boolean,
  quotaExhausted: boolean,
  dates: number,
): Promise<void> {
  'use step';
  const msg = quotaExhausted
    ? 'Sincronización detenida: cuota diaria de la API agotada'
    : aborted
      ? 'Sincronización abortada'
      : 'Sincronización completada';
  // activeJobName explícito: este step corre en otra invocación que el start().
  await syncProgress.finish(msg, activeJobName);
  logger.info({ aborted, quotaExhausted, dates }, `[${activeJobName}] Workflow run finished`);
}

export async function syncCompraAgilWorkflow(params: SyncCompraAgilParams = {}): Promise<unknown> {
  'use workflow';

  const { delayMinutes, ...options } = params;

  if (delayMinutes && delayMinutes > 0) {
    await sleep(`${delayMinutes}m`);
  }

  const { plan, pageSize } = await planStep(options);
  if (!plan) return { skipped: true, reason: 'job already running' };

  let aborted = false;
  let quotaExhausted = false;
  const perDate: Array<{ date: string; succeeded: number; failed: number }> = [];

  const sliceOptions = {
    cambioHasta: plan.cambioHasta,
    estados: plan.estados,
    skipDetalle: plan.skipDetalle,
    incrementalHours: plan.incrementalHours,
  };

  for (let i = 0; i < plan.isoDates.length; i++) {
    const iso = plan.isoDates[i]!;

    const { logId, isoFecha } = await beginDateStep(iso, plan.activeJobName);

    let offset = 0;
    let found = 0;
    let succeeded = 0;
    let failed = 0;
    let dateAborted = false;
    let dateErrored = false;
    const newIds: string[] = [];

    try {
      for (;;) {
        const r = await syncSliceStep(iso, offset, pageSize, i + 1, found, sliceOptions);

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
      }
    } catch (err) {
      // Ver nota equivalente en sync-ordenes.workflow.ts: una fecha que agota
      // reintentos no debe tumbar el run ni dejar su sync_log 'running' huérfano.
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

    if (newIds.length > 0 && !plan.skipAutoAnalysis) {
      await notifyStep(newIds);
    }

    perDate.push({ date: iso, succeeded, failed });

    if (dateAborted) {
      aborted = true;
      break;
    }
  }

  await extraerOfertasStep(plan.activeJobName);

  await finishStep(plan.activeJobName, aborted, quotaExhausted, perDate.length);

  return { aborted, quotaExhausted, perDate };
}
