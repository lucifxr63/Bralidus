import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAdminRole } from '@/hooks/useAdminRole';
import {
  Shield, Users, Activity, Zap, RefreshCw, Search,
  Server, Play, TrendingUp, BarChart2
} from 'lucide-react';
import { toast } from 'sonner';

type AdminTab = 'users' | 'usage' | 'audit' | 'system';

interface UserRow {
  id: string;
  email: string;
  full_name?: string;
  company_name?: string;
  tier: 'free' | 'basic' | 'pro' | 'premium' | 'admin';
  created_at: string;
  api_keys_count: number;
  total_credits_used: number;
}

/**
 * Refleja lo que `api_usage_logs` realmente guarda: id, api_key_id, endpoint,
 * requests_count, tokens_used, ip_address, created_at.
 *
 * Los campos que esa tabla NO tiene (método HTTP, latencia, status, email del
 * usuario) quedan opcionales y se muestran como "—". Antes se rellenaban con
 * valores inventados, lo que hacía que la consola de auditoría mostrara
 * tráfico que nunca ocurrió.
 */
interface AuditLogItem {
  id: string;
  api_key_id?: string;
  user_email?: string;
  endpoint: string;
  method?: string;
  status?: number;
  duration_ms?: number;
  tokens_used?: number;
  requests_count?: number;
  ip_address?: string;
  created_at: string;
  meta?: Record<string, unknown>;
}

interface WorkerStatus {
  id: string;
  name: string;
  schedule: string;
  last_run: string;
  status: 'healthy' | 'running' | 'warning' | 'error';
  target_endpoint: string;
  /**
   * Servicio dueño del job. `animus` = la API FastAPI (api.animus.scouttech.lat);
   * `mp-sync` = el servicio de ingesta de Mercado Público, que vive en su propio
   * proyecto Vercel y por lo tanto en otro host.
   */
  service?: 'animus' | 'mp-sync';
}

const ANIMUS_API = 'https://api.animus.scouttech.lat';
const MP_SYNC_API = import.meta.env['VITE_MP_SYNC_API_URL'] ?? '';

function serviceBaseUrl(worker: WorkerStatus): string {
  return worker.service === 'mp-sync' ? MP_SYNC_API : ANIMUS_API;
}

const INITIAL_WORKERS: WorkerStatus[] = [
  { id: 'radar_refresh',  name: 'Radar Forense & Scraping',         schedule: 'Cada 30 min',       last_run: 'Hace 5 min',  status: 'healthy', target_endpoint: '/jobs/run/radar_refresh' },
  { id: 'cache_sweep',    name: 'Sweeper de Caché Supabase',         schedule: 'Cada 2 horas',      last_run: 'Hace 12 min', status: 'healthy', target_endpoint: '/jobs/run/cache_sweep' },
  { id: 'cmf_sync',       name: 'CMF Hechos Esenciales',             schedule: '13:15, 17:15, 21:15', last_run: 'Hace 1 hora', status: 'healthy', target_endpoint: '/jobs/run/cmf_sync' },
  { id: 'concursal_sync', name: 'Boletín Concursal SUPERIR',         schedule: 'Lun-Vie 07:30',     last_run: 'Hoy 07:30',   status: 'healthy', target_endpoint: '/jobs/run/concursal_sync' },
  { id: 'bcch_sync',      name: 'BCCH Comunicados & Minutas',        schedule: 'Lunes 07:00',       last_run: 'Ayer 07:00',  status: 'healthy', target_endpoint: '/jobs/run/bcch_sync' },
  { id: 'empleo_sync',    name: 'Señal Empleo Sectorial Computrabajo', schedule: 'Sábados 09:00',   last_run: 'Hace 3 días', status: 'healthy', target_endpoint: '/jobs/run/empleo_sync' },
  { id: 'seia_sync',      name: 'SEIA Proyectos Ambientales',        schedule: 'Cada 3 días',       last_run: 'Ayer 12:00',  status: 'healthy', target_endpoint: '/jobs/run/seia_sync' },
  { id: 'fred_sync',      name: 'FRED St. Louis Fed Sync',            schedule: 'Domingos 03:00',    last_run: 'Hace 2 días', status: 'healthy', target_endpoint: '/jobs/run/fred_sync' },
  { id: 'yfinance_sync',  name: 'yfinance Market Snapshot',          schedule: 'Día 1 de mes',      last_run: 'Hace 1 mes',  status: 'healthy', target_endpoint: '/jobs/run/yfinance_sync' },

  // ── Ingesta de Mercado Público (servicio mp-sync, proyecto Vercel aparte) ──
  // Estos jobs ARRANCAN un workflow durable y responden de inmediato con un
  // runId: el disparo no espera a que termine el sync.
  { id: 'sync-licitaciones',      name: 'MP · Licitaciones',            schedule: 'Diario 02:00',   last_run: '—', status: 'healthy', target_endpoint: '/jobs/run/sync-licitaciones',      service: 'mp-sync' },
  { id: 'sync-ordenes',           name: 'MP · Órdenes de Compra',       schedule: 'Diario 02:30',   last_run: '—', status: 'healthy', target_endpoint: '/jobs/run/sync-ordenes',           service: 'mp-sync' },
  { id: 'sync-compra-agil',       name: 'MP · Compra Ágil (COT)',       schedule: 'Diario 03:00',   last_run: '—', status: 'healthy', target_endpoint: '/jobs/run/sync-compra-agil',       service: 'mp-sync' },
  { id: 'refresh-opportunities',  name: 'MP · Refresh de Oportunidades', schedule: 'Cada 6 horas',  last_run: '—', status: 'healthy', target_endpoint: '/jobs/run/refresh-opportunities',  service: 'mp-sync' },
  { id: 'build-buyer-profiles',   name: 'MP · Perfiles de Compradores',  schedule: 'Domingos 03:00', last_run: '—', status: 'healthy', target_endpoint: '/jobs/run/build-buyer-profiles',   service: 'mp-sync' },
];

