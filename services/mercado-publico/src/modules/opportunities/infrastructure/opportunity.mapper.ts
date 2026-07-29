import type { Opportunity, OpportunityItem } from '../../../shared/types/domain.types';

// Maps snake_case DB rows to camelCase domain types
// Explicit mapping - no magic, no ORM

export function mapRowToOpportunity(row: Record<string, unknown>): Opportunity {
  return {
    id: row['id'] as string,
    externalCode: row['external_code'] as string,
    sourceType: row['source_type'] as string,
    createdBy: (row['created_by'] as string) ?? null,
    title: row['title'] as string,
    description: (row['description'] as string) ?? null,
    statusCode: (row['status_code'] as string) ?? null,
    statusLabel: (row['status_label'] as string) ?? null,
    tenderTypeCode: (row['tender_type_code'] as string) ?? null,
    tenderTypeLabel: (row['tender_type_label'] as string) ?? null,
    area: (row['area'] as Opportunity['area']) ?? null,
    buyerOrgCode: (row['buyer_org_code'] as string) ?? null,
    buyerOrgName: (row['buyer_org_name'] as string) ?? null,
    buyerUnitCode: (row['buyer_unit_code'] as string) ?? null,
    buyerUnitName: (row['buyer_unit_name'] as string) ?? null,
    buyerRegion: (row['buyer_region'] as string) ?? null,
    buyerCommune: (row['buyer_commune'] as string) ?? null,
    publishedAt: row['published_at'] ? new Date(row['published_at'] as string).toISOString() : null,
    closingAt: row['closing_at'] ? new Date(row['closing_at'] as string).toISOString() : null,
    estimatedAwardAt: row['estimated_award_at']
      ? new Date(row['estimated_award_at'] as string).toISOString()
      : null,
    currency: (row['currency'] as string) ?? null,
    estimatedAmount: row['estimated_amount'] != null ? Number(row['estimated_amount']) : null,
    amountVisibility: (row['amount_visibility'] as string) ?? null,
    paymentModalityCode: (row['payment_modality_code'] as string) ?? null,
    contractDurationValue:
      row['contract_duration_value'] != null ? Number(row['contract_duration_value']) : null,
    contractDurationLabel: (row['contract_duration_label'] as string) ?? null,
    allowsSubcontracting: (row['allows_subcontracting'] as boolean) ?? null,
    daysToClose: row['days_to_close'] != null ? Number(row['days_to_close']) : null,
    complaintsCount: row['complaints_count'] != null ? Number(row['complaints_count']) : null,
    isRenewable: (row['is_renewable'] as boolean) ?? null,
    awardActUrl: (row['award_act_url'] as string) ?? null,
    amountIsPublic: (row['amount_is_public'] as boolean) ?? null,
    siteVisitAt: row['site_visit_at']
      ? new Date(row['site_visit_at'] as string).toISOString()
      : null,
    requiresContraloria: (row['requires_contraloria'] as boolean) ?? null,
    rawPayloadJson: (row['raw_payload_json'] as Record<string, unknown>) ?? null,
    normalizedPayloadJson: (row['normalized_payload_json'] as Record<string, unknown>) ?? null,
    createdAt: new Date(row['created_at'] as string).toISOString(),
    updatedAt: new Date(row['updated_at'] as string).toISOString(),
  };
}

export function mapRowToOpportunityItem(row: Record<string, unknown>): OpportunityItem {
  return {
    id: row['id'] as string,
    opportunityId: row['opportunity_id'] as string,
    lineNumber: row['line_number'] != null ? Number(row['line_number']) : null,
    productCode: (row['product_code'] as string) ?? null,
    categoryCode: (row['category_code'] as string) ?? null,
    categoryName: (row['category_name'] as string) ?? null,
    productName: (row['product_name'] as string) ?? null,
    description: (row['description'] as string) ?? null,
    unitMeasure: (row['unit_measure'] as string) ?? null,
    quantity: row['quantity'] != null ? Number(row['quantity']) : null,
    createdAt: new Date(row['created_at'] as string).toISOString(),
  };
}
