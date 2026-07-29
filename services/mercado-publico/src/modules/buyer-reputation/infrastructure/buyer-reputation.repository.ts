import { query, queryOne } from '../../../infrastructure/database/client/pg-client.js';
import type { BuyerReputation } from '../domain/buyer-reputation.types.js';

function mapRow(row: Record<string, unknown>): BuyerReputation {
  return {
    buyerOrgCode: row['buyer_org_code'] as string,
    buyerOrgName: (row['buyer_org_name'] as string) ?? null,
    avgSupplierRating:
      row['avg_supplier_rating'] != null ? Number(row['avg_supplier_rating']) : null,
    totalRatingCount: Number(row['total_rating_count'] ?? 0),
    totalOrdersCount: Number(row['total_orders_count'] ?? 0),
    totalSpentClp: row['total_spent_clp'] != null ? Number(row['total_spent_clp']) : null,
    lastOrderAt: row['last_order_at']
      ? new Date(row['last_order_at'] as string).toISOString()
      : null,
    updatedAt: new Date(row['updated_at'] as string).toISOString(),
  };
}

export class BuyerReputationRepository {
  async findByOrgCode(buyerOrgCode: string): Promise<BuyerReputation | null> {
    const row = await queryOne<Record<string, unknown>>(
      'SELECT * FROM buyer_reputation WHERE buyer_org_code = $1',
      [buyerOrgCode],
    );
    return row ? mapRow(row) : null;
  }

  /**
   * Recalcula la reputación de un organismo agregando desde sus purchase_orders.
   * Llamado en fire-and-forget tras cada ingesta de OC.
   */
  async recalculateFromPurchaseOrders(buyerOrgCode: string): Promise<void> {
    await query(
      `INSERT INTO buyer_reputation (
        buyer_org_code, buyer_org_name,
        avg_supplier_rating, total_rating_count,
        total_orders_count, total_spent_clp, last_order_at, updated_at
      )
      SELECT
        buyer_org_code,
        MAX(buyer_org_name),
        ROUND(AVG(supplier_rating)::NUMERIC, 2)   AS avg_supplier_rating,
        SUM(COALESCE(supplier_rating_count, 0))   AS total_rating_count,
        COUNT(*)                                  AS total_orders_count,
        SUM(CASE WHEN currency = 'CLP' THEN total ELSE 0 END) AS total_spent_clp,
        MAX(issued_at)                            AS last_order_at,
        NOW()
      FROM purchase_orders
      WHERE buyer_org_code = $1
      GROUP BY buyer_org_code
      ON CONFLICT (buyer_org_code) DO UPDATE SET
        buyer_org_name      = EXCLUDED.buyer_org_name,
        avg_supplier_rating = EXCLUDED.avg_supplier_rating,
        total_rating_count  = EXCLUDED.total_rating_count,
        total_orders_count  = EXCLUDED.total_orders_count,
        total_spent_clp     = EXCLUDED.total_spent_clp,
        last_order_at       = EXCLUDED.last_order_at,
        updated_at          = NOW()`,
      [buyerOrgCode],
    );
  }
}

export const buyerReputationRepository = new BuyerReputationRepository();
