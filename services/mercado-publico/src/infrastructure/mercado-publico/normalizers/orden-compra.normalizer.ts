import type {
  MpOrdenCompraRaw,
  NormalizedOrdenCompra,
  NormalizedOrdenCompraItem,
} from '../mercado-publico.types';

/**
 * Convert a raw Mercado Público orden de compra response into a clean internal DTO.
 * Pure function - no side effects.
 */
export function normalizeOrdenCompra(raw: MpOrdenCompraRaw): NormalizedOrdenCompra {
  const fechas = raw.Fechas;
  const comprador = raw.Comprador ?? raw.Unidad;
  const proveedor = raw.Proveedor;
  const montos = raw.Montos;

  const items: NormalizedOrdenCompraItem[] = (raw.Items?.Listado ?? []).map(
    (item: import('../mercado-publico.types').MpItemOrdenCompra) => ({
      lineNumber: item.Correlativo ?? null,
      productCode: item.CodigoProducto ?? null,
      categoryCode: item.CodigoCategoria ?? null,
      categoryName: item.Categoria ?? null,
      buyerSpec: item.EspecificacionComprador ?? null,
      supplierSpec: item.EspecificacionProveedor ?? null,
      quantity: item.Cantidad ?? null,
      currency: item.Moneda ?? null,
      unitNetPrice: item.PrecioNeto ?? null,
      totalCharges: item.TotalCargos ?? null,
      totalDiscounts: item.TotalDescuentos ?? null,
      totalTaxes: item.TotalImpuestos ?? null,
      total: item.Total ?? null,
    }),
  );

  const normalized: NormalizedOrdenCompra = {
    externalCode: raw.Codigo,
    name: raw.Nombre ?? null,
    licitationCode: raw.CodigoLicitacion ?? null,
    description: raw.Descripcion ?? null,

    // Tipo y estado
    orderTypeCode: raw.Tipo ?? null,
    orderTypeLabel: raw.TipoLabel ?? null,
    stateCode: raw.CodigoEstado ?? null,
    supplierStateCode: raw.CodigoEstadoProveedor ?? null,
    supplierStateLabel: raw.EstadoProveedor ?? null,

    // Comprador
    buyerOrgCode: extractBuyerOrgCode(comprador, raw.Unidad) ?? null,
    buyerOrgName: extractBuyerOrgName(comprador, raw.Unidad) ?? null,
    buyerUnitCode: extractBuyerUnitCode(comprador, raw.Unidad) ?? null,
    buyerUnitName: extractBuyerUnitName(comprador, raw.Unidad) ?? null,
    buyerRegion: (comprador as { RegionUnidad?: string })?.RegionUnidad ?? null,
    buyerCommune: (comprador as { ComunaUnidad?: string })?.ComunaUnidad ?? null,
    buyerContactName: (comprador as { NombreContacto?: string })?.NombreContacto ?? null,
    buyerContactEmail: (comprador as { MailContacto?: string })?.MailContacto ?? null,
    buyerContactPhone: (comprador as { FonoContacto?: string })?.FonoContacto ?? null,

    // Proveedor
    supplierCode: proveedor?.Codigo ?? proveedor?.CodigoProveedor ?? null,
    supplierRut: proveedor?.RutSucursal ?? proveedor?.Rut ?? null,
    supplierName: proveedor?.Nombre ?? null,
    supplierActivity: proveedor?.Actividad ?? null,
    supplierRegion: proveedor?.Region ?? null,
    supplierCommune: proveedor?.Comuna ?? null,
    supplierContactEmail: proveedor?.MailContacto ?? null,
    supplierRating: raw.PromedioCalificacion ?? null,
    supplierRatingCount: raw.CantidadEvaluacion ?? null,

    // Montos — soporta estructura Montos o campos planos
    currency: montos?.Moneda ?? raw.TipoMoneda ?? null,
    totalNet: montos?.TotalNeto ?? raw.TotalNeto ?? null,
    discounts: montos?.Descuentos ?? raw.Descuentos ?? null,
    charges: montos?.Cargos ?? raw.Cargos ?? null,
    vatPercentage: montos?.PorcentajeIva ?? raw.PorcentajeIva ?? null,
    taxes: montos?.Impuestos ?? raw.Impuestos ?? null,
    total: montos?.Total ?? raw.Total ?? null,

    // Logística
    dispatchTypeCode: raw.TipoDespacho ?? null,
    paymentMethodCode: raw.FormaPago ?? null,

    // Fechas — soporta estructura Fechas o campos planos
    issuedAt: parseDate(fechas?.FechaCreacion ?? raw.FechaCreacion),
    sentAt: parseDate(fechas?.FechaEnvio ?? raw.FechaEnvio),
    acceptedAt: parseDate(fechas?.FechaAceptacion ?? raw.FechaAceptacion),
    cancelledAt: parseDate(fechas?.FechaCancelacion ?? raw.FechaCancelacion),
    lastModifiedAt: parseDate(fechas?.FechaUltimaModificacion ?? raw.FechaUltimaModificacion),

    items,

    rawPayloadJson: raw as unknown as Record<string, unknown>,
    normalizedPayloadJson: {},
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
  comprador: MpOrdenCompraRaw['Comprador'],
  unidad: MpOrdenCompraRaw['Unidad'],
): string | undefined {
  if (comprador && 'CodigoOrganismo' in comprador) return comprador.CodigoOrganismo;
  return unidad?.Organismo?.Codigo;
}

function extractBuyerOrgName(
  comprador: MpOrdenCompraRaw['Comprador'],
  unidad: MpOrdenCompraRaw['Unidad'],
): string | undefined {
  if (comprador && 'NombreOrganismo' in comprador) return comprador.NombreOrganismo;
  return unidad?.Organismo?.Nombre;
}

function extractBuyerUnitCode(
  comprador: MpOrdenCompraRaw['Comprador'],
  unidad: MpOrdenCompraRaw['Unidad'],
): string | undefined {
  if (comprador && 'CodigoUnidad' in comprador) return comprador.CodigoUnidad;
  return unidad?.Codigo;
}

function extractBuyerUnitName(
  comprador: MpOrdenCompraRaw['Comprador'],
  unidad: MpOrdenCompraRaw['Unidad'],
): string | undefined {
  if (comprador && 'NombreUnidad' in comprador) return comprador.NombreUnidad;
  return unidad?.Nombre;
}

function buildNormalizedPayload(data: NormalizedOrdenCompra): Record<string, unknown> {
  const { rawPayloadJson: _raw, normalizedPayloadJson: _norm, ...rest } = data;
  return rest as unknown as Record<string, unknown>;
}
