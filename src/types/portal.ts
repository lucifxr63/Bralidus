// ─── Animus Developer Portal — Shared Types ─────────────────────────────

export type Tab =
  | 'overview'
  | 'costs'
  | 'evidences'
  | 'quotas'
  | 'macro'
  | 'forensic'
  | 'graph'
  | 'playground'
  | 'audit'
  | 'apikeys'
  | 'services'
  | 'fase2'
  | 'fase3'
  | 'docs'
  | 'profile';

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  is_active: boolean;
}

export interface AuditLogEntry {
  id: string;
  run_id: string;
  query: string;
  category: string;
  expected_keyword: string | null;
  has_sources: boolean;
  keyword_found: boolean;
  precision_score: number;
  latency_ms: number;
  chunks_retrieved: number;
  error: string | null;
  created_at: string;
}

export interface AuditSummary {
  run_id: string;
  started_at: string;
  total_queries: number;
  avg_precision: number;
  avg_latency_ms: number;
  keyword_hits: number;
  queries_with_sources: number;
  errors: number;
  hit_rate_pct: number;
}

export interface ApiUsageLog {
  id: string;
  endpoint: string;
  requests_count: number;
  tokens_used: number;
  created_at: string;
}

export type ServiceStatus = 'ok' | 'degraded' | 'error' | 'unused';

export interface ServiceInfo {
  id: string;
  name: string;
  category: string;
  status: ServiceStatus;
  latency_ms?: number;
  message: string;
}

export interface WebhookSub {
  id: string;
  endpoint_url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
  secret?: string;
}

export interface PortalStats {
  totalReqs: number;
  totalTokens: number;
  todayReqs: number;
  activeKeys: number;
}
