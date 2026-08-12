// ============================================================
// External API DTOs - Mercado Público raw response shapes
// These are typed "best effort" - the API docs are incomplete
// ============================================================

export type MpApiResponse<T> = {
  Cantidad: number;
  FechaCreacion: string;
  Version: string;
  Listado: T[];
};

// ── Licitación raw ──────────────────────────────────────────

export type MpLicitacionRaw = {
  CodigoExterno: string;
  Nombre: string;
  CodigoEstado: number;
  DescripcionEstado?: string;
  // Estado como texto (Publicada, Cerrada, Adjudicada, Desierta, Revocada, Suspendida)
  Estado?: string;
  Tipo: string; // L1, LE, LP, LQ, LR, LS, E2, CO, B2, H2, I2
  CodigoTipo?: number; // 1=Pública, 2=Privada
  TipoConvocatoria?: number; // 1=Abierto, 0=Cerrada
  Moneda?: string; // CLP, CLF, USD, UTM, EUR
  Etapas?: number;
  EstadoEtapas?: number;
  TomaRazon?: number; // 1=con toma de razón
  Obras?: number; // 0=No, 2=Sí
  CantidadReclamos?: number;
  DiasCierreLicitacion?: number;
  Informada?: number; // 1=Sí, 0=No
  EsBaseTipo?: number; // 1=Sí, 0=No
  ExtensionPlazo?: number; // 1=Extiende, 0=No
  Contrato?: number; // 1=requiere suscripción, 2=formaliza con OC
  EstadoPublicidadOfertas?: number;
  SubContratacion?: number; // 1=Sí, 0=No (también puede venir como Subcontratacion)
  Subcontratacion?: number;
  EsRenovable?: number; // 1=Sí, 0=No
  ValorTiempoRenovacion?: number;
  PeriodoTiempoRenovacion?: string;

  // Fechas planas (a veces la API las devuelve así)
  FechaPublicacion?: string;
  FechaCierre?: string;
  FechaAdjudicacion?: string;
  FechaCreacion?: string;

  // Fechas agrupadas (estructura Fechas)
  Fechas?: {
    FechaCreacion?: string;
    FechaCierre?: string;
    FechaInicio?: string; // inicio foro
    FechaFinal?: string; // fin foro
    FechaPubRespuestas?: string;
    FechaActoAperturaTecnica?: string;
    FechaActoAperturaEconomica?: string;
    FechaPublicacion?: string;
    FechaAdjudicacion?: string;
    FechaEstimadaAdjudicacion?: string;
    FechaSoporteFisico?: string;
    FechaTiempoEvaluacion?: string;
    FechaEstimadaFirma?: string;
    FechaVisitaTerreno?: string;
    FechaEntregaAntecedentes?: string;
  };

  Descripcion?: string;
  DireccionVisita?: string;
  DireccionEntrega?: string;

  Unidad?: {
    Codigo: string;
    Nombre: string;
    RutUnidad: string;
    DireccionUnidad: string;
    RegionUnidad: string;
    ComunaUnidad: string;
    Organismo?: {
      Codigo: string;
      Nombre: string;
    };
  };
  Comprador?: {
    CodigoOrganismo: string;
    NombreOrganismo: string;
    CodigoUnidad: string;
    NombreUnidad: string;
    RutUnidad: string;
    DireccionUnidad: string;
    RegionUnidad: string;
    ComunaUnidad: string;
    RutUsuario?: string;
    CodigoUsuario?: string;
    NombreUsuario?: string;
    CargoUsuario?: string;
  };

  MontoEstimado?: number;
  VisibilidadMonto?: number; // 1=público, 0=oculto
  Estimacion?: number; // 1=Presupuesto, 2=Precio Referencial, 3=No estimable
  JustificacionMontoEstimado?: string;
  MonedasAdicionales?: {
    Cantidad: number;
    Listado: MpMonedaAdicional[];
  };

  // Modalidad de pago (1=30días, 2=30-60-90, 3=al día, etc.)
  Modalidad?: number;
  TipoPago?: number;
  FuenteFinanciamiento?: number;

  // Responsable de pago
  NombreResponsablePago?: string;
  EmailResponsablePago?: string;

  // Responsable de contrato
  NombreResponsableContrato?: string;
  EmailResponsableContrato?: string;
  FonoResponsableContrato?: string;

  ProhibicionContratacion?: string;

  // Duración del contrato
  TiempoDuracionContrato?: number;
  UnidadTiempoDuracionContrato?: number; // 1=Horas, 2=Días, 3=Semanas, 4=Meses, 5=Años
  TipoDuracionContrato?: string;
  UnidadTiempoContratoLicitacion?: number;
  UnidadTiempoEvaluacion?: number;
  TiempoEvaluacion?: number;
  TiempoEvaluacionLabel?: string;

  Contacto?: {
    Nombre: string;
    Email: string;
    Fono: string;
  };

  Adjudicacion?: {
    Tipo?: number; // 1=Autorización, 2=Resolución, 3=Acuerdo, 4=Decreto, 5=Otros
    Fecha?: string;
    Numero?: string;
    NumeroOferentes?: number;
    UrlActa?: string;
  };

  Items?: {
    Cantidad: number;
    Listado: MpItemLicitacion[];
  };
};

