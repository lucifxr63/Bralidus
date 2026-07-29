import { Server, RefreshCw } from 'lucide-react';
import type { ServiceInfo } from '@/types/portal';
import ServiceModal from '@/components/ServiceModal';
import { useState } from 'react';

interface ServicesTabProps {
  services: ServiceInfo[];
  servicesLoading: boolean;
  servicesCheckedAt: string | null;
  onRefresh: () => void;
}

// Aquí había un FALLBACK_SERVICES con seis servicios fijos, todos badgeados
// "OPERACIONAL" y con latencias inventadas (42ms, 12ms, 180ms…). Se renderizaba
// justo cuando el fetch de /health/services fallaba o volvía vacío — es decir,
// **una caída total del backend se veía toda verde**. Eliminado: si no hay
// datos de salud, se dice que no los hay.

export function ServicesTab({ services, servicesLoading, servicesCheckedAt, onRefresh }: ServicesTabProps) {
  const [selectedService, setSelectedService] = useState<ServiceInfo | null>(null);

  const cardStyle = { background: '#0E0E1A', border: '1px solid rgba(108,60,225,0.12)', borderRadius: 16, overflow: 'hidden' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={cardStyle}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(108,60,225,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Server style={{ width: 14, height: 14, color: '#6C3CE1' }} />
            <span style={{ fontSize: 13.5, fontWeight: 700, color: '#C4B5FD' }}>Estado de Microservicios Animus</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {servicesCheckedAt && (
              <span style={{ fontSize: 11, color: '#5A5A78', fontFamily: 'monospace' }}>
                {new Date(servicesCheckedAt).toLocaleTimeString('es-CL')}
              </span>
            )}
            <button
              onClick={onRefresh}
              style={{ padding: 7, background: 'rgba(108,60,225,0.08)', border: '1px solid rgba(108,60,225,0.18)', borderRadius: 8, cursor: 'pointer', color: '#8B5CF6' }}
              title="Actualizar"
            >
              <RefreshCw style={{ width: 13, height: 13, animation: servicesLoading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>

        <div style={{ padding: 16 }}>
          {servicesLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} style={{ height: 88, background: 'rgba(108,60,225,0.06)', borderRadius: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          ) : services.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              {services.map((svc, i) => (
                <button key={i} onClick={() => setSelectedService(svc)}
                  style={{
                    padding: 14, borderRadius: 12, background: 'rgba(108,60,225,0.04)', border: '1px solid rgba(108,60,225,0.10)',
                    textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(108,60,225,0.35)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(108,60,225,0.10)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: '#D4D2F0' }}>{svc.name}</span>
                    <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 100, border: `1px solid ${svc.status === 'ok' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`, background: svc.status === 'ok' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', color: svc.status === 'ok' ? '#34D399' : '#F87171' }}>
                      {svc.status === 'ok' ? 'OPERACIONAL' : 'DEGRADADO'}
                    </span>
                  </div>
                  <p style={{ fontSize: 11.5, color: '#5A5A78', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{svc.message}</p>
                  {svc.latency_ms != null && (
                    <p style={{ fontSize: 11, fontFamily: 'monospace', color: '#0EB5C6', margin: 0 }}>Latencia: {Math.round(svc.latency_ms)}ms</p>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ padding: '28px 20px', textAlign: 'center' }}>
              <Server style={{ width: 26, height: 26, color: '#4A4870', marginBottom: 10 }} />
              <p style={{ fontSize: 13, fontWeight: 600, color: '#9CA3AF', margin: '0 0 4px' }}>
                Sin datos de salud
              </p>
              <p style={{ fontSize: 11.5, color: '#5A5A78', margin: 0 }}>
                No se pudo consultar el estado de los microservicios. Esto puede
                significar que el gateway está caído — no que los servicios estén bien.
              </p>
            </div>
          )}
        </div>
      </div>

      {selectedService && <ServiceModal service={selectedService} onClose={() => setSelectedService(null)} />}
    </div>
  );
}
