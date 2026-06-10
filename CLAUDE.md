# ValidateAI Developer Portal — CLAUDE.md

## What is this project

Developer portal for the ValidateAI RAG/RaaS API. Lets developers manage API keys, monitor usage, test endpoints in a playground, manage webhooks, and visualize the knowledge base graph. It is a standalone Vite React SPA that connects to the same Supabase backend as the main ValidateAI app.

## Stack

| Layer | Tech |
|---|---|
| Framework | React 19 + TypeScript 6 + Vite 8 |
| Routing | React Router 7 |
| Styling | Tailwind CSS 4 |
| UI primitives | Lucide React, Sonner (toasts), next-themes (dark mode) |
| Charts | Recharts 3 |
| Graph | @xyflow/react (ReactFlow) |
| Backend | Supabase (auth, DB, Edge Functions) |

## Dev commands

```bash
npm run dev       # Vite dev server → http://localhost:5173
npm run build     # tsc -b && vite build → ./dist
npm run preview   # serve ./dist locally
npm run lint      # eslint
npm run sync      # node scripts/sync-knowledge-graph.js (bulk MD upload)
```

## Environment variables

Required in `.env.local` (never commit):

```
VITE_SUPABASE_URL=https://fcdhcntyvsydnvjwopfe.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

Optional:
```
VITE_LINKEDIN_CLIENT_ID
VITE_POSTHOG_KEY / VITE_POSTHOG_HOST
VITE_SENTRY_DSN / VITE_SENTRY_RELEASE
```

Backend-only env vars (Edge Functions, never in frontend): `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `FRED_API_KEY`, `SII_APIGATEWAY_KEY`, `CMF_KEY`, `BDE_USER/BDE_PASS`, `LLAMAPARSE_API_KEY`.

## Project structure

```
src/
  App.tsx                    # Router + session management + ProtectedRoute
  main.tsx                   # Entry point
  index.css                  # Tailwind base + brand tokens
  pages/
    Login.tsx                # Email magic link (Supabase OTP)
    AuthCallback.tsx         # Handles Supabase auth redirect
    DeveloperPortal.tsx      # Main dashboard (1484 lines, 8+ sections)
  components/
    KnowledgeGraph.tsx       # ReactFlow graph + MD file upload + frontmatter parser
  lib/
    supabase.ts              # Supabase client (PKCE flow)
  utils/
    crypto.ts                # generateApiKey() → "val_live_..." / hashApiKey() SHA-256
scripts/
  sync-knowledge-graph.js    # CLI: bulk-upload markdown files to knowledge_vault
```

## Auth flow

1. User enters email → Supabase sends magic link
2. Click link → `/auth/callback` → `AuthCallback.tsx` listens to `onAuthStateChange`
3. On `SIGNED_IN` → redirect to `/`; on `SIGNED_OUT` → redirect to `/login`
4. `ProtectedRoute` in `App.tsx` guards the dashboard; session state is top-level React state

## DeveloperPortal.tsx sections

The main component is large (1484 lines). Sections rendered:

1. **Stats cards** — total requests, today, tokens, active API keys
2. **Rate limits** — monthly usage vs plan (Free: 1000 req / 500k tokens)
3. **Service status grid** — health checks for 7+ services
4. **Charts (14 days)** — area (requests), pie (by endpoint), bar (tokens)
5. **API Playground** — interactive tester for 8 endpoints; curl/Node.js/Python snippets
6. **API Docs** — expandable reference for all 8 endpoints
7. **RAG Audit** — precision, latency, keyword hit rates from `rag_audit_summary`
8. **Knowledge Graph** — ReactFlow visualization + MD upload
9. **API Keys** — create (hashed client-side), revoke, usage
10. **Request Logs** — paginated, searchable table (20/page)
11. **Webhooks** — register HTTPS endpoints for 3 event types

## Database tables used (read-only from frontend)

| Table | Purpose |
|---|---|
| `api_keys` | id, profile_id, name, key_prefix, key_hash, is_active, last_used_at |
| `api_usage_logs` | endpoint, requests_count, tokens_used, created_at |
| `rag_audit_summary` | run_id, avg_precision, avg_latency_ms, hit_rate_pct |
| `rag_audit_logs` | per-query audit detail |
| `knowledge_nodes` | document_title, category |
| `knowledge_edges` | source_title, target_title |

## API endpoints documented in the portal

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/rag/query` | Semantic search (RAG) |
| GET | `/api/v1/data/economy` | Chilean indicators (UF, IPC, UTM, USD/CLP) |
| GET | `/api/v1/data/macro` | US FRED macro indicators |
| GET | `/api/v1/data/chilecompra/metricas` | ChileCompra provider metrics |
| POST | `/api/v1/rag/ingest/text` | Vectorize and ingest text |
| POST | `/functions/v1/assemble-mega-prompt` | AI due diligence analysis |
| POST | `/api/v1/webhooks` | Register webhook |
| GET | `/api/v1/webhooks` | List webhooks |

## Design system

- **Brand teal**: `#0EB5C6` / `#2DD4BF`
- **Dark bg**: `#0A0A0F` (page) · `#12121A` (surface)
- **Text**: `#F0EFF8` (dark mode)
- **Fonts**: DM Sans (body), Space Grotesk (headings) — loaded via CSS in `index.css`
- **Icons**: Lucide React
- **Dark mode**: next-themes; default dark

## API key security pattern

Keys are generated in the browser (`generateApiKey()` → `val_live_` + 16 random bytes as hex), then hashed with SHA-256 (`hashApiKey()`) using the browser's `SubtleCrypto`. Only the hash is stored in the DB; only the prefix (`val_live_XXXX...`) is shown after creation. Never log or store the raw key.

## Knowledge Graph / sync script

`scripts/sync-knowledge-graph.js` reads `.md` files from a local folder, extracts YAML frontmatter (`titulo`, `tags`) and wikilinks (`[[Title]]`), then POSTs to the Supabase vault ingest endpoint. Run as:

```bash
node scripts/sync-knowledge-graph.js ./docs/normativa normativa
# categories: normativa | metodologia | mercado
```

The `KnowledgeGraph.tsx` component also lets admins upload `.md` files directly from the browser UI.

## Relation to the main ValidateAI app

This is a **separate Vite project** in `validateai-developer-portal/`. It shares the same Supabase project and Edge Functions as the main app in `validateai/`. Do not run `npm run dev` from the wrong directory. Port 5173 is this portal; the main app uses a different port.

## What to keep in mind when editing

- `DeveloperPortal.tsx` is very large; prefer targeted edits over full rewrites.
- Tailwind v4 uses `@import "tailwindcss"` syntax — no `tailwind.config.js` needed for basic use.
- `vite.config.ts` sets `@` alias to `./src` — use `@/lib/supabase` etc.
- The Supabase client uses PKCE — do not change `flowType` without understanding the auth callback.
- TypeScript version is 6.x — syntax and config may differ slightly from TS 5.x projects.
