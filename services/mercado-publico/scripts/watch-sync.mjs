/**
 * watch-sync.mjs — consola en vivo de TODA la cadena de Mercado Público.
 *
 * Recorre el pipeline de punta a punta y muestra cada eslabón:
 *
 *   Mercado Público (v1 + v2)      ← origen
 *          ↓
 *   mp-sync en Vercel              ← ingesta (jobs, progreso, logs)
 *          ↓
 *   Licitus (dual-write) ── Bralidus/canónica
 *          ↓
 *   api-v1 gateway                 ← lo que ve el desarrollador
 *
 * Es de sólo lectura: no dispara jobs ni escribe en ninguna base.
 *
 * USO
 *   node scripts/watch-sync.mjs              # refresca cada 10 s
 *   node scripts/watch-sync.mjs --every 30
 *   node scripts/watch-sync.mjs --once       # una foto y sale
 *   node scripts/watch-sync.mjs --no-http    # omite los sondeos de red
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const ONCE = args.includes('--once');
const NO_HTTP = args.includes('--no-http');
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

const GATEWAY = 'https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/api-v1';
const MP_SYNC = 'https://mp-sync.vercel.app';

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', gray: '\x1b[90m', white: '\x1b[97m',
};
const STATUS_COLOR = { success: C.green, failed: C.red, running: C.cyan, partial: C.yellow };
const dot = (c) => `${c}●${C.reset}`;

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
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '—');

/** Sondeo HTTP que nunca lanza: devuelve {ok, status, ms, extra}. */
async function probe(url, opts = {}) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      headers: opts.headers ?? {},
      signal: AbortSignal.timeout(opts.timeoutMs ?? 12000),
    });
    const ms = Date.now() - t0;
    let extra;
    if (opts.parse) {
      try {
        extra = opts.parse(await res.json());
      } catch { /* respuesta no-JSON: da igual, el status manda */ }
    }
    return { ok: res.ok, status: res.status, ms, extra };
  } catch (err) {
    return { ok: false, status: 0, ms: Date.now() - t0, extra: err.name === 'TimeoutError' ? 'timeout' : 'sin respuesta' };
  }
}

async function probeChain() {
  if (NO_HTTP) return null;
  const ticket = env.MERCADO_PUBLICO_TICKET;
  const hoy = new Date();
  const ddmmyyyy = `${String(hoy.getDate()).padStart(2, '0')}${String(hoy.getMonth() + 1).padStart(2, '0')}${hoy.getFullYear()}`;

  // La v2 EXIGE la ventana de cambio: sin cambio_desde/cambio_hasta responde
  // 500, y un sondeo sin ellos reportaría a Mercado Público como caído cuando
  // no lo está (verificado el 2026-07-29: sin params 500, con params 200).
  const hasta = new Date().toISOString().slice(0, 19);
  const desde = new Date(Date.now() - 26 * 3600_000).toISOString().slice(0, 19);

  const [mpV1, mpV2, sync, gwHealth, gwAgil, gwLic] = await Promise.all([
    probe(`https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?fecha=${ddmmyyyy}&estado=publicada&ticket=${ticket}`,
      { parse: (j) => `${j.Cantidad ?? '?'} publicadas hoy` }),
    probe(`https://api2.mercadopublico.cl/v2/compra-agil?tamano_pagina=10&cambio_desde=${desde}&cambio_hasta=${hasta}`,
      {
        headers: { ticket },
        // La v2 envuelve el payload; se buscan las dos formas conocidas antes
        // de rendirse, para no mostrar "?" cuando el dato sí vino.
        parse: (j) => {
          const p = j?.paginacion ?? j?.data?.paginacion;
          const items = j?.items ?? j?.data?.items;
          const n = p?.total_resultados ?? p?.total ?? items?.length;
          return `${n ?? '?'} cambiadas en 26h`;
        },
      }),
    probe(`${MP_SYNC}/`, { parse: (j) => j.service ?? '' }),
    probe(`${GATEWAY}/mercado-publico/health`, {
      headers: { Authorization: 'Bearer demo_public_key' },
      parse: (j) => `${num(j?.data?.registros)} registros · ${j?.data?.status ?? '?'}`,
    }),
    probe(`${GATEWAY}/mercado-publico/compra-agil?page_size=1`, {
      headers: { Authorization: 'Bearer demo_public_key' },
      parse: (j) => `${num(j?.meta?.total)} · ${j?.meta?.source ?? '?'}`,
    }),
    probe(`${GATEWAY}/mercado-publico/licitaciones?page_size=1`, {
      headers: { Authorization: 'Bearer demo_public_key' },
      parse: (j) => `${num(j?.meta?.total)} · ${j?.meta?.source ?? '?'}`,
    }),
  ]);
  return { mpV1, mpV2, sync, gwHealth, gwAgil, gwLic };
}

