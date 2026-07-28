import { useState, useMemo } from 'react';
import { ShieldCheck, Zap, ArrowUpRight, Check, ChevronDown, ChevronRight, Search, Layers } from 'lucide-react';
import { DevCreditPricingCalculator } from './DevCreditPricingCalculator';

export interface QuotasTabProps {
  usageCount?: number;
}

const TIER_SPECS = [
  { name: 'Basic', credits: 1000, burst: 60, price: '$19/mes', accent: '#0EB5C6', desc: 'Ideal para MVPs, prototipos REST y consultas macroeconómicas' },
  { name: 'Pro', credits: 15000, burst: 180, price: '$79/mes', accent: '#8B5CF6', desc: 'Para aplicaciones SaaS en producción, Animus MCP Server y GraphRAG MoE activo', popular: true },
  { name: 'Premium', credits: 100000, burst: 300, price: '$299/mes', accent: '#EC4899', desc: 'Alto rendimiento B2G, IA predictiva de adjudicación, MCP ilimitado y SLAs' },
  { name: 'Enterprise', credits: 1000000, burst: 600, price: 'Custom', accent: '#F59E0B', desc: 'Cuota personalizada con infraestructura dedicada e integraciones agénticas custom' },
];

interface EndpointCostItem {
  endpoint: string;
  category: string;
  cost: number;
  type: string;
}

