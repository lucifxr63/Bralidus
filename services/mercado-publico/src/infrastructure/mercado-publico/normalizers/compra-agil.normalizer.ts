import type {
  NormalizedLicitacion,
  NormalizedLicitacionItem,
} from '../mercado-publico.types.js';
import type { CompraAgilDetalle, CompraAgilListItem } from '../compra-agil.types.js';
import { TENDER_TYPE } from '../../../shared/constants/tender-types.js';
import { parseFechaChile } from '../../../shared/utils/chile-time.js';

/**
 * Traduce una Compra Ágil (API v2) al DTO interno que ya consume
 * `opportunityRepository.upsertFromNormalized()`.
 *
 * La decisión de mapear a `NormalizedLicitacion` en vez de crear un modelo
 * propio es deliberada: así los procesos COT heredan matching, pipeline,
 * análisis IA, guardadas y notificaciones sin tocar esos módulos.
 *
 * Función pura — sin side effects, fully testable.
 */
export function normalizeCompraAgil(
  item: CompraAgilListItem,
  detalle: CompraAgilDetalle | null,
): NormalizedLicitacion {
  const institucion = detalle?.institucion ?? item.institucion;
  const convocatoria = detalle?.convocatoria ?? item.convocatoria;
  const presupuesto = detalle?.presupuesto ?? null;

  const publishedAt = parseDate(
    detalle?.fechas?.fecha_publicacion ?? item.fechas?.fecha_publicacion,
  );
  const closingAt = parseDate(detalle?.fechas?.fecha_cierre ?? item.fechas?.fecha_cierre);

  const items: NormalizedLicitacionItem[] = (detalle?.productos_solicitados ?? []).map(
    (producto, index) => {
      // UNSPSC: la API lo devuelve como número; la columna es TEXT.
      const productCode =
        producto.codigo_producto != null ? String(producto.codigo_producto) : null;
      return {
      lineNumber: index + 1,
      productCode,
      // El motor de matching lee `categoryCode`, NO `productCode`
      // (`evaluateUnspsc` hace `if (!item.categoryCode) continue`). La API v1
      // entrega ambos: el producto (72131702) y su CLASE (72131700). La v2 solo
      // entrega el producto, así que la clase se deriva igual que MP —
      // truncando a 6 dígitos. Sin esto los COT puntúan 0 en UNSPSC, que es
      // justo la señal más valiosa para una Compra Ágil.
      categoryCode: toUnspscClass(productCode),
      categoryName: null,
      productName: producto.nombre ?? null,
      description: producto.descripcion ?? null,
      unitMeasure: producto.unidad_medida ?? null,
      quantity: producto.cantidad ?? null,
      // La Compra Ágil no adjudica por línea: el ganador sale de
      // proveedores_cotizando, que se conserva en rawPayloadJson.
      awardedSupplierRut: null,
      awardedSupplierName: null,
      awardedQuantity: null,
      awardedUnitAmount: null,
      };
    },
  );

  const normalized: NormalizedLicitacion = {
    externalCode: detalle?.codigo ?? item.codigo,
    sourceType: 'compra_agil',
    title: detalle?.nombre ?? item.nombre ?? item.codigo,
    description: detalle?.descripcion ?? null,

    // Estado — se traduce al código numérico COMPARTIDO con las licitaciones
    // (5=Publicada, 6=Cerrada…). El `id_estado` nativo de Compra Ágil usa otra
    // escala (publicada=2) y guardarlo crudo dejaba los COT invisibles para todo
    // lo que filtra por status_code: /v1/mercado/activas, refresh, dashboard.
    // El estado real se conserva en statusLabel y en normalizedPayloadJson.
    statusCode: mapStatusCode(detalle?.estado ?? item.estado),
    statusLabel: detalle?.estado?.glosa ?? item.estado?.glosa ?? null,

    // Tipo — COT es su propio mecanismo, no un tipo de licitación del DS 250.
    tenderTypeCode: TENDER_TYPE.COT,
    tenderPublicTypeCode: null,
    // Convocatoria abierta a todo proveedor registrado en ambos llamados.
    isOpenConvocatory: true,

    // Comprador — la API v2 entrega el RUT del organismo, no el código interno
    // que usa la v1. Se guarda el RUT: es el identificador estable y público.
    buyerOrgCode: institucion?.rut ?? null,
    buyerOrgName: institucion?.organismo_comprador?.trim() || null,
    buyerRut: institucion?.rut?.trim() || null,
    buyerUnitCode: null,
    // La v2 también manda nombres con espacio al final ("Departamento Comunal
    // de Salud "). Sin recortar, el mismo organismo se agrupa como dos.
    buyerUnitName: institucion?.unidad_compra?.trim() || null,
    buyerRegion: institucion?.nombre_region?.trim() || null,
    buyerCommune: null,
    buyerAddress: null,
    buyerResponsibleUser: null,
    buyerResponsibleRole: null,

    // Fechas
    publishedAt,
    closingAt,
    daysToClose: computeDaysToClose(closingAt, publishedAt),
    technicalOpeningAt: null,
    economicOpeningAt: null,
    estimatedAwardAt: null,
    awardedAt: null,
    forumStartAt: null,
    forumEndAt: null,
    answersPublishedAt: null,
    siteVisitAt: null,
    documentsDeadlineAt: null,
    estimatedSignAt: null,

    // Montos — `monto_disponible_clp` ya viene normalizado por la API cuando la
    // moneda no es CLP; se prefiere para que los filtros por monto comparen peras
    // con peras. La moneda original se conserva para mostrarla.
    currency: presupuesto?.moneda ?? item.montos?.moneda ?? null,
    estimatedAmount:
      presupuesto?.monto_disponible_clp ??
      item.montos?.monto_disponible_clp ??
      presupuesto?.monto_disponible ??
      item.montos?.monto_disponible ??
      presupuesto?.presupuesto_estimado ??
      null,
    // En Compra Ágil el presupuesto disponible siempre es público.
    amountIsPublic: true,
    amountEstimationType: null,
    amountJustification: null,

    // Pago y contrato — no aplican al mecanismo.
    paymentModalityCode: null,
    contractDurationValue: detalle?.entrega?.plazo_entrega_dias ?? null,
    contractDurationUnit: detalle?.entrega?.plazo_entrega_dias != null ? 2 : null, // 2 = días
    contractDurationLabel: detalle?.entrega?.plazo_entrega_dias != null ? 'Días' : null,
    isRenewable: null,
    renewalPeriodLabel: null,

    contractResponsibleName: null,
    contractResponsibleEmail: null,
    contractResponsiblePhone: null,

    // Características
    allowsSubcontracting: null,
    requiresContraloria: null,
    isConstruction: null,
    complaintsCount: null,
    autoExtendDeadline: null,
    isInformed: null,

    visitAddress: null,
    deliveryAddress: detalle?.entrega?.direccion_entrega ?? null,

    // Adjudicación
    awardTypeCode: null,
    awardDocumentNumber: null,
    awardSuppliersCount:
      detalle?.resumen?.total_ofertas_recibidas ?? item.resumen?.total_ofertas_recibidas ?? null,
    awardActUrl: null,

    items,

    // Los documentos ya venían en el payload y se estaban descartando: al
    // 2026-08-11, 31.689 de 44.237 compras ágiles los tenían guardados en
    // `raw_payload` mientras la API respondía `attachments: []`. Es el único
    // mecanismo de MP que publica sus bases por API.
    attachments: (detalle?.documentos ?? item.documentos ?? []).map((d) => ({
      id: d.id != null ? String(d.id) : null,
      nombre: d.nombre?.trim() || null,
      // La fuente entrega id y nombre, nunca un enlace de descarga.
      url: null,
      tipo: 'archivo' as const,
      origen: 'compra_agil' as const,
      descargable: false,
    })),

    // Se guarda el par completo: convocatoria, proveedores_cotizando, flags e
    // id_orden_compra no se modelan hoy en columnas, pero quedan disponibles sin
    // volver a pegarle a la API.
    rawPayloadJson: { listado: item, detalle } as unknown as Record<string, unknown>,
    normalizedPayloadJson: {},
  };

  normalized.normalizedPayloadJson = buildNormalizedPayload(normalized, convocatoria, detalle);
  return normalized;
}