async function readDbs() {
  const lic = open(env.LICITUS_DATABASE_URL);
  const bra = open(env.BRALIDUS_DATABASE_URL);
  await Promise.all([lic.connect(), bra.connect()]);
  try {
    const jobs = await lic.query(`
      SELECT DISTINCT ON (job_name)
             job_name, status, started_at, finished_at,
             total_found, total_succeeded, total_failed, error_codes
        FROM sync_logs ORDER BY job_name, started_at DESC`);
    const active = await lic.query(`
      SELECT job_key, stats, logs, updated_at FROM job_progress
       WHERE is_running = true AND job_key <> 'buyer-profiles'
       ORDER BY updated_at DESC LIMIT 1`);
    const vol = await lic.query(`
      SELECT (SELECT count(*) FROM opportunities)::int AS opps,
             (SELECT count(*) FROM opportunities WHERE source_type='compra_agil')::int AS cot,
             (SELECT count(*) FROM purchase_orders)::int AS ocs,
             (SELECT max(published_at)::date FROM opportunities) AS ult_pub,
             (SELECT max(issued_at)::date FROM purchase_orders) AS ult_oc,
             (SELECT count(*) FROM opportunities WHERE updated_at > now() - interval '15 minutes')::int AS mov15,
             (SELECT count(*) FROM purchase_orders WHERE updated_at > now() - interval '15 minutes')::int AS movoc`);
    const canon = await bra.query(`
      SELECT count(*)::int AS n, max(updated_at) AS ult FROM licitaciones_mercado_publico`);
    return { jobs: jobs.rows, active: active.rows[0] ?? null, vol: vol.rows[0], canon: canon.rows[0] };
  } finally {
    await Promise.allSettled([lic.end(), bra.end()]);
  }
}

const SEPARADOR = '─'.repeat(78);

function eslabon(nombre, p, detalle = '') {
  if (!p) return `  ${dot(C.gray)} ${nombre.padEnd(30)} ${C.gray}omitido${C.reset}`;
  const col = p.ok ? C.green : C.red;
  const estado = p.ok ? 'OK' : p.status ? `HTTP ${p.status}` : String(p.extra ?? 'caído');
  const info = p.ok && p.extra ? `${C.gray}${p.extra}${C.reset}` : detalle;
  return `  ${dot(col)} ${nombre.padEnd(30)} ${String(estado).padEnd(10)} ${C.gray}${String(p.ms).padStart(5)}ms${C.reset}  ${info}`;
}