export type MpMonedaAdicional = {
  Tipo: string;
  Monto: number;
  MontoPesos: number;
};

export type MpItemLicitacion = {
  Correlativo: number;
  CodigoProducto: string;
  CodigoCategoria: string;
  Categoria: string;
  NombreProducto: string;
  Descripcion?: string;
  UnidadMedida?: string;
  Cantidad?: number;
  CodigoEstadoLicitacion?: number;
  Adjudicacion?: {
    RutProveedor?: string;
    NombreProveedor?: string;
    CantidadAdjudicada?: number;
    MontoUnitario?: number;
  };
};

// ── Orden de Compra raw ─────────────────────────────────────

export type MpOrdenCompraRaw = {
  Codigo: string;
  Nombre?: string;
  CodigoLicitacion?: string;
  Descripcion?: string;
  Tipo: string; // SE=Sin emisión automática, CM=Convenio Marco (abreviación)
  CodigoTipo?: string; // código numérico del tipo
  TipoLabel?: string;
  CodigoEstado?: number;
  Estado?: string;
  CodigoEstadoProveedor?: number;
  EstadoProveedor?: string;
  TieneItems?: number; // 1=Sí, 0=No
  TipoMoneda?: string; // CLP, CLF, USD, UTM, EUR
  TipoDespacho?: number; // 7, 9, 12, 14, 20, 21, 22
  FormaPago?: number; // 1=15días, 2=30días, 39=Otra, 46=50días, 47=60días
  Financiamiento?: string;
  Pais?: string;
  PromedioCalificacion?: number;
  CantidadEvaluacion?: number;

  Fechas?: {
    FechaCreacion?: string;
    FechaEnvio?: string;
    FechaAceptacion?: string;
    FechaCancelacion?: string;
    FechaUltimaModificacion?: string;
  };
  // Fechas planas (según estructura real de la API)
  FechaCreacion?: string;
  FechaEnvio?: string;
  FechaAceptacion?: string;
  FechaCancelacion?: string;
  FechaUltimaModificacion?: string;

  Unidad?: {
    Codigo: string;
    Nombre: string;
    RutUnidad: string;
    DireccionUnidad: string;
    RegionUnidad: string;
    ComunaUnidad: string;
    Actividad?: string;
    Pais?: string;
    NombreContacto?: string;
    CargoContacto?: string;
    FonoContacto?: string;
    MailContacto?: string;
    Organismo?: {
      Codigo: string;
      Nombre: string;
    };
  };
  Comprador?: {
    CodigoOrganismo?: string;
    NombreOrganismo?: string;
    CodigoUnidad?: string;
    NombreUnidad?: string;
    RutUnidad?: string;
    Actividad?: string;
    DireccionUnidad?: string;
    ComunaUnidad?: string;
    RegionUnidad?: string;
    Pais?: string;
    NombreContacto?: string;
    CargoContacto?: string;
    FonoContacto?: string;
    MailContacto?: string;
  };
  Proveedor?: {
    Codigo?: string;
    CodigoProveedor?: string;
    Nombre: string;
    Rut?: string;
    RutSucursal?: string;
    Actividad?: string;
    CodigoSucursal?: string;
    NombreSucursal?: string;
    Direccion?: string;
    Comuna?: string;
    Region?: string;
    Pais?: string;
    NombreContacto?: string;
    CargoContacto?: string;
    FonoContacto?: string;
    MailContacto?: string;
  };
  Montos?: {
    TotalNeto: number;
    Impuestos: number;
    PorcentajeIva?: number;
    TotalCargo?: number;
    Descuentos?: number;
    Cargos?: number;
    Total: number;
    Moneda: string;
  };
  // Montos planos (según estructura real de la API)
  TotalNeto?: number;
  Impuestos?: number;
  PorcentajeIva?: number;
  Descuentos?: number;
  Cargos?: number;
  Total?: number;

  Items?: {
    Cantidad: number;
    Listado: MpItemOrdenCompra[];
  };
};

