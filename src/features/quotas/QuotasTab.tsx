import { useState } from 'react';
import { ShieldCheck, Zap, ArrowUpRight, Check } from 'lucide-react';

interface QuotasTabProps {
  usageCount: number;
}

const TIER_SPECS = [
  { name: 'Basic', credits: 1000, burst: 60, price: '$19/mes', accent: '#0EB5C6', desc: 'Ideal para MVPs, prototipos REST y consultas macroeconómicas' },
  { name: 'Pro', credits: 15000, burst: 180, price: '$79/mes', accent: '#8B5CF6', desc: 'Para aplicaciones SaaS en producción, Animus MCP Server y GraphRAG MoE activo', popular: true },
  { name: 'Premium', credits: 100000, burst: 300, price: '$299/mes', accent: '#EC4899', desc: 'Alto rendimiento B2G, IA predictiva de adjudicación, MCP ilimitado y SLAs' },
  { name: 'Enterprise', credits: 1000000, burst: 600, price: 'Custom', accent: '#F59E0B', desc: 'Cuota personalizada con infraestructura dedicada e integraciones agénticas custom' },
];

const ENDPOINT_COSTS = [
  { endpoint: 'GET /api/v1/data/economy', category: 'Macro Data', cost: 1, type: 'Lectura Caché' },
  { endpoint: 'GET /api/v1/data/spulse/companies/*', category: 'Grafo Societario', cost: 2, type: 'Consulta DB' },
  { endpoint: 'GET /api/v1/mercado-publico/opportunities', category: 'Mercado Público B2G', cost: 25, type: 'Buscador Unificado' },
  { endpoint: 'GET /api/v1/mercado-publico/licitaciones', category: 'Mercado Público B2G', cost: 25, type: 'Licitaciones Públicas' },
  { endpoint: 'GET /api/v1/mercado-publico/compra-agil', category: 'Mercado Público B2G', cost: 25, type: 'Cotización Expédita' },
  { endpoint: 'GET /api/v1/mercado-publico/compradores/*/historial', category: 'Fase 2 Commercial', cost: 35, type: 'Historial 360° Comprador' },
  { endpoint: 'GET /api/v1/mercado-publico/proveedores/*/perfil-competitivo', category: 'Fase 2 Commercial', cost: 40, type: 'Perfil Competidor B2G' },
  { endpoint: 'GET /api/v1/mercado-publico/proveedores/*/vs-mercado', category: 'Fase 2 Commercial', cost: 45, type: 'Benchmark Competitivo' },
  { endpoint: 'GET /api/v1/mercado-publico/analitica/precios', category: 'Fase 2 Commercial', cost: 50, type: 'Precios UNSPSC P10-P90' },
  { endpoint: 'POST /api/v1/mercado-publico/ai/scoring', category: 'Fase 3 IA Predictiva', cost: 25, type: 'Score Compatibilidad B2G' },
  { endpoint: 'POST /api/v1/mercado-publico/ai/prediccion', category: 'Fase 3 IA Predictiva', cost: 40, type: 'Win Probability %' },
  { endpoint: 'POST /api/v1/mercado-publico/ai/recomendaciones', category: 'Fase 3 IA Predictiva', cost: 30, type: 'Estrategia Oferta Algorítmica' },
  { endpoint: 'POST /api/v1/rag/query', category: 'Búsqueda Vectorial', cost: 5, type: 'pgvector HNSW' },
  { endpoint: 'POST /api/v1/rag/ingest/text', category: 'Ingesta RAG', cost: 10, type: 'Vectorización' },
  { endpoint: 'POST /api/v1/intel/query', category: 'GraphRAG Unificado', cost: 15, type: 'GraphRAG + 1 LLM' },
  { endpoint: 'POST /api/v1/intel/query/moe', category: 'Mixture of Experts', cost: 35, type: 'Gating + 5 Expertos' },
  { endpoint: 'MCP Tool: animus_search_b2g_tenders', category: 'Animus MCP Server', cost: 25, type: 'MCP Agéntico B2G' },
  { endpoint: 'MCP Tool: animus_get_corporate_mesh', category: 'Animus MCP Server', cost: 10, type: 'MCP Agéntico S-Pulse' },
  { endpoint: 'MCP Tool: animus_get_macro_indicators', category: 'Animus MCP Server', cost: 1, type: 'MCP Agéntico Macro' },
  { endpoint: 'MCP Tool: animus_query_moe_graphrag', category: 'Animus MCP Server', cost: 35, type: 'MCP Agéntico GraphRAG MoE' },
  { endpoint: 'MCP Tool: animus_predict_win_probability', category: 'Animus MCP Server', cost: 40, type: 'MCP Agéntico IA Predictiva' },
  { endpoint: 'POST /mcp/v1/tools/call', category: 'Animus MCP Server', cost: 1, type: 'Invocación remota MCP' },
  { endpoint: 'POST /functions/v1/assemble-mega-prompt', category: 'Due Diligence', cost: 120, type: 'MegaPrompt 16 Dims' },
];

