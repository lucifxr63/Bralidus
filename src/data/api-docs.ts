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
  {
    method: 'POST', path: '/api/v1/rag/query', color: '#0EB5C6',
    description: 'Consulta semántica al corpus de conocimiento de Validus. Devuelve los fragmentos más relevantes con scores de similitud coseno.',
    params: [
      { name: 'query', type: 'string', required: true, description: 'Pregunta o texto de búsqueda (máx. 2000 chars)' },
      { name: 'filters', type: 'object', required: false, description: 'Filtros opcionales: { industry?, category?, date_from? }' },
    ],
    responseExample: '{\n  "results": [\n    { "content": "...", "score": 0.92, "source": "normativa_cmf" }\n  ],\n  "query_id": "q_abc123",\n  "latency_ms": 234\n}',
    errorCodes: ['401 Unauthorized', '429 Rate limit exceeded', '500 RAG pipeline error'],
  },
  {
    method: 'GET', path: '/api/v1/data/economy', color: '#2DD4BF',
    description: 'Retorna indicadores económicos de Chile en tiempo real: UF, IPC, UTM, tipo de cambio USD/CLP y más. Sin body requerido.',
    params: [],
    responseExample: '{\n  "uf": { "value": 37842.15, "date": "2026-06-08" },\n  "ipc": { "value": 0.3, "period": "2026-05" },\n  "utm": { "value": 68264, "year": 2026 }\n}',
    errorCodes: ['401 Unauthorized', '503 Data source unavailable'],
  },
  {
    method: 'POST', path: '/api/v1/webhooks', color: '#F59E0B',
    description: 'Registra una URL HTTPS para recibir notificaciones cuando eventos de Validus ocurran (validación completada, análisis listo, etc.).',
    params: [
      { name: 'url', type: 'string', required: true, description: 'URL HTTPS que recibirá el POST' },
      { name: 'event', type: 'string', required: true, description: 'validation.complete | analysis.ready | profile.updated' },
    ],
    responseExample: '{\n  "id": "wh_xyz789",\n  "url": "https://mi-sistema.cl/webhook",\n  "event": "validation.complete",\n  "created_at": "2026-06-08T14:00:00Z"\n}',
    errorCodes: ['400 Invalid URL', '401 Unauthorized'],
  },
  {
    method: 'GET', path: '/api/v1/webhooks', color: '#F59E0B',
    description: 'Lista todos los webhooks registrados para tu cuenta con su estado de última entrega.',
    params: [],
    responseExample: '{\n  "webhooks": [\n    { "id": "wh_xyz789", "url": "https://...", "event": "validation.complete", "last_delivery": "ok" }\n  ]\n}',
    errorCodes: ['401 Unauthorized'],
  },
  {
    method: 'POST', path: '/api/v1/rag/ingest/text', color: '#EC4899',
    description: 'Vectoriza e ingesta texto plano al knowledge base. El contenido queda disponible para consultas RAG de forma inmediata.',
    params: [
      { name: 'text', type: 'string', required: true, description: 'Texto a vectorizar (máx. 50.000 caracteres)' },
      { name: 'metadata', type: 'object', required: false, description: 'Metadatos: { source?, industry?, category? }' },
    ],
    responseExample: '{\n  "chunks_created": 4,\n  "doc_id": "doc_abc456",\n  "latency_ms": 1200\n}',
    errorCodes: ['400 Text too long', '401 Unauthorized', '429 Rate limit exceeded'],
  },
  {
    method: 'POST', path: '/functions/v1/assemble-mega-prompt', color: '#0EB5C6',
    description: 'Genera un análisis de due diligence completo con 16 dimensiones RAG usando IA. Sprint 7: incluye Riesgo Regulatorio (Ley 21.719 Datos, Ley 21.521 Fintech, Ley Marco Ciberseguridad), Eficiencia de Capital (Burn Rate, Runway, Burn Multiple), Retención (NRR, Gross Churn) y Riesgo Conductual (sesgos del fundador).',
    params: [
      { name: 'validation_id', type: 'string (UUID)', required: true, description: 'ID de la validación a analizar' },
      { name: 'capital_efficiency', type: 'object', required: false, description: '{ monthly_burn_usd?, runway_months?, nrr_pct?, gross_churn_pct?, burn_multiple? }' },
    ],
    responseExample: '{\n  "analysis": {\n    "market": "...", "team": "...", "risks": "...",\n    "capital_efficiency": { "monthly_burn_usd": 8500, "runway_months": 14 },\n    "regulatory_risk": "medium"\n  },\n  "score": 0.78,\n  "rag_dimensions": 16\n}',
    errorCodes: ['400 Invalid validation_id', '401 Unauthorized', '404 Validation not found'],
  },
  {
    method: 'POST', path: '/api/v1/intel/query', color: '#8B5CF6',
    description: 'Intel — GraphRAG unificado (macro + S-Pulse + Licitus). Consulta semántica al grafo de conocimiento de Bralidus con contexto enriquecido.',
    params: [
      { name: 'query', type: 'string', required: true, description: 'Consulta en lenguaje natural' },
      { name: 'startup_context', type: 'object', required: false, description: '{ industry?, stage?, geography?, company_rut? }' },
      { name: 'top_k', type: 'number', required: false, description: 'Número de resultados (default: 5)' },
    ],
    responseExample: '{\n  "answer": "...",\n  "sources": [...],\n  "graph_path": "GRAPH",\n  "entities_activated": 43\n}',
    errorCodes: ['401 Unauthorized', '422 Invalid query', '500 MoE engine error'],
  },
  {
    method: 'GET', path: '/api/v1/data/licitus/proveedor/:rut', color: '#F59E0B',
    description: 'Licitus — Histórico de órdenes de compra, buyer intelligence y Madurez B2G (b2g_maturity_score 0-100) para un proveedor del Estado.',
    params: [
      { name: 'periodo_meses', type: 'number', required: false, description: 'Ventana de tiempo en meses (default: 12, máx: 24)' },
    ],
    responseExample: '{\n  "data": {\n    "rut": "76086428-5",\n    "nombre_empresa": "Empresa SpA",\n    "actividad_ocs": { "ocs_ganadas_12m": 14, "monto_total_adjudicado_clp": 125800000 },\n    "b2g_maturity": { "b2g_maturity_score": 72, "nivel": "alto", "senales": ["..."] }\n  }\n}',
    errorCodes: ['400 RUT inválido', '401 Unauthorized', '503 Licitus no disponible o sin datos'],
  },
  {
    method: 'GET', path: '/api/v1/data/licitus/proveedor/:rut/vs-mercado', color: '#F59E0B',
    description: 'Licitus — Comparativa de facturación, ticket promedio y concentración del proveedor vs. percentiles de su rubro UNSPSC.',
    params: [
      { name: 'periodo_meses', type: 'number', required: false, description: 'Ventana de tiempo en meses (default: 12)' },
    ],
    responseExample: '{\n  "data": {\n    "rut": "76086428-5",\n    "b2g_maturity": { "b2g_maturity_score": 72, "nivel": "alto" },\n    "comparativa": {\n      "facturacion": { "proveedor_clp": 125800000, "mercado_mediana_clp": 15000000, "posicion": "sobre_p75" }\n    }\n  }\n}',
    errorCodes: ['400 RUT inválido', '401 Unauthorized', '503 Sin datos'],
  },
  {
    method: 'GET', path: '/api/v1/data/licitus/proveedor/:rut/oportunidades', color: '#F59E0B',
    description: 'Licitus — Licitaciones públicas abiertas rankeadas por score de relevancia para el perfil del proveedor.',
    params: [
      { name: 'limit', type: 'number', required: false, description: 'Máximo de resultados (default: 10, máx: 50)' },
    ],
    responseExample: '{\n  "data": {\n    "total_encontradas": 4,\n    "oportunidades": [\n      { "codigo": "1234-56-LE26", "nombre": "...", "relevancia_score": 0.9, "motivos_relevancia": ["Coincidencia de rubro UNSPSC"] }\n    ]\n  }\n}',
    errorCodes: ['400 RUT inválido', '401 Unauthorized'],
  },
  {
    method: 'GET', path: '/api/v1/data/licitus/mercado/benchmarks', color: '#F59E0B',
    description: 'Licitus — Benchmarks B2G agregados por rubro UNSPSC y región: volumen total, medianas, percentiles p25/p75 y concentración.',
    params: [
      { name: 'unspsc', type: 'string', required: false, description: 'Código UNSPSC del rubro (ej: 43232200)' },
      { name: 'region', type: 'string', required: false, description: 'Código de región Chile (ej: 13 para RM)' },
      { name: 'periodo_meses', type: 'number', required: false, description: 'Ventana en meses (default: 12)' },
    ],
    responseExample: '{\n  "data": {\n    "volumen": { "licitaciones_publicadas": 342, "monto_total_ocs_clp": 4850000000 },\n    "proveedores": { "activos_en_periodo": 78, "monto_mediana_clp": 15000000 }\n  }\n}',
    errorCodes: ['401 Unauthorized'],
  },
  {
    method: 'GET', path: '/api/v1/data/licitus/mercado/activas', color: '#F59E0B',
    description: 'Licitus — Licitaciones públicas vigentes en Mercado Público con cierre próximo.',
    params: [
      { name: 'unspsc', type: 'string', required: false, description: 'Filtrar por rubro UNSPSC' },
      { name: 'region', type: 'string', required: false, description: 'Filtrar por región (ej: 13)' },
      { name: 'monto_min', type: 'number', required: false, description: 'Monto mínimo estimado en CLP' },
      { name: 'limit', type: 'number', required: false, description: 'Límite de resultados (default: 20)' },
    ],
    responseExample: '{\n  "data": [\n    { "codigo": "1234-56-LE26", "nombre": "...", "monto_estimado_clp": 45000000, "fecha_cierre": "2026-07-28T18:00:00" }\n  ]\n}',
    errorCodes: ['401 Unauthorized'],
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
    method: 'POST',
    path: '/api/v1/rag/query',
    label: 'RAG — Consulta semántica al Knowledge Graph',
    color: '#0EB5C6',
    defaultBody: JSON.stringify({ query: '¿Qué es la Ley Fintech 21.521 y cómo afecta a las startups chilenas?', filters: { industry: 'fintech' } }, null, 2),
  },
  {
    method: 'GET',
    path: '/api/v1/data/economy',
    label: 'Economy — Indicadores macro Chile (UF, IPC, TPM)',
    color: '#2DD4BF',
    defaultBody: '',
  },
  {
    method: 'POST',
    path: '/api/v1/rag/ingest/text',
    label: 'RAG Ingest — Vectorizar texto al Knowledge Base',
    color: '#EC4899',
    defaultBody: JSON.stringify({ text: 'Texto de ejemplo para ingestar al knowledge base de Bralidus.', metadata: { source: 'mi-sistema', industry: 'fintech' } }, null, 2),
  },
  {
    method: 'POST',
    path: '/functions/v1/assemble-mega-prompt',
    label: 'MegaPrompt — Due Diligence 16 dimensiones RAG',
    color: '#0EB5C6',
    defaultBody: JSON.stringify({ validation_id: 'val_abc123', capital_efficiency: { monthly_burn_usd: 8500, runway_months: 14, nrr_pct: 112 } }, null, 2),
  },
  {
    method: 'POST',
    path: '/api/v1/intel/query',
    label: 'Intel — GraphRAG unificado (macro + S-Pulse + Licitus)',
    color: '#8B5CF6',
    defaultBody: JSON.stringify({
      query: '¿Qué tan atractivo es el mercado de insumos médicos para el Estado chileno?',
      startup_context: { industry: 'healthtech', stage: 'seed', geography: 'chile', company_rut: '76086428-5' },
      top_k: 5,
    }, null, 2),
  },
  {
    method: 'GET',
    path: '/api/v1/data/licitus/proveedor/76086428-5',
    label: 'Licitus — Ficha B2G (OCs + Madurez B2G)',
    color: '#F59E0B',
    defaultBody: '',
  },
  {
    method: 'GET',
    path: '/api/v1/data/licitus/proveedor/76086428-5/vs-mercado',
    label: 'Licitus — Comparativa Proveedor vs Mercado',
    color: '#F59E0B',
    defaultBody: '',
  },
  {
    method: 'GET',
    path: '/api/v1/data/licitus/proveedor/76086428-5/oportunidades',
    label: 'Licitus — Licitaciones activas relevantes',
    color: '#F59E0B',
    defaultBody: '',
  },
  {
    method: 'GET',
    path: '/api/v1/data/licitus/mercado/benchmarks',
    label: 'Licitus — Benchmarks de Mercado Público',
    color: '#F59E0B',
    defaultBody: '',
  },
  {
    method: 'GET',
    path: '/api/v1/data/licitus/mercado/activas',
    label: 'Licitus — Licitaciones abiertas vigentes',
    color: '#F59E0B',
    defaultBody: '',
  },
  {
    method: 'GET',
    path: '/api/v1/data/spulse/companies/search?q=falabella',
    label: 'S-Pulse — Buscar empresa en el grafo societario',
    color: '#6366F1',
    defaultBody: '',
  },
  {
    method: 'GET',
    path: '/api/v1/data/spulse/companies/76086428-5/profile',
    label: 'S-Pulse — Ficha 360° (socios + trazabilidad)',
    color: '#6366F1',
    defaultBody: '',
  },
] as const;

export const METHOD_COLORS: Record<string, string> = {
  POST: '#0EB5C6',
  GET: '#2DD4BF',
  DELETE: '#EF4444',
};

export const WEBHOOK_EVENTS = [
  { value: 'validation.complete', label: 'Validación completada' },
  { value: 'analysis.ready',      label: 'Análisis IA listo' },
  { value: 'profile.updated',     label: 'Perfil actualizado' },
];

export const LOGS_PER_PAGE = 15;
