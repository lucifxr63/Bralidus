import { runEnrichOrdenesJob } from '../jobs/enrich-ordenes.job.js';

/**
 * Enriquecimiento de OCs como Workflow independiente, de un solo step.
 *
 * POR QUÉ EXISTE
 * --------------
 * `enrich-ordenes` sólo corría encadenado al final de `sync-ordenes`, o sea una
 * vez al día. Con el tope por corrida (ENRICH_OC_MAX_ITEMS) eso pone un techo
 * duro al drenaje de la cola: medido el 2026-07-29 había 78.883 OCs sin
 * enriquecer, y a un lote diario la cola no se vacía en años.
 *
 * Exponerlo como job propio permite dispararlo con la frecuencia que aguante el
 * endpoint de detalle de MP (ver ENRICH_DELAY_MS) en vez de una vez al día, y
 * además correrlo a mano para verificarlo sin tener que esperar un sync completo
 * de órdenes.
 *
 * El anti-solapamiento lo sigue dando `hasRunningJob` dentro del job, así que
 * dos disparos encimados no se pisan: el segundo se salta.
 */

async function enrichStep(): Promise<void> {
  'use step';
  await runEnrichOrdenesJob();
}
// 1 reintento: si MP está saturado, el job ya corta solo por 429 y la próxima
// corrida retoma la cola intacta. Insistir acá sólo sumaría 429s.
enrichStep.maxRetries = 1;

export async function enrichOrdenesWorkflow(): Promise<unknown> {
  'use workflow';
  await enrichStep();
  return { done: true };
}
