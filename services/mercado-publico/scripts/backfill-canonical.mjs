/**
 * backfill-canonical.mjs — repuebla `licitaciones_mercado_publico` (Bralidus)
 * desde `opportunities` (Licitus).
 *
 * POR QUÉ EXISTE
 * --------------
 * El dual-write de mp-sync escribe en las dos bases a medida que ingesta. Pero
 * la tabla canónica quedó vacía: el 2026-07-28 un `DELETE ... WHERE
 * external_code LIKE $1` borró las 45 filas que tenía (verificado en
 * pg_stat_statements). Licitus, el destino primario, nunca se tocó.
 *
 * Este script NO consulta a Mercado Público: copia lo que Licitus ya tiene
 * validado. Por eso no necesita MERCADO_PUBLICO_TICKET, que hoy es un
 * placeholder en el .env y bloquea cualquier sync incremental.
 *
 * CONTRATO
 * --------
 * La traducción replica exactamente `canonical.mapper.ts` (toCanonicalSourceType
 * / toCanonicalStatus / buildOfficialUrl). Si divergen, un sync posterior de
 * mp-sync sobrescribiría estas filas con valores distintos en cada corrida.
 *
 * Es idempotente: ON CONFLICT (external_code) DO UPDATE. Correrlo dos veces no
 * duplica ni pierde nada.
 *
 * USO
 *   node scripts/backfill-canonical.mjs --dry-run     # no escribe, sólo reporta
 *   node scripts/backfill-canonical.mjs               # ejecuta
 *   node scripts/backfill-canonical.mjs --limit 500   # acota (pruebas)
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT_ARG = args.indexOf('--limit');
const LIMIT = LIMIT_ARG >= 0 ? Number(args[LIMIT_ARG + 1]) : null;
const PAGE_SIZE = 1000;
const WRITE_BATCH = 250;

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^\s*[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

// ── Traducción: espejo de canonical.mapper.ts ────────────────────────────────

/** `tenderPublicTypeCode` del normalizador = `CodigoTipo` del payload crudo de MP. */
function publicTypeCode(raw) {
  const v = raw?.CodigoTipo;
  return v == null ? null : Number(v);
}

function toCanonicalSourceType(row) {
  const tipo = row.tender_type_code;
  if (row.source_type === 'compra_agil' || tipo === 'COT') return 'agile_purchase';
  if (tipo === 'CO') return 'convenio_marco';
  if (tipo === 'E2') return 'trato_directo';
  // B2 y el resto comparten regla: privada si CodigoTipo === 2.
  return publicTypeCode(row.raw_payload_json) === 2 ? 'private_tender' : 'tender';
}

/**
 * Licitus guarda el código de estado de MP como texto ('5', '8', ...).
 * Mapeo con pérdida conocida: 18 (Suspendida) → 'cerrada'; el CHECK del destino
 * no la contempla y el estado real se conserva en raw_payload.
 */
function toCanonicalStatus(code) {
  switch (String(code)) {
    case '5': return 'publicada';
    case '6': return 'cerrada';
    case '7': return 'desierta';
    case '8': return 'adjudicada';
    case '15': return 'revocada';
    case '18': return 'cerrada';
    default: return 'publicada';
  }
}

function buildOfficialUrl(code, sourceType) {
  return sourceType === 'agile_purchase'
    ? `https://compra-agil.mercadopublico.cl/resumen-cotizacion/${encodeURIComponent(code)}`
    : `https://www.mercadopublico.cl/Procurement/Modules/RFBA/Details.aspx?code=${encodeURIComponent(code)}`;
}

const COLUMNS = [
  'external_code', 'title', 'buyer_name', 'buyer_rut', 'buyer_org_code',
  'source_type', 'status_code', 'amount_estimated', 'currency',
  'published_at', 'closing_at', 'award_at', 'category', 'official_url',
  'attachments', 'items', 'raw_payload',
];

