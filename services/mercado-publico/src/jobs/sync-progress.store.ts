/**
 * Progreso del sync, respaldado en la tabla job_progress (fila job_key='sync').
 *
 * Antes era un singleton en memoria — eso requería un proceso Node persistente
 * compartiendo memoria entre el cron job y los endpoints HTTP. En Cloudflare
 * Workers cada invocación es un isolate distinto, así que el estado vive en DB:
 *  - el job escribe (start/log/updateStats/finish) — las escrituras se
 *    serializan en una cadena de promesas para preservar el orden;
 *  - los endpoints admin leen con getState() y piden abort con requestAbort();
 *  - el job relee el flag con refreshAbort() en los bordes de fecha/batch y
 *    los chequeos internos usan el espejo en memoria (isAbortRequested, sync).
 */

import { query, queryOne } from '../infrastructure/database/client/pg-client.js';
import { logger } from '../infrastructure/logging/logger.js';

const MAX_LOGS = 300;

/**
 * Jobs distintos (sync-licitaciones, sync-ordenes, sync-historical-*) antes
 * compartían una única fila `job_key='sync'` — sus logs se pisaban entre sí
 * ("un job bajo el header de otro", CODE_REVIEW.md §3.3). Ahora cada uno
 * escribe a su propia fila, seteada por `start(jobKey)` para el resto de la
 * corrida (log/updateStats/finish no reciben jobKey — asumen una sola corrida
 * activa por isolate, igual trade-off que ya acepta el circuit breaker de MP).
 */
let currentJobKey = 'sync-licitaciones';

export interface SyncStats {
  totalFound: number;
  totalProcessed: number;
  totalSucceeded: number;
  totalFailed: number;
  currentDate: string | null;
  currentBatch: number;
  totalBatches: number;
  totalDates: number;
  currentDateIndex: number;
}

export interface SyncProgressState {
  isRunning: boolean;
  abortRequested: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  logs: string[];
  stats: SyncStats;
}

const defaultStats = (): SyncStats => ({
  totalFound: 0,
  totalProcessed: 0,
  totalSucceeded: 0,
  totalFailed: 0,
  currentDate: null,
  currentBatch: 0,
  totalBatches: 0,
  totalDates: 0,
  currentDateIndex: 0,
});

const defaultState = (): SyncProgressState => ({
  isRunning: false,
  abortRequested: false,
  startedAt: null,
  finishedAt: null,
  logs: [],
  stats: defaultStats(),
});

// Espejo en memoria del ESCRITOR (el job en curso). Los lectores usan la DB.
let mem: SyncProgressState = defaultState();

// Cadena de escrituras: cada flush espera al anterior → orden garantizado.
let writeChain: Promise<void> = Promise.resolve();

