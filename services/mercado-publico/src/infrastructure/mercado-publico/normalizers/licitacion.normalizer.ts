import { parseFechaChile } from '../../../shared/utils/chile-time.js';
import type {
  MpLicitacionRaw,
  NormalizedLicitacion,
  NormalizedLicitacionItem,
} from '../mercado-publico.types';

/**
 * Convert a raw Mercado Público licitación response into a clean internal DTO.
 * Pure function - no side effects, easy to test.
 */
export function normalizeLicitacion(raw: MpLicitacionRaw): NormalizedLicitacion {
  const buyer = raw.Comprador ?? raw.Unidad;
  const fechas = raw.Fechas;

  const items: NormalizedLicitacionItem[] = (raw.Items?.Listado ?? []).map(
    (item: import('../mercado-publico.types').MpItemLicitacion) => ({
      lineNumber: item.Correlativo ?? null,
      productCode: item.CodigoProducto ?? null,
      categoryCode: item.CodigoCategoria ?? null,
      categoryName: item.Categoria ?? null,
      productName: item.NombreProducto ?? null,
      description: item.Descripcion ?? null,
      unitMeasure: item.UnidadMedida ?? null,
      quantity: item.Cantidad ?? null,
      awardedSupplierRut: item.Adjudicacion?.RutProveedor ?? null,
      awardedSupplierName: item.Adjudicacion?.NombreProveedor ?? null,
      awardedQuantity: item.Adjudicacion?.CantidadAdjudicada ?? null,
      awardedUnitAmount: item.Adjudicacion?.MontoUnitario ?? null,
    }),
  );

  const normalized: NormalizedLicitacion = {
    externalCode: raw.CodigoExterno,
    sourceType: 'mercado_publico',
    title: raw.Nombre,
    description: raw.Descripcion ?? null,

    // Estado
    statusCode: raw.CodigoEstado ?? null,
    statusLabel: raw.Estado ?? raw.DescripcionEstado ?? null,

    // Tipo
    tenderTypeCode: raw.Tipo ?? null,
    tenderPublicTypeCode: raw.CodigoTipo ?? null,
    isOpenConvocatory: raw.TipoConvocatoria != null ? raw.TipoConvocatoria === 1 : null,

    // Comprador
    buyerOrgCode: extractBuyerOrgCode(buyer) ?? null,
    buyerOrgName: extractBuyerOrgName(buyer) ?? null,
    buyerRut: limpiarTexto(buyer?.RutUnidad),
    buyerUnitCode: limpiarTexto(extractUnitCode(buyer)),
    buyerUnitName: limpiarTexto(extractUnitName(buyer)),
    buyerRegion: limpiarTexto(extractRegion(buyer)),
    buyerCommune: limpiarTexto(extractCommune(buyer)),
    buyerAddress: limpiarTexto(extractAddress(buyer)),
    buyerResponsibleUser: limpiarTexto(raw.Comprador?.NombreUsuario),
    buyerResponsibleRole: limpiarTexto(raw.Comprador?.CargoUsuario),

    // Fechas — se resuelven desde la estructura Fechas o desde campos planos
    publishedAt: parseDate(fechas?.FechaPublicacion ?? raw.FechaPublicacion),
    closingAt: parseDate(fechas?.FechaCierre ?? raw.FechaCierre),
    daysToClose: raw.DiasCierreLicitacion ?? null,
    technicalOpeningAt: parseDate(fechas?.FechaActoAperturaTecnica),
    economicOpeningAt: parseDate(fechas?.FechaActoAperturaEconomica),
    estimatedAwardAt: parseDate(fechas?.FechaEstimadaAdjudicacion),
    awardedAt: parseDate(fechas?.FechaAdjudicacion ?? raw.FechaAdjudicacion),
    forumStartAt: parseDate(fechas?.FechaInicio),
    forumEndAt: parseDate(fechas?.FechaFinal),
    answersPublishedAt: parseDate(fechas?.FechaPubRespuestas),
    siteVisitAt: parseDate(fechas?.FechaVisitaTerreno),
    documentsDeadlineAt: parseDate(fechas?.FechaEntregaAntecedentes),
    estimatedSignAt: parseDate(fechas?.FechaEstimadaFirma),

    // Montos
    currency: extractCurrency(raw),
    estimatedAmount: raw.MontoEstimado ?? null,
    amountIsPublic: raw.VisibilidadMonto != null ? raw.VisibilidadMonto === 1 : null,
    amountEstimationType: raw.Estimacion ?? null,
    amountJustification: limpiarTexto(raw.JustificacionMontoEstimado),

    // Pago y contrato
    paymentModalityCode: raw.Modalidad ?? raw.TipoPago ?? null,
    contractDurationValue: raw.TiempoDuracionContrato ?? raw.TiempoEvaluacion ?? null,
    contractDurationUnit: raw.UnidadTiempoDuracionContrato ?? null,
    contractDurationLabel: raw.TipoDuracionContrato ?? raw.TiempoEvaluacionLabel ?? null,
    isRenewable: raw.EsRenovable != null ? raw.EsRenovable === 1 : null,
    renewalPeriodLabel: raw.PeriodoTiempoRenovacion ?? null,

    // Responsable de contrato
    // MP manda estas tres claves SIEMPRE y vacías casi siempre: el email del
    // responsable de contrato viene `""` en las 15.695 fichas. Sin limpiar,
    // la columna guarda un string vacío que parece dato y no lo es.
    contractResponsibleName: limpiarTexto(raw.NombreResponsableContrato),
    contractResponsibleEmail: limpiarTexto(raw.EmailResponsableContrato),
    contractResponsiblePhone: limpiarTexto(raw.FonoResponsableContrato),

    // Características
    allowsSubcontracting:
      (raw.SubContratacion ?? raw.Subcontratacion) != null
        ? (raw.SubContratacion ?? raw.Subcontratacion) === 1
        : null,
    requiresContraloria: raw.TomaRazon != null ? raw.TomaRazon === 1 : null,
    isConstruction: raw.Obras != null ? raw.Obras === 2 : null,
    complaintsCount: raw.CantidadReclamos ?? null,
    autoExtendDeadline: raw.ExtensionPlazo != null ? raw.ExtensionPlazo === 1 : null,
    isInformed: raw.Informada != null ? raw.Informada === 1 : null,

    // Dirección
    visitAddress: raw.DireccionVisita ?? null,
    deliveryAddress: raw.DireccionEntrega ?? null,

    // Adjudicación
    awardTypeCode: raw.Adjudicacion?.Tipo ?? null,
    awardDocumentNumber: raw.Adjudicacion?.Numero ?? null,
    awardSuppliersCount: raw.Adjudicacion?.NumeroOferentes ?? null,
    awardActUrl: raw.Adjudicacion?.UrlActa ?? null,

    items,
    // La v1 no entrega adjuntos en ninguna de sus 15.387 fichas. Va vacío
    // porque la fuente no los tiene, no porque falte extraerlos.
    attachments: [],

    rawPayloadJson: raw as unknown as Record<string, unknown>,
    normalizedPayloadJson: {}, // se completa abajo, una vez construido el objeto
  };

  normalized.normalizedPayloadJson = buildNormalizedPayload(normalized);
  return normalized;
}

