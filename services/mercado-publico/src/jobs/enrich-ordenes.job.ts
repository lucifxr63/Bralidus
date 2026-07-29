/**
 * Enrich Órdenes de Compra Job (Item 2 del IMPLEMENTATION_PLAN)
 *
 * El sync masivo de OC (sync-ordenes.job) ingiere solo desde el listado de
 * Mercado Público, que NO trae Proveedor ni Montos. Este job re-consulta el
 * detalle por código SOLO de un conjunto dirigido y acotado de OCs sin
 * proveedor, priorizando las de organismos con buyer_profile.
 *
 * No usa cron propio (CF Workers limita a 5 crons): corre encadenado tras el
 * sync de OC (workflow SyncOrdenes, step 'enrich-oc').
 * Se auto-desactiva con ENRICH_OC_ENABLED=false.
 */

import { env } from '../app/env.js';
import { logger } from '../infrastructure/logging/logger.js';
import { ingestOrdenCompraUseCase } from '../modules/purchase-orders/application/ingest-orden-compra.use-case.js';
import { purchaseOrderRepository } from '../modules/purchase-orders/infrastructure/purchase-order.repository.js';
import { syncLogRepository } from '../modules/sync/infrastructure/sync-log.repository.js';
import { AppError } from '../shared/errors/app-error.js';

const JOB_NAME = 'enrich-ordenes';

/** Ver la nota en refresh-opportunities.job.ts: mismo criterio, misma razón. */
const FAILURE_RATE_THRESHOLD = 0.5;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// ── Helper puro (testeable) ───────────────────────────────────

export type EnrichmentOutcome = 'enriched' | 'still_incomplete' | 'not_found';

/**
 * Clasifica el resultado de intentar enriquecer una OC:
 *  - not_found:        MP no devolvió detalle (raw = null / NOT_FOUND)
 *  - enriched:         el detalle trajo proveedor (supplierCode o supplierRut)
 *  - still_incomplete: hubo detalle pero sigue sin proveedor
 * Pura: no toca DB ni red — recibe solo los campos relevantes.
 */
export function classifyEnrichment(
  detail: { supplierCode: string | null; supplierRut?: string | null } | null,
): EnrichmentOutcome {
  if (detail == null) return 'not_found';
  if (detail.supplierCode != null || detail.supplierRut != null) return 'enriched';
  return 'still_incomplete';
}

// ── Job ───────────────────────────────────────────────────────

interface EnrichStats {
  candidates: number;
  enriched: number;
  stillIncomplete: number;
  notFound: number;
  failed: number;
}

export async function runEnrichOrdenesJob(): Promise<void> {
  if (!env.ENRICH_OC_ENABLED) {
    logger.info(`[${JOB_NAME}] ENRICH_OC_ENABLED=false — skipping`);
    return;
  }

  const cleared = await syncLogRepository.clearStaleRunning(JOB_NAME, 120);
  if (cleared > 0) logger.warn({ cleared }, `[${JOB_NAME}] Cleared stale running logs`);
  const isRunning = await syncLogRepository.hasRunningJob(JOB_NAME);
  if (isRunning) {
    logger.warn(`[${JOB_NAME}] Job already running — skipping tick`);
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const logId = await syncLogRepository.create({
    jobName: JOB_NAME,
    fechaConsultada: today,
    metadata: { maxItems: env.ENRICH_OC_MAX_ITEMS },
  });

  const stats: EnrichStats = {
    candidates: 0,
    enriched: 0,
    stillIncomplete: 0,
    notFound: 0,
    failed: 0,
  };

  try {
    const candidates = await purchaseOrderRepository.findPendingEnrichment(env.ENRICH_OC_MAX_ITEMS);
    stats.candidates = candidates.length;
    logger.info({ candidates: candidates.length }, `[${JOB_NAME}] Starting enrichment pass`);

    for (const candidate of candidates) {
      let outcome: EnrichmentOutcome;
      try {
        // execute() = fetch detalle por código + normalize + upsert (COALESCE)
        // + recalcula buyer reputation fire-and-forget.
        const order = await ingestOrdenCompraUseCase.execute(candidate.externalCode);
        outcome = classifyEnrichment(order);
      } catch (err) {
        if (err instanceof AppError && err.code === 'NOT_FOUND') {
          outcome = 'not_found';
        } else {
          stats.failed++;
          const error = err instanceof Error ? err.message : String(err);
          logger.warn({ codigo: candidate.externalCode, error }, `[${JOB_NAME}] Enrichment failed`);
          if (env.SYNC_REQUEST_DELAY_MS > 0) await sleep(env.SYNC_REQUEST_DELAY_MS);
          continue;
        }
      }

      if (outcome === 'enriched') {
        stats.enriched++;
      } else {
        // still_incomplete o not_found: consumir un intento para no reintentar por siempre
        if (outcome === 'not_found') stats.notFound++;
        else stats.stillIncomplete++;
        await purchaseOrderRepository.incrementEnrichmentAttempts(candidate.externalCode);
      }

      if (env.SYNC_REQUEST_DELAY_MS > 0) await sleep(env.SYNC_REQUEST_DELAY_MS);
    }

    // Estado por TASA de fallo, no por "hubo al menos un éxito" — mismo criterio
    // y misma razón que en refresh-opportunities.job.ts (ver nota allá): con la
    // condición anterior, un único acierto enmascaraba cualquier cantidad de
    // fallos y la alerta de ops nunca se disparaba.
    const attempted = stats.enriched + stats.failed;
    const failureRate = attempted > 0 ? stats.failed / attempted : 0;
    const degraded = failureRate >= FAILURE_RATE_THRESHOLD;

    await syncLogRepository.complete(logId, {
      status: degraded ? 'failed' : 'success',
      totalFound: stats.candidates,
      totalProcessed: stats.candidates,
      totalSucceeded: stats.enriched,
      totalFailed: stats.failed,
      ...(degraded
        ? {
            errorCodes: ['HIGH_FAILURE_RATE'],
            errorDetails: [
              {
                failureRate: Number(failureRate.toFixed(3)),
                threshold: FAILURE_RATE_THRESHOLD,
                enriched: stats.enriched,
                failed: stats.failed,
              },
            ],
          }
        : {}),
      metadata: {
        stillIncomplete: stats.stillIncomplete,
        notFound: stats.notFound,
        failureRate: Number(failureRate.toFixed(3)),
      },
    });

    logger.info({ ...stats }, `[${JOB_NAME}] Enrichment pass complete`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error({ error }, `[${JOB_NAME}] Fatal error`);
    await syncLogRepository.complete(logId, {
      status: 'failed',
      totalFound: stats.candidates,
      totalProcessed: stats.enriched + stats.stillIncomplete + stats.notFound + stats.failed,
      totalSucceeded: stats.enriched,
      totalFailed: stats.failed,
      errorDetails: [{ fatal: error }],
    });
  }
}
