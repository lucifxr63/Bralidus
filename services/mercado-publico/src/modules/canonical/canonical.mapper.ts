import type { NormalizedLicitacion } from '../../infrastructure/mercado-publico/mercado-publico.types.js';
import { TENDER_TYPE } from '../../shared/constants/tender-types.js';

/**
 * Mapeo del registro normalizado interno → fila de `licitaciones_mercado_publico`
 * (la tabla canónica de Bralidus/Animus, proyecto fcdhcntyvsydnvjwopfe).
 *
 * Es el único punto donde el vocabulario de Licitus se traduce al de Bralidus.
 * Ambos describen lo mismo pero con enums distintos, así que la traducción es
 * deliberada y está acotada por los CHECK constraints de la tabla destino —
 * emitir un valor fuera de lista hace fallar el INSERT.
 */

/** Valores admitidos por el CHECK de `source_type` en la tabla destino. */
export type CanonicalSourceType =
  | 'tender'
  | 'agile_purchase'
  | 'private_tender'
  | 'convenio_marco'
  | 'grandes_compras'
  | 'trato_directo'
  | 'consulta_mercado'
  | 'contrato_publico'
  | 'nuevos_mecanismos';

/** Valores admitidos por el CHECK de `status_code` en la tabla destino. */
export type CanonicalStatusCode =
  | 'publicada'
  | 'adjudicada'
  | 'cerrada'
  | 'desierta'
  | 'revocada';

export interface CanonicalRow {
  external_code: string;
  title: string;
  buyer_name: string;
  buyer_rut: string | null;
  buyer_org_code: string | null;
  source_type: CanonicalSourceType;
  status_code: CanonicalStatusCode;
  amount_estimated: number;
  currency: string;
  published_at: string;
  closing_at: string | null;
  award_at: string | null;
  category: string;
  official_url: string;
  attachments: unknown[];
  items: unknown[];
  raw_payload: Record<string, unknown>;

  // ── Cronograma ────────────────────────────────────────────────────────────
  // El normalizador ya resolvía estas nueve fechas y el mapper las tiraba: la
  // tabla sólo guardaba publicación, cierre y adjudicación. Sin el resto no se
  // puede preparar una oferta —cuándo se pregunta, cuándo se responde, cuándo
  // se abre— y era lo segundo que pedía el integrador. No cuesta una llamada
  // más a MP: ya estaban en el payload.
  forum_start_at: string | null;
  forum_end_at: string | null;
  answers_published_at: string | null;
  technical_opening_at: string | null;
  economic_opening_at: string | null;
  site_visit_at: string | null;
  documents_deadline_at: string | null;
  estimated_award_at: string | null;
  estimated_sign_at: string | null;

  // ── Comprador y contacto ──────────────────────────────────────────────────
  buyer_unit_code: string | null;
  buyer_unit_name: string | null;
  buyer_region: string | null;
  buyer_commune: string | null;
  buyer_address: string | null;
  buyer_contact_name: string | null;
  buyer_contact_role: string | null;
  contract_responsible_name: string | null;
  contract_responsible_email: string | null;
  contract_responsible_phone: string | null;

  // ── Semántica del monto ───────────────────────────────────────────────────
  // `amount_estimated = 0` colapsaba tres cosas distintas: sin monto informado,
  // monto oculto por el organismo (`VisibilidadMonto = 0`) y proceso no
  // estimable (`Estimacion = 3`). Estos dos campos las separan sin cambiar el
  // significado del que ya existe.
  amount_is_public: boolean | null;
  amount_estimation_type: number | null;
  amount_justification: string | null;
}

/**
 * Mecanismo de contratación. Se prioriza `tenderTypeCode` sobre `sourceType`
 * porque es más específico: un Convenio Marco (CO) o un Trato Directo (E2)
 * llegan por el mismo endpoint que una licitación normal, y etiquetarlos como
 * 'tender' sería guardar el dato mal. No amplía lo que se extrae — solo evita
 * perder precisión sobre lo que YA se extrae.
 */
export function toCanonicalSourceType(n: NormalizedLicitacion): CanonicalSourceType {
  if (n.sourceType === 'compra_agil' || n.tenderTypeCode === TENDER_TYPE.COT) {
    return 'agile_purchase';
  }
  switch (n.tenderTypeCode) {
    case TENDER_TYPE.CO:
      return 'convenio_marco';
    case TENDER_TYPE.E2:
      return 'trato_directo';
    case TENDER_TYPE.B2:
      // B2 = oferta electrónica simplificada. `tenderPublicTypeCode` 2 = Privada.
      return n.tenderPublicTypeCode === 2 ? 'private_tender' : 'tender';
    default:
      return n.tenderPublicTypeCode === 2 ? 'private_tender' : 'tender';
  }
}

