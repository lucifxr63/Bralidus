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
import {
  deriveRunStatus,
  runFailureRate,
  FAILURE_RATE_THRESHOLD,
} from '../modules/sync/domain/run-status.js';
import { AppError } from '../shared/errors/app-error.js';
import { sendOpsAlert } from '../infrastructure/ops-alert/ops-alert.js';

const JOB_NAME = 'refresh-opportunities';

/**
 * Intervalo entre consultas al DETALLE de una licitación.
 *
 * Mismo problema y mismo valor que `ENRICH_DELAY_MS` en enrich-ordenes: los
 * LISTADOS de MP toleran `SYNC_REQUEST_DELAY_MS` (200 ms), el detalle **no** —
 * rechaza con 429 `Codigo: 10500` "Hemos detectado que existen peticiones
 * simultáneas". Ese diagnóstico se hizo el 2026-07-29 para las órdenes de compra
 * y este job, que golpea el mismo tipo de endpoint, se quedó con los 200 ms.
 *
 * Remedido contra producción el 2026-08-05, secuencial, sobre `3960-50-L126`:
 *
 *    200 ms  ->  50% de éxito   (3 de 6 con 429)
 *    600 ms  ->  87%
 *   1000 ms  ->  75%
 *   1500 ms  -> 100%            (8 de 8)
 *
 * Se conserva 2500 ms —el valor ya establecido para el mismo endpoint— en vez de
 * bajar a 1500: la medición de arriba son 8 requests sobre un código, y la de
 * julio fue más ancha. Ante dos muestras que coinciden en la dirección, se elige
 * la más conservadora; el costo de ir lento es tiempo, el de ir rápido es una
 * corrida entera perdida.
 */
const REFRESH_DELAY_MS = 2500;

/**
 * Techo de tiempo de una corrida. A 2,5 s por candidato, 150 candidatos son
 * ~6 min y una función de Vercel corta a los 300 s: el proceso muere sin llegar
 * a `complete()`, la fila queda 'running' huérfana, y la corrida SIGUIENTE la
 * marca 'failed' con `error_details` vacío. Eso es exactamente lo que se ve en
 * las 31 filas con `stale_cleared: true` — el job no falló, nunca terminó.
 *
 * Se acota por RELOJ y no bajando `REFRESH_MAX_ITEMS` porque el tope real no es
 * la cantidad sino la latencia de MP, que varía. Un contador fijo calibrado hoy
 * vuelve a pasarse el día que la API esté lenta; un presupuesto de tiempo no.
 *
 * 240 s deja 60 s de holgura para `notifyLicitus` y el cierre del log.
 */
const REFRESH_TIME_BUDGET_MS = 240_000;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * True si el error viene de que MP nos está frenando (429), no del candidato.
 * El cliente preserva el status en `details.httpStatus`.
 */
function esThrottling(err: unknown): boolean {
  if (!(err instanceof AppError)) return false;
  const d = err.details as { httpStatus?: number } | undefined;
  return d?.httpStatus === 429;
}

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
  /** Candidatos no intentados porque MP nos frenó y se cortó la corrida. */
  throttled: number;
}

