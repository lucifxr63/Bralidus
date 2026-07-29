/**
 * build-buyer-profiles.job.ts
 *
 * Construye perfiles estadísticos por organismo comprador a partir de las
 * órdenes de compra ya ingestadas en purchase_orders.
 *
 * NO hace llamadas adicionales a la API de Mercado Público.
 * Lee directamente desde la DB y produce:
 *   - buyer_profiles: estadísticas por organismo
 *   - buyer_winning_suppliers: proveedores recurrentes por organismo
 *   - buyer_context_cache: texto pre-generado para el prompt LLM
 *
 * Frecuencia recomendada: semanal (domingo 3 AM)
 * Costo LLM: 0 (todo basado en templates)
 */

import { query } from '../infrastructure/database/client/pg-client.js';
import { buyerProfileRepository } from '../modules/buyer-intelligence/infrastructure/buyer-profile.repository.js';
import { buyerProfilesProgress } from './buyer-profiles-progress.store.js';
import { logger } from '../infrastructure/logging/logger.js';

const JOB_NAME = 'build-buyer-profiles';

// ── Tipos internos ─────────────────────────────────────────────

interface OrgStats {
  orgCode: string;
  orgName: string;
  totalOrders: number;
  avgAmountClp: number | null;
  medianAmountClp: number | null;
  topCategories: string[];
}

interface SupplierStats {
  orgCode: string;
  supplierCode: string;
  supplierName: string;
  winCount: number;
  totalAmountClp: number;
  lastWinDate: string;
  categories: string[];
}

// ── Queries SQL ────────────────────────────────────────────────

/**
 * Builds org stats from opportunities table (always available).
 * Uses estimated_amount as a proxy for order size since purchase_orders
 * may be empty. This gives us enough data for buyer intelligence.
 */
async function getOrgStats(windowDays: number): Promise<OrgStats[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT
       o.buyer_org_code                                      AS org_code,
       MAX(o.buyer_org_name)                                 AS org_name,
       COUNT(*)::int                                         AS total_orders,
       AVG(o.estimated_amount)
         FILTER (WHERE o.estimated_amount IS NOT NULL
           AND o.amount_is_public = true)::bigint            AS avg_amount_clp,
       PERCENTILE_CONT(0.5) WITHIN GROUP
         (ORDER BY o.estimated_amount)
         FILTER (WHERE o.estimated_amount IS NOT NULL
           AND o.amount_is_public = true)::bigint            AS median_amount_clp,
       ARRAY_AGG(DISTINCT oi.category_code)
         FILTER (WHERE oi.category_code IS NOT NULL
           AND oi.category_code != '')                       AS top_categories
     FROM opportunities o
     LEFT JOIN opportunity_items oi ON oi.opportunity_id = o.id
     WHERE o.published_at >= NOW() - ($1 || ' days')::interval
       AND o.buyer_org_code IS NOT NULL
     GROUP BY o.buyer_org_code
     HAVING COUNT(*) >= 2`,
    [String(windowDays)],
  );

  return rows.map((r) => ({
    orgCode: r['org_code'] as string,
    orgName: r['org_name'] as string,
    totalOrders: r['total_orders'] as number,
    avgAmountClp: r['avg_amount_clp'] != null ? Number(r['avg_amount_clp']) : null,
    medianAmountClp: r['median_amount_clp'] != null ? Number(r['median_amount_clp']) : null,
    topCategories: (r['top_categories'] as string[] | null) ?? [],
  }));
}

/**
 * Returns empty — purchase_orders not yet populated.
 * Will be filled once OC sync is implemented.
 */
function getSupplierStats(_orgCode: string, _windowDays: number): Promise<SupplierStats[]> {
  return Promise.resolve([]);
}

async function getLicitacionStats(
  orgCode: string,
  windowDays: number,
): Promise<{
  totalLicitaciones: number;
  totalDesiertas: number;
  avgDaysToAward: number | null;
}> {
  const row = await query<Record<string, unknown>>(
    `SELECT
       COUNT(*)::int                         AS total_licitaciones,
       COUNT(*) FILTER (
         WHERE status_code IN ('18', '19') -- 18=desierta, 19=sin adjudicación
       )::int                               AS total_desiertas,
       AVG(
         EXTRACT(EPOCH FROM (estimated_award_at - closing_at)) / 86400
       )::int                               AS avg_days_to_award
     FROM opportunities
     WHERE buyer_org_code = $1
       AND published_at >= NOW() - ($2 || ' days')::interval`,
    [orgCode, String(windowDays)],
  );

  const r = row[0] ?? {};
  return {
    totalLicitaciones: Number(r['total_licitaciones'] ?? 0),
    totalDesiertas: Number(r['total_desiertas'] ?? 0),
    avgDaysToAward: r['avg_days_to_award'] != null ? Number(r['avg_days_to_award']) : null,
  };
}

// ── Context text builder (0 costo LLM) ────────────────────────

function buildContextText(
  orgName: string,
  stats: {
    totalOrders: number;
    avgAmountClp: number | null;
    awardRatePct: number | null;
    repeatSupplierRatePct: number | null;
    avgDaysToAward: number | null;
    topSupplierNames: string[];
    topCategories: string[];
  },
): string {
  const lines: string[] = [`## Historial del organismo: ${orgName}`];

  if (stats.totalOrders > 0) {
    lines.push(`- Órdenes de compra registradas: ${stats.totalOrders}`);
  }

  if (stats.avgAmountClp != null) {
    const millones = (stats.avgAmountClp / 1_000_000).toFixed(1);
    lines.push(`- Monto promedio adjudicado: $${millones}M CLP`);
  }

  if (stats.awardRatePct != null) {
    lines.push(
      `- Tasa de adjudicación: ${stats.awardRatePct.toFixed(0)}% de licitaciones no quedan desiertas`,
    );
  }

  if (stats.avgDaysToAward != null) {
    lines.push(`- Tiempo promedio para adjudicar: ${stats.avgDaysToAward} días desde el cierre`);
  }

  if (stats.repeatSupplierRatePct != null && stats.repeatSupplierRatePct > 50) {
    lines.push(
      `- Comprador recurrente: adjudica al mismo proveedor en el ${stats.repeatSupplierRatePct.toFixed(0)}% de los casos`,
    );
  }

  if (stats.topCategories.length > 0) {
    lines.push(`- Categorías frecuentes: ${stats.topCategories.slice(0, 5).join(', ')}`);
  }

  if (stats.topSupplierNames.length > 0) {
    lines.push(`- Proveedores habituales: ${stats.topSupplierNames.slice(0, 3).join(', ')}`);
  }

  return lines.join('\n');
}

