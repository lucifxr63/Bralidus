/**
 * Salud de los jobs de sync/cron (Fase 1 del HARDENING_ROADMAP — observabilidad).
 *
 * Deriva un semáforo por job desde los agregados de sync_logs, para que el panel
 * admin y un monitor externo detecten cuándo un job dejó de correr o empezó a
 * fallar — el agujero que dejó syncs caídos días sin que nadie se enterara.
 * Lógica pura: sin DB, testeable.
 */

export type JobHealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

/** Agregados crudos de sync_logs para un job (los calcula el repositorio). */
export interface JobHealthRaw {
  jobName: string;
  lastRun: string | null; // ISO
  lastSuccess: string | null; // ISO (success o partial)
  activeRunning: number;
  staleRunning: number; // running iniciadas hace > umbral (probables huérfanas)
  failed48h: number;
  ok48h: number;
}

export interface JobHealth extends JobHealthRaw {
  status: JobHealthStatus;
  lastSuccessAgeHours: number | null;
  expectedIntervalHours: number | null;
  reason: string;
}

/**
 * Cada cuántas horas se espera que corra con éxito cada job (para juzgar
 * antigüedad). Debe reflejar los cron de wrangler.jsonc / worker.ts.
 */
export const JOB_EXPECTED_INTERVAL_HOURS: Record<string, number> = {
  'sync-licitaciones': 24,
  'sync-ordenes': 24,
  'enrich-ordenes': 24, // encadenado al sync de OC
  'refresh-opportunities': 6,
  'build-buyer-profiles': 168, // semanal
};

/**
 * Deriva el estado de salud de un job. Pura.
 * - unknown: sin corridas registradas.
 * - degraded: hay huérfanas atascadas, o hubo fallas recientes con algún éxito.
 * - down: nunca completó, o el último éxito es más viejo que 2× el intervalo.
 * - healthy: éxito reciente y sin huérfanas.
 */
export function deriveJobHealth(
  raw: JobHealthRaw,
  expectedIntervalHours: number | null,
  now: Date = new Date(),
): JobHealth {
  const lastSuccessAgeHours =
    raw.lastSuccess != null
      ? (now.getTime() - new Date(raw.lastSuccess).getTime()) / (1000 * 60 * 60)
      : null;

  const base = { ...raw, lastSuccessAgeHours, expectedIntervalHours };

  if (raw.lastRun == null) {
    return { ...base, status: 'unknown', reason: 'Sin corridas registradas' };
  }
  if (raw.staleRunning > 0) {
    return {
      ...base,
      status: 'degraded',
      reason: `${raw.staleRunning} corrida(s) atascada(s) en 'running' (posibles huérfanas)`,
    };
  }
  if (raw.lastSuccess == null) {
    return { ...base, status: 'down', reason: 'Nunca completó con éxito' };
  }
  if (
    expectedIntervalHours != null &&
    lastSuccessAgeHours != null &&
    lastSuccessAgeHours > expectedIntervalHours * 2
  ) {
    return {
      ...base,
      status: 'down',
      reason: `Sin éxito hace ${Math.round(lastSuccessAgeHours)} h (esperado cada ${expectedIntervalHours} h)`,
    };
  }
  if (raw.failed48h > 0) {
    return {
      ...base,
      status: 'degraded',
      reason: `${raw.failed48h} falla(s) en las últimas 48 h`,
    };
  }
  return { ...base, status: 'healthy', reason: 'OK' };
}

/** Estado global = el peor de los jobs. */
export function overallHealth(jobs: JobHealth[]): JobHealthStatus {
  if (jobs.some((j) => j.status === 'down')) return 'down';
  if (jobs.some((j) => j.status === 'degraded')) return 'degraded';
  if (jobs.length > 0 && jobs.every((j) => j.status === 'unknown')) return 'unknown';
  return 'healthy';
}
