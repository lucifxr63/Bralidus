import { useState } from 'react';
import { TrendingUp, Code2, RefreshCw, Layers, DollarSign, ShieldAlert, Users, Database, Sparkles } from 'lucide-react';
import { BASE } from '@/data/api-docs';

export interface EconomicIndicator {
  code: string;
  name: string;
  endpoint: string;
  category: 'local_macro' | 'global_macro' | 'cmf_risk' | 'labor' | 'projects' | 'ai_insights';
  value: string | number;
  unit: string;
  change: string;
  isPositive: boolean;
  provider: string;
  updated_at: string;
  description: string;
  json_sample: object;
}

const DEMO_INDICATORS: EconomicIndicator[] = [
  // 1. Local Macro Chile
  {
    code: 'UF',
    name: 'Unidad de Fomento (UF)',
    endpoint: 'GET /api/v1/data/economy/chile/uf',
    category: 'local_macro',
    value: 37842.15,
    unit: 'CLP',
    change: '+0.12%',
    isPositive: true,
    provider: 'Banco Central de Chile (BCCh)',
    updated_at: '2026-07-27T00:00:00Z',
    description: 'Valor del día y proyección mensual reajustable para contratos y créditos.',
    json_sample: { series_id: 'CL_UF_DAILY', current_value: 37842.15, projection_month_end: 37890.00 }
  },
  {
    code: 'IPC',
    name: 'Índice de Precios al Consumidor (IPC)',
    endpoint: 'GET /api/v1/data/economy/chile/ipc',
    category: 'local_macro',
    value: 0.3,
    unit: '% mensual',
    change: '-0.10%',
    isPositive: true,
    provider: 'INE / Banco Central de Chile',
    updated_at: '2026-07-08T08:00:00Z',
    description: 'Variación mensual de la canasta de consumo e inflación acumulada 12m (3.8%).',
    json_sample: { series_id: 'CL_IPC_MONTHLY', monthly_change: 0.3, accumulated_12m: 3.8 }
  },
  {
    code: 'TPM',
    name: 'Tasa de Política Monetaria (TPM)',
    endpoint: 'GET /api/v1/data/economy/chile/tpm',
    category: 'local_macro',
    value: 5.75,
    unit: '% anual',
    change: '-0.25%',
    isPositive: true,
    provider: 'Banco Central de Chile (BCCh)',
    updated_at: '2026-07-18T18:00:00Z',
    description: 'Tasa de referencia para operaciones interbancarias y créditos comerciales.',
    json_sample: { series_id: 'CL_TPM_RATE', rate: 5.75, stance: 'moderately_restrictive' }
  },
  {
    code: 'USD_CLP',
    name: 'Dólar Observado (USD/CLP)',
    endpoint: 'GET /api/v1/data/economy/chile/exchange-rates',
    category: 'local_macro',
    value: 942.50,
    unit: 'CLP por USD',
    change: '+0.45%',
    isPositive: false,
    provider: 'Banco Central de Chile',
    updated_at: '2026-07-27T09:00:00Z',
    description: 'Paridad oficial del dólar estadounidense en el mercado cambiario local.',
    json_sample: { pair: 'USD/CLP', rate: 942.50, change_day: '+0.45%' }
  },
  {
    code: 'IMACEC',
    name: 'Imacec Actividad Económica',
    endpoint: 'GET /api/v1/data/economy/chile/imacec',
    category: 'local_macro',
    value: 1.8,
    unit: '% YoY',
    change: '+0.20%',
    isPositive: true,
    provider: 'Banco Central de Chile',
    updated_at: '2026-07-01T00:00:00Z',
    description: 'Estimación mensual del PIB de Chile con desglose minero y no minero.',
    json_sample: { change_yoy: 1.8, mining_imacec: 3.4, non_mining_imacec: 1.2 }
  },
  {
    code: 'PIB_CHILE',
    name: 'PIB Crecimiento Real',
    endpoint: 'GET /api/v1/data/economy/chile/gdp',
    category: 'local_macro',
    value: 340.5,
    unit: 'Billones USD',
    change: '+2.1% YoY',
    isPositive: true,
    provider: 'Banco Central de Chile',
    updated_at: '2026-07-15T00:00:00Z',
    description: 'Producto Interno Bruto nominal y crecimiento real por componentes.',
    json_sample: { gdp_nominal_usd_billions: 340.5, gdp_real_growth_yoy: 2.1 }
  },

  // 2. Global & Commodities
  {
    code: 'COPPER',
    name: 'Precio Spot Cobre (HG=F)',
    endpoint: 'GET /api/v1/data/commodities/copper',
    category: 'global_macro',
    value: 4.25,
    unit: 'USD/lb',
    change: '+1.85%',
    isPositive: true,
    provider: 'FRED / COMEX / LME',
    updated_at: '2026-07-27T08:30:00Z',
    description: 'Cotización internacional del Cobre en bolsas de materias primas.',
    json_sample: { symbol: 'COPPER_HG=F', price_usd_lb: 4.25, price_usd_ton: 9370.00 }
  },
  {
    code: 'WTI_CRUDE',
    name: 'Petróleo WTI (CL=F)',
    endpoint: 'GET /api/v1/data/commodities/snapshot',
    category: 'global_macro',
    value: 78.40,
    unit: 'USD/barril',
    change: '-0.75%',
    isPositive: true,
    provider: 'FRED / NYMEX',
    updated_at: '2026-07-27T08:30:00Z',
    description: 'Precio de referencia del petróleo West Texas Intermediate en mercados mundiales.',
    json_sample: { symbol: 'WTI', price: 78.40, unit: 'USD/bbl' }
  },
  {
    code: 'LITHIUM',
    name: 'Litio Carbonato LCE Spot',
    endpoint: 'GET /api/v1/data/commodities/snapshot',
    category: 'global_macro',
    value: 14200,
    unit: 'USD/ton',
    change: '+0.50%',
    isPositive: true,
    provider: 'OpenBB / yFinance',
    updated_at: '2026-07-27T08:30:00Z',
    description: 'Cotización del carbonato de litio equivalente grado batería.',
    json_sample: { symbol: 'LITHIUM', price: 14200, unit: 'USD/ton' }
  },
  {
    code: 'US_FED_RATE',
    name: 'Tasa Reserva Federal EE.UU.',
    endpoint: 'GET /api/v1/data/economy/global/snapshot',
    category: 'global_macro',
    value: 5.25,
    unit: '% anual',
    change: 'Estable',
    isPositive: true,
    provider: 'FRED — Federal Reserve',
    updated_at: '2026-07-25T00:00:00Z',
    description: 'Tasa de interés de fondos federales en Estados Unidos.',
    json_sample: { us_fed_rate: 5.25, us_cpi_yoy: 3.1 }
  },

  // 3. CMF & Insolvencias
  {
    code: 'CMF_INSOLVENCIAS',
    name: 'Procedimientos Concursales & Quiebras',
    endpoint: 'GET /api/v1/data/companies/insolvencies',
    category: 'cmf_risk',
    value: 'Normal (12 activos)',
    unit: 'Registros CMF',
    change: 'Estable',
    isPositive: true,
    provider: 'CMF / Boletín Concursal',
    updated_at: '2026-07-26T23:59:00Z',
    description: 'Radar de riesgo de insolvencias y reorganizaciones judiciales de empresas.',
    json_sample: { total_active_cases: 12, latest_cases: [] }
  },
  {
    code: 'RUT_CHECK',
    name: 'Verificación Concursal por RUT',
    endpoint: 'GET /api/v1/data/companies/:rut/insolvency-status',
    category: 'cmf_risk',
    value: 'Sin Riesgo',
    unit: 'Auditado CMF',
    change: 'OK',
    isPositive: true,
    provider: 'CMF Forense',
    updated_at: '2026-07-27T10:00:00Z',
    description: 'Chequeo instantáneo de procedimientos de quiebras por RUT de contraparte.',
    json_sample: { rut: '76.123.456-K', status: 'clean', active_cases_count: 0 }
  },
  {
    code: 'COMPANY_360',
    name: 'Perfil Económico Unificado RUT',
    endpoint: 'GET /api/v1/data/companies/:rut/economic-profile',
    category: 'cmf_risk',
    value: '88/100 Score',
    unit: 'Salud Financiera',
    change: 'Alta Solvencia',
    isPositive: true,
    provider: 'Animus Unified DB',
    updated_at: '2026-07-27T12:00:00Z',
    description: 'Fusión 360° de estados financieros CMF, legal Diario Oficial y Mercado Público.',
    json_sample: { rut: '76.123.456-K', financial_health_score: 88, insolvency_risk: 'LOW' }
  },

  // 4. INE Laboral
  {
    code: 'DESEMPLEO_INE',
    name: 'Tasa de Desocupación Nacional',
    endpoint: 'GET /api/v1/data/labor/unemployment',
    category: 'labor',
    value: 8.3,
    unit: '% trimestre móvil',
    change: '-0.20%',
    isPositive: true,
    provider: 'Instituto Nacional de Estadísticas (INE)',
    updated_at: '2026-07-01T00:00:00Z',
    description: 'Tasa oficial de desempleo nacional y desglose por regiones.',
    json_sample: { unemployment_rate_national: 8.3, period: '2026-Q2' }
  },
  {
    code: 'SALARIOS_IR',
    name: 'Índice de Remuneraciones Reales',
    endpoint: 'GET /api/v1/data/labor/wages',
    category: 'labor',
    value: 6.8,
    unit: '% YoY Real',
    change: '+0.40%',
    isPositive: true,
    provider: 'INE Chile',
    updated_at: '2026-07-05T00:00:00Z',
    description: 'Reajustabilidad real del sueldo y costo de la mano de obra (ICMO +10.9%).',
    json_sample: { ir_real_yoy: 6.8, icmo_yoy: 10.9 }
  },

  // 5. Proyectos & Diario Oficial
  {
    code: 'SEIA_CAPEX',
    name: 'Proyectos de Inversión SEIA',
    endpoint: 'GET /api/v1/data/investment-projects',
    category: 'projects',
    value: '$14.500M',
    unit: 'USD CapEx',
    change: '+340 Proyectos',
    isPositive: true,
    provider: 'SEIA / SEA Chile',
    updated_at: '2026-07-20T00:00:00Z',
    description: 'Pipeline de inversiones mineras y energéticas en evaluación ambiental.',
    json_sample: { total_projects: 340, pipeline_capex_usd: 14500000000 }
  },
  {
    code: 'DO_CONSTITUCIONES',
    name: 'Nuevas Sociedades Diario Oficial',
    endpoint: 'GET /api/v1/data/company-events/constitutions',
    category: 'projects',
    value: '1.420',
    unit: 'Empresas/Mes',
    change: '+12% MoM',
    isPositive: true,
    provider: 'Diario Oficial de Chile',
    updated_at: '2026-07-26T00:00:00Z',
    description: 'Monitor de nuevas constituciones, aumentos de capital y disoluciones societarias.',
    json_sample: { constitutions_this_month: 1420 }
  },

  // 6. AI Insights & Analítica
  {
    code: 'MACRO_SIMULATION',
    name: 'Simulación de Escenarios IA',
    endpoint: 'POST /api/v1/data/insights/scenario-analysis',
    category: 'ai_insights',
    value: 'Modelo Doctrina v1',
    unit: 'IA Generativa',
    change: '84% Confianza',
    isPositive: true,
    provider: 'Animus MoE AI Engine',
    updated_at: '2026-07-27T16:00:00Z',
    description: 'Evaluación del impacto en PIB e Inflación ante cambios en Cobre/Dólar/TPM.',
    json_sample: { simulated_impacts: { imacec_growth_adjusted: '+0.9%', inflation_impact: '+0.6%' } }
  },
  {
    code: 'CORRELATIONS',
    name: 'Matriz Correlación Macroeconómica',
    endpoint: 'GET /api/v1/data/analytics/correlations',
    category: 'ai_insights',
    value: '-0.84 Cobre/USD',
    unit: 'Coef. Pearson',
    change: 'En tiempo real',
    isPositive: true,
    provider: 'Animus Analytics',
    updated_at: '2026-07-27T16:00:00Z',
    description: 'Correlaciones dinámicas cruzadas entre Cobre, Dólar, TPM y UF.',
    json_sample: { correlation_matrix: { "COPPER_vs_USDCLP": -0.84, "USDCLP_vs_UF": 0.62 } }
  }
];

