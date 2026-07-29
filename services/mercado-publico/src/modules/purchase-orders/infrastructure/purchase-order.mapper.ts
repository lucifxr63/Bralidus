import type { PurchaseOrder, PurchaseOrderItem } from '../../../shared/types/domain.types';

export function mapRowToPurchaseOrder(row: Record<string, unknown>): PurchaseOrder {
  return {
    id: row['id'] as string,
    externalCode: row['external_code'] as string,
    licitationCode: (row['licitation_code'] as string) ?? null,
    orderTypeCode: (row['order_type_code'] as string) ?? null,
    orderTypeLabel: (row['order_type_label'] as string) ?? null,
    stateCode: (row['state_code'] as string) ?? null,
    supplierStateLabel: (row['supplier_state_label'] as string) ?? null,
    buyerOrgCode: (row['buyer_org_code'] as string) ?? null,
    buyerOrgName: (row['buyer_org_name'] as string) ?? null,
    supplierCode: (row['supplier_code'] as string) ?? null,
    supplierName: (row['supplier_name'] as string) ?? null,
    totalNet: row['total_net'] != null ? Number(row['total_net']) : null,
    taxes: row['taxes'] != null ? Number(row['taxes']) : null,
    total: row['total'] != null ? Number(row['total']) : null,
    currency: (row['currency'] as string) ?? null,
    supplierRating: row['supplier_rating'] != null ? Number(row['supplier_rating']) : null,
    supplierRatingCount:
      row['supplier_rating_count'] != null ? Number(row['supplier_rating_count']) : null,
    issuedAt: row['issued_at'] ? new Date(row['issued_at'] as string).toISOString() : null,
    acceptedAt: row['accepted_at'] ? new Date(row['accepted_at'] as string).toISOString() : null,
    rawPayloadJson: (row['raw_payload_json'] as Record<string, unknown>) ?? null,
    normalizedPayloadJson: (row['normalized_payload_json'] as Record<string, unknown>) ?? null,
    createdAt: new Date(row['created_at'] as string).toISOString(),
    updatedAt: new Date(row['updated_at'] as string).toISOString(),
  };
}

export function mapRowToPurchaseOrderItem(row: Record<string, unknown>): PurchaseOrderItem {
  return {
    id: row['id'] as string,
    purchaseOrderId: row['purchase_order_id'] as string,
    lineNumber: row['line_number'] != null ? Number(row['line_number']) : null,
    productCode: (row['product_code'] as string) ?? null,
    categoryCode: (row['category_code'] as string) ?? null,
    categoryName: (row['category_name'] as string) ?? null,
    buyerSpec: (row['buyer_spec'] as string) ?? null,
    supplierSpec: (row['supplier_spec'] as string) ?? null,
    quantity: row['quantity'] != null ? Number(row['quantity']) : null,
    unitNetPrice: row['unit_net_price'] != null ? Number(row['unit_net_price']) : null,
    total: row['total'] != null ? Number(row['total']) : null,
    createdAt: new Date(row['created_at'] as string).toISOString(),
  };
}
