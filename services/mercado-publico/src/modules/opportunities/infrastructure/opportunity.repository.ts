import {
  query,
  queryOne,
  withTransaction,
} from '../../../infrastructure/database/client/pg-client';
import type {
  Opportunity,
  OpportunityItem,
  OpportunityWithItems,
} from '../../../shared/types/domain.types';
import type { NormalizedLicitacion } from '../../../infrastructure/mercado-publico/mercado-publico.types';
import { resolveArea } from '../../matching/domain/area-profiles';
import { SQL, buildInsertOpportunityItems } from './opportunity-sql';
import { mapRowToOpportunity, mapRowToOpportunityItem } from './opportunity.mapper';
import { buildPaginatedResult, getPaginationOffset } from '../../../shared/utils/pagination';
import type { PaginatedResult } from '../../../shared/types/common.types';

export type RefreshCandidate = {
  id: string;
  externalCode: string;
  statusCode: string | null;
  closingAt: string | null;
  priority: number;
};

export type OpportunityFilters = {
  q?: string;
  region?: string;
  tenderType?: string;
  tenderTypes?: string[]; // multi-value (OR)
  area?: string; // obras | servicios | bienes | desconocida
  minAmount?: number;
  maxAmount?: number;
  status?: string;
  closingBefore?: string;
  closingAfter?: string;
  sourceType?: string;
  diasCierreMax?: number; // days_to_close <= N
  soloConMonto?: boolean; // amount_is_public = true
  /** users.id del que consulta: ve todas las de MP + SOLO sus privadas. */
  viewerUserId?: string;
  page: number;
  limit: number;
};

export class OpportunityRepository {
  async upsertFromNormalized(data: NormalizedLicitacion): Promise<OpportunityWithItems> {
    const area = resolveArea(data.title, data.items);
    return withTransaction(async (client) => {
      const row = await client.query(SQL.INSERT_OPPORTUNITY, [
        data.externalCode,
        data.sourceType,
        data.title,
        data.description,
        data.statusCode,
        data.statusLabel,
        data.tenderTypeCode,
        data.tenderPublicTypeCode,
        data.buyerOrgCode,
        data.buyerOrgName,
        data.buyerUnitCode,
        data.buyerUnitName,
        data.buyerRegion,
        data.buyerCommune,
        data.publishedAt,
        data.closingAt,
        data.estimatedAwardAt,
        data.currency,
        data.estimatedAmount,
        data.amountIsPublic,
        data.paymentModalityCode,
        data.contractDurationValue,
        data.contractDurationLabel,
        data.allowsSubcontracting,
        data.daysToClose,
        data.complaintsCount,
        data.isRenewable,
        data.awardActUrl,
        data.amountIsPublic,
        JSON.stringify(data.rawPayloadJson),
        JSON.stringify(data.normalizedPayloadJson),
        area,
        data.siteVisitAt,
        data.requiresContraloria,
      ]);

      const opportunity = mapRowToOpportunity(row.rows[0] as Record<string, unknown>);

      // Re-insert items (delete + insert on upsert)
      await client.query(SQL.DELETE_OPPORTUNITY_ITEMS, [opportunity.id]);

      // INSERT multi-row en un solo round-trip (antes: un INSERT por item = N+1).
      let itemRows: OpportunityItem[] = [];
      if (data.items.length > 0) {
        const params = data.items.flatMap((item) => [
          opportunity.id,
          item.lineNumber,
          item.productCode,
          item.categoryCode,
          item.categoryName,
          item.productName,
          item.description,
          item.unitMeasure,
          item.quantity,
        ]);
        const inserted = await client.query(buildInsertOpportunityItems(data.items.length), params);
        // RETURNING * preserva el orden de la lista VALUES en un único INSERT.
        itemRows = inserted.rows.map((r) => mapRowToOpportunityItem(r as Record<string, unknown>));
      }

      return { ...opportunity, items: itemRows };
    });
  }

  async findById(id: string): Promise<Opportunity | null> {
    const row = await queryOne<Record<string, unknown>>(SQL.FIND_BY_ID, [id]);
    return row ? mapRowToOpportunity(row) : null;
  }

  async findByExternalCode(externalCode: string): Promise<Opportunity | null> {
    const row = await queryOne<Record<string, unknown>>(SQL.FIND_BY_EXTERNAL_CODE, [externalCode]);
    return row ? mapRowToOpportunity(row) : null;
  }

  async findItemsByOpportunityId(opportunityId: string): Promise<OpportunityItem[]> {
    const rows = await query<Record<string, unknown>>(SQL.FIND_ITEMS_BY_OPPORTUNITY_ID, [
      opportunityId,
    ]);
    return rows.map(mapRowToOpportunityItem);
  }

  async findByIds(ids: string[]): Promise<Opportunity[]> {
    if (ids.length === 0) return [];
    const rows = await query<Record<string, unknown>>(SQL.FIND_BY_IDS, [ids]);
    return rows.map(mapRowToOpportunity);
  }

  /** Items de varias oportunidades en una sola query, agrupados por opportunity_id. */
  async findItemsByOpportunityIds(ids: string[]): Promise<Map<string, OpportunityItem[]>> {
    const grouped = new Map<string, OpportunityItem[]>();
    if (ids.length === 0) return grouped;

    const rows = await query<Record<string, unknown>>(SQL.FIND_ITEMS_BY_OPPORTUNITY_IDS, [ids]);
    for (const row of rows) {
      const item = mapRowToOpportunityItem(row);
      const list = grouped.get(item.opportunityId);
      if (list) {
        list.push(item);
      } else {
        grouped.set(item.opportunityId, [item]);
      }
    }
    return grouped;
  }