export type MpItemOrdenCompra = {
  Correlativo: number;
  CodigoProducto?: string;
  CodigoCategoria?: string;
  Categoria?: string;
  EspecificacionComprador?: string;
  EspecificacionProveedor?: string;
  Cantidad?: number;
  Moneda?: string;
  PrecioNeto?: number;
  TotalCargos?: number;
  TotalDescuentos?: number;
  TotalImpuestos?: number;
  Total?: number;
};

// ── Normalized internal DTOs ────────────────────────────────

export type NormalizedLicitacion = {
  externalCode: string;
  /**
   * `compra_agil` = proceso COT ingerido desde la API v2 (api2.mercadopublico.cl).
   * Comparte tabla con las licitaciones para heredar matching, pipeline y análisis.
   */
  sourceType: 'mercado_publico' | 'compra_agil';
  title: string;
  description: string | null;

  // Estado
  statusCode: number | null;
  statusLabel: string | null; // Publicada, Cerrada, Adjudicada, Desierta, Revocada, Suspendida

  // Tipo de licitación
  tenderTypeCode: string | null; // L1, LE, LP, LQ, LR, LS, E2, CO, B2, H2, I2, COT
  tenderPublicTypeCode: number | null; // 1=Pública, 2=Privada
  isOpenConvocatory: boolean | null; // true=Abierto, false=Cerrada

  // Comprador
  buyerOrgCode: string | null;
  buyerOrgName: string | null;
  /** RUT de la unidad de compra. v1 lo trae en `Comprador.RutUnidad`; v2 en `institucion.rut`. */
  buyerRut: string | null;
  buyerUnitCode: string | null;
  buyerUnitName: string | null;
  buyerRegion: string | null;
  buyerCommune: string | null;
  buyerAddress: string | null;
  buyerResponsibleUser: string | null;
  /** Cargo del encargado de la unidad de compra (`Comprador.CargoUsuario`). */
  buyerResponsibleRole: string | null;

  // Fechas clave
  publishedAt: string | null;
  closingAt: string | null;
  daysToClose: number | null; // DiasCierreLicitacion — urgencia
  technicalOpeningAt: string | null;
  economicOpeningAt: string | null;
  estimatedAwardAt: string | null;
  awardedAt: string | null;
  forumStartAt: string | null;
  forumEndAt: string | null;
  answersPublishedAt: string | null;
  siteVisitAt: string | null;
  documentsDeadlineAt: string | null;
  estimatedSignAt: string | null;

  // Montos
  currency: string | null; // CLP, CLF, USD, UTM, EUR
  estimatedAmount: number | null;
  amountIsPublic: boolean | null; // VisibilidadMonto
  amountEstimationType: number | null; // 1=Presupuesto, 2=Referencial, 3=No estimable
  amountJustification: string | null;

  // Pago y contrato
  paymentModalityCode: number | null; // Modalidad: 1=30días, 6=Contra entrega, etc.
  contractDurationValue: number | null;
  contractDurationUnit: number | null; // 1=Horas, 2=Días, 3=Semanas, 4=Meses, 5=Años
  contractDurationLabel: string | null;
  isRenewable: boolean | null;
  renewalPeriodLabel: string | null;

  // Responsable de contrato
  contractResponsibleName: string | null;
  contractResponsibleEmail: string | null;
  contractResponsiblePhone: string | null;

  // Características
  allowsSubcontracting: boolean | null;
  requiresContraloria: boolean | null; // TomaRazon
  isConstruction: boolean | null; // Obras
  complaintsCount: number | null; // CantidadReclamos — riesgo del organismo
  autoExtendDeadline: boolean | null; // ExtensionPlazo
  isInformed: boolean | null;

  // Dirección
  visitAddress: string | null;
  deliveryAddress: string | null;

  // Adjudicación
  awardTypeCode: number | null; // 1=Autorización, 2=Resolución, 3=Acuerdo, 4=Decreto
  awardDocumentNumber: string | null;
  awardSuppliersCount: number | null;
  awardActUrl: string | null;

  items: NormalizedLicitacionItem[];
  /**
   * Documentos oficiales del proceso. Sólo Compra Ágil (API v2) los entrega:
   * la v1 de licitaciones NO devuelve adjuntos —verificado sobre 15.387 fichas,
   * ninguna trae clave alguna de adjuntos—, así que ahí queda vacío y eso es un
   * hecho de la fuente, no un pendiente de la ingesta.
   */
  attachments: NormalizedAttachment[];
  rawPayloadJson: Record<string, unknown>;
  normalizedPayloadJson: Record<string, unknown>;
};

