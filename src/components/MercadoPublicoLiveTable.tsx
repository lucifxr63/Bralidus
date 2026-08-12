import { useState, useEffect } from 'react';
import { Search, Building2, CheckCircle2, Clock, Tag, Code2, RefreshCw, ExternalLink, Check, Copy, Database, Layers, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { BASE } from '@/data/api-docs';
import { supabase } from '@/lib/supabase';
import { FichaLicitacion } from './FichaLicitacion';

export interface OpportunityItem {
  id: string;
  external_code: string;
  title: string;
  buyer_name: string;
  source_type: 'tender' | 'agile_purchase' | 'private_tender' | 'convenio_marco' | 'grandes_compras' | 'trato_directo' | 'consulta_mercado' | 'contrato_publico' | 'nuevos_mecanismos';
  status_code: 'publicada' | 'adjudicada' | 'cerrada';
  amount_estimated: number;
  currency: string;
  published_at: string;
  closing_at?: string;
  category?: string;
  official_url?: string;
}

export interface AnnexItem {
  filename: string;
  type: string;
  description: string;
  size_kb: number;
  date: string;
}

export interface ProductItem {
  item_num: number;
  name: string;
  unspsc_code: string;
  quantity: number;
  unit: string;
  description: string;
}

export const getOfficialUrl = (item: Partial<OpportunityItem>) => {
  const code = item.external_code ?? '';
  if (item.source_type === 'agile_purchase') {
    return `https://www.mercadopublico.cl/CompraAgil/Ficha/${encodeURIComponent(code)}`;
  }
  return `https://www.mercadopublico.cl/BuscarLicitacion?q=${encodeURIComponent(code)}`;
};

export const getSourceTypeBadge = (type: OpportunityItem['source_type']) => {
  switch (type) {
    case 'tender':
      return { label: 'Licitación Pública', bg: 'rgba(139,92,246,0.15)', color: '#C4B5FD' };
    case 'agile_purchase':
      return { label: 'Compra Ágil', bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' };
    case 'private_tender':
      return { label: 'Licitación Privada', bg: 'rgba(236,72,153,0.15)', color: '#F472B6' };
    case 'convenio_marco':
      return { label: 'Convenio Marco', bg: 'rgba(14,181,198,0.15)', color: '#0EB5C6' };
    case 'grandes_compras':
      return { label: 'Grandes Compras', bg: 'rgba(59,130,246,0.15)', color: '#60A5FA' };
    case 'trato_directo':
      return { label: 'Trato Directo', bg: 'rgba(239,68,68,0.15)', color: '#F87171' };
    case 'consulta_mercado':
      return { label: 'Consulta RFI', bg: 'rgba(168,85,247,0.15)', color: '#C084FC' };
    case 'contrato_publico':
      return { label: 'Contrato Público', bg: 'rgba(34,197,94,0.15)', color: '#4ADE80' };
    case 'nuevos_mecanismos':
      return { label: 'Ley 21.634 Innovación', bg: 'rgba(251,191,36,0.15)', color: '#FBBF24' };
    default:
      return { label: 'Contratación Pública', bg: 'rgba(107,114,128,0.15)', color: '#9CA3AF' };
  }
};

export const getModuleOfficialUrl = (code: string, moduleType: string) => {
  switch (moduleType) {
    case 'adjuntos':
      return `https://www.mercadopublico.cl/Procurement/Modules/RFB/ViewAttachmentLC.aspx?idLicitacion=${encodeURIComponent(code)}`;
    case 'preguntas':
      return `https://www.mercadopublico.cl/Procurement/Modules/RFB/FichaPreguntas.aspx?idLicitacion=${encodeURIComponent(code)}`;
    case 'historial':
      return `https://www.mercadopublico.cl/Procurement/Modules/RFB/HistorialLicitacion.aspx?idLicitacion=${encodeURIComponent(code)}`;
    case 'apertura':
      return `https://www.mercadopublico.cl/Procurement/Modules/RFB/ActaApertura.aspx?idLicitacion=${encodeURIComponent(code)}`;
    case 'cuadro_ofertas':
      return `https://www.mercadopublico.cl/Procurement/Modules/RFB/CuadroOfertas.aspx?idLicitacion=${encodeURIComponent(code)}`;
    case 'aclaraciones':
      return `https://www.mercadopublico.cl/Procurement/Modules/RFB/AclaracionOfertas.aspx?idLicitacion=${encodeURIComponent(code)}`;
    case 'adjudicacion':
      return `https://www.mercadopublico.cl/Procurement/Modules/RFB/FichaAdjudicacion.aspx?idLicitacion=${encodeURIComponent(code)}`;
    case 'orden_compra':
      return `https://www.mercadopublico.cl/OrdenCompra/FichaOC?id=1180703-452-SE26`;
    case 'certificado_habilidad':
      return `https://www.chileproveedores.cl/Ficha/FichaCertificadoHabilidad`;
    default:
      return `https://www.mercadopublico.cl/BuscarLicitacion?q=${encodeURIComponent(code)}`;
  }
};


export interface FullTenderDetails {
  products: ProductItem[];
  annexes: AnnexItem[];
  qa: Array<{ num: number; q: string; q_date: string; a: string; a_date: string }>;
  history: Array<{ date: string; title: string; desc: string }>;
  opening: { date: string; total_offers: number; minister: string; guarantee: string; notes: string };
  offers: Array<{ name: string; rut: string; amount: number; plazo: string; status: string; color: string }>;
  clarifications: { req_num: string; target: string; desc: string; status: string };
  award: { winner: string; rut: string; amount: number; resolution: string; score_tech: string; score_econ: string; score_final: string };
  purchase_order: { code: string; net: number; tax: number; total: number; supplier: string; rut: string; status: string };
  stages: {
    published_at: string;
    questions_start: string;
    questions_end: string;
    answers_published: string;
    closing_at: string;
    technical_opening: string;
    award_at: string;
  };
}


export function MercadoPublicoLiveTable() {
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | OpportunityItem['source_type']>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'publicada' | 'adjudicada' | 'cerrada'>('all');
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<OpportunityItem | null>(null);

  // Active module tab in Ficha detail modal (The 9 Mercado Público items)
  
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showMetricsPanel, setShowMetricsPanel] = useState(true);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const fetchLiveOpportunities = async () => {
    setLoading(true);
    try {
      // 1. API Gateway Animus, con la sesión del usuario.
      //
      // Acá iba `Bearer demo_public_key`. El gateway cerró ese literal el
      // 2026-08-03 (devuelve 401 AUTH_REQUIRED), así que esta rama venía
      // fallando SIEMPRE y el componente caía sin excepción al fallback que
      // pegaba directo a Mercado Público con un ticket hardcodeado — o sea,
      // cada visita a la página gastaba cuota del ticket institucional.
      //
      // El middleware acepta el JWT de sesión de Supabase (`token.startsWith('ey')`),
      // que es el mismo patrón de KnowledgeGraph.tsx y no expone ninguna
      // credencial en el bundle.
      const { data: { session } } = await supabase.auth.getSession();
      const res = session?.access_token
        ? await fetch(`${BASE}/data/b2g/licitaciones/activas`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` },
          }).catch(() => null)
        : null;
      if (res && res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          const mapped = json.data.map((op: any) => ({
            ...op,
            official_url: getOfficialUrl(op)
          }));
          // Sólo lo que devolvió el gateway. Acá se mezclaban DEMO_OPPORTUNITIES
          // —oportunidades inventadas con nombres de organismos reales— entre los
          // resultados de verdad, sin ninguna marca que las distinguiera.
          setOpportunities(mapped);
          setLoading(false);
          return;
        }
      }

      // 2. NO hay fallback contra api.mercadopublico.cl desde el navegador.
      //
      // Acá había un fetch directo con el ticket institucional escrito en el
      // código: `319CF43E-…`. Un ticket de MP en un bundle público lo puede leer
      // cualquiera con las herramientas de desarrollador, y se gasta contra la
      // cuota diaria de ChileCompra de la organización. El 2026-08-11 la API
      // respondía `{"Codigo":203,"Mensaje":"Ticket superó la cuota diaria
      // asignada."}` — con esta rama corriendo en cada carga de la página.
      //
      // Además fabricaba los datos que no venían en ese endpoint:
      // `buyer_name: 'Organismo Público / Gobierno de Chile'`,
      // `amount_estimated: (idx + 1) * 15000000` y `published_at: new Date()`
      // en CADA request. Es exactamente el defecto que ya se había sacado del
      // backend (ver la nota de `fetchLicitusActivas` en api-v1/routes/data.ts:
      // "no se repone: si la fuente no responde, se dice por qué").
      //
      // Si el gateway no responde, se conserva lo que ya estaba en pantalla y
      // se avisa por consola. Mercado Público se consulta desde el servidor,
      // que es donde vive la credencial.
      console.warn('[mp-live] El gateway Animus no devolvió oportunidades; no hay fallback directo a Mercado Público.');
    } catch {
      // Keep canonical 9-mechanism data on fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveOpportunities();
  }, []);

  const filteredItems = opportunities.filter(item => {
    const matchSearch = search === '' || 
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.external_code.toLowerCase().includes(search.toLowerCase()) ||
      item.buyer_name.toLowerCase().includes(search.toLowerCase());
    
    const matchType = typeFilter === 'all' || item.source_type === typeFilter;
    const matchStatus = statusFilter === 'all' || item.status_code === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  const formatCLP = (val: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(val);
  };

  const formatDate = (iso: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div style={{ background: '#0B0B16', border: '1px solid rgba(245,158,11,0.22)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 12px 36px rgba(0,0,0,0.4)' }}>
      {/* Table Header Banner */}
      <div style={{ padding: '24px 28px', background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(139,92,246,0.04) 100%)', borderBottom: '1px solid rgba(245,158,11,0.14)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 10, background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                <Building2 style={{ width: 18, height: 18 }} />
              </span>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: '#E8E7F5', margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
                Explorador en Vivo — Mercado Público (B2G)
              </h3>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ADE80' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ADE80', animation: 'pulse 2s infinite' }} /> Datos en Vivo
              </span>
            </div>
            <p style={{ fontSize: 13.5, color: '#9896B8', maxWidth: 720, margin: 0, lineHeight: 1.6 }}>
              Visualiza en tiempo real los contratos, licitaciones públicas y compras ágiles capturadas e indexadas por Animus RaaS API con enlaces directos y descargador de anexos.
            </p>
          </div>
          <button 
            onClick={fetchLiveOpportunities}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#FCD34D', padding: '9px 16px', borderRadius: 12, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            <RefreshCw style={{ width: 14, height: 14, animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Actualizar Datos
          </button>
        </div>

        {/* ── RaaS Ingestion SLA, Data Volume & Structured Breakdown Widget ── */}
        <div style={{ marginTop: 20, background: '#05050C', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 16, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap style={{ width: 18, height: 18, color: '#F59E0B' }} />
              <h4 style={{ fontSize: 13.5, fontWeight: 800, color: '#E8E7F5', margin: 0, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                Frecuencia de Ingesta, Cobertura y Desglose de Datos Mercado Público
              </h4>
            </div>
            <button
              onClick={() => setShowMetricsPanel(!showMetricsPanel)}
              style={{ background: 'none', border: 'none', color: '#8B89B0', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}
            >
              {showMetricsPanel ? 'Ocultar Desglose' : 'Ver Desglose Completo'}
              {showMetricsPanel ? <ChevronUp style={{ width: 14, height: 14 }} /> : <ChevronDown style={{ width: 14, height: 14 }} />}
            </button>
          </div>

          {showMetricsPanel && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 14, marginTop: 10 }}>
              {/* Card 1: Frequency & Refresh SLA */}
              <div style={{ background: '#090914', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 800, color: '#4ADE80', marginBottom: 8 }}>
                  <Clock style={{ width: 15, height: 15 }} /> Frecuencia de Ingesta (Sync SLA)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#D4D2F0' }}>
                    <span>• Licitaciones & Compra Ágil:</span> <strong style={{ color: '#4ADE80' }}>Cada 3 min (24/7)</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#D4D2F0' }}>
                    <span>• Órdenes de Compra (OC):</span> <strong style={{ color: '#4ADE80' }}>Cada 15 min</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#D4D2F0' }}>
                    <span>• Extracción Anexos PDF/OCR:</span> <strong style={{ color: '#C4B5FD' }}>On-demand (Real-time)</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#D4D2F0' }}>
                    <span>• Registro ChileProveedores:</span> <strong style={{ color: '#FCD34D' }}>Diario (02:00 UTC)</strong>
                  </div>
                </div>
              </div>

              {/* Card 2: Real Animus RaaS API Live Gateway & Coverage */}
              <div style={{ background: '#090914', border: '1px solid rgba(14,181,198,0.2)', borderRadius: 12, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 800, color: '#0EB5C6', marginBottom: 8 }}>
                  <Database style={{ width: 15, height: 15 }} /> Cobertura RaaS API Animus (Tiempo Real)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#D4D2F0' }}>
                    <span>• Licitaciones Activas en Vivo:</span> <strong style={{ color: '#0EB5C6' }}>+15.000 Procesos</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#D4D2F0' }}>
                    <span>• Órdenes de Compra / Día:</span> <strong style={{ color: '#0EB5C6' }}>+3.500 OCs Diarias</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#D4D2F0' }}>
                    <span>• Consultas ChileProveedores:</span> <strong style={{ color: '#0EB5C6' }}>+135.000 RUTs</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#D4D2F0' }}>
                    <span>• Mercado B2G Nacional Auditado:</span> <strong style={{ color: '#4ADE80' }}>+$14,5 Billones CLP/año</strong>
                  </div>
                </div>
              </div>

              {/* Card 3: Data Breakdown & Extraction */}
              <div style={{ background: '#090914', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 800, color: '#C4B5FD', marginBottom: 8 }}>
                  <Layers style={{ width: 15, height: 15 }} /> Desglose y Campos Estructurados
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#D4D2F0' }}>
                    <span>• Clasificación Productos:</span> <strong style={{ color: '#C4B5FD' }}>Codificación UNSPSC</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#D4D2F0' }}>
                    <span>• Módulos por Licitación:</span> <strong style={{ color: '#C4B5FD' }}>9 Módulos Canónicos</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#D4D2F0' }}>
                    <span>• Impugnaciones Judiciales:</span> <strong style={{ color: '#4ADE80' }}>Tribunal TCP Chile</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#D4D2F0' }}>
                    <span>• Métricas de Desempeño:</span> <strong style={{ color: '#FCD34D' }}>Scores M1-M10 por RUT</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Search & Filter Controls */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 22 }}>
          {/* Search bar */}
          <div style={{ flex: '1 1 280px', position: 'relative' }}>
            <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#6A6888' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por licitación, código (1180703-12-L126) u organismo (ARICA)..."
              style={{ width: '100%', background: '#05050C', border: '1px solid rgba(108,60,225,0.18)', borderRadius: 11, padding: '10px 14px 10px 36px', color: '#E8E7F5', fontSize: 13, outline: 'none' }}
            />
          </div>

          {/* Type selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#05050C', border: '1px solid rgba(108,60,225,0.18)', borderRadius: 11, padding: 3, flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'Todos (9 Mecanismos)' },
              { id: 'tender', label: 'Licitación Pública' },
              { id: 'agile_purchase', label: 'Compra Ágil' },
              { id: 'private_tender', label: 'Licitación Privada' },
              { id: 'convenio_marco', label: 'Convenio Marco' },
              { id: 'grandes_compras', label: 'Grandes Compras' },
              { id: 'trato_directo', label: 'Trato Directo' },
              { id: 'consulta_mercado', label: 'Consulta RFI' },
              { id: 'contrato_publico', label: 'Contratos' },
              { id: 'nuevos_mecanismos', label: 'Ley 21.634 Innovación' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTypeFilter(t.id as any)}
                style={{ padding: '5px 11px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, background: typeFilter === t.id ? '#F59E0B' : 'none', color: typeFilter === t.id ? '#000' : '#8B89B0', transition: 'all 0.2s' }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Status selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#05050C', border: '1px solid rgba(108,60,225,0.18)', borderRadius: 11, padding: 3 }}>
            {[
              { id: 'all', label: 'Cualquier Estado' },
              { id: 'publicada', label: 'Publicadas' },
              { id: 'adjudicada', label: 'Adjudicadas' }
            ].map(s => (
              <button
                key={s.id}
                onClick={() => setStatusFilter(s.id as any)}
                style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: statusFilter === s.id ? 'rgba(139,92,246,0.25)' : 'none', color: statusFilter === s.id ? '#C4B5FD' : '#8B89B0' }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#060611', borderBottom: '1px solid rgba(108,60,225,0.12)', color: '#7674A0', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              <th style={{ padding: '14px 20px', fontWeight: 700 }}>Código & Tipo</th>
              <th style={{ padding: '14px 20px', fontWeight: 700 }}>Proyecto / Descripción</th>
              <th style={{ padding: '14px 20px', fontWeight: 700 }}>Organismo Comprador</th>
              <th style={{ padding: '14px 20px', fontWeight: 700, textAlign: 'right' }}>Monto Estimado</th>
              <th style={{ padding: '14px 20px', fontWeight: 700 }}>Estado & Fechas</th>
              <th style={{ padding: '14px 20px', fontWeight: 700, textAlign: 'center' }}>Acciones & Enlace</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#6A6888', fontSize: 14 }}>
                  No se encontraron licitaciones que coincidan con los criterios de búsqueda.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const officialUrl = getOfficialUrl(item);
                const badge = getSourceTypeBadge(item.source_type);
                return (
                  <tr 
                    key={item.id || item.external_code}
                    style={{ borderBottom: '1px solid rgba(108,60,225,0.06)', transition: 'background 0.15s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(245,158,11,0.03)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Code & Type */}
                    <td style={{ padding: '16px 20px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#FCD34D', fontFamily: 'monospace' }}>
                          {item.external_code}
                        </span>
                        <span style={{ 
                          display: 'inline-flex', alignItems: 'center', gap: 4, width: 'fit-content',
                          fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                          background: badge.bg,
                          color: badge.color
                        }}>
                          {badge.label}
                        </span>
                      </div>
                    </td>

                    {/* Title & Category */}
                    <td style={{ padding: '16px 20px', verticalAlign: 'top', maxWidth: 360 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#E8E7F5', lineHeight: 1.45, marginBottom: 4 }}>
                        {item.title}
                      </div>
                      {item.category && (
                        <span style={{ fontSize: 11, color: '#7674A0', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Tag style={{ width: 11, height: 11 }} /> {item.category}
                        </span>
                      )}
                    </td>

                    {/* Buyer */}
                    <td style={{ padding: '16px 20px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#C4B5FD', fontWeight: 600 }}>
                        <Building2 style={{ width: 13, height: 13, color: '#8B5CF6', flexShrink: 0 }} />
                        <span>{item.buyer_name}</span>
                      </div>
                    </td>

                    {/* Amount */}
                    <td style={{ padding: '16px 20px', verticalAlign: 'top', textAlign: 'right' }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#4ADE80', fontFamily: "'Space Grotesk', monospace" }}>
                        {formatCLP(item.amount_estimated)}
                      </span>
                    </td>

                    {/* Status & Date */}
                    <td style={{ padding: '16px 20px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5, width: 'fit-content',
                          fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                          background: item.status_code === 'publicada' ? 'rgba(34,197,94,0.15)' : item.status_code === 'adjudicada' ? 'rgba(59,130,246,0.15)' : 'rgba(107,114,128,0.15)',
                          color: item.status_code === 'publicada' ? '#4ADE80' : item.status_code === 'adjudicada' ? '#60A5FA' : '#9CA3AF'
                        }}>
                          <CheckCircle2 style={{ width: 11, height: 11 }} />
                          {item.status_code.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 11, color: '#6A6888', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock style={{ width: 11, height: 11 }} /> Cierre: {formatDate(item.closing_at || item.published_at)}
                        </span>
                      </div>
                    </td>

                    {/* Actions: View API + Copy Code + Direct Mercado Publico Link */}
                    <td style={{ padding: '16px 20px', verticalAlign: 'top', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => {
                            setSelectedItem({ ...item, official_url: officialUrl });
                          }}
                          style={{ background: 'rgba(108,60,225,0.15)', border: '1px solid rgba(108,60,225,0.3)', color: '#A78BFA', padding: '6px 12px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                        >
                          <Code2 style={{ width: 13, height: 13 }} /> Ficha API
                        </button>

                        <button
                          onClick={() => handleCopyCode(item.external_code)}
                          title="Copiar código al portapapeles para pegar en tu panel de Mercado Público"
                          style={{ background: copiedCode === item.external_code ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)', border: `1px solid ${copiedCode === item.external_code ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.12)'}`, color: copiedCode === item.external_code ? '#4ADE80' : '#D4D2F0', padding: '6px 10px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          {copiedCode === item.external_code ? <Check style={{ width: 13, height: 13 }} /> : <Copy style={{ width: 13, height: 13 }} />}
                          {copiedCode === item.external_code ? 'Copiado' : 'Copiar'}
                        </button>
                        
                        <a
                          href={officialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir licitación oficial en MercadoPublico.cl"
                          style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)', color: '#FCD34D', padding: '6px 12px', borderRadius: 9, fontSize: 12, fontWeight: 700, textDecoration: 'none', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                        >
                          <ExternalLink style={{ width: 13, height: 13 }} /> Mercado Público
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Stats Bar */}
      <div style={{ padding: '16px 24px', background: '#060611', borderTop: '1px solid rgba(108,60,225,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontSize: 12.5, color: '#7674A0' }}>
          Mostrando <strong style={{ color: '#E8E7F5' }}>{filteredItems.length}</strong> de <strong style={{ color: '#E8E7F5' }}>{opportunities.length}</strong> oportunidades B2G registradas en tiempo real.
        </div>
        <div style={{ fontSize: 12, color: '#8B89B0', display: 'flex', alignItems: 'center', gap: 16 }}>
          <span>Monto Total Indexado: <strong style={{ color: '#4ADE80' }}>{formatCLP(opportunities.reduce((acc, curr) => acc + curr.amount_estimated, 0))}</strong></span>
        </div>
      </div>

      {/* Modal detail drawer */}
      {/* Ficha real, servida por el gateway. Acá vivía un modal de ~560 líneas
          alimentado por `MAP_TENDER_DETAILS`: adjuntos, actas, proveedores, RUTs
          y montos inventados, con un fallback que le atribuía a cualquier
          licitación los documentos de otra. Ver FichaLicitacion.tsx. */}
      {selectedItem && (
        <FichaLicitacion item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}
