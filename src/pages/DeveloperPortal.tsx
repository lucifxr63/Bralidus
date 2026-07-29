import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

// Layout
import { PortalLayout } from '@/layouts/PortalLayout';

// Data
import { usePortalData } from '@/hooks/usePortalData';

// Feature Tabs
// Tabs retirados (29-jul-2026) por no tener dato real detrás:
//   fase2      — simulador puro, sin fetch: percentiles y benchmarks hardcodeados
//   fase3      — la "IA predictiva" eran tres if sobre el monto, con spinner
//                artificial encima para aparentar latencia de inferencia
//   macro      — indicadores inventados atribuidos al Banco Central y al INE
//   evidences  — "evidencias" hardcodeadas, con un IPC que además contradecía
//                al de los otros dos mocks
// Sus componentes siguen en src/features/ por si se reconstruyen con datos
// reales, pero ya no se montan ni aparecen en la navegación.
import { OverviewTab }   from '@/features/overview/OverviewTab';
import { CostsTab }      from '@/features/costs/CostsTab';
import { QuotasTab }     from '@/features/quotas/QuotasTab';
import { ForensicTab }   from '@/features/intelligence/ForensicTab';
import { GraphTab }      from '@/features/intelligence/GraphTab';
import { PlaygroundTab } from '@/features/playground/PlaygroundTab';
import { AuditTab }      from '@/features/audit/AuditTab';
import { ApiKeysTab }    from '@/features/apikeys/ApiKeysTab';
import { ServicesTab }   from '@/features/services/ServicesTab';
import { DocsTab }       from '@/features/docs/DocsTab';
import { BcnTab } from '@/features/bcn/BcnTab';
import { ProfileTab } from '@/features/profile/ProfileTab';

import type { Tab } from '@/types/portal';

export function DeveloperPortal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as Tab) || 'overview';
  const setActiveTab = (tab: Tab) => setSearchParams({ tab });

  const [showModal, setShowModal] = useState(false);

  const {
    keys, setKeys, logs, auditSummaries, auditLogs,
    loading, services, servicesLoading, servicesCheckedAt,
    webhooks, setWebhooks, webhooksLoading, fetchServices, stats,
  } = usePortalData();

  return (
    <PortalLayout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onNewKey={() => { setActiveTab('apikeys'); setShowModal(true); }}
    >
      {activeTab === 'overview' && (
        <OverviewTab
          stats={stats}
          loading={loading}
          logs={logs}
          onNewKey={() => { setActiveTab('apikeys'); setShowModal(true); }}
          onNavigate={(tab) => setActiveTab(tab as Tab)}
        />
      )}

      {activeTab === 'bcn' && (
        <BcnTab />
      )}

      {activeTab === 'costs' && (
        <CostsTab totalTokens={stats.totalTokens} />
      )}

      {activeTab === 'quotas' && (
        <QuotasTab usageCount={stats.totalReqs} />
      )}

      {activeTab === 'forensic' && (
        <ForensicTab />
      )}

      {activeTab === 'graph' && (
        <GraphTab />
      )}

      {activeTab === 'playground' && (
        <PlaygroundTab onViewDocs={() => setActiveTab('docs')} />
      )}

      {activeTab === 'audit' && (
        <AuditTab auditSummaries={auditSummaries} auditLogs={auditLogs} />
      )}

      {activeTab === 'apikeys' && (
        <ApiKeysTab
          keys={keys}
          setKeys={setKeys}
          logs={logs}
          loading={loading}
          webhooks={webhooks}
          setWebhooks={setWebhooks}
          webhooksLoading={webhooksLoading}
          showModal={showModal}
          setShowModal={setShowModal}
        />
      )}

      {activeTab === 'services' && (
        <ServicesTab
          services={services}
          servicesLoading={servicesLoading}
          servicesCheckedAt={servicesCheckedAt}
          onRefresh={fetchServices}
        />
      )}

      {activeTab === 'docs' && (
        <DocsTab onPlayground={() => setActiveTab('playground')} />
      )}

      {activeTab === 'profile' && (
        <ProfileTab />
      )}
    </PortalLayout>
  );
}
