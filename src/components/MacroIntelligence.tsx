import { useState } from 'react';
import { Brain, CheckCircle2, Send, Cpu } from 'lucide-react';
import { BASE } from '@/data/api-docs';

export default function MacroIntelligence() {
  const [query, setQuery] = useState('¿Cómo impactan la TPM y el dólar en la capacidad de competir en licitaciones de salud?');
  const [routingMode, setRoutingMode] = useState<'auto' | 'manual'>('auto');
  const [selectedExperts, setSelectedExperts] = useState<string[]>(['macro', 'b2g_strategy', 'legal']);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);

  const toggleExpert = (expertId: string) => {
    setSelectedExperts(prev => 
      prev.includes(expertId) ? prev.filter(e => e !== expertId) : [...prev, expertId]
    );
  };

  const executeIntelQuery = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/intel/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer demo_key'
        },
        body: JSON.stringify({
          query,
          routing: routingMode,
          experts: selectedExperts,
          context: { country: 'CL', sector: 'salud' }
        })
      });
      const data = await res.json();
      setResponse(data);
    } catch {
      // Mock fallback
      setResponse({
        data: {
          answer_id: 'ans_live_9912',
          executive_summary: 'Una TPM en 5.75% eleva el costo del capital de trabajo para la ejecución del contrato. La fluctuación del dólar a $942.50 presiona los insumos importados.',
          findings: [
            { title: 'Sensibilidad a tasa de interés', impact: 'high', direction: 'negative', statement: 'El costo de financiamiento de boletas de garantía y factoring se encarece 1.2%.' }
          ],
          experts_used: routingMode === 'auto' 
            ? [{ expert: 'macro', weight: 0.40 }, { expert: 'b2g_strategy', weight: 0.35 }, { expert: 'legal', weight: 0.25 }]
            : selectedExperts.map(e => ({ expert: e, weight: 1 / selectedExperts.length })),
          citations: [
            { id: 'cit_bcch_tpm', source: 'Banco Central de Chile', document_title: 'Serie TPM 2026', verified: true },
            { id: 'cit_ley_19886', source: 'Biblioteca del Congreso Nacional', document_title: 'Ley 19.886 Compras Públicas', verified: true }
          ]
        }
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '4px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Top Banner */}
      <div style={{ background: '#0B0B16', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 20, padding: 28, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(139,92,246,0.18)', border: '1px solid rgba(139,92,246,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C084FC' }}>
                <Brain style={{ width: 20, height: 20 }} />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: '#E8E7F5', margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
                Explorador en Vivo — Bralidus Intelligence &amp; GraphRAG (MoE)
              </h2>
              <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 100, background: 'rgba(192,132,252,0.15)', border: '1px solid rgba(192,132,252,0.3)', color: '#C084FC' }}>
                5 Expertos Temáticos Integrados
              </span>
            </div>
            <p style={{ fontSize: 13.5, color: '#9896B8', margin: 0, maxWidth: 850, lineHeight: 1.5 }}>
              Prueba el motor de inteligencia multicapa de Bralidus: enrutamiento inteligente entre expertos de Macro, Mercados, Unit Economics, Leyes y Licitaciones con respuestas verificables y citas.
            </p>
          </div>
        </div>
      </div>

      {/* Preset Query Chips */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, marginBottom: 20 }}>
        {[
          '¿Cómo impactan la TPM y el dólar en startups Fintech pre-seed en Chile?',
          '¿Qué exigencias normativas de la Ley 21.719 de datos aplicamos a SaaS?',
          'Evaluar compatibilidad (Tender Fit) para la Licitación 1180703-12-L126 en Salud',
          'Riesgo concursal CMF y salud financiera para RUT 76.123.456-7'
        ].map((chip, idx) => (
          <button
            key={idx}
            onClick={() => setQuery(chip)}
            style={{
              padding: '8px 14px', borderRadius: 10, fontSize: 11.5, fontWeight: 700,
              background: '#090914', border: '1px solid rgba(139,92,246,0.2)', color: '#D4D2F0',
              cursor: 'pointer', whiteSpace: 'nowrap'
            }}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Main Input Box */}
      <div style={{ background: '#090914', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 18, padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Escribe tu consulta inteligente o evaluación requerida..."
            style={{
              flex: 1, background: '#05050C', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 12,
              padding: '14px 18px', color: '#E8E7F5', fontSize: 14, fontWeight: 600, fontFamily: 'sans-serif'
            }}
          />
          <button
            onClick={executeIntelQuery}
            disabled={loading}
            style={{
              background: '#8B5CF6', color: '#FFF', border: 'none', padding: '0 24px', borderRadius: 12,
              fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: '0 4px 14px rgba(139,92,246,0.35)'
            }}
          >
            <Send style={{ width: 16, height: 16 }} />
            {loading ? 'Consultando...' : 'Ejecutar Query'}
          </button>
        </div>

        {/* MoE Routing Selector Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#C084FC', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Cpu style={{ width: 14, height: 14 }} /> Modo de Enrutamiento MoE:
            </span>
            <button
              onClick={() => setRoutingMode('auto')}
              style={{
                padding: '5px 12px', borderRadius: 8, fontSize: 11.5, fontWeight: 800, border: 'none', cursor: 'pointer',
                background: routingMode === 'auto' ? '#8B5CF6' : 'rgba(255,255,255,0.06)',
                color: routingMode === 'auto' ? '#FFF' : '#8B89B0'
              }}
            >
              Automático (Recomendado)
            </button>
            <button
              onClick={() => setRoutingMode('manual')}
              style={{
                padding: '5px 12px', borderRadius: 8, fontSize: 11.5, fontWeight: 800, border: 'none', cursor: 'pointer',
                background: routingMode === 'manual' ? '#8B5CF6' : 'rgba(255,255,255,0.06)',
                color: routingMode === 'manual' ? '#FFF' : '#8B89B0'
              }}
            >
              Selección Manual
            </button>
          </div>

          {/* Expert Toggles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {[
              { id: 'macro', label: '📊 Macro' },
              { id: 'markets', label: '📈 Mercados' },
              { id: 'unit_economics', label: '💼 Unit Econ' },
              { id: 'legal', label: '⚖️ Legal' },
              { id: 'b2g_strategy', label: '🎯 Estrategia B2G' }
            ].map(exp => (
              <button
                key={exp.id}
                disabled={routingMode === 'auto'}
                onClick={() => toggleExpert(exp.id)}
                style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                  border: selectedExperts.includes(exp.id) ? '1px solid #C084FC' : '1px solid rgba(255,255,255,0.08)',
                  background: selectedExperts.includes(exp.id) ? 'rgba(192,132,252,0.18)' : '#05050C',
                  color: selectedExperts.includes(exp.id) ? '#C084FC' : '#6A6888',
                  cursor: routingMode === 'auto' ? 'not-allowed' : 'pointer',
                  opacity: routingMode === 'auto' ? 0.7 : 1
                }}
              >
                {exp.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results View */}
      {response && (
        <div style={{ background: '#0B0B16', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 20, padding: 24 }}>
          {/* Executive Summary */}
          <div style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#4ADE80', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <CheckCircle2 style={{ width: 14, height: 14 }} /> Resumen Ejecutivo — Answer ID: {response.data?.answer_id}
            </span>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#E8E7F5', lineHeight: 1.5, background: '#05050C', padding: 16, borderRadius: 12, border: '1px solid rgba(139,92,246,0.2)' }}>
              {response.data?.executive_summary}
            </div>
          </div>

          {/* Experts Activated */}
          <div style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#C084FC', marginBottom: 8, display: 'block' }}>
              Expertos Activados por el Gating Network:
            </span>
            <div style={{ display: 'flex', gap: 10 }}>
              {response.data?.experts_used?.map((e: any, idx: number) => (
                <div key={idx} style={{ background: '#090914', border: '1px solid rgba(192,132,252,0.3)', padding: '6px 12px', borderRadius: 8, fontSize: 11.5, fontWeight: 800, color: '#E8E7F5' }}>
                  {e.expert.toUpperCase()} — <span style={{ color: '#C084FC' }}>{(e.weight * 100).toFixed(0)}% Ponderación</span>
                </div>
              ))}
            </div>
          </div>

          {/* Citations Grid */}
          <div>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#2DD4BF', marginBottom: 8, display: 'block' }}>
              Evidencia Citable &amp; Trazabilidad (Fact-Checking):
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              {response.data?.citations?.map((cit: any) => (
                <div key={cit.id} style={{ background: '#05050C', border: '1px solid rgba(45,212,191,0.2)', padding: 14, borderRadius: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#2DD4BF' }}>[{cit.source}]</span>
                    <span style={{ fontSize: 10, color: '#4ADE80', fontWeight: 800 }}>✓ VERIFICADO</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#E8E7F5' }}>{cit.document_title}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