// ── Main job ───────────────────────────────────────────────────

const WINDOW_DAYS = 365; // analizar último año

export async function runBuildBuyerProfilesJob(): Promise<void> {
  await buyerProfilesProgress.start();
  logger.info(`[${JOB_NAME}] Starting`);
  const startedAt = Date.now();

  const orgStats = await getOrgStats(WINDOW_DAYS);
  logger.info({ count: orgStats.length }, `[${JOB_NAME}] Orgs to process`);
  buyerProfilesProgress.log(`📊 ${orgStats.length} organismos encontrados en órdenes de compra`);
  buyerProfilesProgress.updateStats({ totalOrgs: orgStats.length });

  let processed = 0;
  let failed = 0;

  for (const org of orgStats) {
    try {
      // 1. Datos de licitaciones (desde opportunities)
      const licitStats = await getLicitacionStats(org.orgCode, WINDOW_DAYS);

      // 2. Proveedores ganadores
      const suppliers = await getSupplierStats(org.orgCode, WINDOW_DAYS);

      // 3. Calcular repeat_supplier_rate:
      //    % del total de órdenes que fue al proveedor top 1
      const topSupplierWins = suppliers[0]?.winCount ?? 0;
      const repeatSupplierRatePct =
        org.totalOrders > 0 ? Math.round((topSupplierWins / org.totalOrders) * 100) : null;

      // 4. Calcular award_rate_pct desde licitaciones
      const awardRatePct =
        licitStats.totalLicitaciones > 0
          ? Math.round(
              ((licitStats.totalLicitaciones - licitStats.totalDesiertas) /
                licitStats.totalLicitaciones) *
                100,
            )
          : null;

      const topSupplierNames = suppliers.slice(0, 5).map((s) => s.supplierName);

      // 5. Upsert buyer_profile
      await buyerProfileRepository.upsert({
        orgCode: org.orgCode,
        orgName: org.orgName,
        totalLicitaciones: licitStats.totalLicitaciones,
        totalOrders: org.totalOrders,
        totalDesiertas: licitStats.totalDesiertas,
        avgAmountClp: org.avgAmountClp,
        medianAmountClp: org.medianAmountClp,
        avgDaysToAward: licitStats.avgDaysToAward,
        awardRatePct,
        repeatSupplierRatePct: repeatSupplierRatePct != null ? repeatSupplierRatePct : null,
        topCategories: org.topCategories.slice(0, 10),
        topSupplierNames,
        analyzedFrom: new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10),
        analyzedTo: new Date().toISOString().slice(0, 10),
      });

      // 6. Upsert proveedores ganadores
      for (const s of suppliers) {
        await buyerProfileRepository.upsertWinningSupplier(
          s.orgCode,
          s.supplierCode,
          s.supplierName,
          s.totalAmountClp,
          s.categories,
          s.lastWinDate,
        );
      }

      // 7. Generar y cachear contexto para LLM
      const rawStats = {
        totalOrders: org.totalOrders,
        avgAmountClp: org.avgAmountClp,
        awardRatePct,
        repeatSupplierRatePct,
        avgDaysToAward: licitStats.avgDaysToAward,
        topSupplierNames,
        topCategories: org.topCategories,
      };

      const contextText = buildContextText(org.orgName, rawStats);
      await buyerProfileRepository.setCachedContext(org.orgCode, contextText, rawStats);

      processed++;
      buyerProfilesProgress.updateStats({ processed, upserted: processed });
      if (processed % 10 === 0 || processed === orgStats.length) {
        buyerProfilesProgress.log(`  ✓ ${processed}/${orgStats.length} — ${org.orgName}`);
      }
    } catch (err) {
      failed++;
      logger.error({ err, orgCode: org.orgCode }, `[${JOB_NAME}] Failed to process org`);
      buyerProfilesProgress.log(`  ✗ Error en ${org.orgCode}: ${(err as Error).message}`);
    }
  }

  const elapsedMs = Date.now() - startedAt;
  const summary = `${processed} perfiles construidos, ${failed} errores — ${(elapsedMs / 1000).toFixed(1)}s`;
  logger.info({ processed, failed, elapsedMs, total: orgStats.length }, `[${JOB_NAME}] Finished`);
  await buyerProfilesProgress.finish(summary);
}
