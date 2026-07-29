/**
 * Progreso del build-buyer-profiles, respaldado en job_progress
 * (fila job_key='buyer-profiles'). Mismo diseño que sync-progress.store.ts:
 * escritor con espejo en memoria + cadena de escrituras; lectores desde DB.
 */

import { query, queryOne } from '../infrastructure/database/client/pg-client.js';
import { logger } from '../infrastructure/logging/logger.js';

const MAX_LOGS = 200;
const JOB_KEY = 'buyer-profiles';

export interface BuyerProfilesState {
  isRunning: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  logs: string[];
  stats: {
    totalOrgs: number;
    processed: number;
    upserted: number;
  };
}

const defaultState = (): BuyerProfilesState => ({
  isRunning: false,
  startedAt: null,
  finishedAt: null,
  logs: [],
  stats: { totalOrgs: 0, processed: 0, upserted: 0 },
});

let mem: BuyerProfilesState = defaultState();
let writeChain: Promise<void> = Promise.resolve();

function ts(): string {
  return new Date().toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function snapshot(): BuyerProfilesState {
  return { ...mem, logs: [...mem.logs], stats: { ...mem.stats } };
}

function enqueueFlush(): Promise<void> {
  const state = snapshot();
  writeChain = writeChain
    .then(() => flush(state))
    .catch((err: unknown) => {
      logger.warn({ err }, '[buyer-profiles-progress] Failed to persist progress');
    });
  return writeChain;
}

async function flush(state: BuyerProfilesState): Promise<void> {
  await query(
    `INSERT INTO job_progress (job_key, is_running, abort_requested, started_at, finished_at, logs, stats, updated_at)
     VALUES ($1, $2, false, $3, $4, $5, $6, now())
     ON CONFLICT (job_key) DO UPDATE SET
       is_running  = EXCLUDED.is_running,
       started_at  = EXCLUDED.started_at,
       finished_at = EXCLUDED.finished_at,
       logs        = EXCLUDED.logs,
       stats       = EXCLUDED.stats,
       updated_at  = now()`,
    [
      JOB_KEY,
      state.isRunning,
      state.startedAt,
      state.finishedAt,
      JSON.stringify(state.logs),
      JSON.stringify(state.stats),
    ],
  );
}

interface JobProgressRow {
  is_running: boolean;
  started_at: Date | null;
  finished_at: Date | null;
  logs: string[];
  stats: Partial<BuyerProfilesState['stats']>;
}

export const buyerProfilesProgress = {
  async start(): Promise<void> {
    mem = {
      isRunning: true,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      logs: [],
      stats: { totalOrgs: 0, processed: 0, upserted: 0 },
    };
    buyerProfilesProgress.log('▶ Build buyer profiles iniciado');
    await enqueueFlush();
  },

  async finish(summary: string): Promise<void> {
    mem.isRunning = false;
    mem.finishedAt = new Date().toISOString();
    buyerProfilesProgress.log(`■ ${summary}`);
    await enqueueFlush();
  },

  log(message: string): void {
    const line = `[${ts()}] ${message}`;
    mem.logs.push(line);
    if (mem.logs.length > MAX_LOGS) mem.logs.shift();
    void enqueueFlush();
  },

  updateStats(patch: Partial<BuyerProfilesState['stats']>): void {
    mem.stats = { ...mem.stats, ...patch };
    void enqueueFlush();
  },

  async getState(): Promise<BuyerProfilesState> {
    try {
      const row = await queryOne<JobProgressRow>(
        `SELECT is_running, started_at, finished_at, logs, stats
         FROM job_progress WHERE job_key = $1`,
        [JOB_KEY],
      );
      if (!row) return defaultState();
      return {
        isRunning: row.is_running,
        startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
        finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null,
        logs: row.logs ?? [],
        stats: { totalOrgs: 0, processed: 0, upserted: 0, ...row.stats },
      };
    } catch (err) {
      logger.warn({ err }, '[buyer-profiles-progress] Failed to read state');
      return snapshot();
    }
  },
};
