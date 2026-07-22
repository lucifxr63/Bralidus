import { Zap, ShieldCheck, ChevronRight } from 'lucide-react';

export interface BralidusQuotaWidgetProps {
  tier?: string;
  usageCount?: number;
  limitCount?: number;
  className?: string;
}

export function BralidusQuotaWidget({
  tier = 'pro',
  usageCount = 42,
  limitCount = 1000,
  className = '',
}: BralidusQuotaWidgetProps) {
  const percentage = Math.min(Math.round((usageCount / (limitCount || 1)) * 100), 100);

  return (
    <div className={`p-4 rounded-2xl bg-white dark:bg-[#12121A] border border-gray-100 dark:border-white/5 shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#0EB5C6]/15 flex items-center justify-center">
            <Zap className="w-4 h-4 text-[#0EB5C6]" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              Créditos & Cuota RaaS
              <span className="uppercase text-[9px] font-black px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                {tier}
              </span>
            </p>
            <p className="text-[11px] text-gray-400">Consultas semánticas MoE acumuladas</p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold text-gray-900 dark:text-white">
          {usageCount.toLocaleString()} / {limitCount.toLocaleString()}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-[#0EB5C6] to-[#2DD4BF]"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px]">
        <span className="text-gray-400 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-400" /> Reset mensual automático
        </span>
        <button
          onClick={() => window.open('https://validateai.scouttech.lat/pricing', '_blank')}
          className="inline-flex items-center gap-0.5 font-semibold text-[#0EB5C6] hover:underline"
        >
          Upgrade Tier <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
