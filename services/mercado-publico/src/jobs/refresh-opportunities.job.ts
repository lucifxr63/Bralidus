/**
 * Refresh Opportunities Job (Fase C del plan)
 *
 * Las licitaciones se ingieren el día de publicación y sus estados cambian
 * después (cierre, adjudicación, desierta…). Este job re-consulta el detalle
 * SOLO de un conjunto dirigido de oportunidades (guardadas/pipeline, próximas
 * a cerrar, cerradas sin adjudicación) y emite EVENTOS hacia Licitus cuando
 * detecta:
 *  - cambio de estado relevante  → opportunity.status_changed
 *  - cierre dentro de la ventana → opportunity.closing_soon
 *
 * OJO — cambio respecto a la versión que vivía en Licitus: aquí ya NO se crean
 * notificaciones ni se resuelven destinatarios. Este servicio solo detecta y
 * reporta el hecho; Licitus recibe el evento y decide a quién notificar (es
 * quien conoce a los usuarios). Ver `infrastructure/licitus-callback`.
 *
 * Corre cada 6 h (cron externo) con tope REFRESH_MAX_ITEMS.
 */

import { env } from '../app/env.js';
import { logger } from '../infrastructure/logging/logger.js';
import { ingestLicitacionUseCase } from '../modules/opportunities/application/ingest-licitacion.use-case.js';
import {
  opportunityRepository,
  type RefreshCandidate,
} from '../modules/opportunities/infrastructure/opportunity.repository.js';
import {
  notifyLicitus,
  type PostIngestEvent,
} from '../infrastructure/licitus-callback/licitus-callback.js';
import { syncLogRepository } from '../modules/sync/infrastructure/sync-log.repository.js';
import { AppError } from '../shared/errors/app-error.js';

const JOB_NAME = 'refresh-opportunities';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// ── Helpers puros (testeables) ────────────────────────────────

/** Normaliza status_code TEXT ('05' → '5'); null si no es numérico. */
export function normalizeStatusCode(code: string | null): string | null {
  if (code == null) return null;
  const n = parseInt(code, 10);
  return Number.isNaN(n) ? null : String(n);
}

const STATUS_EVENTS: Record<string, { emoji: string; label: string }> = {
  '6': { emoji: '🔒', label: 'cerró recepción de ofertas' },
  '7': { emoji: '🚫', label: 'fue declarada desierta' },
  '8': { emoji: '🏆', label: 'fue adjudicada' },
  '15': { emoji: '⛔', label: 'fue revocada' },
  '18': { emoji: '⏸️', label: 'fue suspendida' },
};

export type StatusChangeEvent = {
  newStatus: string;
  title: string;
  dedupeKey: string;
};

/**
 * Evento de cambio de estado si la transición es relevante para notificar.
 * Retorna null si no cambió o el nuevo estado no está en el catálogo.
 */
export function buildStatusChangeEvent(
  opportunityId: string,
  opportunityTitle: string,
  oldStatusCode: string | null,
  newStatusCode: string | null,
): StatusChangeEvent | null {
  const oldNorm = normalizeStatusCode(oldStatusCode);
  const newNorm = normalizeStatusCode(newStatusCode);
  if (newNorm == null || newNorm === oldNorm) return null;

  const event = STATUS_EVENTS[newNorm];
  if (!event) return null;

  return {
    newStatus: newNorm,
    title: `${event.emoji} Licitación ${event.label}: ${opportunityTitle.slice(0, 120)}`,
    dedupeKey: `status:${opportunityId}:${newNorm}`,
  };
}

