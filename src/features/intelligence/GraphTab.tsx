import { KnowledgeGraph } from '@/components/KnowledgeGraph';

export function GraphTab() {
  return (
    <div style={{ background: '#0E0E1A', border: '1px solid rgba(108,60,225,0.12)', borderRadius: 16, overflow: 'hidden' }}>
      <KnowledgeGraph />
    </div>
  );
}
