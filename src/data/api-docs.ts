// ─── Animus API Docs & Endpoint Constants ────────────────────────────────

const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const ANIMUS_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://fcdhcntyvsydnvjwopfe.supabase.co';

export const BASE = isLocal
  ? '/supabase-api/api-v1'
  : `${ANIMUS_SUPABASE_URL}/functions/v1/api-v1`;

export interface EndpointDoc {
  section: string;
  method: string;
  path: string;
  description: string;
  color: string;
  params: Array<{ name: string; type: string; required: boolean; description: string }>;
  responseExample: string;
  errorCodes: string[];
}

export const API_DOCS: EndpointDoc[] = [
  // ── SECCIÓN 1: Mercado Público (B2G / ChileCompra) ───────────────────────────
  {
    section: 'Mercado Público (B2G)',
    method: 'GET', path: '/api/v1/mercado-publico/health', color: '#F59E0B',
    description: 'Estado operativo de servicios de Mercado Público (V1 + Compra Ágil V2).',
    params: [],
    responseExample: '{\n  "data": { "status": "ok", "sources": { "mercado_publico_v1": "operational", "compra_agil_v2": "operational" } }\n}',
    errorCodes: ['503 Service unavailable'],
  },
  {
    section: 'Mercado Público (B2G)',
    method: 'GET', path: '/api/v1/mercado-publico/opportunities', color: '#F59E0B',
    description: 'Buscador Unificado: Combina licitaciones tradicionales y compras ágiles en una sola consulta.',
    params: [
      { name: 'q', type: 'string', required: false, description: 'Término de búsqueda' },
      { name: 'type', type: 'string', required: false, description: 'Tipo: tender | agile_purchase' },
      { name: 'status', type: 'string', required: false, description: 'Estado: publicada | cerrada | adjudicada' },
      { name: 'page', type: 'number', required: false, description: 'Página (default: 1)' },
      { name: 'page_size', type: 'number', required: false, description: 'Límite (default: 20)' },
    ],
    responseExample: '{\n  "data": [{ "id": "...", "external_code": "1234-56-LE26", "title": "Servicios TI", "source_type": "tender" }],\n  "meta": { "page": 1, "total": 142 }\n}',
    errorCodes: ['401 Unauthorized', '429 Rate limit exceeded'],
  },
  {
    section: 'Mercado Público (B2G)',
    method: 'GET', path: '/api/v1/mercado-publico/licitaciones', color: '#F59E0B',
    description: 'Listado paginado de licitaciones públicas de ChileCompra con filtros por rango de fechas, estado u organismo comprador.',
    params: [
      { name: 'fecha_inicio', type: 'string', required: false, description: 'Fecha de inicio (YYYY-MM-DD)' },
      { name: 'fecha_fin', type: 'string', required: false, description: 'Fecha de término (YYYY-MM-DD)' },
      { name: 'estado', type: 'string', required: false, description: 'Estado: publicada | cerrada | adjudicada | desierta' },
      { name: 'codigo_organismo', type: 'string', required: false, description: 'Código o RUT del organismo comprador' },
      { name: 'q', type: 'string', required: false, description: 'Término de búsqueda en título' },
      { name: 'page', type: 'number', required: false, description: 'Página (default: 1)' },
      { name: 'page_size', type: 'number', required: false, description: 'Límite (default: 20, máx: 100)' },
    ],
    responseExample: '{\n  "data": [\n    { "id": "...", "external_code": "1234-56-LE26", "title": "Servicios TI", "status_code": "publicada" }\n  ],\n  "meta": { "page": 1, "page_size": 20, "total": 142 }\n}',
    errorCodes: ['401 Unauthorized', '429 Rate limit exceeded'],
  },
  {
    section: 'Mercado Público (B2G)',
    method: 'GET', path: '/api/v1/mercado-publico/licitaciones/:codigo_externo', color: '#F59E0B',
    description: 'Detalle completo de una licitación específica (ej. 1234-56-LE26), incluyendo ítems, fechas clave y documentos adjuntos.',
    params: [
      { name: 'codigo_externo', type: 'string', required: true, description: 'Código único de la licitación (ej: 1234-56-LE26)' },
    ],
    responseExample: '{\n  "data": {\n    "external_code": "1234-56-LE26",\n    "title": "Adquisición de Servidores",\n    "buyer_name": "Hospital San José"\n  }\n}',
    errorCodes: ['401 Unauthorized', '404 Licitación no encontrada'],
  },
  {
    section: 'Mercado Público (B2G)',
    method: 'GET', path: '/api/v1/mercado-publico/compra-agil', color: '#F59E0B',
    description: 'Listado en tiempo real de oportunidades de Compra Ágil del Estado (< 300 UTM / expedita adquisición).',
    params: [
      { name: 'buyer_rut', type: 'string', required: false, description: 'Filtrar por RUT de institución compradora' },
      { name: 'q', type: 'string', required: false, description: 'Término de búsqueda en título' },
      { name: 'page', type: 'number', required: false, description: 'Página (default: 1)' },
    ],
    responseExample: '{\n  "data": [\n    { "external_code": "5678-12-COT26", "title": "Insumos computacionales", "amount_estimated": 450000 }\n  ]\n}',
    errorCodes: ['401 Unauthorized'],
  },
  {
    section: 'Mercado Público (B2G)',
    method: 'GET', path: '/api/v1/mercado-publico/ordenes-compra', color: '#F59E0B',
    description: 'Listado de órdenes de compra (OCs) emitidas por organismos del Estado. Permite filtrar por fecha, RUT proveedor o estado.',
    params: [
      { name: 'fecha', type: 'string', required: false, description: 'Fecha específica (YYYY-MM-DD)' },
      { name: 'rut_proveedor', type: 'string', required: false, description: 'RUT del proveedor adjudicado (ej: 76086428-5)' },
      { name: 'estado', type: 'string', required: false, description: 'Estado: enviada | aceptada | recepcion_conforme' },
      { name: 'codigo_organismo', type: 'string', required: false, description: 'Código del organismo comprador' },
    ],
    responseExample: '{\n  "data": [\n    { "external_code": "1234-56-SE26", "supplier_name": "Scouttech SpA", "total": 45000000, "currency": "CLP" }\n  ]\n}',
    errorCodes: ['401 Unauthorized', '429 Rate limit exceeded'],
  },
  {
    section: 'Mercado Público (B2G)',
    method: 'GET', path: '/api/v1/mercado-publico/ordenes-compra/:codigo_oc', color: '#F59E0B',
    description: 'Detalle completo de la orden de compra (ej: 1234-56-SE26) con precios unitarios, productos/servicios exactos y proveedor.',
    params: [
      { name: 'codigo_oc', type: 'string', required: true, description: 'Código único de la OC (ej: 1234-56-SE26)' },
    ],
    responseExample: '{\n  "data": {\n    "external_code": "1234-56-SE26",\n    "supplier_name": "Empresa SpA",\n    "total": 12500000\n  }\n}',
    errorCodes: ['401 Unauthorized', '404 Orden no encontrada'],
  },
  {
    section: 'Mercado Público (B2G)',
    method: 'GET', path: '/api/v1/mercado-publico/organismos', color: '#F59E0B',
    description: 'Directorio y búsqueda de organismos compradores del Estado (Ministerios, Municipalidades, Hospitales).',
    params: [
      { name: 'nombre', type: 'string', required: false, description: 'Nombre o parte del nombre de la institución (ej: MINEDUC)' },
      { name: 'rut', type: 'string', required: false, description: 'RUT o código de la institución' },
    ],
    responseExample: '{\n  "data": [\n    { "buyer_org_code": "6921", "buyer_name": "Ministerio de Educación" }\n  ]\n}',
    errorCodes: ['401 Unauthorized'],
  },
  {
    section: 'Mercado Público (B2G)',
    method: 'GET', path: '/api/v1/mercado-publico/organismos/:id', color: '#F59E0B',
    description: 'Ficha de un organismo comprador del Estado y sus órdenes de compra recientes emitidas.',
    params: [
      { name: 'id', type: 'string', required: true, description: 'Código del organismo (ej: 6921)' },
    ],
    responseExample: '{\n  "data": {\n    "buyer_id": "6921",\n    "purchase_orders": [...]\n  }\n}',
    errorCodes: ['401 Unauthorized', '404 Organismo no encontrado'],
  },
  {
    section: 'Mercado Público (B2G)',
    method: 'GET', path: '/api/v1/mercado-publico/proveedores/:rut', color: '#F59E0B',
    description: 'Perfil B2G público de una empresa: órdenes de compra adjudicadas, ticket promedio, buyer intelligence y B2G Maturity Score.',
    params: [
      { name: 'rut', type: 'string', required: true, description: 'RUT de la empresa (ej: 76086428-5)' },
    ],
    responseExample: '{\n  "data": {\n    "rut": "76086428-5",\n    "nombre_empresa": "Scouttech SpA",\n    "b2g_maturity": { "b2g_maturity_score": 72, "nivel": "alto" }\n  }\n}',
    errorCodes: ['400 RUT inválido', '401 Unauthorized', '503 Datos no disponibles'],
  },
  {
    section: 'Mercado Público (B2G)',
    method: 'GET', path: '/api/v1/mercado-publico/proveedores/:rut/vs-mercado', color: '#F59E0B',
    description: 'Comparativa de facturación B2G y ticket promedio del proveedor contra los cuartiles p25/p50/p75 de su rubro UNSPSC.',
    params: [
      { name: 'rut', type: 'string', required: true, description: 'RUT del proveedor (ej: 76086428-5)' },
    ],
    responseExample: '{\n  "data": {\n    "comparativa": {\n      "facturacion": { "proveedor_clp": 125800000, "mercado_mediana_clp": 15000000, "posicion": "sobre_p75" }\n    }\n  }\n}',
    errorCodes: ['400 RUT inválido', '401 Unauthorized'],
  },
  {
    section: 'Mercado Público (B2G)',
    method: 'GET', path: '/api/v1/mercado-publico/proveedores/:rut/oportunidades', color: '#F59E0B',
    description: 'Licitaciones públicas y compras ágiles activas rankeadas por algoritmo de relevancia para el perfil del proveedor.',
    params: [
      { name: 'rut', type: 'string', required: true, description: 'RUT del proveedor (ej: 76086428-5)' },
      { name: 'limit', type: 'number', required: false, description: 'Máximo de resultados (default: 10, máx: 50)' },
    ],
    responseExample: '{\n  "data": {\n    "total_encontradas": 5,\n    "oportunidades": [\n      { "codigo": "1234-56-LE26", "relevancia_score": 0.95 }\n    ]\n  }\n}',
    errorCodes: ['400 RUT inválido', '401 Unauthorized'],
  },
  {
    section: 'Mercado Público (B2G)',
    method: 'GET', path: '/api/v1/mercado-publico/benchmarks', color: '#F59E0B',
    description: 'Benchmarks B2G agregados por rubro UNSPSC y región: volumen total, medianas, percentiles p25/p75 y concentración.',
    params: [
      { name: 'unspsc', type: 'string', required: false, description: 'Código UNSPSC del rubro (ej: 43232200)' },
      { name: 'region', type: 'string', required: false, description: 'Código de región Chile (ej: 13 para RM)' },
    ],
    responseExample: '{\n  "data": {\n    "volumen": { "licitaciones_publicadas": 342, "monto_total_ocs_clp": 4850000000 }\n  }\n}',
    errorCodes: ['401 Unauthorized'],
  },
  {
    section: 'Mercado Público (B2G)',
    method: 'GET', path: '/api/v1/mercado-publico/metricas/:rut', color: '#F59E0B',
    description: 'Métricas consolidadas M1 a M10 de Mercado Público pre-calculadas para una empresa (volúmenes, ticket promedio, PMO de pago).',
    params: [
      { name: 'rut', type: 'string', required: true, description: 'RUT de la empresa (ej: 76086428-5)' },
    ],
    responseExample: '{\n  "rut": "76086428-5",\n  "metricas": { "m1_volumen_anual": 125000000, "m4_ticket_promedio": 8900000 }\n}',
    errorCodes: ['400 RUT inválido', '404 Sin métricas calculadas'],
  },

  // ── SECCIÓN 1.2: Mercado Público (Fase 2 Comercial B2G) ─────────────────────
  {
    section: 'Mercado Público (B2G)',
    method: 'GET', path: '/api/v1/mercado-publico/analitica/precios', color: '#F59E0B',
    description: 'Analítica de precios unitarios por UNSPSC: percentiles p10 a p90, mediana de adjudicación y sugerencia algorítmica Animus AI.',
    params: [
      { name: 'unspsc_code', type: 'string', required: true, description: 'Código UNSPSC del bien o servicio (ej: 43233205)' },
      { name: 'periodo_meses', type: 'number', required: false, description: 'Horizonte temporal en meses (default: 12)' }
    ],
    responseExample: '{\n  "unspsc_code": "43233205",\n  "percentiles": { "p10": 1850000, "p25": 4250000, "p50": 8500000, "p75": 14200000 },\n  "winning_price_median": 7800000\n}',
    errorCodes: ['400 UNSPSC requerido', '401 Unauthorized']
  },
  {
    section: 'Mercado Público (B2G)',
    method: 'GET', path: '/api/v1/mercado-publico/compradores/:rut/historial', color: '#F59E0B',
    description: 'Perfilamiento 360° del comprador: días reales de pago, cumplimiento de Ley 30 días, licitaciones desiertas % y presupuesto ejecutado.',
    params: [
      { name: 'rut', type: 'string', required: true, description: 'RUT del organismo comprador (ej: 69.070.100-6)' }
    ],
    responseExample: '{\n  "rut": "69.070.100-6",\n  "dias_pago": "38 Días Hábiles",\n  "cumplimiento_ley30": "78.5%",\n  "reclamos": 14\n}',
    errorCodes: ['400 RUT inválido', '401 Unauthorized']
  },
  {
    section: 'Mercado Público (B2G)',
    method: 'GET', path: '/api/v1/mercado-publico/proveedores/:rut/perfil-competitivo', color: '#F59E0B',
    description: 'Scorecard de competidor: Win-Rate %, ticket promedio, estatus ChileProveedores/F30-1 y radar de coincidencia en subastas directas.',
    params: [
      { name: 'rut', type: 'string', required: true, description: 'RUT del proveedor competidor' }
    ],
    responseExample: '{\n  "rut": "76.543.210-K",\n  "win_rate": "34.8%",\n  "chileproveedores": "PROVEEDOR HÁBIL",\n  "competidores": [...]\n}',
    errorCodes: ['400 RUT inválido', '401 Unauthorized']
  },
  {
    section: 'Mercado Público (B2G)',
    method: 'POST', path: '/api/v1/mercado-publico/busquedas/guardadas', color: '#F59E0B',
    description: 'Almacena queries multi-criterio complejas y las sincroniza automáticamente con tu CRM (Salesforce / HubSpot).',
    params: [
      { name: 'name', type: 'string', required: true, description: 'Nombre descriptivo de la búsqueda' },
      { name: 'query_params', type: 'object', required: true, description: 'Filtros aplicados (region, unspsc, amount_gt)' }
    ],
    responseExample: '{\n  "id": "sq_xyz789",\n  "status": "ACTIVE",\n  "created_at": "2026-07-27T16:00:00Z"\n}',
    errorCodes: ['400 Datos inválidos', '401 Unauthorized']
  },
  {
    section: 'Mercado Público (B2G)',
    method: 'POST', path: '/api/v1/mercado-publico/alertas', color: '#F59E0B',
    description: 'Registra reglas de notificación en tiempo real vía Slack, Email o Teams según presupuesto o competidores.',
    params: [
      { name: 'rule_name', type: 'string', required: true, description: 'Nombre de la regla' },
      { name: 'channels', type: 'array', required: true, description: 'Canales: ["SLACK", "EMAIL"]' }
    ],
    responseExample: '{\n  "id": "alert_123",\n  "rule_name": "Alerta Presupuesto > 1.000 UTM"\n}',
    errorCodes: ['400 Parámetros requeridos', '401 Unauthorized']
  },
  {
    section: 'Mercado Público (B2G)',
    method: 'POST', path: '/api/v1/mercado-publico/webhooks', color: '#F59E0B',
    description: 'Suscripción a Webhooks Push Event (`tender.published`, `tender.awarded`, `po.issued`) con firma HMAC SHA-256.',
    params: [
      { name: 'target_url', type: 'string', required: true, description: 'URL HTTPS receptora' },
      { name: 'events', type: 'array', required: true, description: 'Lista de eventos a suscribir' }
    ],
    responseExample: '{\n  "subscription_id": "sub_8812",\n  "secret": "whsec_sha256_..."\n}',
    errorCodes: ['400 URL inválida', '401 Unauthorized']
  },
  {
    section: 'Mercado Público (B2G)',
    method: 'POST', path: '/api/v1/mercado-publico/exportaciones', color: '#F59E0B',
    description: 'Generación de descargas masivas de datasets estructurados de Mercado Público en formatos JSONL, CSV y Apache Parquet.',
    params: [
      { name: 'format', type: 'string', required: true, description: 'Formato: jsonl | csv | parquet' }
    ],
    responseExample: '{\n  "job_id": "export_9912",\n  "download_url": "https://downloads.animus.ai/dumps/mp_2026.jsonl.gz"\n}',
    errorCodes: ['400 Formato no soportado', '401 Unauthorized']
  },

  // ── SECCIÓN 1.3: Mercado Público (Fase 3 IA Predictiva & Modalidades) ─────────
  {
    section: 'Mercado Público (B2G)',
    method: 'GET', path: '/api/v1/mercado-publico/convenio-marco', color: '#C084FC',
    description: 'Catálogo unificado de Convenios Marco vigentes en ChileCompra con precios pactados y tiendas virtuales.',
    params: [],
    responseExample: '{\n  "total_convenios_vigentes": 18,\n  "convenios": [{ "id": "2239-4-LR24", "nombre": "Convenio Marco Vehículos" }]\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Mercado Público (B2G)',
    method: 'GET', path: '/api/v1/mercado-publico/grandes-compras', color: '#C084FC',
    description: 'Monitor de Grandes Compras dentro de Convenio Marco para adquisiciones masivas del Estado (> 1.000 UTM).',
    params: [],
    responseExample: '{\n  "grandes_compras_activas": 14,\n  "items": [{ "code": "GC-1057469", "budget_clp": 240000000 }]\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Mercado Público (B2G)',
    method: 'GET', path: '/api/v1/mercado-publico/consultas-mercado', color: '#C084FC',
    description: 'Consultas al Mercado (RFIs) abiertas por organismos públicos para estimar presupuestos antes de licitar.',
    params: [],
    responseExample: '{\n  "rfis_activos": 8,\n  "items": [{ "code": "RFI-608-2024", "title": "Sondeo Radares DGAC" }]\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Mercado Público (B2G)',
    method: 'GET', path: '/api/v1/mercado-publico/tratos-directos', color: '#C084FC',
    description: 'Auditoría de Tratos Directos y resoluciones fundadas por causales de emergencia o proveedor único (Art. 8 Ley 19.886).',
    params: [],
    responseExample: '{\n  "tratos_directos_registrados": 64,\n  "items": [{ "code": "TD-1266-9", "causal": "Art. 8 C - Emergencia" }]\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Mercado Público (B2G)',
    method: 'POST', path: '/api/v1/mercado-publico/ai/scoring-oportunidad', color: '#C084FC',
    description: 'Algoritmo de scoring que evalúa la compatibilidad (0-100 pts) entre el perfil del proveedor y la licitación.',
    params: [
      { name: 'external_code', type: 'string', required: true, description: 'Código de la licitación o compra ágil' }
    ],
    responseExample: '{\n  "opportunity_score": 92,\n  "score_level": "ALTA COMPATIBILIDAD",\n  "breakdown": { "technical_match": "96/100" }\n}',
    errorCodes: ['400 Código requerido', '401 Unauthorized']
  },
  {
    section: 'Mercado Público (B2G)',
    method: 'POST', path: '/api/v1/mercado-publico/ai/prediccion-adjudicacion', color: '#C084FC',
    description: 'Modelo predictivo de Win Probability % basado en la oferta ingresada en CLP y la mediana del mercado.',
    params: [
      { name: 'external_code', type: 'string', required: true, description: 'Código de licitación' },
      { name: 'offer_clp', type: 'number', required: true, description: 'Monto de la oferta en pesos CLP' }
    ],
    responseExample: '{\n  "win_probability": "86.4%",\n  "proposed_offer_clp": 4850000,\n  "optimal_offer_target": 4500000\n}',
    errorCodes: ['400 Oferta requerida', '401 Unauthorized']
  },
  {
    section: 'Mercado Público (B2G)',
    method: 'GET', path: '/api/v1/mercado-publico/ai/recomendaciones/:rut', color: '#C084FC',
    description: 'Motor de recomendaciones inteligentes con las top 5 oportunidades personalizadas por RUT de proveedor.',
    params: [
      { name: 'rut', type: 'string', required: true, description: 'RUT de la empresa proveedora' }
    ],
    responseExample: '{\n  "rut_proveedor": "76.543.210-K",\n  "items": [{ "code": "1180703-12-L126", "match_pct": "96%" }]\n}',
    errorCodes: ['400 RUT requerido', '401 Unauthorized']
  },

  // ── SECCIÓN 2: Datos Económicos, Macroeconómicos y Financieros (Dominio v2.0) ────────────
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/economy/chile/snapshot', color: '#2DD4BF',
    description: 'Snapshot macroeconómico consolidado de Chile: UF, UTM, IPC, TPM, Dólar, Imacec y Desempleo.',
    params: [],
    responseExample: '{\n  "data": {\n    "chile_snapshot": { "uf": { "value": 37842.15 }, "ipc": { "value": 0.3 } }\n  }\n}',
    errorCodes: ['401 Unauthorized', '503 Data unavailable']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/economy/chile/uf', color: '#2DD4BF',
    description: 'Valor actual e histórico de la Unidad de Fomento (UF) y proyección de cierre de mes.',
    params: [],
    responseExample: '{\n  "data": { "current_value": 37842.15, "currency": "CLP" }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/economy/chile/ipc', color: '#2DD4BF',
    description: 'IPC mensual, inflación acumulada 12 meses e inflación subyacente (INE).',
    params: [],
    responseExample: '{\n  "data": { "monthly_change": 0.3, "accumulated_12m": 3.8 }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/economy/chile/tpm', color: '#2DD4BF',
    description: 'Tasa de Política Monetaria (TPM), postura monetaria e historial de decisiones (BCCh).',
    params: [],
    responseExample: '{\n  "data": { "rate": 5.75, "unit": "%" }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/economy/chile/imacec', color: '#2DD4BF',
    description: 'Imacec total, minero y no minero (Banco Central de Chile).',
    params: [],
    responseExample: '{\n  "data": { "change_yoy": 1.8, "breakdown": { "mining_imacec": 3.4 } }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/economy/chile/gdp', color: '#2DD4BF',
    description: 'PIB nominal, real y crecimiento por componentes y sectores económicos.',
    params: [],
    responseExample: '{\n  "data": { "gdp_nominal_usd_billions": 340.5, "gdp_real_growth_yoy": 2.1 }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/economy/chile/exchange-rates', color: '#2DD4BF',
    description: 'Paridad Dólar Observado (USD/CLP) y monedas internacionales.',
    params: [],
    responseExample: '{\n  "data": { "pair": "USD/CLP", "rate": 942.50 }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/economy/chile/trade-balance', color: '#2DD4BF',
    description: 'Balanza comercial de Chile: exportaciones e importaciones de productos.',
    params: [],
    responseExample: '{\n  "data": { "trade_balance_usd_millions": 1240 }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/economy/chile/ipom', color: '#2DD4BF',
    description: 'Metadatos, proyecciones y tono monetario extraídos del IPoM.',
    params: [],
    responseExample: '{\n  "data": { "report_id": "ipom_2026_06", "gdp_range_forecast": "1.75% - 2.75%" }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/economy/indicators', color: '#2DD4BF',
    description: 'Catálogo completo de indicadores económicos disponibles en la plataforma.',
    params: [],
    responseExample: '{\n  "data": { "total_indicators": 24 }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/economy/releases', color: '#2DD4BF',
    description: 'Últimas publicaciones y boletines macroeconómicos oficiales.',
    params: [],
    responseExample: '{\n  "data": { "latest_releases": [...] }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/economy/calendar', color: '#2DD4BF',
    description: 'Calendario consolidado de próximas publicaciones económicas.',
    params: [],
    responseExample: '{\n  "data": { "upcoming_events": [...] }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/economy/series/:series_id', color: '#2DD4BF',
    description: 'Serie de tiempo histórica normalizada de cualquier indicador por su ID.',
    params: [
      { name: 'series_id', type: 'string', required: true, description: 'ID de la serie (ej: CL_IMACEC_TOTAL)' }
    ],
    responseExample: '{\n  "data": { "series_id": "CL_IMACEC_TOTAL", "observations": [...] }\n}',
    errorCodes: ['401 Unauthorized', '404 Serie no encontrada']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/economy/global/snapshot', color: '#2DD4BF',
    description: 'Snapshot macro global: Inflación EE. UU., Tasa Fed, Cobre y WTI.',
    params: [],
    responseExample: '{\n  "data": { "us_fed_rate": 5.25, "copper_usd_lb": 4.25 }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/commodities', color: '#2DD4BF',
    description: 'Catálogo de commodities y materias primas (Cobre, Litio, Petróleo WTI, Oro).',
    params: [],
    responseExample: '{\n  "data": { "commodities": [...] }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/commodities/snapshot', color: '#2DD4BF',
    description: 'Snapshot de cotizaciones en tiempo real de commodities.',
    params: [],
    responseExample: '{\n  "data": { "commodities": [{ "symbol": "COPPER", "price": 4.25 }] }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/commodities/copper', color: '#2DD4BF',
    description: 'Precio spot y futuros del Cobre en LME / COMEX (USD/lb y USD/ton).',
    params: [],
    responseExample: '{\n  "data": { "symbol": "COPPER_HG=F", "price_usd_lb": 4.25 }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/markets', color: '#2DD4BF',
    description: 'Snapshot de mercados financieros relevantes para Chile.',
    params: [],
    responseExample: '{\n  "data": { "status": "operational" }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/markets/chile/ipsa', color: '#2DD4BF',
    description: 'Cotización, variación e histórico del Índice IPSA Bolsa de Santiago.',
    params: [],
    responseExample: '{\n  "data": { "symbol": "^IPSA", "current_value": 6540.20 }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/financial-system/entities', color: '#2DD4BF',
    description: 'Directorio y buscador de entidades fiscalizadas por la CMF (Bancos, Aseguradoras).',
    params: [],
    responseExample: '{\n  "data": { "total_entities": 480 }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/companies/insolvencies', color: '#2DD4BF',
    description: 'Boletín Concursal: Registro de reorganizaciones judiciales y liquidadas.',
    params: [],
    responseExample: '{\n  "data": { "total_active_cases": 12 }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/companies/:rut/insolvency-status', color: '#2DD4BF',
    description: 'Radar Forense: Verificación de estado concursal por RUT de empresa.',
    params: [
      { name: 'rut', type: 'string', required: true, description: 'RUT de la empresa a consultar' }
    ],
    responseExample: '{\n  "data": { "status": "clean", "status_label": "Sin Procedimientos Concursales Activos" }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/companies/:rut/economic-profile', color: '#2DD4BF',
    description: 'Perfil unificado de empresa: salud financiera, riesgo y actividad B2G.',
    params: [
      { name: 'rut', type: 'string', required: true, description: 'RUT de la empresa' }
    ],
    responseExample: '{\n  "data": { "financial_health_score": 88 }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/companies/:rut/public-procurement/metrics', color: '#2DD4BF',
    description: 'Métricas M1-M10 de compras públicas por RUT de proveedor.',
    params: [
      { name: 'rut', type: 'string', required: true, description: 'RUT de la empresa' }
    ],
    responseExample: '{\n  "data": { "metrics": { "m1_annual_volume_clp": 125000000 } }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/companies/:rut/profile', color: '#2DD4BF',
    description: 'S-Pulse: Perfil societario canónico (RUT, Razón Social, Fecha Constitución Diario Oficial, Capital Social).',
    params: [
      { name: 'rut', type: 'string', required: true, description: 'RUT de la empresa' }
    ],
    responseExample: '{\n  "data": { "legal_name": "Electromedicina Chile SpA", "company_type": "SpA", "social_capital_clp": 150000000 }\n}',
    errorCodes: ['401 Unauthorized', '400 Invalid RUT']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/companies/:rut/ownership-mesh', color: '#2DD4BF',
    description: 'S-Pulse: Malla societaria completa (Nodos de personas/sociedades y % de participación accionararia).',
    params: [
      { name: 'rut', type: 'string', required: true, description: 'RUT de la empresa' }
    ],
    responseExample: '{\n  "data": [ { "partner_name": "Luciano Alonso Larraín", "ownership_percentage": 60.0, "role": "shareholder" } ]\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/companies/:rut/legal-representatives', color: '#2DD4BF',
    description: 'S-Pulse: Lista de representantes legales vigentes y facultades de administración inscritas.',
    params: [
      { name: 'rut', type: 'string', required: true, description: 'RUT de la empresa' }
    ],
    responseExample: '{\n  "data": [ { "name": "Luciano Alonso Larraín", "role": "Representante Legal Principal", "powers": ["Firma Bancaria"] } ]\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/companies/:rut/related-parties', color: '#2DD4BF',
    description: 'S-Pulse: Red de sociedades relacionadas (matrices, filiales y empresas hermanas con socios compartidos).',
    params: [
      { name: 'rut', type: 'string', required: true, description: 'RUT de la empresa' }
    ],
    responseExample: '{\n  "data": [ { "company_name": "Inversiones Médicas del Sur SpA", "relationship_type": "matriz" } ]\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'POST', path: '/api/v1/data/companies/:rut/b2g-conflicts', color: '#2DD4BF',
    description: 'S-Pulse: Detector de conflictos de interés B2G y cruzamiento de socios en licitaciones de Mercado Público.',
    params: [
      { name: 'rut', type: 'string', required: true, description: 'RUT de la empresa' }
    ],
    responseExample: '{\n  "data": { "conflict_detected": false, "risk_level": "LOW", "pep_matches": [] }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/companies/search', color: '#2DD4BF',
    description: 'S-Pulse: Buscador predictivo de empresas por RUT o Razón Social.',
    params: [
      { name: 'q', type: 'string', required: true, description: 'Término de búsqueda (RUT o Razón Social)' }
    ],
    responseExample: '{\n  "data": [ { "rut": "76.543.210-K", "legal_name": "Electromedicina Chile SpA" } ]\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/labor', color: '#2DD4BF',
    description: 'Snapshot del mercado laboral chileno.',
    params: [],
    responseExample: '{\n  "data": { "unemployment_rate_national": 8.3 }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/labor/unemployment', color: '#2DD4BF',
    description: 'Tasa de desocupación INE nacional y por regiones.',
    params: [],
    responseExample: '{\n  "data": { "unemployment_rate_national": 8.3 }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/labor/wages', color: '#2DD4BF',
    description: 'Índice de Remuneraciones (IR Real) e Índice de Costo de Mano de Obra (ICMO).',
    params: [],
    responseExample: '{\n  "data": { "ir_real_yoy": 6.8 }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/investment-projects', color: '#2DD4BF',
    description: 'Pipeline de Proyectos de Inversión SEIA ($ CapEx en minería/energía).',
    params: [],
    responseExample: '{\n  "data": { "pipeline_capex_usd": 14500000000 }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/company-events/constitutions', color: '#2DD4BF',
    description: 'Nuevas constituciones de sociedades en el Diario Oficial.',
    params: [],
    responseExample: '{\n  "data": { "constitutions_this_month": 1420 }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'GET', path: '/api/v1/data/analytics/correlations', color: '#2DD4BF',
    description: 'Matriz de correlación cruzada en tiempo real entre series de tiempo.',
    params: [],
    responseExample: '{\n  "data": { "correlation_matrix": { "COPPER_vs_USDCLP": -0.84 } }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'POST', path: '/api/v1/data/insights/macro-brief', color: '#2DD4BF',
    description: 'Informe de síntesis macroeconómica generado por IA Doctrina Animus.',
    params: [],
    responseExample: '{\n  "data": { "summary": "La economía chilena muestra señales de estabilización..." }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'POST', path: '/api/v1/data/insights/scenario-analysis', color: '#2DD4BF',
    description: 'Simulación generativa de escenarios económicos con IA (ej: variación Cobre/Tasa/Dólar).',
    params: [
      { name: 'scenario', type: 'object', required: true, description: 'Objeto con variaciones en %' }
    ],
    responseExample: '{\n  "data": { "simulated_impacts": { "imacec_growth_adjusted": "+0.9%" } }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'Datos Económicos & Macro',
    method: 'POST', path: '/api/v1/data/exports', color: '#2DD4BF',
    description: 'Generación y descarga de exportaciones masivas de datos económicos (JSON, CSV, Parquet).',
    params: [
      { name: 'format', type: 'string', required: true, description: 'Formato: json | csv | parquet' }
    ],
    responseExample: '{\n  "data": { "export_id": "exp_123", "status": "READY" }\n}',
    errorCodes: ['401 Unauthorized']
  },

  // ── SECCIÓN 3: Animus Intelligence & GraphRAG (Cliente-Centric v2.0) ──────
  {
    section: 'GraphRAG & Intelligence',
    method: 'POST', path: '/api/v1/intel/query', color: '#8B5CF6',
    description: 'Consulta inteligente unificada Animus: enrutamiento automático entre los 5 expertos (Macro, Mercados, Unit Econ, Legal, Estrategia) con evidencia citable.',
    params: [
      { name: 'query', type: 'string', required: true, description: 'Pregunta en lenguaje natural' },
      { name: 'routing', type: 'string', required: false, description: 'Modo de enrutamiento: "auto" | "manual"' },
      { name: 'context', type: 'object', required: false, description: '{ company_rut?, sector?, country? }' }
    ],
    responseExample: '{\n  "data": {\n    "answer_id": "ans_01K...",\n    "executive_summary": "...",\n    "findings": [...],\n    "citations": [...]\n  }\n}',
    errorCodes: ['400 Body inválido', '401 Unauthorized']
  },
  {
    section: 'GraphRAG & Intelligence',
    method: 'GET', path: '/api/v1/intel/experts', color: '#8B5CF6',
    description: 'Catálogo de capacidades, jurisdicciones y fuentes de los 5 expertos de Inteligencia Animus.',
    params: [],
    responseExample: '{\n  "data": {\n    "total_experts": 5,\n    "experts": [{ "id": "macro", "name": "Macroeconomic Expert" }]\n  }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'GraphRAG & Intelligence',
    method: 'POST', path: '/api/v1/intel/experts/:expert_id/query', color: '#8B5CF6',
    description: 'Consulta dirigida exclusivamente a un experto específico (macro, markets, unit-economics, legal, b2g-strategy).',
    params: [
      { name: 'expert_id', type: 'string', required: true, description: 'ID del experto (ej: macro, legal)' },
      { name: 'query', type: 'string', required: true, description: 'Pregunta para el experto' }
    ],
    responseExample: '{\n  "data": {\n    "expert_consulted": "macro",\n    "findings": [...]\n  }\n}',
    errorCodes: ['401 Unauthorized', '404 Experto no encontrado']
  },
  {
    section: 'GraphRAG & Intelligence',
    method: 'POST', path: '/api/v1/intel/assessments/tender-fit', color: '#8B5CF6',
    description: 'Evaluación determinista de compatibilidad (0-100 pts) entre empresa y licitación B2G.',
    params: [
      { name: 'company', type: 'object', required: true, description: '{ rut: "76.123.456-7" }' },
      { name: 'tender', type: 'object', required: true, description: '{ code: "1180703-12-L126" }' }
    ],
    responseExample: '{\n  "data": {\n    "fit_score": 84,\n    "recommendation": "participate_with_conditions",\n    "dimensions": { "technical_fit": 91 }\n  }\n}',
    errorCodes: ['400 Parámetros requeridos', '401 Unauthorized']
  },
  {
    section: 'GraphRAG & Intelligence',
    method: 'POST', path: '/api/v1/intel/assessments/company-risk', color: '#8B5CF6',
    description: 'Evaluación determinista de riesgo concursal CMF, legal y de crédito por RUT de empresa.',
    params: [
      { name: 'company_rut', type: 'string', required: true, description: 'RUT de la empresa a evaluar' }
    ],
    responseExample: '{\n  "data": {\n    "insolvency_status": "clean",\n    "insolvency_risk_score": 12,\n    "financial_health_index": 88\n  }\n}',
    errorCodes: ['400 RUT requerido', '401 Unauthorized']
  },
  {
    section: 'GraphRAG & Intelligence',
    method: 'POST', path: '/api/v1/intel/assessments/macro-impact', color: '#8B5CF6',
    description: 'Evaluación de impacto de variaciones macroeconómicas (TPM, Dólar, UF) en el modelo de negocio.',
    params: [
      { name: 'inputs', type: 'object', required: true, description: '{ sector: "salud", currency_exposure: ["USD"] }' }
    ],
    responseExample: '{\n  "data": {\n    "impact_level": "MODERATE",\n    "key_drivers": [...]\n  }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'GraphRAG & Intelligence',
    method: 'POST', path: '/api/v1/intel/assessments/win-probability', color: '#8B5CF6',
    description: 'Estimación determinista de Win Probability % basado en la oferta ofertada en CLP vs la mediana histórica.',
    params: [
      { name: 'offer_clp', type: 'number', required: true, description: 'Monto de la oferta en pesos CLP' }
    ],
    responseExample: '{\n  "data": { "estimated_win_probability": "86.4%", "optimal_target_clp": 4500000 }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'GraphRAG & Intelligence',
    method: 'POST', path: '/api/v1/intel/assessments/buyer-profile', color: '#8B5CF6',
    description: 'Perfilamiento 360° determinista del comprador: días de pago, cumplimiento Ley 30 días y reclamos.',
    params: [
      { name: 'buyer_rut', type: 'string', required: true, description: 'RUT del organismo comprador' }
    ],
    responseExample: '{\n  "data": { "payment_days_avg": 38, "compliance_30_days_pct": 78.5 }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'GraphRAG & Intelligence',
    method: 'POST', path: '/api/v1/intel/assessments/legal-basis', color: '#8B5CF6',
    description: 'Fundamentación legal y cuerpo normativo aplicable detectado para un contrato o trato directo.',
    params: [],
    responseExample: '{\n  "data": { "applicable_laws": [{ "law_number": "Ley 19.886", "article": "Art. 8 C" }] }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'GraphRAG & Intelligence',
    method: 'POST', path: '/api/v1/intel/assessments/regulatory-compliance', color: '#8B5CF6',
    description: 'Matriz de cumplimiento y brechas normativas (Ley Fintec 21.521 y Protección de Datos 21.719).',
    params: [],
    responseExample: '{\n  "data": { "compliance_score": 92, "gaps": [] }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'GraphRAG & Intelligence',
    method: 'POST', path: '/api/v1/intel/reports', color: '#8B5CF6',
    description: 'Generación asíncrona de informe ejecutivo estratégico B2G/Macro en Markdown y PDF.',
    params: [
      { name: 'report_type', type: 'string', required: true, description: 'Tipo: tender_strategy | macro_risk' },
      { name: 'title', type: 'string', required: false, description: 'Título del informe' }
    ],
    responseExample: '{\n  "data": {\n    "job_id": "job_123",\n    "status": "completed",\n    "report_id": "report_882"\n  }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'GraphRAG & Intelligence',
    method: 'GET', path: '/api/v1/intel/jobs/:job_id', color: '#8B5CF6',
    description: 'Consulta de estado de generación del informe asíncrono (queued, processing, completed).',
    params: [
      { name: 'job_id', type: 'string', required: true, description: 'ID del trabajo asíncrono' }
    ],
    responseExample: '{\n  "data": { "job_id": "job_123", "status": "completed", "progress_pct": 100 }\n}',
    errorCodes: ['401 Unauthorized', '404 Trabajo no encontrado']
  },
  {
    section: 'GraphRAG & Intelligence',
    method: 'GET', path: '/api/v1/intel/reports/:report_id', color: '#8B5CF6',
    description: 'Obtiene el informe ejecutivo generado y su contenido completo.',
    params: [
      { name: 'report_id', type: 'string', required: true, description: 'ID del informe' }
    ],
    responseExample: '{\n  "data": { "report_id": "report_123", "title": "...", "content_markdown": "..." }\n}',
    errorCodes: ['401 Unauthorized', '404 Informe no encontrado']
  },
  {
    section: 'GraphRAG & Intelligence',
    method: 'GET', path: '/api/v1/intel/citations/:citation_id', color: '#8B5CF6',
    description: 'Trazabilidad y verificación de la cita original, localizador y hash de integridad.',
    params: [
      { name: 'citation_id', type: 'string', required: true, description: 'ID de la cita (ej: cit_bcch_tpm)' }
    ],
    responseExample: '{\n  "data": {\n    "citation_id": "cit_bcch_tpm",\n    "source": { "provider": "bcch", "official": true },\n    "verification": { "status": "verified" }\n  }\n}',
    errorCodes: ['401 Unauthorized', '404 Cita no encontrada']
  },
  {
    section: 'GraphRAG & Intelligence',
    method: 'POST', path: '/api/v1/intel/citations/:citation_id/verify', color: '#8B5CF6',
    description: 'Verificación de integridad sha256 e hipervínculo activo a la fuente oficial original.',
    params: [
      { name: 'citation_id', type: 'string', required: true, description: 'ID de la cita' }
    ],
    responseExample: '{\n  "data": { "verification": { "status": "verified", "source_available": true } }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'GraphRAG & Intelligence',
    method: 'GET', path: '/api/v1/intel/graph/entities', color: '#8B5CF6',
    description: 'Buscador de entidades e instituciones en el Grafo de Conocimiento Multidominio.',
    params: [
      { name: 'q', type: 'string', required: true, description: 'Término de búsqueda (ej: MINEDUC)' }
    ],
    responseExample: '{\n  "data": { "total_entities": 1, "entities": [{ "entity_id": "org_mineduc" }] }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'GraphRAG & Intelligence',
    method: 'GET', path: '/api/v1/intel/graph/entities/:entity_id/neighbors', color: '#8B5CF6',
    description: 'Exploración de vecinos directos y tipos de relación de un nodo en el Grafo.',
    params: [
      { name: 'entity_id', type: 'string', required: true, description: 'ID del nodo (ej: org_mineduc)' }
    ],
    responseExample: '{\n  "data": { "neighbors": [{ "label": "Licitación Software", "relationship": "published_by" }] }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'GraphRAG & Intelligence',
    method: 'POST', path: '/api/v1/intel/graph/paths', color: '#8B5CF6',
    description: 'Encuentra el camino más corto entre dos entidades en el Grafo de Conocimiento Multidominio.',
    params: [
      { name: 'from', type: 'object', required: true, description: '{ rut: "76.123.456-7" }' },
      { name: 'to', type: 'object', required: true, description: '{ id: "org_mineduc" }' }
    ],
    responseExample: '{\n  "data": { "path_found": true, "score": 0.89, "nodes": [...] }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'GraphRAG & Intelligence',
    method: 'POST', path: '/api/v1/intel/sessions', color: '#8B5CF6',
    description: 'Crea una sesión conversacional aislada por tenant con retención de contexto.',
    params: [
      { name: 'name', type: 'string', required: true, description: 'Nombre de la sesión' }
    ],
    responseExample: '{\n  "data": { "session_id": "sess_123", "status": "active" }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'GraphRAG & Intelligence',
    method: 'POST', path: '/api/v1/intel/sessions/:session_id/messages', color: '#8B5CF6',
    description: 'Envía un mensaje subsiguiente dentro del hilo de conversación conservando la memoria.',
    params: [
      { name: 'session_id', type: 'string', required: true, description: 'ID de la sesión' },
      { name: 'message', type: 'string', required: true, description: 'Texto del mensaje' }
    ],
    responseExample: '{\n  "data": { "message_id": "msg_8812", "response": "..." }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'GraphRAG & Intelligence',
    method: 'POST', path: '/api/v1/intel/estimate', color: '#8B5CF6',
    description: 'Estimador previo de créditos y latencia esperada según la consulta y expertos a activar.',
    params: [
      { name: 'operation', type: 'string', required: true, description: 'Operación: query | report' }
    ],
    responseExample: '{\n  "data": { "estimated_credits": { "minimum": 18, "maximum": 35 } }\n}',
    errorCodes: ['401 Unauthorized']
  },

  // ── SECCIÓN 4: Animus Vault, RAG Vectorial & Colecciones v2.0 ──────────────
  {
    section: 'RAG & Vault Vectorial',
    method: 'POST', path: '/api/v1/rag/query', color: '#0EB5C6',
    description: 'Recuperación de evidencia documental mediante búsqueda híbrida (vectorial HNSW + coincidencia léxica) con reranking y ubicaciones exactas por página y sección.',
    params: [
      { name: 'query', type: 'string', required: true, description: 'Consulta semántica o léxica' },
      { name: 'scope', type: 'object', required: false, description: '{ vault_ids: ["vault_01"], collection_ids: ["col_01"] }' },
      { name: 'search', type: 'object', required: false, description: '{ mode: "hybrid", top_k: 20, rerank: true }' }
    ],
    responseExample: '{\n  "data": {\n    "query_id": "qry_01K...",\n    "results": [\n      {\n        "rank": 1,\n        "chunk_id": "chk_iso_27001",\n        "document_title": "Bases Licitación.pdf",\n        "location": { "page": 18, "section": "4.2 Requisitos" },\n        "scores": { "vector": 0.86, "lexical": 0.74, "reranker": 0.92, "final": 0.89 }\n      }\n    ]\n  }\n}',
    errorCodes: ['401 Unauthorized', '429 Rate limit exceeded']
  },
  {
    section: 'RAG & Vault Vectorial',
    method: 'POST', path: '/api/v1/rag/vaults', color: '#0EB5C6',
    description: 'Crea un contenedor de seguridad y retención documental (Vault) aislado por workspace.',
    params: [
      { name: 'name', type: 'string', required: true, description: 'Nombre del Vault (ej: Licitaciones 2026)' },
      { name: 'settings', type: 'object', required: false, description: '{ retention_days: 365, allow_public_corpus_fusion: false }' }
    ],
    responseExample: '{\n  "data": { "id": "vault_01K...", "name": "Vault Licitaciones 2026", "status": "active" }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'RAG & Vault Vectorial',
    method: 'GET', path: '/api/v1/rag/vaults', color: '#0EB5C6',
    description: 'Listado de Vaults accesibles por el tenant en el workspace actual.',
    params: [],
    responseExample: '{\n  "data": { "total_vaults": 2, "vaults": [{ "id": "vault_default", "documents_count": 42 }] }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'RAG & Vault Vectorial',
    method: 'GET', path: '/api/v1/rag/vaults/:vault_id/stats', color: '#0EB5C6',
    description: 'Estadísticas de uso del Vault: total de documentos, versiones, chunks, vectores y almacenamiento.',
    params: [
      { name: 'vault_id', type: 'string', required: true, description: 'ID del Vault' }
    ],
    responseExample: '{\n  "data": { "documents": { "total": 42 }, "chunks": 1420, "storage": { "source_bytes": 48500000 } }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'RAG & Vault Vectorial',
    method: 'POST', path: '/api/v1/rag/vaults/:vault_id/collections', color: '#0EB5C6',
    description: 'Crea una colección lógica de documentos dentro de un Vault para agrupaciones o proyectos específicos.',
    params: [
      { name: 'vault_id', type: 'string', required: true, description: 'ID del Vault' },
      { name: 'name', type: 'string', required: true, description: 'Nombre de la colección' }
    ],
    responseExample: '{\n  "data": { "id": "col_123", "name": "Licitación Hospital Regional" }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'RAG & Vault Vectorial',
    method: 'POST', path: '/api/v1/rag/documents/text', color: '#0EB5C6',
    description: 'Ingesta e indexación directa de texto plano con chunking semántico en el Vault y colección destino.',
    params: [
      { name: 'vault_id', type: 'string', required: true, description: 'ID del Vault' },
      { name: 'title', type: 'string', required: true, description: 'Título del documento' },
      { name: 'content', type: 'string', required: true, description: 'Texto completo a vectorizar' }
    ],
    responseExample: '{\n  "data": { "document_id": "doc_01K...", "chunks_created": 4, "status": "ready" }\n}',
    errorCodes: ['400 Texto inválido', '401 Unauthorized']
  },
  {
    section: 'RAG & Vault Vectorial',
    method: 'POST', path: '/api/v1/rag/documents/file', color: '#0EB5C6',
    description: 'Carga multipart/form-data de archivos (PDF, DOCX, TXT) con extracción automática y chunking.',
    params: [
      { name: 'file', type: 'file', required: true, description: 'Archivo binario a procesar' },
      { name: 'vault_id', type: 'string', required: false, description: 'ID del Vault destino' }
    ],
    responseExample: '{\n  "data": { "document_id": "doc_01K...", "pages_processed": 24, "chunks_created": 86 }\n}',
    errorCodes: ['400 Archivo illegible', '401 Unauthorized']
  },
  {
    section: 'RAG & Vault Vectorial',
    method: 'POST', path: '/api/v1/rag/uploads', color: '#0EB5C6',
    description: 'Genera una URL firmada presigned de carga directa para documentos grandes (múltiples MB).',
    params: [
      { name: 'filename', type: 'string', required: true, description: 'Nombre del archivo' }
    ],
    responseExample: '{\n  "data": { "upload_id": "upl_01K...", "upload_url": "https://storage.animus.cl/..." }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'RAG & Vault Vectorial',
    method: 'POST', path: '/api/v1/rag/batches', color: '#0EB5C6',
    description: 'Ingesta masiva asíncrona batch de colecciones de documentos.',
    params: [
      { name: 'vault_id', type: 'string', required: true, description: 'ID del Vault' },
      { name: 'documents', type: 'array', required: true, description: 'Array de documentos a ingestar' }
    ],
    responseExample: '{\n  "data": { "batch_id": "batch_01K...", "status": "processing", "documents_queued": 5 }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'RAG & Vault Vectorial',
    method: 'GET', path: '/api/v1/rag/documents', color: '#0EB5C6',
    description: 'Búsqueda y listado de documentos indexados con filtros por Vault, colección y estado.',
    params: [
      { name: 'vault_id', type: 'string', required: false, description: 'Filtrar por Vault' }
    ],
    responseExample: '{\n  "data": { "total_documents": 2, "documents": [{ "id": "doc_bases_123", "title": "Bases.pdf" }] }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'RAG & Vault Vectorial',
    method: 'DELETE', path: '/api/v1/rag/documents/:document_id', color: '#0EB5C6',
    description: 'Inicia el trabajo asíncrono de purga segura de un documento, sus versiones y sus vectores.',
    params: [
      { name: 'document_id', type: 'string', required: true, description: 'ID del documento a eliminar' }
    ],
    responseExample: '{\n  "data": { "deletion_job_id": "del_01K...", "status": "queued" }\n}',
    errorCodes: ['401 Unauthorized', '404 Documento no encontrado']
  },
  {
    section: 'RAG & Vault Vectorial',
    method: 'GET', path: '/api/v1/rag/documents/:document_id/chunks', color: '#0EB5C6',
    description: 'Inspección de fragmentos vectorizados y ubicaciones dentro del documento.',
    params: [
      { name: 'document_id', type: 'string', required: true, description: 'ID del documento' }
    ],
    responseExample: '{\n  "data": { "total_chunks": 2, "chunks": [{ "chunk_id": "chk_01", "content": "..." }] }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'RAG & Vault Vectorial',
    method: 'POST', path: '/api/v1/rag/context', color: '#0EB5C6',
    description: 'Generador de Context Packs optimizados para LLMs externos con presupuesto estricto de tokens.',
    params: [
      { name: 'query', type: 'string', required: true, description: 'Consulta semántica' },
      { name: 'budget', type: 'object', required: false, description: '{ max_tokens: 6000 }' }
    ],
    responseExample: '{\n  "data": { "context_formatted": "## Contexto...", "estimated_tokens": 420 }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'RAG & Vault Vectorial',
    method: 'GET', path: '/api/v1/rag/embedding-profiles', color: '#0EB5C6',
    description: 'Catálogo de perfiles estables de embeddings (`multilingual-default`, `legal-es`).',
    params: [],
    responseExample: '{\n  "data": { "profiles": [{ "id": "multilingual-default", "dimensions": 1536 }] }\n}',
    errorCodes: ['401 Unauthorized']
  },
  {
    section: 'RAG & Vault Vectorial',
    method: 'POST', path: '/api/v1/rag/estimate', color: '#0EB5C6',
    description: 'Estimador previo de créditos y latencia por ingesta o procesamiento documental.',
    params: [
      { name: 'operation', type: 'string', required: true, description: 'Operación: ingest_file | query' }
    ],
    responseExample: '{\n  "data": { "estimated_credits": { "minimum": 5, "maximum": 12 } }\n}',
    errorCodes: ['401 Unauthorized']
  },

  // ── SECCIÓN 5: Grafo Societario y Mallas (S-Pulse) ─────────────────────────
  {
    section: 'Grafo Societario (S-Pulse)',
    method: 'GET', path: '/api/v1/data/spulse/companies/search', color: '#3B82F6',
    description: 'Buscador de empresas por razón social o RUT (mínimo 2 caracteres) en el registro societario chileno.',
    params: [
      { name: 'q', type: 'string', required: true, description: 'Término de búsqueda o RUT' },
    ],
    responseExample: '{\n  "data": [{ "rut": "76123456K", "business_name": "Scouttech SpA" }]\n}',
    errorCodes: ['401 Unauthorized', '503 S-Pulse no disponible'],
  },
  {
    section: 'Grafo Societario (S-Pulse)',
    method: 'GET', path: '/api/v1/data/spulse/companies/:rut/profile', color: '#3B82F6',
    description: 'Ficha 360° societaria: composición de socios, % de participación, directiva y banderas de riesgo.',
    params: [
      { name: 'rut', type: 'string', required: true, description: 'RUT de la empresa (ej: 76123456K)' },
    ],
    responseExample: '{\n  "data": {\n    "company": { "business_name": "Scouttech SpA" },\n    "members": [{ "name": "Luciano", "share_percentage": 50 }]\n  }\n}',
    errorCodes: ['401 Unauthorized', '503 S-Pulse no disponible'],
  },
  {
    section: 'Grafo Societario (S-Pulse)',
    method: 'GET', path: '/api/v1/data/spulse/companies/:rut/network', color: '#3B82F6',
    description: 'Grafo de redes: Nodos y aristas formateados para renderizar mallas societarias y holdings en la interfaz UI.',
    params: [
      { name: 'rut', type: 'string', required: true, description: 'RUT de la empresa' },
    ],
    responseExample: '{\n  "data": { "nodes": [...], "edges": [...] }\n}',
    errorCodes: ['401 Unauthorized', '503 S-Pulse no disponible'],
  },
  {
    section: 'Grafo Societario (S-Pulse)',
    method: 'GET', path: '/api/v1/data/spulse/relationships/:rel_id/source', color: '#3B82F6',
    description: 'Trazabilidad legal auditable: Muestra el extracto del Diario Oficial o escritura fuente de la relación.',
    params: [
      { name: 'rel_id', type: 'string', required: true, description: 'ID de la relación societaria' },
    ],
    responseExample: '{\n  "data": { "source_document": "Diario Oficial Edición 43.102", "date": "2024-05-12" }\n}',
    errorCodes: ['401 Unauthorized'],
  },

  // ── SECCIÓN 6: Webhooks & Validación ─────────────────────────────────────
  {
    section: 'Webhooks & Servicios',
    method: 'POST', path: '/api/v1/validate', color: '#10B981',
    description: 'Wizard MegaPrompt: Ejecución de análisis de validación de startup (Score 0-100 + 18 entregables).',
    params: [
      { name: 'startup_profile', type: 'object', required: true, description: 'Objeto con datos del emprendimiento' },
    ],
    responseExample: '{\n  "score": 84,\n  "deliverables": { "market_sizing": {}, "unit_economics": {} }\n}',
    errorCodes: ['400 Invalid profile', '401 Unauthorized'],
  },
  {
    section: 'Webhooks & Servicios',
    method: 'POST', path: '/api/v1/webhooks', color: '#10B981',
    description: 'Registra una URL HTTPS para recibir eventos asíncronos en tiempo real (alertas de Radar, licitaciones relevantes).',
    params: [
      { name: 'url', type: 'string', required: true, description: 'URL HTTPS del webhook' },
      { name: 'event', type: 'string', required: true, description: 'Nombre del evento' },
    ],
    responseExample: '{\n  "id": "wh_xyz789",\n  "url": "https://mi-sistema.cl/webhook",\n  "event": "radar.signal"\n}',
    errorCodes: ['400 Invalid URL', '401 Unauthorized'],
  },
  {
    section: 'Webhooks & Servicios',
    method: 'GET', path: '/health/services', color: '#10B981',
    description: 'Health check general de microservicios e infraestructura de Animus.',
    params: [],
    responseExample: '{\n  "status": "healthy",\n  "services": { "database": "ok", "railway_worker": "ok" }\n}',
    errorCodes: [],
  },
];

