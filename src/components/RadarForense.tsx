import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Radio, RefreshCw, AlertTriangle, Star, ThumbsDown } from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';

interface Signal {
  id: string;
  created_at: string;
  sector: string;
  signal_type: string;
  severity: number;
  headline_preview: string;
  source: string;
  classified_by: string;
  expires_at: string | null;
  analyst_rating: number | null;
  is_false_positive: boolean | null;
  analyst_notes: string | null;
  rated_by: string | null;
}

const TT = { backgroundColor: '#12121A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 };
const PIE_COLORS = ['#0EB5C6','#7C3AED','#F59E0B','#EC4899','#10B981','#3B82F6','#EF4444','#F97316'];

function severityColor(s: number) {
  if (s >= 0.8) return '#EF4444';
  if (s >= 0.6) return '#F59E0B';
  if (s >= 0.4) return '#0EB5C6';
  return '#10B981';
}

export default function RadarForense() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingId, setRatingId] = useState<string | null>(null);
  const [ratingVal, setRatingVal] = useState(0);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const { data } = await supabase
      .from('radar_signals')
      .select('id,created_at,sector,signal_type,severity,headline_preview,source,classified_by,expires_at,analyst_rating,is_false_positive,analyst_notes,rated_by')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200);
    setSignals((data as Signal[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const now = new Date();
  const active = useMemo(() => signals.filter(s => !s.expires_at || new Date(s.expires_at) > now), [signals]);
  const rated  = useMemo(() => signals.filter(s => s.analyst_rating != null), [signals]);
  const fp     = useMemo(() => signals.filter(s => s.is_false_positive === true), [signals]);

  const bySector = useMemo(() => {
    const m: Record<string, number> = {};
    signals.forEach(s => { m[s.sector] = (m[s.sector] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [signals]);

  const byClassifier = useMemo(() => {
    const m: Record<string, number> = {};
    signals.forEach(s => { const c = s.classified_by || 'unknown'; m[c] = (m[c] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [signals]);

  const sevBuckets = useMemo(() => [
    { name: 'Bajo < 0.4',    value: signals.filter(s => s.severity < 0.4).length,              fill: '#10B981' },
    { name: 'Medio 0.4-0.6', value: signals.filter(s => s.severity >= 0.4 && s.severity < 0.6).length, fill: '#0EB5C6' },
    { name: 'Alto 0.6-0.8',  value: signals.filter(s => s.severity >= 0.6 && s.severity < 0.8).length, fill: '#F59E0B' },
    { name: 'Crítico ≥ 0.8', value: signals.filter(s => s.severity >= 0.8).length,             fill: '#EF4444' },
  ], [signals]);

  const avgRating = rated.length > 0
    ? (rated.reduce((s, r) => s + (r.analyst_rating ?? 0), 0) / rated.length).toFixed(1)
    : null;

  const saveRating = async (id: string, rating: number) => {
    setSaving(true);
    await supabase.from('radar_signals').update({ analyst_rating: rating, rated_at: new Date().toISOString() }).eq('id', id);
    setSignals(prev => prev.map(s => s.id === id ? { ...s, analyst_rating: rating } : s));
    setRatingId(null);
    setSaving(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
          <Radio className="w-4 h-4 text-red-500" />
        </div>
        <div>
          <h2 className="font-black text-gray-900 dark:text-white text-sm">Radar Forense — Señales de Mercado</h2>
          <p className="text-[11px] text-gray-400">Últimos 30 días · {signals.length} señales detectadas</p>
        </div>
        <button onClick={load} className="ml-auto flex items-center gap-1.5 text-xs text-gray-400 hover:text-teal-400 transition">
          <RefreshCw className="w-3.5 h-3.5" />
          Actualizar
        </button>
      </div>

      {signals.length === 0 ? (
        <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-10 text-center shadow-sm">
          <Radio className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Sin señales aún — el Radar Refresh corre cada 30 min</p>
          <p className="text-xs text-gray-500 mt-1">Primera ejecución: próximas :00 o :30 del reloj</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total (30 días)', value: signals.length, color: 'text-violet-500', bg: 'bg-violet-500/10' },
              { label: 'Activas ahora', value: active.length, color: 'text-red-500', bg: 'bg-red-500/10' },
              { label: 'Calificadas', value: `${rated.length} ${avgRating ? `(⌀${avgRating})` : ''}`, color: 'text-teal-500', bg: 'bg-teal-500/10' },
              { label: 'Falsos positivos', value: fp.length, color: 'text-amber-500', bg: 'bg-amber-500/10' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-4 shadow-sm">
                <div className={`w-2 h-2 rounded-full mb-2 ${bg.replace('/10','').replace('bg-','bg-')}`} style={{ width: 8, height: 8 }} />
                <p className={`text-xl font-black ${color}`}>{value}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* By sector */}
            <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-5 shadow-sm">
              <p className="text-sm font-bold text-gray-900 dark:text-white mb-4">Por sector</p>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={bySector} cx="50%" cy="45%" innerRadius={40} outerRadius={64} paddingAngle={3} dataKey="value">
                    {bySector.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={TT} itemStyle={{ color: '#F0EFF8' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', color: '#8B8AA0' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Severity buckets */}
            <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-5 shadow-sm">
              <p className="text-sm font-bold text-gray-900 dark:text-white mb-4">Distribución de severidad</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={sevBuckets} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#8B8AA0' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#8B8AA0' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={TT} itemStyle={{ color: '#F0EFF8' }} />
                  <Bar dataKey="value" name="Señales" radius={[4, 4, 0, 0]}>
                    {sevBuckets.map((b, i) => <Cell key={i} fill={b.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Classifier breakdown */}
          <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-5 shadow-sm">
            <p className="text-sm font-bold text-gray-900 dark:text-white mb-3">Clasificado por</p>
            <div className="flex flex-wrap gap-3">
              {byClassifier.map(({ name, value }) => (
                <div key={name} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5">
                  <span className="text-xs font-mono text-teal-400">{name}</span>
                  <span className="text-sm font-black text-gray-900 dark:text-white">{value}</span>
                  <span className="text-[11px] text-gray-400">({((value / signals.length) * 100).toFixed(0)}%)</span>
                </div>
              ))}
            </div>
            {fp.length > 0 && (
              <div className="mt-3 flex items-center gap-2 text-xs text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                {fp.length} falso{fp.length > 1 ? 's' : ''} positivo{fp.length > 1 ? 's' : ''} detectado{fp.length > 1 ? 's' : ''} · revisar reglas del classifier para reducir ruido
              </div>
            )}
          </div>

          {/* Recent signals table */}
          <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5">
              <span className="text-sm font-bold text-gray-900 dark:text-white">Señales recientes</span>
              <span className="ml-2 text-[11px] text-gray-400">· click en ★ para calificar relevancia</span>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {signals.slice(0, 15).map(sig => (
                <div key={sig.id} className="px-5 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition">
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ backgroundColor: severityColor(sig.severity) + '22', color: severityColor(sig.severity) }}
                    >
                      {sig.severity.toFixed(2)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{sig.headline_preview}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-400">{sig.sector}</span>
                        <span className="text-[10px] text-gray-500">·</span>
                        <span className="text-[10px] text-gray-400">{sig.signal_type}</span>
                        <span className="text-[10px] text-gray-500">·</span>
                        <span className="text-[10px] text-gray-400">{new Date(sig.created_at).toLocaleDateString('es-CL')}</span>
                        <span className="text-[10px] text-gray-500">·</span>
                        <code className="text-[10px] text-violet-400">{sig.classified_by}</code>
                      </div>
                    </div>
                    {/* Rating */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {ratingId === sig.id ? (
                        <>
                          {[1,2,3,4,5].map(n => (
                            <button key={n} onClick={() => saveRating(sig.id, n)} disabled={saving}
                              className={`text-sm transition ${ratingVal >= n ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'} hover:text-amber-400`}
                              onMouseEnter={() => setRatingVal(n)} onMouseLeave={() => setRatingVal(sig.analyst_rating ?? 0)}>
                              ★
                            </button>
                          ))}
                        </>
                      ) : (
                        <button onClick={() => { setRatingId(sig.id); setRatingVal(sig.analyst_rating ?? 0); }}
                          className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-amber-400 transition">
                          {sig.analyst_rating ? (
                            <span className="text-amber-400 font-bold">★ {sig.analyst_rating}</span>
                          ) : (
                            <Star className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                      {sig.is_false_positive && (
                        <ThumbsDown className="w-3 h-3 text-red-400 ml-1" aria-label="Falso positivo" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
