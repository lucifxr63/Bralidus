import { useState } from 'react';
import { ShieldCheck, Copy, Check, Calendar, TrendingUp, AlertTriangle, ExternalLink, Scale, FileText } from 'lucide-react';
import { toast } from 'sonner';

export interface BralidusEvidenceItem {
  claim: string;
  shape: 'financial' | 'doctrine';
  date?: string;
  indicator?: string;
  value?: number;
  unit?: string;
  source?: string;
  source_url?: string;
  dimension?: string;
  entity_value?: string;
  threshold?: number;
}

export interface BralidusAlert {
  title: string;
  severity: 'warning' | 'critical' | 'info';
  description: string;
}

export interface BralidusEvidenceWallProps {
  evidences?: BralidusEvidenceItem[];
  alerts?: BralidusAlert[];
  dataFreshness?: Record<string, string> | null;
  className?: string;
}

export function BralidusEvidenceWall({
  evidences = [],
  alerts = [],
  dataFreshness = null,
  className = '',
}: BralidusEvidenceWallProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyCitation = (ev: BralidusEvidenceItem, index: number) => {
    const citation = `[Evidencia Bralidus RaaS] "${ev.claim}" — Fuente: ${ev.source || 'Scouttech Engine'} ${ev.date ? `(${ev.date})` : ''}`;
    navigator.clipboard.writeText(citation);
    setCopiedIndex(index);
    toast.success('Cita copiada al portapapeles');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Encabezado e indicador RaaS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#0EB5C6]/5 border border-[#0EB5C6]/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0EB5C6]/15 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-[#0EB5C6]" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              Muro de Evidencias Citables
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#0EB5C6] text-black">
                MoE GraphRAG
              </span>
            </h4>
            <p className="text-xs text-gray-400">
              Citas estructuradas y trazables provenientes de Banco Central, CMF, FRED y Leyes Chile.
            </p>
          </div>
        </div>

        {dataFreshness && (
          <div className="flex items-center gap-2 text-xs text-gray-400 font-mono">
            <Calendar className="w-3.5 h-3.5 text-[#0EB5C6]" />
            <span>BCCh/CMF: {Object.values(dataFreshness)[0] || 'Al día'}</span>
          </div>
        )}
      </div>

      {/* Alertas Regulatorias / Familia A */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          <h5 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> Alertas de Sensibilidad Regulatoria (Familia A)
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alerts.map((alert, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-start gap-3"
              >
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-amber-200">{alert.title}</p>
                  <p className="text-xs text-amber-300/80 leading-relaxed">{alert.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Muro de Evidencias */}
      {evidences.length === 0 ? (
        <div className="py-12 text-center rounded-2xl border border-dashed border-white/10 text-gray-400 text-xs">
          No hay evidencias citables asociadas a esta consulta aún.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {evidences.map((ev, idx) => {
            const isMacro = ev.shape === 'financial';
            return (
              <div
                key={idx}
                className="group relative p-4 rounded-2xl bg-white dark:bg-[#12121A] border border-gray-100 dark:border-white/5 hover:border-[#0EB5C6]/40 transition-all shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                      isMacro
                        ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                        : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                    }`}
                  >
                    {isMacro ? <TrendingUp className="w-3 h-3" /> : <Scale className="w-3 h-3" />}
                    {isMacro ? 'Dato Macro Fechado' : 'Doctrina Normativa'}
                  </span>

                  <button
                    onClick={() => copyCitation(ev, idx)}
                    className="p-1.5 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-[#0EB5C6]/20 text-gray-400 hover:text-[#0EB5C6] transition"
                    title="Copiar cita"
                  >
                    {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-relaxed font-sans">
                  "{ev.claim}"
                </p>

                <div className="pt-2 border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-[11px] text-gray-400 font-mono">
                  <div className="flex items-center gap-1.5 truncate">
                    <FileText className="w-3 h-3 text-[#0EB5C6] shrink-0" />
                    <span className="truncate">{ev.source || 'Fuente Oficial'}</span>
                  </div>

                  {ev.source_url ? (
                    <a
                      href={ev.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#0EB5C6] hover:underline"
                    >
                      Verificar <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : ev.date ? (
                    <span>{ev.date}</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
