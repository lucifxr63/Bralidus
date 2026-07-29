import { runRefreshOpportunitiesJob } from '../jobs/refresh-opportunities.job.js';

/**
 * Refresh dirigido de oportunidades como Workflow de un solo step.
 *
 * El job ya es idempotente y acotado (REFRESH_MAX_ITEMS, anti-solapamiento vía
 * sync_logs); el Workflow aporta reintentos durables y presupuesto de ejecución
 * propio, fuera del ciclo request/response.
 */

async function refreshStep(): Promise<void> {
  'use step';
  await runRefreshOpportunitiesJob();
}
refreshStep.maxRetries = 1;

export async function refreshOpportunitiesWorkflow(): Promise<unknown> {
  'use workflow';
  await refreshStep();
  return { done: true };
}
