import { AnimusCostsPanel } from '@/components/AnimusCostsPanel';

export interface CostsTabProps {
  totalTokens?: number;
}

export function CostsTab({ totalTokens }: CostsTabProps) {
  // Antes esto era `totalTokens || 1250000`: sin consumo real mostraba
  // 1,25 M de tokens inventados como si fueran del usuario. Cero es cero.
  return (
    <div>
      <AnimusCostsPanel totalTokens={totalTokens ?? 0} />
    </div>
  );
}
