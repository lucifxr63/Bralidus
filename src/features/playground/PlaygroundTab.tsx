import { useState } from 'react';
import { Play, Loader2, Copy, ChevronDown, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { ENDPOINTS, METHOD_COLORS, BASE } from '@/data/api-docs';

interface PlaygroundTabProps {
  onViewDocs: () => void;
}

export function PlaygroundTab({ onViewDocs }: PlaygroundTabProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [body, setBody] = useState(ENDPOINTS[0].defaultBody);
  const [apiKey, setApiKey] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [snippetLang, setSnippetLang] = useState<'curl' | 'node' | 'python'>('curl');

  const ep = ENDPOINTS[selectedIdx];

  const selectEndpoint = (idx: number) => {
    setSelectedIdx(idx);
    setBody(ENDPOINTS[idx].defaultBody);
    setResult(null);
    setStatus(null);
    setShowDropdown(false);
  };

  const snippets = {
    curl: ep.method === 'GET'
      ? `curl "${BASE}${ep.path}" \\\n  -H "Authorization: Bearer <TU_API_KEY>"`
      : `curl -X POST "${BASE}${ep.path}" \\\n  -H "Authorization: Bearer <TU_API_KEY>" \\\n  -H "Content-Type: application/json" \\\n  -d '${ep.defaultBody.replace(/\n/g, ' ')}'`,
    node: ep.method === 'GET'
      ? `const res = await fetch("${BASE}${ep.path}", {\n  headers: { Authorization: "Bearer <TU_API_KEY>" }\n});\nconst data = await res.json();`
      : `const res = await fetch("${BASE}${ep.path}", {\n  method: "POST",\n  headers: { Authorization: "Bearer <TU_API_KEY>", "Content-Type": "application/json" },\n  body: JSON.stringify(${ep.defaultBody})\n});\nconst data = await res.json();`,
    python: ep.method === 'GET'
      ? `import requests\ndata = requests.get(\n  "${BASE}${ep.path}",\n  headers={"Authorization": "Bearer <TU_API_KEY>"}\n).json()`
      : `import requests\ndata = requests.post(\n  "${BASE}${ep.path}",\n  headers={"Authorization": "Bearer <TU_API_KEY>"},\n  json=${ep.defaultBody}\n).json()`,
  };

  const run = async () => {
    if (!apiKey.trim()) { toast.error('Ingresa una API Key'); return; }
    if (ep.method !== 'GET') {
      try { JSON.parse(body); } catch { toast.error('JSON inválido en el body'); return; }
    }
    setLoading(true); setResult(null); setStatus(null);
    try {
      const opts: RequestInit = { method: ep.method, headers: { 'Authorization': `Bearer ${apiKey.trim()}`, 'Content-Type': 'application/json' } };
      if (ep.method !== 'GET' && body) opts.body = body;
      const res = await fetch(`${BASE}${ep.path}`, opts);
      setStatus(res.status);
      setResult(JSON.stringify(await res.json(), null, 2));
    } catch (err) { setResult(JSON.stringify({ error: String(err) }, null, 2)); }
    finally { setLoading(false); }
  };

  const cardStyle = { background: '#0E0E1A', border: '1px solid rgba(108,60,225,0.12)', borderRadius: 16, overflow: 'hidden' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={cardStyle}>
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(108,60,225,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Play style={{ width: 14, height: 14, color: '#6C3CE1' }} />
            <span style={{ fontSize: 13.5, fontWeight: 700, color: '#C4B5FD' }}>Playground API</span>
          </div>
          <button onClick={onViewDocs} style={{ fontSize: 12, color: '#8B5CF6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
            <BookOpen style={{ width: 12, height: 12 }} /> Ver documentación →
          </button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* API Key input */}
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: '#6A6888', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>API Key</label>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder="val_live_XXXX..."
              style={{ width: '100%', background: '#08080F', border: '1px solid rgba(108,60,225,0.18)', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontFamily: 'monospace', color: '#E8E7F5', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Endpoint selector */}
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: '#6A6888', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Endpoint</label>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowDropdown(v => !v)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#08080F', border: '1px solid rgba(108,60,225,0.18)', borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: `${METHOD_COLORS[ep.method]}22`, color: METHOD_COLORS[ep.method] }}>{ep.method}</span>
                  <span style={{ fontSize: 12.5, fontFamily: 'monospace', color: '#D4D2F0' }}>{ep.path}</span>
                </div>
                <ChevronDown style={{ width: 14, height: 14, color: '#6A6888', transform: showDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              {showDropdown && (
                <div style={{ position: 'absolute', zIndex: 20, width: '100%', marginTop: 4, background: '#161625', border: '1px solid rgba(108,60,225,0.18)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}>
                  {ENDPOINTS.map((e, i) => (
                    <button key={i} onClick={() => selectEndpoint(i)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', background: i === selectedIdx ? 'rgba(108,60,225,0.10)' : 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: `${METHOD_COLORS[e.method]}22`, color: METHOD_COLORS[e.method], flexShrink: 0 }}>{e.method}</span>
                      <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#B8B6D4' }}>{e.path}</span>
                      <span style={{ fontSize: 11, color: '#5A5A78', marginLeft: 'auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{e.label.split('—')[1]?.trim()}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Body + Response grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: '#6A6888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {ep.method === 'GET' ? 'Sin body (GET)' : 'Request Body (JSON)'}
              </label>
              {ep.method !== 'GET' ? (
                <textarea value={body} onChange={e => setBody(e.target.value)} rows={10}
                  style={{ background: '#08080F', border: '1px solid rgba(108,60,225,0.14)', borderRadius: 10, padding: '10px 14px', fontSize: 12, fontFamily: 'monospace', color: '#D4D2F0', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                />
              ) : (
                <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#08080F', border: '1px solid rgba(108,60,225,0.10)', borderRadius: 10, color: '#5A5A78', fontSize: 12 }}>
                  Este endpoint no requiere body
                </div>
              )}
              <button onClick={run} disabled={loading}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 0', background: 'linear-gradient(135deg, #6C3CE1, #5B30C4)', border: 'none', borderRadius: 10, cursor: 'pointer', color: '#fff', fontSize: 13.5, fontWeight: 700, opacity: loading ? 0.6 : 1 }}
              >
                {loading ? <><Loader2 style={{ width: 14, height: 14, animation: 'spin 0.8s linear infinite' }} /> Ejecutando...</> : <><Play style={{ width: 14, height: 14 }} /> Ejecutar</>}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: '#6A6888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Response</label>
                {status && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 100, background: status < 300 ? 'rgba(14,181,198,0.12)' : 'rgba(239,68,68,0.12)', color: status < 300 ? '#0EB5C6' : '#F87171' }}>
                    {status}
                  </span>
                )}
              </div>
              <pre style={{ flex: 1, minHeight: 260, background: '#030309', border: '1px solid rgba(108,60,225,0.10)', borderRadius: 10, padding: '12px 14px', fontSize: 11.5, fontFamily: 'monospace', color: '#4ADE80', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.65, margin: 0 }}>
                {loading ? <span style={{ color: '#5A5A78', animation: 'pulse 1.5s ease-in-out infinite' }}>Esperando respuesta...</span>
                  : result ? <span>{result}</span>
                  : <span style={{ color: '#3A3858' }}>{'// La respuesta aparecerá aquí'}</span>
                }
              </pre>
            </div>
          </div>

          {/* Code snippet */}
          <div style={{ borderTop: '1px solid rgba(108,60,225,0.08)', paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#6A6888', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Snippet de código</p>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['curl', 'node', 'python'] as const).map(lang => (
                  <button key={lang} onClick={() => setSnippetLang(lang)}
                    style={{ padding: '4px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, background: snippetLang === lang ? '#6C3CE1' : 'rgba(108,60,225,0.08)', color: snippetLang === lang ? '#fff' : '#7674A0' }}
                  >{lang === 'node' ? 'Node.js' : lang.charAt(0).toUpperCase() + lang.slice(1)}</button>
                ))}
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <pre style={{ background: '#030309', border: '1px solid rgba(108,60,225,0.10)', color: '#C4B5FD', fontSize: 11.5, borderRadius: 10, padding: '12px 14px', overflowX: 'auto', fontFamily: 'monospace', lineHeight: 1.65, margin: 0 }}>
                {snippets[snippetLang]}
              </pre>
              <button onClick={() => { navigator.clipboard.writeText(snippets[snippetLang]); toast.success('Copiado'); }}
                style={{ position: 'absolute', top: 10, right: 10, padding: 6, background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 7, cursor: 'pointer', color: '#7674A0' }}
              ><Copy style={{ width: 12, height: 12 }} /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
