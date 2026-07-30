import { runSyncPjudJob } from '../jobs/sync-pjud.job.js';

/**
 * Ingesta de estadísticas del Poder Judicial como Workflow de un solo step.
 *
 * Son ~11 series de pocas filas cada una: entra holgado en el techo de 300 s de
 * una función. Los `_detalle` de la Corte Suprema (hasta 95.075 filas) quedan
 * deliberadamente fuera — necesitan su propia ingesta paginada.
 */

interface SyncPjudParams {
  /** Año a ingerir. Default: el anterior (la fuente publica con un año de rezago). */
  anio?: number;
}

async function pjudStep(anio?: number): Promise<void> {
  'use step';
  await runSyncPjudJob(anio);
}
pjudStep.maxRetries = 1;

export async function syncPjudWorkflow(params: SyncPjudParams = {}): Promise<unknown> {
  'use workflow';
  await pjudStep(params.anio);
  return { done: true };
}
