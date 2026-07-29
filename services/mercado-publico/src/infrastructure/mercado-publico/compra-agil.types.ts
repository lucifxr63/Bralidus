/**
 * Tipos de la API Compra Ágil v2 de Mercado Público.
 *
 * OJO: NO es la API v1 de licitaciones/órdenes de compra. Es un servicio
 * distinto (host `api2.mercadopublico.cl`), con auth por header, envelope
 * propio y nomenclatura snake_case en español. Las Compras Ágiles NO aparecen
 * en `publico/licitaciones.json`: pedirle el detalle de un código COT devuelve
 * HTTP 500. Los tipos B2/L1 de la API v1 son otra cosa.
 *
 * Doc oficial: docs/Documentacion_API_Compra_Agil.pdf (Guía v3.0, mayo 2026).
 */

// ── Envelope ────────────────────────────────────────────────

export type CompraAgilError = {
  codigo: string;
  mensaje: string;
  detalle: string | null;
};

export type CompraAgilEnvelope<T> = {
  success: 'OK' | 'NOK';
  trace: string | null;
  payload: T | null;
  errors: CompraAgilError[] | null;
};

export type CompraAgilPaginacion = {
  total_paginas: number;
  numero_pagina: number;
  tamano_pagina: number;
  total_resultados: number;
};

export type CompraAgilListPayload = {
  items: CompraAgilListItem[];
  paginacion: CompraAgilPaginacion;
};

// ── Estructuras compartidas ─────────────────────────────────

/**
 * `oc_emitida` está definido en el modelo pero no se usa en la práctica: una
 * Compra Ágil con OC emitida queda en `proveedor_seleccionado` (ver §5.1 de la
 * guía). El indicador confiable de OC es `id_orden_compra != null`.
 */
export type CompraAgilEstadoCodigo =
  | 'publicada'
  | 'cerrada'
  | 'desierta'
  | 'cancelada'
  | 'proveedor_seleccionado'
  | 'oc_emitida';

export type CompraAgilEstado = {
  id_estado: number;
  /** Uno de `CompraAgilEstadoCodigo`; se tipa laxo porque la API está en beta. */
  codigo: string;
  glosa: string;
};

/** 1 = primer llamado, 2 = segundo llamado. */
export type CompraAgilConvocatoria = {
  estado_convocatoria: number | null;
  descripcion: string | null;
  fecha_cierre_primer_llamado?: string | null;
  fecha_cierre_segundo_llamado?: string | null;
};

export type CompraAgilInstitucion = {
  organismo_comprador: string | null;
  rut: string | null;
  unidad_compra: string | null;
  region: number | null;
  nombre_region: string | null;
};

export type CompraAgilDocumento = {
  id: string;
  nombre: string;
};

export type CompraAgilMotivos = {
  motivo_cancelacion: string | null;
  motivo_desierta: string | null;
  motivo_seleccion?: string | null;
};

// ── Listado ─────────────────────────────────────────────────

export type CompraAgilListItem = {
  codigo: string;
  nombre: string | null;
  estado: CompraAgilEstado | null;
  convocatoria: CompraAgilConvocatoria | null;
  documentos: CompraAgilDocumento[] | null;
  fechas: {
    fecha_publicacion: string | null;
    fecha_cierre: string | null;
    fecha_ultimo_cambio: string | null;
    fecha_cancelacion: string | null;
    fecha_cierre_primer_llamado?: string | null;
    fecha_cierre_segundo_llamado?: string | null;
  } | null;
  montos: {
    moneda: string | null;
    monto_disponible: number | null;
    monto_disponible_clp: number | null;
  } | null;
  institucion: CompraAgilInstitucion | null;
  resumen: { total_ofertas_recibidas: number | null } | null;
  motivos: CompraAgilMotivos | null;
  links: { detalle: string | null } | null;
};

// ── Detalle ─────────────────────────────────────────────────

export type CompraAgilProductoSolicitado = {
  /** UNSPSC. La API lo devuelve como número; se persiste como texto. */
  codigo_producto: number | string | null;
  nombre: string | null;
  descripcion: string | null;
  cantidad: number | null;
  unidad_medida: string | null;
};

export type CompraAgilProveedorCotizando = {
  rut_proveedor: string | null;
  razon_social: string | null;
  /** Empresa de Menor Tamaño — relevante para Ley 21.634. */
  es_emt: boolean | null;
  monto_total: number | null;
  [key: string]: unknown;
};

export type CompraAgilDetalle = {
  codigo: string;
  nombre: string | null;
  descripcion: string | null;
  estado: CompraAgilEstado | null;
  convocatoria: CompraAgilConvocatoria | null;
  fechas: {
    fecha_publicacion: string | null;
    fecha_cierre: string | null;
    fecha_ultimo_cambio: string | null;
    fecha_cancelacion: string | null;
  } | null;
  entrega: {
    direccion_entrega: string | null;
    plazo_entrega_dias: number | null;
  } | null;
  documentos: CompraAgilDocumento[] | null;
  presupuesto: {
    tipo_presupuesto: string | null;
    moneda: string | null;
    presupuesto_estimado: number | null;
    monto_disponible: number | null;
    monto_disponible_clp: number | null;
    valor_cambio_moneda: number | null;
    fecha_cambio_moneda: string | null;
  } | null;
  /**
   * Indicador confiable de OC emitida (`codigo_orden_compra` y
   * `estado_orden_compra` retornan null aunque exista la OC — ver §6.3).
   * En la respuesta real viene al nivel raíz, no bajo `orden_compra`.
   */
  id_orden_compra: number | null;
  orden_compra?: {
    id_orden_compra: number | null;
    id_oc: number | null;
    codigo_orden_compra: string | null;
    estado_orden_compra: string | null;
  } | null;
  institucion: CompraAgilInstitucion | null;
  productos_solicitados: CompraAgilProductoSolicitado[] | null;
  proveedores_cotizando: CompraAgilProveedorCotizando[] | null;
  resumen: {
    multa_sancion: number | null;
    total_ofertas_recibidas: number | null;
    total_demandas: number | null;
  } | null;
  motivos: CompraAgilMotivos | null;
  flags: {
    considera_requisitos_medioambientales: boolean | null;
    considera_requisitos_impacto_social_economico: boolean | null;
  } | null;
};
