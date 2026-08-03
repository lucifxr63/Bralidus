import { runSyncJurisprudenciaGrafoJob } from '../jobs/sync-jurisprudencia-grafo.job.js';

/**
 * Sintetiza las causas de la Corte Suprema en nodos del grafo de conocimiento.
 *
 * Un solo step: son ~20 consultas agregadas y ~20 upserts, nada que se acerque
 * al techo de la funcion. Todo el trabajo pesado lo hace la base.
 */
async function sintesisStep(): Promise<void> {
  'use step';
  await runSyncJurisprudenciaGrafoJob();
}
sintesisStep.maxRetries = 1;

export async function syncJurisprudenciaGrafoWorkflow(): Promise<unknown> {
  'use workflow';
  await sintesisStep();
  return { done: true };
}
