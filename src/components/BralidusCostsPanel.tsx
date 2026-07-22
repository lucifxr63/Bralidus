import { Zap, TrendingUp, ShieldCheck, Clock } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';

export interface BralidusCostsPanelProps {
  totalTokens?: number;
  className?: string;
}

const COLORS = ['#0EB5C6', '#2DD4BF', '#F59E0B', '#EC4899'];

const tooltipStyle = {
  backgroundColor: '#12121A',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '10px',
  color: '#F0EFF8',
  fontSize: '12px',
};

export function BralidusCostsPanel({ totalTokens = 1250000, className = '' }: BralidusCostsPanelProps) {
  const accumulatedTokens = Math.round(totalTokens * 1.35);
  const costUSD = ((accumulatedTokens / 1_000_000) * 2.85).toFixed(2);
  const costCLP = Math.round(parseFloat(costUSD) * 940).toLocaleString('es-CL');

  const dailyTokensData = [
    { date: '07-09', tokens: 42000 },
    { date: '07-10', tokens: 68000 },
    { date: '07-11', tokens: 95000 },
    { date: '07-12', tokens: 110000 },
    { date: '07-13', tokens: 88000 },
    { date: '07-14', tokens: 145000 },
    { date: '07-15', tokens: 160000 },
    { date: '07-16', tokens: 130000 },
    { date: '07-17', tokens: 175000 },
    { date: '07-18', tokens: 190000 },
    { date: '07-19', tokens: 210000 },
    { date: '07-20', tokens: 185000 },
    { date: '07-21', tokens: 240000 },
    { date: '07-22', tokens: 265000 },
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* KPIs de Inferencia & Telemetría RaaS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-4 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-[#0EB5C6]/10 flex items-center justify-center mb-3 text-[#0EB5C6]">
            <Zap className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-gray-900 dark:text-[#F0EFF8]">
            {accumulatedTokens.toLocaleString('es-CL')}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Tokens acumulados Bralidus MoE</p>
        </div>

        <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-4 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-[#2DD4BF]/10 flex items-center justify-center mb-3 text-[#2DD4BF]">
            <TrendingUp className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-gray-900 dark:text-[#F0EFF8]">
            ${costUSD} USD
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            ~CLP {costCLP}
          </p>
        </div>

        <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-4 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center mb-3 text-purple-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-gray-900 dark:text-[#F0EFF8]">84.2%</p>
          <p className="text-xs text-gray-400 mt-0.5">Efectividad Caché (Hit Rate)</p>
        </div>

        <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-4 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center mb-3 text-amber-400">
            <Clock className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-gray-900 dark:text-[#F0EFF8]">840 ms</p>
          <p className="text-xs text-gray-400 mt-0.5">Latencia Prom. MoE (P90: 1.2s)</p>
        </div>
      </div>

      {/* Gráficos de Invocación y Expertos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 dark:text-[#C4C4D4] mb-4">Invocaciones RaaS diarias — últimos 14 días</h3>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={dailyTokensData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8B8AA0' }} />
              <YAxis tick={{ fontSize: 11, fill: '#8B8AA0' }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="tokens" fill="#0EB5C6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 dark:text-[#C4C4D4] mb-4">Uso por Experto Bralidus MoE</h3>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Macroeconomía (BCCh/FRED)', value: 45 },
                    { name: 'Unit Economics SaaS', value: 25 },
                    { name: 'Doctrina Legal Chile', value: 18 },
                    { name: 'Licitaciones B2G (Licitus)', value: 12 },
                  ]}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={42}
                  paddingAngle={4}
                >
                  {COLORS.map((color, idx) => (
                    <Cell key={idx} fill={color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>

            <div className="w-full space-y-2 text-xs">
              {[
                { name: 'Macroeconomía (BCCh/FRED)', pct: '45%', color: '#0EB5C6' },
                { name: 'Unit Economics SaaS', pct: '25%', color: '#2DD4BF' },
                { name: 'Doctrina Legal Chile', pct: '18%', color: '#F59E0B' },
                { name: 'Licitus B2G', pct: '12%', color: '#EC4899' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                    <span className="text-[#C4C4D4]">{item.name}</span>
                  </div>
                  <span className="font-bold text-white font-mono">{item.pct}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de llaves desarrollador */}
      <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-700 dark:text-[#C4C4D4] mb-4">Consumo por Developer API Key</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-gray-400">
                <th className="pb-3 font-semibold">API Key Prefix</th>
                <th className="pb-3 font-semibold">Identificador</th>
                <th className="pb-3 font-semibold">Endpoint Principal</th>
                <th className="pb-3 font-semibold text-right">Invocaciones</th>
                <th className="pb-3 font-semibold text-right">Tokens</th>
                <th className="pb-3 font-semibold text-right">Caché Hit %</th>
                <th className="pb-3 font-semibold text-right">Costo Est. ($USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                { key: 'val_live_9f82a...', dev: 'Scouttech App Main', ep: '/api/v1/intel/query', reqs: 1420, tokens: 482000, hit: '88%', cost: '$1.37' },
                { key: 'val_live_3k11c...', dev: 'Fintech Dashboard', ep: '/api/v1/data/economy', reqs: 890, tokens: 210000, hit: '92%', cost: '$0.60' },
                { key: 'val_live_7a04x...', dev: 'Licitus B2G Radar', ep: '/api/v1/data/licitus/proveedor', reqs: 410, tokens: 165000, hit: '76%', cost: '$0.47' },
                { key: 'val_live_2m88p...', dev: 'S-Pulse Graph Demo', ep: '/api/v1/data/spulse/companies', reqs: 310, tokens: 98000, hit: '81%', cost: '$0.28' },
              ].map((row, idx) => (
                <tr key={idx} className="hover:bg-white/[0.02]">
                  <td className="py-3 font-mono text-[#0EB5C6] font-medium">{row.key}</td>
                  <td className="py-3 text-white font-medium">{row.dev}</td>
                  <td className="py-3 font-mono text-gray-400">{row.ep}</td>
                  <td className="py-3 text-right font-mono text-white">{row.reqs.toLocaleString()}</td>
                  <td className="py-3 text-right font-mono text-[#2DD4BF]">{row.tokens.toLocaleString()}</td>
                  <td className="py-3 text-right font-mono text-purple-300">{row.hit}</td>
                  <td className="py-3 text-right font-mono text-amber-300 font-bold">{row.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
