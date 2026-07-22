import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { GitCommit, RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from 'recharts';

interface LogRow {
  id: number;
  created_at: string;
  query_preview: string;
  routing_method: string;
  routing_reason: string;
  experts_activated: string[];
  graph_hits: number;
  vector_hits: number;
  total_hits: number;
}

const TT = { backgroundColor: '#12121A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 };
const METHOD_COLORS: Record<string, string> = {
  keyword:           '#0EB5C6',
  'keyword+context': '#7C3AED',
  semantic:          '#F59E0B',
  fallback:          '#6B7280',
};
const EXPERT_COLORS = ['#0EB5C6','#7C3AED','#F59E0B','#EC4899','#10B981','#3B82F6','#EF4444','#F97316','#84CC16','#06B6D4'];
const PER_PAGE = 10;

export default function Trazabilidad() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const { data } = await supabase
      .from('moe_routing_log')
      .select('id,created_at,query_preview,routing_method,routing_reason,experts_activated,graph_hits,vector_hits,total_hits')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500);
    setLogs((data as LogRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const methodDist = useMemo(() => {
    const m: Record<string, number> = {};
    logs.forEach(l => { m[l.routing_method] = (m[l.routing_method] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [logs]);

  const expertDist = useMemo(() => {
    const m: Record<string, number> = {};
    logs.forEach(l => (l.experts_activated || []).forEach(e => { m[e] = (m[e] || 0) + 1; }));
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [logs]);

  const hitsTimeline = useMemo(() => {
    const days: Record<string, { date: string; graph: number; vector: number; queries: number }> = {};
    logs.forEach(l => {
      const d = l.created_at.slice(0, 10);
      if (!days[d]) days[d] = { date: d, graph: 0, vector: 0, queries: 0 };
      days[d].graph += l.graph_hits;
      days[d].vector += l.vector_hits;
      days[d].queries += 1;
    });
    return Object.values(days).sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
  }, [logs]);

  const graphRate = logs.length > 0
    ? ((logs.reduce((s, l) => s + l.graph_hits, 0) / Math.max(logs.reduce((s, l) => s + l.total_hits, 0), 1)) * 100).toFixed(1)
    : '0';

  const topMethod = [...methodDist].sort((a, b) => b.value - a.value)[0]?.name ?? '—';


  const filtered = useMemo(() =>
    search ? logs.filter(l => l.query_preview.toLowerCase().includes(search.toLowerCase())) : logs,
    [logs, search]);
  const pageCount = Math.ceil(filtered.length / PER_PAGE);
  const pageLogs = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center">
          <GitCommit className="w-4 h-4 text-teal-500" />
        </div>
        <div>
          <h2 className="font-black text-gray-900 dark:text-white text-sm">Trazabilidad — Audit Trail GraphRAG</h2>
          <p className="text-[11px] text-gray-400">moe_routing_log · últimos 30 días · {logs.length} queries</p>
        </div>
        <button onClick={load} className="ml-auto flex items-center gap-1.5 text-xs text-gray-400 hover:text-teal-400 transition">
          <RefreshCw className="w-3.5 h-3.5" />
          Actualizar
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-10 text-center shadow-sm">
          <GitCommit className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Sin queries registradas aún</p>
          <p className="text-xs text-gray-500 mt-1">Cada llamada a POST /query/moe genera una fila aquí</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Queries (30d)', value: logs.length.toLocaleString(), color: 'text-teal-500' },
              { label: 'Graph hit rate', value: `${graphRate}%`, color: 'text-violet-500' },
              { label: 'Avg total hits', value: (logs.reduce((s,l) => s+l.total_hits,0)/logs.length).toFixed(1), color: 'text-amber-500' },
              { label: 'Routing principal', value: topMethod, color: 'text-pink-500' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-4 shadow-sm">
                <p className={`text-xl font-black ${color} break-all`}>{value}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Method distribution */}
            <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-5 shadow-sm">
              <p className="text-sm font-bold text-gray-900 dark:text-white mb-4">Método de routing</p>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={methodDist} cx="50%" cy="45%" innerRadius={36} outerRadius={58} paddingAngle={3} dataKey="value">
                    {methodDist.map((d, i) => <Cell key={i} fill={METHOD_COLORS[d.name] ?? '#6B7280'} />)}
                  </Pie>
                  <Tooltip contentStyle={TT} itemStyle={{ color: '#F0EFF8' }} formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {methodDist.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5 text-[10px] text-gray-400">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: METHOD_COLORS[d.name] ?? '#6B7280' }} />
                    {d.name} ({d.value})
                  </div>
                ))}
              </div>
            </div>

            {/* Expert activation */}
            <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-5 shadow-sm">
              <p className="text-sm font-bold text-gray-900 dark:text-white mb-4">Experts más activados</p>
              {expertDist.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-xs text-gray-400">Sin datos de experts</div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={expertDist} layout="vertical" margin={{ top: 0, right: 8, left: 4, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#8B8AA0' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#8B8AA0' }} axisLine={false} tickLine={false} width={90} />
                    <Tooltip contentStyle={TT} itemStyle={{ color: '#F0EFF8' }} />
                    <Bar dataKey="value" name="Activaciones" radius={[0, 4, 4, 0]}>
                      {expertDist.map((_, i) => <Cell key={i} fill={EXPERT_COLORS[i % EXPERT_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Graph vs Vector hits timeline */}
          <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-5 shadow-sm">
            <p className="text-sm font-bold text-gray-900 dark:text-white mb-4">GRAPH vs VECTOR hits · 14 días</p>
            {hitsTimeline.length === 0 ? (
              <div className="h-36 flex items-center justify-center text-xs text-gray-400">Sin datos aún</div>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={hitsTimeline} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradGraph" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradVector" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0EB5C6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0EB5C6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8B8AA0' }} axisLine={false} tickLine={false} tickFormatter={v => (v as string).slice(5)} />
                  <YAxis tick={{ fontSize: 11, fill: '#8B8AA0' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={TT} itemStyle={{ color: '#F0EFF8' }} labelStyle={{ color: '#8B8AA0' }} />
                  <Area type="monotone" dataKey="graph" name="GRAPH hits" stroke="#7C3AED" strokeWidth={2} fill="url(#gradGraph)" dot={false} />
                  <Area type="monotone" dataKey="vector" name="VECTOR hits" stroke="#0EB5C6" strokeWidth={2} fill="url(#gradVector)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Query log table */}
          <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5 flex items-center gap-3">
              <GitCommit className="w-4 h-4 text-teal-500" />
              <span className="text-sm font-bold text-gray-900 dark:text-white">Log de queries</span>
              <div className="ml-auto flex items-center gap-2 bg-gray-100 dark:bg-white/5 rounded-xl px-3 py-1.5">
                <Search className="w-3.5 h-3.5 text-gray-400" />
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(0); }}
                  placeholder="Filtrar queries..."
                  className="bg-transparent text-xs text-gray-700 dark:text-gray-300 outline-none w-36 placeholder-gray-400"
                />
              </div>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {pageLogs.map(log => (
                <div key={log.id} className="px-5 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition">
                  <div className="flex items-start gap-3">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0"
                      style={{ backgroundColor: (METHOD_COLORS[log.routing_method] ?? '#6B7280') + '22', color: METHOD_COLORS[log.routing_method] ?? '#6B7280' }}>
                      {log.routing_method}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{log.query_preview}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-gray-400">{new Date(log.created_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        <span className="text-[10px] text-violet-400">G:{log.graph_hits}</span>
                        <span className="text-[10px] text-teal-400">V:{log.vector_hits}</span>
                        {(log.experts_activated || []).length > 0 && (
                          <span className="text-[10px] text-gray-400">experts: {log.experts_activated.join(', ')}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-gray-500 flex-shrink-0">{log.total_hits}</span>
                  </div>
                </div>
              ))}
            </div>
            {pageCount > 1 && (
              <div className="px-5 py-3 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
                <span className="text-xs text-gray-400">{filtered.length} queries · página {page + 1}/{pageCount}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-30 transition">
                    <ChevronLeft className="w-4 h-4 text-gray-400" />
                  </button>
                  <button onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-30 transition">
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
