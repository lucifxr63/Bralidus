import { runReporteFrescuraJob } from '../jobs/reporte-frescura.job.js';

/**
 * Reporte de frescura como Workflow de un solo step.
 *
 * 100% SQL local (0 llamadas a MP, 0 costo): sólo mide antigüedad del dato y
 * publica al canal de frescura. Barato de correr seguido.
 */

async function reporteStep(): Promise<void> {
  'use step';
  await runReporteFrescuraJob();
}
// Sin reintentos: si falla, el propio job avisa a incidentes. Reintentar sólo
// duplicaría el mensaje del día.
reporteStep.maxRetries = 0;

export async function reporteFrescuraWorkflow(): Promise<unknown> {
  'use workflow';
  await reporteStep();
  return { done: true };
}
