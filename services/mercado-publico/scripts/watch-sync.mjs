/**
 * watch-sync.mjs — consola en vivo de la ingesta de Mercado Público.
 *
 * Muestra, refrescando cada N segundos:
 *   · estado de cada job (corriendo / último resultado / antigüedad)
 *   · progreso del que esté activo, con sus últimas líneas de log
 *   · volumen en Licitus y paridad con la tabla canónica de Bralidus
 *   · frescura del dato (cuán atrás va la ingesta respecto de hoy)
 *
 * Es de sólo lectura: no dispara nada ni escribe en ninguna base.
 *
 * USO
 *   node scripts/watch-sync.mjs              # refresca cada 10 s
 *   node scripts/watch-sync.mjs --every 30   # cada 30 s
 *   node scripts/watch-sync.mjs --once       # una foto y sale
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const ONCE = args.includes('--once');
const everyIdx = args.indexOf('--every');
const EVERY_S = everyIdx >= 0 ? Math.max(Number(args[everyIdx + 1]) || 10, 3) : 10;

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^\s*[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', gray: '\x1b[90m',
};

const STATUS_COLOR = {
  success: C.green, failed: C.red, running: C.cyan, partial: C.yellow,
};

const open = (url) =>
  new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, statement_timeout: 30000 });

const ago = (d) => {
  if (!d) return '—';
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `hace ${h}h${m % 60}m` : `hace ${Math.floor(h / 24)}d${h % 24}h`;
};

const dur = (a, b) => (a && b ? Math.round((new Date(b) - new Date(a)) / 1000) + 's' : '—');
const num = (n) => Number(n ?? 0).toLocaleString('es-CL');

async function snapshot() {
  const lic = open(env.LICITUS_DATABASE_URL);
  const bra = open(env.BRALIDUS_DATABASE_URL);
  await Promise.all([lic.connect(), bra.connect()]);
  try {
    // Última corrida de cada job
    const jobs = await lic.query(`
      SELECT DISTINCT ON (job_name)
             job_name, status, started_at, finished_at,
             total_found, total_succeeded, total_failed, error_codes
        FROM sync_logs
       ORDER BY job_name, started_at DESC`);

    const active = await lic.query(`
      SELECT job_key, stats, logs, updated_at
        FROM job_progress
       WHERE is_running = true AND job_key <> 'buyer-profiles'
       ORDER BY updated_at DESC LIMIT 1`);

    const vol = await lic.query(`
      SELECT (SELECT count(*) FROM opportunities)::int  AS opps,
             (SELECT count(*) FROM opportunities WHERE source_type='compra_agil')::int AS cot,
             (SELECT count(*) FROM purchase_orders)::int AS ocs,
             (SELECT max(published_at)::date FROM opportunities) AS ult_pub,
             (SELECT max(issued_at)::date FROM purchase_orders)  AS ult_oc,
             (SELECT count(*) FROM opportunities
               WHERE updated_at > now() - interval '15 minutes')::int AS mov15`);

    const can = await bra.query(`SELECT count(*)::int AS n FROM licitaciones_mercado_publico`);
    return { jobs: jobs.rows, active: active.rows[0] ?? null, vol: vol.rows[0], canon: can.rows[0].n };
  } finally {
    await Promise.allSettled([lic.end(), bra.end()]);
  }
}

function render({ jobs, active, vol, canon }) {
  const out = [];
  out.push(`${C.bold}INGESTA MERCADO PÚBLICO${C.reset}  ${C.gray}${new Date().toLocaleTimeString('es-CL')}${C.reset}`);
  out.push('─'.repeat(78));

  out.push(`${C.bold}JOBS${C.reset}`);
  for (const j of jobs.sort((a, b) => a.job_name.localeCompare(b.job_name))) {
    const col = STATUS_COLOR[j.status] ?? C.gray;
    const when = j.status === 'running' ? ago(j.started_at) : ago(j.finished_at ?? j.started_at);
    const res = j.status === 'running'
      ? `${C.cyan}corriendo${C.reset}`
      : `ok=${num(j.total_succeeded)} fail=${num(j.total_failed)} ${C.gray}${dur(j.started_at, j.finished_at)}${C.reset}`;
    out.push(`  ${col}●${C.reset} ${j.job_name.padEnd(22)} ${String(j.status).padEnd(9)} ${res}  ${C.gray}${when}${C.reset}`);
    if (j.error_codes?.length) out.push(`      ${C.red}${j.error_codes.join(', ')}${C.reset}`);
  }

  if (active) {
    const s = active.stats ?? {};
    out.push('');
    out.push(`${C.bold}EN CURSO${C.reset}  ${C.cyan}${active.job_key}${C.reset}  ${C.gray}latido ${ago(active.updated_at)}${C.reset}`);
    if (s.currentDate) {
      out.push(`  fecha ${s.currentDate}  (${s.currentDateIndex ?? '?'}/${s.totalDates ?? '?'})   encontradas ${num(s.totalFound)}`);
    }
    for (const line of (active.logs ?? []).slice(-6)) out.push(`  ${C.gray}${line}${C.reset}`);
  }

  const desfase = vol.opps - canon;
  const desfaseTxt = desfase === 0
    ? `${C.green}0 (en paridad)${C.reset}`
    : `${C.yellow}${desfase > 0 ? '+' : ''}${desfase}${C.reset}`;
  const hoy = new Date().toISOString().slice(0, 10);
  const pub = vol.ult_pub ? new Date(vol.ult_pub).toISOString().slice(0, 10) : '—';
  const atraso = vol.ult_pub
    ? Math.round((new Date(hoy) - new Date(pub)) / 86400000)
    : null;
  const pubCol = atraso != null && atraso <= 1 ? C.green : C.yellow;

  out.push('');
  out.push(`${C.bold}DATOS${C.reset}`);
  out.push(`  Licitus oportunidades  ${num(vol.opps).padStart(9)}   ${C.gray}de las cuales COT: ${num(vol.cot)}${C.reset}`);
  out.push(`  Órdenes de compra      ${num(vol.ocs).padStart(9)}   ${C.gray}última ${vol.ult_oc ? new Date(vol.ult_oc).toISOString().slice(0,10) : '—'}${C.reset}`);
  out.push(`  Tabla canónica         ${num(canon).padStart(9)}   desfase ${desfaseTxt}`);
  out.push(`  Última publicación     ${pubCol}${pub}${C.reset}   ${C.gray}${atraso != null ? `(${atraso} día(s) de atraso)` : ''}${C.reset}`);
  out.push(`  Movimiento 15 min      ${num(vol.mov15).padStart(9)}`);
  return out.join('\n');
}

async function tick() {
  try {
    const snap = await snapshot();
    if (!ONCE) process.stdout.write('\x1b[2J\x1b[H');
    console.log(render(snap));
    if (!ONCE) console.log(`\n${C.gray}refresca cada ${EVERY_S}s — Ctrl+C para salir${C.reset}`);
  } catch (err) {
    console.error(`${C.red}error al consultar:${C.reset} ${err.message}`);
  }
}

await tick();
if (!ONCE) setInterval(tick, EVERY_S * 1000);
