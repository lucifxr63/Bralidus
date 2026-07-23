import { BralidusQuotaWidget } from '@/components/BralidusQuotaWidget';

interface QuotasTabProps { usageCount: number; }

export function QuotasTab({ usageCount }: QuotasTabProps) {
  return (
    <div style={{ maxWidth: 640 }}>
      <BralidusQuotaWidget tier="pro" usageCount={usageCount || 42} limitCount={1000} />
    </div>
  );
}
