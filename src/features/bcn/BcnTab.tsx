import { useState, useEffect } from 'react';
import {
  Search, FileText, GitCommit, Share2, Bell, Copy,
  ExternalLink, Scale
} from 'lucide-react';
import { toast } from 'sonner';
import {
  searchBcnNorms, getBcnNormJson, getBcnRecentModifications,
  getBcnNormVersions, getBcnNormRelations,
  type BcnNormSummary, type BcnNormJson, type BcnNormModification, type BcnNormRelation
} from '@/services/bcnService';

export function BcnTab() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [norms, setNorms] = useState<BcnNormSummary[]>([]);
  const [selectedNorm, setSelectedNorm] = useState<BcnNormSummary | null>(null);

  // Sub-view in norm inspector
  const [viewMode, setViewMode] = useState<'json_tree' | 'versions' | 'graph' | 'alerts'>('json_tree');

  // Loaded details
  const [normJson, setNormJson] = useState<BcnNormJson | null>(null);
  const [versions, setVersions] = useState<Array<{ version: string; fecha: string; modificador: string; resumen: string }>>([]);
  const [relations, setRelations] = useState<BcnNormRelation[]>([]);
  const [alerts, setAlerts] = useState<BcnNormModification[]>([]);

  // Initial fetch
  const executeSearch = async (searchTerm: string) => {
    setLoading(true);
    try {
      const results = await searchBcnNorms(searchTerm);
      setNorms(results);
      if (results.length > 0 && !selectedNorm) {
        handleSelectNorm(results[0]);
      }
    } catch (_e) {
      toast.error('Error al consultar el servicio BCN Ley Chile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    executeSearch('');
    getBcnRecentModifications(30).then(setAlerts);
  }, []);

  const handleSelectNorm = async (norm: BcnNormSummary) => {
    setSelectedNorm(norm);
    setLoading(true);
    try {
      const [jsonData, versionsData, relationsData] = await Promise.all([
        getBcnNormJson(norm.idNorma),
        getBcnNormVersions(norm.idNorma),
        getBcnNormRelations(norm.idNorma),
      ]);
      setNormJson(jsonData);
      setVersions(versionsData);
      setRelations(relationsData);
    } catch (_e) {
      toast.error('No se pudo cargar la norma estructurada');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCitation = (articleNum: string, incisoNum?: number) => {
    if (!selectedNorm) return;
    const incText = incisoNum ? `, inciso ${incisoNum}°` : '';
    const citation = `Art. ${articleNum}${incText}, ${selectedNorm.titulo} (Ley Chile idNorma=${selectedNorm.idNorma})`;
    navigator.clipboard.writeText(citation);
    toast.success('Cita jurídica copiada al portapapeles');
  };

  return (
    <div style={{ color: '#F3F4F6', fontFamily: 'system-ui, sans-serif' }}>
      {/* ── Banner Superior ───────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(108,60,225,0.12) 100%)',
        border: '1px solid rgba(16,185,129,0.3)',
        borderRadius: 16, padding: 24, marginBottom: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, #10B981, #0EB5C6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(16,185,129,0.4)',
          }}>
            <Scale style={{ width: 26, height: 26, color: '#FFF' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#FFF' }}>Ley Chile & BCN Legal Suite</h2>
              <span style={{
                background: 'rgba(16,185,129,0.2)', color: '#34D399', border: '1px solid rgba(52,211,153,0.4)',
                padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              }}>
                BCN API Token Activo
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9CA3AF' }}>
              Servicio de inteligencia normativa con 6 endpoints prioritarios BCN: Búsqueda `/61/`, JSON estructurado `/7.2/`, Alertas `/62/`, Versiones `/80/`, Jerarquía `/9/` y Grafo `/846/`.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setViewMode('alerts')}
            style={{
              background: viewMode === 'alerts' ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.06)',
              border: viewMode === 'alerts' ? '1px solid #10B981' : '1px solid rgba(255,255,255,0.12)',
              color: '#FFF', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <Bell style={{ width: 15, height: 15, color: '#34D399' }} />
            Alertas Novedades ({alerts.length})
          </button>
        </div>
      </div>

      {/* ── Buscador Jurídico ────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <form
          onSubmit={e => { e.preventDefault(); executeSearch(query); }}
          style={{ display: 'flex', gap: 12, marginBottom: 14 }}
        >
          <div style={{ position: 'relative', flex: 1 }}>
            <Search style={{ position: 'absolute', left: 14, top: 13, width: 18, height: 18, color: '#6B7280' }} />
            <input
              type="text"
              placeholder="Buscar normas por concepto ('protección de datos', 'ciberseguridad', 'compras públicas', N° de Ley)..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{
                width: '100%', background: '#0D0E1A', border: '1px solid rgba(255,255,255,0.14)',
                color: '#FFF', padding: '12px 14px 12px 42px', borderRadius: 10, fontSize: 14, outline: 'none',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none',
              color: '#FFF', padding: '0 24px', borderRadius: 10, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 0 14px rgba(16,185,129,0.3)',
            }}
          >
            <Search style={{ width: 16, height: 16 }} />
            Buscar en Ley Chile
          </button>
        </form>

        {/* Quick Suggestion Pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#6B7280' }}>Sugerencias:</span>
          {['Protección de Datos', 'Ciberseguridad', 'Compras Públicas', 'EIRL', 'Todas'].map(pill => (
            <button
              key={pill}
              onClick={() => {
                const q = pill === 'Todas' ? '' : pill;
                setQuery(q);
                executeSearch(q);
              }}
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#9CA3AF', padding: '4px 12px', borderRadius: 16, fontSize: 12, cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {pill}
            </button>
          ))}
        </div>
      </div>

      {/* ── Layout Principal: Lista de Normas + Inspector Detallado ───────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 380px) 1fr', gap: 24, alignItems: 'start' }}>
        {/* Lista de Resultados BCN */}
        <div style={{ background: '#0D0E1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#9CA3AF', marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>
            <span>RESULTADOS DE BÚSQUEDA BCN</span>
            <span style={{ color: '#10B981' }}>{norms.length} encontradas</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 600, overflowY: 'auto' }}>
            {norms.map(norm => {
              const isSelected = selectedNorm?.idNorma === norm.idNorma;
              return (
                <div
                  key={norm.idNorma}
                  onClick={() => handleSelectNorm(norm)}
                  style={{
                    background: isSelected ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.02)',
                    border: isSelected ? '1px solid #10B981' : '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 10, padding: 14, cursor: 'pointer', transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#10B981', fontFamily: 'monospace' }}>
                      idNorma: {norm.idNorma}
                    </span>
                    <span style={{ fontSize: 11, color: '#6B7280' }}>Pub: {norm.fechaPublicacion}</span>
                  </div>
                  <h4 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#FFF', lineHeight: 1.4 }}>
                    {norm.titulo}
                  </h4>
                  <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF', lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {norm.resumenBrief}
                  </p>
                </div>
              );
            })}

            {norms.length === 0 && !loading && (
              <div style={{ padding: 32, textAlign: 'center', color: '#6B7280', fontSize: 13 }}>
                No se encontraron normas para la consulta realizada.
              </div>
            )}
          </div>
        </div>

        {/* Inspector Detallado de Norma */}
        {selectedNorm ? (
          <div style={{ background: '#0D0E1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 24 }}>
            {/* Header de la Norma Seleccionada */}
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <span style={{ fontSize: 12, color: '#34D399', fontWeight: 600 }}>{selectedNorm.organismo}</span>
                  <h3 style={{ margin: '4px 0 8px', fontSize: 18, fontWeight: 700, color: '#FFF' }}>
                    {selectedNorm.titulo}
                  </h3>
                </div>
                <a
                  href={selectedNorm.urlLeyChile}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, color: '#0EB5C6', fontSize: 12,
                    textDecoration: 'none', background: 'rgba(14,181,198,0.1)', padding: '6px 12px', borderRadius: 6,
                  }}
                >
                  Abrir en Ley Chile <ExternalLink style={{ width: 13, height: 13 }} />
                </a>
              </div>

              {/* Selector de sub-vistas */}
              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setViewMode('json_tree')}
                  style={{
                    background: viewMode === 'json_tree' ? 'rgba(16,185,129,0.2)' : 'transparent',
                    border: viewMode === 'json_tree' ? '1px solid #10B981' : '1px solid transparent',
                    color: viewMode === 'json_tree' ? '#34D399' : '#9CA3AF',
                    padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <FileText style={{ width: 14, height: 14 }} /> Estructura JSON & Citas (/7.2/ + /9/)
                </button>

                <button
                  onClick={() => setViewMode('versions')}
                  style={{
                    background: viewMode === 'versions' ? 'rgba(14,181,198,0.2)' : 'transparent',
                    border: viewMode === 'versions' ? '1px solid #0EB5C6' : '1px solid transparent',
                    color: viewMode === 'versions' ? '#38BDF8' : '#9CA3AF',
                    padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <GitCommit style={{ width: 14, height: 14 }} /> Evolución & Versiones (/80/)
                </button>

                <button
                  onClick={() => setViewMode('graph')}
                  style={{
                    background: viewMode === 'graph' ? 'rgba(192,132,252,0.2)' : 'transparent',
                    border: viewMode === 'graph' ? '1px solid #C084FC' : '1px solid transparent',
                    color: viewMode === 'graph' ? '#E9D5FF' : '#9CA3AF',
                    padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Share2 style={{ width: 14, height: 14 }} /> Grafo de Relaciones (/846/)
                </button>
              </div>
            </div>

            {/* View 1: JSON Tree & Articles */}
            {viewMode === 'json_tree' && normJson && (
              <div>
                <div style={{ background: '#05050D', padding: 14, borderRadius: 8, marginBottom: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 12, color: '#9CA3AF', display: 'flex', gap: 20 }}>
                    <span>Estado: <strong style={{ color: '#10B981' }}>{normJson.meta.estado}</strong></span>
                    <span>Tipo: <strong style={{ color: '#FFF' }}>{normJson.meta.tipoNorma}</strong></span>
                    <span>Promulgación: <strong style={{ color: '#FFF' }}>{normJson.meta.fechaPromulgacion}</strong></span>
                  </div>
                </div>

                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#FFF', margin: '0 0 12px' }}>
                  Artículos y Estructura Jerárquica (/servicio/9/)
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {normJson.estructura.map((item, idx) => (
                    <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 16 }}>
                      {item.tipo === 'titulo' ? (
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Título {item.numero} — {item.nombre}
                        </div>
                      ) : (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#10B981' }}>
                              Artículo {item.numero}°: {item.nombre}
                            </span>
                            <button
                              onClick={() => handleCopyCitation(item.numero)}
                              style={{
                                background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
                                color: '#34D399', padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 4,
                              }}
                            >
                              <Copy style={{ width: 12, height: 12 }} /> Copiar Cita
                            </button>
                          </div>
                          <p style={{ fontSize: 13, color: '#D1D5DB', margin: '0 0 10px', lineHeight: 1.5 }}>
                            {item.textoHtml}
                          </p>

                          {item.incisos && item.incisos.length > 0 && (
                            <div style={{ background: '#05050D', padding: 10, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {item.incisos.map((inc, i) => (
                                <div key={i} style={{ fontSize: 12, color: '#9CA3AF', display: 'flex', justifyContent: 'space-between' }}>
                                  <span>Inc. {inc.numero}°: {inc.texto}</span>
                                  <button
                                    onClick={() => handleCopyCitation(item.numero, inc.numero)}
                                    style={{ background: 'none', border: 'none', color: '#0EB5C6', cursor: 'pointer', fontSize: 11 }}
                                  >
                                    Citar inc.
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* View 2: Versions & Timeline */}
            {viewMode === 'versions' && (
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#FFF', margin: '0 0 14px' }}>
                  Historial de Versiones & Modificadores (/servicio/80/)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {versions.map((ver, idx) => (
                    <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(14,181,198,0.2)', borderRadius: 10, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, color: '#38BDF8', fontSize: 13 }}>{ver.version}</span>
                        <span style={{ fontSize: 12, color: '#6B7280' }}>Fecha: {ver.fecha}</span>
                      </div>
                      <div style={{ fontSize: 13, color: '#FFF', fontWeight: 600, marginBottom: 4 }}>Modificador: {ver.modificador}</div>
                      <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF' }}>{ver.resumen}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* View 3: Norm Relations Graph */}
            {viewMode === 'graph' && (
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#FFF', margin: '0 0 14px' }}>
                  Grafo de Relaciones Normativas (/servicio/846/)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                  {relations.map((rel, idx) => (
                    <div key={idx} style={{ background: 'rgba(192,132,252,0.08)', border: '1px solid rgba(192,132,252,0.3)', borderRadius: 10, padding: 14 }}>
                      <span style={{
                        background: rel.tipoRelacion === 'deroga' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
                        color: rel.tipoRelacion === 'deroga' ? '#EF4444' : '#10B981',
                        padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                      }}>
                        {rel.tipoRelacion}
                      </span>
                      <h5 style={{ margin: '8px 0 4px', fontSize: 13, fontWeight: 700, color: '#FFF' }}>
                        {rel.tituloDestino}
                      </h5>
                      <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF' }}>{rel.descripcion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* View 4: Regulatory Change Alerts */}
            {viewMode === 'alerts' && (
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#FFF', margin: '0 0 14px' }}>
                  Alertas de Novedades Regulatorias (/servicio/62/)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {alerts.map(alt => (
                    <div key={alt.idNorma} style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, color: '#F59E0B', fontSize: 13 }}>{alt.titulo}</span>
                        <span style={{ fontSize: 11, color: '#6B7280' }}>Modificado: {alt.fechaModificacion}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF' }}>Origen: {alt.normaOrigen}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: '#0D0E1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 48, textAlign: 'center', color: '#6B7280' }}>
            Selecciona una norma del panel izquierdo para inspeccionar su estructura JSON, jerarquía de artículos, vigencia y grafo de relaciones.
          </div>
        )}
      </div>
    </div>
  );
}
