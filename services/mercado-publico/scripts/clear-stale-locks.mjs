/**
 * clear-stale-locks.mjs — libera candados huérfanos de la ingesta.
 *
 * POR QUÉ EXISTE
 * --------------
 * Si el workflow durable muere por error fatal (p. ej. agota los reintentos
 * contra la API de Mercado Público), nunca cierra su corrida y quedan filas
 * trabadas. El guard anti-solapamiento entonces rechaza toda corrida futura con
 * "Job already running — skipping tick", y la ingesta se detiene en silencio.
 *
 * Eso fue exactamente lo que pasó entre el 2026-07-26 y el 2026-07-29.
 *
 * DOS TABLAS, NO UNA — el orden importa
 * -------------------------------------
 *  · `sync_logs`    → es el CANDADO REAL. `planSyncRun()` consulta
 *                     `hasRunningJob()` sobre esta tabla; si hay un
 *                     status='running', aborta la corrida. Su auto-saneo
 *                     (`clearStaleRunning`) sólo limpia huérfanos de más de
 *                     2 HORAS, así que un crash reciente bloquea todo hasta
 *                     que pase ese plazo.
 *  · `job_progress` → es TELEMETRÍA (lo que pinta el panel admin). Limpiarla
 *                     sola no desbloquea nada: el guard ni la mira.
 *
 * Este script limpia ambas, pero la que destraba es sync_logs.
 *
 * SEGURIDAD
 * ---------
 * Sólo toca filas cuyo latido supere el umbral (default 15 min): un job vivo
 * escribe progreso constantemente, así que no puede confundirse con uno muerto.
 * `buyer-profiles` queda excluido — tiene su propio store sin abort.
 *
 * USO
 *   node scripts/clear-stale-locks.mjs --dry-run
 *   node scripts/clear-stale-locks.mjs
 *   node scripts/clear-stale-locks.mjs --minutes 30
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const mIdx = args.indexOf('--minutes');
const MINUTES = mIdx >= 0 ? Number(args[mIdx + 1]) : 15;

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => /^\s*[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const c = new pg.Client({
  connectionString: env.LICITUS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 60000,
});
await c.connect();

// ── 1. sync_logs — el candado que consulta planSyncRun() ─────────────────────
const locks = await c.query(
  `select id, job_name, started_at,
          round(extract(epoch from (now() - started_at)) / 60)::int as minutos
     from public.sync_logs
    where status = 'running'
      and started_at < now() - ($1 || ' minutes')::interval
    order by started_at`,
  [String(MINUTES)],
);

console.log(`== sync_logs (CANDADO) — huérfanos de más de ${MINUTES} min ==`);
if (locks.rows.length === 0) {
  console.log('  ninguno');
} else {
  for (const r of locks.rows) {
    console.log(`  ${r.job_name.padEnd(22)} iniciado ${r.started_at?.toISOString().slice(0, 19)}  hace ${r.minutos} min`);
  }
  if (!DRY_RUN) {
    const upd = await c.query(
      `update public.sync_logs
          set status = 'failed',
              finished_at = coalesce(finished_at, now()),
              error_codes = array_append(coalesce(error_codes, '{}'), 'STALE_LOCK_CLEARED')
        where status = 'running'
          and started_at < now() - ($1 || ' minutes')::interval
        returning job_name`,
      [String(MINUTES)],
    );
    console.log(`  → liberados: ${upd.rows.map((r) => r.job_name).join(', ')}`);
  }
}

// ── 2. job_progress — telemetría del panel admin ─────────────────────────────
const prog = await c.query(
  `select job_key,
          round(extract(epoch from (now() - updated_at)) / 60)::int as minutos
     from public.job_progress
    where is_running = true
      and job_key <> 'buyer-profiles'
      and updated_at < now() - ($1 || ' minutes')::interval
    order by updated_at`,
  [String(MINUTES)],
);

console.log(`\n== job_progress (telemetría) ==`);
if (prog.rows.length === 0) {
  console.log('  ninguno');
} else {
  for (const r of prog.rows) console.log(`  ${r.job_key.padEnd(22)} sin latido hace ${r.minutos} min`);
  if (!DRY_RUN) {
    const upd = await c.query(
      `update public.job_progress
          set is_running = false,
              abort_requested = false,
              finished_at = coalesce(finished_at, now()),
              updated_at = now()
        where is_running = true
          and job_key <> 'buyer-profiles'
          and updated_at < now() - ($1 || ' minutes')::interval
        returning job_key`,
      [String(MINUTES)],
    );
    console.log(`  → liberados: ${upd.rows.map((r) => r.job_key).join(', ')}`);
  }
}

if (DRY_RUN) console.log('\n[DRY RUN] no se modificó nada.');
await c.end();