export function EconomyLiveExplorer() {
  const [indicators] = useState<EconomicIndicator[]>(DEMO_INDICATORS);
  const [activeCategory, setActiveCategory] = useState<'all' | 'local_macro' | 'global_macro' | 'cmf_risk' | 'labor' | 'projects' | 'ai_insights'>('all');
  const [loading, setLoading] = useState(false);
  const [selectedIndicator, setSelectedIndicator] = useState<EconomicIndicator | null>(null);

  const fetchLiveEconomy = async () => {
    setLoading(true);
    try {
      await fetch(`${BASE}/data/economy/chile/snapshot`, {
        headers: { 'Authorization': 'Bearer demo_public_key' }
      });
    } catch {
      // Keep demo data
    } finally {
      setLoading(false);
    }
  };

  const filtered = indicators.filter(ind => activeCategory === 'all' || ind.category === activeCategory);

  return (
    <div style={{ background: '#0B0B16', border: '1px solid rgba(45,212,191,0.22)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 12px 36px rgba(0,0,0,0.4)' }}>
      {/* Banner */}
      <div style={{ padding: '24px 28px', background: 'linear-gradient(135deg, rgba(45,212,191,0.08) 0%, rgba(139,92,246,0.04) 100%)', borderBottom: '1px solid rgba(45,212,191,0.14)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 10, background: 'rgba(45,212,191,0.15)', color: '#2DD4BF' }}>
                <TrendingUp style={{ width: 18, height: 18 }} />
              </span>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: '#E8E7F5', margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
                Explorador en Vivo — Datos Económicos &amp; Macroeconómicos v2.0
              </h3>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.3)', color: '#2DD4BF' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2DD4BF', animation: 'pulse 2s infinite' }} /> Estructura por Dominios (33 Endpoints)
              </span>
            </div>
            <p style={{ fontSize: 13.5, color: '#9896B8', maxWidth: 780, margin: 0, lineHeight: 1.6 }}>
              Visualiza en tiempo real los indicadores locales (BCCh, CMF, INE) y globales (FRED, yFinance) mapeados directamente a la nueva API Canónica por Dominios (`/api/v1/data/*`).
            </p>
          </div>
          <button 
            onClick={fetchLiveEconomy}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(45,212,191,0.15)', border: '1px solid rgba(45,212,191,0.3)', color: '#5EEAD4', padding: '9px 16px', borderRadius: 12, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            <RefreshCw style={{ width: 14, height: 14, animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refrescar Indicadores
          </button>
        </div>

        {/* Categories Selector by Domain */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>
          {[
            { id: 'all', label: 'Todos los Dominios (18 Vistas)', icon: Layers },
            { id: 'local_macro', label: 'BCCh (UF, TPM, IPC, Imacec)', icon: TrendingUp },
            { id: 'global_macro', label: 'FRED (Cobre, Litio, WTI, Fed Rate)', icon: DollarSign },
            { id: 'cmf_risk', label: 'CMF & Insolvencias RUT', icon: ShieldAlert },
            { id: 'labor', label: 'INE Mercado Laboral', icon: Users },
            { id: 'projects', label: 'SEIA CapEx & Diario Oficial', icon: Database },
            { id: 'ai_insights', label: 'IA Insights & Escenarios', icon: Sparkles }
          ].map(c => {
            const Icon = c.icon;
            const isActive = activeCategory === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id as any)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  background: isActive ? '#2DD4BF' : '#05050C',
                  color: isActive ? '#000' : '#8B89B0',
                  transition: 'all 0.15s'
                }}
              >
                <Icon style={{ width: 14, height: 14, color: isActive ? '#000' : '#2DD4BF' }} />
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Key Indicator Cards */}
      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {filtered.map((ind) => (
          <div
            key={ind.code}
            style={{
              background: '#070712', border: '1px solid rgba(45,212,191,0.14)', borderRadius: 16, padding: 20,
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14,
              transition: 'all 0.2s'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: 'rgba(45,212,191,0.12)', color: '#2DD4BF', fontFamily: 'monospace' }}>
                  {ind.code}
                </span>
                <span style={{ fontSize: 11, color: ind.isPositive ? '#4ADE80' : '#F87171', fontWeight: 700 }}>
                  {ind.change}
                </span>
              </div>
              
              <h4 style={{ fontSize: 14.5, fontWeight: 800, color: '#E8E7F5', margin: '0 0 4px', lineHeight: 1.4 }}>{ind.name}</h4>
              <div style={{ fontSize: 10.5, color: '#2DD4BF', fontFamily: 'monospace', fontWeight: 700, marginBottom: 8 }}>
                {ind.endpoint}
              </div>
              <p style={{ fontSize: 11.5, color: '#7674A0', margin: 0, lineHeight: 1.5 }}>{ind.description}</p>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: '#2DD4BF', fontFamily: "'Space Grotesk', monospace" }}>
                  {typeof ind.value === 'number' ? ind.value.toLocaleString('es-CL') : ind.value}
                </span>
                <span style={{ fontSize: 11, color: '#9896B8', fontWeight: 600 }}>{ind.unit}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: 10.5, color: '#5A5A78' }}>Fuente: {ind.provider.split('(')[0]}</span>
                <button
                  onClick={() => setSelectedIndicator(ind)}
                  style={{ background: 'rgba(45,212,191,0.1)', border: 'none', color: '#2DD4BF', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Code2 style={{ width: 12, height: 12 }} /> JSON API
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal detail */}
      {selectedIndicator && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#0E0E1B', border: '1px solid rgba(45,212,191,0.35)', borderRadius: 20, width: '100%', maxWidth: 640, padding: 28, boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#2DD4BF', fontFamily: 'monospace' }}>{selectedIndicator.endpoint}</span>
                <h4 style={{ fontSize: 18, fontWeight: 800, color: '#E8E7F5', margin: '4px 0 0' }}>{selectedIndicator.name} ({selectedIndicator.code})</h4>
              </div>
              <button onClick={() => setSelectedIndicator(null)} style={{ background: 'none', border: 'none', color: '#7674A0', fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>

            <pre style={{ background: '#030309', border: '1px solid rgba(45,212,191,0.2)', color: '#2DD4BF', fontSize: 11.5, borderRadius: 12, padding: 18, overflowX: 'auto', fontFamily: 'monospace', lineHeight: 1.6 }}>
              {JSON.stringify({
                data: selectedIndicator.json_sample,
                meta: {
                  source: { provider: selectedIndicator.provider, official: true },
                  retrieved_at: selectedIndicator.updated_at,
                  credits_used: 1
                }
              }, null, 2)}
            </pre>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setSelectedIndicator(null)} style={{ background: '#2DD4BF', border: 'none', color: '#000', padding: '9px 18px', borderRadius: 10, fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
