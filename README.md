# Validus — Developer Portal

Dashboard de gestión para la API de Validus. Permite a desarrolladores administrar API keys, monitorear uso, testear endpoints en tiempo real, gestionar webhooks y visualizar el knowledge graph del sistema.

**URL en producción:** `https://validus.scouttech.lat/developers`

---

## Stack

| Layer | Tecnología |
|---|---|
| Framework | React 19 + Vite 8 |
| Lenguaje | TypeScript 6 (strict) |
| CSS | Tailwind v4 (sin config file) |
| Auth | Supabase PKCE (magic link) |
| Base de datos | Supabase (Postgres) |
| Gráficos | Recharts 3 (área, pie, barra) |
| Knowledge Graph | ReactFlow (@xyflow/react) |
| Notificaciones | Sonner |
| Dark mode | next-themes |

---

## Funcionalidades

### Gestión de API Keys
- Generación de claves con prefijo `val_live_` + 16 bytes hex aleatorios
- Hash SHA-256 client-side antes de persistir — el raw nunca toca el backend
- Vista solo del prefijo tras creación (seguridad por diseño)
- Revocación y tracking de `last_used_at`

### Monitoreo de uso
- Requests del mes, requests del día, tokens consumidos
- Rate limits por plan (Free: 1 000 req / 500k tokens)
- Gráficos de 14 días: requests por día, distribución por endpoint, tokens por día

### Playground interactivo
- 8 endpoints disponibles para testear con parámetros configurables
- Generación automática de snippets curl / Node.js / Python
- Respuesta en tiempo real con highlight de JSON

### Documentación de API
- 8 endpoints documentados con parámetros, tipos y ejemplos
- Expandibles inline sin salir del dashboard

### Health check
- Estado en tiempo real de todos los servicios backend
- CMF, FRED, ChileCompra, RAG, webhooks, economic knowledge

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
