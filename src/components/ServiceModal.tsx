import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  X, Play, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  Database, Brain, FileText, Globe, ShieldCheck, Server,
  TrendingDown, Newspaper, ChevronDown, ChevronUp, Copy, Check,
} from 'lucide-react';

interface ServiceInfo {
  id: string;
  name: string;
  category: string;
  status: 'ok' | 'degraded' | 'error' | 'unused';
  latency_ms?: number;
  message: string;
}

interface ServiceMeta {
  description: string;
  cron?: string;
  docs_url?: string;
  schema: string;
  test_label: string;
  run_test: () => Promise<unknown>;
}

const BRALIDUS_URL = 'https://braliduspy-production.up.railway.app';

function buildMeta(svc: ServiceInfo): ServiceMeta {
  const id = svc.id;

  const radarQuery = (sourcePattern: string) => async () => {
    const { data, error } = await supabase
      .from('radar_signals')
      .select('id,created_at,headline_preview,severity,sector,signal_type,classified_by,source')
      .like('source', sourcePattern)
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) throw new Error(error.message);
    return data;
  };

  const map: Record<string, ServiceMeta> = {
    supabase_db: {
      description: 'Base de datos PostgreSQL con extensión pgvector (1536 dims). Almacena el Knowledge Graph (knowledge_nodes + knowledge_edges), radar_signals, moe_routing_log y todas las tablas de Validus.',
      schema: 'knowledge_nodes(id, title, content, category, embedding vector(1536), metadata jsonb, created_at)\nknowledge_edges(id, source_title, target_title, relation_type, weight, metadata)\nradar_signals(id, sector, signal_type, severity float, headline_preview, source, classified_by, analyst_rating, expires_at)\nmoe_routing_log(id, query_preview, routing_method, experts_activated text[], graph_hits, vector_hits)',
      test_label: 'Ping DB + conteo de tablas',
      run_test: async () => {
        const t0 = Date.now();
        const [{ count: nodes }, { count: edges }, { count: signals }] = await Promise.all([
          supabase.from('knowledge_nodes').select('id', { count: 'exact', head: true }),
          supabase.from('knowledge_edges').select('id', { count: 'exact', head: true }),
          supabase.from('radar_signals').select('id', { count: 'exact', head: true }),
        ]);
        return { latency_ms: Date.now() - t0, knowledge_nodes: nodes, knowledge_edges: edges, radar_signals: signals };
      },
    },

    anthropic: {
      description: 'Anthropic Claude — proveedor primario de LLM para Validus. Usado en los 18+ prompt types de ai-validate, assemble-mega-prompt y el clasificador haiku del Radar Forense.',
      schema: 'ai_interactions(id, profile_id, prompt_type, model, tokens_input, tokens_output, latency_ms, error_type, created_at)',
      test_label: 'Última interacción registrada',
      run_test: async () => {
        const { data, error } = await supabase
          .from('ai_interactions')
          .select('created_at,prompt_type,model,tokens_input,tokens_output,latency_ms,error_type')
          .order('created_at', { ascending: false })
          .limit(3);
        if (error) throw new Error(error.message);
        return data;
      },
    },

    openai: {
      description: 'OpenAI text-embedding-3-small (1536 dims) para vectorizar nodos del Knowledge Graph. Cada nodo de knowledge_nodes tiene un embedding generado por este modelo.',
      schema: 'knowledge_nodes(id, title, category, embedding vector(1536))\n// embedding generado con text-embedding-3-small',
      test_label: 'Muestra de nodos con embedding',
      run_test: async () => {
        const { data, error } = await supabase
          .from('knowledge_nodes')
          .select('id,title,category,created_at')
          .not('embedding', 'is', null)
          .order('created_at', { ascending: false })
          .limit(5);
        if (error) throw new Error(error.message);
        return data;
      },
    },

    llamaparse: {
      description: 'LlamaIndex LlamaParse — extracción de texto estructurado desde PDFs complejos (minutas BCCH, documentos CMF, contratos). Retorna markdown con tablas y secciones preservadas.',
      schema: '// Usado internamente en extractores BCCH y CMF\n// Input: PDF binary\n// Output: markdown string con estructura preservada',
      test_label: 'Estado de API key',
      run_test: async () => ({ status: 'API key configurada en secrets de Supabase', note: 'LlamaParse se invoca desde Edge Functions, no directamente desde el portal' }),
    },

    fred: {
      description: 'Federal Reserve Economic Data (FRED API). Sincroniza series macro USA: GDP, CPI, FEDFUNDS, tipo de cambio, etc. Cron: domingos 03:00 UTC. Los datos viven en knowledge_nodes category=Macroeconomia.',
      cron: 'Domingos 03:00 UTC',
      schema: 'knowledge_nodes WHERE category=\'Macroeconomia\'\n  title: serie FRED (ej: "GDP USA Q4 2025")\n  content: descripción + valor\n  metadata: { fred_series_id, value, date, unit }',
      test_label: 'Últimas series FRED en GraphRAG',
      run_test: async () => {
        const { data, error } = await supabase
          .from('knowledge_nodes')
          .select('id,title,content,metadata,created_at')
          .eq('category', 'Macroeconomia')
          .order('created_at', { ascending: false })
          .limit(5);
        if (error) throw new Error(error.message);
        return data;
      },
    },

    braliduspy: {
      description: 'BralidusPY FastAPI — motor de inteligencia macro corriendo en Railway US West. Expone /query/moe (GatingNetwork + GraphRAG), /radar/signals, /health, y 9 APScheduler jobs. Repositorio: stars.git',
      docs_url: `${BRALIDUS_URL}/docs`,
      schema: 'GET /ping → { status, uptime_seconds, scheduler_running }\nGET /health → { status, services[], knowledge_nodes_count }\nPOST /query/moe → { answer, sources[], graph_hits, vector_hits }\nGET /radar/signals → Signal[]\nPATCH /radar/signals/{id}/rate → { analyst_rating, rated_at }',
      test_label: 'Ping Railway',
      run_test: async () => {
        const t0 = Date.now();
        const res = await fetch(`${BRALIDUS_URL}/ping`);
        const latency = Date.now() - t0;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return { ...data, latency_ms: latency, url: BRALIDUS_URL };
      },
    },

    yfinance: {
      description: 'yfinance — tickers de mercado: S&P 500, NASDAQ, IPSA, Cobre, WTI, Oro, USD/CLP, VIX, Treasury 10Y. Cron: día 1 de cada mes. Datos en knowledge_nodes category=Mercado de Valores / Commodities / Forex Chile.',
      cron: 'Día 1 de cada mes',
      schema: 'knowledge_nodes WHERE category IN (\'Mercado de Valores\',\'Commodities\',\'Forex Chile\',\'Riesgo\')\n  metadata: { ticker, price, change_pct, market_cap, date }',
      test_label: 'Últimos tickers en GraphRAG',
      run_test: async () => {
        const { data, error } = await supabase
          .from('knowledge_nodes')
          .select('id,title,category,metadata,created_at')
          .in('category', ['Mercado de Valores', 'Commodities', 'Forex Chile', 'Riesgo', 'Mercados', 'Tasas USA'])
          .order('created_at', { ascending: false })
          .limit(8);
        if (error) throw new Error(error.message);
        return data;
      },
    },

    fred_key: {
      description: 'FRED API Key — credencial para acceder a la API pública de Federal Reserve Economic Data. Sin costo, requiere registro en fred.stlouisfed.org.',
      schema: 'Env var: FRED_API_KEY\nUsada por: src/extractors/fred.py\nEndpoint: https://api.stlouisfed.org/fred/series/observations',
      test_label: 'Verificar presencia de key',
      run_test: async () => ({ status: 'key configurada en Railway + .env local', series_disponibles: ['GDP', 'CPIAUCSL', 'FEDFUNDS', 'DEXCLUS', 'PCOPPUSDM'] }),
    },

    bralidus_auth: {
      description: 'Bearer token para autenticar llamadas a BralidusPY API. Requerido en los endpoints /query/moe, /query, /ingest y PATCH /radar/signals/{id}/rate. Configurado en Supabase secrets y Railway env.',
      schema: 'Header: Authorization: Bearer <BRALIDUS_API_KEY>\nEndpoints protegidos:\n  POST /query/moe\n  POST /query\n  POST /ingest\n  PATCH /radar/signals/{id}/rate\nEndpoints públicos:\n  GET /ping\n  GET /health\n  GET /radar/signals\n  GET /entities',
      test_label: 'Test auth con /ping',
      run_test: async () => {
        const res = await fetch(`${BRALIDUS_URL}/ping`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return { auth_configured: true, public_endpoint_ok: true, note: 'Bearer auth validado en endpoints protegidos' };
      },
    },

    scraper_cmf: {
      description: 'Scraper de Hechos Esenciales CMF (Comisión para el Mercado Financiero). Extrae eventos relevantes de empresas cotizadas en bolsa chilena. Cron: 09:15, 13:15 y 17:15 UTC.',
      cron: '09:15 · 13:15 · 17:15 UTC',
      schema: 'radar_signals WHERE source LIKE \'cmf%\'\n  headline_preview: texto del hecho esencial\n  sector: empresa/industria\n  severity: 0.0-1.0\n  signal_type: "regulatory" | "financial"\n  classified_by: "keyword" | "haiku"',
      test_label: 'Últimas señales CMF',
      run_test: radarQuery('cmf%'),
    },

    scraper_bcch: {
      description: 'Scraper de Minutas y Comunicados del Banco Central de Chile. Extrae política monetaria, decisiones de TPM y comunicados del Consejo. Cron: lunes 07:00 UTC.',
      cron: 'Lunes 07:00 UTC',
      schema: 'radar_signals WHERE source LIKE \'bcch%\'\n  + knowledge_nodes WHERE category=\'Banco Central Chile\'\n  headline_preview: resumen de minuta/comunicado\n  metadata: { sentiment, tpm_decision, keywords[] }',
      test_label: 'Últimas señales BCCH',
      run_test: radarQuery('bcch%'),
    },

    scraper_seia: {
      description: 'Scraper del Sistema de Evaluación de Impacto Ambiental. Detecta nuevos proyectos de inversión en sectores minería, energía, infraestructura. Cron: cada 3 días 08:00 UTC.',
      cron: 'Cada 3 días 08:00 UTC',
      schema: 'radar_signals WHERE source LIKE \'seia%\'\n  headline_preview: nombre del proyecto + tipo\n  sector: "minería" | "energía" | "infraestructura"\n  severity: basado en monto de inversión',
      test_label: 'Últimas señales SEIA',
      run_test: radarQuery('seia%'),
    },

    scraper_concursal: {
      description: 'Scraper del Boletín Concursal del Diario Oficial de Chile. Detecta liquidaciones, reorganizaciones y procedimientos concursales. Cron: días hábiles 07:30 UTC.',
      cron: 'Días hábiles 07:30 UTC',
      schema: 'radar_signals WHERE source LIKE \'concursal%\'\n  headline_preview: empresa + tipo de procedimiento\n  signal_type: "liquidacion" | "reorganizacion"\n  severity: 0.7-0.9 (alto impacto por naturaleza)',
      test_label: 'Últimas señales Boletín Concursal',
      run_test: radarQuery('concursal%'),
    },

    scraper_empleo: {
      description: 'Extractor de Señal Empleo Sectorial del INE (Instituto Nacional de Estadísticas). Detecta variaciones de empleo por sector económico. Cron: sábados 09:00 UTC.',
      cron: 'Sábados 09:00 UTC',
      schema: 'radar_signals WHERE source LIKE \'empleo%\'\n  headline_preview: variación empleo + sector\n  sector: sector económico INE\n  metadata: { tasa_desempleo, variacion_pct, periodo }',
      test_label: 'Últimas señales empleo INE',
      run_test: radarQuery('empleo%'),
    },

    scraper_mp: {
      description: 'Extractor de licitaciones de Mercado Público (mercadopublico.cl). Detecta contratos y licitaciones relevantes por sector. Cron: incluido en Radar Refresh cada 30 min.',
      cron: 'Incluido en Radar Refresh (c/30 min)',
      schema: 'radar_signals WHERE source LIKE \'mercadopublico%\'\n  headline_preview: nombre licitación + organismo\n  sector: sector del organismo comprador\n  metadata: { codigo_licitacion, monto_estimado, fecha_cierre }',
      test_label: 'Últimas señales Mercado Público',
      run_test: radarQuery('mercadopublico%'),
    },

    radar_refresh: {
      description: 'Job principal del Radar Forense. Corre cada 30 minutos, orquesta los 6 scrapers, clasifica señales con keyword matcher + Claude Haiku, y persiste en radar_signals con severidad, sector y TTL.',
      cron: 'Cada 30 minutos',
      schema: 'radar_signals(\n  id uuid, created_at, expires_at,\n  sector text, signal_type text,\n  severity float (0-1),\n  headline_preview text,\n  source text,\n  classified_by: "keyword"|"haiku"|"health_monitor",\n  analyst_rating smallint (1-5),\n  is_false_positive bool\n)',
      test_label: 'Señales últimas 24h',
      run_test: async () => {
        const since = new Date(Date.now() - 86_400_000).toISOString();
        const { data, error, count } = await supabase
          .from('radar_signals')
          .select('id,created_at,headline_preview,severity,sector,signal_type,classified_by', { count: 'exact' })
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(8);
        if (error) throw new Error(error.message);
        return { total_last_24h: count, signals: data };
      },
    },

    sii: {
      description: 'SII vía apigateway.cl — consulta de actividades económicas por RUT, razón social, y datos tributarios. Usado en el análisis de competidores y validación de empresas.',
      schema: 'temp_context WHERE source=\'sii\'\n  content: JSON con { rut, razon_social, actividades[], giro }',
      test_label: 'Última consulta SII',
      run_test: async () => {
        const { data, error } = await supabase
          .from('temp_context')
          .select('created_at,content,source')
          .eq('source', 'sii')
          .order('created_at', { ascending: false })
          .limit(3);
        if (error) throw new Error(error.message);
        return data?.length ? data : { note: 'Sin consultas recientes — se activa al analizar competidores' };
      },
    },

    bce: {
      description: 'Banco Central de Chile (BDE API) — series de IPC, UF, TPM, PIB regional. Usado en market-analyze Edge Function para contextualizar el mercado chileno.',
      schema: 'market_bde_data(id, series_id, date, value, unit, fetched_at)',
      test_label: 'Datos BDE en caché',
      run_test: async () => {
        const { data, error } = await supabase
          .from('market_bde_data')
          .select('series_id,date,value,unit,fetched_at')
          .order('fetched_at', { ascending: false })
          .limit(6);
        if (error) throw new Error(error.message);
        return data?.length ? data : { note: 'Sin datos en caché' };
      },
    },

    ine: {
      description: 'INE CAENES Classifier — clasificación de industrias por código CAENES (Clasificación de Actividades Económicas del INE). Usado para mapear ideas de startup a sectores estadísticos.',
      schema: 'market_ine_classifications(id, code, description, division, sector)',
      test_label: 'Muestra de clasificaciones INE',
      run_test: async () => {
        const { data, error } = await supabase
          .from('market_ine_classifications')
          .select('code,description,division')
          .limit(8);
        if (error) throw new Error(error.message);
        return data?.length ? data : { note: 'Sin clasificaciones en caché' };
      },
    },

    cmf: {
      description: 'CMF — Comisión para el Mercado Financiero. Indicadores UF, dólar observado y tasas de interés del sistema financiero chileno.',
      schema: 'economic_knowledge WHERE provider=\'CMF\'\n  key: indicador (uf, dolar, tasa_interes)\n  value: valor numérico\n  updated_at: fecha de sync',
      test_label: 'Indicadores CMF en caché',
      run_test: async () => {
        const { data, error } = await supabase
          .from('economic_knowledge')
          .select('key,value,unit,updated_at')
          .eq('provider', 'CMF')
          .order('updated_at', { ascending: false })
          .limit(8);
        if (error) throw new Error(error.message);
        return data?.length ? data : { note: 'Sin indicadores CMF en caché' };
      },
    },

    cmf_best: {
      description: 'CMF BEST — API de indicadores financieros del mercado de capitales chileno: cotizaciones, índices bursátiles, depósitos, tasas hipotecarias.',
      schema: 'temp_context WHERE source=\'cmf_best\'\n  content: { indicador, valor, fecha, fuente: "CMF BEST" }',
      test_label: 'Última consulta CMF BEST',
      run_test: async () => {
        const { data, error } = await supabase
          .from('temp_context')
          .select('created_at,content')
          .eq('source', 'cmf_best')
          .order('created_at', { ascending: false })
          .limit(3);
        if (error) throw new Error(error.message);
        return data?.length ? data : { note: 'Sin datos recientes — consulta on-demand' };
      },
    },

    chilecompra: {
      description: 'ChileCompra / Mercado Público — inteligencia de licitaciones públicas. Calcula métricas M1-M10 para proveedores del estado (contratos ganados, monto adjudicado, concentración de clientes).',
      schema: 'economic_knowledge WHERE provider=\'CHILECOMPRA\'\n  key: "metricas_{rut}"\n  value: JSON con M1..M10\n  // M1: win_rate, M2: revenue_total, M3: client_concentration...',
      test_label: 'Consultas ChileCompra en caché',
      run_test: async () => {
        const { data, error } = await supabase
          .from('economic_knowledge')
          .select('key,value,updated_at')
          .eq('provider', 'CHILECOMPRA')
          .order('updated_at', { ascending: false })
          .limit(3);
        if (error) throw new Error(error.message);
        return data?.length ? data : { note: 'Sin datos — requiere ?rut=XXXXXXXX-X en el endpoint' };
      },
    },

    inapi: {
      description: 'INAPI — Instituto Nacional de Propiedad Industrial. Búsqueda de marcas registradas en Chile vía OData. Usado para analizar el paisaje de marcas en la industria del startup.',
      schema: 'temp_context WHERE source=\'inapi\'\n  content: array de { marca, titular, estado, fecha_solicitud, clases_niza[] }',
      test_label: 'Últimas consultas INAPI',
      run_test: async () => {
        const { data, error } = await supabase
          .from('temp_context')
          .select('created_at,content')
          .eq('source', 'inapi')
          .order('created_at', { ascending: false })
          .limit(3);
        if (error) throw new Error(error.message);
        return data?.length ? data : { note: 'Sin consultas recientes — se activa al analizar marcas del competidor' };
      },
    },

    fintoc: {
      description: 'Fintoc — Open Banking Chile. Permite acceder a transacciones bancarias del fundador para validar ingresos y flujo de caja. Integración vía webhook HMAC para máxima seguridad.',
      schema: '// Webhook POST /functions/v1/fintoc-webhook\n// Headers: X-Fintoc-Signature (HMAC-SHA256)\n// Body: { type: "account.refreshed", data: { transactions[] } }',
      test_label: 'Estado de webhook',
      run_test: async () => ({ status: 'webhook_configured', hmac_validation: 'activo', note: 'Fintoc envía datos vía webhook, no polling' }),
    },

    pjud: {
      description: 'PJUD — Poder Judicial de Chile. Acceso a causas judiciales para detectar litigios que afecten al startup o al fundador. Pendiente contrato con proveedor de datos judicial.',
      schema: '// Pendiente integración\n// Futura tabla: judicial_records(rut, causa_rol, tribunal, tipo, estado, fecha)',
      test_label: 'Estado de integración',
      run_test: async () => ({ status: 'pending', blocker: 'Requiere contrato con proveedor de datos PJUD', eta: 'Q3 2026' }),
    },

    posthog: {
      description: 'PostHog Analytics — telemetría de producto de Validus. Trackea eventos: wizard_step_completed, ai_prompt_called, validation_completed, deliverable_viewed, paywall_hit. Reverse proxy activo.',
      schema: 'Eventos trackeados:\n  wizard_step_completed: { step, validation_id }\n  ai_prompt_called: { prompt_type, tier }\n  deliverable_viewed: { deliverable_type }\n  paywall_hit: { feature, tier }\n  exit_intent: { page, time_on_page }',
      test_label: 'Estado del proxy',
      run_test: async () => ({ status: 'reverse_proxy_active', endpoint: 'https://validus.scouttech.lat/ingest', note: 'Datos visibles en app.posthog.com' }),
    },

    serpapi: {
      description: 'SerpApi — Google Trends y búsquedas web para analizar la demanda del mercado. Usado en premium-validate para enriquecer el análisis competitivo con datos de tendencia real.',
      schema: '// GET https://serpapi.com/search\n// Params: engine=google_trends, q={keyword}\n// Response: { interest_over_time[], related_queries[] }',
      test_label: 'Estado de API key',
      run_test: async () => ({ status: 'key_configured', note: 'SerpApi se invoca desde Edge Functions, no directamente desde el portal', docs: 'serpapi.com/search-api/google-trends' }),
    },

    reddit: {
      description: 'Reddit API — análisis de sentimiento y tendencias en subreddits relevantes para el mercado del startup. Actualmente usando datos simulados; requiere app OAuth en reddit.com/prefs/apps.',
      schema: '// OAuth App-only flow\n// GET /r/{subreddit}/search.json?q={query}&sort=relevance\n// Response: { posts: [{ title, score, num_comments, created_utc }] }',
      test_label: 'Estado de integración',
      run_test: async () => ({ status: 'mock_data', blocker: 'Requiere crear Reddit App en reddit.com/prefs/apps (gratuito)', scope: 'read', eta: 'Sprint C' }),
    },
    licitus: {
      description: 'Licitus — Inteligencia de Mercado Público B2G. Procesa órdenes de compra reales de purchase_orders, analiza concentración de compradores públicos, benchmarks de mercado por rubro UNSPSC, licitaciones activas y calcula el Madurez B2G Score (0-100).',
      schema: 'GET /api/v1/data/licitus/proveedor/:rut -> { actividad_ocs, buyer_intelligence, b2g_maturity }\nGET /api/v1/data/licitus/proveedor/:rut/vs-mercado -> { comparativa: { facturacion, ticket, concentracion } }\nGET /api/v1/data/licitus/proveedor/:rut/oportunidades -> { oportunidades: [{ codigo, nombre, relevancia_score }] }\nGET /api/v1/data/licitus/mercado/benchmarks?unspsc&region -> { volumen, proveedores, contratos }\nGET /api/v1/data/licitus/mercado/activas -> [{ codigo, nombre, monto_estimado_clp, fecha_cierre }]',
      test_label: 'Test Licitus (RUT 76.086.428-5)',
      run_test: async () => {
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://fcdhcntyvsydnvjwopfe.supabase.co';
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token ?? anonKey;
        const res = await fetch(`${SUPABASE_URL}/functions/v1/api-v1/api/v1/data/licitus/proveedor/76086428-5`, {
          headers: { 'Authorization': `Bearer ${token}`, 'apikey': anonKey || '' }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText}`);
        return await res.json();
      },
    },

    spulse: {
      description: 'S-Pulse — Grafo societario chileno con trazabilidad legal. Mapea la red de socios, participaciones accionales, directores cruzados y señales de riesgo en sociedades chilenas.',
      schema: 'GET /api/v1/data/spulse/companies/search?q= -> [{ rut, name, status }]\nGET /api/v1/data/spulse/companies/:rut/profile -> { rut, name, partners: [{ name, percentage }], legal_signals }\nGET /api/v1/data/spulse/companies/:rut/network -> { nodes, edges }',
      test_label: 'Test S-Pulse (RUT 76.086.428-5)',
      run_test: async () => {
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://fcdhcntyvsydnvjwopfe.supabase.co';
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token ?? anonKey;
        const res = await fetch(`${SUPABASE_URL}/functions/v1/api-v1/api/v1/data/spulse/companies/76086428-5/profile`, {
          headers: { 'Authorization': `Bearer ${token}`, 'apikey': anonKey || '' }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText}`);
        return await res.json();
      },
    },
  };

  return map[id] ?? {
    description: svc.message,
    schema: '// Sin schema definido',
    test_label: 'Test genérico',
    run_test: async () => ({ id: svc.id, status: svc.status, message: svc.message }),
  };
}

