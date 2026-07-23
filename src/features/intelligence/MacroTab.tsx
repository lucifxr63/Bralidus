import MacroIntelligence from '@/components/MacroIntelligence';
import BralidusPanel from '@/components/BralidusPanel';

export function MacroTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <MacroIntelligence />
      <div style={{ background: '#0E0E1A', border: '1px solid rgba(108,60,225,0.12)', borderRadius: 16, padding: 20 }}>
        <BralidusPanel />
      </div>
    </div>
  );
}
