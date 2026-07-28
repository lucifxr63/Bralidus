import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ShieldCheck, Search, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, AlertCircle, Clock, User, Globe, Zap,
  Database, Activity, RefreshCw, FileSpreadsheet, FileJson
} from 'lucide-react';
import { toast } from 'sonner';


// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  /** Coincide con el campo `user_email` en la tabla */
  user_email: string;
  action: string;
  ip_address: string;
  status: 'success' | 'warning' | 'error';
  created_at: string;
}

export interface AuditLogProps {
  /** Cuántas filas por página — default 10 */
  pageSize?: number;
  className?: string;
}

// ── Action presets para el <select> ──────────────────────────────────────────

const ACTION_OPTIONS = [
  { value: 'all',               label: 'Todas las acciones' },
  { value: 'api.key.created',   label: 'API Key — Created'   },
  { value: 'api.key.revoked',   label: 'API Key — Revoked'   },
  { value: 'validation.run',    label: 'Validation Run'       },
  { value: 'data.macro.fetch',  label: 'Data — Macro Fetch'  },
  { value: 'data.bcch.sync',    label: 'Data — BCCH Sync'    },
  { value: 'data.cmf.sync',     label: 'Data — CMF Sync'     },
  { value: 'auth.login',        label: 'Auth — Login'         },
  { value: 'auth.login.failed', label: 'Auth — Login Failed'  },
  { value: 'webhook.created',   label: 'Webhook Created'      },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
}

const ACTION_ICON: Record<string, React.ElementType> = {
  'api.key':     Zap,
  'validation':  CheckCircle2,
  'data':        Database,
  'auth':        ShieldCheck,
  'webhook':     Activity,
};

function getActionIcon(action: string): React.ElementType {
  const key = Object.keys(ACTION_ICON).find(k => action.startsWith(k));
  return key ? ACTION_ICON[key] : Globe;
}

function actionColorClass(action: string): string {
  if (action.startsWith('api.key'))    return 'text-violet-400 bg-violet-500/10 border-violet-500/20';
  if (action.startsWith('validation')) return 'text-teal-400 bg-teal-500/10 border-teal-500/20';
  if (action.startsWith('data'))       return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
  if (action.startsWith('auth'))       return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  if (action.startsWith('webhook'))    return 'text-pink-400 bg-pink-500/10 border-pink-500/20';
  return 'text-gray-400 bg-white/5 border-white/10';
}

