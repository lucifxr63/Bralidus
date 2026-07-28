import { AnimusCostsPanel } from '@/components/AnimusCostsPanel';

export interface CostsTabProps {
  totalTokens?: number;
}

export function CostsTab({ totalTokens }: CostsTabProps) {
  return (
    <div>
      <AnimusCostsPanel totalTokens={totalTokens || 1250000} />
    </div>
  );
}