/**
 * Un adjunto puede venir de dos fuentes que NO entregan lo mismo, y mezclarlas
 * bajo una forma común haría que un consumidor tratara una página web como si
 * fuera un archivo descargable:
 *
 * · `compra_agil` — un ARCHIVO real, con nombre ("EETT.xlsx"), pero la fuente
 *   nunca da enlace de descarga. `url` va en null.
 * · `ocds_award`  — una PÁGINA que lista los anexos del proceso. El enlace
 *   funciona, pero el listado que hay detrás exige un reCAPTCHA Enterprise, así
 *   que tampoco se puede descargar programáticamente. Sólo existe en procesos
 *   adjudicados.
 *
 * Por eso `tipo` y `descargable` van explícitos en vez de deducirse: hoy
 * `descargable` es `false` en ambos casos, y quien itere esta lista tiene que
 * poder saberlo sin conocer la historia de cada fuente.
 */
export type NormalizedAttachment = {
  id: string | null;
  nombre: string | null;
  /** Enlace, si la fuente lo da. `null` no significa que el documento no exista. */
  url: string | null;
  /** `archivo` = un documento; `pagina` = dónde están listados. */
  tipo: 'archivo' | 'pagina';
  origen: 'compra_agil' | 'ocds_award';
  /** Si se puede bajar sin intervención humana. Hoy siempre `false`. */
  descargable: boolean;
  /**
   * Sólo para `ocds_award`: el token `enc` del enlace se regenera en cada
   * respuesta de OCDS y no se conoce su caducidad. Guardar cuándo se obtuvo es
   * lo que permitirá medirla si algún día empiezan a fallar.
   */
  obtenido_at?: string;
};

export type NormalizedLicitacionItem = {
  lineNumber: number | null;
  productCode: string | null;
  categoryCode: string | null;
  categoryName: string | null;
  productName: string | null;
  description: string | null;
  unitMeasure: string | null;
  quantity: number | null;
  // Datos de adjudicación por línea (disponibles cuando estado=Adjudicada)
  awardedSupplierRut: string | null;
  awardedSupplierName: string | null;
  awardedQuantity: number | null;
  awardedUnitAmount: number | null;
};

export type NormalizedOrdenCompra = {
  externalCode: string;
  name: string | null;
  licitationCode: string | null;
  description: string | null;

  // Tipo y estado
  orderTypeCode: string | null; // SE=Sin emisión, CM=Convenio Marco
  orderTypeLabel: string | null;
  stateCode: number | null;
  supplierStateCode: number | null;
  supplierStateLabel: string | null;

  // Comprador
  buyerOrgCode: string | null;
  buyerOrgName: string | null;
  buyerUnitCode: string | null;
  buyerUnitName: string | null;
  buyerRegion: string | null;
  buyerCommune: string | null;
  buyerContactName: string | null;
  buyerContactEmail: string | null;
  buyerContactPhone: string | null;

  // Proveedor
  supplierCode: string | null;
  supplierRut: string | null;
  supplierName: string | null;
  supplierActivity: string | null;
  supplierRegion: string | null;
  supplierCommune: string | null;
  supplierContactEmail: string | null;
  supplierRating: number | null; // PromedioCalificacion — reputación
  supplierRatingCount: number | null; // CantidadEvaluacion

  // Montos
  currency: string | null;
  totalNet: number | null;
  discounts: number | null;
  charges: number | null;
  vatPercentage: number | null;
  taxes: number | null;
  total: number | null;

  // Logística
  dispatchTypeCode: number | null; // 7=a dirección, 14=retiro bodega, etc.
  paymentMethodCode: number | null; // 1=15días, 2=30días, 47=60días, etc.

  // Fechas
  issuedAt: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  cancelledAt: string | null;
  lastModifiedAt: string | null;

  items: NormalizedOrdenCompraItem[];
  rawPayloadJson: Record<string, unknown>;
  normalizedPayloadJson: Record<string, unknown>;
};

export type NormalizedOrdenCompraItem = {
  lineNumber: number | null;
  productCode: string | null;
  categoryCode: string | null;
  categoryName: string | null;
  buyerSpec: string | null;
  supplierSpec: string | null;
  quantity: number | null;
  currency: string | null;
  unitNetPrice: number | null;
  totalCharges: number | null;
  totalDiscounts: number | null;
  totalTaxes: number | null;
  total: number | null;
};
