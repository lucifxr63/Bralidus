import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ── Icons inline para no depender de lucide en esta página ────────────────────
const IconArrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);
const IconZap = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);
const IconBrain = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
  </svg>
);
const IconDatabase = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>
  </svg>
);
const IconShield = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const IconTrendingUp = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
  </svg>
);
const IconCode = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
  </svg>
);
const IconGlobe = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);

// ── Types ─────────────────────────────────────────────────────────────────────

interface Expert {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  border: string;
  description: string;
  keywords: string[];
}

interface DataSource {
  name: string;
  type: string;
  typeColor: string;
  description: string;
}

// ── Data ──────────────────────────────────────────────────────────────────────

const EXPERTS: Expert[] = [
  {
    id: 'macro',
    name: 'Experto Macroeconómico',
    icon: <IconTrendingUp />,
    color: '#A78BFA',
    bg: 'rgba(139,92,246,0.08)',
    border: 'rgba(139,92,246,0.20)',
    description: 'PIB, CPI, Fed Funds Rate, M2 Money Supply, spread curva 10Y-2Y, IED Chile, producción industrial',
    keywords: ['pib', 'gdp', 'inflación', 'tasa fed', 'macro', 'recesión', 'banco central'],
  },
  {
    id: 'mercados',
    name: 'Experto en Mercados',
    icon: <IconTrendingUp />,
    color: '#34D399',
    bg: 'rgba(52,211,153,0.08)',
    border: 'rgba(52,211,153,0.20)',
    description: 'S&P 500, NASDAQ, IPSA, cobre, litio, WTI, oro, VIX, USD/CLP, ETFs LATAM, Tesoro 10Y',
    keywords: ['ipsa', 'bolsa', 'cobre', 'litio', 'vix', 'forex', 'nasdaq'],
  },
  {
    id: 'unit_economics',
    name: 'Experto Unit Economics',
    icon: <IconZap />,
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.20)',
    description: 'CAC, LTV, NRR, Gross Churn, Burn Rate, Cash Runway, Payback Period, M&A estratégico LatAm',
    keywords: ['cac', 'ltv', 'nrr', 'churn', 'burn', 'runway', 'mrr'],
  },
  {
    id: 'legal',
    name: 'Experto Legal y Regulatorio',
    icon: <IconShield />,
    color: '#F87171',
    bg: 'rgba(248,113,113,0.08)',
    border: 'rgba(248,113,113,0.20)',
    description: 'Ley Fintech 21.521 CMF, Ley Datos 21.719 GDPR Chile, Ley Ciberseguridad 21.663, SpA, INAPI',
    keywords: ['cmf', 'gdpr', 'spa', 'vesting', 'inapi', 'marcas', 'regulatorio'],
  },
  {
    id: 'estrategia',
    name: 'Experto Estrategia & GTM',
    icon: <IconGlobe />,
    color: '#0EB5C6',
    bg: 'rgba(14,181,198,0.08)',
    border: 'rgba(14,181,198,0.20)',
    description: 'Moat network effects, Blue Ocean, GTM LatAm WhatsApp-first, TRL/CRL, Corfo Semilla, sesgos fundadores',
    keywords: ['moat', 'gtm', 'corfo', 'trl', 'sesgo', 'whatsapp', 'tracción'],
  },
];

const DATA_SOURCES: DataSource[] = [
  { name: 'FRED',          type: 'Macro USA',     typeColor: '#A78BFA', description: 'GDP, CPI, Fed Funds, M2, curva 10Y-2Y' },
  { name: 'yfinance',      type: 'Mercados',      typeColor: '#34D399', description: 'IPSA, S&P 500, cobre, litio, VIX, USD/CLP' },
  { name: 'BCCH',          type: 'Macro Chile',   typeColor: '#0EB5C6', description: 'Comunicados y minutas Banco Central PDF' },
  { name: 'CMF Chile',     type: 'Regulatorio',   typeColor: '#F87171', description: 'Hechos Esenciales de empresas reguladas' },
  { name: 'SEIA',          type: 'Alternativas',  typeColor: '#F59E0B', description: 'Proyectos de inversión aprobados Chile' },
  { name: 'Diario Oficial',type: 'Alternativas',  typeColor: '#F59E0B', description: 'Boletín Concursal + publicaciones legales' },
  { name: 'ChileCompra',   type: 'B2G',           typeColor: '#60A5FA', description: 'Licitaciones y métricas de proveedores' },
  { name: 'OpenBB',        type: 'Extendido',     typeColor: '#8B5CF6', description: 'World Bank Chile, FRED extendido (opcional)' },
];