// ── Private helpers ─────────────────────────────────────────

/**
 * Traduce el estado de Compra Ágil al código numérico que usan las licitaciones
 * en `opportunities.status_code`. Los consumidores (integration-api, refresh,
 * dashboard, filtros del front) están escritos contra esa escala.
 *
 * Valores observados en producción: 5=Publicada, 6=Cerrada, 7=Desierta,
 * 8=Adjudicada, 15=Revocada, 16=Suspendida.
 */
function mapStatusCode(estado: { codigo?: string; glosa?: string } | null | undefined): number | null {
  const codigo = estado?.codigo?.toLowerCase();
  switch (codigo) {
    case 'publicada':
      return 5;
    case 'cerrada':
      return 6;
    case 'desierta':
      return 7;
    // Con proveedor elegido u OC emitida el proceso está resuelto: equivale a
    // una licitación adjudicada.
    case 'proveedor_seleccionado':
    case 'oc_emitida':
      return 8;
    case 'cancelada':
      return 15; // Revocada
    default:
      return null;
  }
}

/**
 * Deriva la CLASE UNSPSC desde el código de producto, como hace la API v1:
 * 72131702 (producto) → 72131700 (clase). Devuelve null si no es un código de
 * 8 dígitos.
 */
function toUnspscClass(productCode: string | null): string | null {
  if (!productCode) return null;
  const digits = productCode.trim();
  if (!/^\d{8}$/.test(digits)) return null;
  return digits.slice(0, 6) + '00';
}

