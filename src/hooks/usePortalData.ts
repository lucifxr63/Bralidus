import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { BASE } from '@/data/api-docs';
import type { ApiKey, ApiUsageLog, AuditSummary, AuditLogEntry, ServiceInfo, WebhookSub, PortalStats } from '@/types/portal';

export function usePortalData() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [logs, setLogs] = useState<ApiUsageLog[]>([]);
  const [auditSummaries, setAuditSummaries] = useState<AuditSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesCheckedAt, setServicesCheckedAt] = useState<string | null>(null);

  const [webhooks, setWebhooks] = useState<WebhookSub[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(false);

  useEffect(() => {
    fetchData();
    fetchServices();
    fetchWebhooks();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [keysRes, logsRes] = await Promise.all([
      supabase.from('api_keys').select('*').eq('profile_id', user.id).order('created_at', { ascending: false }),
      supabase.from('api_usage_logs').select('id, endpoint, requests_count, tokens_used, created_at').order('created_at', { ascending: true }),
    ]);
    if (keysRes.data) setKeys(keysRes.data as ApiKey[]);
    if (logsRes.data) setLogs(logsRes.data as ApiUsageLog[]);

    const auditSummaryRes = await supabase.from('rag_audit_summary').select('*').order('started_at', { ascending: false }).limit(10);
    if (auditSummaryRes.data && auditSummaryRes.data.length > 0) {
      setAuditSummaries(auditSummaryRes.data as AuditSummary[]);
      const latestRunId = auditSummaryRes.data[0].run_id as string;
      const logsRes2 = await supabase
        .from('rag_audit_logs')
        .select('id, run_id, query, category, expected_keyword, has_sources, keyword_found, precision_score, latency_ms, chunks_retrieved, error, created_at')
        .eq('run_id', latestRunId)
        .order('created_at', { ascending: true });
      if (logsRes2.data) setAuditLogs(logsRes2.data as AuditLogEntry[]);
    }
    setLoading(false);
  };

  const fetchServices = async () => {
    setServicesLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://fcdhcntyvsydnvjwopfe.supabase.co';
      const res = await fetch(`${SUPABASE_URL}/functions/v1/api-v1/health/services`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json() as { services?: ServiceInfo[]; checked_at?: string };
      setServices(data.services ?? []);
      setServicesCheckedAt(data.checked_at ?? null);
    } catch { /* Edge Function not available */ }
    finally { setServicesLoading(false); }
  };

  const fetchWebhooks = async () => {
    setWebhooksLoading(true);
    try {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? anonKey;
      if (!token) { setWebhooksLoading(false); return; }
      const res = await fetch(`${BASE}/webhooks`, {
        headers: { 'Authorization': `Bearer ${token}`, 'apikey': anonKey || '' },
      });
      if (!res.ok) return;
      const data = await res.json() as { webhooks?: WebhookSub[] };
      setWebhooks(data.webhooks ?? []);
    } catch { /* not available */ }
    finally { setWebhooksLoading(false); }
  };

  const stats: PortalStats = useMemo(() => {
    const totalReqs = logs.reduce((s, l) => s + (l.requests_count || 1), 0);
    const totalTokens = logs.reduce((s, l) => s + (l.tokens_used || 0), 0);
    const today = new Date().toISOString().split('T')[0];
    const todayReqs = logs.filter(l => l.created_at.startsWith(today)).reduce((s, l) => s + (l.requests_count || 1), 0);
    const activeKeys = keys.filter(k => k.is_active).length;
    return { totalReqs, totalTokens, todayReqs, activeKeys };
  }, [logs, keys]);

  return {
    keys, setKeys,
    logs,
    auditSummaries,
    auditLogs,
    loading,
    services,
    servicesLoading,
    servicesCheckedAt,
    webhooks, setWebhooks,
    webhooksLoading,
    fetchServices,
    stats,
  };
}