const ALL_ENDPOINT_COSTS: EndpointCostItem[] = [
  // 🏛️ Mercado Público (B2G)
  { endpoint: 'GET /api/v1/mercado-publico/health', category: 'Mercado Público (B2G)', cost: 1, type: 'Estado de conectores ChileCompra' },
  { endpoint: 'GET /api/v1/mercado-publico/opportunities', category: 'Mercado Público (B2G)', cost: 25, type: 'Buscador Unificado (Licitaciones + Compra Ágil)' },
  { endpoint: 'GET /api/v1/mercado-publico/opportunities/:id', category: 'Mercado Público (B2G)', cost: 15, type: 'Detalle Oportunidad por ID/UUID' },
  { endpoint: 'GET /api/v1/mercado-publico/licitaciones', category: 'Mercado Público (B2G)', cost: 25, type: 'Listado Paginado Licitaciones Públicas' },
  { endpoint: 'GET /api/v1/mercado-publico/licitaciones/:codigo_externo', category: 'Mercado Público (B2G)', cost: 15, type: 'Ficha Detallada Licitación' },
  { endpoint: 'GET /api/v1/mercado-publico/compra-agil', category: 'Mercado Público (B2G)', cost: 25, type: 'Cotizaciones Rápidas Compra Ágil (<300 UTM)' },
  { endpoint: 'GET /api/v1/mercado-publico/ordenes-compra', category: 'Mercado Público (B2G)', cost: 30, type: 'Órdenes de Compra (OCs) Emitidas' },
  { endpoint: 'GET /api/v1/mercado-publico/ordenes-compra/:codigo_oc', category: 'Mercado Público (B2G)', cost: 15, type: 'Detalle Orden de Compra por Código' },
  { endpoint: 'GET /api/v1/mercado-publico/organismos', category: 'Mercado Público (B2G)', cost: 20, type: 'Directorio Organismos Compradores' },
  { endpoint: 'GET /api/v1/mercado-publico/organismos/:id', category: 'Mercado Público (B2G)', cost: 15, type: 'Ficha Organismo Comprador' },
  { endpoint: 'GET /api/v1/mercado-publico/proveedores/:rut', category: 'Mercado Público (B2G)', cost: 40, type: 'Perfil B2G 360° Proveedor por RUT' },
  { endpoint: 'GET /api/v1/mercado-publico/proveedores/:rut/vs-mercado', category: 'Mercado Público (B2G)', cost: 45, type: 'Benchmark Proveedor vs Media UNSPSC' },
  { endpoint: 'GET /api/v1/mercado-publico/proveedores/:rut/oportunidades', category: 'Mercado Público (B2G)', cost: 45, type: 'Matriz Oportunidades Recomendadas' },
  { endpoint: 'GET /api/v1/mercado-publico/benchmarks', category: 'Mercado Público (B2G)', cost: 30, type: 'Benchmarks B2G Agregados por Rubro' },
  { endpoint: 'GET /api/v1/mercado-publico/metricas/:rut', category: 'Mercado Público (B2G)', cost: 20, type: 'Métricas M1-M10 Pre-calculadas B2G' },
  { endpoint: 'GET /api/v1/mercado-publico/analitica/precios', category: 'Mercado Público (B2G)', cost: 50, type: 'Analítica Precios UNSPSC P10-P90' },
  { endpoint: 'GET /api/v1/mercado-publico/compradores/:rut/historial', category: 'Mercado Público (B2G)', cost: 35, type: 'Historial 360° Comprador Estado' },
  { endpoint: 'GET /api/v1/mercado-publico/proveedores/:rut/perfil-competitivo', category: 'Mercado Público (B2G)', cost: 40, type: 'Scorecard Competidor B2G & Win Rate' },
  { endpoint: 'POST /api/v1/mercado-publico/busquedas/guardadas', category: 'Mercado Público (B2G)', cost: 10, type: 'Guardar Búsqueda Multi-criterio' },
  { endpoint: 'POST /api/v1/mercado-publico/alertas', category: 'Mercado Público (B2G)', cost: 10, type: 'Registrar Reglas de Alertas en Tiempo Real' },
  { endpoint: 'POST /api/v1/mercado-publico/webhooks', category: 'Mercado Público (B2G)', cost: 15, type: 'Suscripción Webhooks Push HMAC' },
  { endpoint: 'POST /api/v1/mercado-publico/exportaciones', category: 'Mercado Público (B2G)', cost: 60, type: 'Exportación Dataset Parquet/JSONL' },
  { endpoint: 'GET /api/v1/mercado-publico/convenio-marco', category: 'Mercado Público (B2G)', cost: 25, type: 'Catálogo Tiendas Convenio Marco' },
  { endpoint: 'GET /api/v1/mercado-publico/grandes-compras', category: 'Mercado Público (B2G)', cost: 30, type: 'Monitor Grandes Compras (>1000 UTM)' },
  { endpoint: 'GET /api/v1/mercado-publico/consultas-mercado', category: 'Mercado Público (B2G)', cost: 20, type: 'Consultas al Mercado RFIs Abiertas' },
  { endpoint: 'GET /api/v1/mercado-publico/tratos-directos', category: 'Mercado Público (B2G)', cost: 35, type: 'Auditoría Resoluciones Tratos Directos' },
  { endpoint: 'POST /api/v1/mercado-publico/ai/scoring-oportunidad', category: 'Mercado Público (B2G)', cost: 25, type: 'IA Predictiva Score Compatibilidad' },
  { endpoint: 'POST /api/v1/mercado-publico/ai/prediccion-adjudicacion', category: 'Mercado Público (B2G)', cost: 40, type: 'IA Predictiva Win Probability %' },

  // 📈 Datos Económicos & Macro
  { endpoint: 'GET /api/v1/data/economy/chile/snapshot', category: 'Datos Económicos & Macro', cost: 1, type: 'Snapshot Macroeconómico Oficial Chile' },
  { endpoint: 'GET /api/v1/data/economy/chile/uf', category: 'Datos Económicos & Macro', cost: 1, type: 'Serie UF Unidad de Fomento' },
  { endpoint: 'GET /api/v1/data/economy/chile/ipc', category: 'Datos Económicos & Macro', cost: 1, type: 'Serie IPC Inflación Mensual/Anual' },
  { endpoint: 'GET /api/v1/data/economy/chile/tpm', category: 'Datos Económicos & Macro', cost: 1, type: 'TPM Tasa Política Monetaria BCCh' },
  { endpoint: 'GET /api/v1/data/economy/chile/dolar', category: 'Datos Económicos & Macro', cost: 1, type: 'Dólar Observado USD/CLP' },
  { endpoint: 'GET /api/v1/data/economy/chile/euro', category: 'Datos Económicos & Macro', cost: 1, type: 'Euro Observado EUR/CLP' },
  { endpoint: 'GET /api/v1/data/economy/chile/imacec', category: 'Datos Económicos & Macro', cost: 1, type: 'Índice Mensual Actividad Económica' },
  { endpoint: 'GET /api/v1/data/economy/chile/utm', category: 'Datos Económicos & Macro', cost: 1, type: 'Unidad Tributaria Mensual UTM' },
  { endpoint: 'GET /api/v1/data/economy/chile/ipom', category: 'Datos Económicos & Macro', cost: 5, type: 'Informe de Política Monetaria BCCh' },
  { endpoint: 'GET /api/v1/data/economy/indicators', category: 'Datos Económicos & Macro', cost: 1, type: 'Catálogo Indicadores Disponibles' },
  { endpoint: 'GET /api/v1/data/economy/releases', category: 'Datos Económicos & Macro', cost: 1, type: 'Calendario Publicación Indicadores' },
  { endpoint: 'GET /api/v1/data/economy/series/:series_id', category: 'Datos Económicos & Macro', cost: 2, type: 'Serie Histórica por ID' },
  { endpoint: 'GET /api/v1/data/economy/global/snapshot', category: 'Datos Económicos & Macro', cost: 2, type: 'Snapshot Indicadores Globales' },
  { endpoint: 'GET /api/v1/data/commodities', category: 'Datos Económicos & Macro', cost: 2, type: 'Commodities (Cobre, Petróleo, Litio)' },
  { endpoint: 'GET /api/v1/data/commodities/copper', category: 'Datos Económicos & Macro', cost: 2, type: 'Precio del Cobre Cochilco/LME' },
  { endpoint: 'GET /api/v1/data/markets/chile/ipsa', category: 'Datos Económicos & Macro', cost: 2, type: 'Índice Accionario IPSA' },
  { endpoint: 'GET /api/v1/data/financial-system/entities', category: 'Datos Económicos & Macro', cost: 5, type: 'Entidades Financieras CMF' },
  { endpoint: 'GET /api/v1/data/companies/insolvencies', category: 'Datos Económicos & Macro', cost: 10, type: 'Boletín Concursal Quiebras Superir' },
  { endpoint: 'GET /api/v1/data/companies/:rut/insolvency-status', category: 'Datos Económicos & Macro', cost: 5, type: 'Estatus Concursal por RUT' },
  { endpoint: 'GET /api/v1/data/companies/:rut/economic-profile', category: 'Datos Económicos & Macro', cost: 10, type: 'Perfil Económico SII & Rubros' },
  { endpoint: 'GET /api/v1/data/labor/unemployment', category: 'Datos Económicos & Macro', cost: 2, type: 'Tasa Desempleo INE' },
  { endpoint: 'GET /api/v1/data/labor/wages', category: 'Datos Económicos & Macro', cost: 2, type: 'Índice de Salarios e Inflación' },
  { endpoint: 'GET /api/v1/data/investment-projects', category: 'Datos Económicos & Macro', cost: 15, type: 'Catálogo Proyectos Inversión SEIA' },
  { endpoint: 'GET /api/v1/data/company-events/constitutions', category: 'Datos Económicos & Macro', cost: 10, type: 'Constituciones Diario Oficial' },
  { endpoint: 'GET /api/v1/data/analytics/correlations', category: 'Datos Económicos & Macro', cost: 20, type: 'Matriz Correlaciones Macroeconómicas' },
  { endpoint: 'POST /api/v1/data/insights/macro-brief', category: 'Datos Económicos & Macro', cost: 25, type: 'Brief Macroeconómico IA' },
  { endpoint: 'POST /api/v1/data/insights/scenario-analysis', category: 'Datos Económicos & Macro', cost: 35, type: 'Simulación Escenarios Sensibilidad' },
  { endpoint: 'GET /api/v1/data/economy', category: 'Datos Económicos & Macro', cost: 1, type: 'Macro Data Consolidada' },
  { endpoint: 'GET /api/v1/data/macro', category: 'Datos Económicos & Macro', cost: 1, type: 'Series Históricas FRED' },

  // 🧠 GraphRAG & Intelligence
  { endpoint: 'POST /api/v1/intel/query', category: 'GraphRAG & Intelligence', cost: 15, type: 'GraphRAG Unificado + 1 LLM' },
  { endpoint: 'POST /api/v1/intel/query/moe', category: 'GraphRAG & Intelligence', cost: 35, type: 'Mixture of Experts (5 Expertos)' },
  { endpoint: 'GET /api/v1/intel/experts', category: 'GraphRAG & Intelligence', cost: 1, type: 'Catálogo de Expertos Activos' },
  { endpoint: 'POST /api/v1/intel/experts/:expert_id/query', category: 'GraphRAG & Intelligence', cost: 20, type: 'Consulta a Experto Específico' },
  { endpoint: 'POST /api/v1/intel/assessments/tender-fit', category: 'GraphRAG & Intelligence', cost: 25, type: 'Evaluación Ajuste Licitación' },
  { endpoint: 'POST /api/v1/intel/assessments/company-risk', category: 'GraphRAG & Intelligence', cost: 30, type: 'Evaluación Riesgo Corporativo' },
  { endpoint: 'POST /api/v1/intel/assessments/macro-impact', category: 'GraphRAG & Intelligence', cost: 25, type: 'Impacto Macroeconómico en Oferta' },
  { endpoint: 'POST /api/v1/intel/assessments/win-probability', category: 'GraphRAG & Intelligence', cost: 40, type: 'Estimación Probabilidad de Ganar' },
  { endpoint: 'POST /api/v1/intel/assessments/buyer-profile', category: 'GraphRAG & Intelligence', cost: 35, type: 'Perfilamiento IA Comprador' },
  { endpoint: 'POST /api/v1/intel/reports', category: 'GraphRAG & Intelligence', cost: 50, type: 'Generación Informe Ejecutivo' },
  { endpoint: 'GET /api/v1/intel/reports/:report_id', category: 'GraphRAG & Intelligence', cost: 5, type: 'Descarga Informe Generado' },
  { endpoint: 'GET /api/v1/intel/citations/:citation_id', category: 'GraphRAG & Intelligence', cost: 2, type: 'Detalle Evidencia Citada' },
  { endpoint: 'POST /api/v1/intel/citations/:citation_id/verify', category: 'GraphRAG & Intelligence', cost: 5, type: 'Verificación Procedencia Evidencia' },
  { endpoint: 'GET /api/v1/intel/graph/entities', category: 'GraphRAG & Intelligence', cost: 10, type: 'Búsqueda Entidades Knowledge Graph' },
  { endpoint: 'GET /api/v1/intel/graph/entities/:entity_id/neighbors', category: 'GraphRAG & Intelligence', cost: 15, type: 'Vecindario Sub-Grafo Entidad' },
  { endpoint: 'POST /api/v1/intel/graph/paths', category: 'GraphRAG & Intelligence', cost: 20, type: 'Cálculo Caminos Mínimos Entidades' },
  { endpoint: 'POST /api/v1/intel/sessions', category: 'GraphRAG & Intelligence', cost: 5, type: 'Crear Sesión de Razonamiento' },
  { endpoint: 'POST /api/v1/intel/estimate', category: 'GraphRAG & Intelligence', cost: 1, type: 'Estimación Costo Créditos Consulta' },

  // 📦 RAG & Vault Vectorial
  { endpoint: 'POST /api/v1/rag/query', category: 'RAG & Vault Vectorial', cost: 5, type: 'Búsqueda Vectorial pgvector HNSW' },
  { endpoint: 'POST /api/v1/rag/vaults', category: 'RAG & Vault Vectorial', cost: 10, type: 'Crear Espacio Privado Vault' },
  { endpoint: 'GET /api/v1/rag/vaults', category: 'RAG & Vault Vectorial', cost: 2, type: 'Listar Vaults del Usuario' },
  { endpoint: 'GET /api/v1/rag/vaults/:vault_id/stats', category: 'RAG & Vault Vectorial', cost: 2, type: 'Estadísticas Nodos e Indexación' },
  { endpoint: 'POST /api/v1/rag/vaults/:vault_id/collections', category: 'RAG & Vault Vectorial', cost: 5, type: 'Crear Colección Vectorial' },
  { endpoint: 'POST /api/v1/rag/documents/text', category: 'RAG & Vault Vectorial', cost: 10, type: 'Indexación Texto Plano / PDF' },
  { endpoint: 'POST /api/v1/rag/uploads', category: 'RAG & Vault Vectorial', cost: 5, type: 'Generar URL Presigned Carga' },
  { endpoint: 'POST /api/v1/rag/batches', category: 'RAG & Vault Vectorial', cost: 20, type: 'Ingesta Masiva Lote Documentos' },
  { endpoint: 'GET /api/v1/rag/documents', category: 'RAG & Vault Vectorial', cost: 2, type: 'Listado Documentos Indexados' },
  { endpoint: 'DELETE /api/v1/rag/documents/:document_id', category: 'RAG & Vault Vectorial', cost: 2, type: 'Eliminar Documento Vectorial' },
  { endpoint: 'GET /api/v1/rag/documents/:document_id/chunks', category: 'RAG & Vault Vectorial', cost: 5, type: 'Listar Chunks & Embeddings' },
  { endpoint: 'POST /api/v1/rag/context', category: 'RAG & Vault Vectorial', cost: 10, type: 'Ensamblar Contexto HyDE' },
  { endpoint: 'GET /api/v1/rag/embedding-profiles', category: 'RAG & Vault Vectorial', cost: 1, type: 'Catálogo Modelos Embedding' },
  { endpoint: 'POST /api/v1/rag/ingest/text', category: 'RAG & Vault Vectorial', cost: 10, type: 'Ingesta RAG Directa' },

  // 🕸️ Grafo Societario (S-Pulse)
  { endpoint: 'GET /api/v1/data/spulse/companies/search', category: 'Grafo Societario (S-Pulse)', cost: 2, type: 'Búsqueda Empresas S-Pulse' },
  { endpoint: 'GET /api/v1/data/spulse/companies/:rut/profile', category: 'Grafo Societario (S-Pulse)', cost: 5, type: 'Ficha Corporativa S-Pulse por RUT' },
  { endpoint: 'GET /api/v1/data/spulse/companies/:rut/network', category: 'Grafo Societario (S-Pulse)', cost: 10, type: 'Grafo Socios & Participaciones' },
  { endpoint: 'GET /api/v1/data/companies/:rut/legal-representatives', category: 'Grafo Societario (S-Pulse)', cost: 5, type: 'Representantes Legales Diario Oficial' },
  { endpoint: 'POST /api/v1/data/companies/:rut/b2g-conflicts', category: 'Grafo Societario (S-Pulse)', cost: 25, type: 'Detector Conflictos B2G & PEP' },

  // 🤖 Animus MCP Server (Model Context Protocol)
  { endpoint: 'MCP Tool: animus_search_b2g_tenders', category: 'Animus MCP Server (Model Context Protocol)', cost: 25, type: 'MCP Agéntico B2G Licitaciones' },
  { endpoint: 'MCP Tool: animus_get_corporate_mesh', category: 'Animus MCP Server (Model Context Protocol)', cost: 10, type: 'MCP Agéntico Grafo S-Pulse' },
  { endpoint: 'MCP Tool: animus_get_macro_indicators', category: 'Animus MCP Server (Model Context Protocol)', cost: 1, type: 'MCP Agéntico Macro Snapshot' },
  { endpoint: 'MCP Tool: animus_query_moe_graphrag', category: 'Animus MCP Server (Model Context Protocol)', cost: 35, type: 'MCP Agéntico Mixture of Experts' },
  { endpoint: 'MCP Tool: animus_predict_win_probability', category: 'Animus MCP Server (Model Context Protocol)', cost: 40, type: 'MCP Agéntico Win Probability %' },
  { endpoint: 'POST /mcp/v1/tools/call', category: 'Animus MCP Server (Model Context Protocol)', cost: 1, type: 'Invocación remota de herramienta MCP' },
];