/**
 * La API mezcla ISO-8601 con UTC ("2026-07-25T23:35:00.907Z") y un formato
 * corto sin zona ("2026-07-25 23:30"). El corto es hora de Chile.
 *
 * Antes el corto se interpretaba como UTC "igual que el normalizer v1, para no
 * introducir un desfase distinto entre ambas fuentes". La intención era buena
 * pero la premisa era falsa: v1 no tenía UN convenio, tenía el de la máquina
 * donde corriera. Así que esto no igualaba nada — sólo garantizaba que las
 * 44.237 compras ágiles quedaran corridas 3–4 horas. Ahora ambas fuentes pasan
 * por el mismo conversor y el ISO con zona se respeta tal cual.
 */
const parseDate = parseFechaChile;

function computeDaysToClose(closingAt: string | null, publishedAt: string | null): number | null {
  if (!closingAt || !publishedAt) return null;
  const close = new Date(closingAt).getTime();
  const published = new Date(publishedAt).getTime();
  if (isNaN(close) || isNaN(published)) return null;
  return Math.max(0, Math.round((close - published) / 86_400_000));
}

function buildNormalizedPayload(
  data: NormalizedLicitacion,
  convocatoria: CompraAgilDetalle['convocatoria'],
  detalle: CompraAgilDetalle | null,
): Record<string, unknown> {
  const { rawPayloadJson: _raw, normalizedPayloadJson: _norm, ...rest } = data;
  return {
    ...rest,
    // Metadatos propios del mecanismo que no tienen columna: el análisis IA y la
    // UI los leen desde aquí sin re-consultar la API.
    compraAgil: {
      // Estado nativo del mecanismo (publicada=2…), distinto del status_code
      // compartido que se persiste en la columna.
      estadoCodigo: detalle?.estado?.codigo ?? null,
      estadoIdNativo: detalle?.estado?.id_estado ?? null,
      estadoConvocatoria: convocatoria?.estado_convocatoria ?? null,
      convocatoriaDescripcion: convocatoria?.descripcion ?? null,
      cierrePrimerLlamado: convocatoria?.fecha_cierre_primer_llamado ?? null,
      cierreSegundoLlamado: convocatoria?.fecha_cierre_segundo_llamado ?? null,
      // id_orden_compra != null es el único indicador confiable de OC emitida.
      idOrdenCompra: detalle?.id_orden_compra ?? detalle?.orden_compra?.id_orden_compra ?? null,
      totalOfertasRecibidas: detalle?.resumen?.total_ofertas_recibidas ?? null,
      proveedoresCotizando: detalle?.proveedores_cotizando?.length ?? 0,
      requisitosMedioambientales: detalle?.flags?.considera_requisitos_medioambientales ?? null,
      requisitosImpactoSocial: detalle?.flags?.considera_requisitos_impacto_social_economico ?? null,
    },
  } as unknown as Record<string, unknown>;
}
