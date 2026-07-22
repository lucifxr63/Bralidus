# S-Pulse — Documento técnico de integración

> **Propósito de este documento:** evaluar si **Bralidus** (cerebro / capa central) puede integrar y consumir S-Pulse como fuente de *B2B Relationship Intelligence* chilena, para enriquecer la información que Bralidus muestra.
>
> Rama analizada: `Desarrollo-Simon` · Fecha: 2026-07-14 · Alcance: backend API + modelo de datos + fuentes + estado real de cada pieza.

---

## 1. Qué es S-Pulse (en una frase técnica)

Un **módulo de inteligencia de relaciones B2B** que modela empresas chilenas, personas naturales y sus vínculos legales/comerciales en un **grafo (Neo4j)**, se alimenta de fuentes públicas chilenas con **trazabilidad legal por relación**, y expone un **motor de señales de compra** que cruza eventos de mercado contra un *Ideal Customer Profile* (ICP) por tenant para generar oportunidades de venta.

**Dato clave para la integración:** S-Pulse **ya está diseñado para ser consumido por una aplicación anfitriona** (host app), no como producto público. Esto está explícito en el código:

> *"S-Pulse is an internal module consumed by a host application, not a public-facing product — the host app authenticates the end user and is responsible for the tenant_id it forwards."* — [`src/middleware/internal-auth.js`](../src/middleware/internal-auth.js)

Es decir: **Bralidus encaja exactamente en el rol de "host app" para el que S-Pulse fue construido.** No hay que reacomodar el modelo de confianza; Bralidus autentica al usuario final, decide el `tenant_id`, y llama a S-Pulse con una API key compartida.

---

## 2. Arquitectura

```
┌──────────────────────────────────────────────────────────────────┐
│  BRALIDUS (host / cerebro)                                         │
│  - autentica al usuario final                                     │
│  - decide el tenant_id                                            │
│  - consume la API REST de S-Pulse (X-Internal-Api-Key)           │
└───────────────┬──────────────────────────────────────────────────┘
                │ HTTP REST /api/*
┌───────────────▼──────────────────────────────────────────────────┐
│  S-PULSE BACKEND — Node.js + Express (CommonJS, JS plano)         │
│  ┌────────────────┐  ┌───────────────┐  ┌──────────────────────┐ │
│  │ API REST       │  │ Ingesta       │  │ Motor de señales     │ │
│  │ companies      │  │ Diario Oficial│  │ signals → alerts →   │ │
│  │ entities       │  │ RES (real)    │  │ digest (cron jobs)   │ │
│  │ relationships  │  │ workers/cron  │  │                      │ │
│  │ icp / opps     │  └───────┬───────┘  └──────────┬───────────┘ │
│  └───────┬────────┘          │                     │             │
└──────────┼───────────────────┼─────────────────────┼─────────────┘
           │                   │                     │
     ┌─────▼─────┐       ┌─────▼──────┐       ┌──────▼──────┐
     │  Neo4j    │       │ datos.gob  │       │  Supabase   │
     │ (grafo)   │       │ .cl (RES)  │       │ (ICP + opps)│
     └───────────┘       └────────────┘       └─────────────┘
```

**Componentes desplegables:**

| Proceso | Comando | Rol |
|---|---|---|
| API REST | `npm run dev` / `npm start` | Lo que Bralidus consume |
| Worker ingesta (cron) | `npm run worker:schedule` | Puebla el grafo (Diario Oficial + RES) |
| Worker señales (cron) | `npm run signals:schedule` | Genera eventos, oportunidades y digest |
| Scraper Python | `scraper/` | Baja el Diario Oficial (XLSX → texto) |

Los workers son **procesos separados** de la API — se pueden escalar/apagar de forma independiente. La API es *stateless* salvo por las conexiones a Neo4j/Supabase.

**Stack:** Node.js + Express · Neo4j 5 (grafo, driver Bolt) · Supabase/Postgres (ICP + oportunidades) · Python (scraper) · Resend (email). Frontend Vite+React aparte (referencia, no necesario para integrar).

---

## 3. Modelo de datos

### 3.1 Grafo (Neo4j) — el núcleo

**Nodos**

| Nodo | Propiedades | Clave única |
|---|---|---|
| `Empresa` | `rut`, `razonSocial`, `fechaCreacion?`, `legal_type?`, `status?`, `industry_tags?` (array), `address?`, `createdAt`, `updatedAt` | `rut` |
| `PersonaNatural` | `rut`, `nombre`, `createdAt`, `updatedAt` | `rut` |
| `Evento` | `id` (hash sha256 de `rut+tipo+fecha+detalle`), `tipo` (`REGISTRO_DOMINIO` \| `BUSQUEDA_PERSONAL`), `fecha`, `detalle`, `sourceUrl`, `createdAt` | `id` |

