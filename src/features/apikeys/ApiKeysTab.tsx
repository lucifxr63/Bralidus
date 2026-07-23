import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { generateApiKey, hashApiKey } from '@/utils/crypto';
import { toast } from 'sonner';
import { WEBHOOK_EVENTS, BASE } from '@/data/api-docs';
import {
  Key, Plus, Trash2, Copy, Check, AlertCircle, Webhook, Bell,
  List, Search, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { ApiKey, WebhookSub, ApiUsageLog } from '@/types/portal';

const LOGS_PER_PAGE = 15;

interface ApiKeysTabProps {
  keys: ApiKey[];
  setKeys: React.Dispatch<React.SetStateAction<ApiKey[]>>;
  logs: ApiUsageLog[];
  loading: boolean;
  webhooks: WebhookSub[];
  setWebhooks: React.Dispatch<React.SetStateAction<WebhookSub[]>>;
  webhooksLoading: boolean;
  showModal: boolean;
  setShowModal: (v: boolean) => void;
}

export function ApiKeysTab({ keys, setKeys, logs, loading, webhooks, setWebhooks, webhooksLoading, showModal, setShowModal }: ApiKeysTabProps) {
  const [keyName, setKeyName] = useState('');
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [logsSearch, setLogsSearch] = useState('');
  const [logsEndpointFilter, setLogsEndpointFilter] = useState('all');
  const [logsPage, setLogsPage] = useState(0);
  const [showLogsSection, setShowLogsSection] = useState(true);

  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);
  const [webhookCreating, setWebhookCreating] = useState(false);
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);
  const [webhookSecretCopied, setWebhookSecretCopied] = useState(false);

  // Computed
  const uniqueEndpoints = [...new Set(logs.map(l => l.endpoint).filter(Boolean))];
  const filteredLogs = (() => {
    let r = [...logs].reverse();
    if (logsEndpointFilter !== 'all') r = r.filter(l => l.endpoint === logsEndpointFilter);
    if (logsSearch) r = r.filter(l => l.endpoint?.toLowerCase().includes(logsSearch.toLowerCase()));
    return r;
  })();
  const paginatedLogs = filteredLogs.slice(logsPage * LOGS_PER_PAGE, (logsPage + 1) * LOGS_PER_PAGE);

  const handleCreateKey = async () => {
    if (!keyName.trim()) { toast.error('El nombre es requerido'); return; }
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');
      const plainKey = generateApiKey();
      const hashedKey = await hashApiKey(plainKey);
      const prefix = plainKey.substring(0, 14) + '...';
      const { data, error } = await supabase.from('api_keys').insert({
        profile_id: user.id, name: keyName.trim(), key_prefix: prefix, key_hash: hashedKey,
      }).select().single();
      if (error) throw error;
      setKeys([data as ApiKey, ...keys]);
      setNewKeySecret(plainKey);
      toast.success('Llave creada');
    } catch { toast.error('Error al crear la llave'); }
    finally { setCreating(false); }
  };

  const closeModal = () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    setShowModal(false); setKeyName(''); setNewKeySecret(null); setCopied(false);
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('¿Revocar esta llave? Las apps que la usen dejarán de funcionar.')) return;
    try {
      const { error } = await supabase.from('api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      setKeys(keys.map(k => k.id === id ? { ...k, is_active: false, revoked_at: new Date().toISOString() } : k));
      toast.success('Llave revocada');
    } catch { toast.error('Error al revocar'); }
  };

  const handleCreateWebhook = async () => {
    if (!webhookUrl.trim() || !webhookUrl.startsWith('http')) { toast.error('URL inválida — debe empezar con http(s)://'); return; }
    if (webhookEvents.length === 0) { toast.error('Selecciona al menos un evento'); return; }
    setWebhookCreating(true);
    try {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? anonKey;
      const res = await fetch(`${BASE}/api/v1/webhooks`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'apikey': anonKey || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint_url: webhookUrl.trim(), events: webhookEvents }),
      });
      const data = await res.json() as { webhook?: WebhookSub; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setNewWebhookSecret(data.webhook!.secret ?? null);
      setWebhooks(prev => [data.webhook!, ...prev]);
      setWebhookUrl(''); setWebhookEvents([]); setShowWebhookForm(false);
      toast.success('Webhook registrado');
    } catch (err: unknown) { toast.error(`Error: ${err instanceof Error ? err.message : String(err)}`); }
    finally { setWebhookCreating(false); }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('¿Eliminar este webhook?')) return;
    try {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? anonKey;
      const res = await fetch(`${BASE}/api/v1/webhooks/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}`, 'apikey': anonKey || '' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setWebhooks(prev => prev.filter(w => w.id !== id));
      toast.success('Webhook eliminado');
    } catch { toast.error('Error al eliminar el webhook'); }
  };

  const cardStyle = { background: '#0E0E1A', border: '1px solid rgba(108,60,225,0.12)', borderRadius: 16, overflow: 'hidden' };
  const headerStyle = { padding: '14px 20px', borderBottom: '1px solid rgba(108,60,225,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── API Keys ────────────────────────────────── */}
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Key style={{ width: 14, height: 14, color: '#6C3CE1' }} />
            <span style={{ fontSize: 13.5, fontWeight: 700, color: '#C4B5FD' }}>API Keys</span>
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'linear-gradient(135deg, #6C3CE1, #5B30C4)',
              border: 'none', borderRadius: 9, padding: '6px 14px',
              cursor: 'pointer', color: '#fff', fontSize: 12, fontWeight: 600,
            }}
          >
            <Plus style={{ width: 12, height: 12 }} /> Nueva Key
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2].map(i => <div key={i} style={{ height: 72, background: 'rgba(108,60,225,0.06)', borderRadius: 10, animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          </div>
        ) : keys.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Key style={{ width: 32, height: 32, color: '#4A4868', margin: '0 auto 12px' }} />
            <p style={{ color: '#5A5A78', fontSize: 13, margin: '0 0 12px' }}>No tienes llaves generadas.</p>
            <button onClick={() => setShowModal(true)} style={{ fontSize: 13, color: '#8B5CF6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              Crear primera llave →
            </button>
          </div>
        ) : (
          <div style={{ padding: '8px 0' }}>
            {keys.map(key => (
              <div key={key.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid rgba(108,60,225,0.06)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#E0DFF5' }}>{key.name}</span>
                    <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 100, background: key.is_active ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: key.is_active ? '#34D399' : '#F87171' }}>
                      {key.is_active ? 'ACTIVA' : 'REVOCADA'}
                    </span>
                  </div>
                  <code style={{ fontSize: 11, color: '#6A6888', background: 'rgba(108,60,225,0.07)', padding: '2px 7px', borderRadius: 5, fontFamily: 'monospace' }}>
                    {key.key_prefix}
                  </code>
                  <p style={{ fontSize: 11, color: '#4A4868', marginTop: 4, margin: '4px 0 0' }}>
                    Creada {new Date(key.created_at).toLocaleDateString('es-CL')} · Último uso: {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString('es-CL') : 'Nunca'}
                  </p>
                </div>
                {key.is_active && (
                  <button
                    onClick={() => handleRevoke(key.id)}
                    style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#4A4868', borderRadius: 8, transition: 'color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = '#F87171'}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = '#4A4868'}
                    title="Revocar"
                  >
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Webhooks ────────────────────────────────── */}
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Webhook style={{ width: 14, height: 14, color: '#F59E0B' }} />
            <span style={{ fontSize: 13.5, fontWeight: 700, color: '#FCD34D' }}>Webhooks</span>
            {!webhooksLoading && <span style={{ fontSize: 11, color: '#6A6888' }}>({webhooks.length} activos)</span>}
          </div>
          <button
            onClick={() => { setShowWebhookForm(v => !v); setNewWebhookSecret(null); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: 9, padding: '6px 14px',
              cursor: 'pointer', color: '#F59E0B', fontSize: 12, fontWeight: 600,
            }}
          >
            <Plus style={{ width: 12, height: 12 }} /> Nuevo webhook
          </button>
        </div>

        {showWebhookForm && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(245,158,11,0.12)', background: 'rgba(245,158,11,0.04)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#7674A0', margin: 0 }}>Registrar nuevo endpoint</p>
            <input
              type="url" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
              placeholder="https://mi-sistema.cl/webhook"
              style={{ width: '100%', background: '#08080F', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontFamily: 'monospace', color: '#E8E7F5', outline: 'none', boxSizing: 'border-box' }}
            />
            <div>
              <p style={{ fontSize: 11.5, color: '#6A6888', marginBottom: 8, margin: '0 0 8px' }}>Eventos a notificar:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {WEBHOOK_EVENTS.map(ev => {
                  const active = webhookEvents.includes(ev.value);
                  return (
                    <button
                      key={ev.value}
                      onClick={() => setWebhookEvents(prev => active ? prev.filter(e => e !== ev.value) : [...prev, ev.value])}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 11.5, fontWeight: 600,
                        background: active ? 'rgba(245,158,11,0.14)' : 'transparent',
                        border: `1px solid ${active ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        color: active ? '#F59E0B' : '#6A6888',
                        transition: 'all 0.15s',
                      }}
                    >
                      <Bell style={{ width: 11, height: 11 }} /> {ev.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setShowWebhookForm(false); setWebhookUrl(''); setWebhookEvents([]); }}
                style={{ flex: 1, padding: '8px 0', background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, cursor: 'pointer', color: '#6A6888', fontSize: 12.5, fontWeight: 600 }}
              >Cancelar</button>
              <button onClick={handleCreateWebhook} disabled={webhookCreating}
                style={{ flex: 1, padding: '8px 0', background: 'rgba(245,158,11,0.85)', border: 'none', borderRadius: 9, cursor: 'pointer', color: '#fff', fontSize: 12.5, fontWeight: 700, opacity: webhookCreating ? 0.6 : 1 }}
              >{webhookCreating ? 'Registrando...' : 'Registrar'}</button>
            </div>
          </div>
        )}

        {newWebhookSecret && (
          <div style={{ padding: '14px 20px', background: 'rgba(245,158,11,0.06)', borderBottom: '1px solid rgba(245,158,11,0.12)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
              <AlertCircle style={{ width: 15, height: 15, color: '#F59E0B', flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: '#FCD34D', margin: 0 }}><strong>Secret generado — solo se muestra ahora.</strong> Úsalo para verificar la firma HMAC-SHA256.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#08080F', border: '1px solid rgba(245,158,11,0.2)', padding: 8, borderRadius: 10 }}>
              <code style={{ flex: 1, fontSize: 11, fontFamily: 'monospace', color: '#E8E7F5', overflowX: 'auto', whiteSpace: 'nowrap' }}>{newWebhookSecret}</code>
              <button onClick={() => { navigator.clipboard.writeText(newWebhookSecret); setWebhookSecretCopied(true); setTimeout(() => setWebhookSecretCopied(false), 2000); }}
                style={{ padding: 7, background: 'rgba(245,158,11,0.10)', border: 'none', borderRadius: 7, cursor: 'pointer', color: '#F59E0B' }}
              >{webhookSecretCopied ? <Check style={{ width: 13, height: 13 }} /> : <Copy style={{ width: 13, height: 13 }} />}</button>
            </div>
            <button onClick={() => setNewWebhookSecret(null)} style={{ marginTop: 8, fontSize: 11.5, color: '#6A6888', background: 'none', border: 'none', cursor: 'pointer' }}>Ya lo guardé — ocultar</button>
          </div>
        )}

        {webhooksLoading ? (
          <div style={{ padding: 16 }}>{[1, 2].map(i => <div key={i} style={{ height: 56, background: 'rgba(108,60,225,0.06)', borderRadius: 8, marginBottom: 8 }} />)}</div>
        ) : webhooks.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <Webhook style={{ width: 28, height: 28, color: '#4A4868', margin: '0 auto 10px', opacity: 0.4 }} />
            <p style={{ color: '#5A5A78', fontSize: 12.5, margin: 0 }}>Sin webhooks registrados. Regístralos para recibir notificaciones en tiempo real.</p>
          </div>
        ) : (
          <div>
            {webhooks.map(wh => (
              <div key={wh.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid rgba(108,60,225,0.06)', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <code style={{ fontSize: 12, color: '#0EB5C6', fontFamily: 'monospace', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wh.endpoint_url}</code>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
                    {wh.events.map(ev => (
                      <span key={ev} style={{ fontSize: 10, background: 'rgba(245,158,11,0.10)', color: '#F59E0B', padding: '2px 7px', borderRadius: 100, fontWeight: 600 }}>{ev}</span>
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: '#4A4868', marginTop: 4, margin: '4px 0 0' }}>
                    Creado {new Date(wh.created_at).toLocaleDateString('es-CL')} · <span style={{ color: wh.is_active ? '#34D399' : '#F87171' }}>{wh.is_active ? 'Activo' : 'Inactivo'}</span>
                  </p>
                </div>
                <button onClick={() => handleDeleteWebhook(wh.id)}
                  style={{ padding: 7, background: 'none', border: 'none', cursor: 'pointer', color: '#4A4868', borderRadius: 7, flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = '#F87171'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = '#4A4868'}
                >
                  <Trash2 style={{ width: 13, height: 13 }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Request Logs ────────────────────────────── */}
      <div style={cardStyle}>
        <div style={{ ...headerStyle, cursor: 'pointer' }} onClick={() => setShowLogsSection(v => !v)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <List style={{ width: 14, height: 14, color: '#0EB5C6' }} />
            <span style={{ fontSize: 13.5, fontWeight: 700, color: '#5EEAD4' }}>Request Logs</span>
            {!loading && <span style={{ fontSize: 11, color: '#6A6888' }}>({filteredLogs.length} entradas)</span>}
          </div>
          {showLogsSection ? <ChevronUp style={{ width: 14, height: 14, color: '#6A6888' }} /> : <ChevronDown style={{ width: 14, height: 14, color: '#6A6888' }} />}
        </div>

        {showLogsSection && (
          <>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(108,60,225,0.06)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: '#6A6888', pointerEvents: 'none' }} />
                <input
                  value={logsSearch} onChange={e => { setLogsSearch(e.target.value); setLogsPage(0); }}
                  placeholder="Buscar endpoint..."
                  style={{ paddingLeft: 28, paddingRight: 10, paddingTop: 6, paddingBottom: 6, fontSize: 12, background: '#08080F', border: '1px solid rgba(108,60,225,0.14)', borderRadius: 8, color: '#E8E7F5', outline: 'none', width: 180 }}
                />
              </div>
              <select value={logsEndpointFilter} onChange={e => { setLogsEndpointFilter(e.target.value); setLogsPage(0); }}
                style={{ fontSize: 12, background: '#08080F', border: '1px solid rgba(108,60,225,0.14)', borderRadius: 8, padding: '6px 10px', color: '#E8E7F5', outline: 'none' }}
              >
                <option value="all">Todos los endpoints</option>
                {uniqueEndpoints.map(ep => <option key={ep} value={ep}>{ep.split('/').slice(-2).join('/')}</option>)}
              </select>
            </div>

            {loading ? (
              <div style={{ padding: 14 }}>{[1, 2, 3].map(i => <div key={i} style={{ height: 36, background: 'rgba(108,60,225,0.05)', borderRadius: 7, marginBottom: 6 }} />)}</div>
            ) : filteredLogs.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#5A5A78', fontSize: 13 }}>
                {logs.length === 0 ? 'Sin requests registrados aún.' : 'No hay logs que coincidan.'}
              </div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(108,60,225,0.08)' }}>
                        {['Timestamp', 'Endpoint', 'Requests', 'Tokens'].map(h => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#6A6888', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedLogs.map(log => (
                        <tr key={log.id} style={{ borderBottom: '1px solid rgba(108,60,225,0.05)' }}>
                          <td style={{ padding: '9px 16px', fontFamily: 'monospace', color: '#4A4868', whiteSpace: 'nowrap' }}>
                            {new Date(log.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                            {' '}
                            <span style={{ color: '#3A3858' }}>{new Date(log.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
                          </td>
                          <td style={{ padding: '9px 16px', maxWidth: 240 }}>
                            <code style={{ color: '#0EB5C6', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', whiteSpace: 'nowrap' }}>{log.endpoint}</code>
                          </td>
                          <td style={{ padding: '9px 16px', fontFamily: 'monospace', color: '#D4D2F0' }}>{(log.requests_count || 1).toLocaleString()}</td>
                          <td style={{ padding: '9px 16px', fontFamily: 'monospace', color: '#6A6888' }}>
                            {(log.tokens_used || 0) > 0 ? (log.tokens_used).toLocaleString() : <span style={{ color: '#3A3858' }}>—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredLogs.length > LOGS_PER_PAGE && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid rgba(108,60,225,0.06)' }}>
                    <button onClick={() => setLogsPage(p => Math.max(0, p - 1))} disabled={logsPage === 0}
                      style={{ fontSize: 12, color: logsPage === 0 ? '#3A3858' : '#8B5CF6', background: 'none', border: 'none', cursor: logsPage === 0 ? 'not-allowed' : 'pointer' }}>
                      ← Anterior
                    </button>
                    <span style={{ fontSize: 11.5, color: '#5A5A78' }}>Pág {logsPage + 1} de {Math.ceil(filteredLogs.length / LOGS_PER_PAGE)}</span>
                    <button onClick={() => setLogsPage(p => Math.min(Math.ceil(filteredLogs.length / LOGS_PER_PAGE) - 1, p + 1))} disabled={logsPage >= Math.ceil(filteredLogs.length / LOGS_PER_PAGE) - 1}
                      style={{ fontSize: 12, color: logsPage >= Math.ceil(filteredLogs.length / LOGS_PER_PAGE) - 1 ? '#3A3858' : '#8B5CF6', background: 'none', border: 'none', cursor: logsPage >= Math.ceil(filteredLogs.length / LOGS_PER_PAGE) - 1 ? 'not-allowed' : 'pointer' }}>
                      Siguiente →
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ── Create Key Modal ─────────────────────────── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: '#0E0E1A', border: '1px solid rgba(108,60,225,0.25)', borderRadius: 24, width: '100%', maxWidth: 420, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            {!newKeySecret ? (
              <>
                <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 800, color: '#E8E7F5', margin: '0 0 6px' }}>Nueva API Key</h3>
                <p style={{ fontSize: 13, color: '#7674A0', margin: '0 0 20px' }}>Dale un nombre para identificarla (ej: Producción, Staging).</p>
                <input
                  type="text" value={keyName} onChange={e => setKeyName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateKey()}
                  placeholder="Ej: Producción - Backend"
                  style={{ width: '100%', background: '#08080F', border: '1px solid rgba(108,60,225,0.22)', borderRadius: 12, padding: '11px 14px', fontSize: 14, color: '#E8E7F5', outline: 'none', boxSizing: 'border-box', marginBottom: 20 }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={closeModal} style={{ flex: 1, padding: '10px 0', background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, cursor: 'pointer', color: '#7674A0', fontSize: 13.5, fontWeight: 600 }}>Cancelar</button>
                  <button onClick={handleCreateKey} disabled={creating || !keyName.trim()}
                    style={{ flex: 1, padding: '10px 0', background: 'linear-gradient(135deg, #0EB5C6, #0A9BAA)', border: 'none', borderRadius: 12, cursor: 'pointer', color: '#fff', fontSize: 13.5, fontWeight: 700, opacity: (creating || !keyName.trim()) ? 0.5 : 1 }}
                  >{creating ? 'Generando...' : 'Generar Llave'}</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ width: 48, height: 48, background: 'rgba(14,181,198,0.12)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Check style={{ width: 22, height: 22, color: '#0EB5C6' }} />
                </div>
                <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 800, color: '#E8E7F5', textAlign: 'center', margin: '0 0 16px' }}>¡Llave Generada!</h3>
                <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 16 }}>
                  <AlertCircle style={{ width: 16, height: 16, color: '#F59E0B', flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontSize: 12.5, color: '#FCD34D', margin: 0 }}><strong>Solo se muestra una vez.</strong> Cópiala y guárdala en tu <code>.env</code>.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#08080F', border: '1px solid rgba(108,60,225,0.18)', borderRadius: 12, padding: '8px 8px 8px 14px', marginBottom: 20 }}>
                  <code style={{ flex: 1, fontSize: 12.5, overflowX: 'auto', color: '#D4D2F0', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{newKeySecret}</code>
                  <button onClick={() => { navigator.clipboard.writeText(newKeySecret!); setCopied(true); if (copyTimerRef.current) clearTimeout(copyTimerRef.current); copyTimerRef.current = setTimeout(() => setCopied(false), 2000); }}
                    style={{ padding: 8, background: 'rgba(108,60,225,0.12)', border: 'none', borderRadius: 9, cursor: 'pointer', color: '#A78BFA', flexShrink: 0 }}
                  >{copied ? <Check style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}</button>
                </div>
                <button onClick={closeModal} style={{ width: '100%', padding: '10px 0', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, cursor: 'pointer', color: '#E8E7F5', fontSize: 13.5, fontWeight: 700 }}>
                  He guardado mi llave
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
