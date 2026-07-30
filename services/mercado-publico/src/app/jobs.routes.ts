import { Hono } from 'hono';
import { start } from 'workflow/api';
import { env } from './env.js';
import { logger } from '../infrastructure/logging/logger.js';
import { syncLicitacionesWorkflow } from '../workflows/sync-licitaciones.workflow.js';
import { syncOrdenesWorkflow } from '../workflows/sync-ordenes.workflow.js';
import { syncCompraAgilWorkflow } from '../workflows/sync-compra-agil.workflow.js';
import { refreshOpportunitiesWorkflow } from '../workflows/refresh-opportunities.workflow.js';
import { buildBuyerProfilesWorkflow } from '../workflows/build-buyer-profiles.workflow.js';
import { enrichOrdenesWorkflow } from '../workflows/enrich-ordenes.workflow.js';
import { syncProgress } from '../jobs/sync-progress.store.js';
import { syncLogRepository } from '../modules/sync/infrastructure/sync-log.repository.js';
import { deriveJobHealth, overallHealth, JOB_EXPECTED_INTERVAL_HOURS } from '../modules/sync/domain/job-health.js';

/**
 * Control plane del servicio de ingesta.
 *
 * Mismo contrato que `api/jobs.py` de BralidusPY (`GET /jobs/list`,
 * `POST /jobs/run/{job_id}`, Bearer CRON_SECRET) a propósito: así el tab
 * "Orquestador & Workers" del panel /admin y el cron de GitHub Actions lo
 * invocan igual que a los 9 jobs de Animus, sin lógica especial.
 *
 * Diferencia importante con BralidusPY: allá el endpoint EJECUTA el job y
 * espera. Aquí un sync puede durar mucho más que el techo de una función
 * serverless, así que el endpoint **arranca el workflow durable y responde de
 * inmediato** con el `runId`. El progreso se consulta por `/jobs/progress`.
 */

/** Opciones aceptadas en el body para corridas manuales/históricas. */
interface RunOptions {
  maxItems?: number;
  lookbackDays?: number;
  delayMinutes?: number;
  /** Backfills: no dispara el post-proceso de Licitus. */
  skipAutoAnalysis?: boolean;
  /** Fechas ISO explícitas (YYYY-MM-DD) para re-sincronizar. */
  isoDates?: string[];
}

type JobStarter = (options: RunOptions) => Promise<{ runId: string }>;

const JOBS: Record<string, JobStarter> = {
  'sync-licitaciones': (o) => start(syncLicitacionesWorkflow, [o]),
  'sync-ordenes': (o) => start(syncOrdenesWorkflow, [o]),
  'sync-compra-agil': (o) => start(syncCompraAgilWorkflow, [o]),
  'refresh-opportunities': () => start(refreshOpportunitiesWorkflow, []),
  'build-buyer-profiles': () => start(buildBuyerProfilesWorkflow, []),
  // Disparable por su cuenta, no sólo encadenado a sync-ordenes: un lote diario
  // no alcanza para drenar la cola de enriquecimiento (ver el comentario del
  // workflow). También permite verificarlo sin esperar un sync completo.
  'enrich-ordenes': () => start(enrichOrdenesWorkflow, []),
};

export const jobsRoutes = new Hono();

/**
 * Sin CRON_SECRET configurado no se exige (solo dev). Igual que BralidusPY —
 * NUNCA dejar así en producción.
 */
jobsRoutes.use('*', async (c, next) => {
  const secret = env.CRON_SECRET;
  if (!secret) return next();

  const header = c.req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (token !== secret) {
    return c.json({ error: 'CRON_SECRET inválido o ausente' }, 401);
  }
  return next();
});

jobsRoutes.get('/list', (c) => c.json({ jobs: Object.keys(JOBS).sort() }));

jobsRoutes.post('/run/:job_id', async (c) => {
  const jobId = c.req.param('job_id');
  const starter = JOBS[jobId];
  if (!starter) {
    return c.json({ error: `job desconocido: ${jobId}` }, 404);
  }

  // Body opcional: una corrida sin opciones (el caso del cron) manda vacío.
  let options: RunOptions = {};
  try {
    const body = await c.req.json();
    if (body && typeof body === 'object') options = body as RunOptions;
  } catch {
    /* sin body — corrida por defecto */
  }

  try {
    const run = await starter(options);
    logger.info({ job: jobId, runId: run.runId, options }, '[jobs] workflow iniciado');
    return c.json({ ok: true, job: jobId, runId: run.runId });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error({ job: jobId, error }, '[jobs] fallo al iniciar el workflow');
    return c.json({ ok: false, job: jobId, error }, 500);
  }
});

/**
 * Progreso en vivo (lo consume la barra del panel admin, que hace polling).
 * Sin `?job=` devuelve el estado de todos los jobs, que es lo que el panel
 * necesita para pintar varias filas de una sola llamada.
 */
jobsRoutes.get('/progress', async (c) => {
  const jobKey = c.req.query('job');
  if (jobKey) {
    return c.json(await syncProgress.getState(jobKey));
  }
  return c.json({ jobs: await syncProgress.getAllStates() });
});

/** Marca el abort; cada slice lo relee antes de procesar. */
jobsRoutes.post('/abort', async (c) => {
  await syncProgress.requestAbort();
  return c.json({ ok: true, aborted: true });
});

/** Semáforo de salud por job — misma derivación que usaba el panel de Licitus. */
jobsRoutes.get('/health', async (c) => {
  const raw = await syncLogRepository.getJobsHealth();
  const jobs = raw.map((r) =>
    deriveJobHealth(r, JOB_EXPECTED_INTERVAL_HOURS[r.jobName] ?? null),
  );
  return c.json({ status: overallHealth(jobs), jobs });
});