**Relaciones**

| Relación | Semántica |
|---|---|
| `(PersonaNatural)-[:ES_SOCIO_DE]->(Empresa)` | socio (con `equity_percentage?`) |
| `(PersonaNatural)-[:ES_REP_LEGAL_DE]->(Empresa)` | representante legal |
| `(Empresa)-[:ES_CLIENTE_DE {tenant_id}]->(Empresa)` | relación comercial multi-tenant (usada por `shortest-path`) |
| `(Empresa)-[:TUVO_EVENTO]->(Evento)` | señal de compra detectada |

**Trazabilidad legal:** cada relación creada por ingesta lleva metadata `{ sourceUrl, sourceType, extractionDate, documentHash }`. `sourceType ∈ {DIARIO_OFICIAL, RES, MANUAL, OTHER}`. Esto es recuperable vía API (§4.4) — **para Bralidus es el diferencial**: cada afirmación de relación es auditable hasta su documento fuente.

Constraints/índices en [`src/lib/schema.js`](../src/lib/schema.js): `rut` único en `Empresa` y `PersonaNatural`, `id` único en `Evento`, índice en `Evento.fecha`.

### 3.2 Relacional (Supabase/Postgres) — ICP + oportunidades

Definido en [`supabase/schema.sql`](../supabase/schema.sql):

```sql
icp_settings (
  tenant_id text primary key,
  sectors text[] not null default '{}',
  max_company_size text,          -- guardado pero NO usado aún en el matching
  max_age_years integer,
  updated_at timestamptz
)

oportunidades (
  id bigserial primary key,
  tenant_id text not null,
  company_rut text not null,
  company_name text,
  evento_tipo text not null,
  evento_fecha timestamptz not null,
  matched_at timestamptz,
  notified_at timestamptz,
  unique (tenant_id, company_rut, evento_tipo, evento_fecha)  -- idempotencia
)
```

RLS habilitado con *default-deny* (el backend usa service-role key y lo bypassa; cierra el acceso directo desde browser).

---

## 4. API REST — contrato de consumo

Base URL: `http://<host>:4000/api` (configurable por `PORT`).
Formato de respuesta uniforme: `{ success: boolean, ... }`. Errores: `{ success: false, error: string }`.

### 4.0 Autenticación (cómo llama Bralidus)

- Header **`X-Internal-Api-Key: <INTERNAL_API_KEY>`** en toda request a `/api/*` (excepto `/api/health`).
- Es un **secreto compartido host↔S-Pulse**, no un JWT ni IAM. Solo verifica que el caller es Bralidus; **no** identifica al usuario final.
- **Bralidus es responsable de:** autenticar al usuario final y decidir/forwardear el `tenant_id`.
- Si `INTERNAL_API_KEY` no está seteada, el check se saltea (solo dev — nunca en entorno compartido).
- CORS: `CORS_ORIGIN` (lista separada por comas). Requests server-to-server (sin `Origin`) siempre pasan → **integración backend Bralidus→S-Pulse no toca CORS**.

### 4.1 Health

```
GET /api/health   →  200 { success, app, env, timestamp }   (sin auth)
```

### 4.2 Companies (grafo de empresas)

```
GET /api/companies/search?q=<min 2 chars>
  200 { success, metadata:{total_results, query}, data:[{ rut, business_name, legal_type, status }] }
  400 q < 2 chars

GET /api/companies/:rut/profile
  200 { success, data:{ company:{rut,business_name,legal_type,status,industry_tags,address,creation_date},
                        members:[{rut,name,roles:[...],equity_percentage}],
                        recent_triggers:[] } }
  400 RUT inválido · 404 no existe

GET /api/companies/:rut/network
  200 { success, data:{ nodes:[{id,type:'company'|'person',label,data}],
                        edges:[{id,source,target,label}] } }        ← listo para render de grafo

GET /api/companies/:rut/shortest-path?target_rut=&tenant_id=
  200 { success, path_found, degrees_of_separation, data:{ route:[{step,node:{type,name,rut},connection_to_next}] } }
  400 falta target_rut / tenant_id
```

### 4.3 Entities (lookup genérico por RUT)