function toCanonicalRow(row) {
  const sourceType = toCanonicalSourceType(row);
  return [
    row.external_code,
    row.title,
    row.buyer_org_name ?? row.buyer_unit_name ?? 'Organismo no informado',
    null,                                   // buyer_rut: MP no lo expone acá
    row.buyer_org_code,
    sourceType,
    toCanonicalStatus(row.status_code),
    row.estimated_amount ?? 0,
    row.currency ?? 'CLP',
    row.published_at,
    row.closing_at,
    row.estimated_award_at,
    'Contratación Pública',
    buildOfficialUrl(row.external_code, sourceType),
    '[]',                                   // adjuntos: los baja otro pipeline
    '[]',                                   // items: viven en opportunity_items (Licitus)
    JSON.stringify(row.raw_payload_json ?? {}),
  ];
}

// ── Ejecución ────────────────────────────────────────────────────────────────

const licitus = new pg.Client({
  connectionString: env.LICITUS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 120000,
});
const bralidus = new pg.Client({
  connectionString: env.BRALIDUS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 120000,
});

await licitus.connect();
await bralidus.connect();

const antes = (await bralidus.query('select count(*)::int n from public.licitaciones_mercado_publico')).rows[0].n;
const total = (await licitus.query('select count(*)::int n from public.opportunities')).rows[0].n;
const objetivo = LIMIT ? Math.min(LIMIT, total) : total;

console.log(`Origen  (Licitus.opportunities)              : ${total} filas`);
console.log(`Destino (Bralidus.licitaciones_mercado_publico): ${antes} filas`);
console.log(`A procesar                                    : ${objetivo}${DRY_RUN ? '  [DRY RUN — no escribe]' : ''}\n`);

const stats = { leidas: 0, escritas: 0, fallidas: 0, porTipo: {}, porEstado: {} };

for (let offset = 0; offset < objetivo; offset += PAGE_SIZE) {
  const page = await licitus.query(
    `select external_code, title, buyer_org_name, buyer_unit_name, buyer_org_code,
            source_type, tender_type_code, status_code, estimated_amount, currency,
            published_at, closing_at, estimated_award_at, raw_payload_json
       from public.opportunities
      order by published_at desc, external_code
      limit $1 offset $2`,
    [Math.min(PAGE_SIZE, objetivo - offset), offset],
  );
  if (page.rows.length === 0) break;

  const mapped = page.rows.map(toCanonicalRow);
  stats.leidas += mapped.length;
  for (const r of mapped) {
    stats.porTipo[r[5]] = (stats.porTipo[r[5]] ?? 0) + 1;
    stats.porEstado[r[6]] = (stats.porEstado[r[6]] ?? 0) + 1;
  }

  if (DRY_RUN) {
    process.stdout.write(`\r  leidas ${stats.leidas}/${objetivo}`);
    continue;
  }

  for (let i = 0; i < mapped.length; i += WRITE_BATCH) {
    const batch = mapped.slice(i, i + WRITE_BATCH);
    const values = [];
    const params = [];
    batch.forEach((row, idx) => {
      const base = idx * COLUMNS.length;
      values.push(`(${COLUMNS.map((_, c) => `$${base + c + 1}`).join(', ')})`);
      params.push(...row);
    });
    const updates = COLUMNS.filter((c) => c !== 'external_code')
      .map((c) => `${c} = EXCLUDED.${c}`)
      .join(', ');
    try {
      await bralidus.query(
        `INSERT INTO licitaciones_mercado_publico (${COLUMNS.join(', ')})
         VALUES ${values.join(', ')}
         ON CONFLICT (external_code) DO UPDATE SET ${updates}`,
        params,
      );
      stats.escritas += batch.length;
    } catch (err) {
      stats.fallidas += batch.length;
      console.error(`\n  [lote ${i}] FALLO: ${err.message}`);
      console.error(`     primer código del lote: ${batch[0][0]}`);
    }
  }
  process.stdout.write(`\r  escritas ${stats.escritas}/${objetivo}  fallidas ${stats.fallidas}`);
}

const despues = (await bralidus.query('select count(*)::int n from public.licitaciones_mercado_publico')).rows[0].n;

console.log('\n\n===== RESUMEN =====');
console.log(`Leídas    : ${stats.leidas}`);
console.log(`Escritas  : ${stats.escritas}`);
console.log(`Fallidas  : ${stats.fallidas}`);
console.log(`Destino   : ${antes} -> ${despues} filas`);
console.log('\nPor source_type :', JSON.stringify(stats.porTipo));
console.log('Por status_code :', JSON.stringify(stats.porEstado));

await licitus.end();
await bralidus.end();
