import { useState } from 'react';
import { Radio, Send, CheckCircle2, Activity } from 'lucide-react';

export function WebhooksLiveExplorer() {
  const [selectedEvent, setSelectedEvent] = useState<'radar.signal' | 'tender.published' | 'po.created'>('tender.published');
  const [targetUrl] = useState('https://mi-empresa.cl/api/webhooks/bralidus');
  const [dispatched, setDispatched] = useState(false);

  const getPayload = () => {
    switch (selectedEvent) {
      case 'tender.published':
        return {
          event: 'tender.published',
          timestamp: new Date().toISOString(),
          data: {
            external_code: '6921-12-LR26',
            title: 'Plataforma de IA Hospitalaria',
            buyer_name: 'Subsecretaría de Redes Asistenciales - MINSAL',
            amount_estimated: 125000000,
            closing_at: '2026-08-15T15:00:00Z'
          }
        };
      case 'radar.signal':
        return {
          event: 'radar.signal',
          timestamp: new Date().toISOString(),
          data: {
            signal_type: 'financial_insolvency_warning',
            headline: 'Procedimiento de Reorganización Judicial Registrado',
            risk_level: 'high',
            company_rut: '76999888-K'
          }
        };
      case 'po.created':
        return {
          event: 'po.created',
          timestamp: new Date().toISOString(),
          data: {
            external_code: '1234-56-SE26',
            supplier_rut: '76086428-5',
            total_clp: 45000000,
            buyer_org: 'Ministerio de Educación'
          }
        };
    }
  };

  const handleSimulate = () => {
    setDispatched(true);
    setTimeout(() => setDispatched(false), 3000);
  };

  return (
    <div style={{ background: '#0B0B16', border: '1px solid rgba(16,185,129,0.22)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 12px 36px rgba(0,0,0,0.4)' }}>
      {/* Banner */}
      <div style={{ padding: '24px 28px', background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(139,92,246,0.04) 100%)', borderBottom: '1px solid rgba(16,185,129,0.14)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 10, background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>
            <Radio style={{ width: 18, height: 18 }} />
          </span>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: '#E8E7F5', margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
            Explorador en Vivo — Webhooks & Eventos Asíncronos
          </h3>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#34D399' }}>
            <Activity style={{ width: 12, height: 12 }} /> Push Notifications HTTP
          </span>
        </div>
        <p style={{ fontSize: 13.5, color: '#9896B8', maxWidth: 720, margin: 0, lineHeight: 1.6 }}>
          Simula y prueba la recepción de eventos asíncronos en tiempo real enviados por Bralidus (alertas de Radar, nuevas licitaciones públicas y órdenes de compra adjudicadas).
        </p>

        {/* Controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 18, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4, background: '#05050C', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 11, padding: 3 }}>
            {[
              { id: 'tender.published', label: 'Nueva Licitación' },
              { id: 'po.created', label: 'Nueva Orden de Compra' },
              { id: 'radar.signal', label: 'Señal Radar Forense' }
            ].map(e => (
              <button
                key={e.id}
                onClick={() => setSelectedEvent(e.id as any)}
                style={{
                  padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  background: selectedEvent === e.id ? '#10B981' : 'none',
                  color: selectedEvent === e.id ? '#000' : '#8B89B0'
                }}
              >
                {e.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleSimulate}
            style={{ background: '#10B981', border: 'none', color: '#000', padding: '10px 20px', borderRadius: 11, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Send style={{ width: 14, height: 14 }} /> Simular Envío de Webhook
          </button>
        </div>
      </div>

      {/* Payload Display */}
      <div style={{ padding: 24 }}>
        {dispatched && (
          <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid #10B981', color: '#34D399', padding: '12px 16px', borderRadius: 12, marginBottom: 16, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 style={{ width: 16, height: 16 }} /> Webhook `{selectedEvent}` disparado exitosamente con firma HMAC `x-validus-signature` a `{targetUrl}`.
          </div>
        )}

        <div style={{ fontSize: 12, fontWeight: 700, color: '#10B981', marginBottom: 8 }}>Estructura de Payload HTTP POST:</div>
        <pre style={{ background: '#030309', border: '1px solid rgba(16,185,129,0.15)', color: '#34D399', fontSize: 12, borderRadius: 12, padding: 16, overflowX: 'auto', fontFamily: 'monospace', lineHeight: 1.6, margin: 0 }}>
          {JSON.stringify(getPayload(), null, 2)}
        </pre>
      </div>
    </div>
  );
}
