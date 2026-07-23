import { useState } from 'react';
import { BookOpen, Copy, ChevronRight, Play, Key, ShieldCheck, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { API_DOCS, METHOD_COLORS, BASE, ENDPOINTS } from '@/data/api-docs';

interface DocsTabProps { onPlayground: () => void; }

export function DocsTab({ onPlayground }: DocsTabProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [snippetLang, setSnippetLang] = useState<'curl' | 'node' | 'python'>('curl');

  const ep = ENDPOINTS[0];
  const snippets = {
    curl: `curl -X POST "${BASE}${ep.path}" \\\n  -H "Authorization: Bearer <TU_API_KEY>" \\\n  -H "Content-Type: application/json" \\\n  -d '${ep.defaultBody.replace(/\n/g, ' ')}'`,
    node: `const res = await fetch("${BASE}${ep.path}", {\n  method: "POST",\n  headers: { Authorization: "Bearer <TU_API_KEY>", "Content-Type": "application/json" },\n  body: JSON.stringify(${ep.defaultBody})\n});\nconst data = await res.json();`,
    python: `import requests\ndata = requests.post(\n  "${BASE}${ep.path}",\n  headers={"Authorization": "Bearer <TU_API_KEY>"},\n  json=${ep.defaultBody}\n).json()`,
  };

  const cardStyle = { background: '#0E0E1A', border: '1px solid rgba(108,60,225,0.12)', borderRadius: 16, overflow: 'hidden' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={cardStyle}>
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid rgba(108,60,225,0.08)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <BookOpen style={{ width: 18, height: 18, color: '#8B5CF6' }} />
                <h2 style={{ fontSize: 19, fontWeight: 800, color: '#E8E7F5', margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>Documentación Bralidus RaaS API v1</h2>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 100, background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.22)', color: '#A78BFA' }}>OpenAPI 3.0</span>
              </div>
              <p style={{ fontSize: 13, color: '#7674A0', maxWidth: 640, margin: 0, lineHeight: 1.6 }}>
                Guía de referencia completa para integrar el motor Bralidus Mixture of Experts (MoE), consultas GraphRAG, inteligencia B2G Licitus, grafo societario S-Pulse e indicadores macroeconómicos en tus aplicaciones.
              </p>
            </div>
            <button onClick={onPlayground}
              style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(14,181,198,0.85)', border: 'none', borderRadius: 12, padding: '10px 18px', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 }}
            >
              <Play style={{ width: 14, height: 14 }} /> Probar en Playground
            </button>
          </div>

          {/* Quickstart Snippets */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontSize: 11.5, fontWeight: 700, color: '#6A6888', textTransform: 'uppercase', letterSpacing: '0.7px', margin: 0 }}>Quickstart Code Snippets</h3>
              <div style={{ display: 'flex', gap: 4, background: '#08080F', border: '1px solid rgba(108,60,225,0.14)', borderRadius: 10, padding: 3 }}>
                {(['curl', 'node', 'python'] as const).map(lang => (
                  <button key={lang} onClick={() => setSnippetLang(lang)}
                    style={{ padding: '4px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, background: snippetLang === lang ? '#6C3CE1' : 'none', color: snippetLang === lang ? '#fff' : '#6A6888' }}
                  >{lang === 'node' ? 'Node.js / JS' : lang === 'python' ? 'Python (httpx)' : 'cURL'}</button>
                ))}
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <pre style={{ background: '#030309', border: '1px solid rgba(108,60,225,0.10)', color: '#A78BFA', fontSize: 12, borderRadius: 12, padding: '14px 16px', overflowX: 'auto', fontFamily: 'monospace', lineHeight: 1.7, margin: 0 }}>
                {snippets[snippetLang]}
              </pre>
              <button onClick={() => { navigator.clipboard.writeText(snippets[snippetLang]); toast.success('Copiado al portapapeles'); }}
                style={{ position: 'absolute', top: 12, right: 12, padding: 7, background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#7674A0' }}
              ><Copy style={{ width: 13, height: 13 }} /></button>
            </div>
          </div>
        </div>
      </div>

      {/* Auth, Quotas, Errors */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        {[
          { icon: Key, iconColor: '#0EB5C6', title: 'Autenticación', content: (
            <><p style={{ fontSize: 12.5, color: '#7674A0', lineHeight: 1.6, margin: '0 0 10px' }}>Todas las peticiones requieren tu Developer API Key en el encabezado <code style={{ color: '#0EB5C6', fontFamily: 'monospace' }}>Authorization</code>:</p>
            <code style={{ display: 'block', background: '#08080F', border: '1px solid rgba(14,181,198,0.15)', color: '#0EB5C6', padding: '8px 12px', borderRadius: 9, fontSize: 11.5, fontFamily: 'monospace' }}>Authorization: Bearer val_live_...</code></>
          )},
          { icon: ShieldCheck, iconColor: '#8B5CF6', title: 'Cuotas & Rate Limits', content: (
            <><p style={{ fontSize: 12.5, color: '#7674A0', lineHeight: 1.6, margin: '0 0 10px' }}>Límites de velocidad por IP y Developer Key:</p>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[['Starter Tier', '60 req/min'], ['Growth / Pro', '300 req/min'], ['Enterprise MoE', 'Personalizado']].map(([tier, rate]) => (
                <li key={tier} style={{ fontSize: 12, color: '#D4D2F0' }}>• {tier}: <span style={{ fontWeight: 700, color: '#A78BFA' }}>{rate}</span></li>
              ))}
            </ul></>
          )},
          { icon: Activity, iconColor: '#F59E0B', title: 'Respuestas de Error', content: (
            <><p style={{ fontSize: 12.5, color: '#7674A0', lineHeight: 1.6, margin: '0 0 10px' }}>Formato estándar JSON de error devuelto por la API Gateway:</p>
            <code style={{ display: 'block', background: '#08080F', border: '1px solid rgba(245,158,11,0.15)', color: '#F59E0B', padding: '8px 12px', borderRadius: 9, fontSize: 11, fontFamily: 'monospace' }}>{`{ "error": "Invalid API key", "status": 401 }`}</code></>
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

      {/* Endpoint Catalog */}
      <div style={cardStyle}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(108,60,225,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen style={{ width: 14, height: 14, color: '#8B5CF6' }} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#C4B5FD' }}>Catálogo Completo de Endpoints</span>
          <span style={{ fontSize: 11.5, color: '#5A5A78', fontFamily: 'monospace' }}>({API_DOCS.length} endpoints)</span>
        </div>
        <div>
          {API_DOCS.map((doc, i) => (
            <div key={i} style={{ borderBottom: '1px solid rgba(108,60,225,0.05)' }}>
              <button onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: `${METHOD_COLORS[doc.method] ?? '#888'}22`, color: METHOD_COLORS[doc.method] ?? '#888', flexShrink: 0, fontFamily: 'monospace' }}>{doc.method}</span>
                <code style={{ fontSize: 12.5, color: '#D4D2F0', fontFamily: 'monospace', fontWeight: 600 }}>{doc.path}</code>
                <span style={{ fontSize: 12, color: '#5A5A78', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.description.slice(0, 70)}…</span>
                <ChevronRight style={{ width: 14, height: 14, flexShrink: 0, transform: expandedIdx === i ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', color: expandedIdx === i ? '#8B5CF6' : '#5A5A78' }} />
              </button>
              {expandedIdx === i && (
                <div style={{ padding: '4px 20px 20px', background: 'rgba(108,60,225,0.03)', borderTop: '1px solid rgba(108,60,225,0.06)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <p style={{ fontSize: 12.5, color: '#9896B8', lineHeight: 1.65, margin: '12px 0 0' }}>{doc.description}</p>

                  <div>
                    <p style={{ fontSize: 10.5, fontWeight: 700, color: '#5A5A78', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.7px' }}>Autenticación Requerida</p>
                    <code style={{ display: 'block', background: '#08080F', color: '#0EB5C6', padding: '8px 12px', borderRadius: 9, fontSize: 12, fontFamily: 'monospace' }}>{'Authorization: Bearer <TU_API_KEY>'}</code>
                  </div>

                  {doc.params.length > 0 && (
                    <div>
                      <p style={{ fontSize: 10.5, fontWeight: 700, color: '#5A5A78', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.7px' }}>Parámetros de Entrada</p>
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
                                <td style={{ padding: '8px 14px', color: '#7674A0', fontFamily: 'inherit' }}>{p.description}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div>
                    <p style={{ fontSize: 10.5, fontWeight: 700, color: '#5A5A78', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.7px' }}>Ejemplo de Respuesta JSON</p>
                    <pre style={{ background: '#030309', border: '1px solid rgba(108,60,225,0.10)', color: '#4ADE80', fontSize: 11.5, borderRadius: 10, padding: '12px 14px', overflowX: 'auto', fontFamily: 'monospace', lineHeight: 1.65, margin: 0 }}>{doc.responseExample}</pre>
                  </div>

                  <div>
                    <p style={{ fontSize: 10.5, fontWeight: 700, color: '#5A5A78', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.7px' }}>Códigos de Estado y Error</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                      {doc.errorCodes.map((code, j) => <span key={j} style={{ fontSize: 11.5, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', color: '#F87171', padding: '3px 10px', borderRadius: 8, fontFamily: 'monospace' }}>{code}</span>)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
