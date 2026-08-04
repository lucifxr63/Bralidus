import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { BASE } from '@/data/api-docs';
import type { ApiKey, ApiUsageLog, AuditSummary, AuditLogEntry, ServiceInfo, WebhookSub, PortalStats } from '@/types/portal';

/**
 * Debe coincidir con TIER_CREDIT_LIMITS de `api-v1/middleware/ratelimit.ts`.
 * Está duplicado acá porque el gateway no expone el tope salvo dentro de los
 * headers de una respuesta concreta. Si allá cambian los números y acá no, el
 * portal miente sobre cuánto le queda al usuario.
 */
const TOPES_POR_TIER: Record<string, number> = {
  anon: 150,
  free: 500,
  basic: 1000,
  pro: 15000,
  premium: 100000,
  admin: 1000000,
  enterprise: 5000000,
};

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
  const [tier, setTier] = useState<string>('free');

  useEffect(() => {
    fetchData();
    fetchServices();
    fetchWebhooks();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [keysRes, logsRes, perfilRes] = await Promise.all([
      supabase.from('api_keys').select('*').eq('profile_id', user.id).order('created_at', { ascending: false }),
      // `credits_used` es la columna nueva y la que importa: es la unidad del
      // tope mensual. Antes sólo se traía `tokens_used`, que es telemetría, y
      // el portal la mostraba como si fueran créditos.
      supabase
        .from('api_usage_logs')
        .select('id, endpoint, requests_count, credits_used, tokens_used, api_key_id, created_at')
        .order('created_at', { ascending: true }),
      supabase.from('profiles').select('tier').eq('id', user.id).maybeSingle(),
    ]);
    if (keysRes.data) setKeys(keysRes.data as ApiKey[]);
    if (logsRes.data) setLogs(logsRes.data as ApiUsageLog[]);
    setTier((perfilRes.data?.tier as string) ?? 'free');

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
      const res = await fetch(`${BASE}/health/services`, {
        headers: { 'Authorization': `Bearer ${token}` },
      }).catch(() => null);
      if (!res || !res.ok) return;
      const data = await res.json() as { services?: ServiceInfo[]; checked_at?: string };
      setServices(data.services ?? []);
      setServicesCheckedAt(data.checked_at ?? null);
    } catch { /* Edge Function not available */ }
    finally { setServicesLoading(false); }
  };

  const fetchWebhooks = async () => {
    setWebhooksLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      // Sin sesión no se pide: el gateway exige credencial desde el
      // 2026-08-04. El fallback anterior mandaba la anon key o el literal
      // 'demo_public_key', que ahora responden 401 — y como el catch de abajo
      // se traga todo, la pestaña quedaba vacía sin decir por qué.
      if (!session?.access_token) return;
      const res = await fetch(`${BASE}/webhooks`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      }).catch(() => null);
      if (!res || !res.ok) return;
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

    // El backend aplica la cuota por MES CALENDARIO (ratelimit.ts arranca en
    // date_trunc del mes), así que el portal tiene que recortar igual: sumar
    // todo el histórico mostraba un consumo que no corresponde a ningún tope.
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const creditsThisMonth = logs
      .filter(l => new Date(l.created_at) >= inicioMes)
      .reduce((s, l) => s + (l.credits_used ?? 1), 0);

    return {
      totalReqs,
      creditsThisMonth,
      creditLimit: TOPES_POR_TIER[tier] ?? TOPES_POR_TIER.free,
      tier,
      totalTokens,
      todayReqs,
      activeKeys,
    };
  }, [logs, keys, tier]);

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
