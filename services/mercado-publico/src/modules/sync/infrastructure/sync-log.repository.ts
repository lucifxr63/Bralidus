import { query, queryOne } from '../../../infrastructure/database/client/pg-client.js';
import { logger } from '../../../infrastructure/logging/logger.js';
import { sendOpsAlert } from '../../../infrastructure/ops-alert/ops-alert.js';
import type { JobHealthRaw } from '../domain/job-health.js';

/** Corridas 'running' más viejas que esto se consideran huérfanas/atascadas. */
const STALE_RUNNING_HOURS = 2;

// ── Types ────────────────────────────────────────────────────

export type SyncStatus = 'running' | 'success' | 'partial' | 'failed';

export interface CreateSyncLogInput {
  jobName: string;
  fechaConsultada: string; // ISO date string 'YYYY-MM-DD'
  metadata?: Record<string, unknown>;
}

export interface CompleteSyncLogInput {
  status: Exclude<SyncStatus, 'running'>;
  totalFound: number;
  totalProcessed: number;
  totalSucceeded: number;
  totalFailed: number;
  totalSkipped?: number;
  errorCodes?: string[];
  errorDetails?: Record<string, unknown>[];
  metadata?: Record<string, unknown>;
}

interface SyncLogRow {
  id: string;
  job_name: string;
  status: SyncStatus;
  started_at: Date;
  finished_at: Date | null;
  fecha_consultada: Date;
  total_found: number;
  total_processed: number;
  total_succeeded: number;
  total_failed: number;
  total_skipped: number;
  error_codes: string[];
  error_details: Record<string, unknown>[];
  metadata: Record<string, unknown>;
  created_at: Date;
}

// ── Repository ───────────────────────────────────────────────

class SyncLogRepository {
  /**
   * Inserta un nuevo log con status='running'.
   * Retorna el UUID para luego completarlo.
   */
  async create(input: CreateSyncLogInput): Promise<string> {
    const rows = await query<SyncLogRow>(
      `INSERT INTO sync_logs
         (job_name, status, fecha_consultada, metadata)
       VALUES ($1, 'running', $2, $3)
       RETURNING id`,
      [input.jobName, input.fechaConsultada, JSON.stringify(input.metadata ?? {})],
    );

    const id = rows[0]?.id;
    if (!id) throw new Error('Failed to create sync_log row');

    logger.debug({ id, jobName: input.jobName, fecha: input.fechaConsultada }, 'SyncLog created');
    return id;
  }

  /**
   * Actualiza el log al finalizar con métricas y estado final.
   */
  async complete(id: string, input: CompleteSyncLogInput): Promise<void> {
    const rows = await query<{ job_name: string }>(
      `UPDATE sync_logs SET
         status          = $2,
         finished_at     = NOW(),
         total_found     = $3,
         total_processed = $4,
         total_succeeded = $5,
         total_failed    = $6,
         total_skipped   = $7,
         error_codes     = $8,
         error_details   = $9,
         metadata        = COALESCE(metadata, '{}') || $10
       WHERE id = $1
       RETURNING job_name`,
      [
        id,
        input.status,
        input.totalFound,
        input.totalProcessed,
        input.totalSucceeded,
        input.totalFailed,
        input.totalSkipped ?? 0,
        input.errorCodes ?? [],
        JSON.stringify(input.errorDetails ?? []),
        JSON.stringify(input.metadata ?? {}),
      ],
    );

    logger.debug({ id, status: input.status }, 'SyncLog completed');

    // Alerta de ops cuando el run falla del todo (Fase 1). Fire-and-forget:
    // el alerting nunca debe romper el flujo del sync.
    if (input.status === 'failed') {
      const jobName = rows[0]?.job_name ?? 'desconocido';
      void sendOpsAlert({
        level: 'error',
        title: `Sync '${jobName}' falló`,
        detail: `encontradas=${input.totalFound}, fallidas=${input.totalFailed}${
          input.errorDetails?.length ? ` — ${JSON.stringify(input.errorDetails[0]).slice(0, 200)}` : ''
        }`,
      });
    }
  }

