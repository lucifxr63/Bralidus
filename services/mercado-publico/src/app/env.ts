import { z } from 'zod';
import dotenv from 'dotenv';

/**
 * Env del servicio de ingesta de Mercado Público (mp-sync).
 *
 * Recorte del `env.ts` de Licitus (PYMENGINE/backend): aquí solo viven las
 * variables que necesita la INGESTA. Todo lo del producto de Licitus (auth,
 * LLM, matching, notificaciones, billing, Supabase REST) queda fuera a
 * propósito — este servicio no sirve producto, solo extrae y escribe.
 *
 * Diferencia clave vs. Licitus: **dos** conexiones de base de datos
 * (dual-write, ver plan):
 *  - `LICITUS_DATABASE_URL`  → proyecto szzibobuwgcopewmnkkl (opportunities,
 *    purchase_orders, sync_logs) — el destino histórico, sin cambios de schema.
 *  - `BRALIDUS_DATABASE_URL` → proyecto fcdhcntyvsydnvjwopfe
 *    (licitaciones_mercado_publico) — la tabla canónica de Bralidus/Animus.
 * Ambas apuntan al POOLER de Supabase, nunca a la conexión directa
 * `db.<project>.supabase.co` (sin IPv4 garantizada y con límites de conexión
 * mucho más bajos). Licitus usa hoy el pooler en modo TRANSACTION (puerto
 * 6543); ese modo no soporta prepared statements con nombre ni estado de
 * sesión — `pg` funciona igual porque las queries de este servicio son
 * simples, pero conviene tenerlo presente antes de agregar features que
 * dependan de estado de sesión (LISTEN/NOTIFY, temp tables, SET).
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  APP_NAME: z.string().default('mp-sync'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // ── Bases de datos (dual-write) ──────────────────────────────
  // Opcionales en el schema para que el build/typecheck y el /health no exijan
  // credenciales; el pool lanza un error claro al primer uso si falta.
  LICITUS_DATABASE_URL: z.string().min(1).optional(),
  BRALIDUS_DATABASE_URL: z.string().min(1).optional(),
  // Interruptor del segundo destino: permite correr solo contra Licitus
  // (paridad exacta con el pipeline viejo) mientras se valida el dual-write.
  DUAL_WRITE_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),

  // ── Auth del control plane (/jobs/run/*) ─────────────────────
  // Mismo contrato que usa BralidusPY: Bearer <CRON_SECRET>. Es lo que invoca
  // el tab "Orquestador & Workers" del panel /admin y el cron de GitHub Actions.
  CRON_SECRET: z.string().min(16).optional(),

  // ── Mercado Público (API v1) ─────────────────────────────────
  // El default DEBE incluir el prefijo /servicios/v1 y ser https.
  //
  // Antes era 'http://api.mercadopublico.cl': sin TLS y sin el prefijo de ruta.
  // Como la variable no estaba seteada en Vercel, el servicio caía a ese default
  // y TODA llamada a publico/licitaciones.json fallaba en red (sin status HTTP),
  // agotaba los 3 reintentos del workflow durable y moría con FatalError — sin
  // llegar nunca a finish(), así que `job_progress.is_running` quedaba en true
  // y el guard de concurrencia bloqueaba las corridas siguientes. Resultado:
  // ingesta detenida desde el 2026-07-26 sin que ninguna alerta lo dijera.
  //
  // Verificado el 2026-07-29: https + /servicios/v1 responde 200; ambas
  // variantes sin uno u otro no responden.
  MERCADO_PUBLICO_BASE_URL: z.string().url().default('https://api.mercadopublico.cl/servicios/v1'),
  MERCADO_PUBLICO_TICKET: z.string().min(1),
  // Circuit breaker: fallas seguidas para abrir y cooldown antes de reintentar.
  // Evita quemar una corrida entera cuando MP está caído.
  MP_CIRCUIT_FAILURE_THRESHOLD: z.coerce.number().int().min(1).default(5),
  MP_CIRCUIT_COOLDOWN_MS: z.coerce.number().int().min(1000).default(60000),

  // ── Compra Ágil (API v2) ─────────────────────────────────────
  // Servicio SEPARADO de la v1: otro host, auth por header, envelope propio.
  // Los COT no existen en publico/licitaciones.json. Usa el MISMO ticket.
  COMPRA_AGIL_BASE_URL: z.string().url().default('https://api2.mercadopublico.cl'),
  COMPRA_AGIL_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  COMPRA_AGIL_LOOKBACK_DAYS: z.coerce.number().int().min(0).max(30).default(2),
  COMPRA_AGIL_INCREMENTAL_HOURS: z.coerce.number().int().min(1).max(168).default(26),
  // = tamano_pagina de la API v2, que solo admite 10..50.
  COMPRA_AGIL_CHUNK_SIZE: z.coerce.number().int().min(10).max(50).default(50),
  COMPRA_AGIL_CONCURRENCY: z.coerce.number().int().min(1).max(12).default(6),

  // ── Tuning del sync ──────────────────────────────────────────
  SYNC_LOOKBACK_DAYS: z.coerce.number().int().min(0).max(30).default(1),
  SYNC_BATCH_SIZE: z.coerce.number().int().positive().default(20),
  // Chunking por slices: heredado del límite de CPU de Cloudflare Workers.
  // En Vercel/Nitro el techo es otro, pero se conserva el chunking porque es
  // lo que mantiene cada step barato y reintentable de forma independiente.
  // Tamaño de slice = cuánto procesa UN step del workflow durable, y por lo
  // tanto lo que debe caber en el techo de duración de una función (300 s por
  // defecto en Vercel).
  //
  // Los defaults viejos (500 OCs / 300 licitaciones) venían de Cloudflare
  // Workers, donde el techo era otro. En Vercel no caben: medido el 2026-07-29,
  // un batch de 20 licitaciones con SYNC_CONCURRENCY=1 tarda ~78 s, así que un
  // slice de 300 pedía ~21 min contra un límite de 5. El step moría a los ~4
  // batches, el workflow lo reintentaba DESDE EL PRINCIPIO, y a los 3 intentos
  // abortaba — re-pidiendo cada vez los mismos registros a Mercado Público y
  // quemando cuota del ticket sin cerrar nunca la corrida.
  //
  // 60 licitaciones = 3 batches ≈ 234 s, con margen bajo los 300 s. Subir esto
  // exige subir también `maxDuration` en vercel.json, y verificar que el
  // producto (batches × duración de batch) siga entrando en el techo.
  SYNC_OC_CHUNK_SIZE: z.coerce.number().int().positive().default(150),
  SYNC_LIC_CHUNK_SIZE: z.coerce.number().int().positive().default(60),
  SYNC_REQUEST_DELAY_MS: z.coerce.number().int().min(0).default(200),
  SYNC_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(1),
  SYNC_ITEM_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),
  SYNC_ABORT_ERROR_RATE: z.coerce.number().min(0).max(1).default(0.8),
  // Pre-filtro del listado: CodigoEstado permitidos (coma) o 'all'. 5 = Publicada.
  SYNC_STATUS_CODES: z.string().default('5'),
  // Pre-score: omite el fetch de detalle de licitaciones sin ningún hit de
  // keyword en el título. Opt-in: reduce datos disponibles para navegación.
  SYNC_PRESCORE_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),

  // ── Refresh / enriquecimiento ────────────────────────────────
  REFRESH_MAX_ITEMS: z.coerce.number().int().min(1).max(1000).default(150),
  REFRESH_CLOSING_SOON_HOURS: z.coerce.number().int().min(1).max(168).default(48),
  ENRICH_OC_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  ENRICH_OC_MAX_ITEMS: z.coerce.number().int().min(1).max(1000).default(150),

  // ── Callback a Licitus (post-proceso de producto) ────────────
  // La ingesta NO corre análisis LLM, matching ni notificaciones: eso vive en
  // el producto de Licitus. Al terminar, este servicio le avisa qué cambió y
  // Licitus decide a quién notificar y qué analizar. Sin URL configurada el
  // callback es no-op (la ingesta sigue funcionando, solo no avisa).
  LICITUS_CALLBACK_URL: z.string().url().optional(),
  LICITUS_CALLBACK_KEY: z.string().min(16).optional(),

  // ── Alerting de ops ──────────────────────────────────────────
  // Sin URL las alertas solo se loguean (mismo gating que en Licitus).
  OPS_WEBHOOK_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/**
 * Validación LAZY (se conserva del original): ningún módulo debe leer `env.X`
 * en scope de módulo. El primer acceso real dentro de un handler dispara la
 * validación — así el bundle se construye sin exigir secretos.
 */
function loadEnv(): Env {
  if (cached) return cached;

  try {
    dotenv.config();
  } catch {
    /* runtime sin filesystem */
  }

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    // console: el logger depende de env — no se puede usar aquí
    console.error('❌ Invalid environment variables:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    throw new Error('Invalid environment variables');
  }

  cached = result.data;
  return cached;
}

export const env: Env = new Proxy({} as Env, {
  get: (_target, prop) => loadEnv()[prop as keyof Env],
  has: (_target, prop) => prop in loadEnv(),
  ownKeys: () => Reflect.ownKeys(loadEnv()),
  getOwnPropertyDescriptor: (_target, prop) => Object.getOwnPropertyDescriptor(loadEnv(), prop),
});
