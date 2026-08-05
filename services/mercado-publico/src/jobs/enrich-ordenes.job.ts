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
import {
  deriveRunStatus,
  runFailureRate,
  FAILURE_RATE_THRESHOLD,
} from '../modules/sync/domain/run-status.js';
import { AppError } from '../shared/errors/app-error.js';
import { sendOpsAlert } from '../infrastructure/ops-alert/ops-alert.js';

const JOB_NAME = 'enrich-ordenes';

/**
 * Intervalo entre consultas al detalle de OC.
 *
 * SYNC_REQUEST_DELAY_MS (200 ms) sirve para los LISTADOS, que toleran ese ritmo.
 * El endpoint de detalle no: rechaza con 429 "Hemos detectado que existen
 * peticiones simultáneas". Medido contra la API el 2026-07-29, secuencialmente:
 *
 *    200 ms  ->  25% de éxito   (9 de 12 con 429)
 *   1000 ms  ->  50%
 *   2500 ms  -> 100%            (0 con 429)
 *
 * El 25% explica exactamente lo que se veía en producción: ok=29 de 150 en cada
 * corrida. No era que las OCs no existieran — era el ritmo.
 *
 * Con 2.5 s y el techo de 300 s de una función Vercel entran ~100 por corrida,
 * de ahí que ENRICH_OC_MAX_ITEMS deba acompañar este valor.
 */
const ENRICH_DELAY_MS = 2500;

/**
 * Techo de tiempo de una pasada, como red de seguridad bajo los 300 s de la
 * función.
 *
 * POR QUÉ HACE FALTA SI YA HAY UN TOPE DE ÍTEMS
 * ---------------------------------------------
 * Porque el tope de ítems se calibró contando sólo el sleep: «100 ítems × 2,5 s
 * ≈ 250 s». Falta la latencia del request y el `incrementEnrichmentAttempts` de
 * cada fila. Medido sobre 492 corridas terminadas (2026-08-05):
 *
 *     p50   255 s      (90 ítems → 2,83 s por ítem, no 2,5)
 *     p90   400 s
 *
 * O sea que en un día normal la pasada usa el **85%** del presupuesto, y en uno
 * lento se pasa: el proceso muere sin llegar a `complete()`, la fila queda
 * 'running' huérfana y la corrida siguiente la marca 'failed' con
 * `error_details` vacío. Cinco veces en los últimos 7 días.
 *
 * Peor que perder la pasada: el step muere, y con `maxRetries = 1` eso corta la
 * cadena de 10 pasadas del workflow. Una pasada que se pasa por 20 segundos
 * cuesta las nueve que venían detrás.
 *
 * Un contador fijo no aguanta la varianza de latencia de MP; un reloj sí. El
 * tope de ítems define el trabajo, el presupuesto de tiempo garantiza el cierre.
 */
const ENRICH_TIME_BUDGET_MS = 250_000;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * True si el error viene de que MP nos está frenando (429), no de la fila.
 * El cliente preserva el status en `details.httpStatus`.
 */
function esThrottling(err: unknown): boolean {
  if (!(err instanceof AppError)) return false;
  const d = err.details as { httpStatus?: number } | undefined;
  return d?.httpStatus === 429;
}

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
  /** Cortes por 429 de MP. No son fallos de la fila — no consumen intento. */
  throttled: number;
}

/**
 * Devuelve las stats de la pasada para que el workflow decida si seguir.
 *
 * Antes devolvía `void`, así que quien lo llamaba no podía distinguir "la cola
 * se vació" de "MP nos frenó" de "hice 100 y quedan miles". Con el workflow de
 * un solo step daba igual; encadenando slices es la diferencia entre drenar la
 * cola y martillar una API que ya dijo que no.
 */
