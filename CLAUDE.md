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

