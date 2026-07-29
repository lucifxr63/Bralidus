import { Pool, type PoolClient } from 'pg';
import { env } from '../../../app/env.js';
import { logger } from '../../logging/logger.js';

/**
 * Cliente Postgres del servicio de ingesta — **dos** destinos (dual-write).
 *
 * Simplificación respecto al `pg-client.ts` de Licitus: allá había un doble
 * runtime (pool efímero por request sobre Hyperdrive en Cloudflare Workers vs.
 * singleton en Node, propagado por AsyncLocalStorage). Aquí no existe ese
 * problema: este servicio corre SOLO en Vercel/Nitro sobre Node, así que cada
 * destino es un singleton simple contra el pooler de Supabase.
 *
 * Los dos destinos:
 *  - **Licitus** (`LICITUS_DATABASE_URL`, proyecto szzibobuwgcopewmnkkl) — el
 *    destino histórico: `opportunities`, `purchase_orders`, `sync_logs`. Es el
 *    pool POR DEFECTO a propósito: todos los repositorios que se movieron desde
 *    Licitus llaman `query()`/`queryOne()`/`withTransaction()` sin sufijo y
 *    siguen apuntando exactamente a donde apuntaban antes — cero cambios de
 *    comportamiento al moverlos.
 *  - **Bralidus/Animus** (`BRALIDUS_DATABASE_URL`, proyecto fcdhcntyvsydnvjwopfe)
 *    — la tabla canónica `licitaciones_mercado_publico`. Se accede SIEMPRE de
 *    forma explícita (`bralidusQuery`, `withBralidusTransaction`) para que en
 *    el código quede evidente cuándo se está escribiendo al segundo destino.
 *
 * Ambas URLs deben apuntar al POOLER de Supabase, nunca a
 * `db.<project>.supabase.co`. Ver la nota sobre el modo del pooler
 * (transaction, puerto 6543) en `app/env.ts`.
 */

type PoolName = 'licitus' | 'bralidus';

const pools: Partial<Record<PoolName, Pool>> = {};

const POOL_CONFIG: Record<PoolName, { envVar: string; url: () => string | undefined }> = {
  licitus: { envVar: 'LICITUS_DATABASE_URL', url: () => env.LICITUS_DATABASE_URL },
  bralidus: { envVar: 'BRALIDUS_DATABASE_URL', url: () => env.BRALIDUS_DATABASE_URL },
};

function getPoolFor(name: PoolName): Pool {
  const existing = pools[name];
  if (existing) return existing;

  const { envVar, url } = POOL_CONFIG[name];
  const connectionString = url();
  if (!connectionString) {
    throw new Error(
      `${envVar} is required to reach the '${name}' database. Set it to the Supabase pooler connection string.`,
    );
  }

  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });
  pool.on('error', (err: Error) => {
    logger.error({ err, pool: name }, 'Unexpected error on idle DB client');
  });

  pools[name] = pool;
  return pool;
}

/** Pool de Licitus (destino por defecto — ver nota de arriba). */
export function getPool(): Pool {
  return getPoolFor('licitus');
}

/** Pool de Bralidus/Animus (destino del dual-write). */
export function getBralidusPool(): Pool {
  return getPoolFor('bralidus');
}

// ── Core ─────────────────────────────────────────────────────

async function runQuery<T extends object>(
  name: PoolName,
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const start = Date.now();
  const client = await getPoolFor(name).connect();
  try {
    const result = await client.query<T>(text, params);
    logger.debug({ duration: Date.now() - start, rows: result.rowCount, pool: name }, 'DB query');
    return result.rows;
  } finally {
    client.release();
  }
}

async function runInTransaction<T>(
  name: PoolName,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPoolFor(name).connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Licitus (default) ────────────────────────────────────────

/** Ejecuta una query contra Licitus y retorna todas las filas tipadas como T. */
export async function query<T extends object>(text: string, params?: unknown[]): Promise<T[]> {
  return runQuery<T>('licitus', text, params);
}

/** Ejecuta una query contra Licitus y retorna la primera fila o null. */
export async function queryOne<T extends object>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Corre un conjunto de operaciones dentro de una transacción en Licitus. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return runInTransaction('licitus', fn);
}

// ── Bralidus/Animus (dual-write, siempre explícito) ──────────

/** Ejecuta una query contra Bralidus/Animus. */
export async function bralidusQuery<T extends object>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  return runQuery<T>('bralidus', text, params);
}

/** Ejecuta una query contra Bralidus/Animus y retorna la primera fila o null. */
export async function bralidusQueryOne<T extends object>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await bralidusQuery<T>(text, params);
  return rows[0] ?? null;
}

/** Corre un conjunto de operaciones dentro de una transacción en Bralidus/Animus. */
export async function withBralidusTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return runInTransaction('bralidus', fn);
}

// ── Diagnóstico ──────────────────────────────────────────────

export interface DbPing {
  pool: PoolName;
  ok: boolean;
  error?: string;
}

/**
 * Verifica conectividad de un destino sin lanzar. Lo usa `GET /health` para
 * reportar ambos pools por separado (uno puede estar mal configurado sin que
 * el otro deje de funcionar).
 */
export async function pingPool(name: PoolName): Promise<DbPing> {
  try {
    await runQuery(name, 'SELECT 1');
    return { pool: name, ok: true };
  } catch (err) {
    return { pool: name, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
