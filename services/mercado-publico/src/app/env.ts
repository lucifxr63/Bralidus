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
  /**
   * Segundo ticket, opcional. Cada ticket tiene SU PROPIA cuota diaria y —esto
   * es lo que no era obvio— su propio límite de concurrencia.
   *
   * Medido el 2026-08-12 desde una sola IP, 60 consultas por condición
   * intercaladas en 12 bloques para promediar la carga de MP:
   *
   *   200 ms, un ticket        → 37/60 = 62 % de acierto
   *   200 ms, alternando A/B   → 53/60 = 88 %
   *
   * Si el límite fuera por IP, alternar no habría cambiado nada (z ≈ 3,4).
   * Como es por ticket, dos tickets dan el DOBLE de caudal a la misma tasa de
   * acierto: verificado a 1250 ms alternando —cada ticket recibe una consulta
   * cada 2500 ms, el ritmo ya validado— con 30/30 = 100 %.
   */
  MERCADO_PUBLICO_TICKET2: z.string().min(1).optional(),
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
  /**
   * Interruptor del modo incremental troceado.
   *
   * **Default `false` a propósito.** El modo incremental cambia lo que hace el
   * sync nocturno: en vez de re-barrer 3 fechas por publicación, parte la
   * ventana de cambios en tramos bajo el techo de 10.000 de la API. Es el
   * comportamiento correcto, pero al 2026-08-05 **no está verificado contra
   * Mercado Público** — la cuota diaria estaba agotada al probarlo, así que sólo
   * se validó contra distribuciones sintéticas (ver window-split.test.ts).
   *
   * El flag separa dos riesgos que si no viajan juntos en el mismo deploy:
   * arreglar cosas rotas, y cambiar cómo funciona la ingesta. Con `false` sale
   * todo lo primero sin tocar lo segundo.
   *
   * Para activarlo: poner `true` en el proyecto Vercel y mirar la corrida
   * siguiente en `mp_job_health_resumen` + el canal `degradacion`, que es donde
   * avisa si un tramo topa el techo o si la ventana no se pudo partir.
   */
  COMPRA_AGIL_INCREMENTAL_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
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
  /**
   * Cuántos días se sigue vigilando una licitación ya cerrada esperando su
   * adjudicación.
   *
   * Estaba fijo en 30 y eso dejaba fuera al 36 %: medido sobre 5.766
   * adjudicadas, el rezago entre cierre y adjudicación tiene mediana 22 días,
   * p80 48 y p90 68. La ventana cortaba justo por encima de la mediana, que es
   * el peor lugar posible.
   *
   * 75 cubre el p90 sin el salto de tamaño de los 90: el pool del bucket pasa
   * de 1.383 a 2.545 candidatos, mientras que a 90 días se dispara a 4.817.
   */
  REFRESH_AWARD_WINDOW_DAYS: z.coerce.number().int().min(1).max(180).default(75),
  ENRICH_OC_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  // Tope por pasada del enriquecimiento. Debe entrar en el techo de 300 s de
  // una función Vercel al ritmo que tolera el endpoint de detalle de MP
  // (2,5 s por consulta — ver ENRICH_DELAY_MS en enrich-ordenes.job.ts).
  //
  // El default original (150) daba 375 s y no cabía: la corrida se cortaba a
  // mitad de lote.
  //
  // Medido en prod el 2026-07-31 con 100: la pasada cerró en **281 s**, o sea
  // 19 s de margen sobre el techo (6 %). Entra, pero cualquier lentitud de MP
  // la pasa de largo — y una pasada que revienta corta la cadena entera del
  // workflow, no sólo su propio lote. Se baja a 90 (225 s de espera + ~27 s de
  // requests ≈ 252 s, ~16 % de margen).
  //
  // Cuesta 10 % de caudal por disparo, irrelevante al lado de encadenar 10
  // pasadas. Para volver a 100 o más hay que subir `maxDuration` en vercel.json
  // primero (Fluid admite más de 300 s según el plan), no bajar el ritmo: los
  // 2,5 s son lo que da 100 % de acierto.
  //
  // ── Recalibrado el 2026-08-05, sobre 492 corridas terminadas ──────────
  // La estimación de arriba era correcta (252 s previstos, p50 real 255 s). Lo
  // que no cubría es la VARIANZA: p90 = 400 s. O sea que 90 ítems entran en un
  // día normal y no entran en uno lento, y ahí el proceso muere sin llegar a
  // `complete()` — 5 huérfanas en 7 días. Cada una además corta la cadena de 10
  // pasadas del workflow, así que una pasada perdida arrastra hasta nueve más.
  //
  // Se baja a 80 (≈226 s al ritmo medido de 2,83 s/ítem) para que la pasada
  // NORMAL termine holgada por debajo de ENRICH_TIME_BUDGET_MS (250 s), y ese
  // presupuesto quede como red de seguridad que sólo actúa en los días lentos.
  //
  // Si el tope fuera a dispararse en todas las corridas, 'partial' pasaría a ser
  // lo normal y el estado dejaría de significar algo — ver run-status.ts.
  ENRICH_OC_MAX_ITEMS: z.coerce.number().int().min(1).max(1000).default(80),
  // Las pasadas encadenadas por disparo NO son configurables por entorno: viven
  // como constante en enrich-ordenes.workflow.ts (MAX_PASADAS). El cuerpo de un
  // `'use workflow'` tiene que ser determinista, y leer env ahí adentro hace
  // fallar el build del workflow — probado el 2026-07-31.

  // ── Callback a Licitus (post-proceso de producto) ────────────
  // La ingesta NO corre análisis LLM, matching ni notificaciones: eso vive en
  // el producto de Licitus. Al terminar, este servicio le avisa qué cambió y
  // Licitus decide a quién notificar y qué analizar. Sin URL configurada el
  // callback es no-op (la ingesta sigue funcionando, solo no avisa).
  LICITUS_CALLBACK_URL: z.string().url().optional(),
  LICITUS_CALLBACK_KEY: z.string().min(16).optional(),

  // ── Alerting de ops ──────────────────────────────────────────
  // Sin URL las alertas solo se loguean (mismo gating que en Licitus).
  // Canales de ops. Se separan por QUÉ HACER al ver el mensaje, no por servicio
  // (ver la cabecera de infrastructure/ops-alert/ops-alert.ts).
  // Si falta el de un tipo, ese aviso cae a OPS_WEBHOOK_URL: preferible un canal
  // mezclado a un aviso mudo.
  OPS_WEBHOOK_URL: z.string().url().optional(), // incidentes — sólo rojo
  OPS_WEBHOOK_LATIDO: z.string().url().optional(), // toda corrida programada
  OPS_WEBHOOK_FRESCURA: z.string().url().optional(), // digest de antigüedad del dato
  OPS_WEBHOOK_DEGRADACION: z.string().url().optional(), // lo que "funciona" mintiendo
  OPS_WEBHOOK_DEPLOYS: z.string().url().optional(), // deploys, versiones y runtime
  OPS_WEBHOOK_NEGOCIO: z.string().url().optional(), // KPIs comerciales y operativos
  // Canales POR FUENTE:
  OPS_WEBHOOK_PJUD: z.string().url().optional(), // Poder Judicial (PJUD)
  OPS_WEBHOOK_BCN: z.string().url().optional(), // Biblioteca del Congreso Nacional (BCN / Ley Chile)
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
