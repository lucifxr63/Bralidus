import { useEffect, useRef, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { KnowledgeGraph } from '@/components/KnowledgeGraph';
import {
  Key, Plus, Trash2, Copy, Check, AlertCircle, BookOpen,
  Play, Activity, Zap, Clock, TrendingUp, ChevronDown, Loader2, ShieldCheck,
  RefreshCw, Database, Brain, BarChart2, FileText, Globe, Server,
  List, Search, ChevronRight, BarChart3, Webhook, Bell,
} from 'lucide-react';
import { toast } from 'sonner';
import { generateApiKey, hashApiKey } from '@/utils/crypto';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';

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
    description: 'Consulta semántica al corpus de conocimiento de ValidateAI. Devuelve los fragmentos más relevantes con scores de similitud coseno.',
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
    description: 'Registra una URL HTTPS para recibir notificaciones cuando eventos de ValidateAI ocurran (validación completada, análisis listo, etc.).',
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
    description: 'Genera un análisis de due diligence completo usando IA para una validación. Integra RAG, datos económicos y el perfil del founder.',
    params: [
      { name: 'validation_id', type: 'string (UUID)', required: true, description: 'ID de la validación a analizar' },
    ],
    responseExample: '{\n  "analysis": {\n    "market": "...",\n    "team": "...",\n    "risks": "..."\n  },\n  "score": 0.78,\n  "generated_at": "2026-06-08T14:00:00Z"\n}',
    errorCodes: ['400 Invalid validation_id', '401 Unauthorized', '404 Validation not found'],
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
    label: 'Due Diligence — Generar análisis IA',
    color: '#0EB5C6',
    defaultBody: JSON.stringify({ validation_id: '<uuid-de-validacion>' }, null, 2),
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
] as const;

const METHOD_COLORS: Record<string, string> = {
  POST: '#0EB5C6',
  GET: '#2DD4BF',
  DELETE: '#EF4444',
};

const CHART_COLORS = ['#0EB5C6', '#2DD4BF', '#F59E0B', '#EC4899', '#94A3B8'];

const tooltipStyle = {
  backgroundColor: '#12121A',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '10px',
  color: '#F0EFF8',
  fontSize: '12px',
};

