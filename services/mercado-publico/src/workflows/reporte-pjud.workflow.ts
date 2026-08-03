import { runReportePjudJob } from '../jobs/reporte-pjud.job.js';

/**
 * Publica el tablero de la Corte Suprema en la sala de control.
 *
 * Sólo LEE y publica: no ingiere nada, así que un solo step alcanza y no hay
 * riesgo de dejar datos a medias si se corta.
 */
async function tableroStep(): Promise<void> {
  'use step';
  await runReportePjudJob();
}
tableroStep.maxRetries = 1;

export async function reportePjudWorkflow(): Promise<unknown> {
  'use workflow';
  await tableroStep();
  return { done: true };
}
