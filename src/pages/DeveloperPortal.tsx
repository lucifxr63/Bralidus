import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

// Layout
import { PortalLayout } from '@/layouts/PortalLayout';

// Data
import { usePortalData } from '@/hooks/usePortalData';

// Feature Tabs
import { OverviewTab }   from '@/features/overview/OverviewTab';
import { CostsTab }      from '@/features/costs/CostsTab';
import { EvidencesTab }  from '@/features/evidences/EvidencesTab';
import { QuotasTab }     from '@/features/quotas/QuotasTab';
import { MacroTab }      from '@/features/intelligence/MacroTab';
import { ForensicTab }   from '@/features/intelligence/ForensicTab';
import { GraphTab }      from '@/features/intelligence/GraphTab';
import { PlaygroundTab } from '@/features/playground/PlaygroundTab';
import { AuditTab }      from '@/features/audit/AuditTab';
import { ApiKeysTab }    from '@/features/apikeys/ApiKeysTab';
import { ServicesTab }   from '@/features/services/ServicesTab';
import { DocsTab }       from '@/features/docs/DocsTab';
import { Fase2CommercialTab } from '@/features/fase2/Fase2CommercialTab';
import { Fase3PredictiveTab } from '@/features/fase3/Fase3PredictiveTab';
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

      {activeTab === 'fase2' && (
        <Fase2CommercialTab />
      )}

      {activeTab === 'fase3' && (
        <Fase3PredictiveTab />
      )}

      {activeTab === 'costs' && (
        <CostsTab totalTokens={stats.totalTokens} />
      )}

      {activeTab === 'evidences' && (
        <EvidencesTab />
      )}

      {activeTab === 'quotas' && (
        <QuotasTab usageCount={stats.totalReqs} />
      )}

      {activeTab === 'macro' && (
        <MacroTab />
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
