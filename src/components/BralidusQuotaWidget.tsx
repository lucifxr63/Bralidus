import { useState } from 'react';
import { Zap, ShieldCheck, ChevronRight, AlertTriangle, AlertCircle, Bell, Mail } from 'lucide-react';
import { toast } from 'sonner';


export interface BralidusQuotaWidgetProps {
  tier?: string;
  /** Número de llamadas consumidas en el período actual */
  currentUsage?: number;
  /** Límite total del plan (alias: limitCount) */
  planLimit?: number;
  /** @deprecated — usa currentUsage */
  usageCount?: number;
  /** @deprecated — usa planLimit */
  limitCount?: number;
  className?: string;
}

// ── Color logic: verde <70% · amarillo 70-90% · rojo >90% ────────────────────

type UsageLevel = 'safe' | 'warning' | 'critical';

function getUsageLevel(pct: number): UsageLevel {
  if (pct >= 90) return 'critical';
  if (pct >= 70) return 'warning';
  return 'safe';
}

const LEVEL_CONFIG = {
  safe: {
    bar:    'from-[#0EB5C6] to-[#2DD4BF]',
    text:   'text-emerald-400',
    border: 'border-emerald-500/20',
    bg:     'bg-emerald-500/10',
    icon:   ShieldCheck,
    label:  'Uso normal',
  },
  warning: {
    bar:    'from-amber-400 to-yellow-500',
    text:   'text-amber-400',
    border: 'border-amber-500/20',
    bg:     'bg-amber-500/10',
    icon:   AlertTriangle,
    label:  'Uso elevado (>70%)',
  },
  critical: {
    bar:    'from-red-500 to-rose-600',
    text:   'text-red-400',
    border: 'border-red-500/20',
    bg:     'bg-red-500/10',
    icon:   AlertCircle,
    label:  'Alerta de límite (>90%)',
  },
} as const;

export function BralidusQuotaWidget({
  tier = 'pro',
  currentUsage,
  planLimit,
  usageCount,
  limitCount,
  className = '',
}: BralidusQuotaWidgetProps) {
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [alertThreshold, setAlertThreshold] = useState<80 | 90>(80);
  const [showAlertConfig, setShowAlertConfig] = useState(false);

  // Support both old (usageCount/limitCount) and new (currentUsage/planLimit) prop names
  const used  = currentUsage ?? usageCount ?? 42;
  const limit = planLimit    ?? limitCount  ?? 1000;

  const percentage = Math.min(Math.round((used / (limit || 1)) * 100), 100);
  const level      = getUsageLevel(percentage);
  const cfg        = LEVEL_CONFIG[level];
  const LevelIcon  = cfg.icon;

  const handleSaveAlerts = () => {
    setShowAlertConfig(false);
    toast.success(`Alertas configuradas al ${alertThreshold}% de consumo vía email y webhooks`);
  };

  return (
    <div className={`p-4 rounded-2xl bg-white dark:bg-[#12121A] border border-gray-100 dark:border-white/5 shadow-sm ${className}`}>
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#0EB5C6]/15 flex items-center justify-center">
            <Zap className="w-4 h-4 text-[#0EB5C6]" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              Créditos &amp; Cuota RaaS
              <span className={`uppercase text-[9px] font-black px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                {tier}
              </span>
            </p>
            <p className="text-[11px] text-gray-400">Llamadas API acumuladas este mes</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="quota-alerts-btn"
            onClick={() => setShowAlertConfig(v => !v)}
            title="Configurar Alertas Proactivas de Cuota"
            className={`p-1.5 rounded-lg border text-xs transition flex items-center gap-1 ${
              alertsEnabled
                ? 'bg-violet-500/10 border-violet-500/20 text-violet-400 hover:bg-violet-500/20'
                : 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-400'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold hidden sm:inline">{alertThreshold}%</span>
          </button>

          <span className={`text-xs font-mono font-bold ${cfg.text}`}>
            {used.toLocaleString()} / {limit.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Alert config drop-down panel */}
      {showAlertConfig && (
        <div className="mb-3 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-violet-500/20 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-violet-400" /> Alertas proactivas de cuota
            </span>
            <input
              type="checkbox"
              checked={alertsEnabled}
              onChange={e => setAlertsEnabled(e.target.checked)}
              className="accent-violet-500"
            />
          </div>
          <p className="text-[11px] text-gray-400">
            Recibe un aviso por correo y webhook cuando tu consumo supere el umbral.
          </p>
          <div className="flex items-center gap-3 pt-1">
            <label className="flex items-center gap-1 text-[11px] cursor-pointer">
              <input
                type="radio"
                name="threshold"
                checked={alertThreshold === 80}
                onChange={() => setAlertThreshold(80)}
                className="accent-violet-500"
              />
              <span>80% (Preventivo)</span>
            </label>
            <label className="flex items-center gap-1 text-[11px] cursor-pointer">
              <input
                type="radio"
                name="threshold"
                checked={alertThreshold === 90}
                onChange={() => setAlertThreshold(90)}
                className="accent-violet-500"
              />
              <span>90% (Crítico)</span>
            </label>
            <button
              onClick={handleSaveAlerts}
              className="ml-auto px-2 py-0.5 rounded bg-violet-600 text-white font-bold text-[10px] hover:bg-violet-500 transition"
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="w-full h-2.5 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-700 bg-gradient-to-r ${cfg.bar}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Helper text + status */}
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
        Has consumido{' '}
        <span className={`font-bold ${cfg.text}`}>{used.toLocaleString()}</span>
        {' '}de{' '}
        <span className="font-semibold text-gray-700 dark:text-gray-300">{limit.toLocaleString()}</span>
        {' '}llamadas este mes
        <span className="ml-1 text-gray-400">({percentage}%)</span>
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between text-[11px]">
        <span className={`flex items-center gap-1 font-medium ${cfg.text}`}>
          <LevelIcon className="w-3.5 h-3.5" />
          {cfg.label}
        </span>
        <button
          id="quota-upgrade-btn"
          onClick={() => window.open('https://validateai.scouttech.lat/pricing', '_blank')}
          className="inline-flex items-center gap-0.5 font-semibold text-[#0EB5C6] hover:underline"
        >
          Upgrade Tier <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

