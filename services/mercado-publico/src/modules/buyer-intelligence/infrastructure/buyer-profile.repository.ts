import { query, queryOne } from '../../../infrastructure/database/client/pg-client.js';

// ── Types ─────────────────────────────────────────────────────

export interface BuyerProfile {
  id: string;
  orgCode: string;
  orgName: string;
  region: string | null;
  entityType: string | null;
  totalLicitaciones: number;
  totalOrders: number;
  totalDesiertas: number;
  avgAmountClp: number | null;
  medianAmountClp: number | null;
  avgDaysToAward: number | null;
  awardRatePct: number | null;
  repeatSupplierRatePct: number | null;
  topCategories: string[];
  topSupplierNames: string[];
  analyzedFrom: string | null;
  analyzedTo: string | null;
  lastComputedAt: string | null;
}

export interface UpsertBuyerProfileInput {
  orgCode: string;
  orgName: string;
  region?: string | null;
  entityType?: string | null;
  totalLicitaciones: number;
  totalOrders: number;
  totalDesiertas: number;
  avgAmountClp: number | null;
  medianAmountClp: number | null;
  avgDaysToAward: number | null;
  awardRatePct: number | null;
  repeatSupplierRatePct: number | null;
  topCategories: string[];
  topSupplierNames: string[];
  analyzedFrom: string;
  analyzedTo: string;
}

function mapRow(r: Record<string, unknown>): BuyerProfile {
  return {
    id: r['id'] as string,
    orgCode: r['org_code'] as string,
    orgName: r['org_name'] as string,
    region: (r['region'] as string) ?? null,
    entityType: (r['entity_type'] as string) ?? null,
    totalLicitaciones: Number(r['total_licitaciones'] ?? 0),
    totalOrders: Number(r['total_orders'] ?? 0),
    totalDesiertas: Number(r['total_desiertas'] ?? 0),
    avgAmountClp: r['avg_amount_clp'] != null ? Number(r['avg_amount_clp']) : null,
    medianAmountClp: r['median_amount_clp'] != null ? Number(r['median_amount_clp']) : null,
    avgDaysToAward: r['avg_days_to_award'] != null ? Number(r['avg_days_to_award']) : null,
    awardRatePct: r['award_rate_pct'] != null ? Number(r['award_rate_pct']) : null,
    repeatSupplierRatePct:
      r['repeat_supplier_rate_pct'] != null ? Number(r['repeat_supplier_rate_pct']) : null,
    topCategories: (r['top_categories'] as string[]) ?? [],
    topSupplierNames: (r['top_supplier_names'] as string[]) ?? [],
    analyzedFrom: (r['analyzed_from'] as string) ?? null,
    analyzedTo: (r['analyzed_to'] as string) ?? null,
    lastComputedAt: (r['last_computed_at'] as string) ?? null,
  };
}

class BuyerProfileRepository {
  async upsert(input: UpsertBuyerProfileInput): Promise<void> {
    await query(
      `INSERT INTO buyer_profiles (
         org_code, org_name, region, entity_type,
         total_licitaciones, total_orders, total_desiertas,
         avg_amount_clp, median_amount_clp, avg_days_to_award,
         award_rate_pct, repeat_supplier_rate_pct,
         top_categories, top_supplier_names,
         analyzed_from, analyzed_to, last_computed_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),NOW())
       ON CONFLICT (org_code) DO UPDATE SET
         org_name                = EXCLUDED.org_name,
         total_licitaciones      = EXCLUDED.total_licitaciones,
         total_orders            = EXCLUDED.total_orders,
         total_desiertas         = EXCLUDED.total_desiertas,
         avg_amount_clp          = EXCLUDED.avg_amount_clp,
         median_amount_clp       = EXCLUDED.median_amount_clp,
         avg_days_to_award       = EXCLUDED.avg_days_to_award,
         award_rate_pct          = EXCLUDED.award_rate_pct,
         repeat_supplier_rate_pct= EXCLUDED.repeat_supplier_rate_pct,
         top_categories          = EXCLUDED.top_categories,
         top_supplier_names      = EXCLUDED.top_supplier_names,
         analyzed_from           = EXCLUDED.analyzed_from,
         analyzed_to             = EXCLUDED.analyzed_to,
         last_computed_at        = NOW(),
         updated_at              = NOW()`,
      [
        input.orgCode,
        input.orgName,
        input.region ?? null,
        input.entityType ?? null,
        input.totalLicitaciones,
        input.totalOrders,
        input.totalDesiertas,
        input.avgAmountClp,
        input.medianAmountClp,
        input.avgDaysToAward,
        input.awardRatePct,
        input.repeatSupplierRatePct,
        input.topCategories,
        input.topSupplierNames,
        input.analyzedFrom,
        input.analyzedTo,
      ],
    );
  }

  async findByOrgCode(orgCode: string): Promise<BuyerProfile | null> {
    const row = await queryOne<Record<string, unknown>>(
      'SELECT * FROM buyer_profiles WHERE org_code = $1',
      [orgCode],
    );
    return row ? mapRow(row) : null;
  }

  async upsertWinningSupplier(
    orgCode: string,
    supplierCode: string,
    supplierName: string,
    amountClp: number,
    categories: string[],
    lastWinDate: string,
  ): Promise<void> {
    await query(
      `INSERT INTO buyer_winning_suppliers
         (org_code, supplier_code, supplier_name, win_count, total_amount_clp, last_win_date, categories)
       VALUES ($1, $2, $3, 1, $4, $5, $6)
       ON CONFLICT (org_code, supplier_code) DO UPDATE SET
         win_count        = buyer_winning_suppliers.win_count + 1,
         total_amount_clp = buyer_winning_suppliers.total_amount_clp + EXCLUDED.total_amount_clp,
         last_win_date    = GREATEST(buyer_winning_suppliers.last_win_date, EXCLUDED.last_win_date),
         categories       = EXCLUDED.categories,
         updated_at       = NOW()`,
      [orgCode, supplierCode, supplierName, amountClp, lastWinDate, categories],
    );
  }

  // ── Context cache ─────────────────────────────────────────

  async getCachedContext(orgCode: string): Promise<string | null> {
    const row = await queryOne<{ context_text: string; expires_at: string }>(
      `SELECT context_text, expires_at FROM buyer_context_cache
       WHERE org_code = $1 AND expires_at > NOW()`,
      [orgCode],
    );
    return row?.context_text ?? null;
  }

  async setCachedContext(
    orgCode: string,
    contextText: string,
    rawStats: Record<string, unknown>,
    ttlDays = 7,
  ): Promise<void> {
    await query(
      `INSERT INTO buyer_context_cache (org_code, context_text, raw_stats, expires_at)
       VALUES ($1, $2, $3, NOW() + ($4 || ' days')::interval)
       ON CONFLICT (org_code) DO UPDATE SET
         context_text = EXCLUDED.context_text,
         raw_stats    = EXCLUDED.raw_stats,
         expires_at   = EXCLUDED.expires_at,
         created_at   = NOW()`,
      [orgCode, contextText, JSON.stringify(rawStats), String(ttlDays)],
    );
  }
}

export const buyerProfileRepository = new BuyerProfileRepository();
