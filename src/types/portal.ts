// ─── Animus Developer Portal — Shared Types ─────────────────────────────

// 'evidences', 'macro', 'fase2' y 'fase3' se retiraron el 29-jul-2026: no
// tenían dato real detrás (ver nota en pages/DeveloperPortal.tsx).
export type Tab =
  | 'overview'
  | 'costs'
  | 'quotas'
  | 'forensic'
  | 'graph'
  | 'playground'
  | 'audit'
  | 'apikeys'
  | 'services'
  | 'bcn'
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
  /**
   * Créditos cobrados. ES LA UNIDAD DE LA CUOTA: el tope del tier se compara
   * contra la suma de esta columna, y es el número que el gateway anuncia en
   * `X-RateLimit-Request-Cost`.
   */
  credits_used: number;
  /**
   * Telemetría del costo real (tokens LLM u operaciones). NO es la unidad de
   * cobro. El portal las mostraba mezcladas: sumaba `tokens_used` y lo
   * etiquetaba como créditos, así que /data/macro aparecía costando 30 cuando
   * se cobra 1.
   */
  tokens_used: number;
  /** null cuando el consumo vino de una sesión del portal y no de una API key. */
  api_key_id: string | null;
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
  /** Créditos del mes EN CURSO: es contra esto que se aplica la cuota. */
  creditsThisMonth: number;
  /** Tope mensual del tier del usuario. */
  creditLimit: number;
  tier: string;
  totalTokens: number;
  todayReqs: number;
  activeKeys: number;
}
