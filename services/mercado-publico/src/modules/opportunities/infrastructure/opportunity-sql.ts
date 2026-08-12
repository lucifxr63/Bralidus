// Raw SQL statements for opportunities module
// Centralized here so repository stays readable

export const SQL = {
  INSERT_OPPORTUNITY: `
    INSERT INTO opportunities (
      external_code, source_type, title, description,
      status_code, status_label,
      tender_type_code, tender_type_label,
      buyer_org_code, buyer_org_name,
      buyer_unit_code, buyer_unit_name,
      buyer_region, buyer_commune,
      published_at, closing_at, estimated_award_at,
      currency, estimated_amount, amount_visibility,
      payment_modality_code,
      contract_duration_value, contract_duration_label,
      allows_subcontracting,
      days_to_close, complaints_count, is_renewable, award_act_url, amount_is_public,
      raw_payload_json, normalized_payload_json, area,
      site_visit_at, requires_contraloria
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
      $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,
      $33,$34
    )
    ON CONFLICT (external_code) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      status_code = EXCLUDED.status_code,
      status_label = EXCLUDED.status_label,
      closing_at = EXCLUDED.closing_at,
      estimated_award_at = EXCLUDED.estimated_award_at,
      estimated_amount = EXCLUDED.estimated_amount,
      days_to_close = EXCLUDED.days_to_close,
      complaints_count = EXCLUDED.complaints_count,
      is_renewable = EXCLUDED.is_renewable,
      award_act_url = EXCLUDED.award_act_url,
      amount_is_public = EXCLUDED.amount_is_public,
      raw_payload_json = EXCLUDED.raw_payload_json,
      normalized_payload_json = EXCLUDED.normalized_payload_json,
      area = EXCLUDED.area,
      site_visit_at = EXCLUDED.site_visit_at,
      requires_contraloria = EXCLUDED.requires_contraloria,
      updated_at = NOW()
    RETURNING *
  `,

  DELETE_OPPORTUNITY_ITEMS: `
    DELETE FROM opportunity_items WHERE opportunity_id = $1
  `,

  FIND_BY_ID: `
    SELECT * FROM opportunities WHERE id = $1
  `,

  FIND_BY_EXTERNAL_CODE: `
    SELECT * FROM opportunities WHERE external_code = $1
  `,

  FIND_BY_IDS: `
    SELECT * FROM opportunities WHERE id = ANY($1::uuid[])
  `,

  FIND_ITEMS_BY_OPPORTUNITY_ID: `
    SELECT * FROM opportunity_items WHERE opportunity_id = $1
    ORDER BY line_number ASC NULLS LAST
  `,

  FIND_ITEMS_BY_OPPORTUNITY_IDS: `
    SELECT * FROM opportunity_items WHERE opportunity_id = ANY($1::uuid[])
    ORDER BY opportunity_id, line_number ASC NULLS LAST
  `,

  /**
   * Candidatos para el job de refresh dirigido (Fase C):
   *   1 = guardadas/en pipeline aún vigentes (prioridad máxima)
   *   2 = activas que cierran en las próximas 72 h
   *   3 = cerradas hace < 30 días sin acta de adjudicación (alimenta buyer profiles)
   * Los status finales ('7' desierta, '8' adjudicada, '15' revocada, '18'/'19')
   * no se refrescan. status_code se guarda como TEXT ('5' o '05' según fuente).
   */
  /*
   * Candidatos para el refresh dirigido.
   *
   * Se excluye 'compra_agil' además de 'private': refresh-opportunities
   * re-consulta el detalle contra `publico/licitaciones.json` (API v1), y los
   * códigos COT NO existen ahí — pedirlos devuelve error. Antes entraban al
   * lote y fallaban todos; peor aún, a los 5 fallos seguidos se abría el
   * circuit breaker de ese endpoint y arrastraba también a las licitaciones
   * legítimas del mismo lote. El 2026-07-29 esto daba 150 de 150 fallidas.
   *
   * Las Compras Ágiles no quedan sin refrescar: `sync-compra-agil` corre en
   * modo incremental (COMPRA_AGIL_INCREMENTAL_HOURS) contra la API v2, que es
   * la única que las conoce.
   */
  /**
   * Candidatos del refresh dirigido. `$1` = tope, `$2` = días de la ventana de
   * adjudicación.
   *
   * EL ORDEN DEL BUCKET 3 NO ES COSMÉTICO. Iba `closing_at ASC` —las que
   * cerraron hace más tiempo, primero—, y una licitación que no se adjudica NO
   * sale de la cola: sigue calificando hasta que envejece fuera de la ventana.
   * O sea que la cabeza se reconsultaba en cada corrida y el resto nunca
   * llegaba a su turno.
   *
   * Medido el 2026-08-12 sobre las 1.384 del bucket: 71 revisadas en 24 h y
   * **902 (65 %) sin revisar hacía más de una semana**, la más antigua de hacía
   * un mes. Eso —y no el largo de la ventana— es lo que hacía perder el 36 % de
   * las adjudicaciones: no es que miráramos poco tiempo, es que mirábamos
   * siempre a las mismas.
   *
   * Con `updated_at ASC` el bucket rota: la ingesta toca esa columna en cada
   * refresco, así que "la menos revisada" es exactamente la que corresponde
   * mirar. Los buckets 1 y 2 conservan `closing_at` porque ahí lo que manda es
   * la urgencia del cierre, no la cobertura.
   */
  /**
   * Candidatos del refresh. `$1` = tope del lote, `$2` = días de la ventana de
   * adjudicación, `$3` = cupo reservado a la vigilancia de adjudicaciones.
   *
   * POR QUÉ HAY CUPO RESERVADO
   * --------------------------
   * Antes los tres buckets competían en un solo `ORDER BY priority`, y el
   * bucket 2 (cierran en 72 h) tiene 530 candidatos contra un lote de 80: se
   * llevaba el lote COMPLETO en cada corrida y el bucket 3 —el que detecta
   * adjudicaciones— no recibía un solo cupo. Verificado antes de este cambio:
   * el lote salía 80 de 80 en prioridad 2.
   *
   * Eso explica el 36 % de adjudicaciones perdidas mejor que el largo de la
   * ventana: no es que mirásemos poco tiempo hacia atrás, es que no mirábamos.
   *
   * Y DENTRO del bucket 3 el orden es `updated_at ASC`, no `closing_at`: una
   * licitación que no se adjudica NO sale de la cola, así que ordenar por fecha
   * de cierre hacía que la cabeza se reconsultara eternamente. Medido: 902 de
   * 1.384 (65 %) sin revisar hacía más de una semana. `updated_at` lo toca la
   * ingesta en cada refresco, así que "la menos revisada" es exactamente la que
   * corresponde mirar.
   */
  FIND_REFRESH_CANDIDATES: `
    WITH urgentes AS (
      SELECT * FROM (
        SELECT DISTINCT ON (id) id, external_code, status_code, closing_at, priority, orden FROM (
          SELECT o.id, o.external_code, o.status_code, o.closing_at, 1 AS priority, o.closing_at AS orden
          FROM opportunities o
          WHERE o.source_type NOT IN ('private', 'compra_agil')
            AND (
              EXISTS (SELECT 1 FROM saved_opportunities s WHERE s.opportunity_id = o.id)
              OR EXISTS (SELECT 1 FROM opportunity_pipeline p WHERE p.opportunity_id = o.id)
            )
            AND (o.status_code IS NULL OR o.status_code NOT IN ('7','07','8','08','15','18','19'))
            AND (o.closing_at IS NULL OR o.closing_at > NOW() - ($2 || ' days')::interval)
          UNION ALL
          SELECT o.id, o.external_code, o.status_code, o.closing_at, 2, o.closing_at
          FROM opportunities o
          WHERE o.source_type NOT IN ('private', 'compra_agil')
            AND o.status_code IN ('5','05')
            AND o.closing_at BETWEEN NOW() AND NOW() + INTERVAL '72 hours'
        ) b ORDER BY id, priority
      ) d ORDER BY priority ASC, orden ASC NULLS LAST
      LIMIT GREATEST($1 - $3, 1)
    ),
    adjudicaciones AS (
      SELECT o.id, o.external_code, o.status_code, o.closing_at, 3 AS priority, o.updated_at AS orden
      FROM opportunities o
      WHERE o.source_type NOT IN ('private', 'compra_agil')
        AND o.status_code IN ('5','05','6','06')
        AND o.closing_at BETWEEN NOW() - ($2 || ' days')::interval AND NOW()
        AND o.award_act_url IS NULL
        AND o.id NOT IN (SELECT id FROM urgentes)
      ORDER BY o.updated_at ASC NULLS FIRST
      LIMIT $1
    )
    SELECT id, external_code, status_code, closing_at, priority FROM (
      SELECT * FROM urgentes
      UNION ALL
      SELECT * FROM adjudicaciones
    ) lote
    ORDER BY priority ASC, orden ASC NULLS LAST
    LIMIT $1
  `,

  /** Usuarios que guardaron la oportunidad o la tienen en pipeline. */
  FIND_INTERESTED_USER_IDS: `
    SELECT DISTINCT user_id FROM (
      SELECT user_id FROM saved_opportunities WHERE opportunity_id = $1
      UNION
      SELECT user_id FROM opportunity_pipeline WHERE opportunity_id = $1
    ) interested
  `,

  COUNT_WITH_FILTERS: `
    SELECT COUNT(*) as total FROM opportunities
    WHERE 1=1
  `,

  FIND_ALL_BASE: `
    SELECT * FROM opportunities
    WHERE 1=1
  `,
};

/** Columnas por fila del INSERT de items — debe coincidir con el orden de params. */
const OPPORTUNITY_ITEM_COLUMNS = 9;

/**
 * INSERT multi-row de items en un solo round-trip. Reemplaza el loop N+1
 * (un INSERT por item). Genera `VALUES ($1..$9),($10..$18),...` para `rowCount`
 * filas. El caller aplana los params en el mismo orden de columnas.
 * `rowCount` debe ser > 0 (los items van muy por debajo del límite de params de PG).
 */
export function buildInsertOpportunityItems(rowCount: number): string {
  const rows: string[] = [];
  for (let r = 0; r < rowCount; r++) {
    const base = r * OPPORTUNITY_ITEM_COLUMNS;
    const placeholders = Array.from({ length: OPPORTUNITY_ITEM_COLUMNS }, (_, c) => `$${base + c + 1}`);
    rows.push(`(${placeholders.join(',')})`);
  }
  return `
    INSERT INTO opportunity_items (
      opportunity_id, line_number, product_code,
      category_code, category_name, product_name,
      description, unit_measure, quantity
    ) VALUES ${rows.join(',')}
    RETURNING *
  `;
}
