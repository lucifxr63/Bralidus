# Animus Engine / Bralidus Developer Portal — CLAUDE.md

## What is this project

Developer portal for **Animus Engine v2.0 / Bralidus RaaS**, the AI-powered Intelligence & Retrieval-as-a-Service (RaaS) engine powering B2G (Mercado Público ChileCompra) procurement opportunities, Licitus market benchmarks, macroeconomic series, and RAG knowledge graphs.

It is a standalone Vite React SPA that connects to the canonical Supabase Edge Function API (`api-v1`) hosted on project `fcdhcntyvsydnvjwopfe`.

**Production URL:** https://bralidus.vercel.app  
**Canonical Backend API Base URL:** https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/api-v1

## Stack

| Layer | Tech |
|---|---|
| Framework | React 19 + TypeScript 6 + Vite 8 |
| Routing | React Router 7 |
| Styling | Tailwind CSS 4 |
| UI primitives | Lucide React, Sonner (toasts), next-themes (dark mode) |
| Charts | Recharts 3 |
| Graph | @xyflow/react (ReactFlow) |
| Backend | Supabase (auth, DB, Edge Functions `api-v1`) |

## Dev commands

```bash
npm run dev       # Vite dev server → http://localhost:5173
npm run build     # tsc -b && vite build → ./dist
npm run preview   # serve ./dist locally
npm run lint      # eslint
```

## Environment variables

Required in `.env.local` (never commit):

