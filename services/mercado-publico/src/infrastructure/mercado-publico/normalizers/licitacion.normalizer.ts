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
    buyerUnitCode: extractUnitCode(buyer) ?? null,
    buyerUnitName: extractUnitName(buyer) ?? null,
    buyerRegion: extractRegion(buyer) ?? null,
    buyerCommune: extractCommune(buyer) ?? null,
    buyerAddress: extractAddress(buyer) ?? null,
    buyerResponsibleUser: raw.Comprador?.NombreUsuario ?? null,

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
    amountJustification: raw.JustificacionMontoEstimado ?? null,

    // Pago y contrato
    paymentModalityCode: raw.Modalidad ?? raw.TipoPago ?? null,
    contractDurationValue: raw.TiempoDuracionContrato ?? raw.TiempoEvaluacion ?? null,
    contractDurationUnit: raw.UnidadTiempoDuracionContrato ?? null,
    contractDurationLabel: raw.TipoDuracionContrato ?? raw.TiempoEvaluacionLabel ?? null,
    isRenewable: raw.EsRenovable != null ? raw.EsRenovable === 1 : null,
    renewalPeriodLabel: raw.PeriodoTiempoRenovacion ?? null,

    // Responsable de contrato
    contractResponsibleName: raw.NombreResponsableContrato ?? null,
    contractResponsibleEmail: raw.EmailResponsableContrato ?? null,
    contractResponsiblePhone: raw.FonoResponsableContrato ?? null,

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

    rawPayloadJson: raw as unknown as Record<string, unknown>,
    normalizedPayloadJson: {}, // se completa abajo, una vez construido el objeto
  };

  normalized.normalizedPayloadJson = buildNormalizedPayload(normalized);
  return normalized;
}

// ── Private helpers ─────────────────────────────────────────

function parseDate(value: string | undefined | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

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
