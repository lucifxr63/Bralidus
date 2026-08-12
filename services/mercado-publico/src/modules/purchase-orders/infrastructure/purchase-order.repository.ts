import {
  queryOne,
  query,
  withTransaction,
} from '../../../infrastructure/database/client/pg-client';
import type { PurchaseOrder, PurchaseOrderItem } from '../../../shared/types/domain.types';
import type { NormalizedOrdenCompra } from '../../../infrastructure/mercado-publico/mercado-publico.types';
import { mapRowToPurchaseOrder, mapRowToPurchaseOrderItem } from './purchase-order.mapper';

const PURCHASE_ORDER_ITEM_COLUMNS = 10;

/**
 * INSERT multi-row de items de OC en un solo round-trip (reemplaza el loop N+1).
 * Genera `VALUES ($1..$10),($11..$20),...` para `rowCount` filas (> 0). El caller
 * aplana los params en el mismo orden de columnas.
 */
export function buildInsertPurchaseOrderItems(rowCount: number): string {
  const rows: string[] = [];
  for (let r = 0; r < rowCount; r++) {
    const base = r * PURCHASE_ORDER_ITEM_COLUMNS;
    const placeholders = Array.from(
      { length: PURCHASE_ORDER_ITEM_COLUMNS },
      (_, c) => `$${base + c + 1}`,
    );
    rows.push(`(${placeholders.join(',')})`);
  }
  return `INSERT INTO purchase_order_items (
      purchase_order_id, line_number, product_code, category_code, category_name,
      buyer_spec, supplier_spec, quantity, unit_net_price, total
    ) VALUES ${rows.join(',')} RETURNING *`;
}

/**
 * Ventana que separa "OC recién llegada" de "cola histórica".
 *
 * 48 h y no 24: `sync-ordenes` corre una vez al día, así que una OC ingresada
 * justo después de la corrida de ayer todavía tiene que alcanzar a entrar en
 * el carril fresco.
 */
const VENTANA_RECIENTE = '48 hours';

/**
 * Fracción de cada lote reservada a las OCs recién llegadas. El resto drena la
 * cola histórica.
 *
 * Con la capacidad actual (~8.3k enriquecidas/día) y la entrada real (~8.8k/día)
 * NO alcanza para las dos cosas: priorizar lo nuevo necesariamente frena lo
 * viejo. 0,8 es la repartición que mantiene las OCs del día al día y aun así
 * deja ~1.600 diarias mordiendo el backlog, en vez de congelarlo del todo.
 */
const PROPORCION_RECIENTES = 0.8;

export class PurchaseOrderRepository {
  async upsertFromNormalized(
    data: NormalizedOrdenCompra,
  ): Promise<PurchaseOrder & { items: PurchaseOrderItem[] }> {
    return withTransaction(async (client) => {
      const row = await client.query(
        `INSERT INTO purchase_orders (
          external_code, licitation_code, order_type_code, order_type_label,
          state_code, supplier_state_label, buyer_org_code, buyer_org_name,
          supplier_code, supplier_name, total_net, taxes, total, currency,
          supplier_rating, supplier_rating_count,
          issued_at, accepted_at, raw_payload_json, normalized_payload_json
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
        ON CONFLICT (external_code) DO UPDATE SET
          state_code = EXCLUDED.state_code,
          supplier_state_label = EXCLUDED.supplier_state_label,
          supplier_rating = EXCLUDED.supplier_rating,
          supplier_rating_count = EXCLUDED.supplier_rating_count,
          -- Campos de detalle (proveedor/montos/comprador/fechas): el listado los
          -- trae null y el enriquecimiento por detalle los llena. COALESCE evita
          -- que un re-sync desde el listado sobrescriba a null lo ya enriquecido.
          -- issued_at/accepted_at incluidos: sin esto, la fecha del detalle nunca
          -- llegaba a la fila (quedaba NULL para siempre — bug detectado 2026-07-19,
          -- rompía los filtros por período de la API B2B /v1).
          issued_at = COALESCE(EXCLUDED.issued_at, purchase_orders.issued_at),
          accepted_at = COALESCE(EXCLUDED.accepted_at, purchase_orders.accepted_at),
          supplier_code = COALESCE(EXCLUDED.supplier_code, purchase_orders.supplier_code),
          supplier_name = COALESCE(EXCLUDED.supplier_name, purchase_orders.supplier_name),
          total_net = COALESCE(EXCLUDED.total_net, purchase_orders.total_net),
          taxes = COALESCE(EXCLUDED.taxes, purchase_orders.taxes),
          total = COALESCE(EXCLUDED.total, purchase_orders.total),
          currency = COALESCE(EXCLUDED.currency, purchase_orders.currency),
          buyer_org_code = COALESCE(EXCLUDED.buyer_org_code, purchase_orders.buyer_org_code),
          buyer_org_name = COALESCE(EXCLUDED.buyer_org_name, purchase_orders.buyer_org_name),
          licitation_code = COALESCE(EXCLUDED.licitation_code, purchase_orders.licitation_code),
          raw_payload_json = EXCLUDED.raw_payload_json,
          normalized_payload_json = EXCLUDED.normalized_payload_json,
          updated_at = NOW()
        RETURNING *`,
        [
          data.externalCode,
          data.licitationCode,
          data.orderTypeCode,
          data.orderTypeLabel,
          data.stateCode,
          data.supplierStateLabel,
          data.buyerOrgCode,
          data.buyerOrgName,
          data.supplierCode,
          data.supplierName,
          data.totalNet,
          data.taxes,
          data.total,
          data.currency,
          data.supplierRating,
          data.supplierRatingCount,
          data.issuedAt,
          data.acceptedAt,
          JSON.stringify(data.rawPayloadJson),
          JSON.stringify(data.normalizedPayloadJson),
        ],
      );

      const order = mapRowToPurchaseOrder(row.rows[0] as Record<string, unknown>);

      // Re-insert items SOLO si el payload trae items. El listado de OC no los
      // incluye; sin este guard, un re-sync desde listado borraría los items
      // que el enriquecimiento por detalle ya pobló.
      if (data.items.length === 0) {
        return { ...order, items: [] };
      }

      await client.query('DELETE FROM purchase_order_items WHERE purchase_order_id = $1', [
        order.id,
      ]);

      // INSERT multi-row en un solo round-trip (antes: un INSERT por item = N+1).
      const params = data.items.flatMap((item) => [
        order.id,
        item.lineNumber,
        item.productCode,
        item.categoryCode,
        item.categoryName,
        item.buyerSpec,
        item.supplierSpec,
        item.quantity,
        item.unitNetPrice,
        item.total,
      ]);
      const inserted = await client.query(
        buildInsertPurchaseOrderItems(data.items.length),
        params,
      );
      // RETURNING * preserva el orden de la lista VALUES en un único INSERT.
      const itemRows = inserted.rows.map((r) =>
        mapRowToPurchaseOrderItem(r as Record<string, unknown>),
      );

      return { ...order, items: itemRows };
    });
  }

