import RadarForense from '@/components/RadarForense';
import Trazabilidad from '@/components/Trazabilidad';

export function ForensicTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: '#0E0E1A', border: '1px solid rgba(108,60,225,0.12)', borderRadius: 16, padding: 20 }}>
        <RadarForense />
      </div>
      <div style={{ background: '#0E0E1A', border: '1px solid rgba(108,60,225,0.12)', borderRadius: 16, padding: 20 }}>
        <Trazabilidad />
      </div>
    </div>
  );
}
