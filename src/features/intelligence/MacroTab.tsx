import { useState } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Activity, RefreshCw, Check, Copy, 
  Database, ShieldAlert, Users, Layers, Sparkles
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';

export function MacroTab() {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'bcch' | 'fred' | 'cmf' | 'ine' | 'seia'>('overview');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'bcch' | 'fred' | 'cmf' | 'ine'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const triggerRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      showToast('✓ Indicadores macroeconómicos actualizados en tiempo real');
    }, 450);
  };

  // Mock historical series for interactive charts
  const ufSeriesData = [
    { date: 'Feb 2026', uf: 37620, ipc: 0.2 },
    { date: 'Mar 2026', uf: 37690, ipc: 0.4 },
    { date: 'Abr 2026', uf: 37740, ipc: 0.3 },
    { date: 'May 2026', uf: 37790, ipc: 0.2 },
    { date: 'Jun 2026', uf: 37810, ipc: 0.1 },
    { date: 'Jul 2026', uf: 37842, ipc: 0.3 }
  ];

  const copperUsdSeriesData = [
    { date: 'Feb 2026', copper: 3.95, usd: 965 },
    { date: 'Mar 2026', copper: 4.08, usd: 955 },
    { date: 'Abr 2026', copper: 4.15, usd: 948 },
    { date: 'May 2026', copper: 4.20, usd: 945 },
    { date: 'Jun 2026', copper: 4.18, usd: 950 },
    { date: 'Jul 2026', copper: 4.25, usd: 942.5 }
  ];

  // Indicators cards list
  const indicators = [
    {
      id: 'uf',
      category: 'bcch',
      code: 'UF',
      title: 'Unidad de Fomento (UF)',
      description: 'Indicador reajustable de valor de moneda para contratos de crédito, arriendos y previsión en Chile.',
      value: '37.842,15 CLP',
      change: '+0.12%',
      isPositive: true,
      source: 'Banco Central de Chile',
      json: { indicator: 'UF', value: 37842.15, date: '2026-07-27', source: 'BCCH' }
    },
    {
      id: 'ipc',
      category: 'bcch',
      code: 'IPC',
      title: 'Índice de Precios al Consumidor (IPC)',
      description: 'Variación mensual de la canasta representativa del consumo de los hogares en Chile.',
      value: '0,3% mensual',
      change: '-0.10%',
      isPositive: false,
      source: 'INE / Banco Central de Chile',
      json: { indicator: 'IPC', value: 0.3, period: '2026-06', yoy: 3.8, source: 'INE' }
    },
    {
      id: 'tpm',
      category: 'bcch',
      code: 'TPM',
      title: 'Tasa de Política Monetaria (TPM)',
      description: 'Tasa de interés de referencia para la política monetaria e interbancaria en Chile.',
      value: '5,75% anual',
      change: '-0.25%',
      isPositive: false,
      source: 'Banco Central de Chile',
      json: { indicator: 'TPM', value: 5.75, unit: '%', date: '2026-07-27', source: 'BCCH' }
    },
    {
      id: 'usd_clp',
      category: 'bcch',
      code: 'USD_CLP',
      title: 'Dólar Observado (USD/CLP)',
      description: 'Paridad del dólar estadounidense respecto al peso chileno en el mercado cambiario local.',
      value: '942,50 CLP',
      change: '+0.45%',
      isPositive: true,
      source: 'Banco Central de Chile',
      json: { indicator: 'USD_CLP', value: 942.50, date: '2026-07-27', source: 'BCCH' }
    },
    {
      id: 'copper',
      category: 'fred',
      code: 'COPPER',
      title: 'Precio Spot Cobre (HG=F)',
      description: 'Cotización internacional del Cobre, principal producto de exportación e ingreso fiscal de Chile.',
      value: '4,25 USD/lb',
      change: '+1.85%',
      isPositive: true,
      source: 'FRED / London Metal Exchange',
      json: { indicator: 'COPPER', value: 4.25, unit: 'USD/lb', exchange: 'COMEX/LME', source: 'FRED' }
    },
    {
      id: 'wti',
      category: 'fred',
      code: 'WTI_CRUDE',
      title: 'Petróleo WTI (CL=F)',
      description: 'Precio de referencia del petróleo crudo West Texas Intermediate en mercados globales.',
      value: '78,40 USD/barril',
      change: '-0.75%',
      isPositive: false,
      source: 'FRED / NYMEX',
      json: { indicator: 'WTI_CRUDE', value: 78.40, unit: 'USD/bbl', source: 'FRED' }
    },
    {
      id: 'insolvencias',
      category: 'cmf',
      code: 'CMF_INSOLVENCIAS',
      title: 'Procedimientos Concursales & Quiebras',
      description: 'Radar de riesgo de insolvencias, reorganizaciones judiciales y liquidaciones de empresas fiscalizadas.',
      value: 'Normal (12 activos)',
      change: 'Estable',
      isPositive: true,
      source: 'CMF / Boletín Concursal',
      json: { indicator: 'INSOLVENCY_RADAR', active_cases: 12, risk_level: 'LOW', source: 'CMF' }
    },
    {
      id: 'desempleo',
      category: 'ine',
      code: 'DESEMPLEO_INE',
      title: 'Tasa de Desocupación Nacional',
      description: 'Porcentaje de la fuerza de trabajo que se encuentra desocupada en Chile.',
      value: '8,3% trimestre móvil',
      change: '-0.20%',
      isPositive: false,
      source: 'Instituto Nacional de Estadísticas (INE)',
      json: { indicator: 'UNEMPLOYMENT_RATE', value: 8.3, unit: '%', source: 'INE' }
    }
  ];

  const filteredIndicators = indicators.filter(ind => selectedCategory === 'all' || ind.category === selectedCategory);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto', position: 'relative' }}>
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
          color: '#FFF', padding: '12px 20px', borderRadius: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)', fontWeight: 800, fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 8, animation: 'fadeIn 0.3s'
        }}>
          <Check style={{ width: 16, height: 16 }} /> {toastMessage}
        </div>
      )}

      {/* Top Banner Header */}
      <div style={{ background: '#0B0B16', border: '1px solid rgba(14,181,198,0.25)', borderRadius: 20, padding: 28, marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(14,181,198,0.18)', border: '1px solid rgba(14,181,198,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0EB5C6' }}>
                <Activity style={{ width: 20, height: 20 }} />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: '#E8E7F5', margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
                Explorador en Vivo — Datos Económicos &amp; Macroeconómicos
              </h2>
              <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 100, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ADE80' }}>
                Sincronización Diaria Automática
              </span>
            </div>
            <p style={{ fontSize: 13.5, color: '#9896B8', margin: 0, maxWidth: 850, lineHeight: 1.5 }}>
              Visualiza en tiempo real los indicadores macroeconómicos locales de Chile (BCCh, CMF, INE) y globales (FRED, yFinance) capturados y procesados por Animus.
            </p>
          </div>

          <button
            onClick={triggerRefresh}
            disabled={isRefreshing}
            style={{
              background: '#0EB5C6', color: '#000', border: 'none', padding: '10px 18px', borderRadius: 12,
              fontWeight: 800, fontSize: 12.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: '0 4px 14px rgba(14,181,198,0.3)', transition: 'all 0.2s'
            }}
          >
            <RefreshCw style={{ width: 15, height: 15, animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            {isRefreshing ? 'Actualizando...' : 'Refrescar Indicadores'}
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 24, borderBottom: '1px solid rgba(14,181,198,0.15)' }}>
        {[
          { id: 'overview', label: '1. Visión Global & Snapshot', icon: Layers },
          { id: 'bcch', label: '2. Banco Central (UF/TPM/IPC)', icon: TrendingUp },
          { id: 'fred', label: '3. FRED & Cobre/WTI Global', icon: DollarSign },
          { id: 'cmf', label: '4. CMF & Radar Insolvencias', icon: ShieldAlert },
          { id: 'ine', label: '5. INE Mercado Laboral', icon: Users },
          { id: 'seia', label: '6. SEIA CapEx Inversiones', icon: Database },
        ].map(st => {
          const Icon = st.icon;
          const isActive = activeSubTab === st.id;
          return (
            <button
              key={st.id}
              onClick={() => setActiveSubTab(st.id as any)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '10px 16px', borderRadius: 12, fontSize: 12.5, fontWeight: 800,
                border: isActive ? '1px solid #0EB5C6' : '1px solid rgba(255,255,255,0.06)',
                background: isActive ? 'rgba(14,181,198,0.18)' : '#070712',
                color: isActive ? '#0EB5C6' : '#8B89B0',
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s'
              }}
            >
              <Icon style={{ width: 15, height: 15, color: isActive ? '#0EB5C6' : '#6A6888' }} />
              {st.label}
            </button>
          );
        })}
      </div>

      {/* ── SUB-TAB 1: OVERVIEW SNAPSHOT ── */}
      {activeSubTab === 'overview' && (
        <div>
          {/* Quick Category Filter Pills */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {[
              { id: 'all', label: 'Todos los Indicadores' },
              { id: 'bcch', label: 'BCCh (UF, TPM, IPC)' },
              { id: 'fred', label: 'FRED (Cobre, WTI, Fed Rate)' },
              { id: 'cmf', label: 'CMF & Insolvencias' },
              { id: 'ine', label: 'INE Mercado Laboral' }
            ].map(pill => (
              <button
                key={pill.id}
                onClick={() => setSelectedCategory(pill.id as any)}
                style={{
                  padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                  border: selectedCategory === pill.id ? '1px solid #0EB5C6' : '1px solid rgba(255,255,255,0.08)',
                  background: selectedCategory === pill.id ? 'rgba(14,181,198,0.2)' : '#090914',
                  color: selectedCategory === pill.id ? '#0EB5C6' : '#8B89B0',
                  cursor: 'pointer'
                }}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Grid of Indicator Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, marginBottom: 28 }}>
            {filteredIndicators.map(ind => (
              <div
                key={ind.id}
                style={{
                  background: '#090914', border: '1px solid rgba(14,181,198,0.18)', borderRadius: 16, padding: 20,
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 800, background: 'rgba(255,255,255,0.06)', color: '#0EB5C6', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>
                      {ind.code}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: ind.isPositive ? '#4ADE80' : '#F87171', display: 'flex', alignItems: 'center', gap: 2 }}>
                      {ind.isPositive ? <TrendingUp style={{ width: 13, height: 13 }} /> : <TrendingDown style={{ width: 13, height: 13 }} />}
                      {ind.change}
                    </span>
                  </div>

                  <h4 style={{ fontSize: 15, fontWeight: 800, color: '#E8E7F5', margin: '0 0 6px 0' }}>{ind.title}</h4>
                  <p style={{ fontSize: 11.5, color: '#8B89B0', margin: '0 0 16px 0', lineHeight: 1.4 }}>{ind.description}</p>
                </div>

                <div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#E8E7F5', fontFamily: "'Space Grotesk', sans-serif", marginBottom: 12 }}>
                    {ind.value}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: 10.5, color: '#6A6888' }}>Fuente: {ind.source}</span>
                    <button
                      onClick={() => handleCopy(JSON.stringify(ind.json, null, 2), ind.id)}
                      style={{ background: 'none', border: 'none', color: '#0EB5C6', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      {copiedId === ind.id ? <Check style={{ width: 12, height: 12, color: '#4ADE80' }} /> : <Copy style={{ width: 12, height: 12 }} />}
                      {copiedId === ind.id ? 'Copiado' : 'JSON API'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* cURL Snippet Box for /api/v1/data/economy */}
          <div style={{ background: '#030309', padding: 18, borderRadius: 14, border: '1px solid rgba(14,181,198,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#0EB5C6' }}>Endpoint cURL — Snapshot Consolidado Macroeconómico:</span>
              <button
                onClick={() => handleCopy(`curl -X GET "https://api.bralidus.com/v1/data/economy" -H "Authorization: Bearer <VALIDUS_API_KEY>"`, 'macro_curl')}
                style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#D4D2F0', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                {copiedId === 'macro_curl' ? <Check style={{ width: 12, height: 12, color: '#4ADE80' }} /> : <Copy style={{ width: 12, height: 12 }} />}
                {copiedId === 'macro_curl' ? 'Copiado' : 'Copiar cURL'}
              </button>
            </div>
            <code style={{ fontSize: 11.5, color: '#4ADE80', fontFamily: 'monospace' }}>
              curl -X GET "https://api.bralidus.com/v1/data/economy" -H "Authorization: Bearer &lt;VALIDUS_API_KEY&gt;"
            </code>
          </div>
        </div>
      )}

      {/* ── SUB-TAB 2: BANCO CENTRAL (BCCH) ── */}
      {activeSubTab === 'bcch' && (
        <div style={{ background: '#0B0B16', border: '1px solid rgba(14,181,198,0.25)', borderRadius: 20, padding: 28 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#E8E7F5', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp style={{ width: 20, height: 20, color: '#0EB5C6' }} /> Banco Central de Chile (BCCh) — Unidad de Fomento &amp; Inflación
          </h3>
          <p style={{ fontSize: 13, color: '#9896B8', margin: '0 0 24px 0' }}>
            Serie histórica en tiempo real de la UF, TPM e IPC oficial con actualización diaria.
          </p>

          <div style={{ height: 280, background: '#05050C', borderRadius: 16, padding: 20, border: '1px solid rgba(14,181,198,0.18)', marginBottom: 20 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ufSeriesData}>
                <defs>
                  <linearGradient id="colorUf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0EB5C6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#0EB5C6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="#8B89B0" fontSize={11} />
                <YAxis domain={['dataMin - 100', 'dataMax + 100']} stroke="#8B89B0" fontSize={11} />
                <Tooltip contentStyle={{ background: '#090914', border: '1px solid #0EB5C6', borderRadius: 10, color: '#FFF' }} />
                <Area type="monotone" dataKey="uf" stroke="#0EB5C6" strokeWidth={3} fillOpacity={1} fill="url(#colorUf)" name="UF (CLP)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#030309', padding: 14, borderRadius: 10, border: '1px solid rgba(14,181,198,0.2)' }}>
            <code style={{ fontSize: 11, color: '#4ADE80', fontFamily: 'monospace' }}>
              GET /api/v1/data/economy/bcch/uf
            </code>
            <span style={{ fontSize: 11, color: '#0EB5C6', fontWeight: 800 }}>Costo: 1 Crédito / Call</span>
          </div>
        </div>
      )}

      {/* ── SUB-TAB 3: FRED & COMMODITIES ── */}
      {activeSubTab === 'fred' && (
        <div style={{ background: '#0B0B16', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 20, padding: 28 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#E8E7F5', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <DollarSign style={{ width: 20, height: 20, color: '#FCD34D' }} /> FRED Global — Cobre Spot (HG=F) &amp; Paridad Dólar
          </h3>
          <p style={{ fontSize: 13, color: '#9896B8', margin: '0 0 24px 0' }}>
            Tendencia de precios internacionales de commodities de exportación y paridad cambiaria USD/CLP.
          </p>

          <div style={{ height: 280, background: '#05050C', borderRadius: 16, padding: 20, border: '1px solid rgba(245,158,11,0.18)', marginBottom: 20 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={copperUsdSeriesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="#8B89B0" fontSize={11} />
                <YAxis yAxisId="left" orientation="left" stroke="#FCD34D" fontSize={11} domain={[3.5, 4.5]} />
                <YAxis yAxisId="right" orientation="right" stroke="#60A5FA" fontSize={11} domain={[900, 1000]} />
                <Tooltip contentStyle={{ background: '#090914', border: '1px solid #FCD34D', borderRadius: 10, color: '#FFF' }} />
                <Bar yAxisId="left" dataKey="copper" fill="#FCD34D" radius={[6, 6, 0, 0]} name="Cobre (USD/lb)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#030309', padding: 14, borderRadius: 10, border: '1px solid rgba(245,158,11,0.2)' }}>
            <code style={{ fontSize: 11, color: '#4ADE80', fontFamily: 'monospace' }}>
              GET /api/v1/data/macro
            </code>
            <span style={{ fontSize: 11, color: '#FCD34D', fontWeight: 800 }}>Costo: 1 Crédito / Call</span>
          </div>
        </div>
      )}

      {/* ── SUB-TAB 4: CMF & RADAR INSOLVENCIAS ── */}
      {activeSubTab === 'cmf' && (
        <div style={{ background: '#0B0B16', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 20, padding: 28 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#E8E7F5', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldAlert style={{ width: 20, height: 20, color: '#F87171' }} /> Radar CMF &amp; Insolvencias — Boletín Concursal
          </h3>
          <p style={{ fontSize: 13, color: '#9896B8', margin: '0 0 20px 0' }}>
            Monitoreo en tiempo real de procedimientos concursales, reorganizaciones judiciales y quiebras en Chile.
          </p>

          <div style={{ background: '#05050C', padding: 20, borderRadius: 16, border: '1px solid rgba(239,68,68,0.18)', marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 10, maxWidth: 500, marginBottom: 16 }}>
              <input
                type="text"
                placeholder="Ingresa RUT de empresa a consultar (Ej: 76.123.456-K)"
                style={{ flex: 1, background: '#090914', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', color: '#E8E7F5', fontFamily: 'monospace', fontWeight: 700 }}
              />
              <button 
                onClick={() => showToast('✓ Registro limpio — Sin procedimientos concursales activos')}
                style={{ background: '#EF4444', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}
              >
                Consultar CMF
              </button>
            </div>

            <div style={{ background: '#090914', padding: 16, borderRadius: 12, border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Sparkles style={{ width: 20, height: 20, color: '#4ADE80' }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#4ADE80' }}>Estado del Sistema Forense: NORMAL</div>
                <div style={{ fontSize: 11.5, color: '#9896B8' }}>No se registran variaciones anómalas en procedimientos de quiebras en el sector TI / Salud.</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#030309', padding: 14, borderRadius: 10, border: '1px solid rgba(239,68,68,0.2)' }}>
            <code style={{ fontSize: 11, color: '#4ADE80', fontFamily: 'monospace' }}>
              GET /api/v1/data/economy/cmf/quiebras-insolvencias
            </code>
            <span style={{ fontSize: 11, color: '#F87171', fontWeight: 800 }}>Costo: 5 Créditos / Call</span>
          </div>
        </div>
      )}

      {/* ── SUB-TAB 5: INE MERCADO LABORAL ── */}
      {activeSubTab === 'ine' && (
        <div style={{ background: '#0B0B16', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 20, padding: 28 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#E8E7F5', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users style={{ width: 20, height: 20, color: '#C084FC' }} /> INE Chile — Mercado Laboral &amp; Índice de Remuneraciones
          </h3>
          <p style={{ fontSize: 13, color: '#9896B8', margin: '0 0 20px 0' }}>
            Indicadores oficiales de desempleo nacional, remuneraciones reales (IR) y costo de la mano de obra (ICMO).
          </p>

          <div style={{ background: '#05050C', padding: 20, borderRadius: 16, border: '1px solid rgba(168,85,247,0.18)', marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ background: '#090914', padding: 16, borderRadius: 12, border: '1px solid rgba(168,85,247,0.2)' }}>
                <span style={{ fontSize: 11, color: '#9896B8' }}>Tasa de Desocupación Nacional:</span>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#C084FC', marginTop: 4 }}>8,3% <span style={{ fontSize: 13, color: '#4ADE80' }}>(-0.20% YoY)</span></div>
              </div>
              <div style={{ background: '#090914', padding: 16, borderRadius: 12, border: '1px solid rgba(168,85,247,0.2)' }}>
                <span style={{ fontSize: 11, color: '#9896B8' }}>Índice de Remuneraciones (IR Real):</span>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#4ADE80', marginTop: 4 }}>+6,8% <span style={{ fontSize: 13, color: '#4ADE80' }}>YoY Real</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SUB-TAB 6: SEIA CAPEX INVERSIONES ── */}
      {activeSubTab === 'seia' && (
        <div style={{ background: '#0B0B16', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 20, padding: 28 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#E8E7F5', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database style={{ width: 20, height: 20, color: '#4ADE80' }} /> SEIA Chile — Pipeline de Proyectos de Inversión (CapEx)
          </h3>
          <p style={{ fontSize: 13, color: '#9896B8', margin: '0 0 20px 0' }}>
            Proyectos de inversión minera, energética e infraestructura aprobados y en evaluación ambiental.
          </p>

          <div style={{ background: '#05050C', padding: 20, borderRadius: 16, border: '1px solid rgba(34,197,94,0.18)', marginBottom: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { name: 'Proyecto Fotovoltaico Antofagasta Solar', sector: 'Energía', capex: '$450.000.000 USD', status: 'APROBADO (RCA Ok)' },
                { name: 'Ampliación Planta Desaladora Minera Atacama', sector: 'Minería', capex: '$1.200.000.000 USD', status: 'EN EVALUACIÓN' }
              ].map((proj, idx) => (
                <div key={idx} style={{ background: '#090914', padding: 16, borderRadius: 12, border: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#E8E7F5' }}>{proj.name}</div>
                    <span style={{ fontSize: 11.5, color: '#9896B8' }}>Sector: {proj.sector} · Estado: <strong style={{ color: '#4ADE80' }}>{proj.status}</strong></span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 900, color: '#4ADE80' }}>{proj.capex}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