function render({ jobs, active, vol, canon }, chain) {
  const o = [];
  o.push(`${C.bold}${C.white}CADENA MERCADO PÚBLICO${C.reset}  ${C.gray}${new Date().toLocaleTimeString('es-CL')}${C.reset}`);
  o.push(SEPARADOR);

  if (chain) {
    o.push(`${C.bold}ORIGEN${C.reset}  ${C.gray}(APIs de Mercado Público)${C.reset}`);
    o.push(eslabon('API v1 licitaciones', chain.mpV1));
    o.push(eslabon('API v2 compra ágil', chain.mpV2));
    o.push('');
    o.push(`${C.bold}INGESTA${C.reset}`);
    o.push(eslabon('mp-sync (Vercel)', chain.sync));
  }

  o.push('');
  o.push(`${C.bold}JOBS${C.reset}`);
  for (const j of jobs.sort((a, b) => a.job_name.localeCompare(b.job_name))) {
    const col = STATUS_COLOR[j.status] ?? C.gray;
    const when = j.status === 'running' ? ago(j.started_at) : ago(j.finished_at ?? j.started_at);
    const res = j.status === 'running'
      ? `${C.cyan}corriendo${C.reset}`
      : `ok=${num(j.total_succeeded)} fail=${num(j.total_failed)} ${C.gray}${dur(j.started_at, j.finished_at)}${C.reset}`;
    o.push(`  ${dot(col)} ${j.job_name.padEnd(28)} ${String(j.status).padEnd(9)} ${res}  ${C.gray}${when}${C.reset}`);
    if (j.error_codes?.length) o.push(`      ${C.red}${j.error_codes.join(', ')}${C.reset}`);
  }

  if (active) {
    const s = active.stats ?? {};
    o.push('');
    o.push(`${C.bold}EN CURSO${C.reset}  ${C.cyan}${active.job_key}${C.reset}  ${C.gray}latido ${ago(active.updated_at)}${C.reset}`);
    if (s.currentDate) {
      o.push(`  ${C.gray}fecha ${s.currentDate} (${s.currentDateIndex ?? '?'}/${s.totalDates ?? '?'})  encontradas ${num(s.totalFound)}${C.reset}`);
    }
    for (const l of (active.logs ?? []).slice(-5)) o.push(`  ${C.gray}${l}${C.reset}`);
  }

  const desfase = vol.opps - canon.n;
  const desfaseTxt = desfase === 0
    ? `${C.green}0 — en paridad${C.reset}`
    : `${C.yellow}${desfase > 0 ? '+' : ''}${desfase}${C.reset}`;
  const pub = iso(vol.ult_pub);
  const atraso = vol.ult_pub ? Math.round((new Date(iso(new Date())) - new Date(pub)) / 86400000) : null;
  const pubCol = atraso != null && atraso <= 1 ? C.green : C.yellow;

  o.push('');
  o.push(`${C.bold}ALMACENAMIENTO${C.reset}  ${C.gray}(dual-write)${C.reset}`);
  o.push(`  Licitus · oportunidades   ${num(vol.opps).padStart(9)}   ${C.gray}COT: ${num(vol.cot)}${C.reset}`);
  o.push(`  Licitus · órdenes compra  ${num(vol.ocs).padStart(9)}   ${C.gray}última ${iso(vol.ult_oc)}${C.reset}`);
  o.push(`  Bralidus · canónica       ${num(canon.n).padStart(9)}   desfase ${desfaseTxt}`);
  o.push(`  Última publicación        ${pubCol}${pub.padStart(9)}${C.reset}   ${C.gray}${atraso != null ? `${atraso} día(s) de atraso` : ''}${C.reset}`);
  o.push(`  Movimiento 15 min         ${num(vol.mov15).padStart(9)}   ${C.gray}OCs: ${num(vol.movoc)}${C.reset}`);

  if (chain) {
    o.push('');
    o.push(`${C.bold}SALIDA${C.reset}  ${C.gray}(api-v1 — lo que ve el integrador)${C.reset}`);
    o.push(eslabon('/mercado-publico/health', chain.gwHealth));
    o.push(eslabon('/mercado-publico/compra-agil', chain.gwAgil));
    o.push(eslabon('/mercado-publico/licitaciones', chain.gwLic));
  }
  return o.join('\n');
}

async function tick() {
  try {
    const [db, chain] = await Promise.all([readDbs(), probeChain()]);
    if (!ONCE) process.stdout.write('\x1b[2J\x1b[H');
    console.log(render(db, chain));
    if (!ONCE) console.log(`\n${C.gray}refresca cada ${EVERY_S}s — Ctrl+C para salir${C.reset}`);
  } catch (err) {
    console.error(`${C.red}error:${C.reset} ${err.message}`);
  }
}

await tick();
if (!ONCE) setInterval(tick, EVERY_S * 1000);
