import { useState } from 'react';
import { Cpu, Sparkles, Send, ShieldCheck, RefreshCw, Zap } from 'lucide-react';
import { BASE } from '@/data/api-docs';

const SAMPLE_PROMPTS = [
  "¿Cómo impacta el alza de la TPM y el dólar en startups Fintech pre-seed en Chile?",
  "¿Qué exigencias normativas de la Ley 21.719 aplican a plataformas SaaS B2B?",
  "Analiza el riesgo del aumento del salario mínimo en los unit economics de un delivery local.",
  "¿Qué montos y organismos han licitado software de salud en Mercado Público este trimestre?"
];

export function IntelligenceLiveExplorer() {
  const [query, setQuery] = useState(SAMPLE_PROMPTS[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>({
    experts_activated: ["macro", "legal", "unit_economics"],
    routing_reason: "Consulta requiere análisis macroeconómico (tasa TPM), regulación financiera y unit economics de capital.",
    data_freshness: "live",
    evidence_nodes: [
      { expert: "macro", title: "TPM Banco Central", value: "5.75%", date: "2026-07-18", source: "BCCh" },
      { expert: "legal", title: "Ley 21.521 (Ley Fintec)", value: "Vigente", date: "2026-06-01", source: "CMF / Biblioteca del Congreso" },
      { expert: "unit_economics", title: "CAC/LTV Benchmark SaaS LatAm", value: "$420 USD CAC", date: "2026-07-15", source: "Animus Knowledge Base" }
    ],
    generated_context: "## Análisis de Inteligencia Animus MoE\n\nEl costo de capital actual (TPM 5.75% por BCCh) incrementa la exigencia de payback period en startups Fintech a < 12 meses. Se evidencia regulación activa por CMF bajo Ley Fintec..."
  });

  const handleQuerySubmit = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/intel/query/moe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer demo_public_key' },
        body: JSON.stringify({ query, max_experts: 3 })
      });
      if (res.ok) {
        const json = await res.json();
        setResult(json);
      }
    } catch {
      // keep mock on fallback
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: '#0B0B16', border: '1px solid rgba(139,92,246,0.22)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 12px 36px rgba(0,0,0,0.4)' }}>
      {/* Banner */}
      <div style={{ padding: '24px 28px', background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(14,181,198,0.04) 100%)', borderBottom: '1px solid rgba(139,92,246,0.14)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 10, background: 'rgba(139,92,246,0.15)', color: '#A78BFA' }}>
            <Cpu style={{ width: 18, height: 18 }} />
          </span>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: '#E8E7F5', margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
            Explorador en Vivo — Animus Intelligence & GraphRAG MoE
          </h3>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', color: '#A78BFA' }}>
            <Sparkles style={{ width: 12, height: 12 }} /> Mixture of 5 Experts
          </span>
        </div>
        <p style={{ fontSize: 13.5, color: '#9896B8', maxWidth: 720, margin: 0, lineHeight: 1.6 }}>
          Prueba el motor GraphRAG Mixture of Experts (MoE) que orquesta 5 redes de conocimiento (Macro, Mercados, Unit Economics, Legal, Estrategia) con evidencia citable y fechada en tiempo real.
        </p>

        {/* Sample Prompts */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 18 }}>
          {SAMPLE_PROMPTS.map((p, i) => (
            <button
              key={i}
              onClick={() => { setQuery(p); }}
              style={{
                padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.2)', background: 'rgba(139,92,246,0.06)',
                color: '#C4B5FD', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', textAlign: 'left'
              }}
            >
              "{p.slice(0, 45)}..."
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Input Box */}
      <div style={{ padding: 24, borderBottom: '1px solid rgba(108,60,225,0.1)' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Escribe una consulta de inteligencia de negocios o regulatoria..."
            style={{ flex: 1, background: '#05050C', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 12, padding: '12px 16px', color: '#E8E7F5', fontSize: 13.5, outline: 'none' }}
          />
          <button
            onClick={handleQuerySubmit}
            disabled={loading}
            style={{ background: '#6C3CE1', border: 'none', color: '#fff', padding: '12px 24px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
          >
            {loading ? <RefreshCw style={{ width: 15, height: 15, animation: 'spin 1s linear infinite' }} /> : <Send style={{ width: 15, height: 15 }} />}
            Ejecutar MoE
          </button>
        </div>
      </div>

      {/* Results Display */}
      {result && (
        <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {/* Expert Activation Panel */}
          <div style={{ background: '#070712', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 16, padding: 20 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap style={{ width: 14, height: 14, color: '#F59E0B' }} /> Expertos Activados por Gating Network
            </h4>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {['macro', 'mercados', 'unit_economics', 'legal', 'estrategia'].map((exp) => {
                const active = result.experts_activated?.includes(exp);
                return (
                  <span
                    key={exp}
                    style={{
                      padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                      background: active ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.03)',
                      border: active ? '1px solid #8B5CF6' : '1px solid rgba(255,255,255,0.06)',
                      color: active ? '#C4B5FD' : '#5A5A78'
                    }}
                  >
                    {exp.replace('_', ' ').toUpperCase()} {active ? '✓' : ''}
                  </span>
                );
              })}
            </div>

            <p style={{ fontSize: 12, color: '#7674A0', lineHeight: 1.5, margin: 0 }}>
              <strong style={{ color: '#E8E7F5' }}>Routing Reason:</strong> {result.routing_reason}
            </p>
          </div>

          {/* Evidence Nodes */}
          <div style={{ background: '#070712', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 16, padding: 20 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck style={{ width: 14, height: 14, color: '#4ADE80' }} /> Evidencia Citable & Procedencia
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {result.evidence_nodes?.map((node: any, idx: number) => (
                <div key={idx} style={{ background: '#05050C', padding: 12, borderRadius: 10, border: '1px solid rgba(139,92,246,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8B89B0', marginBottom: 4 }}>
                    <span style={{ color: '#4ADE80', fontWeight: 700 }}>[{node.source}]</span>
                    <span>{node.date}</span>
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#E8E7F5' }}>{node.title}: <span style={{ color: '#A78BFA' }}>{node.value}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
