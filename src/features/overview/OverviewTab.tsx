import { Activity, Zap, TrendingUp, Key, Gauge } from 'lucide-react';
import type { PortalStats, ApiUsageLog } from '@/types/portal';

interface OverviewTabProps {
  stats: PortalStats;
  loading: boolean;
  logs: ApiUsageLog[];
  onNewKey: () => void;
  onNavigate: (tab: string) => void;
}

export function OverviewTab({ stats, loading, logs, onNavigate }: OverviewTabProps) {
  // El consumo que importa es el de CRÉDITOS del mes en curso, porque es la
  // única cifra contra la que el gateway aplica la cuota. Antes acá sólo se
  // veían requests y tokens: dos números que no se comparan con ningún tope, y
  // por eso "no se descontaba nada" aunque el backend sí estuviera midiendo.
  const pctCuota = stats.creditLimit > 0
    ? Math.min(100, (stats.creditsThisMonth / stats.creditLimit) * 100)
    : 0;
  const colorCuota = pctCuota >= 90 ? '#EF4444' : pctCuota >= 70 ? '#F59E0B' : '#10B981';

  const kpis = [
    {
      label: `Créditos del mes · plan ${stats.tier}`,
      value: `${stats.creditsThisMonth.toLocaleString()} / ${stats.creditLimit.toLocaleString()}`,
      icon: Gauge, accent: colorCuota, bg: 'rgba(16,185,129,0.10)',
    },
    { label: 'Requests totales', value: stats.totalReqs.toLocaleString(), icon: Activity, accent: '#8B5CF6', bg: 'rgba(139,92,246,0.10)' },
    { label: 'Hoy', value: stats.todayReqs.toLocaleString(), icon: Zap, accent: '#0EB5C6', bg: 'rgba(14,181,198,0.10)' },
    // Se deja explícito que esto NO es la cuota: son dos unidades distintas y
    // mezclarlas fue el bug original (/data/macro cobra 1 crédito y reporta 30
    // tokens).
    { label: 'Tokens (telemetría, no cuota)', value: stats.totalTokens > 1000 ? `${(stats.totalTokens / 1000).toFixed(1)}k` : stats.totalTokens.toString(), icon: TrendingUp, accent: '#F59E0B', bg: 'rgba(245,158,11,0.10)' },
    { label: 'Llaves activas', value: stats.activeKeys.toString(), icon: Key, accent: '#EC4899', bg: 'rgba(236,72,153,0.10)' },
  ];

  const recentLogs = [...logs].reverse().slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Quick Connect AI & API Banner */}
      <div style={{
        background: 'linear-gradient(90deg, rgba(108,60,225,0.18), rgba(14,181,198,0.15))',
        border: '1px solid rgba(108,60,225,0.4)',
        borderRadius: 14,
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#F3F2FD', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🔌 ¿Listo para conectar tu API o Asistente de IA (Cursor / Claude)?</span>
            <span style={{ fontSize: 10, background: 'rgba(14,181,198,0.2)', color: '#0EB5C6', padding: '2px 7px', borderRadius: 4, fontWeight: 700 }}>
              llms.txt Ready
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#A8A6C8', marginTop: 3 }}>
            Copia la Base URL de Producción y los snippets para IDE en nuestro Hub de Conexión.
          </div>
        </div>
        <button
          onClick={() => onNavigate('apikeys')}
          style={{
            background: 'linear-gradient(135deg, #6C3CE1, #0EB5C6)',
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(108,60,225,0.35)',
            transition: 'transform 0.15s',
          }}
        >
          Ir al Hub de Conexión →
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        {kpis.map(({ label, value, icon: Icon, accent, bg }) => (
          <div
            key={label}
            style={{
              background: '#0E0E1A', border: '1px solid rgba(108,60,225,0.12)',
              borderRadius: 16, padding: 18, transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${accent}35`; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 20px ${accent}12`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(108,60,225,0.12)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Icon style={{ width: 16, height: 16, color: accent }} />
            </div>
            <p style={{ fontSize: 26, fontWeight: 900, color: '#E8E7F5', margin: 0, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.5px' }}>
              {loading ? '—' : value}
            </p>
            <p style={{ fontSize: 12, color: '#5A5A78', marginTop: 3, margin: '3px 0 0' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Sprint Changelog */}
      <div style={{ background: 'rgba(14,181,198,0.05)', border: '1px solid rgba(14,181,198,0.18)', borderRadius: 16, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 100, color: '#A78BFA', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            Sprint 8 · 2026-06-10
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#E8E7F5' }}>AnimusPY Beta — Motor de Inteligencia Macro en Producción</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {[
            {
              tag: 'Producción', color: '#10B981',
              title: 'AnimusPY Beta — 10/10 tests PASS',
              desc: '687 nodos · 34 categorías · 96% embedding coverage. FastAPI + pgvector HNSW + APScheduler 9 jobs. GraphRAG: 5/5 hits via GRAPH path en queries fintech/seed con 43 entidades activadas.',
              path: 'GET /health → status=ok',
            },
            {
              tag: 'Nueva infraestructura', color: '#7C3AED',
              title: 'Radar Forense + 6 extractores',
              desc: 'CMF Hechos Esenciales · BCCH Comunicados/Minutas · SEIA Proyectos · Boletín Concursal · Señal Empleo · RSS 10 fuentes ES+PT. Señales con TTL, severidad y clasificación.',
              path: 'GET /radar/signals',
            },
          ].map(({ tag, color, title, desc, path }) => (
            <div key={title} style={{ background: '#0E0E1A', borderRadius: 12, padding: 14, border: '1px solid rgba(108,60,225,0.10)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', boxShadow: `0 0 6px ${color}80` }} />
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#7674A0' }}>{tag}</span>
              </div>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: '#D4D2F0', marginBottom: 5, margin: '0 0 5px' }}>{title}</p>
              <p style={{ fontSize: 11, color: '#6A6888', lineHeight: 1.6, marginBottom: 8, margin: '0 0 8px' }}>{desc}</p>
              <code style={{ fontSize: 10.5, fontFamily: 'monospace', background: 'rgba(14,181,198,0.08)', color: '#0EB5C6', padding: '3px 8px', borderRadius: 6 }}>
                {path}
              </code>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          { label: '→ Playground API', tab: 'playground', color: '#6C3CE1' },
          { label: '→ Documentación v1', tab: 'docs', color: '#0EB5C6' },
          { label: '→ RAG Audit', tab: 'audit', color: '#8B5CF6' },
          { label: '→ Knowledge Graph', tab: 'graph', color: '#EC4899' },
        ].map(({ label, tab, color }) => (
          <button
            key={tab}
            onClick={() => onNavigate(tab)}
            style={{
              background: 'rgba(108,60,225,0.07)', border: `1px solid ${color}30`,
              borderRadius: 10, padding: '8px 16px',
              cursor: 'pointer', color, fontSize: 12.5, fontWeight: 600,
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${color}14`; (e.currentTarget as HTMLButtonElement).style.borderColor = `${color}55`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,60,225,0.07)'; (e.currentTarget as HTMLButtonElement).style.borderColor = `${color}30`; }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Recent Activity */}
      {recentLogs.length > 0 && (
        <div style={{ background: '#0E0E1A', border: '1px solid rgba(108,60,225,0.12)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(108,60,225,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity style={{ width: 14, height: 14, color: '#6C3CE1' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#C4B5FD' }}>Actividad Reciente</span>
          </div>
          <div>
            {recentLogs.map(log => (
              <div key={log.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid rgba(108,60,225,0.06)' }}>
                <code style={{ fontSize: 11.5, color: '#0EB5C6', fontFamily: 'monospace' }}>{log.endpoint}</code>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#7674A0' }}>{(log.requests_count || 1).toLocaleString()} req</span>
                  <span style={{ fontSize: 10.5, color: '#4A4868', fontFamily: 'monospace' }}>
                    {new Date(log.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
