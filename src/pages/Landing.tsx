import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Terminal,
  Cpu,
  Database,
  Shield,
  ArrowRight,
  CheckCircle2,
  Code2,
  Layers,
  Lock,
  FileText,
  Copy,
  Check,
  Activity,
  Sparkles,
  Server,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  BookOpen,
} from 'lucide-react';

// ── Icons inline originales (Estilo Animus / Scouttech) ──────────────────────
const IconLogo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="3" fill="white" />
    <circle cx="4" cy="6" r="2" fill="rgba(255,255,255,0.7)" />
    <circle cx="20" cy="6" r="2" fill="rgba(255,255,255,0.7)" />
    <circle cx="4" cy="18" r="2" fill="rgba(255,255,255,0.7)" />
    <circle cx="20" cy="18" r="2" fill="rgba(255,255,255,0.7)" />
    <line x1="6" y1="7" x2="10" y2="11" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
    <line x1="18" y1="7" x2="14" y2="11" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
    <line x1="6" y1="17" x2="10" y2="13" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
    <line x1="18" y1="17" x2="14" y2="13" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
  </svg>
);

// ── Types for Interactive Console ──────────────────────────────────────────
type ConsoleTabId = 'b2g' | 'macro' | 'rag' | 'moe';

interface ConsoleTab {
  id: ConsoleTabId;
  label: string;
  badge: string;
  color: string;
  method: 'GET' | 'POST';
  path: string;
  description: string;
  curlCommand: string;
  tsCode: string;
  responseJson: string;
  sourceStatus: {
    type: 'live' | 'cache' | 'resilience';
    label: string;
    source: string;
    sha256: string;
    latencyMs: number;
    credits: number;
  };
}

