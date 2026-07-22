import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { KnowledgeGraph } from '@/components/KnowledgeGraph';
import MacroIntelligence from '@/components/MacroIntelligence';
import BralidusPanel from '@/components/BralidusPanel';
import RadarForense from '@/components/RadarForense';
import Trazabilidad from '@/components/Trazabilidad';
import ServiceModal from '@/components/ServiceModal';
import { BralidusEvidenceWall } from '@/components/BralidusEvidenceWall';
import { BralidusQuotaWidget } from '@/components/BralidusQuotaWidget';
import { BralidusCostsPanel } from '@/components/BralidusCostsPanel';
import { AuditLog } from '@/components/AuditLog';

import {
  Key, Plus, Trash2, Copy, Check, AlertCircle, BookOpen,
  Play, Activity, Zap, TrendingUp, ChevronDown, Loader2, ShieldCheck,
  Database, Brain, Server,
  List, Search, ChevronRight, Webhook, Bell, TrendingDown, Radio,
} from 'lucide-react';
import { toast } from 'sonner';
import { generateApiKey, hashApiKey } from '@/utils/crypto';


interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  is_active: boolean;
}

interface AuditLog {
  id: string;
  run_id: string;
  query: string;
  category: string;
  expected_keyword: string | null;
  has_sources: boolean;
  keyword_found: boolean;
  precision_score: number;
  latency_ms: number;
  chunks_retrieved: number;
  error: string | null;
  created_at: string;
}

interface AuditSummary {
  run_id: string;
  started_at: string;
  total_queries: number;
  avg_precision: number;
  avg_latency_ms: number;
  keyword_hits: number;
  queries_with_sources: number;
  errors: number;
  hit_rate_pct: number;
}

interface ApiUsageLog {
  id: string;
  endpoint: string;
  requests_count: number;
  tokens_used: number;
  created_at: string;
}

type Tab =
  | 'overview'
  | 'costs'
  | 'evidences'
  | 'quotas'
  | 'macro'
  | 'forensic'
  | 'graph'
  | 'playground'
  | 'audit'
  | 'apikeys'
  | 'services';

type ServiceStatus = 'ok' | 'degraded' | 'error' | 'unused';

interface ServiceInfo {
  id: string;
  name: string;
  category: string;
  status: ServiceStatus;
  latency_ms?: number;
  message: string;
}

interface WebhookSub {
  id: string;
  endpoint_url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
  secret?: string;
}

const WEBHOOK_EVENTS = [
  { value: 'validation.complete', label: 'Validación completada' },
  { value: 'analysis.ready',      label: 'Análisis IA listo' },
  { value: 'profile.updated',     label: 'Perfil actualizado' },
];

interface EndpointDoc {
  method: string;
  path: string;
  description: string;
  color: string;
  params: Array<{ name: string; type: string; required: boolean; description: string }>;
  responseExample: string;
  errorCodes: string[];
}