  /** Candidatos para el refresh dirigido, ordenados por prioridad. */
  async findRefreshCandidates(limit: number): Promise<RefreshCandidate[]> {
    const rows = await query<Record<string, unknown>>(SQL.FIND_REFRESH_CANDIDATES, [limit]);
    return rows.map((row) => ({
      id: row['id'] as string,
      externalCode: row['external_code'] as string,
      statusCode: (row['status_code'] as string) ?? null,
      closingAt: row['closing_at'] ? new Date(row['closing_at'] as string).toISOString() : null,
      priority: Number(row['priority']),
    }));
  }

  /** Usuarios que guardaron la oportunidad o la tienen en su pipeline. */
  async findInterestedUserIds(opportunityId: string): Promise<string[]> {
    const rows = await query<{ user_id: string }>(SQL.FIND_INTERESTED_USER_IDS, [opportunityId]);
    return rows.map((r) => r.user_id);
  }

  /** Alta de licitación privada (Etapa 2): columnas mínimas, sin payload MP. */
  async insertPrivate(input: {
    externalCode: string;
    createdBy: string;
    title: string;
    description: string | null;
    buyerOrgName: string | null;
    buyerRegion: string | null;
    closingAt: string | null;
    currency: string | null;
    estimatedAmount: number | null;
  }): Promise<Opportunity> {
    const area = resolveArea(input.title, []);
    const row = await queryOne<Record<string, unknown>>(
      `INSERT INTO opportunities
         (external_code, source_type, created_by, title, description, status_code,
          status_label, buyer_org_name, buyer_region, published_at, closing_at,
          currency, estimated_amount, amount_is_public, area)
       VALUES ($1, 'private', $2, $3, $4, 'private_open', 'Privada — abierta',
               $5, $6, NOW(), $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        input.externalCode,
        input.createdBy,
        input.title,
        input.description,
        input.buyerOrgName,
        input.buyerRegion,
        input.closingAt,
        input.currency,
        input.estimatedAmount,
        input.estimatedAmount != null,
        area,
      ],
    );
    if (!row) throw new Error('Failed to insert private opportunity');
    return mapRowToOpportunity(row);
  }

  async findAllPaginated(filters: OpportunityFilters): Promise<PaginatedResult<Opportunity>> {
    const { whereClauses, params } = buildFilterQuery(filters);
    const offset = getPaginationOffset(filters.page, filters.limit);

    const countSql = `SELECT COUNT(*) as total FROM opportunities WHERE 1=1 ${whereClauses}`;
    const dataSql = `
      SELECT * FROM opportunities
      WHERE 1=1 ${whereClauses}
      ORDER BY closing_at ASC NULLS LAST, published_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const [countRows, dataRows] = await Promise.all([
      query<{ total: string }>(countSql, params),
      query<Record<string, unknown>>(dataSql, [...params, filters.limit, offset]),
    ]);

    const total = parseInt(countRows[0]?.total ?? '0', 10);
    const data = dataRows.map(mapRowToOpportunity);

    return buildPaginatedResult(data, total, filters.page, filters.limit);
  }
}

// ── Filter builder (exportado para testear la cláusula de visibilidad) ──────

export function buildFilterQuery(filters: OpportunityFilters): {
  whereClauses: string;
  params: unknown[];
} {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  // Visibilidad: las privadas solo las ve su creador. SIEMPRE activo — sin
  // viewerUserId (p.ej. contexto sin usuario) las privadas quedan fuera.
  if (filters.viewerUserId) {
    clauses.push(`(source_type <> 'private' OR created_by = $${idx++})`);
    params.push(filters.viewerUserId);
  } else {
    clauses.push(`source_type <> 'private'`);
  }

  if (filters.q) {
    clauses.push(
      `to_tsvector('spanish', coalesce(title,'') || ' ' || coalesce(description,'')) @@ plainto_tsquery('spanish', $${idx++})`,
    );
    params.push(filters.q);
  }

  if (filters.region) {
    clauses.push(`buyer_region ILIKE $${idx++}`);
    params.push(`%${filters.region}%`);
  }

  if (filters.tenderType) {
    clauses.push(`tender_type_code = $${idx++}`);
    params.push(filters.tenderType);
  }

  if (filters.tenderTypes && filters.tenderTypes.length > 0) {
    const placeholders = filters.tenderTypes.map(() => `$${idx++}`).join(', ');
    clauses.push(`tender_type_code IN (${placeholders})`);
    params.push(...filters.tenderTypes);
  }

  if (filters.area) {
    clauses.push(`area = $${idx++}`);
    params.push(filters.area);
  }

  if (filters.status) {
    clauses.push(`status_code = $${idx++}`);
    params.push(filters.status);
  }

  if (filters.sourceType) {
    clauses.push(`source_type = $${idx++}`);
    params.push(filters.sourceType);
  }

  if (filters.minAmount !== undefined) {
    clauses.push(`estimated_amount >= $${idx++}`);
    params.push(filters.minAmount);
  }

  if (filters.maxAmount !== undefined) {
    clauses.push(`estimated_amount <= $${idx++}`);
    params.push(filters.maxAmount);
  }

  if (filters.closingBefore) {
    clauses.push(`closing_at <= $${idx++}`);
    params.push(filters.closingBefore);
  }

  if (filters.closingAfter) {
    clauses.push(`closing_at >= $${idx++}`);
    params.push(filters.closingAfter);
  }

  if (filters.diasCierreMax !== undefined) {
    clauses.push(`days_to_close <= $${idx++}`);
    params.push(filters.diasCierreMax);
  }

  if (filters.soloConMonto === true) {
    clauses.push(`amount_is_public = TRUE`);
  }

  const whereClauses = clauses.length > 0 ? 'AND ' + clauses.join(' AND ') : '';
  return { whereClauses, params };
}

export const opportunityRepository = new OpportunityRepository();