```
GET /api/entities/:rut
  200 { success, data:{ type:'Empresa'|'PersonaNatural', data:{...props}, relationships:[{type,rut}] } }
  400 RUT formato inválido (valida Módulo 11) · 404 no existe · 503 grafo caído
```

### 4.4 Relationships (trazabilidad legal)

```
GET /api/relationships/:id/source          ← id con formato rel_<elementId>
  200 { success, data:{ relationshipId, relationshipType,
                        from:{type,rut,name}, to:{type,rut,name},
                        source:{sourceUrl,sourceType,extractionDate,documentHash} | null } }
  400 id inválido · 404 no existe
```

### 4.5 ICP (perfil de cliente ideal, por tenant — requiere Supabase)

```
GET /api/icp/:tenantId
  200 { success, data:{ tenant_id, sectors, max_company_size, max_age_years, updated_at } }
  404 sin ICP · 503 Supabase no configurado

PUT /api/icp/:tenantId    body { sectors:[], maxCompanySize, maxAgeYears }
  200 (upsert, mismo shape que GET) · 400 validación · 503
```

### 4.6 Opportunities (señales de compra materializadas — requiere Supabase)

```
GET /api/opportunities?tenant_id=
  200 { success, data:[{ id, company_rut, company_name, evento_tipo, evento_fecha, matched_at, notified_at }] }
      ordenadas por matched_at desc
  400 falta tenant_id · 503
```

**Resumen para Bralidus:** los endpoints de más valor para "mostrar mejor información" son **`/network`** (grafo listo para render), **`/profile`** (ficha 360°), **`/relationships/:id/source`** (auditoría) y **`/opportunities`** (señales accionables).

---

## 5. Multi-tenancy

- `tenant_id` es un **string simple sin autenticación propia** — mismo identificador usado en `ES_CLIENTE_DE`, `icp_settings`, `oportunidades` y `shortest-path`.
- S-Pulse **confía** en el `tenant_id` que le pasa la host app. No hay login ni modelo de usuarios dentro de S-Pulse.
- **Implicación para Bralidus:** el aislamiento por tenant es tan fuerte como el control que Bralidus haga del `tenant_id`. Bralidus debe garantizar que nunca forwardea un `tenant_id` que el usuario final no tiene derecho a ver.

---

## 6. Fuentes de datos — estado real (crítico para expectativas)

| Fuente | Estado | Qué aporta | Qué NO aporta |
|---|---|---|---|
| **RES (Registro de Empresas y Sociedades)** — `datos.gob.cl` CKAN, CC-BY | ✅ **Conector real** | RUT, razón social, fecha constitución, capital, tipo sociedad, comuna. Crea/actualiza nodos `Empresa` | **NO trae socios ni representantes legales** |
| **Diario Oficial** (extractos notariales → socios/reps) | ⚠️ **Fixtures** | Pipeline completo (parser, validación RUT, upsert, trazabilidad) funcionando sobre archivos de ejemplo | No hay fuente real conectada aún de socios/reps |
| **Señales — dominios `.cl`** (`REGISTRO_DOMINIO`) | ⚠️ **Fixtures (indefinido)** | Pipeline de matching contra el grafo | NIC Chile **descartado**: sus TOS prohíben usar la base de dominios para fines distintos a inscripción |
| **Señales — ofertas laborales** (`BUSQUEDA_PERSONAL`) | ⚠️ **Fixtures** | Pipeline de matching | Falta decisión de partnership/licencia con un portal de empleo |

**Traducción honesta:** hoy S-Pulse puebla **empresas reales** (RES), pero **las relaciones socio/representante y las señales de compra corren sobre datos de ejemplo**. El pipeline está completo y probado; lo que falta es enchufar fuentes reales — y para socios/reps y dominios eso es un **problema de acceso/licencia a datos**, no de ingeniería.

---

## 7. Motor de señales de compra (pipeline)

Tres jobs encadenados en [`src/signals/`](../src/signals/), cada uno como cron independiente:

1. **Ingesta** (`daily-signals.job`, `npm run signals:worker`): lee señales → matchea contra el grafo por RUT o razón social exacta → registra `(:Empresa)-[:TUVO_EVENTO]->(:Evento)` idempotente.
2. **Alertas** (`daily-alerts.job`): por cada tenant con ICP, cruza `sectors` + `max_age_years` contra empresas con eventos recientes → inserta en `oportunidades` (idempotente por constraint).
3. **Digest semanal** (`weekly-digest.job`): arma y envía email de oportunidades no notificadas (Resend).