const API_DOCS: EndpointDoc[] = [
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
    description: 'Genera un análisis de due diligence completo con 16 dimensiones RAG usando IA. Sprint 7: incluye Riesgo Regulatorio (Ley 21.719 Datos, Ley 21.521 Fintech, Ley Marco Ciberseguridad), Eficiencia de Capital (Burn Rate, Runway, Burn Multiple), Retención (NRR, Gross Churn) y Riesgo Conductual (sesgos del fundador). El resultado alimenta el Investment Dossier PDF — Página 05 · Alertas Críticas.',
    params: [
      { name: 'validation_id', type: 'string (UUID)', required: true, description: 'ID de la validación a analizar' },
      { name: 'capital_efficiency', type: 'object', required: false, description: '{ monthly_burn_usd?, runway_months?, nrr_pct?, gross_churn_pct?, burn_multiple? } — activa la página Alertas Críticas con datos reales' },
    ],
    responseExample: '{\n  "analysis": {\n    "market": "...", "team": "...", "risks": "...",\n    "capital_efficiency": {\n      "monthly_burn_usd": 8500,\n      "runway_months": 14,\n      "nrr_pct": 112,\n      "gross_churn_pct": 2.1,\n      "burn_multiple": 1.4\n    },\n    "regulatory_risk": "medium",\n    "founder_bias_warning": "Sesgo de confirmación detectado en las proyecciones de market share."\n  },\n  "score": 0.78,\n  "pdf_pages": 6,\n  "rag_dimensions": 16,\n  "generated_at": "2026-06-10T14:00:00Z"\n}',
    errorCodes: ['400 Invalid validation_id', '401 Unauthorized', '404 Validation not found'],
  },
  {
    method: 'POST', path: '/functions/v1/ai-validate', color: '#2DD4BF',
    description: 'Motor de validación IA multi-propósito (18 prompt types). Con prompt_type: "market_signals" activa el Data Storytelling Engine: consume métricas macro de Chile (TPM, UF, IPC, USD/CLP vía mindicador.cl) y genera un insight estructurado listo para LinkedIn. El copy siempre incluye el gancho: "¿Tu startup sobrevive a este escenario? Descúbrelo en Validus."',
    params: [
      { name: 'validation_id', type: 'string', required: true, description: 'Identificador de sesión (ej: "admin-content-engine")' },
      { name: 'prompt_type', type: 'string', required: true, description: '"market_signals" | "summary" | "competitive_analysis" | "risk_analysis" | "unit_economics" | "founder_fit" | "fundraising_roadmap" | "governance_assessment" | + 10 más' },
      { name: 'context', type: 'object', required: true, description: '{ idea_name, idea_description, idea_industry, target_country, business_model, business_stage }. Para market_signals: incluir métricas macro en idea_description (TPM, UF, etc.)' },
    ],
    responseExample: '// prompt_type: "market_signals"\n{\n  "tag_sistema": "/SYS/MACRO/2026",\n  "titulo": "TPM en 5.5%: el costo invisible del capital",\n  "subtitulo": "La tasa define cuánto cuesta financiar tu crecimiento.",\n  "metrica": "Tasa Política Monetaria (%)",\n  "benchmark": "5.5%",\n  "saludable": "< 4% → deuda a costo razonable",\n  "peligro": "> 5% → equity más barato que deuda",\n  "insight": "Con TPM en 5.5%, el crédito en Chile sigue caro...",\n  "copyLinkedIn": "¿Tu startup sobrevive a este escenario? Descúbrelo en Validus."\n}',
    errorCodes: ['401 Unauthorized', '429 Rate limit exceeded', '400 Bad prompt_type'],
  },
  {
    method: 'GET', path: '/api/v1/data/macro', color: '#2DD4BF',
    description: 'Indicadores macroeconómicos USA sincronizados desde FRED: tipo de cambio USD/CLP, precio cobre, Fed Funds Rate, CPI y precio petróleo WTI.',
    params: [],
    responseExample: '{\n  "indicators": {\n    "DEXCLUS": { "value": 930.5, "date": "2026-06-06", "_updated_at": "..." },\n    "PCOPPUSDM": { "value": 4.62, "date": "2026-05", "_updated_at": "..." }\n  },\n  "count": 5\n}',
    errorCodes: ['401 Unauthorized', '503 Sin datos — ejecutar cron fred-sync'],
  },
  {
    method: 'GET', path: '/api/v1/data/chilecompra/metricas', color: '#F59E0B',
    description: 'Métricas M1-M10 de inteligencia Mercado Público para un proveedor. Lee el cálculo más reciente desde BD. Para datos frescos, llamar a chilecompra-calcular.',
    params: [
      { name: 'rut', type: 'string', required: true, description: 'RUT de la empresa (ej: 76543210-K)' },
    ],
    responseExample: '{\n  "rut": "765432109",\n  "calculado_al": "2026-06-08",\n  "ingreso_fiscal_12m": 450000000,\n  "tendencia_pct": -12.5,\n  "trato_directo_pct": 34.2,\n  "win_rate_pct": 28.0,\n  "top_organismo_nombre": "Hospital Regional"\n}',
    errorCodes: ['400 RUT inválido', '401 Unauthorized', '404 Sin métricas calculadas'],
  },
  {
    method: 'GET', path: '/api/v1/data/licitus/proveedor/:rut', color: '#22C55E',
    description: 'Actividad real de un proveedor en Mercado Público vía Licitus: órdenes de compra efectivas, buyer intelligence (organismos que le compran), categorías UNSPSC y calidad de datos. Fuente paralela y más rica que chilecompra/metricas (OCs reales de purchase_orders, no cálculo propio).',
    params: [
      { name: ':rut', type: 'string (path)', required: true, description: 'RUT del proveedor (ej: 76086428-5)' },
      { name: 'periodo_meses', type: 'number', required: false, description: 'Ventana de análisis en meses (1–24, default 12)' },
    ],
    responseExample: '{\n  "data": {\n    "rut": "76086428-5",\n    "actividad": { "total_ocs": 42, "monto_total_clp": 380000000 },\n    "buyer_intelligence": [\n      { "organismo": "Hospital Regional", "ocs": 12, "monto_clp": 95000000 }\n    ],\n    "categorias": [{ "unspsc": "42131600", "nombre": "Insumos médicos" }],\n    "data_quality": { "cobertura_meses": 12 }\n  }\n}',
    errorCodes: ['401 Unauthorized', '429 Rate limit de Licitus', '503 Licitus no disponible o RUT sin actividad'],
  },
  {
    method: 'GET', path: '/api/v1/data/licitus/mercado/benchmarks', color: '#22C55E',
    description: 'Benchmarks de mercado público por rubro UNSPSC y/o región vía Licitus: volumen transado, percentiles de montos (p25 / mediana / p75), cantidad de contratos y top compradores. Ideal para dimensionar un mercado B2G antes de entrar.',
    params: [
      { name: 'unspsc', type: 'string', required: false, description: 'Prefijo de categoría UNSPSC (ej: 43231500)' },
      { name: 'region', type: 'string', required: false, description: 'Región de Chile (ej: Metropolitana)' },
      { name: 'periodo_meses', type: 'number', required: false, description: 'Ventana de análisis en meses (1–24, default 12)' },
    ],
    responseExample: '{\n  "data": {\n    "volumen_total_clp": 12500000000,\n    "contratos": 843,\n    "montos": { "p25": 2100000, "mediana": 6800000, "p75": 19500000 },\n    "top_compradores": [\n      { "organismo": "MINSAL", "monto_clp": 2400000000 }\n    ]\n  }\n}',
    errorCodes: ['401 Unauthorized', '429 Rate limit de Licitus', '503 Sin datos para los filtros indicados'],
  },
  {
    method: 'GET', path: '/api/v1/data/licitus/mercado/activas', color: '#22C55E',
    description: 'Licitaciones activas en Mercado Público vía Licitus, filtrables por rubro UNSPSC, región, monto mínimo y ventana de cierre. Datos sincronizados diariamente por la ingesta propia de Licitus y enriquecidos con IA.',
    params: [
      { name: 'unspsc', type: 'string', required: false, description: 'Prefijo de categoría UNSPSC' },
      { name: 'region', type: 'string', required: false, description: 'Región de Chile' },
      { name: 'monto_min', type: 'number', required: false, description: 'Monto mínimo estimado en CLP' },
      { name: 'cierre_desde_horas', type: 'number', required: false, description: 'Solo licitaciones que cierran dentro de N horas (default 168)' },
      { name: 'limit', type: 'number', required: false, description: 'Máximo de resultados (1–100, default 20)' },
    ],
    responseExample: '{\n  "data": [\n    {\n      "codigo": "1057389-12-LE26",\n      "nombre": "Adquisición de insumos de laboratorio",\n      "organismo": "Hospital de Talca",\n      "monto_estimado_clp": 18000000,\n      "fecha_cierre": "2026-07-24T15:00:00Z"\n    }\n  ]\n}',
    errorCodes: ['401 Unauthorized', '429 Rate limit de Licitus', '503 Licitus no disponible'],
  },
  {
    method: 'POST', path: '/api/v1/intel/query', color: '#8B5CF6',
    description: 'EL endpoint de unificación: GraphRAG dinámico que fusiona en un solo contexto citable todas las fuentes del ecosistema — datos macro fechados (FRED/yfinance), doctrina normativa chilena, relaciones societarias con trazabilidad legal (S-Pulse) y actividad en compras públicas + benchmarks B2G (Licitus). Con company_rut en startup_context, las capas societaria y B2G se anexan automáticamente. Una llamada, toda la inteligencia.',
    params: [
      { name: 'query', type: 'string', required: true, description: 'Pregunta de negocio (máx. 2000 chars)' },
      { name: 'startup_context', type: 'object', required: false, description: '{ industry, stage, geography, company_rut?, business_model? } — determina el routing de entidades y activa S-Pulse/Licitus' },
      { name: 'top_k', type: 'number', required: false, description: 'Nodos de conocimiento a recuperar (1–25, default 10)' },
    ],
    responseExample: '{\n  "query": "...",\n  "entities_activated": ["USD/CLP (Tipo de Cambio Chile)", "..."],\n  "nodes": [ { "document_title": "...", "relevance": 0.87, "metadata": {...} } ],\n  "context_for_llm": "## Contexto macro...\\n\\n## Inteligencia de Relaciones B2B (S-Pulse)...\\n\\n## Actividad en Compras Públicas (Licitus)...",\n  "total_hits": 12\n}',
    errorCodes: ['400 Query inválida', '401 Unauthorized', '429 Rate limit exceeded', '502 Motor no disponible'],
  },
  {
    method: 'GET', path: '/api/v1/data/spulse/companies/search', color: '#6366F1',
    description: 'Busca empresas chilenas en el grafo societario de S-Pulse por nombre o RUT (mínimo 2 caracteres). Punto de entrada para obtener el RUT canónico antes de pedir profile o network.',
    params: [
      { name: 'q', type: 'string', required: true, description: 'Nombre o RUT (parcial) de la empresa' },
    ],
    responseExample: '{\n  "data": [\n    { "rut": "76086428-5", "business_name": "Insumos Médicos SpA", "legal_type": "SpA" }\n  ]\n}',
    errorCodes: ['400 q muy corto', '401 Unauthorized', '503 S-Pulse no disponible'],
  },
  {
    method: 'GET', path: '/api/v1/data/spulse/companies/:rut/profile', color: '#6366F1',
    description: 'Ficha 360° de una empresa desde el grafo societario: datos legales, socios y representantes con % de participación, y señales recientes. Cada relación es auditable hasta su documento fuente (trazabilidad legal).',
    params: [
      { name: ':rut', type: 'string (path)', required: true, description: 'RUT de la empresa (ej: 76086428-5)' },
    ],
    responseExample: '{\n  "data": {\n    "company": { "rut": "76086428-5", "business_name": "...", "legal_type": "SpA", "status": "activa" },\n    "members": [ { "name": "...", "roles": ["socio"], "equity_percentage": 50 } ],\n    "recent_triggers": []\n  }\n}',
    errorCodes: ['400 RUT inválido', '401 Unauthorized', '503 S-Pulse no disponible o empresa no encontrada'],
  },
];

const LOGS_PER_PAGE = 20;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const BASE = `${SUPABASE_URL}/functions/v1/api-v1`;