export function QuotasTab({ usageCount }: QuotasTabProps) {
  const [currentTier] = useState<'basic' | 'pro' | 'premium' | 'admin'>('pro');
  const [searchQuery, setSearchQuery] = useState('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'Mercado Público (B2G)': true,
    'Datos Económicos & Macro': false,
    'GraphRAG & Intelligence': false,
    'RAG & Vault Vectorial': false,
    'Grafo Societario (S-Pulse)': false,
    'Animus MCP Server (Model Context Protocol)': true,
  });

  const toggleSection = (sectionName: string) => {
    setOpenSections(prev => ({ ...prev, [sectionName]: !prev[sectionName] }));
  };

  const toggleAll = (expand: boolean) => {
    const updated: Record<string, boolean> = {};
    Object.keys(groupedEndpoints).forEach(sec => { updated[sec] = expand; });
    setOpenSections(updated);
  };

  const filteredEndpoints = useMemo(() => {
    if (!searchQuery.trim()) return ALL_ENDPOINT_COSTS;
    const q = searchQuery.toLowerCase();
    return ALL_ENDPOINT_COSTS.filter(e => 
      e.endpoint.toLowerCase().includes(q) || 
      e.category.toLowerCase().includes(q) || 
      e.type.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const groupedEndpoints = useMemo(() => {
    const map: Record<string, EndpointCostItem[]> = {};
    filteredEndpoints.forEach(item => {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    });
    return map;
  }, [filteredEndpoints]);

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
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                background: 'linear-gradient(135deg, #6C3CE1 0%, #8B5CF6 100%)', borderRadius: 10,
                color: '#fff', fontSize: 12.5, fontWeight: 700, textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(108,60,225,0.3)',
              }}
            >
              Actualizar Plan <ArrowUpRight style={{ width: 14, height: 14 }} />
            </a>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>
              <span style={{ color: '#A09EC0', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Zap style={{ width: 14, height: 14, color: barColor }} /> Consumo de Créditos del Mes
              </span>
              <span style={{ color: '#E8E7F5', fontFamily: 'monospace' }}>
                {creditsUsed.toLocaleString()} / {creditLimit.toLocaleString()} créditos ({pctUsed}%)
              </span>
            </div>
            <div style={{ height: 10, borderRadius: 100, background: '#16162A', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ height: '100%', width: `${pctUsed}%`, background: barColor, borderRadius: 100, transition: 'width 0.6s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: '#5A5A78' }}>
              <span>Reseteo de cuota: 1° de cada mes</span>
              <span>Burst limit: {tierMeta.burst} req/min</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Collapsible Endpoint Weighting Table ──────────────── */}
      <div style={cardStyle}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(108,60,225,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h4 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 800, color: '#E8E7F5', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers style={{ width: 18, height: 18, color: '#8B5CF6' }} /> Tabla de Ponderación por Endpoint & Herramienta MCP
            </h4>
            <span style={{ fontSize: 12, color: '#7674A0' }}>
              Mostrando {filteredEndpoints.length} de {ALL_ENDPOINT_COSTS.length} endpoints y herramientas agénticas catalogadas
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', minWidth: 260 }}>
              <Search style={{ position: 'absolute', left: 12, top: 9, width: 14, height: 14, color: '#6C3CE1' }} />
              <input
                type="text"
                placeholder="Buscar por endpoint, MCP o rubro..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '7px 12px 7px 34px', background: '#090914', border: '1px solid rgba(108,60,225,0.2)',
                  borderRadius: 8, color: '#E8E7F5', fontSize: 12.5, outline: 'none',
                }}
              />
            </div>
            <button
              onClick={() => toggleAll(true)}
              style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', color: '#A78BFA', padding: '6px 12px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
            >
              Expandir Todos
            </button>
            <button
              onClick={() => toggleAll(false)}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#9896B8', padding: '6px 12px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
            >
              Colapsar Todos
            </button>
          </div>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.entries(groupedEndpoints).map(([catName, list]) => {
            const isOpen = openSections[catName] ?? false;
            return (
              <div key={catName} style={{ border: '1px solid rgba(108,60,225,0.12)', borderRadius: 12, overflow: 'hidden', background: '#090914' }}>
                <button
                  onClick={() => toggleSection(catName)}
                  style={{
                    width: '100%', padding: '14px 18px', background: '#0E0E1F', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
                    color: '#E8E7F5', textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {isOpen ? <ChevronDown style={{ width: 16, height: 16, color: '#8B5CF6' }} /> : <ChevronRight style={{ width: 16, height: 16, color: '#6C3CE1' }} />}
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 700, color: '#F3F4F6' }}>
                      {catName}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 100, background: 'rgba(139,92,246,0.15)', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.3)' }}>
                      {list.length} endpoints
                    </span>
                  </div>
                  <span style={{ fontSize: 11.5, color: '#7674A0' }}>
                    {isOpen ? 'Ocultar desplegable' : 'Ver desplegable'}
                  </span>
                </button>

                {isOpen && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: '#080812', borderBottom: '1px solid rgba(108,60,225,0.08)', color: '#6C3CE1', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.5px' }}>
                          <th style={{ textAlign: 'left', padding: '10px 18px' }}>Endpoint / Herramienta MCP</th>
                          <th style={{ textAlign: 'left', padding: '10px 18px' }}>Detalle de Proceso</th>
                          <th style={{ textAlign: 'right', padding: '10px 18px' }}>Costo en Créditos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                            <td style={{ padding: '10px 18px', fontFamily: 'monospace', fontSize: 12, color: item.endpoint.startsWith('MCP') ? '#C084FC' : item.endpoint.startsWith('POST') ? '#0EB5C6' : '#2DD4BF' }}>
                              {item.endpoint}
                            </td>
                            <td style={{ padding: '10px 18px', color: '#9896B8' }}>{item.type}</td>
                            <td style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 800, color: item.cost >= 35 ? '#F59E0B' : '#E8E7F5', fontFamily: 'monospace' }}>
                              {item.cost} {item.cost === 1 ? 'crédito' : 'créditos'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
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
                  ...cardStyle,
                  padding: 20,
                  border: isSelected ? `2px solid ${t.accent}` : '1px solid rgba(108,60,225,0.12)',
                  position: 'relative',
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                }}
              >
                {t.popular && (
                  <span style={{ position: 'absolute', top: 12, right: 12, fontSize: 9.5, fontWeight: 800, padding: '2px 8px', borderRadius: 100, background: '#8B5CF6', color: '#fff', textTransform: 'uppercase' }}>
                    POPULAR
                  </span>
                )}
                <div>
                  <h5 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 800, color: '#E8E7F5', margin: '0 0 4px' }}>
                    Plan {t.name}
                  </h5>
                  <div style={{ fontSize: 22, fontWeight: 900, color: t.accent, margin: '6px 0 10px', fontFamily: "'Space Grotesk', sans-serif" }}>
                    {t.price}
                  </div>
                  <p style={{ fontSize: 12, color: '#7674A0', margin: '0 0 16px', lineHeight: 1.4 }}>{t.desc}</p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, fontSize: 12, color: '#C4B5FD' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Check style={{ width: 13, height: 13, color: '#10B981' }} /> {t.credits.toLocaleString()} créditos / mes
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Check style={{ width: 13, height: 13, color: '#10B981' }} /> {t.burst} req/min burst
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Dev-Only Credit Pricing & Unit Economics Calculator ──────────────── */}
      <DevCreditPricingCalculator />

    </div>
  );
}

export default QuotasTab;
