# Animus Engine / Bralidus — Developer Portal

Dashboard de gestión e interacción para **Animus Engine v2.0 / Bralidus RaaS**, el motor de Inteligencia y Retrieval-as-a-Service (RaaS) para contrataciones B2G de ChileCompra (Mercado Público), licitaciones LE/LP, benchmarks de mercado e indicadores macroeconómicos chilenos.

**URL en Producción (SPA):** `https://bralidus.vercel.app`  
**API Gateway Producción (Supabase):** `https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/api-v1`

---

## ⚡ Novedades Arquitectónicas Animus Engine v2.0

- **Plan Free sin bloqueo 403 (`500 créditos/mes`):** Los desarrolladores en el tier Free disponen de 500 créditos mensuales de prueba y una ráfaga de 30 peticiones/minuto para validar los endpoints en tiempo real sin requerir tarjeta de crédito.
- **Capa de Resiliencia B2G (`Fallback ChileCompra`):** Si las tablas canónicas del motor se encuentran en sincronización, los endpoints `/mercado-publico/compra-agil`, `/opportunities` y `/licitaciones` inyectan 12 procesos reales de instituciones públicas chilenas con montos en CLP/UTM y enlaces oficiales directos a `www.mercadopublico.cl`.
- **API Connection Hub & MCP Server:** Soporte nativo para copiar snippets en cURL, TypeScript, Python y configuración de servidor **MCP (`animus-engine-mcp`)** para agentes Claude Code o IDEs IA.
- **Metodología Fintoc:** Pruebas interactivas inmediatas en el Playground utilizando llaves demo (`demo_public_key`).
- **SPA Version Detector (`VersionUpdateAlert`):** Sistema de detección y notificación con Toast de Sonner que avisa en tiempo real cuando se publica una actualización, ejecutando una recarga limpia (`cache-buster` y purga de Service Workers) sin necesidad de Ctrl+F5.
- **Estándar IA / LLM First:** Archivos canónicos `/llms.txt`, `/llms-full.txt` y `/robots.txt` para indexación por agentes autónomos.

---

## Stack Tecnológico

| Layer | Tecnología |
|---|---|
| Framework | React 19 + Vite 8 |
| Lenguaje | TypeScript 6 (strict) |
| CSS | Tailwind CSS v4 |
| Auth | Supabase PKCE (magic link) |
| Base de datos | Supabase (Postgres + pgvector) |
| API Gateway | Supabase Edge Functions (`api-v1`) |
| Gráficos | Recharts 3 (área, pie, barra) |
| Knowledge Graph | ReactFlow (@xyflow/react) |
| Notificaciones | Sonner |
| Dark mode | next-themes |

---

## Funcionalidades Principales

### 1. Gestión de API Keys
- Generación de claves con prefijo `val_live_` + 16 bytes hex aleatorios.
- Hash SHA-256 client-side antes de persistir — el raw nunca toca el backend.
- Revocación y tracking de `last_used_at`.

### 2. Monitoreo y Cuotas (Tiers)
- Control de consumo mensual vs límites de tier (`free`, `starter`, `pro`, `enterprise`).
- Gráficos de 14 días: requests por día, distribución por endpoint y consumo de tokens.

### 3. Playground Interactivo & API Connection Hub
- Prueba endpoints B2G y macroeconómicos con parámetros configurables y highlighting JSON en tiempo real.
- Manual de Usuario interactivo integrado como modal con ilustraciones ilustrativas y guías cURL.


### RAG Audit
- Métricas de precisión y latencia del sistema de búsqueda semántica
- Desglose por run: keyword hit rate, chunks retrieved, errores

### Knowledge Graph
- Visualización ReactFlow del knowledge base (nodos = documentos, aristas = wikilinks)
- Upload de archivos `.md` con parsing de frontmatter YAML y secciones `##`
- Colores por categoría: Normativa (azul), Metodología (verde), Mercado (naranja)

### Webhooks
- Registro de endpoints HTTPS para 3 eventos: `validation.complete`, `analysis.ready`, `profile.updated`
- Secret mostrado una sola vez al crear (almacenado hasheado)
- Listado y eliminación de suscripciones

---

## Instalación

```bash
cd validateai-developer-portal
npm install
```

Crear `.env.local` con:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

```bash
npm run dev        # → http://localhost:5173
npm run build      # build de producción → ./dist
npm run preview    # sirve ./dist localmente
```

---

## Variables de entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Clave pública (anon) de Supabase |
| `VITE_POSTHOG_KEY` | — | Analytics (PostHog) |
| `VITE_POSTHOG_HOST` | — | Host de PostHog |

---

## Estructura del proyecto

```
src/
├── App.tsx                   # Router + ProtectedRoute + sesión
├── main.tsx                  # Entry point
├── index.css                 # Tailwind + tokens de marca
│
├── pages/
│   ├── Login.tsx             # Magic link email OTP
│   ├── AuthCallback.tsx      # Redirect post-login
│   └── DeveloperPortal.tsx   # Dashboard principal (11 secciones)
│
├── components/
│   └── KnowledgeGraph.tsx    # ReactFlow + upload de markdown
│
├── lib/
│   └── supabase.ts           # Cliente Supabase (PKCE)
│
└── utils/
    └── crypto.ts             # generateApiKey() + hashApiKey()

scripts/
└── sync-knowledge-graph.js   # CLI para bulk upload de .md al knowledge base
```

---

## Flujo de autenticación

1. Usuario ingresa email → `supabase.auth.signInWithOtp()` envía magic link
2. Clic en link → redirect a `/auth/callback`
3. `AuthCallback.tsx` escucha `onAuthStateChange` → `SIGNED_IN` → redirige a `/`
4. `ProtectedRoute` en `App.tsx` protege el dashboard; sin sesión → `/login`

---

## Sync de knowledge graph por CLI

Para subir archivos `.md` en bulk al knowledge base:

```bash
# Requiere VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local
node scripts/sync-knowledge-graph.js ./docs/normativa normativa
node scripts/sync-knowledge-graph.js ./docs/mercado mercado
```

Categorías válidas: `normativa` | `metodologia` | `mercado`

El script parsea frontmatter YAML (`titulo`, `tags`), split por secciones `##`, y extrae wikilinks `[[Reference]]` como aristas del grafo.

---

## Tablas de Supabase utilizadas

| Tabla | Uso |
|---|---|
| `api_keys` | Claves de API (prefijo + hash) |
| `api_usage_logs` | Métricas de uso mensual |
| `rag_audit_summary` | Resumen de runs de auditoría RAG |
| `rag_audit_logs` | Detalle por query |
| `knowledge_nodes` | Nodos del grafo |
| `knowledge_edges` | Aristas (wikilinks entre documentos) |
| `developer_webhooks` | Suscripciones registradas |

---

## Relación con Validus

Este portal es una **SPA independiente** que comparte el mismo proyecto Supabase y Edge Functions que la app principal (`validateai/`). No hay dependencias de código entre ambos — se comunican exclusivamente a través de la API.

La app principal (`validateai/`) corre en Vercel; este portal se puede desplegar en cualquier host estático (Vercel, Netlify, Cloudflare Pages).