**Gotchas documentados que afectan resultados:**
- El match de sector es `WHERE tag IN $sectors` **exacto** sobre `industry_tags` — sensible a tildes/mayúsculas (`"tecnología"` ≠ `"tecnologia"`). Sin normalización.
- `max_company_size` del ICP **se guarda pero no se usa** (ningún `Empresa` tiene campo de tamaño todavía).
- Sin `RESEND_API_KEY`, el digest se loguea en vez de enviarse. El `RESEND_FROM` por defecto es sandbox y **no entrega a destinatarios reales** → bloqueador de go-live del email.

---

## 8. Modos de degradación (importante para SLAs de Bralidus)

S-Pulse degrada de forma explícita en vez de romper:

- **Neo4j caído/no configurado** → endpoints de grafo devuelven `503` (o datos mock **solo** si `ALLOW_MOCK_FALLBACK=true`, prohibido en prod). Hay *circuit breaker* con cooldown (`NEO4J_CIRCUIT_COOLDOWN_MS`, default 15s) para no reintentar handshake en cada request durante un outage.
- **Supabase caído/no configurado** → ICP y oportunidades devuelven `503`.
- ⚠️ **Cuidado con el `503` genérico:** los controladores mapean *cualquier* error de query (tabla inexistente, tipo mal formado, fallo de red) al mismo `"Supabase no está configurado"` / `DB_UNAVAILABLE`. Un `503` no siempre significa "falta config". Bralidus no debe inferir la causa raíz desde el mensaje.

---

## 9. Configuración / entorno (referencia)

Variables clave ([`.env.example`](../.env.example)):

| Variable | Rol en la integración |
|---|---|
| `INTERNAL_API_KEY` | Secreto compartido Bralidus↔S-Pulse |
| `CORS_ORIGIN` | Solo relevante si Bralidus llama desde browser |
| `NEO4J_URI/USERNAME/PASSWORD/DATABASE` | Grafo (AuraDB o Docker local) |
| `SUPABASE_URL/SERVICE_ROLE_KEY` | ICP + oportunidades |
| `ALLOW_MOCK_FALLBACK` | **Debe ser `false`** en cualquier entorno con tenants reales |
| `*_CRON`, `RESEND_*`, `DIGEST_EMAIL_*` | Workers/email (no afectan el consumo de la API) |

---

## 10. Recomendación de integración con Bralidus

**Encaje conceptual: alto.** S-Pulse ya está construido como "módulo interno tras una host app" — Bralidus es ese host. No hay que reescribir el modelo de confianza.

### Patrón recomendado
- **Bralidus → S-Pulse: backend-to-backend REST**, con `X-Internal-Api-Key`. Evita CORS y no expone el grafo directo al browser.
- Bralidus mantiene el mapa usuario→`tenant_id` y lo forwardea. Nunca dejar que el cliente elija el tenant.
- Consumir principalmente `/companies/:rut/profile`, `/companies/:rut/network`, `/entities/:rut`, `/relationships/:id/source` y `/opportunities`.

### Qué gana Bralidus
- **Grafo de relaciones societarias chileno** con salida lista para render (`/network`).
- **Trazabilidad legal por relación** (auditoría al documento fuente) — diferencial fuerte para un "cerebro" que muestra afirmaciones.
- **Señales de compra + ICP** por tenant, ya materializadas como oportunidades consultables.

### Gaps / decisiones a resolver antes de producción
1. **Cobertura de datos real:** socios/reps y señales corren sobre fixtures. Definir si Bralidus aporta/financia fuentes reales (extractos notariales, feed de dominios/empleo con licencia) o si se integra "as-is" para empezar solo con empresas RES reales.
2. **Normalización de sectores** (tildes/mayúsculas) si Bralidus va a setear ICPs programáticamente.
3. **Observabilidad:** el `503` genérico oculta la causa raíz — acordar logging/correlación para diagnóstico cruzado.
4. **Aislamiento de tenant:** recae 100% en Bralidus; formalizar cómo se deriva y valida el `tenant_id`.
5. **Email digest:** si Bralidus quiere las notificaciones, hace falta `RESEND_API_KEY` real + dominio verificado (o Bralidus toma `/opportunities` y notifica por su cuenta).
6. **Contrato de versionado:** no hay versionado de API (`/api/*` sin `/v1`). Acordar política antes de acoplar.

### Veredicto
**Integrable con esfuerzo bajo-medio a nivel de plomería** (REST + API key + tenant_id). El trabajo real no es de integración sino de **cobertura de datos**: para que Bralidus "muestre mejor información", el valor depende de conectar fuentes reales de socios/representantes y señales, que hoy son el eslabón en fixtures.