/** true si la oportunidad está activa y cierra dentro de la ventana. */
export function isClosingSoon(
  statusCode: string | null,
  closingAt: string | null,
  windowHours: number,
  now: Date = new Date(),
): boolean {
  if (normalizeStatusCode(statusCode) !== '5' || !closingAt) return false;
  const hoursLeft = (new Date(closingAt).getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursLeft > 0 && hoursLeft <= windowHours;
}

// ── Job ───────────────────────────────────────────────────────

interface RefreshStats {
  candidates: number;
  refreshed: number;
  statusChanges: number;
  /**
   * Eventos emitidos hacia Licitus (no notificaciones creadas): este servicio
   * ya no resuelve destinatarios ni escribe en la bandeja del usuario — eso lo
   * hace Licitus al recibir el evento. Ver `licitus-callback.ts`.
   */
  eventsEmitted: number;
  skipped: number;
  failed: number;
}

async function processCandidate(
  candidate: RefreshCandidate,
  stats: RefreshStats,
  events: PostIngestEvent[],
): Promise<void> {
  let updated;
  try {
    updated = await ingestLicitacionUseCase.execute(candidate.externalCode);
  } catch (err) {
    // NOT_FOUND: la licitación dejó de estar disponible individualmente — esperado
    if (err instanceof AppError && err.code === 'NOT_FOUND') {
      stats.skipped++;
      return;
    }
    stats.failed++;
    const error = err instanceof Error ? err.message : String(err);
    logger.warn({ codigo: candidate.externalCode, error }, `[${JOB_NAME}] Refresh failed`);
    return;
  }

  stats.refreshed++;

  // ── Evento: cambio de estado ────────────────────────────────
  const statusEvent = buildStatusChangeEvent(
    updated.id,
    updated.title,
    candidate.statusCode,
    updated.statusCode,
  );
  if (statusEvent) {
    stats.statusChanges++;
    logger.info(
      { codigo: candidate.externalCode, from: candidate.statusCode, to: updated.statusCode },
      `[${JOB_NAME}] Status change detected`,
    );
    events.push({
      type: 'opportunity.status_changed',
      opportunityId: updated.id,
      externalCode: updated.externalCode,
      title: updated.title,
      oldStatus: normalizeStatusCode(candidate.statusCode),
      newStatus: statusEvent.newStatus,
    });
    stats.eventsEmitted++;
  }

  // ── Evento: cierre próximo ──────────────────────────────────
  if (isClosingSoon(updated.statusCode, updated.closingAt, env.REFRESH_CLOSING_SOON_HOURS)) {
    const hoursLeft = Math.round(
      (new Date(updated.closingAt!).getTime() - Date.now()) / (1000 * 60 * 60),
    );
    events.push({
      type: 'opportunity.closing_soon',
      opportunityId: updated.id,
      externalCode: updated.externalCode,
      title: updated.title,
      closingAt: updated.closingAt!,
      hoursLeft,
    });
    stats.eventsEmitted++;
  }
}

export async function runRefreshOpportunitiesJob(): Promise<void> {
  // Auto-sanea huérfanos 'running' >2h antes del anti-solapamiento (el bootstrap
  // de Node que los limpiaría no corre en el Worker de Cloudflare).
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
    metadata: { maxItems: env.REFRESH_MAX_ITEMS },
  });

  const stats: RefreshStats = {
    candidates: 0,
    refreshed: 0,
    statusChanges: 0,
    eventsEmitted: 0,
    skipped: 0,
    failed: 0,
  };

  // Se acumulan y se mandan en lote al final: un POST por corrida en vez de uno
  // por candidato, y el envío no interrumpe el recorrido si Licitus está caído.
  const events: PostIngestEvent[] = [];

  try {
    const candidates = await opportunityRepository.findRefreshCandidates(env.REFRESH_MAX_ITEMS);
    stats.candidates = candidates.length;
    logger.info({ candidates: candidates.length }, `[${JOB_NAME}] Starting refresh pass`);

    // Secuencial con delay — mismo criterio de rate limit que el sync
    for (const candidate of candidates) {
      await processCandidate(candidate, stats, events);
      if (env.SYNC_REQUEST_DELAY_MS > 0) {
        await sleep(env.SYNC_REQUEST_DELAY_MS);
      }
    }

    // Awaited antes de cerrar el log: en serverless una promesa suelta muere
    // con la invocación. notifyLicitus nunca lanza.
    await notifyLicitus(events);

    await syncLogRepository.complete(logId, {
      status: stats.failed > 0 && stats.refreshed === 0 ? 'failed' : 'success',
      totalFound: stats.candidates,
      totalProcessed: stats.candidates,
      totalSucceeded: stats.refreshed,
      totalFailed: stats.failed,
      totalSkipped: stats.skipped,
      metadata: {
        statusChanges: stats.statusChanges,
        eventsEmitted: stats.eventsEmitted,
      },
    });

    logger.info({ ...stats }, `[${JOB_NAME}] Refresh pass complete`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error({ error }, `[${JOB_NAME}] Fatal error`);
    await syncLogRepository.complete(logId, {
      status: 'failed',
      totalFound: stats.candidates,
      totalProcessed: stats.refreshed + stats.skipped + stats.failed,
      totalSucceeded: stats.refreshed,
      totalFailed: stats.failed,
      errorDetails: [{ fatal: error }],
    });
  }
}