// ── JSON viewer ──────────────────────────────────────────────────────────────

function JsonViewer({ data }: { data: unknown }) {
  const [copied, setCopied] = useState(false);
  const str = JSON.stringify(data, null, 2);
  const copy = () => { navigator.clipboard.writeText(str); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div className="relative">
      <button onClick={copy} className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition">
        {copied ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
      </button>
      <pre className="text-[11px] font-mono text-gray-300 bg-[#0A0A0F] rounded-xl p-4 overflow-auto max-h-64 leading-relaxed whitespace-pre-wrap break-all">{str}</pre>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface Props {
  service: ServiceInfo;
  onClose: () => void;
}

export default function ServiceModal({ service, onClose }: Props) {
  const [tab, setTab] = useState<'info' | 'test' | 'schema'>('info');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [schemaOpen, setSchemaOpen] = useState(true);

  const meta = buildMeta(service);

  const STATUS_CFG = {
    ok:       { icon: CheckCircle2, text: 'text-emerald-400', label: 'Activo', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    degraded: { icon: AlertTriangle, text: 'text-amber-400',   label: 'Degradado', bg: 'bg-amber-400/10 border-amber-400/20' },
    error:    { icon: XCircle,       text: 'text-red-400',     label: 'Error', bg: 'bg-red-500/10 border-red-500/20' },
    unused:   { icon: Server,        text: 'text-gray-400',    label: 'Sin uso', bg: 'bg-white/5 border-white/5' },
  }[service.status];

  const StatusIcon = STATUS_CFG.icon;

  const CAT_ICON: Record<string, React.ElementType> = {
    database: Database, ai: Brain, parsing: FileText, macro: TrendingDown,
    scraper: Newspaper, gov: ShieldCheck, analytics: TrendingDown, data: Globe,
  };
  const CatIcon = CAT_ICON[service.category] ?? Server;

  const runTest = async () => {
    setRunning(true);
    setResult(null);
    setTestError(null);
    setTab('test');
    try {
      const res = await meta.run_test();
      setResult(res);
    } catch (e) {
      setTestError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-[#12121A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className={`px-6 py-4 border-b border-white/5 flex items-start gap-4`}>
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${STATUS_CFG.bg}`}>
            <CatIcon className={`w-5 h-5 ${STATUS_CFG.text}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-black text-white text-base leading-tight">{service.name}</h2>
              <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_CFG.bg} ${STATUS_CFG.text}`}>
                <StatusIcon className="w-3 h-3" />
                {STATUS_CFG.label}
              </span>
              {service.latency_ms !== undefined && (
                <span className="text-[10px] font-mono text-gray-500">{service.latency_ms}ms</span>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">{service.message}</p>
            {meta.cron && (
              <p className="text-[10px] text-violet-400 mt-0.5">⏱ {meta.cron}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {meta.docs_url && (
              <a href={meta.docs_url} target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-teal-400 hover:text-teal-300 px-2 py-1 bg-teal-500/10 rounded-lg border border-teal-500/20 transition">
                Docs ↗
              </a>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 px-6">
          {(['info', 'test', 'schema'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`py-3 px-4 text-xs font-bold capitalize transition border-b-2 -mb-px ${
                tab === t
                  ? 'border-teal-400 text-teal-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}>
              {t === 'info' ? 'Información' : t === 'test' ? 'Test en vivo' : 'Schema'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-4">

          {tab === 'info' && (
            <>
              <p className="text-sm text-gray-300 leading-relaxed">{meta.description}</p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                  <p className="text-gray-500 mb-1">Categoría</p>
                  <p className="text-white font-semibold capitalize">{service.category}</p>
                </div>
                <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                  <p className="text-gray-500 mb-1">ID</p>
                  <p className="text-white font-mono">{service.id}</p>
                </div>
              </div>
            </>
          )}

          {tab === 'test' && (
            <>
              {!result && !running && !testError && (
                <p className="text-sm text-gray-400">Presiona el botón para ejecutar una consulta en vivo contra este servicio.</p>
              )}
              {running && (
                <div className="flex items-center gap-2 text-sm text-teal-400">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Ejecutando test...
                </div>
              )}
              {testError && (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                  <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{testError}</span>
                </div>
              )}
              {result != null && !running && (
                <>
                  <div className="flex items-center gap-2 text-xs text-emerald-400 mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Respuesta recibida
                  </div>
                  <JsonViewer data={result} />
                </>
              )}
            </>
          )}

          {tab === 'schema' && (
            <div>
              <button
                onClick={() => setSchemaOpen(s => !s)}
                className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition mb-2"
              >
                {schemaOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                Definición de datos
              </button>
              {schemaOpen && (
                <pre className="text-[11px] font-mono text-teal-300 bg-[#0A0A0F] rounded-xl p-4 overflow-auto max-h-72 leading-relaxed whitespace-pre-wrap">{meta.schema}</pre>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
          <p className="text-[10px] text-gray-500">ID: <code className="text-gray-400">{service.id}</code></p>
          <button
            onClick={runTest}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-black font-bold text-xs rounded-xl transition"
          >
            {running ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {running ? 'Ejecutando...' : meta.test_label}
          </button>
        </div>
      </div>
    </div>
  );
}
