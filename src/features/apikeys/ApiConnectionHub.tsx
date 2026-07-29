import { useState } from 'react';
import { Copy, Check, Terminal, Bot, ExternalLink, Globe } from 'lucide-react';
import { toast } from 'sonner';

const CANONICAL_BASE_URL = 'https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/api-v1';
const LIVE_PORTAL_URL = 'https://bralidus.vercel.app';

export function ApiConnectionHub() {
  const [activeTab, setActiveTab] = useState<'mcp' | 'curl' | 'ts' | 'python'>('mcp');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedLlmsUrl, setCopiedLlmsUrl] = useState(false);

  const copyToClipboard = (text: string, type: 'url' | 'snippet' | 'llms') => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
      toast.success('Base URL de producción copiada al portapapeles');
    } else if (type === 'snippet') {
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
      toast.success('Código de integración copiado');
    } else {
      setCopiedLlmsUrl(true);
      setTimeout(() => setCopiedLlmsUrl(false), 2000);
      toast.success('URL del archivo /llms.txt copiada');
    }
  };

  const getSnippet = () => {
    switch (activeTab) {
      case 'mcp':
        return `// 1. Instalar o ejecutar como servidor MCP (Cursor IDE / Claude Desktop)
// Archivo de configuración (claude_desktop_config.json o mcpServers en Cursor):
{
  "mcpServers": {
    "animus-engine": {
      "command": "npx",
      "args": ["-y", "animus-engine-mcp"],
      "env": {
        "ANIMUS_API_KEY": "demo_public_key"
      }
    }
  }
}`;
      case 'curl':
        return `# Llamada HTTP cURL canónica con Bearer Token
curl -X GET "${CANONICAL_BASE_URL}/data/macro" \\
  -H "Authorization: Bearer demo_public_key" \\
  -H "Accept: application/json" \\
  -H "X-Client: Animus-Engine/1.0"`;
      case 'ts':
        return `// Node.js / TypeScript Integration (Native fetch)
const res = await fetch('${CANONICAL_BASE_URL}/data/macro', {
  headers: {
    'Authorization': 'Bearer demo_public_key',
    'Accept': 'application/json',
    'X-Client': 'Animus-Engine/1.0'
  }
});

const data = await res.json();
console.log('Animus UF en vivo:', data.indicators.CMF_uf_diario.valor);`;
      case 'python':
        return `# Python (Requests / LangChain Agent Tool)
import requests

url = "${CANONICAL_BASE_URL}/data/macro"
headers = {
    "Authorization": "Bearer demo_public_key",
    "Accept": "application/json",
    "X-Client": "Animus-Engine/1.0"
}

response = requests.get(url, headers=headers)
macro_data = response.json()
print("UF Hoy:", macro_data["indicators"]["CMF_uf_diario"]["valor"])`;
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(145deg, rgba(14,14,26,0.95), rgba(20,18,36,0.95))',
      border: '1px solid rgba(108,60,225,0.28)',
      borderRadius: 16,
      padding: '20px 24px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    }}>
      {/* ── Header del Hub de Conexión ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(14,181,198,0.14)', border: '1px solid rgba(14,181,198,0.35)',
              borderRadius: 100, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#0EB5C6'
            }}>
              <Globe style={{ width: 12, height: 12 }} />
              API LIVE READY
            </span>
            <span style={{ fontSize: 12, color: '#8A88A8', fontWeight: 500 }}>
              Metodología Estándar LLM-First
            </span>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#F3F2FD', margin: 0 }}>
            🔌 Hub de Conexión de API & Configuración para LLMs
          </h3>
          <p style={{ fontSize: 12.5, color: '#9492B4', margin: '4px 0 0' }}>
            Usa tu API Key autenticada conectando a nuestra Base URL oficial o permite que tu agente IA auto-programe la integración.
          </p>
        </div>
      </div>

      {/* ── Base URL Banner ── */}
      <div style={{
        background: 'rgba(108,60,225,0.12)',
        border: '1px solid rgba(108,60,225,0.3)',
        borderRadius: 12,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 18,
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, background: '#6C3CE1',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Terminal style={{ width: 15, height: 15, color: '#fff' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, color: '#C4B5FD' }}>
              Base URL Canónica de Producción (REST / RaaS)
            </div>
            <code style={{
              fontSize: 13, color: '#F3F2FD', fontWeight: 600, fontFamily: 'monospace',
              display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>
              {CANONICAL_BASE_URL}
            </code>
          </div>
        </div>
        <button
          onClick={() => copyToClipboard(CANONICAL_BASE_URL, 'url')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: copiedUrl ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)',
            border: copiedUrl ? '1px solid #10B981' : '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8, padding: '7px 14px',
            cursor: 'pointer', color: copiedUrl ? '#34D399' : '#E0DFF5',
            fontSize: 12, fontWeight: 700, transition: 'all 0.15s',
          }}
        >
          {copiedUrl ? <Check style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}
          {copiedUrl ? '¡URL Copiada!' : 'Copiar Base URL'}
        </button>
      </div>

      {/* ── Banner Estándar LLM-First / SEO Automático (Metodología Fintoc) ── */}
      <div style={{
        background: 'linear-gradient(90deg, rgba(14,181,198,0.11), rgba(108,60,225,0.15))',
        border: '1px solid rgba(14,181,198,0.32)',
        borderRadius: 12,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 18,
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Bot style={{ width: 22, height: 22, color: '#0EB5C6', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#E8E7F5', display: 'flex', alignItems: 'center', gap: 6 }}>
              ¿Programas con Cursor, Claude, o un Agente IA?
              <span style={{ fontSize: 10, background: 'rgba(14,181,198,0.2)', color: '#0EB5C6', padding: '1.5px 6px', borderRadius: 4 }}>
                llms.txt Standard
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: '#9492B4', marginTop: 2 }}>
              Nuestra documentación no requiere login. Entrega nuestro enlace <code style={{ color: '#0EB5C6' }}>/llms.txt</code> a tu IA para auto-programar tu app en segundos.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => copyToClipboard(`${LIVE_PORTAL_URL}/llms.txt`, 'llms')}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: copiedLlmsUrl ? 'rgba(16,185,129,0.2)' : 'rgba(14,181,198,0.2)',
              border: copiedLlmsUrl ? '1px solid #10B981' : '1px solid rgba(14,181,198,0.45)',
              borderRadius: 7, padding: '6px 12px',
              cursor: 'pointer', color: copiedLlmsUrl ? '#34D399' : '#0EB5C6',
              fontSize: 11.5, fontWeight: 700,
            }}
          >
            {copiedLlmsUrl ? <Check style={{ width: 13, height: 13 }} /> : <Copy style={{ width: 13, height: 13 }} />}
            {copiedLlmsUrl ? '¡Copiado!' : 'Copiar URL /llms.txt'}
          </button>
          <a
            href={`${LIVE_PORTAL_URL}/api-reference.md`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 7, padding: '6px 10px',
              color: '#D1D0E5', fontSize: 11.5, fontWeight: 600, textDecoration: 'none'
            }}
          >
            Ver Docs <ExternalLink style={{ width: 11, height: 11 }} />
          </a>
        </div>
      </div>

      {/* ── Selector de Snippets ── */}
      <div>
        <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8, marginBottom: 12, overflowX: 'auto' }}>
          {[
            { id: 'mcp', label: '🤖 Cursor / Claude (MCP Stdio)' },
            { id: 'curl', label: '⚡ cURL / HTTP' },
            { id: 'ts', label: '🟢 TypeScript / Node.js' },
            { id: 'python', label: '🐍 Python / LangChain' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                background: activeTab === tab.id ? 'rgba(108,60,225,0.2)' : 'transparent',
                border: '1px solid',
                borderColor: activeTab === tab.id ? '#6C3CE1' : 'transparent',
                borderRadius: 8,
                padding: '6px 12px',
                cursor: 'pointer',
                color: activeTab === tab.id ? '#C4B5FD' : '#8A88A8',
                fontSize: 12,
                fontWeight: activeTab === tab.id ? 700 : 500,
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative' }}>
          <pre style={{
            background: '#090912',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            padding: '14px 16px',
            fontSize: 12,
            fontFamily: 'monospace',
            color: '#E0DFF5',
            overflowX: 'auto',
            margin: 0,
            lineHeight: 1.5,
          }}>
            {getSnippet()}
          </pre>
          <button
            onClick={() => copyToClipboard(getSnippet(), 'snippet')}
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              display: 'flex', alignItems: 'center', gap: 5,
              background: copiedSnippet ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.1)',
              border: copiedSnippet ? '1px solid #10B981' : '1px solid rgba(255,255,255,0.18)',
              borderRadius: 6,
              padding: '5px 10px',
              cursor: 'pointer',
              color: copiedSnippet ? '#34D399' : '#D1D0E5',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {copiedSnippet ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
            {copiedSnippet ? '¡Copiado!' : 'Copiar'}
          </button>
        </div>
      </div>
    </div>
  );
}