const CODE_LINES = [
  { indent: 0, text: 'POST /query/moe',       color: '#FB7185', bold: true },
  { indent: 0, text: '{',                      color: '#E2E8F0' },
  { indent: 1, text: '"query":',               color: '#FDA4AF', suffix: ' "¿Cómo afecta la Fed a una fintech seed?",', suffixColor: '#FCA5A5' },
  { indent: 1, text: '"startup_context":',     color: '#FDA4AF', suffix: ' {', suffixColor: '#E2E8F0' },
  { indent: 2, text: '"industry":',            color: '#FECDD3', suffix: ' "fintech",', suffixColor: '#FCA5A5' },
  { indent: 2, text: '"stage":',               color: '#FECDD3', suffix: ' "seed",', suffixColor: '#FCA5A5' },
  { indent: 2, text: '"geography":',           color: '#FECDD3', suffix: ' "chile"', suffixColor: '#FCA5A5' },
  { indent: 1, text: '}',                      color: '#E2E8F0' },
  { indent: 0, text: '}',                      color: '#E2E8F0' },
  { indent: 0, text: '',                       color: '#E2E8F0' },
  { indent: 0, text: '// Response',            color: '#94A3B8', bold: false },
  { indent: 0, text: '{',                      color: '#E2E8F0' },
  { indent: 1, text: '"experts_activated":',   color: '#FDA4AF', suffix: ' ["macro","unit_economics"],', suffixColor: '#FECDD3' },
  { indent: 1, text: '"graph_hits":',          color: '#FDA4AF', suffix: ' 4,', suffixColor: '#FCA5A5' },
  { indent: 1, text: '"vector_hits":',         color: '#FDA4AF', suffix: ' 2,', suffixColor: '#FCA5A5' },
  { indent: 1, text: '"context_for_llm":',     color: '#FDA4AF', suffix: ' "## Contexto Macro..."', suffixColor: '#FCA5A5' },
  { indent: 0, text: '}',                      color: '#E2E8F0' },
];