const CONSOLE_TABS: ConsoleTab[] = [
  {
    id: 'b2g',
    label: '1. Mercado Público (B2G)',
    badge: 'B2G',
    color: '#D97706', // amber-600
    method: 'GET',
    path: '/api/v1/mercado-publico/licitaciones?estado=publicada',
    description: 'Búsqueda unificada de licitaciones públicas (LE/LP), Compras Ágiles y órdenes de compra de ChileCompra.',
    curlCommand: `curl -X GET "https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/api-v1/mercado-publico/licitaciones?estado=publicada" \\
  -H "Authorization: Bearer demo_public_key" \\
  -H "Content-Type: application/json"`,
    tsCode: `import { animusFetch } from '@scouttech/animus-sdk';

const tenders = await animusFetch('/mercado-publico/licitaciones', {
  params: { estado: 'publicada', limit: 5 },
  apiKey: process.env.ANIMUS_API_KEY,
});
console.log(tenders.data);`,
    responseJson: `{
  "data": [
    {
      "id": "lic_9921",
      "external_code": "1234-56-LE26",
      "title": "Servicio de Mantenimiento e Infraestructura Cloud TI",
      "status_code": "publicada",
      "buyer_name": "Ministerio de Educación (MINEDUC)",
      "amount_clp_est": 185000000,
      "closing_date": "2026-08-15T16:00:00Z"
    }
  ],
  "meta": { "page": 1, "page_size": 20, "total": 142 }
}`,
    sourceStatus: {
      type: 'live',
      label: '🟢 Live ChileCompra',
      source: 'Mercado Público API v1',
      sha256: 'sha256: 8f9e2d7c4a1b0e3f...',
      latencyMs: 98,
      credits: 2,
    },
  },
  {
    id: 'macro',
    label: '2. Datos Económicos & Macro',
    badge: 'MACRO',
    color: '#0D9488', // teal-600
    method: 'GET',
    path: '/api/v1/data/economy',
    description: 'Snapshot macroeconómico chileno en tiempo real (UF, UTM, TPM, IPC, Dólar, Cobre) normalizado.',
    curlCommand: `curl -X GET "https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/api-v1/data/economy" \\
  -H "Authorization: Bearer demo_public_key"`,
    tsCode: `import { animusFetch } from '@scouttech/animus-sdk';

const macroSnapshot = await animusFetch('/data/economy');
console.log('UF Actual:', macroSnapshot.data.uf_clp);
console.log('TPM BCCh:', macroSnapshot.data.tpm_pct);`,
    responseJson: `{
  "data": {
    "uf_clp": 38450.22,
    "utm_clp": 67810.00,
    "tpm_pct": 5.25,
    "usd_clp": 948.50,
    "copper_usd_lb": 4.28,
    "updated_at": "2026-07-30T12:00:00Z"
  }
}`,
    sourceStatus: {
      type: 'cache',
      label: '🟡 Caché Cron (30m)',
      source: 'BCCh / SII / FRED',
      sha256: 'sha256: 3c4a1f8e9b0d2a1e...',
      latencyMs: 42,
      credits: 1,
    },
  },
  {
    id: 'rag',
    label: '3. RAG & Vaults Vectoriales',
    badge: 'RAG',
    color: '#0284C7', // sky-600
    method: 'POST',
    path: '/api/v1/rag/query',
    description: 'Búsqueda híbrida (HNSW vectorial + coincidencia léxica con reranking) y ubicación exacta por página.',
    curlCommand: `curl -X POST "https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/api-v1/rag/query" \\
  -H "Authorization: Bearer val_live_88a1b2c3d..." \\
  -H "Content-Type: application/json" \\
  -d '{"query":"¿Qué exige la Ley 21.719 de datos personales en Chile?","search":{"mode":"hybrid"}}'`,
    tsCode: `import { animusFetch } from '@scouttech/animus-sdk';

const result = await animusFetch('/rag/query', {
  method: 'POST',
  body: {
    query: '¿Qué exige la Ley 21.719 de datos personales en Chile?',
    search: { mode: 'hybrid', top_k: 5, rerank: true },
  },
});`,
    responseJson: `{
  "data": {
    "query_id": "qry_01K8...",
    "results": [
      {
        "rank": 1,
        "chunk_id": "chk_ley_21719_art4",
        "document_title": "Ley 21.719 Protección Datos.pdf",
        "location": { "page": 12, "section": "Título II - Deberes" },
        "content_snippet": "El responsable de datos deberá implementar medidas de seguridad...",
        "scores": { "vector": 0.88, "lexical": 0.79, "reranker": 0.94, "final": 0.91 }
      }
    ]
  }
}`,
    sourceStatus: {
      type: 'live',
      label: '🟢 Live pgvector',
      source: 'Vault Corporativo Privado',
      sha256: 'sha256: 7d1a9e8c4b2f0c5a...',
      latencyMs: 135,
      credits: 3,
    },
  },
  // S-Pulse (grafo societario) salió de la consola: quedó en stand-by y ya no
  // expone API. La pestaña mostraba "🟢 Live S-Pulse Graph" sobre un endpoint
  // que responde 503 — una demo en vivo que fallaba en la landing pública.
  {
    id: 'moe',
    label: '5. MoE GraphRAG (5 Expertos)',
    badge: 'INTEL',
    color: '#E11D48', // rose-600
    method: 'POST',
    path: '/api/v1/intel/query',
    description: 'Enrutamiento automático entre 5 expertos (Macro, Markets, Unit Econ, Legal, Estrategia B2G) con evidencia.',
    curlCommand: `curl -X POST "https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/api-v1/intel/query" \\
  -H "Authorization: Bearer val_live_88a1b2c3d..." \\
  -H "Content-Type: application/json" \\
  -d '{"query":"¿Cómo afecta la tasa de la Fed a startups fintech chilenas?","routing":"auto"}'`,
    tsCode: `import { animusFetch } from '@scouttech/animus-sdk';

const analysis = await animusFetch('/intel/query', {
  method: 'POST',
  body: {
    query: '¿Cómo afecta la tasa de la Fed a startups fintech chilenas?',
    routing: 'auto',
  },
});`,
    responseJson: `{
  "data": {
    "answer_id": "ans_01K9X...",
    "executive_summary": "La política monetaria de la Fed impacta directamente al costo de fondeo y liquidez de fintechs chilenas...",
    "experts_consulted": ["macro", "unit_economics", "legal"],
    "citations": [
      { "id": "cit_bcch_tpm", "source": "Banco Central de Chile", "verified": true }
    ]
  }
}`,
    sourceStatus: {
      type: 'live',
      label: '🟢 Live MoE GraphRAG',
      source: 'Gating Network 5 Expertos',
      sha256: 'sha256: 9a8b7c6d5e4f3a2b...',
      latencyMs: 142,
      credits: 10,
    },
  },
];

// ── Modules Data (6 Módulos con estado) ────────────────────────────────────
interface CoreModule {
  number: string;
  title: string;
  color: string;
  badge: 'ESTABLE' | 'BETA' | 'ROADMAP';
  benefit: string;
  endpoints: string[];
}

