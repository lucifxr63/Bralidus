import { BralidusCostsPanel } from '@/components/BralidusCostsPanel';

interface CostsTabProps { totalTokens: number; }

export function CostsTab({ totalTokens }: CostsTabProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <BralidusCostsPanel totalTokens={totalTokens || 1250000} />
    </div>
  );
}