// ── Private helpers ─────────────────────────────────────────

/**
 * MP devuelve campos "presentes pero vacíos" con bastante frecuencia:
 * `RutUsuario: ""` y regiones con espacio al final (`"Región del Biobío "`).
 * Un string vacío guardado como dato obliga a cada consumidor a re-descubrir
 * que no significa nada; `null` ya lo dice.
 */
function limpiarTexto(value: string | undefined | null): string | null {
  const t = value?.trim();
  return t ? t : null;
}

/**
 * MP publica estas fechas sin zona y en hora de Chile. Acá había un
 * `new Date(value)` pelado, que las resolvía contra la zona DEL PROCESO: el
 * mismo dato quedaba distinto según si la ingesta corría local (Santiago) o en
 * Vercel (UTC), y la tabla canónica terminó con tres convenios mezclados en la
 * misma columna. El detalle medido está en `chile-time.ts`.
 */
const parseDate = parseFechaChile;

function extractBuyerOrgCode(
  buyer: MpLicitacionRaw['Comprador'] | MpLicitacionRaw['Unidad'],
): string | undefined {
  if (!buyer) return undefined;
  if ('CodigoOrganismo' in buyer) return buyer.CodigoOrganismo;
  return buyer.Organismo?.Codigo;
}

function extractBuyerOrgName(
  buyer: MpLicitacionRaw['Comprador'] | MpLicitacionRaw['Unidad'],
): string | undefined {
  if (!buyer) return undefined;
  if ('NombreOrganismo' in buyer) return buyer.NombreOrganismo;
  return buyer.Organismo?.Nombre;
}

function extractUnitCode(
  buyer: MpLicitacionRaw['Comprador'] | MpLicitacionRaw['Unidad'],
): string | undefined {
  if (!buyer) return undefined;
  if ('CodigoUnidad' in buyer) return buyer.CodigoUnidad;
  return buyer.Codigo;
}

function extractUnitName(
  buyer: MpLicitacionRaw['Comprador'] | MpLicitacionRaw['Unidad'],
): string | undefined {
  if (!buyer) return undefined;
  if ('NombreUnidad' in buyer) return buyer.NombreUnidad;
  return buyer.Nombre;
}

function extractRegion(
  buyer: MpLicitacionRaw['Comprador'] | MpLicitacionRaw['Unidad'],
): string | undefined {
  if (!buyer) return undefined;
  return (buyer as { RegionUnidad?: string }).RegionUnidad;
}

function extractCommune(
  buyer: MpLicitacionRaw['Comprador'] | MpLicitacionRaw['Unidad'],
): string | undefined {
  if (!buyer) return undefined;
  return (buyer as { ComunaUnidad?: string }).ComunaUnidad;
}

function extractAddress(
  buyer: MpLicitacionRaw['Comprador'] | MpLicitacionRaw['Unidad'],
): string | undefined {
  if (!buyer) return undefined;
  return (buyer as { DireccionUnidad?: string }).DireccionUnidad;
}

function extractCurrency(raw: MpLicitacionRaw): string | null {
  // Prioridad: campo Moneda directo > MonedasAdicionales > default CLP si hay monto
  if (raw.Moneda) return raw.Moneda;
  const monedas = raw.MonedasAdicionales?.Listado;
  if (monedas && monedas.length > 0) return monedas[0]?.Tipo ?? 'CLP';
  return raw.MontoEstimado != null ? 'CLP' : null;
}

function buildNormalizedPayload(data: NormalizedLicitacion): Record<string, unknown> {
  const { rawPayloadJson: _raw, normalizedPayloadJson: _norm, ...rest } = data;
  return rest as unknown as Record<string, unknown>;
}
