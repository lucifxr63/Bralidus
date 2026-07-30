import { useState, useMemo } from 'react';
import { BookOpen, ChevronRight, Play, Key, ShieldCheck, Activity, Search, Layers, Sparkles } from 'lucide-react';
import { API_DOCS, METHOD_COLORS, EndpointDoc } from '@/data/api-docs';
import { MercadoPublicoLiveTable } from '@/components/MercadoPublicoLiveTable';
import { EconomyLiveExplorer } from '@/components/explorers/EconomyLiveExplorer';
import { IntelligenceLiveExplorer } from '@/components/explorers/IntelligenceLiveExplorer';
import { VectorVaultLiveExplorer } from '@/components/explorers/VectorVaultLiveExplorer';
import { WebhooksLiveExplorer } from '@/components/explorers/WebhooksLiveExplorer';

interface DocsTabProps { onPlayground: () => void; }

export function DocsTab({ onPlayground }: DocsTabProps) {
  const [activeSection, setActiveSection] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'docs' | 'explorer'>('explorer');

  // Unique sections list
  const sections = useMemo(() => {
    const set = new Set<string>();
    API_DOCS.forEach(doc => { if (doc.section) set.add(doc.section); });
    return Array.from(set);
  }, []);

  // Filtered docs based on section and search term
  const filteredDocs = useMemo(() => {
    return API_DOCS.filter(doc => {
      const matchSection = activeSection === 'all' || doc.section === activeSection;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q || 
        doc.path.toLowerCase().includes(q) || 
        doc.description.toLowerCase().includes(q) ||
        doc.method.toLowerCase().includes(q) ||
        (doc.section && doc.section.toLowerCase().includes(q));
      return matchSection && matchQuery;
    });
  }, [activeSection, searchQuery]);

  // Grouped docs when "all" is selected
  const groupedDocs = useMemo(() => {
    const groups: Record<string, EndpointDoc[]> = {};
    filteredDocs.forEach(doc => {
      const sec = doc.section || 'General';
      if (!groups[sec]) groups[sec] = [];
      groups[sec].push(doc);
    });
    return groups;
  }, [filteredDocs]);

  const cardStyle = { background: '#0E0E1A', border: '1px solid rgba(108,60,225,0.12)', borderRadius: 16, overflow: 'hidden' };

  // Render the appropriate Live Explorer component depending on the active section tab
  const renderLiveExplorer = () => {
    switch (activeSection) {
      case 'Mercado Público (B2G)':
        return <MercadoPublicoLiveTable />;
      case 'Datos Económicos & Macro':
        return <EconomyLiveExplorer />;
      case 'GraphRAG & Intelligence':
        return <IntelligenceLiveExplorer />;
      case 'RAG & Vault Vectorial':
        return <VectorVaultLiveExplorer />;
      // La sección 'Grafo Societario (S-Pulse)' se retiró: S-Pulse quedó en
      // stand-by sin API, y el explorador pegaba a /data/companies/:rut/profile
      // y /ownership-mesh, que responden 503.
      case 'Webhooks & Servicios':
        return <WebhooksLiveExplorer />;
      default:
        // Default show Mercado Público table + option to explore others
        return <MercadoPublicoLiveTable />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Hero Banner */}
      <div style={cardStyle}>
        <div style={{ padding: 26 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <BookOpen style={{ width: 20, height: 20, color: '#8B5CF6' }} />
                <h2 style={{ fontSize: 21, fontWeight: 800, color: '#E8E7F5', margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>Documentación & Exploradores en Vivo v2.0</h2>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', color: '#A78BFA' }}>OpenAPI 3.0</span>
              </div>
              <p style={{ fontSize: 13.5, color: '#9896B8', maxWidth: 680, margin: 0, lineHeight: 1.6 }}>
                Explora interactivamente Mercado Público (B2G), Indicadores Macroeconómicos (BCCh, FRED), Animus MoE GraphRAG, RAG Vectorial pgvector y Webhooks.
              </p>
            </div>

            {/* Mode Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', background: '#05050C', border: '1px solid rgba(108,60,225,0.2)', borderRadius: 12, padding: 3 }}>
                <button
                  onClick={() => setViewMode('explorer')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, background: viewMode === 'explorer' ? '#F59E0B' : 'none', color: viewMode === 'explorer' ? '#000' : '#8B89B0', transition: 'all 0.2s' }}
                >
                  <Sparkles style={{ width: 14, height: 14 }} /> Exploradores en Vivo
                </button>
                <button
                  onClick={() => setViewMode('docs')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, background: viewMode === 'docs' ? '#6C3CE1' : 'none', color: viewMode === 'docs' ? '#fff' : '#8B89B0', transition: 'all 0.2s' }}
                >
                  <Layers style={{ width: 14, height: 14 }} /> Catálogo de Endpoints
                </button>
              </div>

              <button onClick={onPlayground}
                style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(14,181,198,0.85)', border: 'none', borderRadius: 12, padding: '10px 16px', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 }}
              >
                <Play style={{ width: 14, height: 14 }} /> Playground
              </button>
            </div>
          </div>

          {/* Section Category Tabs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button
              onClick={() => setActiveSection('all')}
              style={{
                padding: '8px 16px', borderRadius: 10, border: '1px solid', cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
                background: activeSection === 'all' ? '#6C3CE1' : 'rgba(108,60,225,0.06)',
                borderColor: activeSection === 'all' ? '#6C3CE1' : 'rgba(108,60,225,0.16)',
                color: activeSection === 'all' ? '#fff' : '#9896B8', transition: 'all 0.15s'
              }}
            >
              Todas las Secciones
            </button>
            {sections.map(sec => {
              const count = API_DOCS.filter(d => d.section === sec).length;
              const isActive = activeSection === sec;
              return (
                <button
                  key={sec}
                  onClick={() => setActiveSection(sec)}
                  style={{
                    padding: '8px 16px', borderRadius: 10, border: '1px solid', cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
                    background: isActive ? '#6C3CE1' : 'rgba(108,60,225,0.06)',
                    borderColor: isActive ? '#6C3CE1' : 'rgba(108,60,225,0.16)',
                    color: isActive ? '#fff' : '#9896B8', transition: 'all 0.15s'
                  }}
                >
                  {sec} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Feature Section 1: Live Explorers per Section */}
      {viewMode === 'explorer' && (
        <div>
          {renderLiveExplorer()}
        </div>
      )}

      {/* Key Info Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        {[
          { icon: Key, iconColor: '#0EB5C6', title: 'Autenticación HTTP', content: (
            <><p style={{ fontSize: 12.5, color: '#7674A0', lineHeight: 1.6, margin: '0 0 10px' }}>Todas las peticiones requieren tu Developer Key en la cabecera:</p>
            <code style={{ display: 'block', background: '#08080F', border: '1px solid rgba(14,181,198,0.15)', color: '#0EB5C6', padding: '8px 12px', borderRadius: 9, fontSize: 11.5, fontFamily: 'monospace' }}>Authorization: Bearer val_live_...</code></>
          )},
          { icon: ShieldCheck, iconColor: '#8B5CF6', title: 'Créditos Ponderados', content: (
            <><p style={{ fontSize: 12.5, color: '#7674A0', lineHeight: 1.6, margin: '0 0 10px' }}>Los créditos se descuentan según la complejidad del endpoint:</p>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[['Economía / Macro', '1 crédito'], ['Mercado Público B2G', '15–45 créditos'], ['GraphRAG MoE', '35 créditos']].map(([tier, rate]) => (
                <li key={tier} style={{ fontSize: 12, color: '#D4D2F0' }}>• {tier}: <span style={{ fontWeight: 700, color: '#A78BFA' }}>{rate}</span></li>
              ))}
            </ul></>
          )},
          { icon: Activity, iconColor: '#F59E0B', title: 'Formato Estándar JSON', content: (
            <><p style={{ fontSize: 12.5, color: '#7674A0', lineHeight: 1.6, margin: '0 0 10px' }}>Respuestas normalizadas con metadata de procedencia:</p>
            <code style={{ display: 'block', background: '#08080F', border: '1px solid rgba(245,158,11,0.15)', color: '#F59E0B', padding: '8px 12px', borderRadius: 9, fontSize: 11, fontFamily: 'monospace' }}>{`{ "data": [...], "meta": { "total": 142 } }`}</code></>
          )},
        ].map(({ icon: Icon, iconColor, title, content }) => (
          <div key={title} style={cardStyle}>
            <div style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Icon style={{ width: 15, height: 15, color: iconColor }} />
                <h4 style={{ fontSize: 13.5, fontWeight: 700, color: '#E8E7F5', margin: 0 }}>{title}</h4>
              </div>
              {content}
            </div>
          </div>
        ))}
      </div>

      {/* Feature Section 2: Sectioned & Searchable Endpoints Catalog */}
      <div style={cardStyle}>
        {/* Section Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(108,60,225,0.1)', background: 'rgba(108,60,225,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <BookOpen style={{ width: 16, height: 16, color: '#8B5CF6' }} />
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#E8E7F5', margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
                Catálogo de Endpoints por Módulo
              </h3>
              <span style={{ fontSize: 12, color: '#7674A0', fontFamily: 'monospace' }}>
                ({filteredDocs.length} de {API_DOCS.length} endpoints)
              </span>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: 260 }}>
              <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#6A6888' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar por URL, método o palabra..."
                style={{ width: '100%', background: '#05050C', border: '1px solid rgba(108,60,225,0.18)', borderRadius: 9, padding: '7px 12px 7px 32px', color: '#E8E7F5', fontSize: 12, outline: 'none' }}
              />
            </div>
          </div>
        </div>

        {/* Endpoints List Grouped by Section */}
        <div>
          {Object.keys(groupedDocs).length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#6A6888', fontSize: 13.5 }}>
              No se encontraron endpoints que coincidan con los filtros seleccionados.
            </div>
          ) : (
            Object.entries(groupedDocs).map(([secTitle, secDocs]) => (
              <div key={secTitle} style={{ borderBottom: '1px solid rgba(108,60,225,0.12)' }}>
                {/* Section Subheader */}
                <div style={{ padding: '12px 24px', background: 'rgba(108,60,225,0.04)', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(108,60,225,0.06)' }}>
                  <Layers style={{ width: 14, height: 14, color: '#8B5CF6' }} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#C4B5FD', letterSpacing: '0.3px' }}>{secTitle}</span>
                  <span style={{ fontSize: 11, color: '#6A6888', fontFamily: 'monospace' }}>• {secDocs.length} endpoints</span>
                </div>

                {/* Section Endpoints Accordion */}
                {secDocs.map((doc) => {
                  const globalIdx = API_DOCS.indexOf(doc);
                  const isExpanded = expandedIdx === globalIdx;
                  return (
                    <div key={doc.path + doc.method} style={{ borderBottom: '1px solid rgba(108,60,225,0.04)' }}>
                      <button onClick={() => setExpandedIdx(isExpanded ? null : globalIdx)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                      >
                        <span style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 6, background: `${METHOD_COLORS[doc.method] ?? '#888'}22`, color: METHOD_COLORS[doc.method] ?? '#888', flexShrink: 0, fontFamily: 'monospace' }}>
                          {doc.method}
                        </span>
                        <code style={{ fontSize: 13, color: '#E8E7F5', fontFamily: 'monospace', fontWeight: 700 }}>{doc.path}</code>
                        <span style={{ fontSize: 12.5, color: '#7674A0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {doc.description}
                        </span>
                        <ChevronRight style={{ width: 14, height: 14, flexShrink: 0, transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', color: isExpanded ? '#8B5CF6' : '#5A5A78' }} />
                      </button>

                      {isExpanded && (
                        <div style={{ padding: '4px 24px 24px', background: 'rgba(108,60,225,0.03)', borderTop: '1px solid rgba(108,60,225,0.06)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                          <p style={{ fontSize: 13, color: '#A78BFA', lineHeight: 1.65, margin: '14px 0 0', fontWeight: 500 }}>{doc.description}</p>

                          <div>
                            <p style={{ fontSize: 10.5, fontWeight: 700, color: '#6A6888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.7px' }}>Autenticación HTTP</p>
                            <code style={{ display: 'block', background: '#05050C', color: '#0EB5C6', padding: '8px 12px', borderRadius: 9, fontSize: 12, fontFamily: 'monospace' }}>{'Authorization: Bearer <TU_API_KEY>'}</code>
                          </div>

                          {doc.params.length > 0 && (
                            <div>
                              <p style={{ fontSize: 10.5, fontWeight: 700, color: '#6A6888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.7px' }}>Parámetros de Entrada</p>
                              <div style={{ overflowX: 'auto', border: '1px solid rgba(108,60,225,0.12)', borderRadius: 10 }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                  <thead style={{ background: 'rgba(108,60,225,0.06)' }}>
                                    <tr>{['Campo', 'Tipo', 'Requerido', 'Descripción'].map(h => <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: '#6A6888' }}>{h}</th>)}</tr>
                                  </thead>
                                  <tbody style={{ fontFamily: 'monospace', fontSize: 11.5 }}>
                                    {doc.params.map((p, j) => (
                                      <tr key={j} style={{ borderTop: '1px solid rgba(108,60,225,0.06)' }}>
                                        <td style={{ padding: '8px 14px', color: '#0EB5C6', fontWeight: 700 }}>{p.name}</td>
                                        <td style={{ padding: '8px 14px', color: '#8B5CF6' }}>{p.type}</td>
                                        <td style={{ padding: '8px 14px' }}>{p.required ? <span style={{ color: '#F87171', fontWeight: 700 }}>Requerido</span> : <span style={{ color: '#5A5A78' }}>Opcional</span>}</td>
                                        <td style={{ padding: '8px 14px', color: '#9896B8', fontFamily: 'inherit' }}>{p.description}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          <div>
                            <p style={{ fontSize: 10.5, fontWeight: 700, color: '#6A6888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.7px' }}>Ejemplo de Respuesta JSON</p>
                            <pre style={{ background: '#030309', border: '1px solid rgba(108,60,225,0.10)', color: '#4ADE80', fontSize: 11.5, borderRadius: 10, padding: '12px 14px', overflowX: 'auto', fontFamily: 'monospace', lineHeight: 1.65, margin: 0 }}>{doc.responseExample}</pre>
                          </div>

                          <div>
                            <p style={{ fontSize: 10.5, fontWeight: 700, color: '#6A6888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.7px' }}>Códigos de Estado y Error</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                              {doc.errorCodes.map((code, j) => <span key={j} style={{ fontSize: 11.5, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', color: '#F87171', padding: '3px 10px', borderRadius: 8, fontFamily: 'monospace' }}>{code}</span>)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
