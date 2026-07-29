import { useState } from 'react';
import { useVersionCheck } from '@/hooks/useVersionCheck';
import { RefreshCw, Sparkles, X } from 'lucide-react';

export function VersionUpdateAlert() {
  const { hasUpdate, hardRefresh } = useVersionCheck(30);
  const [dismissed, setDismissed] = useState(false);

  if (!hasUpdate || dismissed) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        background: 'linear-gradient(135deg, rgba(14, 14, 26, 0.96), rgba(108, 60, 225, 0.90))',
        border: '1px solid rgba(14, 181, 198, 0.45)',
        borderRadius: 16,
        padding: '16px 20px',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.65), 0 0 25px rgba(14, 181, 198, 0.25)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        maxWidth: 420,
        backdropFilter: 'blur(16px)',
        animation: 'slideUpFade 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: 'rgba(14, 181, 198, 0.15)',
          border: '1px solid rgba(14, 181, 198, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Sparkles style={{ width: 22, height: 22, color: '#0EB5C6' }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.3px' }}>
            Tenemos cambios en el portal
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              background: '#10B981',
              color: '#000',
              padding: '1px 6px',
              borderRadius: 6,
              textTransform: 'uppercase',
            }}
          >
            Nueva versión
          </span>
        </div>
        <p style={{ fontSize: 12, color: '#CBD5E1', margin: 0, lineHeight: '1.4' }}>
          Se ha publicado una actualización de producción. Presiona actualizar para ver los cambios.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button
          onClick={hardRefresh}
          style={{
            background: 'linear-gradient(135deg, #0EB5C6, #6C3CE1)',
            border: 'none',
            borderRadius: 10,
            padding: '9px 15px',
            color: '#FFFFFF',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 4px 15px rgba(14, 181, 198, 0.4)',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.04)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
          }}
        >
          <RefreshCw style={{ width: 14, height: 14 }} />
          Actualizar
        </button>

        <button
          onClick={() => setDismissed(true)}
          title="Ocultar temporalmente"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94A3B8',
            cursor: 'pointer',
            padding: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
          }}
        >
          <X style={{ width: 16, height: 16 }} />
        </button>
      </div>

      <style>{`
        @keyframes slideUpFade {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