const CORE_MODULES: CoreModule[] = [
  {
    number: '01',
    title: 'Mercado Público (B2G)',
    color: '#D97706',
    badge: 'ESTABLE',
    benefit: 'Consulta unificada de licitaciones públicas (LE/LP), Compras Ágiles (< 300 UTM), órdenes de compra y perfiles de compradores públicos chilenos en tiempo real con fallback resiliente.',
    endpoints: [
      'GET /mercado-publico/licitaciones',
      'GET /mercado-publico/compra-agil',
      'GET /mercado-publico/proveedores/:rut',
    ],
  },
  {
    number: '02',
    title: 'Datos Económicos & Macro',
    color: '#0D9488',
    badge: 'ESTABLE',
    benefit: 'Series normalizadas de Chile (UF, UTM, TPM, IPC, Dólar, Euro, Cobre), datos federales de Estados Unidos (FRED), indicadores de empleo INE y Boletín Concursal judicial.',
    endpoints: [
      'GET /data/economy',
      'GET /data/macro',
      'GET /data/companies/insolvencies',
    ],
  },
  {
    number: '03',
    title: 'Animus Intelligence (MoE)',
    color: '#E11D48',
    badge: 'ESTABLE',
    benefit: 'Enrutamiento automático entre 5 Expertos (Macro, Mercados, Unit Economics, Legal, Estrategia B2G) y evaluaciones deterministas de Fit y Riesgo con evidencia citable.',
    endpoints: [
      'POST /intel/query',
      'POST /intel/assessments/tender-fit',
      'POST /intel/assessments/company-risk',
    ],
  },
  {
    number: '04',
    title: 'RAG & Vaults Vectoriales',
    color: '#0284C7',
    badge: 'ESTABLE',
    benefit: 'Ingesta de archivos PDF, DOCX o TXT con chunking semántico, almacenamiento en pgvector y búsqueda híbrida (HNSW + léxica) con rerank y ubicación por página.',
    endpoints: [
      'POST /rag/query',
      'POST /rag/vaults',
      'POST /rag/documents/file',
    ],
  },
  // S-Pulse era la 05 y se anunciaba como ESTABLE con tres endpoints que hoy
  // responden 503. Fuera hasta que vuelva a exponer API.
  {
    number: '05',
    title: 'Webhooks, Reportes y MCP',
    color: '#059669',
    badge: 'BETA',
    benefit: 'Suscripción a alertas en tiempo real (Radar Forense, nuevas licitaciones), colas asíncronas para informes PDF/Markdown y protocolo MCP nativo para Claude y Cursor.',
    endpoints: [
      'POST /webhooks',
      'POST /intel/reports',
      'POST /mcp/v1/tools/call',
    ],
  },
];

// ── Security Center Items ──────────────────────────────────────────────────
const SECURITY_ITEMS = [
  {
    title: 'Aislamiento por Tenant & Workspace',
    description: 'Políticas de Row-Level Security (RLS) en Supabase Postgres. Cada documento o consulta queda confinado estrictamente a la sesión autenticada.',
    icon: <Lock className="w-5 h-5 text-rose-600" />,
  },
  {
    title: 'Gestión y Hash SHA-256 de API Keys',
    description: 'El token crudo jamás se persiste ni aparece en logs. Almacenamos únicamente el hash criptográfico para autorizar peticiones de forma segura.',
    icon: <Shield className="w-5 h-5 text-rose-600" />,
  },
  {
    title: 'Cero Entrenamiento con Datos Privados',
    description: 'Tus documentos indexados en Vaults privados nunca son utilizados para entrenar modelos fundacionales ni compartidos entre organizaciones.',
    icon: <Database className="w-5 h-5 text-rose-600" />,
  },
  {
    title: 'Trazabilidad y Verificación SHA-256',
    description: 'Cada cifra o afirmación legal devuelta incluye un hash de integridad sha256 verificable con su documento o decreto fuente oficial.',
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
  },
  {
    title: 'Transparencia en Fallbacks B2G',
    description: 'Si el portal del Estado está en mantenimiento, el sistema reporta explícitamente el estado con un badge ámbar para no confundir caché con dato en vivo.',
    icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
  },
  {
    title: 'DPA & Normativa Chilena',
    description: 'Cumplimiento continuo con la Ley de Protección de Datos Personales 21.719 y la normativa de seguridad de la Ley Fintec 21.521 (CMF).',
    icon: <FileText className="w-5 h-5 text-rose-600" />,
  },
];