```
VITE_SUPABASE_URL=https://fcdhcntyvsydnvjwopfe.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

## Core Architectural Features

### 1. Animus Engine v2.0 API Gateway & Fallback Layer
- The API gateway is hosted on Supabase Edge Functions (`api-v1` in project `fcdhcntyvsydnvjwopfe`).
- **Mercado Público (B2G) Endpoints:**
  - `GET /api-v1/mercado-publico/compra-agil` — Agile procurement opportunities (< 30 UTM).
  - `GET /api-v1/mercado-publico/opportunities` — Combined B2G tender & purchase opportunities.
  - `GET /api-v1/mercado-publico/licitaciones` — Large public tenders (LE, LP, LR).
  - `GET /api-v1/mercado-publico/health` — B2G integration service status.
- **Fuente primaria: la tabla canónica `licitaciones_mercado_publico`.**  
  La alimenta `mp-sync` (en `services/mercado-publico/`, desplegado en Vercel). Al 2026-07-30 tiene **27.267 filas** (13.454 licitaciones + 13.813 compras ágiles), todas con `published_at` real. Los endpoints responden `meta.source = 'mercado_publico'`.
- **Fallback a Licitus (`fetchLicitusActivas()` en `api-v1/routes/data.ts`):**  
  Sólo si la consulta canónica no devuelve nada. `api-v1` consulta **Licitus**, que tiene datos vivos de Mercado Público, y los mapea al vocabulario canónico. La procedencia es explícita: `meta.source = 'licitus_live'` más `data_source` en cada ítem.
  - En ESA ruta `published_at` va en `null` — Licitus expone la fecha de cierre, no la de publicación. Nunca se inventa una fecha para rellenar el hueco.
  - Compra Ágil `official_url` points to `compra-agil.mercadopublico.cl/resumen-cotizacion/<code>`. The old `www.mercadopublico.cl/CompraAgil/Ficha/<code>` returns HTTP 200 with an empty page instead of 404, so broken links looked valid.
  - If Licitus is also down, the endpoints return **503 `SOURCE_UNAVAILABLE`** — they never fabricate records. Do not reintroduce a hardcoded dataset here (see the note in the backend `CLAUDE.md`).

### 1.b `mp-sync` — cuatro cosas que muerden (verificadas 2026-08-05)

**1. La API v2 de Compra Ágil tope en 10.000 resultados y no lo dice.**

| Ventana de cambios | `total_resultados` |
|---:|---:|
| 6 h | 18 |
| 26 h | **10.000** |
| 72 h | **10.000** |

Tres veces más ancha, mismo número: es un techo, no un conteo. La **página 201
responde `success: OK` con cero items**, no un 400. Como el bucle de paginación
corta en `offset >= found`, una ventana que contenga más de 10.000 procesos
termina ordenadamente y reporta éxito habiendo perdido el resto.

`RESULT_CAP` en `sync-compra-agil.job.ts` lo detecta: fuerza `partial` y avisa a
`degradacion`. **No subir la ventana sin partirla en tramos.**

**2. El modo incremental corre TROCEADO, y no se puede volver a la ventana única.**
Hasta el 2026-08-05 `COMPRA_AGIL_INCREMENTAL_HOURS` no la leía nadie y el cron
(que manda `BODY='{}'`) corría en modo fecha re-sincronizando 3 días cada noche.
Activarlo tal cual habría truncado en 10.000.

Hoy `planCompraAgilRun` parte la ventana de cambios con `partirVentana`
(`modules/sync/domain/window-split.ts`): búsqueda binaria sobre el tiempo, cada
tramo bajo el techo. **El tamaño de tramo NO puede ser fijo** — la actividad se
concentra en horario hábil (6 h de madrugada → 18 resultados; 6 h de mañana
puede topar).

Dos cosas que parecen detalles y no lo son:
- Los tramos **comparten** el instante de corte. Repetir un proceso es inocuo
  (el upsert es idempotente); un hueco de un milisegundo lo pierde para siempre.
- **La sonda tiene que LANZAR ante un error, nunca devolver 0.** Si un 429
  llegara como "cero resultados", la ventana entera se daría por vacía, el sync
  no ingeriría nada y cerraría en verde. `compraAgilClient.list` lanza ante
  `success: NOK` y eso es lo único que separa "no hay nada" de "no pudimos
  preguntar". Hay dos tests que lo fijan.

**3. El DETALLE de la API v1 no tolera el ritmo de los listados.**
Rechaza con `HTTP 429 · Codigo 10500` "peticiones simultáneas". Medido
secuencialmente (2026-07-29 sobre OCs, remedido 2026-08-05 sobre licitaciones):
**200 ms → ~50% de éxito · 1500 ms → 100%.** Los jobs que consultan detalle usan
2500 ms (`ENRICH_DELAY_MS`, `REFRESH_DELAY_MS`), **no** `SYNC_REQUEST_DELAY_MS`,
que son 200 ms y sirve sólo para listados. Un job nuevo que pida detalle y herede
los 200 ms va a fallar en la mitad de los items y a arrastrarse durante horas.

**4. Un job que no esté en `JOB_EXPECTED_INTERVAL_HOURS` no se vigila.**
Sin entrada ahí, `expectedIntervalHours` es `null` y la regla de "sin éxito hace
más de 2× el intervalo" nunca se evalúa: el job puede pasar semanas caído y
verse `healthy`. Es opt-in silencioso. `sync-compra-agil` faltaba desde siempre.

#### ⚠️ `knowledge_edges` enlaza por TÍTULO y no tiene foreign key

Una arista hacia un nodo inexistente **se inserta sin error y se cuenta como
éxito**. Y `search_hybrid_graphrag` trae los vecinos con un **INNER JOIN**, así
que esa arista aporta **cero filas en silencio**: el grafo promete contexto, el
join lo descarta, y el LLM completa el hueco. Es un generador de alucinaciones.

`sync-jurisprudencia-grafo` creaba nodos con topes (`TOP_MATERIAS=12`) y aristas
con otro umbral sin tope (`n>500 y 20%`) — 38 huérfanas el 2026-08-03, con
materias como Bancos y AFP apuntando al vacío. Hoy el job **descarta las aristas
cuyos extremos no son nodos y avisa a `degradacion`** con los títulos faltantes.

**Al agregar aristas desde cualquier job: verificar que ambos extremos existan
como `document_title`.** Nada te lo va a avisar.

#### Salud real de los jobs

```sql
select * from mp_job_health_resumen where diagnostico <> 'ok';
```

Mide si **produjeron**, no si terminaron. Estados: `NUNCA PRODUJO` /
`NUNCA TERMINA (huerfanas)` / `FALLO SILENCIOSO` (3 vacías seguidas) /
`SIN PRODUCIR HACE MAS DE 7 DIAS`.

**Huérfana ≠ fallo real.** `clearStaleRunning` marca `failed` las corridas que
quedaron en 'running' más de 2 h y les deja `metadata.stale_cleared = true`. Esas
no fallaron: **el proceso murió antes de llamar a `complete()`**, típicamente por
pasarse del presupuesto de la función. Por eso tienen `error_details = []` — no
hay excepción que leer porque nunca la hubo. Buscarle el error a una huérfana es
buscar algo que no existe; lo que hay que mirar es cuánto tardó y por qué.

Al 2026-08-05 `refresh-opportunities` tenía 26 huérfanas y 2 fallos reales en 7
días: llevaba 27 corridas seguidas sin terminar y se veía como "el job falla".

**Acotar por CANTIDAD no protege de una latencia que varía.** `enrich-ordenes`
tenía el tope de ítems bien calculado —252 s estimados, p50 real 255 s— y aun así
generaba huérfanas, porque el **p90 es 400 s** contra un techo de 300 s. Todo job
que recorra ítems necesita además un presupuesto de RELOJ
(`REFRESH_TIME_BUDGET_MS`, `ENRICH_TIME_BUDGET_MS`) que corte limpio antes de que
lo maten. Calibrar el tope de ítems para que la corrida normal termine **por
debajo** de ese presupuesto: si saltara siempre, `partial` sería lo normal y el
estado dejaría de significar algo.

En un workflow encadenado el costo es peor que perder la pasada: el step muere,
y con `maxRetries = 1` se lleva puestas las pasadas que venían detrás.

El estado `empty` de `sync_logs` (migración 026) existe porque una corrida vacía
no es ni éxito ni fallo: `total_found` lo dicta la fuente, así que un feriado y
una consulta rota se ven idénticos **en una sola corrida**. Lo que los separa es
la racha. Por eso `empty` queda fuera de los `status IN ('success','partial')`
que calculan `last_success` y `hasSuccessForDate` — una fecha vacía no está
sincronizada y se reintenta.

**La racha se cuenta en la BASE, nunca en memoria.** mp-sync corre serverless:
un contador de instancia vuelve a 0 en cada invocación y el umbral queda
inalcanzable. Es exactamente lo que dejó inservible al detector del worker de
Bralidus cuando se migró a Vercel.

### 2. Rate Limiting Quotas & Tiers (`ratelimit.ts`)

Los topes reales están en `TIER_CREDIT_LIMITS` / `TIER_BURST_LIMITS` de
`api-v1/middleware/ratelimit.ts`. Los nombres que figuraban acá antes
(`starter` 10.000, `pro` 50.000, `enterprise` ilimitado) **no existen en el
código**; `starter` ni siquiera es un tier válido.

| Tier | Créditos/mes | Ráfaga |
|---|---:|---:|
| `anon` | 150 | 10 req/min |
| `free` | 500 | 30 req/min |
| `basic` | 1.000 | 60 req/min |
| `pro` | 15.000 | 180 req/min |
| `premium` | 100.000 | 300 req/min |
| `enterprise` | 5.000.000 | 1.200 req/min |

**La unidad es el crédito, no la petición ni el token.** Cada endpoint tiene un
precio en `ENDPOINT_CREDITS` y la respuesta lo informa en
`X-RateLimit-Request-Cost`. `api_usage_logs.credits_used` guarda lo cobrado;
`tokens_used` es telemetría del costo real y NO debe compararse contra ningún
tope (el portal las mezclaba: mostraba 30 donde se cobra 1).

El tier `anon` quedó inalcanzable al cerrar el acceso anónimo. Se conserva a
propósito como default defensivo: si alguien reabre un camino sin credencial,
que herede el cupo más bajo y no el de un usuario registrado.

### 3. Autenticación obligatoria & API Connection Hub
- **API Connection Hub (`ApiConnectionHub.tsx`):** snippets copiables en cURL, Node.js (TypeScript), Python y configuración JSON del **MCP (`animus-engine-mcp`, publicado en npm)**.
- **No hay pruebas sin autenticar.** Hasta el 2026-08-03 el gateway aceptaba peticiones sin token y también los literales `demo_public_key` / `demo_*` / `sb_publishable_*`. Las dos puertas están cerradas: hoy devuelven `401 AUTH_REQUIRED`. Todo snippet o pestaña que ofrezca una clave de demostración está desactualizado.
- Únicas rutas abiertas: `GET /health/services` y `GET /`, que se registran en `api-v1/index.ts` **antes** del `app.use` de los middlewares. Es una consecuencia del orden de registro, no una excepción declarada: agregar ahí una ruta de datos la publica sin cuota ni registro y nada falla para avisarlo.

### 4. LLM & AI Agent Standard (`/llms.txt`)
- Supports automated agent indexing via `/llms.txt`, `/llms-full.txt`, and `/robots.txt` conforming to modern LLM accessibility guidelines.

### 5. SPA Version Detector & Hard Refresh (`VersionUpdateAlert`, `useVersionCheck`)
- **`vite.config.ts`:** Uses a single shared timestamp `BUILD_VERSION` for both `versionPlugin()` (which writes `public/version.json`) and `define: { __APP_BUILD_TIME__ }`.
- **`vercel.json`:** Defines strict headers (`Cache-Control: no-cache, no-store, must-revalidate, max-age=0`, `Pragma: no-cache`, `Expires: 0`) for `/version.json` so CDN edge caches always return `X-Vercel-Cache: MISS`.
- **`useVersionCheck.ts`:** Polls `/version.json` every 15 seconds and on `visibilitychange` / `focus`. When a deployment is detected (`data.version !== initialVersionRef.current`), it immediately triggers:
  1. An interactive Sonner Toast (`⚡ Nueva versión disponible`) with an **"Actualizar ahora"** button.
  2. A floating banner (`VersionUpdateAlert`).
  3. Clicking update clears `caches`, unregisters Service Workers, and forces a cache-busting reload (`?v=timestamp`).

### 6. Interactive User Manual (`UserManualModal.tsx`)
- Accessible via button in the portal header. Features visual illustrations, step-by-step guides for creating API Keys, testing in the Playground, and querying the GraphRAG / Knowledge Graph.

## Key Endpoints Documented in Portal

| Method | Path | Purpose |
|---|---|---|
| GET | `/api-v1/mercado-publico/compra-agil` | ChileCompra agile procurement (< 30 UTM) with fallback |
| GET | `/api-v1/mercado-publico/opportunities` | Combined B2G tender opportunities |
| GET | `/api-v1/mercado-publico/licitaciones` | Public tenders (LE, LP, LR) |
| GET | `/api-v1/mercado-publico/health` | B2G integration health status |
| GET | `/api-v1/data/economy` | Chilean indicators (UF, IPC, UTM, USD/CLP) |
| GET | `/api-v1/data/macro` | US FRED macro series |
| GET | `/api-v1/data/licitus/mercado/activas` | Active procurement opportunities |
| POST | `/api-v1/rag/query` | Semantic GraphRAG search |
| POST | `/api-v1/webhooks` | Register webhook endpoint |

## What to keep in mind when editing
- `DeveloperPortal.tsx` is modularized with tabs (`activeTab`).
- Keep Tailwind v4 `@import "tailwindcss"` syntax.
- Use `@/` alias pointing to `./src`.
- Ensure all API snippets reference `CANONICAL_BASE_URL = 'https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/api-v1'`.

