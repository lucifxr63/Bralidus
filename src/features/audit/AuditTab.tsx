import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { AuditLog } from '@/components/AuditLog';
import type { AuditSummary, AuditLogEntry } from '@/types/portal';

interface AuditTabProps {
  auditSummaries: AuditSummary[];
  auditLogs: AuditLogEntry[];
}

export function AuditTab({ auditSummaries, auditLogs }: AuditTabProps) {
  const [view, setView] = useState<'rag' | 'system'>('rag');

  const summary = auditSummaries[0];
  const precisionPct = summary ? Math.round((summary.avg_precision ?? 0) * 100) : 0;
  const hitRate = summary?.hit_rate_pct ?? 0;

  const kpiColor = (v: number, good = 80, warn = 60) =>
    v >= good ? '#34D399' : v >= warn ? '#F59E0B' : '#F87171';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* View switcher */}
      <div style={{ display: 'flex', gap: 0, background: 'rgba(108,60,225,0.07)', border: '1px solid rgba(108,60,225,0.15)', borderRadius: 12, padding: 3, width: 'fit-content' }}>
        {[{ id: 'rag', label: 'RAG Pipeline' }, { id: 'system', label: 'Consola del Sistema' }].map(v => (
          <button
            key={v.id}
            onClick={() => setView(v.id as 'rag' | 'system')}
            style={{
              padding: '7px 18px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
              background: view === v.id ? '#6C3CE1' : 'none',
              color: view === v.id ? '#fff' : '#7674A0',
              transition: 'all 0.15s',
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'rag' && (
        auditSummaries.length === 0 ? (
          <div style={{ background: '#0E0E1A', border: '1px solid rgba(108,60,225,0.12)', borderRadius: 16, padding: 48, textAlign: 'center' }}>
            <ShieldCheck style={{ width: 36, height: 36, color: '#4A4868', margin: '0 auto 12px' }} />
            <p style={{ color: '#5A5A78', fontSize: 13 }}>Sin datos de auditoría RAG aún.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShieldCheck style={{ width: 18, height: 18, color: '#8B5CF6' }} />
              <h2 style={{ fontSize: 15, fontWeight: 800, color: '#E8E7F5', margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>RAG Audit Dashboard</h2>
              <span style={{ fontSize: 11, background: 'rgba(139,92,246,0.10)', color: '#A78BFA', padding: '2px 9px', borderRadius: 100, fontFamily: 'monospace' }}>
                run: {summary.run_id.slice(0, 8)}…
              </span>
              <span style={{ fontSize: 11, color: '#5A5A78' }}>{new Date(summary.started_at).toLocaleString('es-CL')}</span>
            </div>

            {/* KPI Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              {[
                { label: 'Precision score', value: `${precisionPct}%`, color: kpiColor(precisionPct) },
                { label: 'Keyword hit rate', value: `${hitRate}%`, color: '#0EB5C6' },
                { label: 'Avg latency', value: `${Math.round(summary.avg_latency_ms)}ms`, color: '#8B5CF6' },
                { label: 'Errores', value: String(summary.errors), color: summary.errors === 0 ? '#34D399' : '#F87171' },
              ].map(kpi => (
                <div key={kpi.label} style={{ background: '#0E0E1A', border: '1px solid rgba(108,60,225,0.12)', borderRadius: 14, padding: 16 }}>
                  <p style={{ fontSize: 11, color: '#5A5A78', margin: '0 0 5px' }}>{kpi.label}</p>
                  <p style={{ fontSize: 28, fontWeight: 900, color: kpi.color, margin: 0, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.5px' }}>{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Audit log table */}
            <div style={{ background: '#0E0E1A', border: '1px solid rgba(108,60,225,0.12)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(108,60,225,0.08)' }}>
                <p style={{ fontSize: 12.5, fontWeight: 600, color: '#7674A0', margin: 0 }}>Detalle de queries ({auditLogs.length})</p>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(108,60,225,0.08)' }}>
                      {['Estado', 'Categoría', 'Query', 'Precision', 'Latencia', 'Chunks'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#6A6888', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map(l => (
                      <tr key={l.id} style={{ borderBottom: '1px solid rgba(108,60,225,0.05)' }}>
                        <td style={{ padding: '9px 16px' }}>{l.error ? '❌' : l.precision_score >= 0.6 ? '✅' : '⚠️'}</td>
                        <td style={{ padding: '9px 16px', color: '#A78BFA', fontWeight: 600, textTransform: 'capitalize' }}>{l.category}</td>
                        <td style={{ padding: '9px 16px', color: '#D4D2F0', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.query}>{l.query}</td>
                        <td style={{ padding: '9px 16px', fontFamily: 'monospace', fontWeight: 700, color: l.precision_score >= 0.8 ? '#34D399' : l.precision_score >= 0.5 ? '#F59E0B' : '#F87171' }}>
                          {(l.precision_score * 100).toFixed(0)}%
                        </td>
                        <td style={{ padding: '9px 16px', fontFamily: 'monospace', color: '#6A6888' }}>{Math.round(l.latency_ms)}ms</td>
                        <td style={{ padding: '9px 16px', fontFamily: 'monospace', color: '#6A6888' }}>{l.chunks_retrieved}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      )}

      {view === 'system' && <AuditLog />}
    </div>
  );
}