// ── FAQ Items ──────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: '¿Qué diferencia a Animus Engine de Validus o Bralidus?',
    a: 'Animus Engine es el producto comercial y la API orientada a desarrolladores (CTOs, AI engineers y equipos tech). Bralidus es nuestra infraestructura técnica de ingesta, scraping y normalización RaaS ("Powered by Bralidus"). Validus es la plataforma vertical orientada a founders y analistas que validan emprendimientos de forma guiada.',
  },
  {
    q: '¿Qué sucede cuando el portal oficial de Mercado Público está en mantenimiento?',
    a: 'Para evitar que tu aplicación o copiloto falle durante ventanas de mantenimiento de ChileCompra, Animus activa automáticamente la capa de "Resiliencia B2G", respondiendo con datos en caché verificado o etiquetando explícitamente la respuesta con un código de fallback para total honestidad técnica.',
  },
  {
    q: '¿Cómo funciona la autenticación y qué es demo_public_key?',
    a: 'En producción se utiliza un token Bearer privado (ej: val_live_...). Para evaluar en nuestro Playground o pruebas de desarrollo rápido, puedes usar demo_public_key, la cual opera con rate-limits acotados (30 req/min) y cuotas del plan Free sin requerir registro de tarjeta de crédito.',
  },
  {
    q: '¿Cómo integro Animus con agentes como Claude Desktop o Cursor IDE?',
    a: 'Animus Engine expone un servidor nativo compatible con el Model Context Protocol (MCP). Puedes añadir el servidor a tu archivo de configuración de Claude o Cursor y consultar licitaciones o datos macro directamente en lenguaje natural.',
  },
  {
    q: '¿Cuáles son los límites del Plan Free / Evaluación?',
    a: 'El Plan Free incluye 500 créditos mensuales y una ráfaga máxima de 30 peticiones por minuto. Es completamente gratuito para siempre y te da acceso a todos los endpoints en modo lectura y consultas RAG de evaluación.',
  },
];

