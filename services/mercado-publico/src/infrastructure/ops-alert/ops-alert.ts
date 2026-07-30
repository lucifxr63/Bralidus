/**
 * Alerting de operaciones — ruteo por canal y presentación en embeds.
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
 *   frescura     → digest de antigüedad del dato.
 *   degradación  → lo que "funciona" mientras miente.
 *   pjud         → excepción: canal POR FUENTE. Sus FALLOS igual van a
 *                  incidentes, para no fragmentar el único lugar donde mirar.
 *
 * Si el canal de un tipo no está configurado, cae a `incidentes`: es preferible
 * un canal mezclado a un aviso mudo.
 *
 * PRESENTACIÓN
 * ------------
 * Se publica como EMBED de Discord: color por severidad, métricas en campos
 * separados y footer con servicio y hora. Un muro de texto plano obliga a leer
 * la línea entera para saber si algo anda mal; con color y campos eso se ve de
 * un vistazo, que es la diferencia entre un canal que se mira y uno que se
 * ignora.
 *
 * Se manda además `content`/`text` como respaldo: cubre Slack y cualquier
 * cliente que no renderice embeds.
 */

import { env } from '../../app/env.js';
import { logger } from '../logging/logger.js';

export type OpsAlertLevel = 'info' | 'warn' | 'error';

/**
 * Canal de destino. Los cuatro primeros derivan del TIPO de aviso.
 *
 * `pjud` es la excepción: es un canal POR FUENTE, para seguir la ingesta del
 * Poder Judicial por separado. Se acepta la inconsistencia a propósito, pero
 * los fallos reales de esa ingesta siguen yendo a `incidentes` — si cada fuente
 * se llevara sus propios errores, no quedaría un solo lugar donde mirar cuando
 * algo se rompe, que es justamente lo que hace útil a ese canal.
 */
export type OpsChannel =
  | 'incidentes'
  | 'latido'
  | 'frescura'
  | 'degradacion'
  | 'deploys'
  | 'negocio'
  | 'pjud'
  | 'bcn';

/** Campo del embed. `inline` los acomoda en columnas (Discord pone hasta 3). */
export interface OpsField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface OpsAlert {
  level: OpsAlertLevel;
  title: string;
  /** Texto libre bajo el título. Admite markdown de Discord. */
  detail?: string;
  /** Métricas estructuradas. Se renderizan como campos del embed. */
  fields?: OpsField[];
  /** Línea al pie: contexto de origen (job, duración, fuente). */
  footer?: string;
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
    deploys: env.OPS_WEBHOOK_DEPLOYS ?? env.OPS_WEBHOOK_LATIDO,
    negocio: env.OPS_WEBHOOK_NEGOCIO ?? env.OPS_WEBHOOK_FRESCURA,
    pjud: env.OPS_WEBHOOK_PJUD ?? env.OPS_WEBHOOK_LATIDO,
    bcn: env.OPS_WEBHOOK_BCN ?? env.OPS_WEBHOOK_FRESCURA,
  };
  return porCanal[channel] ?? env.OPS_WEBHOOK_URL;
}

const EMOJI: Record<OpsAlertLevel, string> = { error: '🔴', warn: '🟡', info: '🟢' };

/** Color de la barra lateral del embed. Es la señal que se lee sin leer. */
const COLOR: Record<OpsAlertLevel, number> = {
  error: 0xe0_4f_5f, // rojo
  warn: 0xe0_a4_4f, // ámbar
  info: 0x4f_e0_8a, // verde
};

/** Nombre legible del canal para el footer. */
const NOMBRE_CANAL: Record<OpsChannel, string> = {
  incidentes: 'Incidentes',
  latido: 'Latido',
  frescura: 'Frescura de datos',
  degradacion: 'Degradación',
  deploys: 'Deploys & Releases',
  negocio: 'Impacto Negocio & KPIs',
  pjud: 'Poder Judicial (PJUD)',
  bcn: 'Biblioteca del Congreso Nacional (BCN / Ley Chile)',
};

/**
 * Respaldo en texto plano del embed.
 * Discord ignora `content` si hay embeds; Slack ignora `embeds` y usa `text`.
 */
function textoPlano(alert: OpsAlert): string {
  const partes = [`${EMOJI[alert.level]} **${alert.title}**`];
  if (alert.detail) partes.push(alert.detail);
  if (alert.fields?.length) {
    partes.push(alert.fields.map((f) => `${f.name}: ${f.value}`).join(' · '));
  }
  return partes.join('\n');
}

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

  const plano = textoPlano(alert);
  const embed = {
    title: `${EMOJI[alert.level]}  ${alert.title}`.slice(0, 256),
    ...(alert.detail ? { description: alert.detail.slice(0, 4096) } : {}),
    color: COLOR[alert.level],
    // Discord admite hasta 25 campos por embed.
    ...(alert.fields?.length
      ? {
          fields: alert.fields.slice(0, 25).map((f) => ({
            name: f.name.slice(0, 256),
            value: (f.value || '—').slice(0, 1024),
            inline: f.inline ?? true,
          })),
        }
      : {}),
    footer: { text: `mp-sync · ${NOMBRE_CANAL[channel]}${alert.footer ? ` · ${alert.footer}` : ''}`.slice(0, 2048) },
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // `embeds` = Discord. `text` = Slack, que ignora embeds. Mandar ambos
      // cubre los dos sin configuración por destino.
      body: JSON.stringify({ embeds: [embed], text: plano }),
    });
    if (!res.ok) {
      // Un embed mal formado da 400 y el aviso se perdería del todo. Se
      // reintenta en texto plano: mejor feo que mudo.
      logger.warn({ status: res.status, channel }, '[ops-alert] embed rechazado, reintentando en texto');
      await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: plano, text: plano }),
      }).catch(() => {});
    }
  } catch (err) {
    logger.warn({ err, channel }, '[ops-alert] fallo al enviar webhook');
  }
}
