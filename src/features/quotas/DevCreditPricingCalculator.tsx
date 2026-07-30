import { useState, useMemo } from 'react';
import { DollarSign, Sliders, TrendingUp, Calculator, ShieldAlert, Sparkles } from 'lucide-react';

export interface DevCreditPricingCalculatorProps {
  isVisible?: boolean;
}

interface CostTierSample {
  name: string;
  category: string;
  credits: number;
  baseInfraCostUsd: number;
}

const SAMPLE_ENDPOINTS: CostTierSample[] = [
  { name: 'GET /api/v1/data/economy (Snapshot Macro)', category: 'Macro Data', credits: 1, baseInfraCostUsd: 0.002 },
  // Salieron dos muestras que dependían de S-Pulse (ficha corporativa y la
  // herramienta MCP de malla societaria): con S-Pulse en stand-by, poner su
  // precio en la calculadora es cotizar algo que no se entrega.
  { name: 'POST /api/v1/rag/query (Búsqueda Vectorial pgvector)', category: 'Vault Vectorial', credits: 5, baseInfraCostUsd: 0.012 },
  { name: 'POST /api/v1/intel/query (GraphRAG Unificado)', category: 'Intelligence', credits: 15, baseInfraCostUsd: 0.040 },
  { name: 'GET /api/v1/mercado-publico/licitaciones (Licitaciones B2G)', category: 'Mercado Público B2G', credits: 25, baseInfraCostUsd: 0.080 },
  { name: 'POST /api/v1/mercado-publico/ai/scoring (Score Compatibilidad IA)', category: 'IA Predictiva', credits: 25, baseInfraCostUsd: 0.085 },
  { name: 'POST /api/v1/intel/query/moe (GraphRAG 5 Expertos)', category: 'Intelligence MoE', credits: 35, baseInfraCostUsd: 0.120 },
  { name: 'POST /api/v1/mercado-publico/ai/prediccion (Win Probability %)', category: 'IA Predictiva', credits: 40, baseInfraCostUsd: 0.150 },
  { name: 'GET /api/v1/mercado-publico/analitica/precios (UNSPSC P10-P90)', category: 'Fase 2 Commercial', credits: 50, baseInfraCostUsd: 0.180 },
  { name: 'POST /functions/v1/assemble-mega-prompt (Due Diligence 16 Dims)', category: 'Due Diligence', credits: 120, baseInfraCostUsd: 0.450 },
];