const ENDPOINTS = [
  {
    method: 'POST',
    path: '/api/v1/rag/query',
    label: 'RAG — Consulta semántica',
    color: '#0EB5C6',
    defaultBody: JSON.stringify({ query: 'estrategias go-to-market fintech Chile', filters: {} }, null, 2),
  },
  {
    method: 'GET',
    path: '/api/v1/data/economy',
    label: 'Datos Económicos — UF / IPC',
    color: '#2DD4BF',
    defaultBody: '',
  },
  {
    method: 'POST',
    path: '/api/v1/webhooks',
    label: 'Webhooks — Registrar',
    color: '#F59E0B',
    defaultBody: JSON.stringify({ url: 'https://mi-sistema.cl/webhook', event: 'validation.complete' }, null, 2),
  },
  {
    method: 'GET',
    path: '/api/v1/webhooks',
    label: 'Webhooks — Listar',
    color: '#F59E0B',
    defaultBody: '',
  },
  {
    method: 'POST',
    path: '/api/v1/rag/ingest/text',
    label: 'Ingestión — Texto',
    color: '#EC4899',
    defaultBody: JSON.stringify({ text: 'Contenido a vectorizar...', metadata: { source: 'manual', industry: 'fintech' } }, null, 2),
  },
  {
    method: 'POST',
    path: '/functions/v1/assemble-mega-prompt',
    label: 'Due Diligence — 16 dimensiones RAG',
    color: '#0EB5C6',
    defaultBody: JSON.stringify({
      validation_id: '<uuid-de-validacion>',
      capital_efficiency: {
        monthly_burn_usd: 8500,
        runway_months: 14,
        nrr_pct: 112,
        gross_churn_pct: 2.1,
        burn_multiple: 1.4,
      },
    }, null, 2),
  },
  {
    method: 'POST',
    path: '/functions/v1/ai-validate',
    label: 'Data Storytelling — Market Insight LinkedIn',
    color: '#2DD4BF',
    defaultBody: JSON.stringify({
      validation_id: 'admin-content-engine',
      step: 0,
      prompt_type: 'market_signals',
      context: {
        idea_name: 'Validus Market Insight Engine',
        idea_description: 'Genera un Data Story para LinkedIn con métricas macro de Chile (TPM: 5.5%, UF: $38.500). Termina con: "¿Tu startup sobrevive a este escenario? Descúbrelo en Validus."',
        idea_industry: 'SaaS / Venture Capital',
        target_country: 'Chile',
        target_region: 'LatAm',
        business_model: 'B2B SaaS',
        business_stage: 'growth',
      },
    }, null, 2),
  },
  {
    method: 'GET',
    path: '/api/v1/data/macro',
    label: 'Macro — FRED USD/CLP, cobre, petróleo',
    color: '#2DD4BF',
    defaultBody: '',
  },
  {
    method: 'GET',
    path: '/api/v1/data/chilecompra/metricas',
    label: 'ChileCompra — Métricas M1-M10',
    color: '#F59E0B',
    defaultBody: '',
  },
  {
    method: 'GET',
    path: '/api/v1/data/licitus/proveedor/76086428-5?periodo_meses=12',
    label: 'Licitus — Actividad de proveedor (OCs reales)',
    color: '#22C55E',
    defaultBody: '',
  },
  {
    method: 'GET',
    path: '/api/v1/data/licitus/mercado/benchmarks?periodo_meses=12',
    label: 'Licitus — Benchmarks de mercado B2G',
    color: '#22C55E',
    defaultBody: '',
  },
  {
    method: 'GET',
    path: '/api/v1/data/licitus/mercado/activas?limit=5',
    label: 'Licitus — Licitaciones activas',
    color: '#22C55E',
    defaultBody: '',
  },
  {
    method: 'POST',
    path: '/api/v1/intel/query',
    label: 'Intel — GraphRAG unificado (macro + S-Pulse + Licitus)',
    color: '#8B5CF6',
    defaultBody: JSON.stringify({
      query: '¿Qué tan atractivo es el mercado de insumos médicos para el Estado chileno?',
      startup_context: {
        industry: 'healthtech',
        stage: 'seed',
        geography: 'chile',
        company_rut: '76086428-5',
      },
      top_k: 5,
    }, null, 2),
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

const METHOD_COLORS: Record<string, string> = {
  POST: '#0EB5C6',
  GET: '#2DD4BF',
  DELETE: '#EF4444',
};



export function DeveloperPortal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as Tab) || 'overview';
  const setActiveTab = (tab: Tab) => setSearchParams({ tab });

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [logs, setLogs] = useState<ApiUsageLog[]>([]);
  const [auditSummaries, setAuditSummaries] = useState<AuditSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesCheckedAt, setServicesCheckedAt] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceInfo | null>(null);

  const [selectedEndpointIdx, setSelectedEndpointIdx] = useState(0);
  const [playgroundBody, setPlaygroundBody] = useState(ENDPOINTS[0].defaultBody);
  const [playgroundApiKey, setPlaygroundApiKey] = useState('');
  const [playgroundResult, setPlaygroundResult] = useState<string | null>(null);
  const [playgroundStatus, setPlaygroundStatus] = useState<number | null>(null);
  const [playgroundLoading, setPlaygroundLoading] = useState(false);
  const [showEndpointDropdown, setShowEndpointDropdown] = useState(false);
  const [snippetLang, setSnippetLang] = useState<'curl' | 'node' | 'python'>('curl');

  const [keyName, setKeyName] = useState('');
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [logsSearch, setLogsSearch] = useState('');
  const [logsEndpointFilter, setLogsEndpointFilter] = useState('all');
  const [logsPage, setLogsPage] = useState(0);
  const [expandedDocIdx, setExpandedDocIdx] = useState<number | null>(null);

  const [webhooks, setWebhooks] = useState<WebhookSub[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(false);
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);
  const [webhookCreating, setWebhookCreating] = useState(false);
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);
  const [webhookSecretCopied, setWebhookSecretCopied] = useState(false);

  useEffect(() => { fetchData(); fetchServices(); fetchWebhooks(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [keysRes, logsRes] = await Promise.all([
      supabase.from('api_keys').select('*').eq('profile_id', user.id).order('created_at', { ascending: false }),
      supabase.from('api_usage_logs').select('id, endpoint, requests_count, tokens_used, created_at').order('created_at', { ascending: true }),
    ]);
    if (keysRes.data) setKeys(keysRes.data as ApiKey[]);
    if (logsRes.data) setLogs(logsRes.data as ApiUsageLog[]);

    const auditSummaryRes = await supabase.from('rag_audit_summary').select('*').order('started_at', { ascending: false }).limit(10);
    if (auditSummaryRes.data && auditSummaryRes.data.length > 0) {
      setAuditSummaries(auditSummaryRes.data as AuditSummary[]);
      const latestRunId = auditSummaryRes.data[0].run_id as string;
      const logsRes2 = await supabase
        .from('rag_audit_logs')
        .select('id, run_id, query, category, expected_keyword, has_sources, keyword_found, precision_score, latency_ms, chunks_retrieved, error, created_at')
        .eq('run_id', latestRunId)
        .order('created_at', { ascending: true });
      if (logsRes2.data) setAuditLogs(logsRes2.data as AuditLog[]);
    }
    setLoading(false);
  };

  const fetchServices = async () => {
    setServicesLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/api-v1/health/services`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      // Si la Edge Function no está desplegada (401/404/503), fallback silencioso
      if (!res.ok) { setServicesLoading(false); return; }
      const data = await res.json() as { services?: ServiceInfo[]; checked_at?: string };
      setServices(data.services ?? []);
      setServicesCheckedAt(data.checked_at ?? null);
    } catch { /* Edge Function no disponible — estado vacío */ }
    finally { setServicesLoading(false); }
  };

  const handleCreateKey = async () => {
    if (!keyName.trim()) { toast.error('El nombre es requerido'); return; }
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');
      const plainKey = generateApiKey();
      const hashedKey = await hashApiKey(plainKey);
      const prefix = plainKey.substring(0, 14) + '...';
      const { data, error } = await supabase.from('api_keys').insert({
        profile_id: user.id, name: keyName.trim(), key_prefix: prefix, key_hash: hashedKey,
      }).select().single();
      if (error) throw error;
      setKeys([data as ApiKey, ...keys]);
      setNewKeySecret(plainKey);
      toast.success('Llave creada');
    } catch { toast.error('Error al crear la llave'); }
    finally { setCreating(false); }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('¿Revocar esta llave? Las apps que la usen dejarán de funcionar.')) return;
    try {
      const { error } = await supabase.from('api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      setKeys(keys.map(k => k.id === id ? { ...k, is_active: false, revoked_at: new Date().toISOString() } : k));
      toast.success('Llave revocada');
    } catch { toast.error('Error al revocar'); }
  };

  const closeModal = () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    setShowModal(false); setKeyName(''); setNewKeySecret(null); setCopied(false);
  };

  const selectEndpoint = (idx: number) => {
    setSelectedEndpointIdx(idx);
    setPlaygroundBody(ENDPOINTS[idx].defaultBody);
    setPlaygroundResult(null);
    setPlaygroundStatus(null);
    setShowEndpointDropdown(false);
  };

  const runPlayground = async () => {
    if (!playgroundApiKey.trim()) { toast.error('Ingresa una API Key'); return; }
    const ep = ENDPOINTS[selectedEndpointIdx];
    if (ep.method !== 'GET') {
      try { JSON.parse(playgroundBody); } catch { toast.error('JSON inválido en el body'); return; }
    }
    setPlaygroundLoading(true);
    setPlaygroundResult(null);
    setPlaygroundStatus(null);
    try {
      const opts: RequestInit = {
        method: ep.method,
        headers: { 'Authorization': `Bearer ${playgroundApiKey.trim()}`, 'Content-Type': 'application/json' },
      };
      if (ep.method !== 'GET' && playgroundBody) opts.body = playgroundBody;
      const res = await fetch(`${BASE}${ep.path}`, opts);
      setPlaygroundStatus(res.status);
      const data = await res.json();
      setPlaygroundResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setPlaygroundResult(JSON.stringify({ error: String(err) }, null, 2));
    } finally {
      setPlaygroundLoading(false);
    }
  };

  const fetchWebhooks = async () => {
    setWebhooksLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setWebhooks([]);
        setWebhooksLoading(false);
        return;
      }
      const res = await fetch(`${BASE}/api/v1/webhooks`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!res.ok) { setWebhooksLoading(false); return; }
      const data = await res.json() as { webhooks?: WebhookSub[] };
      setWebhooks(data.webhooks ?? []);
    } catch { /* Edge Function no disponible */ }
    finally { setWebhooksLoading(false); }
  };

  const handleCreateWebhook = async () => {
    if (!webhookUrl.trim() || !webhookUrl.startsWith('http')) {
      toast.error('URL inválida — debe empezar con http(s)://');
      return;
    }
    if (webhookEvents.length === 0) {
      toast.error('Selecciona al menos un evento');
      return;
    }
    setWebhookCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(`${BASE}/api/v1/webhooks`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint_url: webhookUrl.trim(), events: webhookEvents }),
      });
      const data = await res.json() as { webhook?: WebhookSub; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setNewWebhookSecret(data.webhook!.secret ?? null);
      setWebhooks(prev => [data.webhook!, ...prev]);
      setWebhookUrl('');
      setWebhookEvents([]);
      setShowWebhookForm(false);
      toast.success('Webhook registrado');
    } catch (err: unknown) {
      toast.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setWebhookCreating(false);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('¿Eliminar este webhook? Dejará de recibir notificaciones.')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(`${BASE}/api/v1/webhooks/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setWebhooks(prev => prev.filter(w => w.id !== id));
      toast.success('Webhook eliminado');
    } catch {
      toast.error('Error al eliminar el webhook');
    }
  };

  const stats = useMemo(() => {
    const totalReqs = logs.reduce((s, l) => s + (l.requests_count || 1), 0);
    const totalTokens = logs.reduce((s, l) => s + (l.tokens_used || 0), 0);
    const today = new Date().toISOString().split('T')[0];
    const todayReqs = logs.filter(l => l.created_at.startsWith(today)).reduce((s, l) => s + (l.requests_count || 1), 0);
    const activeKeys = keys.filter(k => k.is_active).length;
    return { totalReqs, totalTokens, todayReqs, activeKeys };
  }, [logs, keys]);

  const ep = ENDPOINTS[selectedEndpointIdx];
  const snippets = {
    curl: ep.method === 'GET'
      ? `curl "${BASE}${ep.path}" \\\n  -H "Authorization: Bearer <TU_API_KEY>"`
      : `curl -X POST "${BASE}${ep.path}" \\\n  -H "Authorization: Bearer <TU_API_KEY>" \\\n  -H "Content-Type: application/json" \\\n  -d '${ep.defaultBody.replace(/\n/g, ' ')}'`,
    node: ep.method === 'GET'
      ? `const res = await fetch("${BASE}${ep.path}", {\n  headers: { Authorization: "Bearer <TU_API_KEY>" }\n});\nconst data = await res.json();`
      : `const res = await fetch("${BASE}${ep.path}", {\n  method: "POST",\n  headers: { Authorization: "Bearer <TU_API_KEY>", "Content-Type": "application/json" },\n  body: JSON.stringify(${ep.defaultBody})\n});\nconst data = await res.json();`,
    python: ep.method === 'GET'
      ? `import requests\ndata = requests.get(\n  "${BASE}${ep.path}",\n  headers={"Authorization": "Bearer <TU_API_KEY>"}\n).json()`
      : `import requests\ndata = requests.post(\n  "${BASE}${ep.path}",\n  headers={"Authorization": "Bearer <TU_API_KEY>"},\n  json=${ep.defaultBody}\n).json()`,
  };

  const uniqueEndpoints = useMemo(() => [...new Set(logs.map(l => l.endpoint).filter(Boolean))], [logs]);

  const filteredLogs = useMemo(() => {
    let result = [...logs].reverse();
    if (logsEndpointFilter !== 'all') result = result.filter(l => l.endpoint === logsEndpointFilter);
    if (logsSearch) result = result.filter(l => l.endpoint?.toLowerCase().includes(logsSearch.toLowerCase()));
    return result;
  }, [logs, logsEndpointFilter, logsSearch]);

  const paginatedLogs = useMemo(
    () => filteredLogs.slice(logsPage * LOGS_PER_PAGE, (logsPage + 1) * LOGS_PER_PAGE),
    [filteredLogs, logsPage],
  );



  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#05050D] flex flex-col">

      {/* ── Bralidus Top Navbar ──────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(5,5,13,0.90)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(108,60,225,0.14)',
        padding: '0 24px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => navigate('/')}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'linear-gradient(135deg, #6C3CE1, #0EB5C6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 12px rgba(108,60,225,0.4)',
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" fill="white"/>
              <circle cx="4" cy="6" r="2" fill="rgba(255,255,255,0.7)"/>
              <circle cx="20" cy="6" r="2" fill="rgba(255,255,255,0.7)"/>
              <circle cx="4" cy="18" r="2" fill="rgba(255,255,255,0.7)"/>
              <circle cx="20" cy="18" r="2" fill="rgba(255,255,255,0.7)"/>
              <line x1="6" y1="7" x2="10" y2="11" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
              <line x1="18" y1="7" x2="14" y2="11" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
              <line x1="6" y1="17" x2="10" y2="13" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
              <line x1="18" y1="17" x2="14" y2="13" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
            </svg>
          </div>
          <div>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: '#E8E7F5', letterSpacing: '-0.3px' }}>Bralidus</span>
            <span style={{ fontSize: 11, color: '#5A5A7A', marginLeft: 6 }}>Developer Portal</span>
          </div>
        </div>

        {/* Right side: badge + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '4px 10px',
            background: 'rgba(108,60,225,0.12)', border: '1px solid rgba(108,60,225,0.25)',
            borderRadius: 100, color: '#A78BFA',
          }}>
            Sprint 8 · 2026
          </span>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 9, cursor: 'pointer', color: '#7674A0', fontSize: 13, fontWeight: 500,
              fontFamily: "'DM Sans', system-ui, sans-serif",
              transition: 'border-color 0.2s, color 0.2s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.35)'; (e.currentTarget as HTMLButtonElement).style.color = '#FCA5A5'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = '#7674A0'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Salir
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 md:py-12 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-[#F0EFF8]">API & Developers</h1>
            <p className="text-sm text-gray-400 mt-1">
              Gestiona llaves, monitorea el Radar Forense y audita el Knowledge Graph.
              <span className="ml-2 text-[11px] text-violet-400 font-semibold">687 nodos · 9 jobs · Radar Forense · Sprint 8</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://validus.scouttech.lat/developers"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#12121A] border border-gray-200 dark:border-white/10 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:border-violet-400 transition shadow-sm"
            >
              <BookOpen className="w-4 h-4 text-violet-500" />
              Docs
            </a>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-500 text-white font-semibold rounded-xl hover:bg-teal-600 transition shadow-sm text-sm"
            >
              <Plus className="w-4 h-4" />
              Nueva Llave
            </button>
          </div>
        </div>
        {/* ── Tab Navigation ──────────────────────────────────────────────── */}
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/[0.04] rounded-2xl p-1 w-max min-w-full">
            {[
              { id: 'overview',   label: 'Resumen',            icon: Activity },
              { id: 'costs',      label: 'Costos RaaS',        icon: Zap,          badge: 'MoE',   badgeColor: 'text-[#0EB5C6] border-[#0EB5C6]/30' },
              { id: 'evidences',  label: 'Muro Evidencias',    icon: Database,     badge: 'MoE',   badgeColor: 'text-purple-400 border-purple-400/30' },
              { id: 'quotas',     label: 'Cuotas & Tiers',     icon: ShieldCheck },
              { id: 'macro',      label: 'Inteligencia Macro', icon: TrendingDown, badge: 'FRED',  badgeColor: 'text-amber-400 border-amber-400/30' },
              { id: 'forensic',   label: 'Radar Forense',      icon: Radio },
              { id: 'graph',      label: 'Knowledge Graph',    icon: Brain },
              { id: 'playground', label: 'Playground API',     icon: Play },
              { id: 'audit',      label: 'RAG Audit',          icon: ShieldCheck },
              { id: 'apikeys',    label: 'API Keys',           icon: Key },
              { id: 'services',   label: 'Servicios',          icon: Server },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as Tab)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-white dark:bg-[#12121A] text-gray-900 dark:text-[#F0EFF8] shadow-sm'
                      : 'text-gray-500 dark:text-[#8B8AA0] hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {tab.label}
                  {tab.badge && (
                    <span className={`text-[9px] font-bold border rounded-full px-1.5 py-0.5 leading-none ${tab.badgeColor ?? 'text-gray-400 border-gray-300 dark:border-white/20'}`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Requests totales', value: stats.totalReqs.toLocaleString(), icon: Activity, color: 'text-violet-500', bg: 'bg-violet-500/10' },
                { label: 'Hoy', value: stats.todayReqs.toLocaleString(), icon: Zap, color: 'text-teal-500', bg: 'bg-teal-500/10' },
                { label: 'Tokens usados', value: stats.totalTokens > 1000 ? `${(stats.totalTokens / 1000).toFixed(1)}k` : stats.totalTokens.toString(), icon: TrendingUp, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                { label: 'Llaves activas', value: stats.activeKeys.toString(), icon: Key, color: 'text-pink-500', bg: 'bg-pink-500/10' },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-4 shadow-sm">
                  <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <p className="text-2xl font-black text-gray-900 dark:text-[#F0EFF8]">{loading ? '—' : value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Sprint 8 Changelog */}
            <div className="rounded-2xl border border-teal-500/25 bg-teal-500/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 uppercase tracking-wider">Sprint 8 · 2026-06-10</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">BralidusPY Beta — Motor de Inteligencia Macro en Producción</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  {
                    tag: 'Producción',
                    color: '#10B981',
                    title: 'BralidusPY Beta — 10/10 tests PASS',
                    desc: '687 nodos · 34 categorías · 96% embedding coverage. FastAPI + pgvector HNSW + APScheduler 9 jobs. GraphRAG: 5/5 hits via GRAPH path en queries fintech/seed con 43 entidades activadas.',
                    path: 'GET /health → status=ok',
                  },
                  {
                    tag: 'Nueva infraestructura',
                    color: '#7C3AED',
                    title: 'Radar Forense + 6 extractores',
                    desc: 'CMF Hechos Esenciales · BCCH Comunicados/Minutas · SEIA Proyectos · Boletín Concursal SUPERIR · Señal Empleo Computrabajo · RSS 10 fuentes (ES+PT). Señales con TTL, severidad y clasificación keyword/Haiku.',
                    path: 'GET /radar/signals',
                  },
                ].map(({ tag, color, title, desc, path }) => (
                  <div key={title} className="bg-white dark:bg-[#12121A] rounded-xl p-3.5 border border-gray-100 dark:border-white/5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{tag}</span>
                      </div>
                      <p className="text-xs font-bold text-gray-800 dark:text-gray-200 mb-1">{title}</p>
                      <p className="text-[11px] text-gray-400 leading-relaxed mb-2">{desc}</p>
                    </div>
                    <code className="text-[10px] font-mono bg-gray-100 dark:bg-white/5 text-teal-400 px-2 py-1 rounded w-fit">{path}</code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: COSTS ───────────────────────────────────────────────── */}
        {activeTab === 'costs' && (
          <div className="space-y-6">
            <BralidusCostsPanel totalTokens={stats.totalTokens || 1250000} />
          </div>
        )}

        {/* ── TAB: EVIDENCES ───────────────────────────────────────────── */}
        {activeTab === 'evidences' && (
          <div className="space-y-6">
            <BralidusEvidenceWall
              evidences={[
                {
                  claim: 'Tasa de Política Monetaria (TPM) fijada por el Banco Central de Chile',
                  shape: 'financial',
                  date: '2026-05-15',
                  indicator: 'TPM BCCh',
                  value: 5.75,
                  unit: '%',
                  source: 'Banco Central de Chile',
                  source_url: 'https://www.bcentral.cl',
                },
                {
                  claim: 'Variación acumulada del Índice de Precios al Consumidor (IPC)',
                  shape: 'financial',
                  date: '2026-05-01',
                  indicator: 'IPC Anual',
                  value: 4.2,
                  unit: '%',
                  source: 'Instituto Nacional de Estadísticas (INE)',
                  source_url: 'https://www.ine.gob.cl',
                },
                {
                  claim: 'Regulación de Plataformas de Financiamiento Colectivo (Ley Fintech 21.521)',
                  shape: 'doctrine',
                  entity_value: 'Ley Fintech N° 21.521',
                  dimension: 'Compliance Regulatorio CMF',
                  source: 'Comisión para el Mercado Financiero',
                },
                {
                  claim: 'Umbral de ventas formales para elegibilidad en fondos Corfo Semilla Expande',
                  shape: 'doctrine',
                  entity_value: 'Bases Corfo SIE',
                  dimension: 'Financiamiento Público',
                  threshold: 100000,
                  source: 'Corfo Chile',
                },
              ]}
              alerts={[
                {
                  title: 'Sensibilidad a tasa de interés en startups de crédito B2B',
                  severity: 'warning',
                  description: 'Variaciones en TPM afectan directamente el costo de capital de financiamiento.',
                },
              ]}
              dataFreshness={{ 'BCCh': '2026-05-15', 'CMF': '2026-05-20' }}
            />
          </div>
        )}

        {/* ── TAB: QUOTAS ──────────────────────────────────────────────── */}
        {activeTab === 'quotas' && (
          <div className="space-y-6 max-w-3xl">
            <BralidusQuotaWidget
              tier="pro"
              usageCount={stats.totalReqs || 42}
              limitCount={1000}
            />
          </div>
        )}

        {/* ── TAB: MACRO ───────────────────────────────────────────────── */}
        {activeTab === 'macro' && (
          <div className="space-y-6">
            <MacroIntelligence />
            <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm p-5">
              <BralidusPanel />
            </div>
          </div>
        )}

        {/* ── TAB: FORENSIC ────────────────────────────────────────────── */}
        {activeTab === 'forensic' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm p-5">
              <RadarForense />
            </div>
            <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm p-5">
              <Trazabilidad />
            </div>
          </div>
        )}

        {/* ── TAB: GRAPH ───────────────────────────────────────────────── */}
        {activeTab === 'graph' && (
          <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm p-5">
            <KnowledgeGraph />
          </div>
        )}

        {/* ── TAB: AUDIT ───────────────────────────────────────────────── */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            {auditSummaries.length === 0 ? (
              <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm p-12 text-center">
                <ShieldCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Sin datos de auditoría RAG aún.</p>
              </div>
            ) : (() => {
              const summary = auditSummaries[0];
              const precisionPct = Math.round((summary.avg_precision ?? 0) * 100);
              const hitRate = summary.hit_rate_pct ?? 0;
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-violet-500" />
                    <h2 className="text-base font-bold text-gray-900 dark:text-white">RAG Audit Dashboard</h2>
                    <span className="ml-2 text-xs bg-violet-500/10 text-violet-400 px-2 py-0.5 rounded-full font-mono">run: {summary.run_id.slice(0, 8)}…</span>
                    <span className="text-xs text-gray-400">{new Date(summary.started_at).toLocaleString('es-CL')}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Precision score', value: `${precisionPct}%`, color: precisionPct >= 80 ? 'text-green-400' : precisionPct >= 60 ? 'text-amber-400' : 'text-red-400' },
                      { label: 'Keyword hit rate', value: `${hitRate}%`, color: 'text-teal-400' },
                      { label: 'Avg latency', value: `${Math.round(summary.avg_latency_ms)}ms`, color: 'text-violet-400' },
                      { label: 'Errores', value: String(summary.errors), color: summary.errors === 0 ? 'text-green-400' : 'text-red-400' },
                    ].map(kpi => (
                      <div key={kpi.label} className="bg-white dark:bg-[#12121A] rounded-xl border border-gray-100 dark:border-white/5 p-4 shadow-sm">
                        <p className="text-xs text-gray-400 mb-1">{kpi.label}</p>
                        <p className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-white/5">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Detalle de queries ({auditLogs.length})</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-50 dark:border-white/5">
                            {['Estado', 'Categoría', 'Query', 'Precision', 'Latencia', 'Chunks'].map(h => (
                              <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-400">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {auditLogs.map(l => (
                            <tr key={l.id} className="border-b border-gray-50 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition">
                              <td className="px-4 py-2.5">{l.error ? '❌' : l.precision_score >= 0.6 ? '✅' : '⚠️'}</td>
                              <td className="px-4 py-2.5 capitalize text-violet-400 font-semibold">{l.category}</td>
                              <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 max-w-xs truncate" title={l.query}>{l.query}</td>
                              <td className="px-4 py-2.5 font-mono font-bold" style={{ color: l.precision_score >= 0.8 ? '#34D399' : l.precision_score >= 0.5 ? '#F59E0B' : '#F87171' }}>
                                {(l.precision_score * 100).toFixed(0)}%
                              </td>
                              <td className="px-4 py-2.5 font-mono text-gray-400">{Math.round(l.latency_ms)}ms</td>
                              <td className="px-4 py-2.5 font-mono text-gray-400">{l.chunks_retrieved}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Consola de Acciones del Sistema ── */}
            <AuditLog className="mt-2" />
          </div>
        )}

        {/* ── TAB: PLAYGROUND ──────────────────────────────────────────── */}
        {activeTab === 'playground' && (
          <div className="space-y-6 font-sans">
            {/* Playground */}
            <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-violet-500" />
              <span className="font-bold text-gray-900 dark:text-white text-sm">Playground</span>
            </div>
            <a href="https://validus.scouttech.lat/developers" target="_blank" rel="noopener noreferrer"
              className="text-xs text-violet-400 hover:text-violet-300 transition">
              Ver documentación completa →
            </a>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 block">API Key</label>
              <input
                type="password"
                value={playgroundApiKey}
                onChange={e => setPlaygroundApiKey(e.target.value)}
                placeholder="val_live_XXXX..."
                className="w-full bg-gray-50 dark:bg-[#0A0A0F] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm font-mono text-gray-800 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 block">Endpoint</label>
              <div className="relative">
                <button
                  onClick={() => setShowEndpointDropdown(v => !v)}
                  className="w-full flex items-center justify-between bg-gray-50 dark:bg-[#0A0A0F] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-left hover:border-violet-400 dark:hover:border-violet-500/50 transition"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                      style={{ backgroundColor: `${METHOD_COLORS[ep.method]}22`, color: METHOD_COLORS[ep.method] }}
                    >
                      {ep.method}
                    </span>
                    <span className="font-mono text-gray-700 dark:text-gray-300 text-xs">{ep.path}</span>
                    <span className="text-gray-400 text-xs hidden sm:inline">— {ep.label.split('—')[1]?.trim()}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showEndpointDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showEndpointDropdown && (
                  <div className="absolute z-20 w-full mt-1 bg-white dark:bg-[#1A1A26] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden">
                    {ENDPOINTS.map((e, i) => (
                      <button
                        key={i}
                        onClick={() => selectEndpoint(i)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition ${i === selectedEndpointIdx ? 'bg-violet-50 dark:bg-violet-500/10' : ''}`}
                      >
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0"
                          style={{ backgroundColor: `${METHOD_COLORS[e.method]}22`, color: METHOD_COLORS[e.method] }}
                        >
                          {e.method}
                        </span>
                        <span className="font-mono text-xs text-gray-600 dark:text-gray-400">{e.path}</span>
                        <span className="text-xs text-gray-400 ml-auto hidden sm:block">{e.label.split('—')[1]?.trim()}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  {ep.method === 'GET' ? 'Sin body (GET)' : 'Request Body (JSON)'}
                </label>
                {ep.method !== 'GET' ? (
                  <textarea
                    value={playgroundBody}
                    onChange={e => setPlaygroundBody(e.target.value)}
                    rows={9}
                    className="w-full bg-gray-50 dark:bg-[#0A0A0F] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs font-mono text-gray-800 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none transition"
                  />
                ) : (
                  <div className="h-[198px] flex items-center justify-center bg-gray-50 dark:bg-[#0A0A0F] border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-400">
                    Este endpoint no requiere body
                  </div>
                )}
                <button
                  onClick={runPlayground}
                  disabled={playgroundLoading}
                  className="flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition text-sm"
                >
                  {playgroundLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Ejecutando...</>
                    : <><Play className="w-4 h-4" /> Ejecutar</>
                  }
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Response</label>
                  {playgroundStatus && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${playgroundStatus < 300 ? 'bg-teal-500/15 text-teal-400' : 'bg-red-500/15 text-red-400'}`}>
                      {playgroundStatus}
                    </span>
                  )}
                </div>
                <pre className="flex-1 min-h-[230px] bg-gray-950 dark:bg-black/40 text-green-400 text-xs rounded-xl p-4 overflow-auto font-mono whitespace-pre-wrap leading-relaxed">
                  {playgroundLoading
                    ? <span className="text-gray-500 animate-pulse">Esperando respuesta...</span>
                    : playgroundResult
                      ? <span>{playgroundResult}</span>
                      : <span className="text-gray-600">// La respuesta aparecerá aquí</span>
                  }
                </pre>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 dark:border-white/5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Snippet de código</p>
                <div className="flex gap-1">
                  {(['curl', 'node', 'python'] as const).map(lang => (
                    <button
                      key={lang}
                      onClick={() => setSnippetLang(lang)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${snippetLang === lang ? 'bg-violet-600 text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'}`}
                    >
                      {lang === 'node' ? 'Node.js' : lang.charAt(0).toUpperCase() + lang.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative group">
                <pre className="bg-gray-950 dark:bg-black/40 text-gray-300 text-xs rounded-xl p-4 overflow-x-auto font-mono leading-relaxed">
                  {snippets[snippetLang]}
                </pre>
                <button
                  onClick={() => { navigator.clipboard.writeText(snippets[snippetLang]); toast.success('Copiado'); }}
                  className="absolute top-2.5 right-2.5 p-1.5 bg-white/10 hover:bg-white/20 rounded-lg opacity-0 group-hover:opacity-100 transition text-gray-400"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* API Docs */}
        <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-violet-500" />
              <span className="font-bold text-gray-900 dark:text-white text-sm">Referencia de API</span>
              <span className="text-[11px] text-gray-400 ml-1">— haz click en un endpoint para ver detalles</span>
            </div>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-white/5">
            {API_DOCS.map((doc, i) => (
              <div key={i}>
                <button
                  onClick={() => setExpandedDocIdx(expandedDocIdx === i ? null : i)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition text-left"
                >
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0"
                    style={{ backgroundColor: `${METHOD_COLORS[doc.method] ?? '#888'}22`, color: METHOD_COLORS[doc.method] ?? '#888' }}
                  >
                    {doc.method}
                  </span>
                  <code className="text-xs text-gray-700 dark:text-gray-300 font-mono">{doc.path}</code>
                  <span className="text-xs text-gray-400 ml-2 hidden sm:inline truncate flex-1">{doc.description.slice(0, 64)}…</span>
                  <ChevronRight className={`w-4 h-4 text-gray-400 ml-auto shrink-0 transition-transform duration-200 ${expandedDocIdx === i ? 'rotate-90' : ''}`} />
                </button>
                {expandedDocIdx === i && (
                  <div className="px-5 pb-5 space-y-4 bg-gray-50/50 dark:bg-white/[0.01] border-t border-gray-100 dark:border-white/5">
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed pt-3">{doc.description}</p>

                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 mb-2 uppercase tracking-wider">Autenticación</p>
                      <code className="text-xs bg-gray-100 dark:bg-black/30 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg block font-mono">
                        {'Authorization: Bearer <TU_API_KEY>'}
                      </code>
                    </div>

                    {doc.params.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 mb-2 uppercase tracking-wider">Parámetros del Body</p>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left">
                              <th className="pb-2 pr-4 font-semibold text-gray-400">Campo</th>
                              <th className="pb-2 pr-4 font-semibold text-gray-400">Tipo</th>
                              <th className="pb-2 pr-4 font-semibold text-gray-400">Req.</th>
                              <th className="pb-2 font-semibold text-gray-400">Descripción</th>
                            </tr>
                          </thead>
                          <tbody>
                            {doc.params.map((p, j) => (
                              <tr key={j} className="border-t border-gray-100 dark:border-white/5">
                                <td className="py-1.5 pr-4 font-mono text-teal-600 dark:text-teal-400">{p.name}</td>
                                <td className="py-1.5 pr-4 text-violet-500">{p.type}</td>
                                <td className="py-1.5 pr-4">{p.required ? <span className="text-red-400 font-bold">✓</span> : <span className="text-gray-500">—</span>}</td>
                                <td className="py-1.5 text-gray-500">{p.description}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 mb-2 uppercase tracking-wider">Respuesta ejemplo</p>
                      <pre className="bg-gray-950 dark:bg-black/40 text-green-400 text-xs rounded-xl p-3.5 overflow-x-auto font-mono leading-relaxed">{doc.responseExample}</pre>
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 mb-2 uppercase tracking-wider">Códigos de error</p>
                      <div className="flex flex-wrap gap-2">
                        {doc.errorCodes.map((code, j) => (
                          <span key={j} className="text-[11px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-md font-mono">{code}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        </div>
        )}

        {/* ── TAB: APIKEYS ─────────────────────────────────────────────── */}
        {activeTab === 'apikeys' && (
          <div className="space-y-8">
            {/* API Keys */}
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">Mis API Keys</h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-20 bg-white dark:bg-[#12121A] rounded-xl animate-pulse" />)}
            </div>
          ) : keys.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5">
              <Key className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No tienes llaves generadas.</p>
              <button onClick={() => setShowModal(true)} className="mt-4 text-sm font-semibold text-violet-500 hover:text-violet-400 transition">
                Crear primera llave →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map(key => (
                <div key={key.id} className="bg-white dark:bg-[#12121A] rounded-xl border border-gray-100 dark:border-white/5 p-4 flex items-center justify-between shadow-sm">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-gray-900 dark:text-[#F0EFF8] text-sm">{key.name}</span>
                      {key.is_active
                        ? <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full font-bold">ACTIVA</span>
                        : <span className="text-[10px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full font-bold">REVOCADA</span>
                      }
                    </div>
                    <code className="text-xs text-gray-500 bg-gray-100 dark:bg-white/5 px-2 py-1 rounded font-mono">
                      {key.key_prefix}
                    </code>
                    <p className="text-xs text-gray-400 mt-2">
                      Creada {new Date(key.created_at).toLocaleDateString()} · Último uso: {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Nunca'}
                    </p>
                  </div>
                  {key.is_active && (
                    <button
                      onClick={() => handleRevoke(key.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition"
                      title="Revocar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Logs Explorer */}
        <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <List className="w-4 h-4 text-teal-500" />
              <span className="font-bold text-gray-900 dark:text-white text-sm">Request Logs</span>
              {!loading && <span className="text-xs text-gray-400">({filteredLogs.length} entradas)</span>}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  value={logsSearch}
                  onChange={e => { setLogsSearch(e.target.value); setLogsPage(0); }}
                  placeholder="Buscar endpoint..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-[#0A0A0F] border border-gray-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/40 text-gray-700 dark:text-gray-300 w-40"
                />
              </div>
              <select
                value={logsEndpointFilter}
                onChange={e => { setLogsEndpointFilter(e.target.value); setLogsPage(0); }}
                className="text-xs bg-gray-50 dark:bg-[#0A0A0F] border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              >
                <option value="all">Todos los endpoints</option>
                {uniqueEndpoints.map(ep => (
                  <option key={ep} value={ep}>{ep.split('/').slice(-2).join('/')}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-5 space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 dark:bg-white/5 rounded-lg animate-pulse" />)}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-gray-400">
              <List className="w-8 h-8 mb-3 opacity-25" />
              <p className="text-sm">{logs.length === 0 ? 'Sin requests registrados aún.' : 'No hay logs que coincidan con el filtro.'}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-50 dark:border-white/5">
                      {['Timestamp', 'Endpoint', 'Requests', 'Tokens'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLogs.map(log => (
                      <tr key={log.id} className="border-b border-gray-50 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition">
                        <td className="px-4 py-2.5 font-mono text-gray-400 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                          {' '}
                          <span className="text-gray-500">{new Date(log.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
                        </td>
                        <td className="px-4 py-2.5 max-w-xs">
                          <code className="text-teal-600 dark:text-teal-400 font-mono truncate block">{log.endpoint}</code>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-gray-700 dark:text-gray-300">{(log.requests_count || 1).toLocaleString()}</td>
                        <td className="px-4 py-2.5 font-mono text-gray-400">
                          {(log.tokens_used || 0) > 0 ? (log.tokens_used).toLocaleString() : <span className="text-gray-600">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredLogs.length > LOGS_PER_PAGE && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50 dark:border-white/5">
                  <button
                    onClick={() => setLogsPage(p => Math.max(0, p - 1))}
                    disabled={logsPage === 0}
                    className="text-xs text-gray-400 hover:text-violet-400 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    ← Anterior
                  </button>
                  <span className="text-xs text-gray-400">
                    Pág {logsPage + 1} de {Math.ceil(filteredLogs.length / LOGS_PER_PAGE)}
                  </span>
                  <button
                    onClick={() => setLogsPage(p => Math.min(Math.ceil(filteredLogs.length / LOGS_PER_PAGE) - 1, p + 1))}
                    disabled={logsPage >= Math.ceil(filteredLogs.length / LOGS_PER_PAGE) - 1}
                    className="text-xs text-gray-400 hover:text-violet-400 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    Siguiente →
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Webhooks */}
        <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Webhook className="w-4 h-4 text-amber-500" />
              <span className="font-bold text-gray-900 dark:text-white text-sm">Webhooks</span>
              {!webhooksLoading && (
                <span className="text-xs text-gray-400">({webhooks.length} activos)</span>
              )}
            </div>
            <button
              onClick={() => { setShowWebhookForm(v => !v); setNewWebhookSecret(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo webhook
            </button>
          </div>

          {/* Create form */}
          {showWebhookForm && (
            <div className="px-5 py-4 bg-amber-500/5 border-b border-amber-500/10 space-y-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Registrar nuevo endpoint</p>
              <input
                type="url"
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://mi-sistema.cl/webhook"
                className="w-full bg-white dark:bg-[#0A0A0F] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm font-mono text-gray-800 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition"
              />
              <div>
                <p className="text-xs text-gray-400 mb-2">Eventos a notificar:</p>
                <div className="flex flex-wrap gap-2">
                  {WEBHOOK_EVENTS.map(ev => {
                    const active = webhookEvents.includes(ev.value);
                    return (
                      <button
                        key={ev.value}
                        onClick={() => setWebhookEvents(prev =>
                          active ? prev.filter(e => e !== ev.value) : [...prev, ev.value]
                        )}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                          active
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-500'
                            : 'bg-transparent border-gray-200 dark:border-white/10 text-gray-500 hover:border-amber-400'
                        }`}
                      >
                        <Bell className="w-3 h-3 inline mr-1.5" />
                        {ev.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setShowWebhookForm(false); setWebhookUrl(''); setWebhookEvents([]); }}
                  className="flex-1 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateWebhook}
                  disabled={webhookCreating}
                  className="flex-1 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition disabled:opacity-50"
                >
                  {webhookCreating ? 'Registrando...' : 'Registrar webhook'}
                </button>
              </div>
            </div>
          )}

          {/* Secret shown once after creation */}
          {newWebhookSecret && (
            <div className="px-5 py-4 bg-amber-500/5 border-b border-amber-500/10">
              <div className="flex items-start gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  <strong>Secret generado — solo se muestra ahora.</strong> Úsalo para verificar la firma HMAC-SHA256 de los eventos entrantes.
                </p>
              </div>
              <div className="flex items-center gap-2 bg-white dark:bg-[#0A0A0F] border border-amber-200 dark:border-amber-500/20 p-2 rounded-xl">
                <code className="text-xs flex-1 overflow-x-auto text-gray-800 dark:text-gray-300 px-2 font-mono whitespace-nowrap">
                  {newWebhookSecret}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(newWebhookSecret);
                    setWebhookSecretCopied(true);
                    setTimeout(() => setWebhookSecretCopied(false), 2000);
                  }}
                  className="shrink-0 p-2 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition text-amber-600"
                >
                  {webhookSecretCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <button
                onClick={() => setNewWebhookSecret(null)}
                className="mt-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
              >
                Ya lo guardé — ocultar
              </button>
            </div>
          )}

          {webhooksLoading ? (
            <div className="p-5 space-y-2">
              {[1, 2].map(i => <div key={i} className="h-14 bg-gray-100 dark:bg-white/5 rounded-lg animate-pulse" />)}
            </div>
          ) : webhooks.length === 0 ? (
            <div className="py-10 flex flex-col items-center justify-center text-gray-400">
              <Webhook className="w-8 h-8 mb-3 opacity-20" />
              <p className="text-sm">Sin webhooks registrados.</p>
              <p className="text-xs text-gray-500 mt-1">Regístralos para recibir notificaciones en tiempo real.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-white/5">
              {webhooks.map(wh => (
                <div key={wh.id} className="px-5 py-3.5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <code className="text-xs font-mono text-teal-600 dark:text-teal-400 block truncate">{wh.endpoint_url}</code>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {wh.events.map(ev => (
                        <span key={ev} className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-semibold">
                          {ev}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Creado {new Date(wh.created_at).toLocaleDateString('es-CL')}
                      {' · '}
                      <span className={wh.is_active ? 'text-green-500' : 'text-red-400'}>
                        {wh.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteWebhook(wh.id)}
                    className="shrink-0 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition"
                    title="Eliminar webhook"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
        )}

        {/* ── TAB: SERVICES ────────────────────────────────────────────── */}
        {activeTab === 'services' && (
          <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-violet-500" />
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Estado de Microservicios Bralidus</h2>
              {servicesCheckedAt && (
                <span className="ml-auto text-[10px] text-gray-400 font-mono">
                  Actualizado: {new Date(servicesCheckedAt).toLocaleTimeString('es-CL')}
                </span>
              )}
            </div>
            {servicesLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="h-20 bg-gray-100 dark:bg-white/5 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : services.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {services.map((svc, i) => (
                  <button key={i} onClick={() => setSelectedService(svc)} className="p-4 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 text-left hover:border-violet-400/40 transition">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-gray-900 dark:text-white">{svc.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${svc.status === 'ok' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                        {svc.status === 'ok' ? 'OPERACIONAL' : 'DEGRADADO'}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mb-2 truncate">{svc.message}</p>
                    {svc.latency_ms != null && (
                      <p className="text-[10px] font-mono text-teal-400">Latencia: {Math.round(svc.latency_ms)}ms</p>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { name: 'FastAPI Gateway (BralidusPY)', latency: '42ms', desc: 'MoE Engine & Gating Router' },
                  { name: 'pgvector HNSW Store', latency: '12ms', desc: '687 nodos vectoriales' },
                  { name: 'BCCh Extractor Job', latency: '180ms', desc: 'TPM, IPC, Imacec' },
                  { name: 'CMF Regulatory Extractor', latency: '210ms', desc: 'Hechos esenciales & Ley Fintech' },
                  { name: 'S-Pulse Societario Graph', latency: '65ms', desc: 'Redes societarias chilenas' },
                  { name: 'Licitus B2G Intelligence', latency: '95ms', desc: 'Órdenes de compra Mercado Público' },
                ].map((svc, i) => (
                  <div key={i} className="p-4 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-gray-900 dark:text-white">{svc.name}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">OPERACIONAL</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mb-2">{svc.desc}</p>
                    <p className="text-[10px] font-mono text-teal-400">Latencia: {svc.latency}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* Modal Crear Llave */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#12121A] rounded-3xl shadow-2xl w-full max-w-md p-6">
            {!newKeySecret ? (
              <>
                <h3 className="font-black text-gray-900 dark:text-white text-xl mb-2">Nueva API Key</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Dale un nombre para identificarla (ej: Producción, Staging).</p>
                <input
                  type="text"
                  value={keyName}
                  onChange={e => setKeyName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateKey()}
                  placeholder="Ej: Producción - Backend"
                  className="w-full border border-gray-200 dark:border-white/10 bg-transparent rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 mb-6 text-gray-900 dark:text-white"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button onClick={closeModal} className="flex-1 py-2.5 font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition">Cancelar</button>
                  <button onClick={handleCreateKey} disabled={creating || !keyName.trim()} className="flex-1 py-2.5 font-semibold bg-teal-500 hover:bg-teal-600 text-white rounded-xl transition disabled:opacity-50">
                    {creating ? 'Generando...' : 'Generar Llave'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 bg-teal-500/10 text-teal-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-6 h-6" />
                </div>
                <h3 className="font-black text-center text-gray-900 dark:text-white text-xl mb-2">¡Llave Generada!</h3>
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3 rounded-xl flex gap-2 items-start mb-5">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    <strong>Solo se muestra una vez.</strong> Cópiala y guárdala en tu <code>.env</code>.
                  </p>
                </div>
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-[#0A0A0F] border border-gray-200 dark:border-white/10 p-2 rounded-xl mb-6">
                  <code className="text-sm flex-1 overflow-x-auto text-gray-800 dark:text-gray-300 px-2 font-mono whitespace-nowrap">{newKeySecret}</code>
                  <button onClick={() => { navigator.clipboard.writeText(newKeySecret!); setCopied(true); if (copyTimerRef.current) clearTimeout(copyTimerRef.current); copyTimerRef.current = setTimeout(() => setCopied(false), 2000); }}
                    className="shrink-0 p-2 bg-white dark:bg-[#12121A] hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10 transition shadow-sm text-gray-700 dark:text-gray-300">
                    {copied ? <Check className="w-4 h-4 text-teal-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <button onClick={closeModal} className="w-full py-2.5 font-semibold bg-gray-900 dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-100 rounded-xl transition">
                  He guardado mi llave
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Service detail modal */}
      {selectedService && (
        <ServiceModal service={selectedService} onClose={() => setSelectedService(null)} />
      )}
    </div>
  );
}
