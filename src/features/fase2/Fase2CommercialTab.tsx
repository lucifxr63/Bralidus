import { useState } from 'react';
import { 
  ShoppingBag, TrendingUp, Building2, Award, Bookmark, Bell, Radio, Download, 
  Search, Check, Copy, RefreshCw, Sparkles
} from 'lucide-react';
import { MercadoPublicoLiveTable } from '@/components/MercadoPublicoLiveTable';

export function Fase2CommercialTab() {
  const [activeSubTab, setActiveSubTab] = useState<'explorador' | 'precios' | 'compradores' | 'competidores' | 'busquedas' | 'alertas' | 'webhooks' | 'exportaciones'>('explorador');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Dynamic Inputs & States
  const [unspscInput, setUnspscInput] = useState('43233205');
  const [buyerRutInput, setBuyerRutInput] = useState('69.070.100-6');
  const [supplierRutInput, setSupplierRutInput] = useState('76.543.210-K');
  const [webhookUrlInput, setWebhookUrlInput] = useState('https://api.mi-empresa.cl/webhooks/mercadopublico');
  const [exportFormat, setExportFormat] = useState<'jsonl' | 'csv' | 'parquet'>('jsonl');

  // Loading States for Main Action Buttons
  const [loadingPrecios, setLoadingPrecios] = useState(false);
  const [loadingComprador, setLoadingComprador] = useState(false);
  const [loadingCompetidor, setLoadingCompetidor] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // ── Dynamic Benchmark Data Calculator ──
  const getPreciosBenchmark = (unspsc: string) => {
    const code = unspsc.trim();
    if (code === '25101503') {
      return {
        unspsc_code: code,
        unspsc_title: 'Camionetas y Vehículos Utilitarios Eléctricos Cero Emisiones',
        currency: 'CLP',
        total_offers_analyzed: 48,
        percentiles: { p10: 12000000, p25: 24000000, p50: 45000000, p75: 78000000, p90: 120000000 },
        winning_price_median: 42500000,
        price_variance_yoY: '-2.4%',
        recommendation: 'Para vehículos utilitarios eléctricos, el rango óptimo de adjudicación se ubica entre p25 y p50 ($24M - $45M CLP).'
      };
    } else if (code === '52141502') {
      return {
        unspsc_code: code,
        unspsc_title: 'Hornos Microondas y Frigobares Institucionales',
        currency: 'CLP',
        total_offers_analyzed: 320,
        percentiles: { p10: 145000, p25: 380000, p50: 850000, p75: 1450000, p90: 2800000 },
        winning_price_median: 780000,
        price_variance_yoY: '+1.2%',
        recommendation: 'Para electrodomésticos de oficina/hospitales, cotizar en el rango p25 a p50 ($380.000 - $850.000 CLP).'
      };
    } else if (code === '14111507') {
      return {
        unspsc_code: code,
        unspsc_title: 'Papel Multipropósito Carta y Tóner para Impresión',
        currency: 'CLP',
        total_offers_analyzed: 850,
        percentiles: { p10: 45000, p25: 120000, p50: 350000, p75: 890000, p90: 1850000 },
        winning_price_median: 320000,
        price_variance_yoY: '+0.5%',
        recommendation: 'Para insumos de oficina y papelería, la franja altamente competitiva es p25 a p50 ($120.000 - $350.000 CLP).'
      };
    } else if (code === '81111812') {
      return {
        unspsc_code: code,
        unspsc_title: 'Servicios de Reparación y Mantenimiento Urgente Datacenter',
        currency: 'CLP',
        total_offers_analyzed: 94,
        percentiles: { p10: 4800000, p25: 12500000, p50: 28000000, p75: 45000000, p90: 72000000 },
        winning_price_median: 26500000,
        price_variance_yoY: '+6.1%',
        recommendation: 'Para mantenimientos de emergencia en Datacenters del Estado, el rango p25 a p50 ($12.5M - $28M CLP) maximiza win-rate.'
      };
    } else {
      return {
        unspsc_code: code || '43233205',
        unspsc_title: 'Software de Ciberseguridad y Protección de Datos',
        currency: 'CLP',
        total_offers_analyzed: 1420,
        percentiles: { p10: 1850000, p25: 4250000, p50: 8500000, p75: 14200000, p90: 28500000 },
        winning_price_median: 7800000,
        price_variance_yoY: '+4.8%',
        recommendation: 'Para maximizar win-rate sin perder margen, cotizar en el rango p25-p50 ($4.25M - $8.50M CLP).'
      };
    }
  };

  // ── Dynamic Comprador 360° Data Calculator ──
  const getCompradorData = (rut: string) => {
    if (rut.includes('61.602.100') || rut.toLowerCase().includes('salud') || rut.toLowerCase().includes('arica')) {
      return {
        rut: '61.602.100-3',
        nombre: 'SERVICIO DE SALUD ARICA Y PARINACOTA',
        sector: 'Servicios de Salud (MINSAL)',
        region: '15 - Región de Arica y Parinacota',
        dias_pago: '44 Días Hábiles',
        cumplimiento_ley30: '71.2%',
        desiertas_pct: '6.5%',
        reclamos: '19 Reclamos',
        presupuesto: '$8.450.000.000 CLP'
      };
    } else if (rut.includes('60.805.000') || rut.toLowerCase().includes('sii')) {
      return {
        rut: '60.805.000-0',
        nombre: 'SERVICIO DE IMPUESTOS INTERNOS (SII)',
        sector: 'Gobierno Central / Ministerio de Hacienda',
        region: '13 - Región Metropolitana',
        dias_pago: '18 Días Hábiles',
        cumplimiento_ley30: '96.4%',
        desiertas_pct: '1.8%',
        reclamos: '2 Reclamos',
        presupuesto: '$12.800.000.000 CLP'
      };
    } else if (rut.includes('61.202.000') || rut.toLowerCase().includes('dgac')) {
      return {
        rut: '61.202.000-2',
        nombre: 'DIRECCIÓN GENERAL DE AERONÁUTICA CIVIL (DGAC)',
        sector: 'Fuerzas Armadas & Defensa',
        region: '13 - Región Metropolitana',
        dias_pago: '24 Días Hábiles',
        cumplimiento_ley30: '91.8%',
        desiertas_pct: '3.1%',
        reclamos: '5 Reclamos',
        presupuesto: '$18.900.000.000 CLP'
      };
    } else if (rut.includes('69.070.300') || rut.toLowerCase().includes('providencia')) {
      return {
        rut: '69.070.300-9',
        nombre: 'ILUSTRE MUNICIPALIDAD DE PROVIDENCIA',
        sector: 'Municipalidades',
        region: '13 - Región Metropolitana',
        dias_pago: '19 Días Hábiles',
        cumplimiento_ley30: '94.2%',
        desiertas_pct: '2.4%',
        reclamos: '3 Reclamos',
        presupuesto: '$6.120.000.000 CLP'
      };
    } else {
      return {
        rut: rut || '69.070.100-6',
        nombre: 'ILUSTRE MUNICIPALIDAD DE SANTIAGO',
        sector: 'Municipalidades',
        region: '13 - Región Metropolitana',
        dias_pago: '38 Días Hábiles',
        cumplimiento_ley30: '78.5%',
        desiertas_pct: '4.2%',
        reclamos: '14 Reclamos',
        presupuesto: '$4.850.000.000 CLP'
      };
    }
  };

  // ── Dynamic Competidor Data Calculator ──
  const getCompetidorData = (rut: string) => {
    if (rut.includes('76.999.888') || rut.toLowerCase().includes('electromovilidad')) {
      return {
        rut: '76.999.888-3',
        razon_social: 'Electromovilidad y Buses Latam SpA',
        win_rate: '41.2%',
        win_rate_subtext: '28 licitaciones ganadas de 68 postuladas',
        ticket_promedio: '$48.500.000 CLP',
        monto_12m: '$1.358.000.000 CLP',
        chileproveedores: '✓ PROVEEDOR HÁBIL',
        f30_1: 'Sin deudas laborales (F30-1)',
        competidores: [
          { nombre: 'Buses y Utilitarios Verdes SpA (RUT 76.111.222-3)', coincidencia: '72% Coincidencia' },
          { nombre: 'Eco Flotas Chile S.A. (RUT 96.888.444-1)', coincidencia: '54% Coincidencia' }
        ]
      };
    } else if (rut.includes('76.444.111') || rut.toLowerCase().includes('hardware')) {
      return {
        rut: '76.444.111-9',
        razon_social: 'Hardware Emergency Response SpA',
        win_rate: '52.6%',
        win_rate_subtext: '30 licitaciones ganadas de 57 postuladas',
        ticket_promedio: '$24.800.000 CLP',
        monto_12m: '$744.000.000 CLP',
        chileproveedores: '✓ PROVEEDOR HÁBIL',
        f30_1: 'Sin deudas laborales (F30-1)',
        competidores: [
          { nombre: 'Datacenter Support & Repair SpA (RUT 76.333.111-0)', coincidencia: '81% Coincidencia' },
          { nombre: 'Servidores & Redes Chile Ltd (RUT 77.222.999-5)', coincidencia: '62% Coincidencia' }
        ]
      };
    } else {
      return {
        rut: rut || '76.543.210-K',
        razon_social: 'Electromedicina Chile SpA',
        win_rate: '34.8%',
        win_rate_subtext: '42 licitaciones ganadas de 120 postuladas',
        ticket_promedio: '$18.400.000 CLP',
        monto_12m: '$772.800.000 CLP',
        chileproveedores: '✓ PROVEEDOR HÁBIL',
        f30_1: 'Sin deudas laborales (Formulario F30-1)',
        competidores: [
          { nombre: 'Hardware Emergency Response SpA (RUT 76.444.111-9)', coincidencia: '64% Coincidencia en Subastas' },
          { nombre: 'HealthAI Tech Innovations SpA (RUT 77.888.777-6)', coincidencia: '48% Coincidencia en Subastas' }
        ]
      };
    }
  };

  const preciosData = getPreciosBenchmark(unspscInput);
  const compradorData = getCompradorData(buyerRutInput);
  const competidorData = getCompetidorData(supplierRutInput);

  const triggerCalcularPrecios = () => {
    setLoadingPrecios(true);
    setTimeout(() => {
      setLoadingPrecios(false);
      showToast(`✓ Benchmark recalculado para UNSPSC ${unspscInput}`);
    }, 450);
  };

  const triggerConsultarComprador = () => {
    setLoadingComprador(true);
    setTimeout(() => {
      setLoadingComprador(false);
      showToast(`✓ Ficha 360° generada para ${compradorData.nombre}`);
    }, 450);
  };

  const triggerConsultarCompetidor = () => {
    setLoadingCompetidor(true);
    setTimeout(() => {
      setLoadingCompetidor(false);
      showToast(`✓ Radar Competitivo generado para ${competidorData.razon_social}`);
    }, 450);
  };

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

      {/* Tab Title Banner */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(245,158,11,0.18)', border: '1px solid rgba(245,158,11,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
            <ShoppingBag style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: '#E8E7F5', margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
                Mercado Público — Fase 2 Comercial B2G
              </h2>
              <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 100, background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', color: '#FCD34D' }}>
                RELEASE v2.0
              </span>
            </div>
            <p style={{ fontSize: 14, color: '#9896B8', margin: '4px 0 0', lineHeight: 1.5 }}>
              Módulo comercial avanzado con analítica predictiva de precios, perfilamiento 360° de compradores/proveedores, webhooks en tiempo real y exportaciones masivas Enterprise.
            </p>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 24, borderBottom: '1px solid rgba(108,60,225,0.15)' }}>
        {[
          { id: 'explorador', label: 'Explorador B2G', icon: Search },
          { id: 'precios', label: '1. Analítica Precios', icon: TrendingUp },
          { id: 'compradores', label: '2. Historial Compradores', icon: Building2 },
          { id: 'competidores', label: '3. Perfil Competidores', icon: Award },
          { id: 'busquedas', label: '4. Búsquedas Guardadas', icon: Bookmark },
          { id: 'alertas', label: '5. Alertas Inteligentes', icon: Bell },
          { id: 'webhooks', label: '6. Webhooks Stream', icon: Radio },
          { id: 'exportaciones', label: '7. Exportación Masiva', icon: Download },
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
                border: isActive ? '1px solid #F59E0B' : '1px solid rgba(255,255,255,0.06)',
                background: isActive ? 'rgba(245,158,11,0.18)' : '#070712',
                color: isActive ? '#FCD34D' : '#8B89B0',
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s'
              }}
            >
              <Icon style={{ width: 15, height: 15, color: isActive ? '#FCD34D' : '#6A6888' }} />
              {st.label}
            </button>
          );
        })}
      </div>

      {/* ── SUB-TAB CONTENT ── */}

      {/* 0. Explorador en Vivo */}
      {activeSubTab === 'explorador' && (
        <MercadoPublicoLiveTable />
      )}

      {/* 1. Analítica de Precios */}
      {activeSubTab === 'precios' && (
        <div style={{ background: '#0B0B16', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 20, padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#E8E7F5', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp style={{ width: 20, height: 20, color: '#F59E0B' }} /> 1. Analítica de Precios UNSPSC B2G (Pricing Intelligence API)
              </h3>
              <p style={{ fontSize: 13, color: '#9896B8', margin: '4px 0 0' }}>
                Calcula la distribución de precios unitarios ofertados y adjudicados (percentiles p10 a p90) por código UNSPSC para estructurar ofertas óptimas.
              </p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(245,158,11,0.15)', color: '#FCD34D', padding: '4px 12px', borderRadius: 100, border: '1px solid rgba(245,158,11,0.3)' }}>
              GET /api/v1/mercado-publico/analitica/precios (50 cr)
            </span>
          </div>

          {/* Preset Buttons for Quick Testing */}
          <div style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#8B89B0', display: 'block', marginBottom: 8 }}>
              Selecciona una categoría UNSPSC de prueba:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { code: '43233205', label: '43233205 — Software Ciberseguridad' },
                { code: '52141502', label: '52141502 — Hornos & Electrodomésticos' },
                { code: '25101503', label: '25101503 — Vehículos Eléctricos' },
                { code: '14111507', label: '14111507 — Insumos de Oficina' },
                { code: '81111812', label: '81111812 — Reparación Datacenter' }
              ].map(preset => (
                <button
                  key={preset.code}
                  onClick={() => {
                    setUnspscInput(preset.code);
                    triggerCalcularPrecios();
                  }}
                  style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 11.5, fontWeight: 700,
                    border: unspscInput === preset.code ? '1px solid #F59E0B' : '1px solid rgba(255,255,255,0.08)',
                    background: unspscInput === preset.code ? 'rgba(245,158,11,0.2)' : '#070712',
                    color: unspscInput === preset.code ? '#FCD34D' : '#9896B8',
                    cursor: 'pointer'
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            {/* Left Box: Controls & Percentiles */}
            <div style={{ background: '#05050C', padding: 20, borderRadius: 16, border: '1px solid rgba(245,158,11,0.2)' }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#C4B5FD', display: 'block', marginBottom: 8 }}>
                Código UNSPSC del Producto / Servicio:
              </label>
              <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                <input
                  type="text"
                  value={unspscInput}
                  onChange={(e) => setUnspscInput(e.target.value)}
                  placeholder="Ej: 43233205"
                  style={{ flex: 1, background: '#090914', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '10px 14px', color: '#E8E7F5', fontFamily: 'monospace', fontWeight: 700 }}
                />
                <button 
                  onClick={triggerCalcularPrecios}
                  disabled={loadingPrecios}
                  style={{ background: '#F59E0B', color: '#000', border: 'none', padding: '10px 18px', borderRadius: 10, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <RefreshCw style={{ width: 14, height: 14, animation: loadingPrecios ? 'spin 1s linear infinite' : 'none' }} />
                  {loadingPrecios ? 'Calculando...' : 'Calcular Benchmark'}
                </button>
              </div>

              {/* Percentiles Bar Visualizer */}
              <div style={{ background: '#090914', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', marginBottom: 16 }}>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: '#E8E7F5', display: 'block', marginBottom: 10 }}>
                  Curva de Distribución de Precios (UNSPSC {unspscInput}):
                </span>
                <div style={{ height: 12, borderRadius: 6, background: 'linear-gradient(90deg, #3B82F6 0%, #22C55E 35%, #F59E0B 75%, #EF4444 100%)', position: 'relative', marginBottom: 26 }}>
                  <div style={{ position: 'absolute', left: '10%', top: 16, fontSize: 10, color: '#60A5FA', fontWeight: 800 }}>p10 (${(preciosData.percentiles.p10/1000000).toFixed(1)}M)</div>
                  <div style={{ position: 'absolute', left: '30%', top: 16, fontSize: 10, color: '#4ADE80', fontWeight: 800 }}>p25 (${(preciosData.percentiles.p25/1000000).toFixed(1)}M)</div>
                  <div style={{ position: 'absolute', left: '55%', top: 16, fontSize: 10, color: '#FCD34D', fontWeight: 800 }}>p50 (${(preciosData.percentiles.p50/1000000).toFixed(1)}M)</div>
                  <div style={{ position: 'absolute', left: '80%', top: 16, fontSize: 10, color: '#F87171', fontWeight: 800 }}>p75 (${(preciosData.percentiles.p75/1000000).toFixed(1)}M)</div>
                </div>
              </div>

              {/* AI Recommendation Card */}
              <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#4ADE80', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles style={{ width: 15, height: 15 }} /> Algoritmo de Adjudicación Predictiva Bralidus AI:
                </div>
                <p style={{ fontSize: 11.5, color: '#D4D2F0', margin: 0, lineHeight: 1.5 }}>
                  {preciosData.recommendation}
                </p>
              </div>
            </div>

            {/* Right Box: Live JSON Response & Code */}
            <div style={{ background: '#030309', padding: 18, borderRadius: 16, border: '1px solid rgba(108,60,225,0.2)', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#8B5CF6' }}>Respuesta JSON de la API (`200 OK`):</span>
                  <button
                    onClick={() => handleCopy(JSON.stringify(preciosData, null, 2), 'p_json')}
                    style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#D4D2F0', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    {copiedCode === 'p_json' ? <Check style={{ width: 12, height: 12, color: '#4ADE80' }} /> : <Copy style={{ width: 12, height: 12 }} />}
                    {copiedCode === 'p_json' ? 'Copiado' : 'Copiar JSON'}
                  </button>
                </div>
                <pre style={{ margin: 0, color: '#4ADE80', fontSize: 11, fontFamily: 'monospace', lineHeight: 1.5, overflowX: 'auto', background: '#070712', padding: 12, borderRadius: 10 }}>
{JSON.stringify(preciosData, null, 2)}
                </pre>
              </div>

              <div style={{ marginTop: 12, background: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                <code style={{ fontSize: 10.5, color: '#0EB5C6', fontFamily: 'monospace' }}>
                  GET /api/v1/mercado-publico/analitica/precios?unspsc_code={unspscInput}&periodo_meses=12
                </code>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Historial de Compradores */}
      {activeSubTab === 'compradores' && (
        <div style={{ background: '#0B0B16', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 20, padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#E8E7F5', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 style={{ width: 20, height: 20, color: '#60A5FA' }} /> 2. Historial & Perfil 360° del Organismo Comprador (Buyer Intelligence API)
              </h3>
              <p style={{ fontSize: 13, color: '#9896B8', margin: '4px 0 0' }}>
                Auditoría financiera de días reales de pago, cumplimiento de la Ley de Pago a 30 Días, licitaciones desiertas y reclamos recibidos.
              </p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(59,130,246,0.15)', color: '#60A5FA', padding: '4px 12px', borderRadius: 100, border: '1px solid rgba(59,130,246,0.3)' }}>
              GET /api/v1/mercado-publico/compradores/:rut/historial (40 cr)
            </span>
          </div>

          {/* Preset Buttons for Quick Testing */}
          <div style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#8B89B0', display: 'block', marginBottom: 8 }}>
              Selecciona un Organismo Comprador de prueba:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { rut: '69.070.100-6', label: '69.070.100-6 — Municipalidad de Santiago' },
                { rut: '61.602.100-3', label: '61.602.100-3 — Servicio de Salud Arica' },
                { rut: '60.805.000-0', label: '60.805.000-0 — Servicio de Impuestos Internos (SII)' },
                { rut: '61.202.000-2', label: '61.202.000-2 — DGAC Aeronáutica' },
                { rut: '69.070.300-9', label: '69.070.300-9 — Municipalidad de Providencia' }
              ].map(preset => (
                <button
                  key={preset.rut}
                  onClick={() => {
                    setBuyerRutInput(preset.rut);
                    triggerConsultarComprador();
                  }}
                  style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 11.5, fontWeight: 700,
                    border: buyerRutInput === preset.rut ? '1px solid #3B82F6' : '1px solid rgba(255,255,255,0.08)',
                    background: buyerRutInput === preset.rut ? 'rgba(59,130,246,0.2)' : '#070712',
                    color: buyerRutInput === preset.rut ? '#93C5FD' : '#9896B8',
                    cursor: 'pointer'
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ background: '#05050C', padding: 20, borderRadius: 16, border: '1px solid rgba(59,130,246,0.18)', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 800, color: '#93C5FD', margin: 0 }}>
                {compradorData.nombre} (RUT {compradorData.rut}):
              </label>
              <span style={{ fontSize: 11, color: '#60A5FA', fontWeight: 700 }}>{compradorData.sector}</span>
            </div>

            <div style={{ display: 'flex', gap: 10, maxWidth: 500, marginBottom: 20 }}>
              <input
                type="text"
                value={buyerRutInput}
                onChange={(e) => setBuyerRutInput(e.target.value)}
                placeholder="Ej: 69.070.100-6"
                style={{ flex: 1, background: '#090914', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 10, padding: '10px 14px', color: '#E8E7F5', fontFamily: 'monospace', fontWeight: 700 }}
              />
              <button 
                onClick={triggerConsultarComprador}
                disabled={loadingComprador}
                style={{ background: '#3B82F6', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 10, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <RefreshCw style={{ width: 14, height: 14, animation: loadingComprador ? 'spin 1s linear infinite' : 'none' }} />
                {loadingComprador ? 'Consultando...' : 'Consultar Ficha 360°'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
              <div style={{ background: '#090914', padding: 14, borderRadius: 12, border: '1px solid rgba(34,197,94,0.2)' }}>
                <span style={{ fontSize: 11, color: '#6A6888' }}>Días Promedio de Pago Real:</span>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#4ADE80', marginTop: 4 }}>{compradorData.dias_pago}</div>
                <span style={{ fontSize: 10.5, color: '#9896B8' }}>Conforme a auditoría Tesorería</span>
              </div>
              <div style={{ background: '#090914', padding: 14, borderRadius: 12, border: '1px solid rgba(245,158,11,0.2)' }}>
                <span style={{ fontSize: 11, color: '#6A6888' }}>Cumplimiento Ley 30 Días:</span>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#FCD34D', marginTop: 4 }}>{compradorData.cumplimiento_ley30}</div>
                <span style={{ fontSize: 10.5, color: '#9896B8' }}>Facturas pagadas a tiempo</span>
              </div>
              <div style={{ background: '#090914', padding: 14, borderRadius: 12, border: '1px solid rgba(239,68,68,0.2)' }}>
                <span style={{ fontSize: 11, color: '#6A6888' }}>Reclamos Recibidos (12M):</span>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#F87171', marginTop: 4 }}>{compradorData.reclamos}</div>
                <span style={{ fontSize: 10.5, color: '#9896B8' }}>Reclamos por atraso de OC</span>
              </div>
              <div style={{ background: '#090914', padding: 14, borderRadius: 12, border: '1px solid rgba(167,139,250,0.2)' }}>
                <span style={{ fontSize: 11, color: '#6A6888' }}>Presupuesto Anual Ejecutado:</span>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#C4B5FD', marginTop: 4 }}>{compradorData.presupuesto}</div>
                <span style={{ fontSize: 10.5, color: '#9896B8' }}>Ejecución presupuestaria</span>
              </div>
            </div>

            {/* Code Snippet Box */}
            <div style={{ background: '#030309', padding: 14, borderRadius: 10, border: '1px solid rgba(59,130,246,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#60A5FA', fontWeight: 800 }}>Endpoint cURL de Consulta:</span>
                <button
                  onClick={() => handleCopy(`curl -X GET "https://api.bralidus.com/v1/mercado-publico/compradores/${buyerRutInput}/historial" \\
  -H "Authorization: Bearer <VALIDUS_API_KEY>"`, 'b_curl')}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#D4D2F0', padding: '3px 8px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  {copiedCode === 'b_curl' ? <Check style={{ width: 12, height: 12, color: '#4ADE80' }} /> : <Copy style={{ width: 12, height: 12 }} />}
                  {copiedCode === 'b_curl' ? 'Copiado' : 'Copiar cURL'}
                </button>
              </div>
              <code style={{ fontSize: 11, color: '#4ADE80', fontFamily: 'monospace' }}>
                curl -X GET "https://api.bralidus.com/v1/mercado-publico/compradores/{buyerRutInput}/historial" -H "Authorization: Bearer &lt;VALIDUS_API_KEY&gt;"
              </code>
            </div>
          </div>
        </div>
      )}

      {/* 3. Perfil Competitivo de Proveedores */}
      {activeSubTab === 'competidores' && (
        <div style={{ background: '#0B0B16', border: '1px solid rgba(236,72,153,0.25)', borderRadius: 20, padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#E8E7F5', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Award style={{ width: 20, height: 20, color: '#F472B6' }} /> 3. Perfil Competitivo de Proveedores & Radar de Mercado (Supplier Competitor API)
              </h3>
              <p style={{ fontSize: 13, color: '#9896B8', margin: '4px 0 0' }}>
                Scorecard de Win-Rate %, principales competidores directos en subastas y validación Ley 19.886 / F30-1 por RUT de proveedor.
              </p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(236,72,153,0.15)', color: '#F472B6', padding: '4px 12px', borderRadius: 100, border: '1px solid rgba(236,72,153,0.3)' }}>
              GET /api/v1/mercado-publico/proveedores/:rut/perfil-competitivo (50 cr)
            </span>
          </div>

          {/* Preset Buttons for Quick Testing */}
          <div style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#8B89B0', display: 'block', marginBottom: 8 }}>
              Selecciona un Proveedor Competidor de prueba:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { rut: '76.543.210-K', label: '76.543.210-K — Electromedicina Chile SpA' },
                { rut: '76.999.888-3', label: '76.999.888-3 — Electromovilidad Latam SpA' },
                { rut: '76.444.111-9', label: '76.444.111-9 — Hardware Emergency Response SpA' }
              ].map(preset => (
                <button
                  key={preset.rut}
                  onClick={() => {
                    setSupplierRutInput(preset.rut);
                    triggerConsultarCompetidor();
                  }}
                  style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 11.5, fontWeight: 700,
                    border: supplierRutInput === preset.rut ? '1px solid #EC4899' : '1px solid rgba(255,255,255,0.08)',
                    background: supplierRutInput === preset.rut ? 'rgba(236,72,153,0.2)' : '#070712',
                    color: supplierRutInput === preset.rut ? '#F472B6' : '#9896B8',
                    cursor: 'pointer'
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ background: '#05050C', padding: 20, borderRadius: 16, border: '1px solid rgba(236,72,153,0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 800, color: '#F472B6', margin: 0 }}>
                {competidorData.razon_social} (RUT {competidorData.rut}):
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, maxWidth: 500, marginBottom: 20 }}>
              <input
                type="text"
                value={supplierRutInput}
                onChange={(e) => setSupplierRutInput(e.target.value)}
                placeholder="Ej: 76.543.210-K"
                style={{ flex: 1, background: '#090914', border: '1px solid rgba(236,72,153,0.3)', borderRadius: 10, padding: '10px 14px', color: '#E8E7F5', fontFamily: 'monospace', fontWeight: 700 }}
              />
              <button 
                onClick={triggerConsultarCompetidor}
                disabled={loadingCompetidor}
                style={{ background: '#EC4899', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 10, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <RefreshCw style={{ width: 14, height: 14, animation: loadingCompetidor ? 'spin 1s linear infinite' : 'none' }} />
                {loadingCompetidor ? 'Generando...' : 'Generar Radar Competitivo'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
              <div style={{ background: '#090914', padding: 14, borderRadius: 12, border: '1px solid rgba(34,197,94,0.2)' }}>
                <span style={{ fontSize: 11, color: '#6A6888' }}>Win Rate % (Tasa Adjudicación):</span>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#4ADE80', marginTop: 4 }}>{competidorData.win_rate}</div>
                <span style={{ fontSize: 11, color: '#9896B8' }}>{competidorData.win_rate_subtext}</span>
              </div>
              <div style={{ background: '#090914', padding: 14, borderRadius: 12, border: '1px solid rgba(245,158,11,0.2)' }}>
                <span style={{ fontSize: 11, color: '#6A6888' }}>Ticket Promedio Adjudicado:</span>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#FCD34D', marginTop: 4 }}>{competidorData.ticket_promedio}</div>
                <span style={{ fontSize: 11, color: '#9896B8' }}>Monto total 12M: {competidorData.monto_12m}</span>
              </div>
              <div style={{ background: '#090914', padding: 14, borderRadius: 12, border: '1px solid rgba(139,92,246,0.2)' }}>
                <span style={{ fontSize: 11, color: '#6A6888' }}>Estado ChileProveedores:</span>
                <div style={{ fontSize: 15, fontWeight: 900, color: '#C4B5FD', marginTop: 4 }}>{competidorData.chileproveedores}</div>
                <span style={{ fontSize: 11, color: '#4ADE80' }}>{competidorData.f30_1}</span>
              </div>
            </div>

            {/* Competitor Radar Matches List */}
            <div style={{ background: '#090914', padding: 14, borderRadius: 12, border: '1px solid rgba(236,72,153,0.2)', marginBottom: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#F472B6', display: 'block', marginBottom: 8 }}>
                🎯 Radar de Coincidencia en Subastas Directas:
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {competidorData.competidores.map((comp, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#D4D2F0', background: 'rgba(0,0,0,0.4)', padding: '8px 12px', borderRadius: 8 }}>
                    <span>• {comp.nombre}</span>
                    <strong style={{ color: '#FCD34D' }}>{comp.coincidencia}</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Code Snippet Box */}
            <div style={{ background: '#030309', padding: 14, borderRadius: 10, border: '1px solid rgba(236,72,153,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#F472B6', fontWeight: 800 }}>Endpoint cURL de Consulta:</span>
                <button
                  onClick={() => handleCopy(`curl -X GET "https://api.bralidus.com/v1/mercado-publico/proveedores/${supplierRutInput}/perfil-competitivo" \\
  -H "Authorization: Bearer <VALIDUS_API_KEY>"`, 's_curl')}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#D4D2F0', padding: '3px 8px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  {copiedCode === 's_curl' ? <Check style={{ width: 12, height: 12, color: '#4ADE80' }} /> : <Copy style={{ width: 12, height: 12 }} />}
                  {copiedCode === 's_curl' ? 'Copiado' : 'Copiar cURL'}
                </button>
              </div>
              <code style={{ fontSize: 11, color: '#4ADE80', fontFamily: 'monospace' }}>
                curl -X GET "https://api.bralidus.com/v1/mercado-publico/proveedores/{supplierRutInput}/perfil-competitivo" -H "Authorization: Bearer &lt;VALIDUS_API_KEY&gt;"
              </code>
            </div>
          </div>
        </div>
      )}

      {/* 4. Búsquedas Guardadas */}
      {activeSubTab === 'busquedas' && (
        <div style={{ background: '#0B0B16', border: '1px solid rgba(14,181,198,0.25)', borderRadius: 20, padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#E8E7F5', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bookmark style={{ width: 20, height: 20, color: '#0EB5C6' }} /> 4. Buscador Guardado & Suscripción de Queries (Saved Queries API)
              </h3>
              <p style={{ fontSize: 13, color: '#9896B8', margin: '4px 0 0' }}>
                Almacena filtros complejos multi-criterio y sincronízalos automáticamente con tu CRM (Salesforce, Hubspot, SAP).
              </p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(14,181,198,0.15)', color: '#0EB5C6', padding: '4px 12px', borderRadius: 100, border: '1px solid rgba(14,181,198,0.3)' }}>
              POST /api/v1/mercado-publico/busquedas/guardadas (10 cr)
            </span>
          </div>

          <div style={{ background: '#05050C', padding: 20, borderRadius: 16, border: '1px solid rgba(14,181,198,0.18)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              {[
                { name: 'Licitaciones Salud RM > $50M CLP', query: 'region=13 AND unspsc=4110* AND amount_gt=50000000', status: 'ACTIVA', matches: '14 Nuevas esta semana', sync: 'CRM Salesforce Webhook' },
                { name: 'Compras Ágiles Providencia / Las Condes', query: 'type=agile_purchase AND buyer_rut IN (69.070.300-9, 69.070.400-5)', status: 'ACTIVA', matches: '8 Cotizaciones abiertas', sync: 'HubSpot API Connector' }
              ].map((q, idx) => (
                <div key={idx} style={{ background: '#090914', border: '1px solid rgba(14,181,198,0.15)', padding: 16, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#E8E7F5', marginBottom: 4 }}>{q.name}</div>
                    <code style={{ fontSize: 11, color: '#0EB5C6', background: 'rgba(0,0,0,0.5)', padding: '3px 8px', borderRadius: 6, fontFamily: 'monospace' }}>{q.query}</code>
                    <div style={{ fontSize: 11, color: '#8B89B0', marginTop: 6 }}>Sincronización activa con: <strong>{q.sync}</strong></div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <span style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ADE80', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>{q.status}</span>
                    <button 
                      onClick={() => showToast(`✓ Sincronización ejecutada para "${q.name}"`)}
                      style={{ background: 'rgba(14,181,198,0.18)', border: '1px solid rgba(14,181,198,0.3)', color: '#0EB5C6', padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
                    >
                      Ejecutar Sync CRM
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Code Snippet Box */}
            <div style={{ background: '#030309', padding: 14, borderRadius: 10, border: '1px solid rgba(14,181,198,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#0EB5C6', fontWeight: 800 }}>Payload de Creación API:</span>
                <button
                  onClick={() => handleCopy(`curl -X POST "https://api.bralidus.com/v1/mercado-publico/busquedas/guardadas" \\
  -H "Authorization: Bearer <VALIDUS_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Licitaciones Salud RM", "query_params": {"region": "13", "unspsc": "4110*"}}'`, 'sq_curl')}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#D4D2F0', padding: '3px 8px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  {copiedCode === 'sq_curl' ? <Check style={{ width: 12, height: 12, color: '#4ADE80' }} /> : <Copy style={{ width: 12, height: 12 }} />}
                  {copiedCode === 'sq_curl' ? 'Copiado' : 'Copiar cURL'}
                </button>
              </div>
              <pre style={{ margin: 0, color: '#4ADE80', fontSize: 11, fontFamily: 'monospace', lineHeight: 1.5 }}>
{`curl -X POST "https://api.bralidus.com/v1/mercado-publico/busquedas/guardadas" \\
  -H "Authorization: Bearer <VALIDUS_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Licitaciones Salud RM", "query_params": {"region": "13", "unspsc": "4110*"}}'`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* 5. Alertas Inteligentes */}
      {activeSubTab === 'alertas' && (
        <div style={{ background: '#0B0B16', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 20, padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#E8E7F5', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bell style={{ width: 20, height: 20, color: '#FBBF24' }} /> 5. Motor de Alertas Inteligentes B2G (Smart Alerts Engine)
              </h3>
              <p style={{ fontSize: 13, color: '#9896B8', margin: '4px 0 0' }}>
                Notificaciones condicionales multicanal (Slack, Email, Teams) ante publicaciones prioritarias de alto presupuesto.
              </p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(251,191,36,0.15)', color: '#FBBF24', padding: '4px 12px', borderRadius: 100, border: '1px solid rgba(251,191,36,0.3)' }}>
              POST /api/v1/mercado-publico/alertas (15 cr)
            </span>
          </div>

          <div style={{ background: '#05050C', padding: 20, borderRadius: 16, border: '1px solid rgba(251,191,36,0.18)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              <div style={{ background: '#090914', padding: 16, borderRadius: 12, border: '1px solid rgba(251,191,36,0.2)' }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#FBBF24', marginBottom: 6 }}>Regla #1: Licitaciones Ciberseguridad &amp; Software &gt; 1.000 UTM</div>
                <p style={{ fontSize: 11.5, color: '#D4D2F0', margin: '0 0 10px 0', lineHeight: 1.5 }}>
                  Notificación en tiempo real al canal Slack `#ventas-b2g` inmediatamente al detectarse la publicación.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ background: 'rgba(245,158,11,0.15)', color: '#FCD34D', padding: '2px 8px', borderRadius: 4, fontSize: 10.5, fontWeight: 700 }}>Canal: Slack Webhook</span>
                  <button 
                    onClick={() => showToast('✓ Alerta de prueba enviada a canal Slack #ventas-b2g')}
                    style={{ background: '#F59E0B', color: '#000', border: 'none', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
                  >
                    Probar Alerta Slack
                  </button>
                </div>
              </div>

              <div style={{ background: '#090914', padding: 16, borderRadius: 12, border: '1px solid rgba(251,191,36,0.2)' }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#FBBF24', marginBottom: 6 }}>Regla #2: Alerta de Adjudicación Competidores Directos</div>
                <p style={{ fontSize: 11.5, color: '#D4D2F0', margin: '0 0 10px 0', lineHeight: 1.5 }}>
                  Notificación por Email al equipo comercial cuando un competidor directo registrado se adjudique un contrato público.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ background: 'rgba(245,158,11,0.15)', color: '#FCD34D', padding: '2px 8px', borderRadius: 4, fontSize: 10.5, fontWeight: 700 }}>Canal: Email Digest</span>
                  <button 
                    onClick={() => showToast('✓ Email Digest de prueba enviado')}
                    style={{ background: '#F59E0B', color: '#000', border: 'none', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
                  >
                    Probar Email Digest
                  </button>
                </div>
              </div>
            </div>

            {/* Code Snippet Box */}
            <div style={{ background: '#030309', padding: 14, borderRadius: 10, border: '1px solid rgba(251,191,36,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#FCD34D', fontWeight: 800 }}>Endpoint cURL de Creación:</span>
                <button
                  onClick={() => handleCopy(`curl -X POST "https://api.bralidus.com/v1/mercado-publico/alertas" \\
  -H "Authorization: Bearer <VALIDUS_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{"rule_name": "Alerta Presupuesto > 1.000 UTM", "channels": ["SLACK"], "conditions": {"min_amount_clp": 50000000}}'`, 'al_curl')}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#D4D2F0', padding: '3px 8px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  {copiedCode === 'al_curl' ? <Check style={{ width: 12, height: 12, color: '#4ADE80' }} /> : <Copy style={{ width: 12, height: 12 }} />}
                  {copiedCode === 'al_curl' ? 'Copiado' : 'Copiar cURL'}
                </button>
              </div>
              <code style={{ fontSize: 11, color: '#4ADE80', fontFamily: 'monospace' }}>
                curl -X POST "https://api.bralidus.com/v1/mercado-publico/alertas" -H "Authorization: Bearer &lt;VALIDUS_API_KEY&gt;"
              </code>
            </div>
          </div>
        </div>
      )}

      {/* 6. Webhooks Push Stream */}
      {activeSubTab === 'webhooks' && (
        <div style={{ background: '#0B0B16', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 20, padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#E8E7F5', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Radio style={{ width: 20, height: 20, color: '#C084FC' }} /> 6. Webhooks Push Stream (Real-Time Push API)
              </h3>
              <p style={{ fontSize: 13, color: '#9896B8', margin: '4px 0 0' }}>
                Suscríbete a eventos de publicaciones, actualizaciones de foro Q&A y emisiones de Orden de Compra directo en tu servidor.
              </p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(168,85,247,0.15)', color: '#C084FC', padding: '4px 12px', borderRadius: 100, border: '1px solid rgba(168,85,247,0.3)' }}>
              POST /api/v1/mercado-publico/webhooks (25 cr)
            </span>
          </div>

          <div style={{ background: '#05050C', padding: 20, borderRadius: 16, border: '1px solid rgba(168,85,247,0.18)' }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#C084FC', display: 'block', marginBottom: 8 }}>
              URL Receptora de Webhook (HTTPS Target):
            </label>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <input
                type="text"
                value={webhookUrlInput}
                onChange={(e) => setWebhookUrlInput(e.target.value)}
                style={{ flex: 1, background: '#090914', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 10, padding: '10px 14px', color: '#E8E7F5', fontFamily: 'monospace', fontWeight: 700 }}
              />
              <button 
                onClick={() => showToast(`✓ Webhook suscrito a ${webhookUrlInput}`)}
                style={{ background: '#A855F7', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}
              >
                Suscribir Endpoint
              </button>
            </div>

            <div style={{ background: '#030309', padding: 16, borderRadius: 12, border: '1px solid rgba(168,85,247,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#C084FC' }}>Ejemplo Payload Push Event (`tender.published`):</span>
                <button
                  onClick={() => showToast('✓ Evento simulado entregado en target URL (200 OK - 138ms)')}
                  style={{ background: 'rgba(168,85,247,0.2)', border: '1px solid rgba(168,85,247,0.4)', color: '#C084FC', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
                >
                  Simular Evento Push
                </button>
              </div>
              <pre style={{ margin: 0, color: '#4ADE80', fontSize: 11.5, fontFamily: 'monospace', lineHeight: 1.5, overflowX: 'auto', background: '#070712', padding: 12, borderRadius: 10 }}>
{JSON.stringify({
  event: "tender.published",
  timestamp: new Date().toISOString(),
  signature: "sha256=a8f93b...c912",
  data: {
    external_code: "1180703-12-L126",
    title: "ADQUISICION DE EQUIPAMIENTO SALUD UHCIP",
    buyer_name: "SERVICIO DE SALUD ARICA",
    amount_estimated: 4850000,
    closing_at: "2026-05-22T15:30:00Z"
  }
}, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* 7. Exportaciones Masivas Enterprise */}
      {activeSubTab === 'exportaciones' && (
        <div style={{ background: '#0B0B16', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 20, padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#E8E7F5', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Download style={{ width: 20, height: 20, color: '#4ADE80' }} /> 7. Exportaciones Masivas Enterprise (Bulk Data Dump API)
              </h3>
              <p style={{ fontSize: 13, color: '#9896B8', margin: '4px 0 0' }}>
                Descarga datasets históricos estructurados para PowerBI, Metabase, sistemas ERP o pipelines de Data Science.
              </p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(34,197,94,0.15)', color: '#4ADE80', padding: '4px 12px', borderRadius: 100, border: '1px solid rgba(34,197,94,0.3)' }}>
              POST /api/v1/mercado-publico/exportaciones (100 cr)
            </span>
          </div>

          <div style={{ background: '#05050C', padding: 20, borderRadius: 16, border: '1px solid rgba(34,197,94,0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#4ADE80' }}>Formato de Archivo:</span>
              {(['jsonl', 'csv', 'parquet'] as const).map(fmt => (
                <button
                  key={fmt}
                  onClick={() => setExportFormat(fmt)}
                  style={{
                    padding: '8px 16px', borderRadius: 10, border: exportFormat === fmt ? '1px solid #22C55E' : '1px solid rgba(255,255,255,0.08)',
                    background: exportFormat === fmt ? 'rgba(34,197,94,0.2)' : '#090914',
                    color: exportFormat === fmt ? '#4ADE80' : '#8B89B0',
                    fontSize: 12, fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase'
                  }}
                >
                  {fmt}
                </button>
              ))}
            </div>

            <div style={{ background: '#090914', padding: 18, borderRadius: 12, border: '1px solid rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#E8E7F5' }}>Dataset Completo Mercado Público (Q3 2026)</div>
                <div style={{ fontSize: 11.5, color: '#9896B8', marginTop: 2 }}>Contiene 120.000 Licitaciones + 450.000 OCs en formato {exportFormat.toUpperCase()}</div>
              </div>

              <button 
                onClick={() => {
                  const content = exportFormat === 'csv'
                    ? "codigo_externo,titulo,organismo_demandante,monto_clp\n1180703-12-L126,EQUIPAMIENTO SALUD UHCIP,SERVICIO DE SALUD ARICA,4850000\nCOT-78401,TONER Y PAPEL,MUNICIPALIDAD DE PROVIDENCIA,1850000\n"
                    : JSON.stringify({ code: "1180703-12-L126", title: "EQUIPAMIENTO SALUD UHCIP", amount: 4850000 }) + "\n";
                  const blob = new Blob([content], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `mercado_publico_2026_dump.${exportFormat}`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  showToast(`✓ Archivo mercado_publico_2026_dump.${exportFormat} descargado`);
                }}
                style={{ background: '#22C55E', color: '#000', border: 'none', padding: '10px 20px', borderRadius: 10, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Download style={{ width: 14, height: 14 }} /> Generar Descarga ({exportFormat.toUpperCase()})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