export async function runEnrichOrdenesJob(): Promise<EnrichStats & { skipped: boolean }> {
  const vacio: EnrichStats & { skipped: boolean } = {
    candidates: 0,
    enriched: 0,
    stillIncomplete: 0,
    notFound: 0,
    failed: 0,
    throttled: 0,
    skipped: true,
  };

  if (!env.ENRICH_OC_ENABLED) {
    logger.info(`[${JOB_NAME}] ENRICH_OC_ENABLED=false — skipping`);
    return vacio;
  }

  const cleared = await syncLogRepository.clearStaleRunning(JOB_NAME, 120);
  if (cleared > 0) logger.warn({ cleared }, `[${JOB_NAME}] Cleared stale running logs`);
  const isRunning = await syncLogRepository.hasRunningJob(JOB_NAME);
  if (isRunning) {
    logger.warn(`[${JOB_NAME}] Job already running — skipping tick`);
    return vacio;
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
    throttled: 0,
  };

  try {
    const candidates = await purchaseOrderRepository.findPendingEnrichment(env.ENRICH_OC_MAX_ITEMS);
    stats.candidates = candidates.length;
    logger.info({ candidates: candidates.length }, `[${JOB_NAME}] Starting enrichment pass`);

    // El reloj arranca DESPUÉS de la consulta de candidatos: lo que se acota es
    // el recorrido, que es lo que se puede cortar a mitad sin dejar nada roto.
    const deadline = Date.now() + ENRICH_TIME_BUDGET_MS;
    let sinTiempo = false;
    let procesadas = 0;

    for (const candidate of candidates) {
      if (Date.now() >= deadline) {
        sinTiempo = true;
        logger.warn(
          { enriquecidas: stats.enriched, pendientes: stats.candidates - procesadas },
          `[${JOB_NAME}] Presupuesto de tiempo agotado — cerrando limpio para no morir a mitad`,
        );
        break;
      }
      procesadas++;

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

          // Throttling NO es un fallo de la fila: MP rechaza por "peticiones
          // simultáneas" y esa OC sigue siendo perfectamente enriquecible. Si se
          // le consumiera un intento, 5 corridas con el ritmo mal calibrado la
          // excluirían para siempre de una cola de la que nunca tuvo la culpa.
          //
          // Se corta la corrida entera: MP ya está saturado y seguir pidiendo
          // sólo suma 429s. La próxima corrida retoma con la cola intacta.
          if (esThrottling(err)) {
            stats.throttled++;
            logger.warn(
              { codigo: candidate.externalCode, procesadas: stats.enriched },
              `[${JOB_NAME}] MP saturado (429) — cortando la corrida sin gastar intentos`,
            );
            // Degradación: la corrida no falló, se contuvo. Si esto aparece
            // seguido, el ritmo (ENRICH_DELAY_MS) hay que revisarlo.
            void sendOpsAlert({
              level: 'warn',
              channel: 'degradacion',
              title: 'Enriquecimiento de OCs cortado por saturación de MP',
              detail: `Se enriquecieron ${stats.enriched} antes del 429. La cola queda intacta — ninguna fila gastó intento.`,
              dedupeKey: 'enrich-throttled',
            });
            break;
          }

          logger.warn({ codigo: candidate.externalCode, error }, `[${JOB_NAME}] Enrichment failed`);
          // Un fallo real SÍ consume intento: sin esto la fila vuelve idéntica
          // en la próxima corrida (el orden del query es determinista) y ocupa
          // el presupuesto para siempre. Era la razón de que las 78.829 filas
          // pendientes tuvieran enrichment_attempts = 0 y de que cada corrida
          // acertara siempre las mismas ~30 de 150.
          await purchaseOrderRepository.incrementEnrichmentAttempts(candidate.externalCode);
          await sleep(ENRICH_DELAY_MS);
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

      // Ritmo propio del endpoint de detalle, no el de los listados.
      await sleep(ENRICH_DELAY_MS);
    }

    // Estado por TASA de fallo (regla compartida en run-status.ts), no por
    // "hubo al menos un éxito": con la condición anterior un único acierto
    // enmascaraba cualquier cantidad de fallos y la alerta nunca se disparaba.
    // `aborted` si se cortó por reloj: la pasada no falló, se contuvo antes de
    // que la mataran. `found` distingue "la cola estaba vacía" de "no
    // procesamos ninguno" (ver run-status.ts).
    const counters = {
      succeeded: stats.enriched,
      failed: stats.failed,
      aborted: sinTiempo,
      found: stats.candidates,
    };
    const status = deriveRunStatus(counters);
    const failureRate = runFailureRate(counters);
    const degraded = status !== 'success';

    // Sólo se etiqueta HIGH_FAILURE_RATE cuando la tasa de fallo es realmente la
    // causa. Una pasada cortada por reloj también sale degradada, y ponerle esa
    // etiqueta mandaría a buscar un problema de calidad donde hay uno de
    // presupuesto.
    const porTasaDeFallo = degraded && !sinTiempo;

    await syncLogRepository.complete(logId, {
      status,
      totalFound: stats.candidates,
      // Lo REALMENTE recorrido, no el tamaño del lote: si se cortó a mitad,
      // decir que se procesaron los 90 esconde justo lo que hay que ver.
      totalProcessed: procesadas,
      totalSucceeded: stats.enriched,
      totalFailed: stats.failed,
      ...(porTasaDeFallo
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
      ...(sinTiempo
        ? {
            errorCodes: ['TIME_BUDGET_EXCEEDED'],
            errorDetails: [
              {
                presupuestoMs: ENRICH_TIME_BUDGET_MS,
                procesadas,
                deLote: stats.candidates,
              },
            ],
          }
        : {}),
      metadata: {
        stillIncomplete: stats.stillIncomplete,
        notFound: stats.notFound,
        failureRate: Number(failureRate.toFixed(3)),
        // Si esto sube, MP está frenando y el ritmo hay que revisarlo — no es
        // que las OCs no se puedan enriquecer.
        throttled: stats.throttled,
        cortadaPorTiempo: sinTiempo,
      },
    });

    logger.info({ ...stats }, `[${JOB_NAME}] Enrichment pass complete`);
    return { ...stats, skipped: false };
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
    // `skipped: true` para que el workflow corte la cadena: si esta pasada
    // reventó, encadenar más slices sólo repite el fallo.
    return { ...stats, skipped: true };
  }
}