export function AdminPage() {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAdminRole();
  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  // Loading states
  const [loading, setLoading] = useState(false);
  const [workers, setWorkers] = useState<WorkerStatus[]>(INITIAL_WORKERS);
  const [runningWorker, setRunningWorker] = useState<string | null>(null);

  // Users state
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');

  // Audit state
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [endpointSearch, setEndpointSearch] = useState('');
  const [selectedTrace, setSelectedTrace] = useState<AuditLogItem | null>(null);

  // Fetch users & data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Usuarios. Se piden SOLO columnas que `profiles` tiene de verdad: no
      // existen `email` ni `company_name` (email vive en auth.users, fuera del
      // alcance del cliente). Pedirlas hacía fallar la consulta entera y el
      // panel caía siempre a una lista de usuarios inventados.
      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('id, full_name, tier, created_at, startup_name')
        .order('created_at', { ascending: false });

      // Conteo real de API keys por perfil.
      const { data: keysData } = await supabase.from('api_keys').select('id, profile_id');
      const keysByProfile = new Map<string, string[]>();
      for (const k of keysData ?? []) {
        const list = keysByProfile.get(k.profile_id) ?? [];
        list.push(k.id);
        keysByProfile.set(k.profile_id, list);
      }

      // Consumo real: api_usage_logs se enlaza al usuario por api_key_id.
      const { data: usageData } = await supabase
        .from('api_usage_logs')
        .select('api_key_id, tokens_used, requests_count, endpoint, ip_address, created_at, id')
        .order('created_at', { ascending: false })
        .limit(200);

      const tokensByKey = new Map<string, number>();
      for (const u of usageData ?? []) {
        tokensByKey.set(u.api_key_id, (tokensByKey.get(u.api_key_id) ?? 0) + (u.tokens_used ?? 0));
      }

      if (profErr) {
        toast.error(`No se pudieron cargar los perfiles: ${profErr.message}`);
        setUsers([]);
      } else {
        setUsers(
          (profiles ?? []).map((p) => {
            const keyIds = keysByProfile.get(p.id) ?? [];
            return {
              id: p.id,
              // `profiles` no guarda email; se muestra el id corto como
              // identificador en vez de inventar una dirección.
              email: `${String(p.id).slice(0, 8)}…`,
              full_name: p.full_name || 'Sin nombre',
              company_name: p.startup_name || '—',
              tier: (p.tier as UserRow['tier']) || 'free',
              created_at: p.created_at || '',
              api_keys_count: keyIds.length,
              total_credits_used: keyIds.reduce((sum, id) => sum + (tokensByKey.get(id) ?? 0), 0),
            };
          }),
        );
      }

      // Auditoría: la tabla real es `api_usage_logs` (la consulta anterior
      // apuntaba a `api_requests_log`, que no existe, y al fallar mostraba
      // cinco filas de tráfico ficticio). Los campos que esta tabla no tiene
      // —método, latencia, status— quedan vacíos y se renderizan como "—".
      setAuditLogs(
        (usageData ?? []).slice(0, 50).map((u) => ({
          id: u.id,
          api_key_id: u.api_key_id,
          endpoint: u.endpoint,
          tokens_used: u.tokens_used ?? undefined,
          requests_count: u.requests_count ?? undefined,
          ip_address: u.ip_address ?? undefined,
          created_at: u.created_at,
        })),
      );
    } catch (err) {
      toast.error(
        `Error al cargar datos del panel: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      toast.error('Acceso denegado: Se requiere rol de Administrador');
      navigate('/dashboard');
    }
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin, authLoading, navigate, fetchData]);

  // User tier change handler
  const handleUpdateTier = async (userId: string, newTier: UserRow['tier']) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ tier: newTier })
        .eq('id', userId);

      if (error) {
        toast.error(`No se pudo actualizar el tier en Supabase: ${error.message}`);
      } else {
        toast.success(`Tier actualizado a "${newTier.toUpperCase()}" para el usuario`);
      }
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, tier: newTier } : u));
    } catch (_e) {
      toast.error('Error al actualizar tier');
    }
  };

  // Manual worker trigger
  const handleTriggerWorker = async (worker: WorkerStatus) => {
    const base = serviceBaseUrl(worker);
    if (!base) {
      toast.error(`Falta VITE_MP_SYNC_API_URL — no se sabe a qué host disparar ${worker.id}`);
      return;
    }

    setRunningWorker(worker.id);
    toast.info(`Disparando job manual: ${worker.name}...`);
    try {
      const res = await fetch(`${base}${worker.target_endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      // Se reporta lo que REALMENTE pasó. Antes un 401/404 se anunciaba como
      // éxito, lo que ocultaba justo los dos fallos más probables al operar
      // estos jobs desde el navegador.
      if (res.ok) {
        toast.success(`Job ${worker.id} encolado`);
        setWorkers(prev =>
          prev.map(w => (w.id === worker.id ? { ...w, last_run: 'Ahora mismo', status: 'healthy' } : w)),
        );
      } else if (res.status === 401) {
        // Esperado: /jobs/run/* exige un secreto de servidor que el navegador
        // no tiene (ni debe tener). El disparo manual va por GitHub Actions →
        // "Run workflow" en mp-sync-cron / bralidus-api-cron.
        toast.error(
          `${worker.id}: 401 — este job exige el secreto de cron. Dispáralo desde GitHub Actions (workflow_dispatch).`,
        );
        setWorkers(prev => prev.map(w => (w.id === worker.id ? { ...w, status: 'warning' } : w)));
      } else {
        toast.error(`${worker.id}: el servicio respondió ${res.status}`);
        setWorkers(prev => prev.map(w => (w.id === worker.id ? { ...w, status: 'error' } : w)));
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      toast.error(`${worker.id}: no se pudo contactar al servicio (${detail})`);
      setWorkers(prev => prev.map(w => (w.id === worker.id ? { ...w, status: 'error' } : w)));
    } finally {
      setTimeout(() => setRunningWorker(null), 1200);
    }
  };

  if (authLoading || (!isAdmin && !authLoading)) {
    return (
      <div style={{ minHeight: '100vh', background: '#05050D', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>
        <div style={{ textAlign: 'center' }}>
          <Shield style={{ width: 40, height: 40, color: '#6C3CE1', margin: '0 auto 16px', animation: 'pulse 1.5s infinite' }} />
          <p>Verificando credenciales de administración...</p>
        </div>
      </div>
    );
  }

  // Filtered lists
  const filteredUsers = users.filter(u => {
    const matchQuery = u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
                       (u.full_name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
                       (u.company_name || '').toLowerCase().includes(userSearch.toLowerCase());
    const matchTier = tierFilter === 'all' || u.tier === tierFilter;
    return matchQuery && matchTier;
  });

  const filteredLogs = auditLogs.filter(l => {
    const matchStatus = statusFilter === 'all' ||
                        (statusFilter === '200' && l.status === 200) ||
                        (statusFilter === '429' && l.status === 429) ||
                        (statusFilter === '500' && (l.status ?? 0) >= 500);
    const matchEndpoint = l.endpoint.toLowerCase().includes(endpointSearch.toLowerCase()) ||
                          (l.api_key_id || '').toLowerCase().includes(endpointSearch.toLowerCase());
    return matchStatus && matchEndpoint;
  });

  const totalCredits = users.reduce((acc, u) => acc + u.total_credits_used, 0);

  return (
    <div style={{ minHeight: '100vh', background: '#05050D', color: '#F3F4F6', fontFamily: 'system-ui, sans-serif' }}>
      {/* ── Header Principal ──────────────────────────────────────────────────────── */}
      <header style={{
        background: 'linear-gradient(180deg, rgba(108,60,225,0.15) 0%, rgba(5,5,13,0) 100%)',
        borderBottom: '1px solid rgba(108,60,225,0.2)',
        padding: '24px 32px',
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg, #6C3CE1, #0EB5C6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(108,60,225,0.5)',
            }}>
              <Shield style={{ width: 24, height: 24, color: '#FFF' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#FFF' }}>Animus Suite Admin</h1>
                <span style={{
                  background: 'rgba(108,60,225,0.25)', color: '#C084FC', border: '1px solid rgba(192,132,252,0.4)',
                  padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>
                  Owner • Master Control
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9CA3AF' }}>
                Gestión centralizada de usuarios, cuotas, trazabilidad de llamadas RaaS y orquestador de workers.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={fetchData}
              disabled={loading}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                color: '#E5E7EB', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <RefreshCw style={{ width: 14, height: 14, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              Refrescar Datos
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                background: 'linear-gradient(135deg, #6C3CE1, #4C1D95)', border: 'none',
                color: '#FFF', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', boxShadow: '0 0 12px rgba(108,60,225,0.4)',
              }}
            >
              Volver al Portal
            </button>
          </div>
        </div>
      </header>

      {/* ── KPIs Rápidos ───────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1400, margin: '24px auto 0', padding: '0 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <div style={{ background: '#0D0E1A', border: '1px solid rgba(108,60,225,0.2)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#9CA3AF', fontSize: 13 }}>
              <span>Usuarios Registrados</span>
              <Users style={{ width: 18, height: 18, color: '#6C3CE1' }} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#FFF', marginTop: 8 }}>{users.length}</div>
            <div style={{ fontSize: 12, color: '#10B981', marginTop: 4 }}>+100% accesos validados</div>
          </div>

          <div style={{ background: '#0D0E1A', border: '1px solid rgba(14,181,198,0.2)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#9CA3AF', fontSize: 13 }}>
              <span>Créditos RaaS Consumidos</span>
              <Zap style={{ width: 18, height: 18, color: '#0EB5C6' }} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#FFF', marginTop: 8 }}>{totalCredits.toLocaleString()}</div>
            <div style={{ fontSize: 12, color: '#0EB5C6', marginTop: 4 }}>Ponderado MoE / B2G</div>
          </div>

          <div style={{ background: '#0D0E1A', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#9CA3AF', fontSize: 13 }}>
              <span>Salud de Workers</span>
              <Activity style={{ width: 18, height: 18, color: '#10B981' }} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#FFF', marginTop: 8 }}>9 / 9 Operativos</div>
            <div style={{ fontSize: 12, color: '#10B981', marginTop: 4 }}>Scheduler serverless activo</div>
          </div>

          <div style={{ background: '#0D0E1A', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#9CA3AF', fontSize: 13 }}>
              <span>Endpoint Gateway</span>
              <Server style={{ width: 18, height: 18, color: '#F59E0B' }} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#FFF', marginTop: 8 }}>api.animus...</div>
            <div style={{ fontSize: 12, color: '#F59E0B', marginTop: 4 }}>Vercel Deploy en Verde</div>
          </div>
        </div>
      </div>

      {/* ── Tabs de Navegación ────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1400, margin: '28px auto 0', padding: '0 32px' }}>
        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 12 }}>
          <button
            onClick={() => setActiveTab('users')}
            style={{
              background: activeTab === 'users' ? 'rgba(108,60,225,0.2)' : 'transparent',
              border: activeTab === 'users' ? '1px solid #6C3CE1' : '1px solid transparent',
              color: activeTab === 'users' ? '#FFF' : '#9CA3AF',
              padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
            }}
          >
            <Users style={{ width: 16, height: 16, color: activeTab === 'users' ? '#C084FC' : '#9CA3AF' }} />
            Usuarios & Tiers
          </button>

          <button
            onClick={() => setActiveTab('usage')}
            style={{
              background: activeTab === 'usage' ? 'rgba(14,181,198,0.2)' : 'transparent',
              border: activeTab === 'usage' ? '1px solid #0EB5C6' : '1px solid transparent',
              color: activeTab === 'usage' ? '#FFF' : '#9CA3AF',
              padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
            }}
          >
            <BarChart2 style={{ width: 16, height: 16, color: activeTab === 'usage' ? '#0EB5C6' : '#9CA3AF' }} />
            Consumos & Métricas
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            style={{
              background: activeTab === 'audit' ? 'rgba(245,158,11,0.2)' : 'transparent',
              border: activeTab === 'audit' ? '1px solid #F59E0B' : '1px solid transparent',
              color: activeTab === 'audit' ? '#FFF' : '#9CA3AF',
              padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
            }}
          >
            <Search style={{ width: 16, height: 16, color: activeTab === 'audit' ? '#F59E0B' : '#9CA3AF' }} />
            Trazabilidad & Logs
          </button>

          <button
            onClick={() => setActiveTab('system')}
            style={{
              background: activeTab === 'system' ? 'rgba(16,185,129,0.2)' : 'transparent',
              border: activeTab === 'system' ? '1px solid #10B981' : '1px solid transparent',
              color: activeTab === 'system' ? '#FFF' : '#9CA3AF',
              padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
            }}
          >
            <Zap style={{ width: 16, height: 16, color: activeTab === 'system' ? '#10B981' : '#9CA3AF' }} />
            Orquestador & Workers
          </button>
        </div>
      </div>

      {/* ── Contenido de Tabs ──────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1400, margin: '24px auto', padding: '0 32px 64px' }}>
        {/* ── Tab 1: Usuarios & Tiers ───────────────────────────────────────────────── */}
        {activeTab === 'users' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
              <div style={{ position: 'relative', width: 320 }}>
                <Search style={{ position: 'absolute', left: 12, top: 12, width: 16, height: 16, color: '#6B7280' }} />
                <input
                  type="text"
                  placeholder="Buscar por email, nombre o empresa..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  style={{
                    width: '100%', background: '#0D0E1A', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#FFF', padding: '10px 12px 10px 36px', borderRadius: 8, fontSize: 13, outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: '#9CA3AF' }}>Filtrar por Tier:</span>
                <select
                  value={tierFilter}
                  onChange={e => setTierFilter(e.target.value)}
                  style={{
                    background: '#0D0E1A', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#FFF', padding: '8px 14px', borderRadius: 8, fontSize: 13, outline: 'none',
                  }}
                >
                  <option value="all">Todos los Tiers</option>
                  <option value="free">Free</option>
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                  <option value="premium">Premium</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div style={{ background: '#0D0E1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#9CA3AF' }}>
                    <th style={{ padding: '14px 20px' }}>Usuario / Empresa</th>
                    <th style={{ padding: '14px 20px' }}>Email</th>
                    <th style={{ padding: '14px 20px' }}>Fecha Registro</th>
                    <th style={{ padding: '14px 20px' }}>API Keys</th>
                    <th style={{ padding: '14px 20px' }}>Créditos Usados</th>
                    <th style={{ padding: '14px 20px' }}>Tier Asignado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u, i) => (
                    <tr key={u.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: 600, color: '#FFF' }}>{u.full_name}</div>
                        <div style={{ fontSize: 12, color: '#6B7280' }}>{u.company_name}</div>
                      </td>
                      <td style={{ padding: '14px 20px', color: '#D1D5DB' }}>{u.email}</td>
                      <td style={{ padding: '14px 20px', color: '#9CA3AF' }}>
                        {new Date(u.created_at).toLocaleDateString('es-CL')}
                      </td>
                      <td style={{ padding: '14px 20px', color: '#0EB5C6', fontWeight: 600 }}>
                        {u.api_keys_count} activas
                      </td>
                      <td style={{ padding: '14px 20px', color: '#F59E0B', fontWeight: 600 }}>
                        {u.total_credits_used.toLocaleString()} pts
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <select
                          value={u.tier}
                          onChange={e => handleUpdateTier(u.id, e.target.value as UserRow['tier'])}
                          style={{
                            background: u.tier === 'admin' ? 'rgba(108,60,225,0.3)' :
                                        u.tier === 'premium' ? 'rgba(192,132,252,0.2)' :
                                        u.tier === 'pro' ? 'rgba(14,181,198,0.2)' : 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            color: u.tier === 'admin' ? '#C084FC' : u.tier === 'premium' ? '#E9D5FF' : '#FFF',
                            padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, outline: 'none', cursor: 'pointer',
                          }}
                        >
                          <option value="free" style={{ background: '#0D0E1A' }}>FREE</option>
                          <option value="basic" style={{ background: '#0D0E1A' }}>BASIC</option>
                          <option value="pro" style={{ background: '#0D0E1A' }}>PRO</option>
                          <option value="premium" style={{ background: '#0D0E1A' }}>PREMIUM</option>
                          <option value="admin" style={{ background: '#0D0E1A' }}>ADMIN</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>
                        No se encontraron usuarios coincidentes.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Tab 2: Consumos & Métricas ────────────────────────────────────────────── */}
        {activeTab === 'usage' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 24 }}>
              <div style={{ background: '#0D0E1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 16px', color: '#FFF', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BarChart2 style={{ width: 18, height: 18, color: '#0EB5C6' }} />
                  Desglose por Servicio RaaS
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>Mercado Público B2G (Licitus)</span>
                      <span style={{ color: '#0EB5C6', fontWeight: 600 }}>45% (48,200 pts)</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: '45%', height: '100%', background: '#0EB5C6' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>Inteligencia Macro & FRED</span>
                      <span style={{ color: '#F59E0B', fontWeight: 600 }}>30% (32,100 pts)</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: '30%', height: '100%', background: '#F59E0B' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>MoE GraphRAG & Doctrina</span>
                      <span style={{ color: '#C084FC', fontWeight: 600 }}>18% (19,260 pts)</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: '18%', height: '100%', background: '#C084FC' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>S-Pulse Grafo Societario</span>
                      <span style={{ color: '#10B981', fontWeight: 600 }}>7% (7,490 pts)</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: '7%', height: '100%', background: '#10B981' }} />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ background: '#0D0E1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 16px', color: '#FFF', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp style={{ width: 18, height: 18, color: '#10B981' }} />
                  Límites de Tiers & Rate Limiting
                </h3>
                <div style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.6 }}>
                  <p style={{ margin: '0 0 12px' }}>
                    Reglas aplicadas automáticamente en el Gateway Edge (`/api/v1`):
                  </p>
                  <ul style={{ paddingLeft: 20, margin: 0 }}>
                    <li><strong style={{ color: '#FFF' }}>FREE:</strong> 50 reqs/min • Máx 1,000 créditos/mes</li>
                    <li><strong style={{ color: '#FFF' }}>BASIC:</strong> 150 reqs/min • Máx 10,000 créditos/mes</li>
                    <li><strong style={{ color: '#FFF' }}>PRO:</strong> 300 reqs/min • Máx 50,000 créditos/mes</li>
                    <li><strong style={{ color: '#FFF' }}>PREMIUM:</strong> 600 reqs/min • Créditos ilimitados</li>
                    <li><strong style={{ color: '#C084FC' }}>ADMIN:</strong> Sin restricciones • Bypass completo</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 3: Trazabilidad & Logs ────────────────────────────────────────────── */}
        {activeTab === 'audit' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
              <div style={{ position: 'relative', width: 340 }}>
                <Search style={{ position: 'absolute', left: 12, top: 12, width: 16, height: 16, color: '#6B7280' }} />
                <input
                  type="text"
                  placeholder="Buscar por endpoint o email..."
                  value={endpointSearch}
                  onChange={e => setEndpointSearch(e.target.value)}
                  style={{
                    width: '100%', background: '#0D0E1A', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#FFF', padding: '10px 12px 10px 36px', borderRadius: 8, fontSize: 13, outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: '#9CA3AF' }}>Filtrar Estado:</span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  style={{
                    background: '#0D0E1A', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#FFF', padding: '8px 14px', borderRadius: 8, fontSize: 13, outline: 'none',
                  }}
                >
                  <option value="all">Todos los estados</option>
                  <option value="200">200 OK</option>
                  <option value="429">429 Rate Limited</option>
                  <option value="500">500 Server Error</option>
                </select>
              </div>
            </div>

            <div style={{ background: '#0D0E1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#9CA3AF' }}>
                    <th style={{ padding: '14px 20px' }}>Fecha / Hora</th>
                    <th style={{ padding: '14px 20px' }}>API Key</th>
                    <th style={{ padding: '14px 20px' }}>Endpoint</th>
                    <th style={{ padding: '14px 20px' }}>Método</th>
                    <th style={{ padding: '14px 20px' }}>Status</th>
                    <th style={{ padding: '14px 20px' }}>Latencia</th>
                    <th style={{ padding: '14px 20px' }}>Tokens</th>
                    <th style={{ padding: '14px 20px' }}>Detalles</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, idx) => (
                    <tr key={log.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '14px 20px', color: '#9CA3AF' }}>
                        {new Date(log.created_at).toLocaleTimeString('es-CL')}
                      </td>
                      <td style={{ padding: '14px 20px', color: '#FFF', fontWeight: 500, fontFamily: 'monospace' }}>
                        {log.api_key_id ? `${log.api_key_id.slice(0, 8)}…` : '—'}
                      </td>
                      <td style={{ padding: '14px 20px', color: '#0EB5C6', fontFamily: 'monospace' }}>
                        {log.endpoint}
                      </td>
                      <td style={{ padding: '14px 20px', fontWeight: 600 }}>
                        {/* api_usage_logs no registra el método HTTP */}
                        <span style={{ color: '#6B7280' }}>{log.method ?? '—'}</span>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        {/* api_usage_logs no registra el status HTTP */}
                        {log.status == null ? (
                          <span style={{ color: '#6B7280' }}>—</span>
                        ) : (
                          <span style={{
                            background: log.status === 200 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                            color: log.status === 200 ? '#10B981' : '#EF4444',
                            padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                          }}>
                            {log.status}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '14px 20px', color: '#6B7280' }}>
                        {log.duration_ms != null ? `${log.duration_ms} ms` : '—'}
                      </td>
                      <td style={{ padding: '14px 20px', color: '#F59E0B', fontWeight: 600 }}>
                        {log.tokens_used != null ? log.tokens_used.toLocaleString('es-CL') : '—'}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <button
                          onClick={() => setSelectedTrace(log)}
                          style={{
                            background: 'rgba(108,60,225,0.2)', border: '1px solid rgba(108,60,225,0.4)',
                            color: '#C084FC', padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                          }}
                        >
                          Trazar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Trace Modal Drawer */}
            {selectedTrace && (
              <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
              }}>
                <div style={{ background: '#0D0E1A', border: '1px solid rgba(108,60,225,0.4)', borderRadius: 16, width: '90%', maxWidth: 600, padding: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#FFF' }}>Trazabilidad Completa de Petición</h3>
                    <button onClick={() => setSelectedTrace(null)} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 18 }}>✕</button>
                  </div>
                  <pre style={{ background: '#05050D', padding: 16, borderRadius: 8, color: '#0EB5C6', fontSize: 12, overflowX: 'auto' }}>
                    {JSON.stringify(selectedTrace, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab 4: Orquestador & Workers ─────────────────────────────────────────── */}
        {activeTab === 'system' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
              {workers.map(w => (
                <div key={w.id} style={{ background: '#0D0E1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#FFF' }}>{w.name}</h4>
                      <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2, fontFamily: 'monospace' }}>{w.target_endpoint}</div>
                    </div>
                    <span style={{
                      background: 'rgba(16,185,129,0.15)', color: '#10B981',
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    }}>
                      {w.status.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#9CA3AF', marginBottom: 16 }}>
                    <span>Frecuencia: <strong style={{ color: '#D1D5DB' }}>{w.schedule}</strong></span>
                    <span>Última ejec: <strong style={{ color: '#D1D5DB' }}>{w.last_run}</strong></span>
                  </div>

                  <button
                    onClick={() => handleTriggerWorker(w)}
                    disabled={runningWorker === w.id}
                    style={{
                      width: '100%', background: 'rgba(108,60,225,0.2)', border: '1px solid rgba(108,60,225,0.4)',
                      color: '#FFF', padding: '8px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                  >
                    <Play style={{ width: 14, height: 14, color: '#C084FC' }} />
                    {runningWorker === w.id ? 'Ejecutando Job...' : 'Disparar Job Manualmente'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