export function DeveloperPortal() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [logs, setLogs] = useState<ApiUsageLog[]>([]);
  const [auditSummaries, setAuditSummaries] = useState<AuditSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesCheckedAt, setServicesCheckedAt] = useState<string | null>(null);

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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { services?: ServiceInfo[]; checked_at?: string };
      setServices(data.services ?? []);
      setServicesCheckedAt(data.checked_at ?? null);
    } catch (err) {
      console.error('Health check failed:', err);
      toast.error('No se pudo verificar el estado de los servicios');
    } finally {
      setServicesLoading(false);
    }
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
      const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(`${BASE}/api/v1/webhooks`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json() as { webhooks?: WebhookSub[] };
      setWebhooks(data.webhooks ?? []);
    } catch { /* silent */ }
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

  const areaData = useMemo(() => {
    const days = [...Array(14)].map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (13 - i));
      return d.toISOString().split('T')[0];
    });
    const map: Record<string, { date: string; requests: number; tokens: number }> = {};
    days.forEach(date => { map[date] = { date, requests: 0, tokens: 0 }; });
    logs.forEach(l => {
      const d = l.created_at.split('T')[0];
      if (map[d]) { map[d].requests += l.requests_count || 1; map[d].tokens += l.tokens_used || 0; }
    });
    return Object.values(map);
  }, [logs]);

  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    logs.forEach(l => {
      const key = l.endpoint?.split('/').slice(-2).join('/') || 'other';
      map[key] = (map[key] || 0) + (l.requests_count || 1);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [logs]);

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

  const hasData = logs.length > 0;

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

  const monthlyStats = useMemo(() => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const monthStr = startOfMonth.toISOString();
    const monthLogs = logs.filter(l => l.created_at >= monthStr);
    return {
      requests: monthLogs.reduce((s, l) => s + (l.requests_count || 1), 0),
      tokens: monthLogs.reduce((s, l) => s + (l.tokens_used || 0), 0),
      limit_requests: 1000,
      limit_tokens: 500_000,
      resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
        .toLocaleDateString('es-CL', { day: 'numeric', month: 'long' }),
    };
  }, [logs]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0F] flex flex-col">
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 md:py-12 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-[#F0EFF8]">API & Developers</h1>
            <p className="text-sm text-gray-400 mt-1">Gestiona llaves y monitorea el consumo de tu RaaS.</p>
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

        {/* Rate Limits */}
        <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-teal-500" />
              <span className="font-bold text-gray-900 dark:text-white text-sm">Cuotas del Mes</span>
            </div>
            <span className="text-xs bg-violet-500/10 text-violet-400 px-2.5 py-1 rounded-full font-semibold">Free Plan</span>
          </div>
          <div className="space-y-4">
            {[
              { label: 'Requests', value: monthlyStats.requests, limit: monthlyStats.limit_requests, color: '#0EB5C6' },
              { label: 'Tokens', value: monthlyStats.tokens, limit: monthlyStats.limit_tokens, color: '#2DD4BF' },
            ].map(({ label, value, limit, color }) => {
              const pct = Math.min(100, (value / limit) * 100);
              const barColor = pct > 90 ? '#EF4444' : pct > 70 ? '#F59E0B' : color;
              return (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">
                      {value.toLocaleString()} / {limit >= 1000 ? `${(limit / 1000).toFixed(0)}k` : limit.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-gray-400 mt-4">
            Resetea el {monthlyStats.resetDate}.
          </p>
        </div>

        {/* Service Status */}
        <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-violet-500" />
              <span className="font-bold text-gray-900 dark:text-white text-sm">Estado de Servicios</span>
              {servicesCheckedAt && (
                <span className="text-[11px] text-gray-400">
                  · verificado {new Date(servicesCheckedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <button
              onClick={fetchServices}
              disabled={servicesLoading}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-violet-400 transition disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${servicesLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>

          <div className="p-5">
            {servicesLoading && services.length === 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="h-20 bg-gray-100 dark:bg-white/5 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {services.map(svc => {
                  const statusConfig = {
                    ok:       { dot: 'bg-emerald-500', text: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Activo' },
                    degraded: { dot: 'bg-amber-400',   text: 'text-amber-400',   bg: 'bg-amber-400/10',   border: 'border-amber-400/20',   label: 'Degradado' },
                    error:    { dot: 'bg-red-500',     text: 'text-red-500',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     label: 'Error' },
                    unused:   { dot: 'bg-gray-400',    text: 'text-gray-400',    bg: 'bg-white/5',        border: 'border-gray-200 dark:border-white/5', label: 'Sin uso' },
                  }[svc.status];

                  const categoryIcon = {
                    database:  Database,
                    ai:        Brain,
                    analytics: BarChart2,
                    parsing:   FileText,
                    data:      Globe,
                    gov:       ShieldCheck,
                  }[svc.category] ?? Server;
                  const CategoryIcon = categoryIcon;

                  return (
                    <div
                      key={svc.id}
                      className={`relative rounded-xl border p-3.5 ${statusConfig.bg} ${statusConfig.border}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <CategoryIcon className={`w-4 h-4 ${svc.status === 'unused' ? 'text-gray-400' : statusConfig.text}`} />
                        <span className="flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${statusConfig.dot} ${svc.status === 'ok' ? 'shadow-[0_0_6px_currentColor]' : ''}`} />
                          <span className={`text-[10px] font-bold ${statusConfig.text}`}>{statusConfig.label}</span>
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 leading-tight mb-1">{svc.name}</p>
                      <p className="text-[11px] text-gray-400 leading-tight truncate" title={svc.message}>{svc.message}</p>
                      {svc.latency_ms !== undefined && (
                        <span className="absolute bottom-2.5 right-3 text-[10px] font-mono text-gray-400">{svc.latency_ms}ms</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-bold text-gray-900 dark:text-white">Requests (14 días)</span>
              </div>
              <span className="text-xs text-gray-400 bg-gray-100 dark:bg-white/5 px-2 py-1 rounded-lg">
                <Clock className="w-3 h-3 inline mr-1" />Tiempo real
              </span>
            </div>
            {!hasData && !loading ? (
              <div className="h-48 flex items-center justify-center text-sm text-gray-400">Sin datos aún</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={areaData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradReq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0EB5C6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0EB5C6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8B8AA0' }} axisLine={false} tickLine={false} tickFormatter={v => (v as string).slice(5)} />
                  <YAxis tick={{ fontSize: 11, fill: '#8B8AA0' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#F0EFF8' }} labelStyle={{ color: '#8B8AA0', marginBottom: 4 }} />
                  <Area type="monotone" dataKey="requests" name="Requests" stroke="#0EB5C6" strokeWidth={2} fill="url(#gradReq)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-teal-500" />
              <span className="text-sm font-bold text-gray-900 dark:text-white">Por endpoint</span>
            </div>
            {!hasData && !loading ? (
              <div className="h-48 flex items-center justify-center text-sm text-gray-400">Sin datos aún</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="45%" innerRadius={42} outerRadius={66} paddingAngle={3} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#F0EFF8' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', color: '#8B8AA0' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="md:col-span-3 bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-bold text-gray-900 dark:text-white">Tokens consumidos (14 días)</span>
            </div>
            {!hasData && !loading ? (
              <div className="h-36 flex items-center justify-center text-sm text-gray-400">Sin datos aún</div>
            ) : (
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={areaData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8B8AA0' }} axisLine={false} tickLine={false} tickFormatter={v => (v as string).slice(5)} />
                  <YAxis tick={{ fontSize: 11, fill: '#8B8AA0' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#F0EFF8' }} labelStyle={{ color: '#8B8AA0' }} />
                  <Bar dataKey="tokens" name="Tokens" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

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

        {/* RAG Audit Dashboard */}
        {auditSummaries.length > 0 && (() => {
          const summary = auditSummaries[0];
          const precisionPct = Math.round((summary.avg_precision ?? 0) * 100);
          const hitRate = summary.hit_rate_pct ?? 0;
          const categoryColors: Record<string, string> = {
            legal: '#0EB5C6', gtm: '#2DD4BF', methodology: '#F59E0B', market: '#34D399', edge: '#94A3B8',
          };
          const catMap: Record<string, { pass: number; fail: number; total: number }> = {};
          auditLogs.forEach(l => {
            if (!catMap[l.category]) catMap[l.category] = { pass: 0, fail: 0, total: 0 };
            catMap[l.category].total++;
            if (l.precision_score >= 0.6) catMap[l.category].pass++;
            else catMap[l.category].fail++;
          });
          const catBarData = Object.entries(catMap).map(([cat, v]) => ({
            cat: cat.charAt(0).toUpperCase() + cat.slice(1),
            pass: v.pass,
            fail: v.fail,
            fill: categoryColors[cat] ?? '#0EB5C6',
          }));
          const latencyData = auditLogs.map((l, i) => ({ i: i + 1, ms: Math.round(l.latency_ms), cat: l.category }));

          return (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="w-5 h-5 text-violet-500" />
                <h2 className="text-base font-bold text-gray-900 dark:text-white">RAG Audit Dashboard</h2>
                <span className="ml-2 text-xs bg-violet-500/10 text-violet-400 px-2 py-0.5 rounded-full font-mono">
                  run: {summary.run_id.slice(0, 8)}…
                </span>
                <span className="text-xs text-gray-400">{new Date(summary.started_at).toLocaleString()}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
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

              <div className="grid sm:grid-cols-2 gap-4 mb-5">
                <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-4 shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">Pass / Fail por categoría</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={catBarData} barSize={18}>
                      <XAxis dataKey="cat" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip contentStyle={{ background: '#12121A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="pass" name="Pass" stackId="a" fill="#34D399" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="fail" name="Fail" stackId="a" fill="#F87171" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-4 shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">Latencia por query (ms)</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={latencyData}>
                      <defs>
                        <linearGradient id="auditGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0EB5C6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#0EB5C6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="i" tick={{ fill: '#9CA3AF', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip contentStyle={{ background: '#12121A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }} formatter={(v) => [`${v}ms`, 'Latencia']} />
                      <Area type="monotone" dataKey="ms" stroke="#0EB5C6" strokeWidth={2} fill="url(#auditGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
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
                          <td className="px-4 py-2.5">
                            {l.error ? '❌' : l.precision_score >= 0.6 ? '✅' : '⚠️'}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: `${categoryColors[l.category]}20`, color: categoryColors[l.category] }}>
                              {l.category}
                            </span>
                          </td>
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

        {/* Knowledge Graph */}
        <KnowledgeGraph />

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
    </div>
  );
}
