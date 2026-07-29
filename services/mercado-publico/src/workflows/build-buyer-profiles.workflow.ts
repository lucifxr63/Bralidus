import { runBuildBuyerProfilesJob } from '../jobs/build-buyer-profiles.job.js';

/**
 * Build de buyer profiles como Workflow de un solo step.
 *
 * 100% SQL local (0 llamadas a MP, 0 costo LLM); el progreso vive en
 * job_progress (fila 'buyer-profiles') para el panel admin.
 */

async function buildStep(): Promise<void> {
  'use step';
  await runBuildBuyerProfilesJob();
}
buildStep.maxRetries = 1;

export async function buildBuyerProfilesWorkflow(): Promise<unknown> {
  'use workflow';
  await buildStep();
  return { done: true };
}