  /**
   * Marca como 'failed' los registros atascados en 'running'.
   * - Sin `olderThanMinutes`: limpia TODOS los 'running' del job (bootstrap Node).
   * - Con `olderThanMinutes`: solo los más viejos que ese umbral. Se llama al
   *   inicio de cada corrida (plan) para auto-sanar huérfanos en el Worker de
   *   Cloudflare, donde el bootstrap de Node nunca corre. Un run legítimo nunca
   *   dura tanto (cada fecha/slice es acotado), así que el umbral no descarta
   *   corridas reales pero libera las que crashearon (p. ej. por CPU limit).
   */
  async clearStaleRunning(jobName: string, olderThanMinutes: number | null = null): Promise<number> {
    const rows = await query<{ id: string }>(
      `UPDATE sync_logs
         SET status = 'failed', finished_at = NOW(),
             metadata = COALESCE(metadata, '{}') || '{"stale_cleared": true}'::jsonb
       WHERE job_name = $1 AND status = 'running'
         AND ($2::int IS NULL OR started_at < NOW() - make_interval(mins => $2::int))
       RETURNING id`,
      [jobName, olderThanMinutes],
    );
    return rows.length;
  }

  /**
   * Anti-solapamiento: retorna true si ya existe un job con status='running'.
   * Sobrevive a reinicios y funciona en entornos multi-instancia porque
   * la verificación vive en la DB, no en memoria.
   */
  async hasRunningJob(jobName: string): Promise<boolean> {
    const row = await queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM sync_logs
       WHERE job_name = $1 AND status = 'running'`,
      [jobName],
    );

    return parseInt(row?.count ?? '0', 10) > 0;
  }

  /**
   * Agregados de salud por job (últimos 30 días): última corrida, último éxito,
   * running activas/huérfanas y fallas/éxitos recientes. Una sola query.
   * Base del endpoint de health y del alerting (Fase 1 del HARDENING_ROADMAP).
   */
  async getJobsHealth(): Promise<JobHealthRaw[]> {
    const rows = await query<{
      job_name: string;
      last_run: string | null;
      last_success: string | null;
      active_running: string;
      stale_running: string;
      failed_48h: string;
      ok_48h: string;
    }>(
      `SELECT
         job_name,
         MAX(started_at)::text AS last_run,
         MAX(started_at) FILTER (WHERE status IN ('success','partial'))::text AS last_success,
         COUNT(*) FILTER (WHERE status='running')::text AS active_running,
         COUNT(*) FILTER (WHERE status='running'
           AND started_at < NOW() - make_interval(hours => $1))::text AS stale_running,
         COUNT(*) FILTER (WHERE status='failed'
           AND started_at > NOW() - INTERVAL '48 hours')::text AS failed_48h,
         COUNT(*) FILTER (WHERE status IN ('success','partial')
           AND started_at > NOW() - INTERVAL '48 hours')::text AS ok_48h
       FROM sync_logs
       WHERE started_at > NOW() - INTERVAL '30 days'
       GROUP BY job_name
       ORDER BY job_name`,
      [STALE_RUNNING_HOURS],
    );

    return rows.map((r) => ({
      jobName: r.job_name,
      lastRun: r.last_run,
      lastSuccess: r.last_success,
      activeRunning: parseInt(r.active_running, 10),
      staleRunning: parseInt(r.stale_running, 10),
      failed48h: parseInt(r.failed_48h, 10),
      ok48h: parseInt(r.ok_48h, 10),
    }));
  }

  /**
   * Retorna true si ya existe un sync exitoso (success o partial) para esa fecha.
   */
  async hasSuccessForDate(jobName: string, isoDate: string): Promise<boolean> {
    const row = await queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM sync_logs
       WHERE job_name = $1 AND fecha_consultada = $2 AND status IN ('success', 'partial')`,
      [jobName, isoDate],
    );
    return parseInt(row?.count ?? '0', 10) > 0;
  }
}

export const syncLogRepository = new SyncLogRepository();