export function DevCreditPricingCalculator({ isVisible = true }: DevCreditPricingCalculatorProps) {
  // Configuración de Precios en Dev
  const [usdPerCredit, setUsdPerCredit] = useState<number>(0.019); // $0.019 USD por crédito
  const [clpExchangeRate, setClpExchangeRate] = useState<number>(950); // $950 CLP por USD
  const [marginMarkup, setMarginMarkup] = useState<number>(1.5); // 1.5x multiplicador
  const [currency, setCurrency] = useState<'USD' | 'CLP'>('USD');

  // Cálculos dinámicos
  const effectivePricePerCreditUsd = useMemo(() => usdPerCredit * marginMarkup, [usdPerCredit, marginMarkup]);
  const effectivePricePerCreditClp = useMemo(() => effectivePricePerCreditUsd * clpExchangeRate, [effectivePricePerCreditUsd, clpExchangeRate]);

  // Si está en producción y no se fuerza isVisible, retornar null
  const isDevEnvironment = import.meta.env.DEV || isVisible;
  if (!isDevEnvironment) return null;

  const cardStyle = {
    background: 'linear-gradient(135deg, #0F0C20 0%, #150E2D 100%)',
    border: '1px solid rgba(139,92,246,0.3)',
    borderRadius: 16,
    padding: 24,
    boxShadow: '0 8px 32px rgba(108,60,225,0.15)',
  };

  return (
    <div style={cardStyle}>
      {/* Badge DEV MODE ONLY */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#F87171', padding: '4px 10px', borderRadius: 100, fontSize: 10.5, fontWeight: 900, letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldAlert style={{ width: 13, height: 13 }} /> DEV MODE ONLY · CALCULADORA UNIT ECONOMICS DE CRÉDITOS
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#9896B8' }}>Moneda:</span>
          <button
            onClick={() => setCurrency('USD')}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 800, cursor: 'pointer',
              background: currency === 'USD' ? '#8B5CF6' : 'rgba(255,255,255,0.05)',
              color: currency === 'USD' ? '#fff' : '#9896B8', border: 'none',
            }}
          >
            USD ($)
          </button>
          <button
            onClick={() => setCurrency('CLP')}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 800, cursor: 'pointer',
              background: currency === 'CLP' ? '#10B981' : 'rgba(255,255,255,0.05)',
              color: currency === 'CLP' ? '#fff' : '#9896B8', border: 'none',
            }}
          >
            CLP ($)
          </button>
        </div>
      </div>

      <p style={{ fontSize: 13, color: '#C4B5FD', margin: '0 0 20px', lineHeight: 1.5 }}>
        Panel interno de administración para simulación de precios por crédito, margen comercial (markup) y proyecciones de facturación para reuniones de equipo.
      </p>

      {/* ── Controles Interactivos ────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24, background: '#090714', padding: 18, borderRadius: 12, border: '1px solid rgba(139,92,246,0.15)' }}>
        
        {/* Precio Base por Crédito */}
        <div>
          <label style={{ fontSize: 11.5, fontWeight: 800, color: '#A78BFA', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <DollarSign style={{ width: 14, height: 14 }} /> Precio Base USD / Crédito:
          </label>
          <input
            type="number"
            step="0.001"
            min="0.001"
            max="0.5"
            value={usdPerCredit}
            onChange={e => setUsdPerCredit(parseFloat(e.target.value) || 0.019)}
            style={{ width: '100%', padding: '8px 12px', background: '#120F24', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, color: '#4ADE80', fontSize: 14, fontWeight: 800, fontFamily: 'monospace', outline: 'none' }}
          />
          <span style={{ fontSize: 11, color: '#7674A0', marginTop: 4, display: 'block' }}>
            Base actual: ${(usdPerCredit * clpExchangeRate).toFixed(1)} CLP / crédito
          </span>
        </div>

        {/* Multiplicador de Margen */}
        <div>
          <label style={{ fontSize: 11.5, fontWeight: 800, color: '#A78BFA', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Sliders style={{ width: 14, height: 14 }} /> Multiplicador Margen (Markup):
          </label>
          <select
            value={marginMarkup}
            onChange={e => setMarginMarkup(parseFloat(e.target.value))}
            style={{ width: '100%', padding: '8px 12px', background: '#120F24', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, color: '#F59E0B', fontSize: 13, fontWeight: 800, outline: 'none' }}
          >
            <option value={1.0}>1.0x (Costo Puro / At-Cost)</option>
            <option value={1.25}>1.25x (Margen 20%)</option>
            <option value={1.5}>1.5x (Margen Estándar 33%)</option>
            <option value={2.0}>2.0x (Alto Margen 50%)</option>
            <option value={3.0}>3.0x (Enterprise Premium 66%)</option>
          </select>
          <span style={{ fontSize: 11, color: '#7674A0', marginTop: 4, display: 'block' }}>
            Precio Final: {currency === 'USD' ? `$${effectivePricePerCreditUsd.toFixed(4)} USD` : `$${effectivePricePerCreditClp.toFixed(1)} CLP`} / cr
          </span>
        </div>

        {/* Tipo de Cambio USD/CLP */}
        <div>
          <label style={{ fontSize: 11.5, fontWeight: 800, color: '#A78BFA', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Calculator style={{ width: 14, height: 14 }} /> Tipo de Cambio (USD/CLP):
          </label>
          <input
            type="number"
            value={clpExchangeRate}
            onChange={e => setClpExchangeRate(parseFloat(e.target.value) || 950)}
            style={{ width: '100%', padding: '8px 12px', background: '#120F24', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, color: '#60A5FA', fontSize: 14, fontWeight: 800, fontFamily: 'monospace', outline: 'none' }}
          />
          <span style={{ fontSize: 11, color: '#7674A0', marginTop: 4, display: 'block' }}>
            Usado para facturación local en Chile
          </span>
        </div>

      </div>

      {/* ── Tabla de Simulación de Precios Reales ───────────── */}
      <h4 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14.5, fontWeight: 800, color: '#E8E7F5', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Sparkles style={{ width: 16, height: 16, color: '#C084FC' }} /> Tabla de Precios Finales por Llamada a la API / MCP Tool
      </h4>

      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(139,92,246,0.2)', marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#080614', color: '#A78BFA', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.5px', borderBottom: '1px solid rgba(139,92,246,0.2)' }}>
              <th style={{ textAlign: 'left', padding: '10px 14px' }}>Endpoint / Herramienta MCP</th>
              <th style={{ textAlign: 'center', padding: '10px 14px' }}>Créditos</th>
              <th style={{ textAlign: 'right', padding: '10px 14px' }}>Costo Infra Est. (USD)</th>
              <th style={{ textAlign: 'right', padding: '10px 14px' }}>Cobro Cliente ({currency})</th>
              <th style={{ textAlign: 'right', padding: '10px 14px' }}>Margen Bruto Est.</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_ENDPOINTS.map((item, idx) => {
              const finalPriceUsd = item.credits * effectivePricePerCreditUsd;
              const finalPriceClp = item.credits * effectivePricePerCreditClp;
              const marginPercentage = Math.round(((finalPriceUsd - item.baseInfraCostUsd) / finalPriceUsd) * 100);

              return (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: item.name.startsWith('MCP') ? '#C084FC' : '#E8E7F5' }}>
                    {item.name}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800, color: '#A78BFA' }}>
                    {item.credits} cr
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#7674A0', fontFamily: 'monospace' }}>
                    ${item.baseInfraCostUsd.toFixed(3)}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 900, color: currency === 'USD' ? '#4ADE80' : '#60A5FA', fontFamily: 'monospace', fontSize: 13 }}>
                    {currency === 'USD' ? `$${finalPriceUsd.toFixed(3)} USD` : `$${Math.round(finalPriceClp).toLocaleString()} CLP`}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: marginPercentage >= 40 ? '#10B981' : '#F59E0B' }}>
                    {marginPercentage}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Proyección de Rentabilidad por Plan ─────────────── */}
      <h4 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14.5, fontWeight: 800, color: '#E8E7F5', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <TrendingUp style={{ width: 16, height: 16, color: '#10B981' }} /> Proyección de Rentabilidad por Plan de Suscripción
      </h4>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {[
          { plan: 'Plan Basic', credits: 1000, priceUsd: 19 },
          { plan: 'Plan Pro', credits: 15000, priceUsd: 79 },
          { plan: 'Plan Premium', credits: 100000, priceUsd: 299 },
          { plan: 'Plan Enterprise', credits: 1000000, priceUsd: 2499 },
        ].map(p => {
          const creditValueUsd = p.credits * effectivePricePerCreditUsd;
          const infraCostUsd = p.credits * 0.003; // Est. $0.003 infra/cr
          const netProfitUsd = p.priceUsd - infraCostUsd;
          const marginPct = Math.round((netProfitUsd / p.priceUsd) * 100);

          return (
            <div key={p.plan} style={{ background: '#080614', padding: 14, borderRadius: 10, border: '1px solid rgba(139,92,246,0.15)' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#A78BFA', marginBottom: 4 }}>{p.plan}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 6 }}>${p.priceUsd} USD/mes</div>
              <div style={{ fontSize: 11, color: '#9896B8', lineHeight: 1.4 }}>
                Valor Créditos: <strong style={{ color: '#4ADE80' }}>${creditValueUsd.toFixed(0)} USD</strong><br />
                Costo Infra Est.: <span style={{ color: '#EF4444' }}>${infraCostUsd.toFixed(0)} USD</span><br />
                Margen Neto: <strong style={{ color: '#10B981' }}>{marginPct}% (${netProfitUsd.toFixed(0)} USD)</strong>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}

export default DevCreditPricingCalculator;