  async findByBuyerOrgCode(buyerOrgCode: string, limit = 50): Promise<PurchaseOrder[]> {
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM purchase_orders WHERE buyer_org_code = $1
       ORDER BY issued_at DESC NULLS LAST LIMIT $2`,
      [buyerOrgCode, limit],
    );
    return rows.map(mapRowToPurchaseOrder);
  }

  async findRecent(limit = 50): Promise<PurchaseOrder[]> {
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM purchase_orders ORDER BY issued_at DESC NULLS LAST LIMIT $1`,
      [limit],
    );
    return rows.map(mapRowToPurchaseOrder);
  }

  async findByExternalCode(
    externalCode: string,
  ): Promise<(PurchaseOrder & { items: PurchaseOrderItem[] }) | null> {
    const row = await queryOne<Record<string, unknown>>(
      'SELECT * FROM purchase_orders WHERE external_code = $1',
      [externalCode],
    );
    if (!row) return null;

    const order = mapRowToPurchaseOrder(row);
    const items = await query<Record<string, unknown>>(
      'SELECT * FROM purchase_order_items WHERE purchase_order_id = $1 ORDER BY line_number ASC',
      [order.id],
    );

    return { ...order, items: items.map(mapRowToPurchaseOrderItem) };
  }



  /**
   * OCs pendientes de enriquecer (sin proveedor y sin agotar reintentos), en
   * DOS CARRILES: primero las recién llegadas, después la cola histórica.
   *
   * POR QUÉ DOS CARRILES
   * --------------------
   * Acá había un solo `ORDER BY … po.created_at ASC` — las más viejas primero.
   * Medido el 2026-08-12: la cola pendiente eran 7 días completos de llegadas
   * (51.439 OCs), así que una orden emitida hoy quedaba detrás de ~42.000 y
   * **tardaba ~6 días en tener proveedor, monto e ítems**. Justo el dato que
   * alguien consulta el mismo día en que la orden aparece.
   *
   * FIFO parece justo pero acá es al revés: la OC de hoy es la que se está
   * mirando, y la de la semana pasada ya nadie la espera.
   *
   * Dentro del carril fresco se sigue prefiriendo a los organismos con
   * `buyer_profile` (el criterio original, que alimenta buyer intelligence).
   */
  async findPendingEnrichment(
    limit: number,
  ): Promise<Array<{ externalCode: string; buyerOrgCode: string | null }>> {
    const cupoRecientes = Math.max(1, Math.floor(limit * PROPORCION_RECIENTES));

    const rows = await query<{ external_code: string; buyer_org_code: string | null }>(
      `WITH pendientes AS (
         SELECT po.external_code, po.buyer_org_code, po.created_at,
                (bp.org_code IS NOT NULL) AS con_perfil
           FROM purchase_orders po
           LEFT JOIN buyer_profiles bp ON bp.org_code = po.buyer_org_code
          WHERE po.supplier_code IS NULL
            AND po.enrichment_attempts < 5
       ),
       recientes AS (
         SELECT external_code, buyer_org_code FROM pendientes
          WHERE created_at > now() - interval '${VENTANA_RECIENTE}'
          ORDER BY con_perfil DESC, created_at DESC
          LIMIT $2
       ),
       historicas AS (
         SELECT external_code, buyer_org_code FROM pendientes
          WHERE created_at <= now() - interval '${VENTANA_RECIENTE}'
            -- Dentro del backlog se mantiene FIFO: sin esto, las más viejas
            -- nunca saldrían y la cola tendría una cola inmortal.
          ORDER BY con_perfil DESC, created_at ASC
          LIMIT $1
       )
       SELECT * FROM (
         SELECT * FROM recientes
         UNION ALL
         SELECT * FROM historicas
       ) lote
       LIMIT $1`,
      [limit, cupoRecientes],
    );
    return rows.map((r) => ({ externalCode: r.external_code, buyerOrgCode: r.buyer_org_code }));
  }

  /**
   * Foto del backlog de enriquecimiento.
   *
   * POR QUÉ EXISTE: hasta ahora el avance del enrich sólo se podía ver entrando
   * a la base. Eso hizo que pasara desapercibido durante semanas que el job
   * avanzaba ~30 OCs por día contra un backlog de decenas de miles — cerraba en
   * `success` con casi todos los ítems fallando por 429, así que desde afuera
   * parecía sano.
   *
   * `sin_fecha_emision` está acá a propósito: `issued_at` lo completa el
   * enriquecimiento, así que el "hueco" que aparece al contar OCs por mes NO es
   * de órdenes faltantes, es de órdenes sin enriquecer. Verlos juntos evita
   * repetir el diagnóstico equivocado de salir a re-descargar meses enteros.
   */
  /**
   * Flujo de OCs: lo que ENTRA contra lo que se alcanza a completar.
   *
   * El backlog por sí solo no dice si el problema se está arreglando o
   * empeorando — para eso hace falta la resta. Y `completasDelDia` es el
   * indicador de lo que realmente se pidió: que una orden emitida hoy traiga su
   * detalle hoy, no dentro de seis días.
   */
  async getFlowStats(): Promise<{
    entradas24h: number;
    delDia: number;
    completasDelDia: number;
  }> {
    const rows = await query<Record<string, string>>(
      `SELECT count(*) FILTER (WHERE created_at > now() - interval '24 hours') AS entradas_24h,
              count(*) FILTER (WHERE created_at::date = current_date)          AS del_dia,
              count(*) FILTER (WHERE created_at::date = current_date
                                 AND supplier_code IS NOT NULL)                AS completas_del_dia
         FROM purchase_orders`,
    );
    const r = rows[0] ?? {};
    return {
      entradas24h: Number(r['entradas_24h'] ?? 0),
      delDia: Number(r['del_dia'] ?? 0),
      completasDelDia: Number(r['completas_del_dia'] ?? 0),
    };
  }

  async getEnrichmentBacklog(): Promise<{
    total: number;
    completas: number;
    pendientes: number;
    agotadas: number;
    sinFechaEmision: number;
  }> {
    const [row] = await query<{
      total: string;
      completas: string;
      pendientes: string;
      agotadas: string;
      sin_fecha_emision: string;
    }>(
      `SELECT count(*)                                                   AS total,
              count(*) FILTER (WHERE supplier_code IS NOT NULL)          AS completas,
              -- mismo criterio que findPendingEnrichment: lo que el job aún toma
              count(*) FILTER (WHERE supplier_code IS NULL
                                 AND enrichment_attempts < 5)            AS pendientes,
              -- se les agotaron los reintentos: el job ya no las va a mirar
              count(*) FILTER (WHERE supplier_code IS NULL
                                 AND enrichment_attempts >= 5)           AS agotadas,
              count(*) FILTER (WHERE issued_at IS NULL)                  AS sin_fecha_emision
         FROM purchase_orders`,
    );
    return {
      total: Number(row?.total ?? 0),
      completas: Number(row?.completas ?? 0),
      pendientes: Number(row?.pendientes ?? 0),
      agotadas: Number(row?.agotadas ?? 0),
      sinFechaEmision: Number(row?.sin_fecha_emision ?? 0),
    };
  }

  /** Suma un intento de enriquecimiento (para no reintentar indefinidamente). */
  async incrementEnrichmentAttempts(externalCode: string): Promise<void> {
    await query(
      `UPDATE purchase_orders
          SET enrichment_attempts = enrichment_attempts + 1
        WHERE external_code = $1`,
      [externalCode],
    );
  }
}

export const purchaseOrderRepository = new PurchaseOrderRepository();