/** `true` si la corrida debe cortarse: MP está saturado. */
async function processCandidate(
  candidate: RefreshCandidate,
  stats: RefreshStats,
  events: PostIngestEvent[],
): Promise<boolean> {
  let updated;
  try {
    updated = await ingestLicitacionUseCase.execute(candidate.externalCode);
  } catch (err) {
    // NOT_FOUND: la licitación dejó de estar disponible individualmente — esperado
    if (err instanceof AppError && err.code === 'NOT_FOUND') {
      stats.skipped++;
      return false;
    }
    // 429 tras agotar el backoff del cliente: MP está saturado y seguir sólo
    // quema tiempo. Cortar acá es lo que evita que una corrida se arrastre 8
    // horas contra una API que la está rechazando — que es exactamente lo que
    // pasó todos los días entre el 2026-07-30 y el 2026-08-05.
    if (esThrottling(err)) {
      stats.throttled++;
      logger.warn(
        { codigo: candidate.externalCode, refrescadas: stats.refreshed },
        `[${JOB_NAME}] MP saturado (429) — cortando la corrida`,
      );
      return true;
    }
    stats.failed++;
    const error = err instanceof Error ? err.message : String(err);
    logger.warn({ codigo: candidate.externalCode, error }, `[${JOB_NAME}] Refresh failed`);
    return false;
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

  return false;
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
    throttled: 0,
  };

  // Se acumulan y se mandan en lote al final: un POST por corrida en vez de uno
  // por candidato, y el envío no interrumpe el recorrido si Licitus está caído.
  const events: PostIngestEvent[] = [];

  try {
    const candidates = await opportunityRepository.findRefreshCandidates(env.REFRESH_MAX_ITEMS);
    stats.candidates = candidates.length;
    logger.info({ candidates: candidates.length }, `[${JOB_NAME}] Starting refresh pass`);

    // Secuencial con REFRESH_DELAY_MS — el detalle de MP no tolera el ritmo de
    // los listados (ver la nota de la constante).
    let saturado = false;
    let sinTiempo = false;
    const deadline = Date.now() + REFRESH_TIME_BUDGET_MS;

    for (const candidate of candidates) {
      if (Date.now() >= deadline) {
        sinTiempo = true;
        logger.warn(
          { refrescadas: stats.refreshed, pendientes: stats.candidates - stats.refreshed },
          `[${JOB_NAME}] Presupuesto de tiempo agotado — cerrando limpio`,
        );
        break;
      }
      if (await processCandidate(candidate, stats, events)) {
        saturado = true;
        break;
      }
      await sleep(REFRESH_DELAY_MS);
    }

    if (saturado) {
      // Degradación, no incidente: la corrida se contuvo y los eventos que
      // alcanzó a juntar igual se emiten. Si esto suena seguido, el ritmo hay
      // que revisarlo.
      void sendOpsAlert({
        level: 'warn',
        channel: 'degradacion',
        title: 'Refresh de oportunidades cortado por saturación de MP',
        detail:
          `Se refrescaron ${stats.refreshed} de ${stats.candidates} antes del 429. ` +
          `Los candidatos restantes quedan para la próxima corrida (cada 6 h).`,
        dedupeKey: 'refresh-throttled',
      });
    }

    // Awaited antes de cerrar el log: en serverless una promesa suelta muere
    // con la invocación. notifyLicitus nunca lanza.
    await notifyLicitus(events);

    // El estado se decide por TASA de fallo (regla compartida en
    // modules/sync/domain/run-status.ts), no por "hubo al menos un éxito".
    //
    // Antes era `failed > 0 && refreshed === 0`, o sea que un solo acierto
    // bastaba para reportar 'success'. El 2026-07-29 este job cerró en
    // 'success' con refreshed=1 y failed=149 — y como la alerta de ops sólo
    // mira `status === 'failed'`, nadie se enteró de que el 99% se caía.
    // `aborted` cuando MP nos frenó: la corrida no falló, se contuvo a mitad, y
    // eso es literalmente lo que 'partial' significa. `found` distingue "no
    // había candidatos" de "no procesamos ninguno" (ver run-status.ts).
    const counters = {
      succeeded: stats.refreshed,
      failed: stats.failed,
      aborted: saturado || sinTiempo,
      found: stats.candidates,
    };
    const status = deriveRunStatus(counters);
    const failureRate = runFailureRate(counters);
    const degraded = status !== 'success';

    await syncLogRepository.complete(logId, {
      status,
      totalFound: stats.candidates,
      totalProcessed: stats.candidates,
      totalSucceeded: stats.refreshed,
      totalFailed: stats.failed,
      totalSkipped: stats.skipped,
      ...(degraded
        ? {
            errorCodes: ['HIGH_FAILURE_RATE'],
            errorDetails: [
              {
                failureRate: Number(failureRate.toFixed(3)),
                threshold: FAILURE_RATE_THRESHOLD,
                refreshed: stats.refreshed,
                failed: stats.failed,
              },
            ],
          }
        : {}),
      metadata: {
        statusChanges: stats.statusChanges,
        eventsEmitted: stats.eventsEmitted,
        failureRate: Number(failureRate.toFixed(3)),
        throttled: stats.throttled,
        cortadaPorSaturacion: saturado,
        cortadaPorTiempo: sinTiempo,
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
