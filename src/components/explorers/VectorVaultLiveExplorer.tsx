import { useState } from 'react';
import { Database, Search, Cpu, RefreshCw, FileText, Layers, CheckCircle2 } from 'lucide-react';
import { BASE } from '@/data/api-docs';

const DEMO_VECTORS = [
  {
    rank: 1,
    chunk_id: 'chk_iso_27001',
    document_title: 'Bases Administrativas Licitación Salud 2026.pdf',
    location: { page: 18, section: '4.2 Requisitos del oferente' },
    content: 'El proveedor deberá acreditar certificación ISO 27001 en Gestión de Seguridad de la Información emitida por organismo acreditado.',
    scores: { vector: 0.86, lexical: 0.74, reranker: 0.92, final: 0.89 }
  },
  {
    rank: 2,
    chunk_id: 'chk_iso_9001',
    document_title: 'Anexo Técnico Requisitos Especiales.pdf',
    location: { page: 24, section: '5.1 Criterios de Evaluación' },
    content: 'Se evaluará con puntaje adicional la acreditación de la norma de calidad ISO 9001 o equivalente para servicios de software en salud.',
    scores: { vector: 0.81, lexical: 0.68, reranker: 0.85, final: 0.82 }
  }
];

export function VectorVaultLiveExplorer() {
  const [query, setQuery] = useState('certificaciones ISO obligatorias y criterios de evaluacion');
  const [searchMode, setSearchMode] = useState<'hybrid' | 'vector' | 'lexical'>('hybrid');
  const [selectedVault, setSelectedVault] = useState('vault_licitaciones_2026');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(DEMO_VECTORS);
  const [contextPack, setContextPack] = useState<any>(null);

  const handleVectorSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setContextPack(null);
    try {
      const res = await fetch(`${BASE}/rag/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer demo_public_key' },
        body: JSON.stringify({
          query,
          scope: { vault_ids: [selectedVault] },
          search: { mode: searchMode, top_k: 10, rerank: true }
        })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data?.results) setResults(json.data.results);
      }
    } catch {
      // keep demo
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateContextPack = async () => {
    try {
      const res = await fetch(`${BASE}/rag/context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer demo_public_key' },
        body: JSON.stringify({
          query,
          scope: { vault_ids: [selectedVault] },
          budget: { max_tokens: 6000 }
        })
      });
      const data = await res.json();
      setContextPack(data.data);
    } catch {
      setContextPack({
        context_formatted: "## Contexto Documental Extraído (Context Pack)\n\n[1] Bases Administrativas Pág. 18: El proveedor deberá acreditar certificación ISO 27001.\n[2] Anexo Técnico Pág. 24: Se evaluará con puntaje adicional ISO 9001.",
        estimated_tokens: 420
      });
    }
  };

  return (
    <div style={{ background: '#0B0B16', border: '1px solid rgba(14,181,198,0.22)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 12px 36px rgba(0,0,0,0.4)' }}>
      {/* Banner Header */}
      <div style={{ padding: '24px 28px', background: 'linear-gradient(135deg, rgba(14,181,198,0.08) 0%, rgba(139,92,246,0.04) 100%)', borderBottom: '1px solid rgba(14,181,198,0.14)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 10, background: 'rgba(14,181,198,0.15)', color: '#0EB5C6' }}>
            <Database style={{ width: 18, height: 18 }} />
          </span>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: '#E8E7F5', margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
            Explorador en Vivo — Animus Vault &amp; RAG Híbrido v2.0
          </h3>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: 'rgba(14,181,198,0.12)', border: '1px solid rgba(14,181,198,0.3)', color: '#0EB5C6' }}>
            <Cpu style={{ width: 12, height: 12 }} /> HNSW + Lexical + Reranker
          </span>
        </div>
        <p style={{ fontSize: 13.5, color: '#9896B8', maxWidth: 780, margin: 0, lineHeight: 1.6 }}>
          Recupera evidencia documental con precisión empresarial: filtra por Vaults y Colecciones, ejecuta búsquedas híbridas (vectoriales + léxicas) y genera paquetes de contexto formateados para copilotos.
        </p>

        {/* Vault & Search Controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 18, alignItems: 'center' }}>
          {/* Vault Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#05050C', padding: '6px 12px', borderRadius: 11, border: '1px solid rgba(14,181,198,0.2)' }}>
            <Layers style={{ width: 14, height: 14, color: '#0EB5C6' }} />
            <select
              value={selectedVault}
              onChange={(e) => setSelectedVault(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: '#E8E7F5', fontSize: 12.5, fontWeight: 700, outline: 'none', cursor: 'pointer' }}
            >
              <option value="vault_licitaciones_2026" style={{ background: '#090914' }}>Vault: Licitaciones Públicas 2026</option>
              <option value="vault_default" style={{ background: '#090914' }}>Vault: General Workspace</option>
            </select>
          </div>

          {/* Mode Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#05050C', padding: 4, borderRadius: 11, border: '1px solid rgba(14,181,198,0.2)' }}>
            {(['hybrid', 'vector', 'lexical'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setSearchMode(mode)}
                style={{
                  padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800, border: 'none', cursor: 'pointer',
                  background: searchMode === mode ? '#0EB5C6' : 'transparent',
                  color: searchMode === mode ? '#000' : '#8B89B0'
                }}
              >
                {mode === 'hybrid' ? '⚡ Híbrido' : mode === 'vector' ? '🧠 Vector' : '🔤 Léxico'}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div style={{ flex: '1 1 280px', position: 'relative' }}>
            <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#6A6888' }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar cláusula, requisito o concepto..."
              style={{ width: '100%', background: '#05050C', border: '1px solid rgba(14,181,198,0.25)', borderRadius: 11, padding: '10px 14px 10px 36px', color: '#E8E7F5', fontSize: 13, outline: 'none' }}
            />
          </div>

          <button
            onClick={handleVectorSearch}
            disabled={loading}
            style={{ background: '#0EB5C6', border: 'none', color: '#000', padding: '10px 18px', borderRadius: 11, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {loading ? <RefreshCw style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Search style={{ width: 14, height: 14 }} />}
            Ejecutar RAG
          </button>

          <button
            onClick={handleGenerateContextPack}
            style={{ background: 'rgba(139,92,246,0.18)', border: '1px solid rgba(139,92,246,0.35)', color: '#C084FC', padding: '10px 16px', borderRadius: 11, fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <FileText style={{ width: 14, height: 14 }} />
            Context Pack
          </button>
        </div>
      </div>

      {/* Context Pack View */}
      {contextPack && (
        <div style={{ padding: '16px 24px', background: '#070714', borderBottom: '1px solid rgba(139,92,246,0.2)' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#C084FC', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
            <CheckCircle2 style={{ width: 14, height: 14 }} /> Context Pack Formateado para LLMs ({contextPack.estimated_tokens} tokens)
          </span>
          <pre style={{ fontSize: 12, color: '#E8E7F5', background: '#04040A', padding: 12, borderRadius: 10, border: '1px solid rgba(139,92,246,0.2)', whiteSpace: 'pre-wrap', margin: 0 }}>
            {contextPack.context_formatted}
          </pre>
        </div>
      )}

      {/* Vector Results */}
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {results.map((item, idx) => (
          <div key={idx} style={{ background: '#070712', border: '1px solid rgba(14,181,198,0.14)', borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: 'rgba(14,181,198,0.12)', color: '#0EB5C6', fontFamily: 'monospace' }}>
                  #{item.rank} · {item.document_title}
                </span>
                {item.location && (
                  <span style={{ fontSize: 11, color: '#8B89B0', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 4 }}>
                    Pág. {item.location.page} · {item.location.section}
                  </span>
                )}
              </div>

              {/* Reranker & Score Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {item.scores && (
                  <span style={{ fontSize: 11, color: '#8B89B0' }}>
                    Vector: <strong style={{ color: '#E8E7F5' }}>{(item.scores.vector * 100).toFixed(0)}%</strong> | Lexical: <strong style={{ color: '#E8E7F5' }}>{(item.scores.lexical * 100).toFixed(0)}%</strong>
                  </span>
                )}
                <span style={{ fontSize: 13, fontWeight: 900, color: '#4ADE80', fontFamily: 'monospace', background: 'rgba(74,222,128,0.1)', padding: '2px 8px', borderRadius: 6 }}>
                  Score Final: {(item.scores ? item.scores.final * 100 : 89).toFixed(1)}%
                </span>
              </div>
            </div>

            <p style={{ fontSize: 12.5, color: '#9896B8', lineHeight: 1.6, margin: 0, background: '#04040A', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)' }}>
              "{item.content}"
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
