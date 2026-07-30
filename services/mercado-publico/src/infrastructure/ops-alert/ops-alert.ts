/**
 * Alerting de operaciones — ruteo por canal.
 *
 * SIEMPRE loguea (queda en la observabilidad de Vercel aunque no haya webhook)
 * y además publica en el canal de Discord que corresponda al TIPO de aviso.
 * Nunca lanza: un fallo de alerting jamás debe romper el flujo que lo emitió.
 *
 * POR QUÉ HAY VARIOS CANALES
 * --------------------------
 * Con un solo canal todo se mezcla y el rojo deja de significar algo. Peor: un
 * canal callado es indistinguible de un canal sano — la ingesta estuvo tres días
 * detenida (2026-07-26 al 29) sin un solo mensaje, porque sólo se avisaba en
 * caso de fallo y el fallo ocurría antes de poder reportarse.
 *
 * Los canales se separan por QUÉ HACER al ver el mensaje, no por quién lo emite:
 *
 *   incidentes   → algo está roto AHORA y alguien tiene que mirar. Sólo rojo.
 *   latido       → toda corrida programada, salga bien o mal. Su valor está en
 *                  el hueco: si dejan de llegar mensajes, algo se detuvo.
 *   frescura     → digest de antigüedad del dato. Un job puede correr "bien" y
 *                  el dato envejecer igual (pasó con /data/macro: 82 días viejo
 *                  con todo en verde).
 *   degradación  → lo que "funciona" mientras miente: RAG sin corpus, fallbacks
 *                  sirviendo en lugar del dato real, mocks, cortes por cuota.
 *                  No exige acción inmediata; acumulado dice dónde está podrido.
 *
 * Si el canal de un tipo no está configurado, cae a `incidentes` para no perder
 * el aviso — es preferible un canal mezclado a un aviso mudo.
 */

import { env } from '../../app/env.js';
import { logger } from '../logging/logger.js';

export type OpsAlertLevel = 'info' | 'warn' | 'error';

/** Canal de destino. Deriva del tipo de aviso, no del servicio que lo emite. */
export type OpsChannel = 'incidentes' | 'latido' | 'frescura' | 'degradacion';

export interface OpsAlert {
  level: OpsAlertLevel;
  title: string;
  detail?: string;
  /** Default: 'incidentes' para error, 'latido' para el resto. */
  channel?: OpsChannel;
  /** Clave de dedupe del webhook (default: `title`). Ver `DEDUPE_WINDOW_MS`. */
  dedupeKey?: string;
}

/** Ventana de dedupe: como máximo 1 aviso por clave en este lapso. */
const DEDUPE_WINDOW_MS = 30 * 60 * 1000;

/**
 * Última vez que se mandó el webhook por clave. Vive en memoria del isolate: se
 * resetea cuando la plataforma recicla la instancia, igual trade-off que el
 * circuit breaker de MP. Suficiente para cortar el caso real (mismo aviso
 * repetido dentro de una corrida), no pretende ser un dedupe distribuido.
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

function canalPorDefecto(level: OpsAlertLevel): OpsChannel {
  return level === 'error' ? 'incidentes' : 'latido';
}

/** URL del canal, con caída a incidentes si ese canal no está configurado. */
function urlDeCanal(channel: OpsChannel): string | undefined {
  const porCanal: Record<OpsChannel, string | undefined> = {
    incidentes: env.OPS_WEBHOOK_URL,
    latido: env.OPS_WEBHOOK_LATIDO,
    frescura: env.OPS_WEBHOOK_FRESCURA,
    degradacion: env.OPS_WEBHOOK_DEGRADACION,
  };
  return porCanal[channel] ?? env.OPS_WEBHOOK_URL;
}

const EMOJI: Record<OpsAlertLevel, string> = { error: '🔴', warn: '🟡', info: '🟢' };

export async function sendOpsAlert(alert: OpsAlert): Promise<void> {
  const channel = alert.channel ?? canalPorDefecto(alert.level);

  // 1) Siempre loguea, haya webhook o no.
  const payload = { opsAlert: true, level: alert.level, channel, detail: alert.detail };
  if (alert.level === 'error') logger.error(payload, `[ops-alert] ${alert.title}`);
  else if (alert.level === 'warn') logger.warn(payload, `[ops-alert] ${alert.title}`);
  else logger.info(payload, `[ops-alert] ${alert.title}`);

  // 2) Webhook del canal, con dedupe.
  const url = urlDeCanal(channel);
  if (!url) return;
  if (!shouldSendWebhook(`${channel}:${alert.dedupeKey ?? alert.title}`, Date.now())) {
    logger.debug({ channel, dedupeKey: alert.dedupeKey ?? alert.title }, '[ops-alert] deduplicado');
    return;
  }

  const content = `${EMOJI[alert.level]} **${alert.title}**${alert.detail ? `\n${alert.detail}` : ''}`;
  try {
    // `content` = Discord, `text` = Slack — mandar ambos cubre los dos sin config.
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content, text: content }),
    });
    if (!res.ok) logger.warn({ status: res.status, channel }, '[ops-alert] webhook respondió no-OK');
  } catch (err) {
    logger.warn({ err, channel }, '[ops-alert] fallo al enviar webhook');
  }
}
