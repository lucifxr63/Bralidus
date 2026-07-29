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
- **Live fallback to Licitus (`fetchLicitusActivas()` in `api-v1/routes/data.ts`):**  
  The canonical table `licitaciones_mercado_publico` is currently EMPTY — the `mp-sync` ingestion service does not exist yet. When the canonical query returns nothing, `api-v1` queries **Licitus** (via the BralidusPY proxy), which holds live Mercado Público data (~650 open processes), and maps it to the canonical Animus vocabulary. Provenance is explicit: `meta.source = 'licitus_live'` plus `data_source` on every item.
  - `published_at` is `null` on this path — Licitus exposes the closing date, not the publication date.
  - Compra Ágil `official_url` points to `compra-agil.mercadopublico.cl/resumen-cotizacion/<code>`. The old `www.mercadopublico.cl/CompraAgil/Ficha/<code>` returns HTTP 200 with an empty page instead of 404, so broken links looked valid.
  - If Licitus is also down, the endpoints return **503 `SOURCE_UNAVAILABLE`** — they never fabricate records. Do not reintroduce a hardcoded dataset here (see the note in the backend `CLAUDE.md`).

### 2. Rate Limiting Quotas & Tiers (`ratelimit.ts`)
- Configured in backend `ratelimit.ts`.
- **Free Plan (`free`):** **500 testing credits / month** and **30 requests / min** burst limit. Developers on the Free tier can query all public B2G and macro endpoints immediately without `403 Forbidden` errors.
- **Starter:** 10,000 credits / month, 120 req/min.
- **Pro:** 50,000 credits / month, 300 req/min.
- **Enterprise:** Unlimited credits, 1,000 req/min.

### 3. Fintoc-style Unauthenticated Testing & API Connection Hub
- **API Connection Hub (`ApiConnectionHub.tsx`):** Provides copy-paste integration snippets in cURL, Node.js (TypeScript), Python, and **MCP Server (`animus-engine-mcp`)** JSON configuration.
- **Fintoc Methodology:** Unauthenticated developers can immediately test endpoints in the API Playground using demo tokens (`demo_public_key` or `sk_demo_live_...`).

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