export function QuotasTab({ usageCount }: QuotasTabProps) {
  const [currentTier] = useState<'basic' | 'pro' | 'premium' | 'admin'>('pro');

  const tierMeta = TIER_SPECS.find(t => t.name.toLowerCase() === currentTier) ?? TIER_SPECS[1];
  const creditsUsed = usageCount || 420;
  const creditLimit = tierMeta.credits;
  const pctUsed = Math.min(100, Math.round((creditsUsed / creditLimit) * 100));

  const barColor = pctUsed >= 90 ? '#EF4444' : pctUsed >= 70 ? '#F59E0B' : '#0EB5C6';

  const cardStyle = { background: '#0E0E1A', border: '1px solid rgba(108,60,225,0.12)', borderRadius: 16, overflow: 'hidden' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Active Plan & Live Usage Meter ──────────────── */}
      <div style={cardStyle}>
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <ShieldCheck style={{ width: 20, height: 20, color: tierMeta.accent }} />
                <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 800, color: '#E8E7F5', margin: 0 }}>
                  Tu Plan Actual: Plan {tierMeta.name}
                </h3>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: `${tierMeta.accent}18`, border: `1px solid ${tierMeta.accent}40`, color: tierMeta.accent, textTransform: 'uppercase' }}>
                  ACTIVO
                </span>
              </div>
              <p style={{ fontSize: 13, color: '#7674A0', margin: 0 }}>{tierMeta.desc}</p>
            </div>
            <a
              href="https://validus.scouttech.lat/pricing" target="_blank" rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'linear-gradient(135deg, #6C3CE1, #5B30C4)',
                border: 'none', borderRadius: 12, padding: '10px 18px',
                cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none',
              }}
            >
              Actualizar Plan <ArrowUpRight style={{ width: 14, height: 14 }} />
            </a>
          </div>

          {/* Usage Progress Bar */}
          <div style={{ background: '#08080F', border: '1px solid rgba(108,60,225,0.14)', borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap style={{ width: 14, height: 14, color: barColor }} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#D4D2F0' }}>Consumo de Créditos del Mes</span>
              </div>
              <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: '#E8E7F5' }}>
                {creditsUsed.toLocaleString()} / {creditLimit.toLocaleString()} créditos ({pctUsed}%)
              </span>
            </div>

            <div style={{ height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 100, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ height: '100%', width: `${pctUsed}%`, background: barColor, borderRadius: 100, transition: 'width 0.5s ease-in-out' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#5A5A78' }}>
              <span>Reseteo de cuota: 1° de cada mes</span>
              <span>Burst limit: <strong>{tierMeta.burst} req/min</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Credit Weighting Breakdown Table ───────────────── */}
      <div style={cardStyle}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(108,60,225,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap style={{ width: 14, height: 14, color: '#0EB5C6' }} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#C4B5FD' }}>Tabla de Ponderación de Créditos por Endpoint</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(108,60,225,0.08)' }}>
                {['Endpoint', 'Categoría', 'Tipo de Proceso', 'Costo en Créditos'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#6A6888' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ENDPOINT_COSTS.map((ep, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(108,60,225,0.05)' }}>
                  <td style={{ padding: '10px 16px' }}>
                    <code style={{ fontSize: 12, color: '#0EB5C6', fontFamily: 'monospace' }}>{ep.endpoint}</code>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#D4D2F0' }}>{ep.category}</td>
                  <td style={{ padding: '10px 16px', color: '#7674A0' }}>{ep.type}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 800, fontFamily: 'monospace', color: ep.cost >= 35 ? '#EC4899' : ep.cost >= 10 ? '#8B5CF6' : '#2DD4BF', background: 'rgba(108,60,225,0.08)', padding: '3px 9px', borderRadius: 8 }}>
                      {ep.cost} {ep.cost === 1 ? 'crédito' : 'créditos'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Tier Comparison Grid ────────────────────────── */}
      <div>
        <h4 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 800, color: '#E8E7F5', margin: '0 0 14px' }}>
          Comparativa de Tiers Animus RaaS
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {TIER_SPECS.map(t => {
            const isSelected = t.name.toLowerCase() === currentTier;
            return (
              <div
                key={t.name}
                style={{
                  background: '#0E0E1A',
                  border: `1px solid ${isSelected ? t.accent : 'rgba(108,60,225,0.12)'}`,
                  borderRadius: 16, padding: 20, position: 'relative',
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                }}
              >
                {t.popular && (
                  <span style={{ position: 'absolute', top: 12, right: 12, fontSize: 9.5, fontWeight: 800, background: '#8B5CF6', color: '#fff', padding: '2px 8px', borderRadius: 100, textTransform: 'uppercase' }}>
                    Recomendado
                  </span>
                )}
                <div>
                  <h5 style={{ fontSize: 16, fontWeight: 800, color: '#E8E7F5', margin: '0 0 4px' }}>{t.name}</h5>
                  <p style={{ fontSize: 20, fontWeight: 900, color: t.accent, margin: '0 0 12px', fontFamily: "'Space Grotesk', sans-serif" }}>{t.price}</p>
                  <p style={{ fontSize: 11.5, color: '#7674A0', lineHeight: 1.5, margin: '0 0 16px' }}>{t.desc}</p>
                  <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5, color: '#D4D2F0' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Check style={{ width: 12, height: 12, color: t.accent }} />
                      <strong>{t.credits.toLocaleString()}</strong> créditos/mes
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Check style={{ width: 12, height: 12, color: t.accent }} />
                      Burst: <strong>{t.burst} req/min</strong>
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Check style={{ width: 12, height: 12, color: t.accent }} />
                      Soporte técnico por email
                    </li>
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

