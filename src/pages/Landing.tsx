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
  { indent: 0, text: 'POST /query/moe',       color: '#A78BFA', bold: true },
  { indent: 0, text: '{',                      color: '#E8E7F5' },
  { indent: 1, text: '"query":',               color: '#0EB5C6', suffix: ' "¿Cómo afecta la Fed a una fintech seed?",', suffixColor: '#86EFAC' },
  { indent: 1, text: '"startup_context":',     color: '#0EB5C6', suffix: ' {', suffixColor: '#E8E7F5' },
  { indent: 2, text: '"industry":',            color: '#FCA5A5', suffix: ' "fintech",', suffixColor: '#86EFAC' },
  { indent: 2, text: '"stage":',               color: '#FCA5A5', suffix: ' "seed",', suffixColor: '#86EFAC' },
  { indent: 2, text: '"geography":',           color: '#FCA5A5', suffix: ' "chile"', suffixColor: '#86EFAC' },
  { indent: 1, text: '}',                      color: '#E8E7F5' },
  { indent: 0, text: '}',                      color: '#E8E7F5' },
  { indent: 0, text: '',                       color: '#E8E7F5' },
  { indent: 0, text: '// Response',            color: '#7674A0', bold: false },
  { indent: 0, text: '{',                      color: '#E8E7F5' },
  { indent: 1, text: '"experts_activated":',   color: '#0EB5C6', suffix: ' ["macro","unit_economics"],', suffixColor: '#FCD34D' },
  { indent: 1, text: '"graph_hits":',          color: '#0EB5C6', suffix: ' 4,', suffixColor: '#86EFAC' },
  { indent: 1, text: '"vector_hits":',         color: '#0EB5C6', suffix: ' 2,', suffixColor: '#86EFAC' },
  { indent: 1, text: '"context_for_llm":',     color: '#0EB5C6', suffix: ' "## Contexto Macro..."', suffixColor: '#86EFAC' },
  { indent: 0, text: '}',                      color: '#E8E7F5' },
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
    color: '#A78BFA',
  },
  {
    step: '02',
    title: 'GatingNetwork activa Experts',
    desc: 'El router de 2 etapas (keyword scan + fallback semántico) selecciona los Experts relevantes y traversa el knowledge graph.',
    icon: <IconBrain />,
    color: '#6C3CE1',
  },
  {
    step: '03',
    title: 'Contexto listo para tu LLM',
    desc: 'Recibes Markdown estructurado con nodos GRAPH + VECTOR rankeados por relevancia, listo para inyectar en tu prompt.',
    icon: <IconZap />,
    color: '#0EB5C6',
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

  return (
    <div style={{ background: '#05050D', color: '#E8E7F5', minHeight: '100svh', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(5,5,13,0.85)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(108,60,225,0.12)',
        padding: '0 24px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #6C3CE1, #0EB5C6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(108,60,225,0.4)',
          }}>
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
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, letterSpacing: '-0.3px', color: '#E8E7F5' }}>
            Bralidus
          </span>
        </div>

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a href="#how-it-works" style={{ color: '#7674A0', fontSize: 14, fontWeight: 500, textDecoration: 'none', padding: '6px 12px', borderRadius: 8, transition: 'color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#E8E7F5')}
            onMouseLeave={e => (e.currentTarget.style.color = '#7674A0')}>
            Cómo funciona
          </a>
          <a href="#experts" style={{ color: '#7674A0', fontSize: 14, fontWeight: 500, textDecoration: 'none', padding: '6px 12px', borderRadius: 8, transition: 'color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#E8E7F5')}
            onMouseLeave={e => (e.currentTarget.style.color = '#7674A0')}>
            Experts
          </a>
          <a href="#api" style={{ color: '#7674A0', fontSize: 14, fontWeight: 500, textDecoration: 'none', padding: '6px 12px', borderRadius: 8, transition: 'color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#E8E7F5')}
            onMouseLeave={e => (e.currentTarget.style.color = '#7674A0')}>
            API
          </a>
          <button
            onClick={() => navigate('/login')}
            style={{
              marginLeft: 8,
              padding: '8px 18px',
              background: 'linear-gradient(135deg, #6C3CE1, #5B30C4)',
              color: '#fff', fontWeight: 700, fontSize: 14,
              border: '1px solid rgba(139,92,246,0.4)',
              borderRadius: 10, cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(108,60,225,0.3)',
              transition: 'opacity 0.2s, transform 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            Acceder
          </button>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: '100px 24px 80px', textAlign: 'center' }}>
        {/* Grid background */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(rgba(108,60,225,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(108,60,225,0.06) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />
        {/* Glow orb */}
        <div style={{
          position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
          width: 600, height: 400, borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(108,60,225,0.18) 0%, rgba(14,181,198,0.06) 50%, transparent 70%)',
          filter: 'blur(40px)', pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', maxWidth: 860, margin: '0 auto' }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(108,60,225,0.12)', border: '1px solid rgba(108,60,225,0.25)',
            borderRadius: 100, padding: '6px 16px', marginBottom: 32,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6C3CE1', boxShadow: '0 0 8px #6C3CE1', display: 'inline-block' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#A78BFA', letterSpacing: '0.04em' }}>
              GraphRAG · Mixture of Experts · pgvector · FRED + yfinance
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 'clamp(36px, 6vw, 72px)',
            fontWeight: 800, lineHeight: 1.08, letterSpacing: '-2px',
            margin: '0 0 24px',
          }}>
            <span style={{
              background: 'linear-gradient(135deg, #C4B5FD 0%, #A78BFA 30%, #6C3CE1 60%, #0EB5C6 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              Inteligencia macro.
            </span>
            <br />
            <span style={{ color: '#E8E7F5' }}>A un API call de distancia.</span>
          </h1>

          {/* Subheadline */}
          <p style={{ fontSize: 18, lineHeight: 1.65, color: '#9998B8', maxWidth: 620, margin: '0 auto 40px', fontWeight: 400 }}>
            Bralidus convierte el contexto de tu startup en{' '}
            <span style={{ color: '#C4B5FD', fontWeight: 600 }}>GraphRAG dinámico</span>
            {' '}— macro, mercados, regulatorio y unit economics — listo para inyectar en tu LLM.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/login')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '14px 28px',
                background: 'linear-gradient(135deg, #6C3CE1, #5B30C4)',
                color: '#fff', fontWeight: 700, fontSize: 15,
                border: '1px solid rgba(139,92,246,0.5)',
                borderRadius: 14, cursor: 'pointer',
                boxShadow: '0 8px 32px rgba(108,60,225,0.35)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(108,60,225,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(108,60,225,0.35)'; }}
            >
              Acceder al Dashboard
              <IconArrow />
            </button>
            <a
              href="#api"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '14px 28px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
                color: '#C4B5FD', fontWeight: 600, fontSize: 15, borderRadius: 14,
                textDecoration: 'none', transition: 'border-color 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(108,60,225,0.4)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)')}
            >
              <IconCode />
              Ver la API
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────────────────── */}
      <section style={{ padding: '0 24px 80px' }}>
        <div style={{
          maxWidth: 900, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 1, background: 'rgba(108,60,225,0.12)', borderRadius: 20, overflow: 'hidden',
          border: '1px solid rgba(108,60,225,0.18)',
        }}>
          {STATS.map((s, i) => (
            <div key={i} style={{
              background: '#0E0E1A', padding: '28px 24px', textAlign: 'center',
            }}>
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 42, fontWeight: 800, color: '#E8E7F5',
                background: 'linear-gradient(135deg, #C4B5FD, #6C3CE1)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                {s.value}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#E8E7F5', marginTop: 4 }}>{s.label}</div>
              <div style={{ fontSize: 12, color: '#7674A0', marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ padding: '0 24px 100px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', color: '#7674A0', textTransform: 'uppercase' }}>
              Flujo
            </span>
            <h2 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-1px',
              margin: '12px 0 0', color: '#E8E7F5',
            }}>
              Cómo funciona Bralidus
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
            {HOW_IT_WORKS.map((step, i) => (
              <div key={i} style={{
                background: '#0E0E1A', border: `1px solid rgba(108,60,225,0.14)`,
                borderRadius: 20, padding: 32,
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(108,60,225,0.35)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 28px rgba(108,60,225,0.10)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(108,60,225,0.14)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: `${step.color}18`, border: `1px solid ${step.color}35`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: step.color,
                  }}>
                    {step.icon}
                  </div>
                  <span style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 36, fontWeight: 800, color: `${step.color}25`, lineHeight: 1,
                  }}>
                    {step.step}
                  </span>
                </div>
                <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: '#E8E7F5', margin: '0 0 10px' }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: 14, color: '#7674A0', lineHeight: 1.65, margin: 0 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Experts Grid ────────────────────────────────────────────────── */}
      <section id="experts" style={{ padding: '0 24px 100px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', color: '#7674A0', textTransform: 'uppercase' }}>
              Mixture of Experts
            </span>
            <h2 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-1px',
              margin: '12px 0 8px', color: '#E8E7F5',
            }}>
              5 Experts especializados
            </h2>
            <p style={{ fontSize: 15, color: '#7674A0', margin: 0 }}>
              El GatingNetwork activa los expertos más relevantes para tu query — sin configuración manual.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {EXPERTS.map(expert => (
              <div key={expert.id} style={{
                background: '#0E0E1A',
                border: `1px solid ${expert.border}`,
                borderRadius: 18, padding: 28,
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 12px 32px ${expert.color}18`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: expert.bg, border: `1px solid ${expert.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: expert.color, flexShrink: 0,
                  }}>
                    {expert.icon}
                  </div>
                  <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, color: '#E8E7F5', margin: 0 }}>
                    {expert.name}
                  </h3>
                </div>
                <p style={{ fontSize: 13, color: '#7674A0', lineHeight: 1.6, margin: '0 0 16px' }}>{expert.description}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {expert.keywords.slice(0, 4).map(kw => (
                    <span key={kw} style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 9px',
                      background: expert.bg, border: `1px solid ${expert.border}`,
                      borderRadius: 100, color: expert.color,
                    }}>
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Data Sources ─────────────────────────────────────────────────── */}
      <section style={{ padding: '0 24px 100px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', color: '#7674A0', textTransform: 'uppercase' }}>
              Fuentes de datos
            </span>
            <h2 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-1px',
              margin: '12px 0 0', color: '#E8E7F5',
            }}>
              Datos reales. Sin mocks.
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            {DATA_SOURCES.map(src => (
              <div key={src.name} style={{
                background: '#0E0E1A', border: '1px solid rgba(108,60,225,0.14)',
                borderRadius: 16, padding: 22,
                transition: 'border-color 0.2s',
              }}
                onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(108,60,225,0.30)')}
                onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(108,60,225,0.14)')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, color: '#E8E7F5' }}>
                    {src.name}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px',
                    borderRadius: 100, background: `${src.typeColor}15`,
                    border: `1px solid ${src.typeColor}30`, color: src.typeColor,
                  }}>
                    {src.type}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: '#7674A0', lineHeight: 1.55, margin: 0 }}>{src.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── API Preview ─────────────────────────────────────────────────── */}
      <section id="api" style={{ padding: '0 24px 100px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', color: '#7674A0', textTransform: 'uppercase' }}>
              API Reference
            </span>
            <h2 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-1px',
              margin: '12px 0 0', color: '#E8E7F5',
            }}>
              Una llamada. Todo el contexto.
            </h2>
          </div>

          <div ref={codeRef} style={{
            background: '#0A0A14', border: '1px solid rgba(108,60,225,0.25)',
            borderRadius: 20, overflow: 'hidden',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(108,60,225,0.08)',
          }}>
            {/* Terminal header */}
            <div style={{
              background: '#0E0E1A', padding: '12px 20px',
              borderBottom: '1px solid rgba(108,60,225,0.15)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#EF4444' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#F59E0B' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#10B981' }} />
              <span style={{ marginLeft: 12, fontSize: 12, color: '#7674A0', fontFamily: "'DM Mono', monospace" }}>
                POST https://bralidus.railway.app/query/moe
              </span>
            </div>

            {/* Code body */}
            <div style={{ padding: '28px 32px', fontFamily: "'Courier New', monospace", fontSize: 14, lineHeight: 2 }}>
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
                <span style={{ display: 'inline-block', width: 8, height: 16, background: '#6C3CE1', animation: 'blink 1s step-end infinite', verticalAlign: 'middle' }} />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Final ───────────────────────────────────────────────────── */}
      <section style={{ padding: '0 24px 120px', textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(108,60,225,0.12), rgba(14,181,198,0.08))',
            border: '1px solid rgba(108,60,225,0.25)', borderRadius: 28,
            padding: '60px 48px',
          }}>
            {/* Glow */}
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'linear-gradient(135deg, #6C3CE1, #0EB5C6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 28px',
              boxShadow: '0 0 40px rgba(108,60,225,0.5)',
              animation: 'pulse-glow 2.5s ease-in-out infinite',
            }}>
              <IconDatabase />
            </div>
            <h2 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 32, fontWeight: 800, letterSpacing: '-1px',
              color: '#E8E7F5', margin: '0 0 14px',
            }}>
              Empieza ahora
            </h2>
            <p style={{ fontSize: 15, color: '#7674A0', lineHeight: 1.65, margin: '0 0 36px' }}>
              Accede con tu email institucional, genera una API Key y haz tu primer request en menos de 5 minutos.
            </p>
            <button
              onClick={() => navigate('/login')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '16px 36px',
                background: 'linear-gradient(135deg, #6C3CE1, #5B30C4)',
                color: '#fff', fontWeight: 700, fontSize: 16,
                border: '1px solid rgba(139,92,246,0.5)',
                borderRadius: 14, cursor: 'pointer', width: '100%',
                justifyContent: 'center',
                boxShadow: '0 8px 32px rgba(108,60,225,0.4)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 16px 48px rgba(108,60,225,0.55)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(108,60,225,0.4)'; }}
            >
              Acceder con email
              <IconArrow />
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid rgba(108,60,225,0.12)',
        padding: '40px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 16, maxWidth: 900, margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg, #6C3CE1, #0EB5C6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
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
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, color: '#E8E7F5' }}>Bralidus</div>
            <div style={{ fontSize: 11, color: '#4A4A6A' }}>Powered by Validus · ScoutTech</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24 }}>
          <a href="https://validus.scouttech.lat" target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 13, color: '#7674A0', textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#E8E7F5')}
            onMouseLeave={e => (e.currentTarget.style.color = '#7674A0')}>
            Validus
          </a>
          <button onClick={() => navigate('/dashboard')}
            style={{ fontSize: 13, color: '#7674A0', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#E8E7F5')}
            onMouseLeave={e => (e.currentTarget.style.color = '#7674A0')}>
            Dashboard
          </button>
        </div>

        <p style={{ fontSize: 12, color: '#4A4A6A', margin: 0 }}>
          © 2026 ScoutTech · Todos los derechos reservados
        </p>
      </footer>
    </div>
  );
}
