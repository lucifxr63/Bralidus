import { runSyncPjudSupremaJob } from '../jobs/sync-pjud-suprema.job.js';

/**
 * Ingesta de las causas de la Corte Suprema.
 *
 * UN SOLO STEP, A PROPÓSITO
 * -------------------------
 * Tentaba hacer un step por serie —cada una con su propio techo de 300 s—, pero
 * medido el 2026-07-31 no hace falta: las tres series juntas son ~164.500 filas
 * y la descarga completa toma menos de 9 s (0,4 + 3,0 + 5,3). Lo que queda es la
 * escritura por lotes de 500, que son ~330 INSERTs.
 *
 * Partirlo en tres steps obligaría a que el estado (qué serie va, con qué año)
 * cruce el límite del step serializado, a cambio de nada: si esto llegara a
 * rozar los 300 s, la respuesta correcta es trocear POR SERIE, y ahí sí conviene
 * un step por serie. Está escrito para que ese cambio sea mecánico:
 * `ingerirSerieSuprema(serie, anio)` ya es la unidad independiente.
 *
 * ANUAL, NO DIARIO
 * ----------------
 * La fuente publica por año cerrado. Correrlo seguido serían 60 MB de descarga
 * para reescribir exactamente las mismas filas.
 */

async function ingestaStep(): Promise<void> {
  'use step';
  await runSyncPjudSupremaJob();
}
// Sin reintentos automáticos: si la fuente no respondió, insistir en el momento
// no ayuda — el upsert es idempotente y la próxima corrida reingiere el año
// entero sin duplicar.
ingestaStep.maxRetries = 1;

export async function syncPjudSupremaWorkflow(): Promise<unknown> {
  'use workflow';
  await ingestaStep();
  return { done: true };
}
