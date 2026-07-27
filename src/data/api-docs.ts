// ─── Bralidus API Docs & Endpoint Constants ────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://fcdhcntyvsydnvjwopfe.supabase.co';
export const BASE = `${SUPABASE_URL}/functions/v1/api-v1`;

export interface EndpointDoc {
  method: string;
  path: string;
  description: string;
  color: string;
  params: Array<{ name: string; type: string; required: boolean; description: string }>;
  responseExample: string;
  errorCodes: string[];
}

export const API_DOCS: EndpointDoc[] = [
  // Mercado Público (B2G Canónico)
  {
    method: 'GET', path: '/api/v1/mercado-publico/licitaciones', color: '#F59E0B',
    description: 'Obtiene un listado paginado de licitaciones públicas de ChileCompra con filtros por rango de fechas, estado u organismo comprador.',
    params: [
      { name: 'fecha_inicio', type: 'string', required: false, description: 'Fecha de inicio (YYYY-MM-DD)' },
      { name: 'fecha_fin', type: 'string', required: false, description: 'Fecha de término (YYYY-MM-DD)' },
      { name: 'estado', type: 'string', required: false, description: 'Estado: publicada | cerrada | adjudicada | desierta' },
      { name: 'codigo_organismo', type: 'string', required: false, description: 'Código o RUT del organismo comprador' },
      { name: 'q', type: 'string', required: false, description: 'Término de búsqueda en título' },
      { name: 'page', type: 'number', required: false, description: 'Página (default: 1)' },
      { name: 'page_size', type: 'number', required: false, description: 'Límite (default: 20, máx: 100)' },
    ],
    responseExample: '{\n  "data": [\n    { "id": "...", "external_code": "1234-56-LE26", "title": "Servicios TI", "status_code": "publicada", "published_at": "2026-07-25T10:00:00Z" }\n  ],\n  "meta": { "page": 1, "page_size": 20, "total": 142, "source": "mercado_publico" }\n}',
    errorCodes: ['401 Unauthorized', '429 Rate limit exceeded'],
  },
  {
    method: 'GET', path: '/api/v1/mercado-publico/licitaciones/:codigo_externo', color: '#F59E0B',
    description: 'Obtiene el detalle completo de una licitación específica (ej. 1234-56-LE26), incluyendo fechas clave e ítems.',
    params: [
      { name: 'codigo_externo', type: 'string', required: true, description: 'Código único de la licitación (ej: 1234-56-LE26)' },
    ],
    responseExample: '{\n  "data": {\n    "external_code": "1234-56-LE26",\n    "title": "Adquisición de Servidores",\n    "buyer_name": "Hospital San José",\n    "items": [...]\n  }\n}',
    errorCodes: ['401 Unauthorized', '404 Licitación no encontrada'],
  },
  {
    method: 'GET', path: '/api/v1/mercado-publico/ordenes-compra', color: '#F59E0B',
    description: 'Transacciones reales de compra emitidas por organismos del Estado. Permite filtrar por fecha o RUT del proveedor adjudicado.',
    params: [
      { name: 'fecha', type: 'string', required: false, description: 'Fecha específica (YYYY-MM-DD)' },
      { name: 'rut_proveedor', type: 'string', required: false, description: 'RUT del proveedor adjudicado (ej: 76.086.428-5)' },
      { name: 'estado', type: 'string', required: false, description: 'Estado: enviada | aceptada | recepcion_conforme' },
    ],
    responseExample: '{\n  "data": [\n    { "external_code": "1234-56-SE26", "supplier_name": "Scouttech SpA", "total": 45000000, "currency": "CLP", "issued_at": "2026-07-20T15:30:00Z" }\n  ]\n}',
    errorCodes: ['401 Unauthorized', '429 Rate limit exceeded'],
  },
  {
    method: 'GET', path: '/api/v1/mercado-publico/ordenes-compra/:codigo_oc', color: '#F59E0B',
    description: 'Detalle completo de la orden de compra con precios unitarios, productos/servicios contratados y proveedor.',
    params: [
      { name: 'codigo_oc', type: 'string', required: true, description: 'Código único de la OC (ej: 1234-56-SE26)' },
    ],
    responseExample: '{\n  "data": {\n    "external_code": "1234-56-SE26",\n    "supplier_name": "Empresa SpA",\n    "total": 12500000,\n    "products": [...]\n  }\n}',
    errorCodes: ['401 Unauthorized', '404 Orden no encontrada'],
  },
  {
    method: 'GET', path: '/api/v1/mercado-publico/organismos', color: '#F59E0B',
    description: 'Busca y lista todas las instituciones compradoras del Estado (Ministerios, Municipalidades, Hospitales).',
    params: [
      { name: 'nombre', type: 'string', required: false, description: 'Nombre o parte del nombre de la institución (ej: MINEDUC)' },
      { name: 'rut', type: 'string', required: false, description: 'RUT o código de la institución' },
    ],
    responseExample: '{\n  "data": [\n    { "buyer_org_code": "6921", "buyer_name": "Ministerio de Educación" }\n  ]\n}',
    errorCodes: ['401 Unauthorized'],
  },
  {
    method: 'GET', path: '/api/v1/mercado-publico/proveedores/:rut', color: '#F59E0B',
    description: 'Perfil B2G público de una empresa: órdenes de compra adjudicadas, ticket promedio, buyer intelligence y B2G Maturity Score (0-100).',
    params: [
      { name: 'rut', type: 'string', required: true, description: 'RUT de la empresa (ej: 76.086.428-5)' },
    ],
    responseExample: '{\n  "data": {\n    "rut": "76086428-5",\n    "nombre_empresa": "Scouttech SpA",\n    "actividad_ocs": { "ocs_ganadas_12m": 14, "monto_total_adjudicado_clp": 125800000 },\n    "b2g_maturity": { "b2g_maturity_score": 72, "nivel": "alto" }\n  }\n}',
    errorCodes: ['400 RUT inválido', '401 Unauthorized', '503 Datos no disponibles'],
  },
  {
    method: 'GET', path: '/api/v1/mercado-publico/proveedores/:rut/vs-mercado', color: '#F59E0B',
    description: 'Comparativa de facturación B2G y ticket promedio del proveedor contra los cuartiles p25/p50/p75 de su rubro UNSPSC.',
    params: [
      { name: 'rut', type: 'string', required: true, description: 'RUT del proveedor (ej: 76.086.428-5)' },
    ],
    responseExample: '{\n  "data": {\n    "comparativa": {\n      "facturacion": { "proveedor_clp": 125800000, "mercado_mediana_clp": 15000000, "posicion": "sobre_p75" }\n    }\n  }\n}',
    errorCodes: ['400 RUT inválido', '401 Unauthorized'],
  },

  // Datos Económicos
  {
    method: 'GET', path: '/api/v1/data/economy', color: '#2DD4BF',
    description: 'Retorna un snapshot macroeconómico consolidado de Chile: UF, IPC, USD/CLP, TPM, PIB y Desempleo en tiempo real.',
    params: [],
    responseExample: '{\n  "data": {\n    "BCCH": {\n      "uf": { "value": 37842.15, "date": "2026-07-27" },\n      "usd_clp": { "value": 942.5 }\n    }\n  }\n}',
    errorCodes: ['401 Unauthorized', '503 Data source unavailable'],
  },

  // GraphRAG & Bralidus Intelligence
  {
    method: 'POST', path: '/api/v1/intel/query', color: '#8B5CF6',
    description: 'GraphRAG unificado Bralidus: consulta semántica que fusiona datos macroeconómicos, doctrina regulatoria y contexto de mercado.',
    params: [
      { name: 'query', type: 'string', required: true, description: 'Consulta en lenguaje natural' },
      { name: 'startup_context', type: 'object', required: false, description: '{ industry?, stage?, geography?, company_rut? }' },
      { name: 'top_k', type: 'number', required: false, description: 'Número de resultados (default: 5, máx: 25)' },
    ],
    responseExample: '{\n  "query": "...",\n  "context_for_llm": "## Contexto Macroeconómico\\n...",\n  "total_hits": 7,\n  "graph_hits": 3,\n  "vector_hits": 4\n}',
    errorCodes: ['401 Unauthorized', '422 Invalid query', '500 Engine error'],
  },

  // RAG & Vault
  {
    method: 'POST', path: '/api/v1/rag/query', color: '#0EB5C6',
    description: 'Consulta semántica vectorial HNSW (pgvector) sobre la base de conocimiento pública o del espacio privado del tenant.',
    params: [
      { name: 'query', type: 'string', required: true, description: 'Texto de búsqueda' },
    ],
    responseExample: '{\n  "nodes": [\n    { "document_title": "Ley 21.719", "content": "...", "relevance": 0.89 }\n  ]\n}',
    errorCodes: ['401 Unauthorized', '429 Rate limit exceeded'],
  },
  {
    method: 'POST', path: '/api/v1/rag/ingest/text', color: '#EC4899',
    description: 'Vectoriza e ingesta texto plano en el Vault privado del cliente para consultas RAG personalizadas.',
    params: [
      { name: 'text', type: 'string', required: true, description: 'Texto a vectorizar' },
      { name: 'title', type: 'string', required: true, description: 'Título identificador' },
    ],
    responseExample: '{\n  "status": "success",\n  "doc_id": "doc_abc456"\n}',
    errorCodes: ['400 Text too long', '401 Unauthorized'],
  },

  // Webhooks
  {
    method: 'POST', path: '/api/v1/webhooks', color: '#F59E0B',
    description: 'Registra una URL HTTPS para recibir eventos asíncronos en tiempo real (alertas de Radar, licitaciones relevantes).',
    params: [
      { name: 'url', type: 'string', required: true, description: 'URL HTTPS del webhook' },
      { name: 'event', type: 'string', required: true, description: 'Nombre del evento' },
    ],
    responseExample: '{\n  "id": "wh_xyz789",\n  "url": "https://mi-sistema.cl/webhook",\n  "event": "radar.signal"\n}',
    errorCodes: ['400 Invalid URL', '401 Unauthorized'],
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
    path: '/api/v1/mercado-publico/organismos?nombre=MINEDUC',
    label: 'Mercado Público — Directorio de Organismos',
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
    defaultBody: JSON.stringify({ text: 'Información corporativa privada para consultas RAG.', title: 'Doc 01' }, null, 2),
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
