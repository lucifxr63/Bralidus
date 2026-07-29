/**
 * Alerting de operaciones (Fase 1 del HARDENING_ROADMAP).
 *
 * "La app avisa cuando algo se rompe." Envía a un webhook (Discord/Slack) y
 * SIEMPRE loguea a nivel error/warn (queda en Cloudflare Observability aunque
 * no haya webhook). Gated como el canal email: sin OPS_WEBHOOK_URL, no-op de red.
 * Nunca lanza — un fallo de alerting jamás debe romper el flujo que lo emitió.
 */

import { env } from '../../app/env.js';
import { logger } from '../logging/logger.js';

export type OpsAlertLevel = 'info' | 'warn' | 'error';

export interface OpsAlert {
  level: OpsAlertLevel;
  title: string;
  detail?: string;
  /** Clave de dedupe para el webhook (default: `title`). Ver `DEDUPE_WINDOW_MS`. */
  dedupeKey?: string;
}

/** Ventana de dedupe del webhook: como máximo 1 aviso por clave en este lapso. */
const DEDUPE_WINDOW_MS = 30 * 60 * 1000;

/**
 * Última vez que se mandó el webhook por clave. Vive en memoria del isolate:
 * se resetea si Cloudflare recicla el Worker, igual que el circuit breaker de
 * MP (mismo trade-off ya aceptado en el codebase). Suficiente para cortar el
 * caso real (mismo job fallando en corridas consecutivas dentro de la misma
 * ejecución/isolate), no pretende ser un dedupe distribuido.
 */
const lastSentAt = new Map<string, number>();

function shouldSendWebhook(key: string, now: number): boolean {
  const last = lastSentAt.get(key);
  if (last != null && now - last < DEDUPE_WINDOW_MS) return false;
  lastSentAt.set(key, now);
  if (lastSentAt.size > 200) {
    for (const [k, t] of lastSentAt) {
      if (now - t >= DEDUPE_WINDOW_MS) lastSentAt.delete(k);
    }
  }
  return true;
}

export async function sendOpsAlert(alert: OpsAlert): Promise<void> {
  // 1) Siempre loguea (observabilidad aunque no haya webhook configurado)
  const payload = { opsAlert: true, level: alert.level, detail: alert.detail };
  if (alert.level === 'error') logger.error(payload, `[ops-alert] ${alert.title}`);
  else if (alert.level === 'warn') logger.warn(payload, `[ops-alert] ${alert.title}`);
  else logger.info(payload, `[ops-alert] ${alert.title}`);

  // 2) Webhook opcional, con dedupe (evita martillar Discord/Slack con el mismo aviso)
  const url = env.OPS_WEBHOOK_URL;
  if (!url) return;
  if (!shouldSendWebhook(alert.dedupeKey ?? alert.title, Date.now())) {
    logger.debug({ dedupeKey: alert.dedupeKey ?? alert.title }, '[ops-alert] webhook deduplicado');
    return;
  }

  const emoji = alert.level === 'error' ? '🔴' : alert.level === 'warn' ? '🟡' : '🟢';
  const content = `${emoji} **${alert.title}**${alert.detail ? `\n${alert.detail}` : ''}`;
  try {
    // `content` = Discord, `text` = Slack — mandar ambos cubre los dos sin config.
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content, text: content }),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, '[ops-alert] webhook respondió no-OK');
    }
  } catch (err) {
    logger.warn({ err }, '[ops-alert] fallo al enviar webhook');
  }
}
