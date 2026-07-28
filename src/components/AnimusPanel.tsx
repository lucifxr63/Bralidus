import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Brain, Database, GitBranch, RefreshCw, Cpu } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface CatCount { category: string; count: number }

const TT = { backgroundColor: '#12121A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 };

const CAT_COLORS = [
  '#0EB5C6','#2DD4BF','#7C3AED','#F59E0B','#EC4899',
  '#10B981','#3B82F6','#EF4444','#8B5CF6','#06B6D4',
  '#F97316','#84CC16',
];

const ENDPOINTS = [
  { method: 'POST', path: '/query/moe', desc: 'GatingNetwork 2 etapas — Radar boost + GraphRAG híbrido', color: '#7C3AED' },
  { method: 'POST', path: '/query',     desc: 'RAG dinámico — startup_context → entidades → contexto Markdown', color: '#0EB5C6' },
  { method: 'GET',  path: '/entities',  desc: 'Lista todos los nodos del KG por categoría con metadata', color: '#2DD4BF' },
  { method: 'GET',  path: '/radar/signals', desc: 'Señales activas del Radar Forense (tiempo real, sin auth)', color: '#F59E0B' },
  { method: 'PATCH',path: '/radar/signals/{id}/rate', desc: 'Feedback analista: rating 1-5, is_false_positive, notas', color: '#EC4899' },
  { method: 'POST', path: '/ingest',    desc: 'Dispara pipeline FRED + yfinance en background task', color: '#10B981' },
  { method: 'GET',  path: '/health',    desc: 'Estado del sistema + job_health por scheduler job', color: '#3B82F6' },
];

const JOBS = [
  { label: 'Radar Forense',          cron: 'Cada 30 min' },
  { label: 'CMF Hechos Esenciales',  cron: '09:15 · 13:15 · 17:15' },
  { label: 'BCCH Minutas + Comunicados', cron: 'Lunes 07:00' },
  { label: 'SEIA Proyectos',         cron: 'Cada 3 días 08:00' },
  { label: 'Boletín Concursal',      cron: 'Hábiles 07:30' },
  { label: 'Señal Empleo Sectorial', cron: 'Sábados 09:00' },
  { label: 'FRED Macro USA',         cron: 'Domingos 03:00' },
  { label: 'yfinance Tickers',       cron: 'Día 1 cada mes' },
  { label: 'Cache Sweep',            cron: 'Cada 2 horas' },
];

export default function AnimusPanel() {
  const [cats, setCats] = useState<CatCount[]>([]);
  const [nodes, setNodes] = useState(0);
  const [edges, setEdges] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: nd }, { count: ec }] = await Promise.all([
        supabase.from('knowledge_nodes').select('category'),
        supabase.from('knowledge_edges').select('id', { count: 'exact', head: true }),
      ]);
      if (nd) {
        const map: Record<string, number> = {};
        nd.forEach(r => { const c = r.category || 'Sin categoría'; map[c] = (map[c] || 0) + 1; });
        setCats(Object.entries(map).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count));
        setNodes(nd.length);
      }
      setEdges(ec ?? 0);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
          <Brain className="w-4 h-4 text-violet-500" />
        </div>
        <div>
          <h2 className="font-black text-gray-900 dark:text-white text-sm">BralidusPY — Motor de Inteligencia Macro</h2>
          <p className="text-[11px] text-gray-400">FastAPI + pgvector + APScheduler · GraphRAG híbrido GRAPH + VECTOR</p>
          <a
            href="https://braliduspy-production.up.railway.app/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-teal-400 hover:text-teal-300 transition font-mono"
          >
            braliduspy-production.up.railway.app ↗
          </a>
        </div>
        <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-400 uppercase tracking-wider">Railway</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Nodos KG', value: loading ? '—' : nodes.toLocaleString(), icon: Database, color: 'text-teal-500', bg: 'bg-teal-500/10' },
          { label: 'Aristas', value: loading ? '—' : edges.toLocaleString(), icon: GitBranch, color: 'text-violet-500', bg: 'bg-violet-500/10' },
          { label: 'Categorías', value: loading ? '—' : cats.length.toString(), icon: Cpu, color: 'text-amber-500', bg: 'bg-amber-500/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-4 shadow-sm">
            <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center mb-2`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-xl font-black text-gray-900 dark:text-[#F0EFF8]">{value}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* KG Coverage Chart */}
      <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-4 h-4 text-teal-500" />
          <span className="text-sm font-bold text-gray-900 dark:text-white">Distribución del Knowledge Graph</span>
          <span className="ml-auto text-[11px] text-gray-400">Top {Math.min(cats.length, 14)} categorías</span>
        </div>
        {loading ? (
          <div className="h-52 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={cats.slice(0, 14)} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: '#8B8AA0' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="category" tick={{ fontSize: 10, fill: '#8B8AA0' }} axisLine={false} tickLine={false} width={148} />
              <Tooltip contentStyle={TT} itemStyle={{ color: '#F0EFF8' }} />
              <Bar dataKey="count" name="Nodos" radius={[0, 4, 4, 0]}>
                {cats.slice(0, 14).map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Endpoints */}
      <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-gray-900 dark:text-white">API Reference</span>
          <code className="text-[10px] text-gray-400 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded">Authorization: Bearer &lt;BRALIDUS_API_KEY&gt;</code>
          <code className="text-[10px] text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded ml-auto">braliduspy-production.up.railway.app</code>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-white/5">
          {ENDPOINTS.map(ep => (
            <div key={ep.path} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded min-w-[42px] text-center"
                style={{ backgroundColor: ep.color + '22', color: ep.color }}>
                {ep.method}
              </span>
              <code className="text-xs font-mono text-gray-700 dark:text-gray-300 min-w-[220px]">{ep.path}</code>
              <span className="text-[11px] text-gray-400 flex-1 hidden sm:block">{ep.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scheduler */}
      <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5">
          <span className="text-sm font-bold text-gray-900 dark:text-white">APScheduler Jobs</span>
          <span className="ml-2 text-[11px] text-gray-400">· {JOBS.length} jobs · America/Santiago · health monitor activo</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 p-4 gap-2">
          {JOBS.map(job => (
            <div key={job.label} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/[0.03]">
              <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{job.label}</p>
                <p className="text-[10px] text-gray-400">{job.cron}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