const STATUS_CONFIG = {
  success: { icon: CheckCircle2, color: 'text-emerald-400', label: 'Success' },
  error:   { icon: XCircle,      color: 'text-red-400',     label: 'Error'   },
  warning: { icon: AlertCircle,  color: 'text-amber-400',   label: 'Warning' },
} as const;

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="grid sm:grid-cols-[2fr_2.5fr_1.5fr_1.5fr_1fr] gap-x-4 px-5 py-3.5 animate-pulse">
      {[40, 56, 32, 44, 20].map((w, i) => (
        <div key={i} className={`h-3 rounded-full bg-white/5`} style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AuditLog({ pageSize = 10, className = '' }: AuditLogProps) {
  const [logs,        setLogs]        = useState<AuditLogEntry[]>([]);
  const [totalCount,  setTotalCount]  = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [exporting,   setExporting]   = useState(false);

  // Filters
  const [searchTerm,    setSearchTerm]    = useState('');
  const [actionFilter,  setActionFilter]  = useState('all');
  // Debounced search to avoid over-fetching on every keystroke
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Pagination (1-based for display, 0-based for Supabase range)
  const [page, setPage] = useState(1);

  // Debounce: wait 400ms after user stops typing before fetching
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // reset to first page on new search
    }, 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Reset page when action filter changes
  useEffect(() => { setPage(1); }, [actionFilter]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('audit_logs')
        .select('id, user_email, action, ip_address, status, created_at', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Server-side text filter (OR across user_email and action)
      if (debouncedSearch) {
        query = query.or(
          `user_email.ilike.%${debouncedSearch}%,action.ilike.%${debouncedSearch}%`
        );
      }

      // Server-side action filter
      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      // Server-side pagination
      const from = (page - 1) * pageSize;
      const to   = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error: sbError } = await query;

      if (sbError) throw sbError;

      setLogs((data as AuditLogEntry[]) ?? []);
      setTotalCount(count ?? 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar los registros.';
      setError(msg);
      console.error('[AuditLog] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, actionFilter, page, pageSize]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Export functions (CSV / JSON)
  const fetchAllFilteredForExport = async (): Promise<AuditLogEntry[]> => {
    let query = supabase
      .from('audit_logs')
      .select('id, user_email, action, ip_address, status, created_at')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (debouncedSearch) {
      query = query.or(`user_email.ilike.%${debouncedSearch}%,action.ilike.%${debouncedSearch}%`);
    }
    if (actionFilter !== 'all') {
      query = query.eq('action', actionFilter);
    }

    const { data } = await query;
    return (data as AuditLogEntry[]) ?? logs;
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const exportData = await fetchAllFilteredForExport();
      const headers = ['ID', 'User Email', 'Action', 'IP Address', 'Status', 'Timestamp'];
      const rows = exportData.map(l => [
        l.id,
        `"${l.user_email}"`,
        `"${l.action}"`,
        `"${l.ip_address}"`,
        l.status,
        `"${formatDate(l.created_at)}"`
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `animus_audit_logs_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Exportados ${exportData.length} registros a CSV`);
    } catch (e) {
      toast.error('Error al exportar a CSV');
    } finally {
      setExporting(false);
    }
  };

  const handleExportJSON = async () => {
    setExporting(true);
    try {
      const exportData = await fetchAllFilteredForExport();
      const jsonContent = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `animus_audit_logs_${new Date().toISOString().slice(0,10)}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Exportados ${exportData.length} registros a JSON`);
    } catch (e) {
      toast.error('Error al exportar a JSON');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className={`space-y-4 ${className}`}>

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-gray-900 dark:text-white">
              Consola de Auditoría
            </h2>
            <p className="text-[11px] text-gray-400">
              Registro en tiempo real de acciones del sistema y accesos de API
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Total count badge */}
          {!loading && !error && (
            <span className="text-[11px] text-gray-500 flex items-center gap-1 mr-2">
              <Clock className="w-3.5 h-3.5" />
              {totalCount.toLocaleString()} eventos
            </span>
          )}

          {/* Export Buttons */}
          <button
            id="audit-export-csv"
            onClick={handleExportCSV}
            disabled={exporting || loading}
            title="Exportar a CSV"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold
                       bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10
                       text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 transition disabled:opacity-40"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-teal-400" />
            <span className="hidden md:inline">CSV</span>
          </button>

          <button
            id="audit-export-json"
            onClick={handleExportJSON}
            disabled={exporting || loading}
            title="Exportar a JSON"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold
                       bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10
                       text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 transition disabled:opacity-40"
          >
            <FileJson className="w-3.5 h-3.5 text-violet-400" />
            <span className="hidden md:inline">JSON</span>
          </button>

          {/* Manual refresh */}
          <button
            id="audit-refresh-btn"
            onClick={fetchLogs}
            disabled={loading}
            title="Refrescar"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-white/5 transition disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>


      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Free-text search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            id="audit-filter-search"
            type="text"
            placeholder="Buscar por usuario o acción..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl
                       bg-white dark:bg-[#12121A] border border-gray-100 dark:border-white/5
                       text-gray-900 dark:text-gray-200 placeholder-gray-400
                       focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition"
          />
        </div>

        {/* Action preset select */}
        <select
          id="audit-filter-action"
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl
                     bg-white dark:bg-[#12121A] border border-gray-100 dark:border-white/5
                     text-gray-900 dark:text-gray-200
                     focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition"
        >
          {ACTION_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* ── Table ── */}
      <div className="rounded-2xl border border-gray-100 dark:border-white/5 bg-white dark:bg-[#12121A] shadow-sm overflow-hidden">

        {/* Column headers */}
        <div className="hidden sm:grid grid-cols-[2fr_2.5fr_1.5fr_1.5fr_1fr] gap-4 px-5 py-3
                        border-b border-gray-100 dark:border-white/5
                        text-[10px] uppercase tracking-wider text-gray-400 font-bold">
          <span>Usuario</span>
          <span>Acción</span>
          <span>IP</span>
          <span>Fecha</span>
          <span className="text-center">Estado</span>
        </div>

        <div className="divide-y divide-gray-50 dark:divide-white/[0.035]">
          {/* Loading skeletons */}
          {loading && Array.from({ length: pageSize }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}

          {/* Error state */}
          {!loading && error && (
            <div className="py-12 flex flex-col items-center gap-3 text-red-400">
              <XCircle className="w-8 h-8 opacity-50" />
              <p className="text-xs text-center max-w-xs">{error}</p>
              <button
                onClick={fetchLogs}
                className="text-[11px] underline underline-offset-2 hover:text-red-300 transition"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && logs.length === 0 && (
            <div className="py-12 text-center text-xs text-gray-400">
              No se encontraron registros de auditoría coincidentes.
            </div>
          )}

          {/* Data rows */}
          {!loading && !error && logs.map((log) => {
            const Icon      = getActionIcon(log.action);
            const colors    = actionColorClass(log.action);
            const statusCfg = STATUS_CONFIG[log.status] ?? null;
            const StatusIcon = statusCfg?.icon;

            return (
              <div
                key={log.id}
                className="grid sm:grid-cols-[2fr_2.5fr_1.5fr_1.5fr_1fr] gap-x-4 gap-y-1 px-5 py-3.5
                           hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
              >
                {/* User */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center shrink-0">
                    <User className="w-3 h-3 text-gray-400" />
                  </div>
                  <span
                    className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate"
                    title={log.user_email}
                  >
                    {log.user_email}
                  </span>
                </div>

                {/* Action badge */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] font-mono font-semibold ${colors}`}>
                    <Icon className="w-3 h-3 shrink-0" />
                    {log.action}
                  </span>
                </div>

                {/* IP */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <Globe className="w-3 h-3 text-gray-400 shrink-0" />
                  <code className="text-[11px] text-gray-500 dark:text-gray-400 font-mono truncate">
                    {log.ip_address}
                  </code>
                </div>

                {/* Timestamp */}
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-gray-400 shrink-0" />
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                    {formatDate(log.created_at)}
                  </span>
                </div>

                {/* Status */}
                <div className="flex items-center sm:justify-center">
                  {statusCfg && (
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold ${statusCfg.color}`}
                      title={statusCfg.label}
                    >
                      <StatusIcon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{statusCfg.label}</span>
                    </span>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* ── Pagination ── */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          Página{' '}
          <span className="font-semibold text-gray-700 dark:text-gray-300">{page}</span>
          {' '}de{' '}
          <span className="font-semibold text-gray-700 dark:text-gray-300">{totalPages}</span>
          <span className="ml-2 text-gray-400">
            ({totalCount.toLocaleString()} registros totales)
          </span>
        </span>
        <div className="flex items-center gap-2">
          <button
            id="audit-prev-page"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-white/5
                       bg-white dark:bg-[#12121A] text-gray-700 dark:text-gray-300
                       disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-white/5 transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Anterior
          </button>
          <button
            id="audit-next-page"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-white/5
                       bg-white dark:bg-[#12121A] text-gray-700 dark:text-gray-300
                       disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-white/5 transition"
          >
            Siguiente <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default AuditLog;
