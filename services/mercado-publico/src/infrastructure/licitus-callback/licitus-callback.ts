/**
 * Callback de post-proceso hacia Licitus.
 *
 * Este servicio hace SOLO ingesta. El post-proceso de producto —análisis LLM,
 * matching semántico por usuario y notificaciones— se quedó en Licitus junto
 * con sus claves de OpenAI/Gemini/Resend y su modelo de usuarios. Antes ese
 * post-proceso colgaba como llamada de cola dentro de los jobs de sync
 * (`runAutoAnalysis(newIds)`) y en medio del refresh (`notificationService.emit`).
 *
 * Al separarlos, el contrato pasa a ser explícito: la ingesta emite EVENTOS de
 * lo que cambió y Licitus decide qué analizar y a quién notificar. Fíjate que
 * este servicio nunca resuelve destinatarios: `findInterestedUserIds` y toda la
 * lógica de dedupe/notificación siguen del lado de Licitus, que es quien conoce
 * a los usuarios.
 *
 * Igual que `runAutoAnalysis`, **nunca lanza**: un fallo de post-proceso no
 * debe marcar como fallida una corrida de ingesta que sí escribió sus datos.
 */

import { env } from '../../app/env.js';
import { logger } from '../logging/logger.js';

export type PostIngestEvent =
  /** Oportunidades nuevas → Licitus corre auto-analysis/matching sobre ellas. */
  | { type: 'opportunity.ingested'; opportunityIds: string[] }
  /** Cambio de estado relevante detectado por el refresh (cerrada, adjudicada…). */
  | {
      type: 'opportunity.status_changed';
      opportunityId: string;
      externalCode: string;
      title: string;
      oldStatus: string | null;
      newStatus: string;
    }
  /** Licitación vigente que cierra dentro de la ventana configurada. */
  | {
      type: 'opportunity.closing_soon';
      opportunityId: string;
      externalCode: string;
      title: string;
      closingAt: string;
      hoursLeft: number;
    };

/** Tope de IDs por request para no armar payloads gigantes en días de alto volumen. */
const MAX_IDS_PER_BATCH = 500;

function chunkEvents(events: PostIngestEvent[]): PostIngestEvent[][] {
  const batches: PostIngestEvent[][] = [];
  let current: PostIngestEvent[] = [];

  for (const event of events) {
    if (event.type === 'opportunity.ingested' && event.opportunityIds.length > MAX_IDS_PER_BATCH) {
      for (let i = 0; i < event.opportunityIds.length; i += MAX_IDS_PER_BATCH) {
        batches.push([
          { type: 'opportunity.ingested', opportunityIds: event.opportunityIds.slice(i, i + MAX_IDS_PER_BATCH) },
        ]);
      }
      continue;
    }
    current.push(event);
    if (current.length >= MAX_IDS_PER_BATCH) {
      batches.push(current);
      current = [];
    }
  }

  if (current.length > 0) batches.push(current);
  return batches;
}

/**
 * Envía los eventos a Licitus. No-op silencioso si no hay callback configurado
 * (permite correr la ingesta aislada, p. ej. en un backfill o en local).
 */
export async function notifyLicitus(events: PostIngestEvent[]): Promise<void> {
  const meaningful = events.filter(
    (e) => e.type !== 'opportunity.ingested' || e.opportunityIds.length > 0,
  );
  if (meaningful.length === 0) return;

  const url = env.LICITUS_CALLBACK_URL;
  if (!url) {
    logger.debug({ events: meaningful.length }, '[licitus-callback] sin URL configurada — omitido');
    return;
  }

  for (const batch of chunkEvents(meaningful)) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(env.LICITUS_CALLBACK_KEY ? { authorization: `Bearer ${env.LICITUS_CALLBACK_KEY}` } : {}),
        },
        body: JSON.stringify({ events: batch }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        logger.warn(
          { status: res.status, events: batch.length },
          '[licitus-callback] Licitus respondió no-OK',
        );
      } else {
        logger.debug({ events: batch.length }, '[licitus-callback] enviado');
      }
    } catch (err) {
      logger.warn({ err, events: batch.length }, '[licitus-callback] fallo al enviar');
    }
  }
}

/** Atajo para el caso más común: oportunidades recién ingestadas. */
export async function notifyIngested(opportunityIds: string[]): Promise<void> {
  return notifyLicitus([{ type: 'opportunity.ingested', opportunityIds }]);
}