/**
 * Estados de MP → enum canónico.
 *
 * OJO — mapeo con pérdida conocida: MP tiene 18 = "Suspendida", que la tabla
 * canónica no contempla (su CHECK solo admite publicada/adjudicada/cerrada/
 * desierta/revocada). Se mapea a 'cerrada' porque es lo que describe el efecto
 * observable (no está recibiendo ofertas), pero el estado real se conserva
 * intacto en `raw_payload` para no perder el dato. Si más adelante importa
 * distinguirla, hay que extender el CHECK de la tabla.
 */
export function toCanonicalStatus(statusCode: number | null): CanonicalStatusCode {
  switch (statusCode) {
    case 5:
      return 'publicada';
    case 6:
      return 'cerrada';
    case 7:
      return 'desierta';
    case 8:
      return 'adjudicada';
    case 15:
      return 'revocada';
    case 18:
      return 'cerrada'; // Suspendida — ver nota arriba
    default:
      return 'publicada';
  }
}

export function buildOfficialUrl(externalCode: string, sourceType: CanonicalSourceType): string {
  // Mismas URLs que arma `withOfficialUrl` en el gateway api-v1, para que un
  // registro escrito aquí y uno servido desde allá apunten al mismo lugar.
  //
  // Compra Ágil vive en su propio subdominio. La ruta anterior
  // (www.mercadopublico.cl/CompraAgil/Ficha/<code>) responde 200 con una página
  // vacía en lugar de 404, así que los links parecían válidos sin serlo — un
  // integrador lo reportó el 2026-07-29. Si se toca acá, tocar también
  // `withOfficialUrl` en api-v1/routes/data.ts: deben coincidir siempre.
  return sourceType === 'agile_purchase'
    ? `https://compra-agil.mercadopublico.cl/resumen-cotizacion/${encodeURIComponent(externalCode)}`
    : `https://www.mercadopublico.cl/Procurement/Modules/RFBA/Details.aspx?code=${encodeURIComponent(externalCode)}`;
}

export function toCanonicalRow(n: NormalizedLicitacion): CanonicalRow {
  const sourceType = toCanonicalSourceType(n);

  return {
    external_code: n.externalCode,
    title: n.title,
    // NOT NULL en destino: MP siempre trae organismo, pero un fallback explícito
    // es preferible a que reviente la corrida entera por un registro raro.
    buyer_name: n.buyerOrgName ?? n.buyerUnitName ?? 'Organismo no informado',
    // Decía "MP no expone el RUT del comprador en este endpoint". Sí lo expone:
    // v1 en `Comprador.RutUnidad`, v2 en `institucion.rut` —presente en las
    // 44.237 compras ágiles—. Se escribía `null` en las 59.932 filas.
    buyer_rut: n.buyerRut,
    buyer_org_code: n.buyerOrgCode,
    source_type: sourceType,
    status_code: toCanonicalStatus(n.statusCode),
    amount_estimated: n.estimatedAmount ?? 0,
    currency: n.currency ?? 'CLP',
    published_at: n.publishedAt ?? new Date().toISOString(),
    closing_at: n.closingAt,
    award_at: n.awardedAt,
    category: 'Contratación Pública',
    official_url: buildOfficialUrl(n.externalCode, sourceType),
    // Decía "este pipeline no descarga adjuntos" y devolvía siempre `[]`. No se
    // trata de descargarlos: Compra Ágil los LISTA en su payload y el listado ya
    // estaba guardado. Descargar el archivo sigue siendo otro problema —la
    // fuente no da URL—, pero saber que existen y cómo se llaman no lo era.
    attachments: n.attachments,
    items: n.items,
    raw_payload: n.rawPayloadJson,

    forum_start_at: n.forumStartAt,
    forum_end_at: n.forumEndAt,
    answers_published_at: n.answersPublishedAt,
    technical_opening_at: n.technicalOpeningAt,
    economic_opening_at: n.economicOpeningAt,
    site_visit_at: n.siteVisitAt,
    documents_deadline_at: n.documentsDeadlineAt,
    estimated_award_at: n.estimatedAwardAt,
    estimated_sign_at: n.estimatedSignAt,

    buyer_unit_code: n.buyerUnitCode,
    buyer_unit_name: n.buyerUnitName,
    buyer_region: n.buyerRegion,
    buyer_commune: n.buyerCommune,
    buyer_address: n.buyerAddress,
    buyer_contact_name: n.buyerResponsibleUser,
    buyer_contact_role: n.buyerResponsibleRole,
    contract_responsible_name: n.contractResponsibleName,
    contract_responsible_email: n.contractResponsibleEmail,
    contract_responsible_phone: n.contractResponsiblePhone,

    amount_is_public: n.amountIsPublic,
    amount_estimation_type: n.amountEstimationType,
    amount_justification: n.amountJustification,
  };
}