function ts(): string {
  return new Date().toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function snapshot(): SyncProgressState {
  return { ...mem, logs: [...mem.logs], stats: { ...mem.stats } };
}

function enqueueFlush(): Promise<void> {
  const state = snapshot();
  writeChain = writeChain
    .then(() => flush(state))
    .catch((err: unknown) => {
      logger.warn({ err }, '[sync-progress] Failed to persist progress');
    });
  return writeChain;
}

async function flush(state: SyncProgressState): Promise<void> {
  await query(
    `INSERT INTO job_progress (job_key, is_running, abort_requested, started_at, finished_at, logs, stats, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (job_key) DO UPDATE SET
       is_running      = EXCLUDED.is_running,
       abort_requested = EXCLUDED.abort_requested,
       started_at      = EXCLUDED.started_at,
       finished_at     = EXCLUDED.finished_at,
       logs            = EXCLUDED.logs,
       stats           = EXCLUDED.stats,
       updated_at      = now()`,
    [
      currentJobKey,
      state.isRunning,
      state.abortRequested,
      state.startedAt,
      state.finishedAt,
      JSON.stringify(state.logs),
      JSON.stringify(state.stats),
    ],
  );
}

interface JobProgressRow {
  is_running: boolean;
  abort_requested: boolean;
  started_at: Date | null;
  finished_at: Date | null;
  logs: string[];
  stats: Partial<SyncStats>;
}

export const syncProgress = {
  /** Inicia una corrida bajo `jobKey` (p. ej. 'sync-licitaciones', 'sync-historical-ordenes'). */
  async start(jobKey: string): Promise<void> {
    currentJobKey = jobKey;
    mem = {
      isRunning: true,
      abortRequested: false,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      logs: [],
      stats: defaultStats(),
    };
    syncProgress.log('▶ Sincronización iniciada');
    await enqueueFlush();
  },

  /** Cierra la corrida. Await obligatorio: drena la cadena de escrituras. */
  async finish(summary: string): Promise<void> {
    mem.isRunning = false;
    mem.abortRequested = false;
    mem.finishedAt = new Date().toISOString();
    syncProgress.log(`■ ${summary}`);
    await enqueueFlush();
  },

  /**
   * Solicita abort (desde el endpoint admin). No conoce el jobKey del corredor
   * (isolate distinto) — corta cualquier sync en curso (nunca build-buyer-profiles,
   * que tiene su propio store sin abort).
   */
  async requestAbort(): Promise<boolean> {
    const rows = await query<{ job_key: string }>(
      `UPDATE job_progress
         SET abort_requested = true, updated_at = now()
       WHERE is_running = true AND job_key <> 'buyer-profiles'
       RETURNING job_key`,
      [],
    );
    if (rows.some((r) => r.job_key === currentJobKey)) mem.abortRequested = true;
    return rows.length > 0;
  },

  /** Relee el flag de abort desde DB (llamar en bordes de fecha/batch). */
  async refreshAbort(): Promise<boolean> {
    try {
      const row = await queryOne<{ abort_requested: boolean }>(
        `SELECT abort_requested FROM job_progress WHERE job_key = $1`,
        [currentJobKey],
      );
      if (row) mem.abortRequested = row.abort_requested;
    } catch (err) {
      logger.warn({ err }, '[sync-progress] Failed to refresh abort flag');
    }
    return mem.abortRequested;
  },

  /** Chequeo barato en memoria (dentro de un mismo step/invocación). */
  isAbortRequested(): boolean {
    return mem.abortRequested;
  },

  log(message: string): void {
    const line = `[${ts()}] ${message}`;
    mem.logs.push(line);
    if (mem.logs.length > MAX_LOGS) mem.logs.shift();
    void enqueueFlush();
  },

  updateStats(patch: Partial<SyncStats>): void {
    mem.stats = { ...mem.stats, ...patch };
    void enqueueFlush();
  },

  /**
   * Estado para el panel admin — lee la DB (fuente de verdad entre isolates).
   * Sin `jobKey`: la fila que esté corriendo ahora, o si ninguna, la más
   * reciente (preserva el comportamiento previo de "el sync", ahora sin que
   * un job pise la fila de otro).
   */
  async getState(jobKey?: string): Promise<SyncProgressState> {
    try {
      const row = jobKey
        ? await queryOne<JobProgressRow>(
            `SELECT is_running, abort_requested, started_at, finished_at, logs, stats
             FROM job_progress WHERE job_key = $1`,
            [jobKey],
          )
        : await queryOne<JobProgressRow>(
            `SELECT is_running, abort_requested, started_at, finished_at, logs, stats
             FROM job_progress
             WHERE job_key <> 'buyer-profiles'
             ORDER BY is_running DESC, updated_at DESC
             LIMIT 1`,
            [],
          );
      if (!row) return defaultState();
      return rowToState(row);
    } catch (err) {
      logger.warn({ err }, '[sync-progress] Failed to read state — returning memory mirror');
      return snapshot();
    }
  },

  /**
   * Estado de TODOS los jobs de sync (uno por fila de job_progress, excepto
   * buyer-profiles que tiene su propio store). Permite al panel mostrar cada
   * job en su propia terminal sin cruzar logs (CODE_REVIEW.md §3.3). Ordenado:
   * los que están corriendo primero, luego por actividad reciente.
   */
  async getAllStates(): Promise<Array<{ jobKey: string; state: SyncProgressState }>> {
    try {
      const rows = await query<JobProgressRow & { job_key: string }>(
        `SELECT job_key, is_running, abort_requested, started_at, finished_at, logs, stats
         FROM job_progress
         WHERE job_key <> 'buyer-profiles'
         ORDER BY is_running DESC, updated_at DESC`,
        [],
      );
      return rows.map((row) => ({ jobKey: row.job_key, state: rowToState(row) }));
    } catch (err) {
      logger.warn({ err }, '[sync-progress] Failed to read all states');
      return [];
    }
  },
};

function rowToState(row: JobProgressRow): SyncProgressState {
  return {
    isRunning: row.is_running,
    abortRequested: row.abort_requested,
    startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
    finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null,
    logs: row.logs ?? [],
    stats: { ...defaultStats(), ...row.stats },
  };
}