export interface PlaygroundEndpoint {
  method: string;
  path: string;
  label: string;
  color: string;
  defaultBody: string;
}

export const ENDPOINTS: readonly PlaygroundEndpoint[] = [
  {
    method: 'GET',
    path: '/api/v1/mercado-publico/licitaciones?estado=publicada',
    label: 'Mercado Público — Buscador de Licitaciones',
    color: '#F59E0B',
    defaultBody: '',
  },
  {
    method: 'GET',
    path: '/api/v1/mercado-publico/compra-agil',
    label: 'Mercado Público — Oportunidades Compra Ágil',
    color: '#F59E0B',
    defaultBody: '',
  },
  {
    method: 'GET',
    path: '/api/v1/mercado-publico/ordenes-compra?rut_proveedor=76086428-5',
    label: 'Mercado Público — Listado de Órdenes de Compra',
    color: '#F59E0B',
    defaultBody: '',
  },
  {
    method: 'GET',
    path: '/api/v1/mercado-publico/proveedores/76086428-5',
    label: 'Mercado Público — Perfil B2G del Proveedor',
    color: '#F59E0B',
    defaultBody: '',
  },
  {
    method: 'GET',
    path: '/api/v1/mercado-publico/proveedores/76086428-5/vs-mercado',
    label: 'Mercado Público — Comparativa Proveedor vs Mercado',
    color: '#F59E0B',
    defaultBody: '',
  },
  {
    method: 'GET',
    path: '/api/v1/mercado-publico/proveedores/76086428-5/oportunidades',
    label: 'Mercado Público — Licitaciones Recomendadas para Proveedor',
    color: '#F59E0B',
    defaultBody: '',
  },
  {
    method: 'GET',
    path: '/api/v1/mercado-publico/organismos?nombre=MINEDUC',
    label: 'Mercado Público — Directorio de Organismos',
    color: '#F59E0B',
    defaultBody: '',
  },
  {
    method: 'GET',
    path: '/api/v1/mercado-publico/benchmarks',
    label: 'Mercado Público — Benchmarks Sectoriales B2G',
    color: '#F59E0B',
    defaultBody: '',
  },
  {
    method: 'GET',
    path: '/api/v1/mercado-publico/metricas/76086428-5',
    label: 'Mercado Público — Métricas Consolidadas M1-M10',
    color: '#F59E0B',
    defaultBody: '',
  },
  {
    method: 'GET',
    path: '/api/v1/data/economy',
    label: 'Economy — Snapshot Macroeconómico Chile',
    color: '#2DD4BF',
    defaultBody: '',
  },
  {
    method: 'GET',
    path: '/api/v1/data/macro',
    label: 'Macro — Indicadores Globales FRED',
    color: '#2DD4BF',
    defaultBody: '',
  },
  {
    method: 'POST',
    path: '/api/v1/intel/query',
    label: 'Intel — GraphRAG Unificado (Macro + Normativa)',
    color: '#8B5CF6',
    defaultBody: JSON.stringify({
      query: '¿Cómo afecta la tasa de la Fed a las startups de crédito en Chile?',
      startup_context: { industry: 'fintech', stage: 'seed', geography: 'chile' },
      top_k: 5,
    }, null, 2),
  },
  {
    method: 'POST',
    path: '/api/v1/intel/query/moe',
    label: 'Intel — Mixture of Experts (MoE 5 Expertos)',
    color: '#8B5CF6',
    defaultBody: JSON.stringify({
      query: 'Analiza el impacto del aumento del salario mínimo en el sector retail',
      max_experts: 3,
    }, null, 2),
  },
  {
    method: 'POST',
    path: '/api/v1/rag/query',
    label: 'RAG — Búsqueda Semántica Vectorial pgvector',
    color: '#0EB5C6',
    defaultBody: JSON.stringify({ query: '¿Qué exige la Ley 21.719 de datos personales en Chile?' }, null, 2),
  },
  {
    method: 'POST',
    path: '/api/v1/rag/ingest/text',
    label: 'Vault — Indexar Texto al Espacio Privado',
    color: '#EC4899',
    defaultBody: JSON.stringify({ texts: ['Información corporativa privada para consultas RAG.'], metadata: { source: 'demo' } }, null, 2),
  },
  {
    method: 'GET',
    path: '/api/v1/data/spulse/companies/search?q=Scouttech',
    label: 'S-Pulse — Buscador de Empresas y RUTs',
    color: '#3B82F6',
    defaultBody: '',
  },
  {
    method: 'GET',
    path: '/api/v1/data/spulse/companies/76123456K/profile',
    label: 'S-Pulse — Ficha 360° Societaria y Malla',
    color: '#3B82F6',
    defaultBody: '',
  },
] as const;

export const METHOD_COLORS: Record<string, string> = {
  POST: '#0EB5C6',
  GET: '#2DD4BF',
  DELETE: '#EF4444',
};

export const WEBHOOK_EVENTS = [
  { value: 'radar.signal',       label: 'Señal del Radar Forense' },
  { value: 'tender.published',   label: 'Nueva Licitación Publicada' },
  { value: 'po.created',          label: 'Nueva Orden de Compra Adjudicada' },
];

export const LOGS_PER_PAGE = 15;