export function Landing() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ConsoleTabId>('b2g');
  const [codeMode, setCodeMode] = useState<'curl' | 'ts'>('ts');
  const [copied, setCopied] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const currentTab = CONSOLE_TABS.find((t) => t.id === activeTab) || CONSOLE_TABS[0];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-rose-600 selection:text-white overflow-x-hidden relative">
      {/* Decorative background gradients originales del estilo Scouttech */}
      <div className="absolute top-0 inset-x-0 h-[600px] bg-gradient-to-b from-rose-50/70 to-transparent pointer-events-none" />
      <div className="absolute top-[18%] right-[-8%] w-[28vw] h-[28vw] rounded-full bg-rose-100/50 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[-10%] w-[35vw] h-[35vw] rounded-full bg-amber-100/40 blur-[100px] pointer-events-none" />

      {/* ── Navbar Developer-First (Estilo Animus original) ───────────── */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-600 shadow-md shadow-rose-600/20">
            <IconLogo />
          </div>
          <div>
            <div className="font-heading font-extrabold text-base text-slate-900 tracking-tight flex items-center gap-2">
              Animus Engine
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                v2.0
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              by Scouttech · <span className="text-rose-600 font-semibold">Powered by Bralidus</span>
            </div>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-650">
          <a href="#modulos" className="hover:text-rose-600 transition-colors">
            Módulos
          </a>
          <a href="#consola" className="hover:text-rose-600 transition-colors">
            Consola
          </a>
          <a href="#dx" className="hover:text-rose-600 transition-colors">
            SDK & MCP
          </a>
          <a href="#seguridad" className="hover:text-rose-600 transition-colors">
            Seguridad
          </a>
          <a href="#precios" className="hover:text-rose-600 transition-colors">
            Precios
          </a>
          <a href="#ecosistema" className="hover:text-rose-600 transition-colors">
            Ecosistema
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 shadow-sm transition-all"
          >
            <BookOpen className="w-3.5 h-3.5 text-rose-600" />
            Docs & Portal
          </button>
          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-600/20 transition-all"
          >
            Probar API Gratis
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ── 1. Hero & Interactive Console ─────────────────────────────── */}
      <section className="relative pt-16 pb-24 px-6 overflow-hidden">
        <div className="max-w-6xl mx-auto text-center space-y-8">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-rose-200 text-xs font-mono font-semibold text-rose-700 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-rose-600" />
            <span>ANIMUS ENGINE · BY SCOUTTECH · POWERED BY BRALIDUS</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 max-w-4xl mx-auto leading-[1.1]">
            La capa de inteligencia para construir software con{' '}
            <span className="text-rose-600">datos de Chile</span>.
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Conecta una sola API a Mercado Público, indicadores económicos, RAG documental en pgvector y análisis con citas verificables.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl font-bold text-sm text-white bg-rose-600 hover:bg-rose-500 shadow-xl shadow-rose-600/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Probar API Gratis
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-4 rounded-2xl font-bold text-sm text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 shadow-sm transition-all"
            >
              <Terminal className="w-4 h-4 text-rose-600" />
              Explorar Documentación
            </button>
          </div>

          {/* Microcopy trust */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 font-mono pt-2">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 500 créditos de evaluación
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Sin tarjeta de crédito
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> SDK TypeScript
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Compatible con MCP (Claude/Cursor)
            </span>
          </div>

          {/* ── Interactive Console Component (High Contrast on Light Card) ── */}
          <div id="consola" className="mt-12 text-left rounded-3xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            {/* Top Bar / Tabs */}
            <div className="flex flex-wrap items-center justify-between border-b border-slate-200 bg-slate-100/70 px-4 py-3 gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {CONSOLE_TABS.map((tab) => {
                  const isActive = tab.id === activeTab;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200 font-bold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: tab.color }}
                      />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Toggle cURL / TypeScript */}
              <div className="flex items-center bg-white rounded-lg p-1 border border-slate-300 shadow-sm">
                <button
                  onClick={() => setCodeMode('ts')}
                  className={`px-3 py-1 rounded-md text-xs font-mono font-medium transition-all ${
                    codeMode === 'ts'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200 font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  TypeScript SDK
                </button>
                <button
                  onClick={() => setCodeMode('curl')}
                  className={`px-3 py-1 rounded-md text-xs font-mono font-medium transition-all ${
                    codeMode === 'curl'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200 font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  cURL
                </button>
              </div>
            </div>

            {/* Subheader: path & description */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-slate-50 gap-2">
              <div className="flex items-center gap-2.5 font-mono text-xs">
                <span
                  className="px-2 py-0.5 rounded font-bold text-[11px]"
                  style={{
                    backgroundColor: `${currentTab.color}15`,
                    color: currentTab.color,
                    border: `1px solid ${currentTab.color}40`,
                  }}
                >
                  {currentTab.method}
                </span>
                <span className="text-slate-900 font-semibold">{currentTab.path}</span>
              </div>
              <p className="text-xs text-slate-600">{currentTab.description}</p>
            </div>

            {/* Code & Response Grid (Dark code areas inside clean white card) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
              {/* Left: Request */}
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 font-mono">
                    <Terminal className="w-3.5 h-3.5 text-rose-600" />
                    {codeMode === 'ts' ? 'REQUEST (TYPESCRIPT SDK)' : 'REQUEST (CURL)'}
                  </span>
                  <button
                    onClick={() =>
                      handleCopy(
                        codeMode === 'ts'
                          ? currentTab.tsCode
                          : currentTab.curlCommand
                      )
                    }
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-mono text-slate-700 border border-slate-300 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" /> Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copiar
                      </>
                    )}
                  </button>
                </div>
                <pre className="text-xs font-mono text-slate-200 bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto leading-relaxed shadow-inner">
                  <code>
                    {codeMode === 'ts'
                      ? currentTab.tsCode
                      : currentTab.curlCommand}
                  </code>
                </pre>
              </div>

              {/* Right: Response */}
              <div className="p-6 space-y-4 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 font-mono">
                    <Activity className="w-3.5 h-3.5 text-emerald-600" />
                    RESPUESTA JSON (200 OK)
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                    {currentTab.sourceStatus.label}
                  </span>
                </div>
                <pre className="text-xs font-mono text-emerald-300 bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto leading-relaxed shadow-inner">
                  <code>{currentTab.responseJson}</code>
                </pre>
              </div>
            </div>

            {/* Bottom Proof Bar of Console */}
            <div className="flex flex-wrap items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3 text-xs font-mono text-slate-600 gap-4">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Hash de integridad:</span>
                <span className="text-emerald-700 font-bold">
                  {currentTab.sourceStatus.sha256}
                </span>
              </div>
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-slate-500">Latencia: </span>
                  <span className="text-slate-900 font-bold">
                    {currentTab.sourceStatus.latencyMs} ms
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Consumo: </span>
                  <span className="text-rose-600 font-bold">
                    {currentTab.sourceStatus.credits} créditos
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Fuente: </span>
                  <span className="text-slate-900 font-bold">
                    {currentTab.sourceStatus.source}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Verified Metrics Bar (Estilo Scouttech original) ─────────── */}
      <section className="border-y border-slate-200 bg-white py-10 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900">
              0% Alucinaciones
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Citas verificadas con SHA-256
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-rose-600">
              &lt; 140 ms
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Latencia media de respuesta API
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900">
              5 Expertos MoE
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Enrutamiento especializado GraphRAG
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-600">
              100% Aislado
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Row-Level Security por Tenant
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Problem & Solution (Conectar · Comprender · Verificar) ─── */}
      <section className="py-24 px-6 max-w-6xl mx-auto space-y-16">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
            El fin de la fragmentación de datos públicos en Chile
          </h2>
          <p className="text-slate-600 text-sm sm:text-base">
            Integrar información chilena solía requerir seis scrapers frágiles, parsers de PDF rotos y servidores caídos. Animus transforma ese caos en una sola infraestructura API-First y LLM-First.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="p-8 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4 hover:shadow-md hover:border-rose-300 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">1. Conectar</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Una sola API estandarizada para consultar licitaciones, compras ágiles, indicadores macroeconómicos y datos del Diario Oficial sin lidiar con scrapers ni portales estatales caídos.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-8 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4 hover:shadow-md hover:border-rose-300 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">2. Comprender</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Enrutamiento inteligente entre 5 expertos de dominio (MoE), búsqueda semántica vectorial en pgvector y mallas societarias chilenas 360° para copilotos y sistemas de análisis.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-8 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4 hover:shadow-md hover:border-rose-300 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">3. Verificar</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Cada cifra o conclusión normativa devuelta cuenta con una cita criptográfica SHA-256 e hipervínculo auditable a la fuente oficial original. Cero alucinaciones.
            </p>
          </div>
        </div>
      </section>

      {/* ── 4. Core Modules (6 módulos con su estado y paleta clara) ──── */}
      <section id="modulos" className="py-24 px-6 bg-slate-100/60 border-t border-slate-200">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-rose-600">
                ARQUITECTURA DE DOMINIOS
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-2">
                Los 6 Módulos Cardinales de Animus
              </h2>
            </div>
            <p className="text-sm text-slate-600 max-w-md">
              En lugar de 65 endpoints dispersos, organizamos nuestra capacidad en seis módulos claros con estado verificado de disponibilidad.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CORE_MODULES.map((mod) => (
              <div
                key={mod.number}
                className="p-7 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 hover:shadow-md transition-all space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span
                      className="text-xs font-mono font-bold px-2.5 py-1 rounded-md"
                      style={{
                        backgroundColor: `${mod.color}15`,
                        color: mod.color,
                        border: `1px solid ${mod.color}40`,
                      }}
                    >
                      {mod.badge}
                    </span>
                    <span className="font-mono text-sm text-slate-400 font-bold">
                      {mod.number}
                    </span>
                  </div>

                  <h3 className="text-xl font-extrabold text-slate-900">
                    {mod.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {mod.benefit}
                  </p>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div className="text-[11px] font-mono text-slate-500 font-semibold">
                    ENDPOINTS CANÓNICOS:
                  </div>
                  <div className="space-y-1 font-mono text-xs text-slate-700">
                    {mod.endpoints.map((ep) => (
                      <div
                        key={ep}
                        className="p-1.5 rounded bg-slate-50 border border-slate-200"
                      >
                        {ep}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Developer Experience (SDK & MCP) ───────────────────────── */}
      <section id="dx" className="py-24 px-6 max-w-6xl mx-auto space-y-16">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
            Developer Experience: SDK TypeScript & MCP Nativo
          </h2>
          <p className="text-slate-600 text-sm sm:text-base">
            Diseñado por desarrolladores para desarrolladores. Integra inteligencia y datos chilenos en tu app con promesas tipadas o empodera a tus asistentes IA.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* SDK TypeScript */}
          <div className="p-8 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">
                    SDK TypeScript / JavaScript
                  </h3>
                  <p className="text-xs text-slate-500">
                    Autocompletado de tipos, reintentos automáticos y caché
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono text-rose-700 bg-rose-50 px-2 py-1 rounded border border-rose-200 font-bold">
                npm i @scouttech/animus-sdk
              </span>
            </div>

            <pre className="text-xs font-mono text-slate-200 bg-slate-950 p-5 rounded-2xl border border-slate-800 overflow-x-auto shadow-inner">
              <code>{`import { createAnimusClient } from '@scouttech/animus-sdk';

const animus = createAnimusClient({
  apiKey: process.env.ANIMUS_API_KEY,
});

// Consulta tipada con autocompletado e inferencia
const fit = await animus.intel.assessTenderFit({
  companyRut: '76.123.456-K',
  tenderCode: '1234-56-LE26',
});

console.log('Fit Score:', fit.score); // 88 / 100`}</code>
            </pre>
          </div>

          {/* Model Context Protocol (MCP) */}
          <div className="p-8 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">
                    Servidor MCP (Model Context Protocol)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Conecta Animus con Claude Desktop o Cursor IDE sin código
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono text-rose-700 bg-rose-50 px-2 py-1 rounded border border-rose-200 font-bold">
                /mcp/v1/tools/call
              </span>
            </div>

            <pre className="text-xs font-mono text-slate-200 bg-slate-950 p-5 rounded-2xl border border-slate-800 overflow-x-auto shadow-inner">
              <code>{`// Configuración claude_desktop_config.json
{
  "mcpServers": {
    "animus-chile": {
      "command": "npx",
      "args": ["-y", "@scouttech/animus-mcp"],
      "env": {
        "ANIMUS_API_KEY": "val_live_88a1b2..."
      }
    }
  }
}
// Herramientas disponibles: animus_search_b2g_tenders,
// animus_intel_query, animus_get_corporate_mesh...`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* ── 6. Security Center ────────────────────────────────────────── */}
      <section id="seguridad" className="py-24 px-6 bg-slate-100/60 border-y border-slate-200">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-rose-600">
              SECURITY CENTER & COMPLIANCE
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
              Confianza técnica y seguridad sin letra chica
            </h2>
            <p className="text-slate-600 text-sm sm:text-base">
              Nunca entrenamos con tus documentos privados. Tu información está aislada y las aserciones incluyen prueba de integridad criptográfica.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SECURITY_ITEMS.map((item, idx) => (
              <div
                key={idx}
                className="p-7 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4"
              >
                <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center">
                  {item.icon}
                </div>
                <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. Pricing by Credits ─────────────────────────────────────── */}
      <section id="precios" className="py-24 px-6 max-w-6xl mx-auto space-y-16">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
            Precios por créditos simples y escalables
          </h2>
          <p className="text-slate-600 text-sm sm:text-base">
            Paga únicamente por los créditos que consumes. Sin compromisos forzosos ni barreras de entrada para desarrolladores.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Free */}
          <div className="p-7 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between space-y-8">
            <div className="space-y-4">
              <div className="text-xs font-mono font-bold text-slate-500 uppercase">
                Free / Trial
              </div>
              <div className="text-3xl font-extrabold text-slate-900">$0</div>
              <p className="text-xs text-slate-500">
                Para evaluar en playgrounds e integrar tu primer prototipo.
              </p>
              <ul className="text-xs text-slate-700 space-y-2.5 font-mono pt-2">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> 500 créditos/mes
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> Ráfaga: 30 req/min
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> Todos los endpoints en lectura
                </li>
              </ul>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-3 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-sm"
            >
              Comenzar Gratis
            </button>
          </div>

          {/* Starter */}
          <div className="p-7 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between space-y-8">
            <div className="space-y-4">
              <div className="text-xs font-mono font-bold text-rose-600 uppercase">
                Starter
              </div>
              <div className="text-3xl font-extrabold text-slate-900">
                $49
                <span className="text-xs font-normal text-slate-500">/mes</span>
              </div>
              <p className="text-xs text-slate-500">
                Para MVP y pequeñas integraciones con Mercado Público B2G.
              </p>
              <ul className="text-xs text-slate-700 space-y-2.5 font-mono pt-2">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> 5,000 créditos/mes
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> Ráfaga: 60 req/min
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> Exportación CSV/JSON
                </li>
              </ul>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-3 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-sm"
            >
              Seleccionar Starter
            </button>
          </div>

          {/* Pro */}
          <div className="p-7 rounded-3xl bg-gradient-to-b from-rose-50/80 via-white to-white border-2 border-rose-500 flex flex-col justify-between space-y-8 relative shadow-xl shadow-rose-600/10">
            <div className="absolute -top-3 right-6 px-2.5 py-0.5 rounded-full bg-rose-600 text-[10px] font-bold text-white uppercase tracking-wider">
              Recomendado
            </div>
            <div className="space-y-4">
              <div className="text-xs font-mono font-bold text-rose-700 uppercase">
                Pro
              </div>
              <div className="text-3xl font-extrabold text-slate-900">
                $199
                <span className="text-xs font-normal text-slate-500">/mes</span>
              </div>
              <p className="text-xs text-slate-600">
                Para SaaS en producción, GraphRAG MoE y webhooks en vivo.
              </p>
              <ul className="text-xs text-slate-700 space-y-2.5 font-mono pt-2">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> 25,000 créditos/mes
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> Ráfaga: 120 req/min
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> MoE 5 Expertos + Webhooks
                </li>
              </ul>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-3 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shadow-rose-600/20"
            >
              Seleccionar Pro
            </button>
          </div>

          {/* Enterprise */}
          <div className="p-7 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between space-y-8">
            <div className="space-y-4">
              <div className="text-xs font-mono font-bold text-slate-600 uppercase">
                Enterprise
              </div>
              <div className="text-3xl font-extrabold text-slate-900">Custom</div>
              <p className="text-xs text-slate-500">
                Para agencias, corporaciones e institutions del Estado.
              </p>
              <ul className="text-xs text-slate-700 space-y-2.5 font-mono pt-2">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> Créditos ilimitados
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> Ráfaga: 600+ req/min
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> Vaults dedicados & SLA
                </li>
              </ul>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-3 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-sm"
            >
              Contactar Ventas
            </button>
          </div>
        </div>
      </section>

      {/* ── 8. Scouttech Ecosystem Hierarchy ──────────────────────────── */}
      <section id="ecosistema" className="py-24 px-6 bg-slate-100/60 border-t border-slate-200">
        <div className="max-w-4xl mx-auto text-center space-y-12">
          <div className="space-y-4">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-rose-600">
              JERARQUÍA CORPORATIVA & ECOSISTEMA
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
              Diseñado con separación de responsabilidades
            </h2>
            <p className="text-sm text-slate-600 max-w-xl mx-auto">
              Cada tecnología en nuestro ecosistema tiene un propósito único para no mezclar herramientas de desarrollador con productos de usuario final.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
              <div className="text-xs font-mono text-slate-500 font-bold">
                HOLDING & MARCA
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">Scouttech</h3>
              <p className="text-xs text-slate-600">
                Empresa matriz e infraestructura en la nube para el ecosistema chileno.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-rose-50 border-2 border-rose-500 shadow-md space-y-2">
              <div className="text-xs font-mono text-rose-700 font-bold">
                API & INTELIGENCIA (TÚ ESTÁS AQUÍ)
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">
                Animus Engine v2.0
              </h3>
              <p className="text-xs text-slate-700">
                La capa API y RaaS Developer-First potenciada por el motor normalizador Bralidus.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
              <div className="text-xs font-mono text-slate-500 font-bold">
                PRODUCTOS VERTICALES
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">
                Validus & Denarius
              </h3>
              <p className="text-xs text-slate-600">
                Aplicaciones SaaS para founders y analistas que validan emprendimientos.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 9. FAQ ────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 max-w-3xl mx-auto space-y-12">
        <h2 className="text-3xl font-extrabold text-slate-900 text-center">
          Preguntas Frecuentes
        </h2>

        <div className="space-y-4">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openFaq === index;
            return (
              <div
                key={index}
                className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  className="w-full flex items-center justify-between p-6 text-left font-bold text-slate-900 hover:text-rose-600 transition-colors"
                >
                  <span className="text-sm sm:text-base">{item.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-5 h-5 text-slate-500 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-500 flex-shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-6 pb-6 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 10. Final CTA (Estilo Rose Animus original) ────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl bg-gradient-to-br from-rose-50 via-white to-rose-50/50 border border-rose-200 p-10 sm:p-14 text-center space-y-8 relative overflow-hidden shadow-lg">
            <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
              Construye software inteligente para Chile con una sola API.
            </h2>
            <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto">
              Obtén 500 créditos gratuitos, conéctate en menos de 5 minutos y comienza a integrar inteligencia verificable hoy.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-sm text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/25 transition-all"
              >
                Obtener API Key Gratis
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full sm:w-auto px-7 py-4 rounded-xl font-bold text-sm text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 transition-all shadow-sm"
              >
                Ver Documentación Técnica
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white py-12 px-6 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600 shadow-sm shadow-rose-600/20">
              <IconLogo />
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm">
                Animus Engine v2.0
              </div>
              <div>animus.scouttech.lat · Powered by Bralidus</div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-slate-600">
            <a href="#modulos" className="hover:text-rose-600 transition-colors">
              Módulos
            </a>
            <a href="#consola" className="hover:text-rose-600 transition-colors">
              Consola
            </a>
            <button
              onClick={() => navigate('/dashboard')}
              className="hover:text-rose-600 transition-colors"
            >
              Docs & Portal
            </button>
            <a
              href="https://validus.scouttech.lat"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-rose-600 transition-colors"
            >
              Validus
            </a>
          </div>

          <div>© 2026 Scouttech · Todos los derechos reservados</div>
        </div>
      </footer>
    </div>
  );
}