const STATS = [
  { value: '25', label: 'Industrias', sub: 'routing dinámico' },
  { value: '31', label: 'Grupos', sub: 'de entidades' },
  { value: '5',  label: 'Experts MoE', sub: 'especializados' },
  { value: '1536', label: 'Dims', sub: 'OpenAI embeddings' },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Envías el contexto',
    desc: 'POST /query/moe con startup_context: industria, etapa y geografía. Bralidus entiende tu startup.',
    icon: <IconCode />,
    color: '#F43F5E',
  },
  {
    step: '02',
    title: 'GatingNetwork activa Experts',
    desc: 'El router de 2 etapas (keyword scan + fallback semántico) selecciona los Experts relevantes y traversa el knowledge graph.',
    icon: <IconBrain />,
    color: '#E11D48',
  },
  {
    step: '03',
    title: 'Contexto listo para tu LLM',
    desc: 'Recibes Markdown estructurado con nodos GRAPH + VECTOR rankeados por relevancia, listo para inyectar en tu prompt.',
    icon: <IconZap />,
    color: '#BE123C',
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function Landing() {
  const navigate = useNavigate();
  const [typedLines, setTypedLines] = useState(0);
  const [inView, setInView] = useState(false);
  const codeRef = useRef<HTMLDivElement>(null);

  // Animate code lines when section in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold: 0.3 },
    );
    if (codeRef.current) observer.observe(codeRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setTypedLines(i);
      if (i >= CODE_LINES.length) clearInterval(timer);
    }, 80);
    return () => clearInterval(timer);
  }, [inView]);

  const getExpertStyles = (id: string) => {
    switch (id) {
      case 'macro': return { text: 'text-purple-600', border: 'border-purple-200', bg: 'bg-purple-50' };
      case 'mercados': return { text: 'text-emerald-600', border: 'border-emerald-200', bg: 'bg-emerald-50' };
      case 'unit_economics': return { text: 'text-amber-600', border: 'border-amber-200', bg: 'bg-amber-50' };
      case 'legal': return { text: 'text-rose-600', border: 'border-rose-200', bg: 'bg-rose-50' };
      default: return { text: 'text-sky-600', border: 'border-sky-200', bg: 'bg-sky-50' };
    }
  };

  const getSourceStyles = (type: string) => {
    switch (type) {
      case 'Macro USA': return { text: 'text-purple-700 font-bold bg-purple-50 border-purple-200' };
      case 'Mercados': return { text: 'text-emerald-700 font-bold bg-emerald-50 border-emerald-200' };
      case 'Macro Chile': return { text: 'text-sky-700 font-bold bg-sky-50 border-sky-200' };
      case 'Regulatorio': return { text: 'text-rose-700 font-bold bg-rose-50 border-rose-200' };
      case 'Alternativas': return { text: 'text-amber-700 font-bold bg-amber-50 border-amber-200' };
      case 'B2G': return { text: 'text-blue-700 font-bold bg-blue-50 border-blue-200' };
      default: return { text: 'text-violet-700 font-bold bg-violet-50 border-violet-200' };
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-rose-600 selection:text-white overflow-x-hidden relative">
      
      {/* Decorative background gradients */}
      <div className="absolute top-0 inset-x-0 h-[600px] bg-gradient-to-b from-rose-50/60 to-transparent pointer-events-none" />
      <div className="absolute top-[20%] right-[-10%] w-[30vw] h-[30vw] rounded-full bg-rose-50/40 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[-10%] w-[35vw] h-[35vw] rounded-full bg-amber-50/40 blur-[100px] pointer-events-none" />

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-600 shadow-md shadow-rose-600/20">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
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
          <span className="font-heading font-extrabold text-lg text-slate-900 tracking-tight">
            Bralidus
          </span>
        </div>

        {/* Nav links */}
        <div className="flex items-center gap-6">
          <a href="#how-it-works" className="text-sm font-medium text-slate-650 transition-colors hover:text-rose-600">
            Cómo funciona
          </a>
          <a href="#experts" className="text-sm font-medium text-slate-650 transition-colors hover:text-rose-600">
            Experts
          </a>
          <a href="#api" className="text-sm font-medium text-slate-655 transition-colors hover:text-rose-600">
            API Reference
          </a>
          <button
            onClick={() => navigate('/login')}
            className="ml-2 inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-500 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Acceder
          </button>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-28 px-6 text-center">
        {/* Grid background */}
        <div className="absolute inset-0 pointer-events-none opacity-20" style={{
          backgroundImage: 'linear-gradient(#f43f5e 1px, transparent 1px), linear-gradient(90deg, #f43f5e 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />

        <div className="relative max-w-4xl mx-auto space-y-6">
          {/* Tagline */}
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-100 bg-rose-50 px-3.5 py-1 text-xs font-semibold text-rose-700 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-ping" />
            <span>GraphRAG · Mixture of Experts · FRED + yfinance + BCCH</span>
          </div>

          {/* Headline */}
          <h1 className="font-heading text-4xl font-extrabold tracking-tight sm:text-6xl text-slate-900 leading-[1.1] md:leading-none">
            <span className="bg-gradient-to-r from-red-600 via-rose-500 to-rose-600 bg-clip-text text-transparent">
              Inteligencia macro.
            </span>
            <br />
            A un API call de distancia.
          </h1>

          {/* Subheadline */}
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Bralidus convierte el contexto de tu startup en <strong className="text-rose-600 font-semibold">GraphRAG dinámico</strong> — macro, mercados, regulatorio y unit economics — listo para inyectar en tu LLM.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-rose-600 px-6 py-3.5 text-base font-semibold text-white shadow-md shadow-rose-600/10 hover:bg-rose-500 hover:shadow-rose-600/20 hover:-translate-y-0.5 transition-all group"
            >
              Acceder al Dashboard
              <span className="ml-2 transition-transform group-hover:translate-x-1">
                <IconArrow />
              </span>
            </button>
            <a
              href="#api"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-base font-semibold text-slate-700 hover:bg-slate-50 transition-all hover:-translate-y-0.5"
            >
              Ver la API
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────────────────── */}
      <section className="px-6 pb-20 max-w-4xl mx-auto">
        <div className="grid gap-px bg-slate-200 rounded-2xl overflow-hidden border border-slate-200 shadow-sm md:grid-cols-4">
          {STATS.map((s, i) => (
            <div key={i} className="bg-white p-6 text-center hover:bg-slate-50/50 transition-colors">
              <div className="font-heading text-4xl font-extrabold bg-gradient-to-br from-red-600 to-rose-600 bg-clip-text text-transparent">
                {s.value}
              </div>
              <div className="text-sm font-bold text-slate-800 mt-1.5">{s.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 border-t border-slate-200 bg-white px-6 shadow-sm">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">Flujo</span>
            <h2 className="font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Cómo funciona Bralidus
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:border-rose-300 hover:shadow-md transition-all relative overflow-hidden group">
                <div className="absolute top-4 right-6 font-heading font-extrabold text-slate-100 text-5xl select-none group-hover:text-rose-500/5 transition-colors font-mono">
                  {step.step}
                </div>
                <div className="h-10 w-10 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0 mb-4">
                  {step.icon}
                </div>
                <h3 className="font-heading font-bold text-slate-900 text-lg mb-2">
                  {step.title}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Experts Grid ────────────────────────────────────────────────── */}
      <section id="experts" className="py-20 max-w-4xl mx-auto px-6">
        <div className="space-y-12">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">Mixture of Experts</span>
            <h2 className="font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              5 Experts especializados
            </h2>
            <p className="text-sm text-slate-500 max-w-xl mx-auto">
              El GatingNetwork activa los expertos más relevantes para tu query — sin configuración manual.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {EXPERTS.map(expert => {
              const styles = getExpertStyles(expert.id);
              return (
                <div key={expert.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:border-rose-300 hover:-translate-y-1 hover:shadow-md transition-all">
                  <div className="flex items-center gap-3.5 mb-4">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center border shrink-0 ${styles.bg} ${styles.border} ${styles.text}`}>
                      {expert.icon}
                    </div>
                    <h3 className="font-heading font-bold text-slate-900 text-sm">
                      {expert.name}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">{expert.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {expert.keywords.slice(0, 4).map(kw => (
                      <span key={kw} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${styles.bg} ${styles.border} ${styles.text}`}>
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Data Sources ─────────────────────────────────────────────────── */}
      <section className="py-20 border-t border-slate-200 bg-white px-6 shadow-sm">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">Fuentes de datos</span>
            <h2 className="font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Datos reales. Sin mocks.
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {DATA_SOURCES.map(src => {
              const styles = getSourceStyles(src.type);
              return (
                <div key={src.name} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-rose-300 transition-all flex flex-col justify-between space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-heading font-bold text-slate-900 text-sm">
                      {src.name}
                    </span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full border ${styles.text}`}>
                      {src.type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{src.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── API Preview ─────────────────────────────────────────────────── */}
      <section id="api" className="py-20 max-w-4xl mx-auto px-6">
        <div className="space-y-12">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">API Reference</span>
            <h2 className="font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Una llamada. Todo el contexto.
            </h2>
          </div>

          <div ref={codeRef} className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl max-w-3xl mx-auto relative">
            <div className="absolute top-0 right-0 h-20 w-20 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />
            
            {/* Terminal header */}
            <div className="bg-slate-900 px-5 py-3 border-b border-slate-800/80 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="ml-3 text-xs text-slate-400 font-mono">
                POST https://bralidus.railway.app/query/moe
              </span>
            </div>

            {/* Code body */}
            <div className="p-6 font-mono text-xs md:text-sm text-slate-300 leading-relaxed overflow-x-auto">
              {CODE_LINES.map((line, i) => (
                <div key={i} style={{
                  opacity: i < typedLines ? 1 : 0,
                  transform: i < typedLines ? 'translateX(0)' : 'translateX(-8px)',
                  transition: 'opacity 0.15s, transform 0.15s',
                  paddingLeft: line.indent * 24,
                }}>
                  {line.text && (
                    <span style={{ color: line.color, fontWeight: line.bold ? 700 : 400 }}>
                      {line.text}
                    </span>
                  )}
                  {line.suffix && (
                    <span style={{ color: line.suffixColor }}>{line.suffix}</span>
                  )}
                  {!line.text && !line.suffix && <span>&nbsp;</span>}
                </div>
              ))}
              {/* Cursor */}
              {typedLines < CODE_LINES.length && (
                <span className="inline-block w-2 h-4 bg-rose-600 animate-pulse align-middle ml-1" />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Final ───────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-gradient-to-br from-rose-50/40 to-rose-100/10 border border-rose-200 rounded-3xl p-10 text-center space-y-6 relative overflow-hidden shadow-md">
            {/* Glow */}
            <div className="h-14 w-14 rounded-full bg-rose-600 text-white flex items-center justify-center mx-auto shadow-md shadow-rose-600/20 animate-pulse">
              <IconDatabase />
            </div>
            <h2 className="font-heading text-3xl font-extrabold text-slate-900">
              Empieza ahora
            </h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              Accede con tu email institucional, genera una API Key y haz tu primer request en menos de 5 minutos.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 py-3.5 text-base font-semibold text-white shadow-md hover:bg-rose-500 hover:scale-[1.02] active:scale-[0.98] transition-all group"
            >
              Acceder con email
              <IconArrow />
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-6 border-t border-slate-800 mt-20">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600/10 border border-rose-500/30">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3" fill="#F43F5E"/>
                <circle cx="4" cy="6" r="2" fill="rgba(244,63,94,0.7)"/>
                <circle cx="20" cy="6" r="2" fill="rgba(244,63,94,0.7)"/>
                <circle cx="4" cy="18" r="2" fill="rgba(244,63,94,0.7)"/>
                <circle cx="20" cy="18" r="2" fill="rgba(244,63,94,0.7)"/>
                <line x1="6" y1="7" x2="10" y2="11" stroke="rgba(244,63,94,0.4)" strokeWidth="1.5"/>
                <line x1="18" y1="7" x2="14" y2="11" stroke="rgba(244,63,94,0.4)" strokeWidth="1.5"/>
                <line x1="6" y1="17" x2="10" y2="13" stroke="rgba(244,63,94,0.4)" strokeWidth="1.5"/>
                <line x1="18" y1="17" x2="14" y2="13" stroke="rgba(244,63,94,0.4)" strokeWidth="1.5"/>
              </svg>
            </div>
            <div>
              <div className="font-heading font-extrabold text-sm text-slate-200">Bralidus</div>
              <div className="text-[10px] text-slate-500">Powered by Validus · Scouttech</div>
            </div>
          </div>

          <div className="flex gap-6 text-slate-400">
            <a href="https://validus.scouttech.lat" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              Validus
            </a>
            <button onClick={() => navigate('/dashboard')} className="hover:text-white transition-colors bg-transparent border-none cursor-pointer">
              Dashboard
            </button>
          </div>

          <p className="text-xs text-slate-500">
            © 2026 Scouttech · Todos los derechos reservados
          </p>
        </div>
      </footer>
    </div>
  );
}
