# Especificación Completa — Animus Engine / Bralidus RaaS API v1

> Documentación de referencia técnica para ingesta por LLMs (Cursor, Windsurf, Claude, Perplexity) y desarrolladores.  
> **Base URL Oficial**: `https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/api-v1`

---

## 1. Autenticación y Seguridad
Todas las peticiones a endpoints de datos requieren el encabezado HTTP:
```http
Authorization: Bearer <TU_API_KEY>
X-Client: Animus-Engine/1.0.0
```
- Para pruebas de desarrollo y evaluación de LLMs, se puede emplear la clave: `demo_public_key`.
- Si se utiliza en clientes que no soportan encabezados personalizados, se puede enviar como parámetro de consulta: `?apikey=<TU_API_KEY>`.

---

## 2. Indicadores Macroeconómicos de Chile

### 2.1 GET `/data/macro`
Retorna el snapshot oficial en tiempo real con las series económicas normalizadas de Chile (UF oficial del día en la CMF, UTM, Tasa de Política Monetaria TPM, tipo de cambio USD/CLP, e IPSA).

#### Ejemplo de Solicitud cURL
```bash
curl -X GET "https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/api-v1/data/macro" \
  -H "Authorization: Bearer demo_public_key" \
  -H "Accept: application/json"
```

#### Ejemplo de Respuesta JSON (200 OK)
```json
{
  "status": "ok",
  "source": "Animus Macroeconomic Intelligence (Multi-Provider)",
  "indicators": {
    "CMF_uf_diario": {
      "provider": "CMF",
      "indicator": "uf_diario",
      "fecha": "2026-05-23",
      "valor": 40475.55,
      "unidad": "CLP"
    },
    "SII_utm": {
      "provider": "SII",
      "indicator": "utm",
      "fecha": "2026-05-01",
      "valor": 68520,
      "unidad": "CLP"
    },
    "CMF_tpm": {
      "provider": "CMF",
      "indicator": "tpm",
      "fecha": "2026-05-01",
      "valor": 5.25,
      "unidad": "%"
    }
  },
  "metadata": {
    "total_records": 12,
    "last_sync": "2026-05-23T04:00:00Z"
  }
}
```

---

## 3. Grafo de Conocimiento MoE (Mixture of Experts)

### 3.1 POST `/intel/query`
Consulta en lenguaje natural a la red de 696 nodos de conocimiento macroeconómico, doctrina gubernamental y entidades chilenas.

#### Ejemplo de Solicitud cURL
```bash
curl -X POST "https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/api-v1/intel/query" \
  -H "Authorization: Bearer demo_public_key" \
  -H "Content-Type: application/json" \
  -d '{"query": "¿Cuál es la proyección de inflación y el impacto en la TPM de Chile?"}'
```

---

## 4. Búsqueda Semántica en Leyes y Normativas (Vector RAG)

### 4.1 POST `/rag/query`
Realiza una búsqueda semántica sobre leyes chilenas (como la Ley Fintech 21.521, regulaciones tributarias SII y normativa CMF), devolviendo una síntesis en formato Markdown acompañada de citas y referencias precisas.

#### Ejemplo de Solicitud cURL
```bash
curl -X POST "https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/api-v1/rag/query" \
  -H "Authorization: Bearer demo_public_key" \
  -H "Content-Type: application/json" \
  -d '{"query": "¿Qué requisitos impone la Ley Fintech 21.521 a los proveedores de iniciación de pagos?"}'
```

---

## 5. Inteligencia Gubernamental B2G (Mercado Público)

### 5.1 GET `/mercado-publico/licitaciones`
Devuelve el listado de licitaciones públicas B2G que se encuentran abiertas en Mercado Público en tiempo real, filtradas y valorizadas por el motor Animus.

#### Ejemplo de Solicitud cURL
```bash
curl -X GET "https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/api-v1/mercado-publico/licitaciones?limit=5" \
  -H "Authorization: Bearer demo_public_key"
```

### 5.2 GET `/mercado-publico/compra-agil`
Devuelve las oportunidades de Compra Ágil públicas activas en el portal de Mercado Público.

#### Ejemplo de Solicitud cURL
```bash
curl -X GET "https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/api-v1/mercado-publico/compra-agil?limit=5" \
  -H "Authorization: Bearer demo_public_key"
```

---

## 6. Monitoreo del Sistema & Salud del Clúster

### 6.1 GET `/health/services`
Devuelve el estado de salud en tiempo real (`status: green | yellow | red`, latencia en milisegundos y fecha de chequeo) de los 28 microservicios que componen Animus Engine.

#### Ejemplo de Solicitud cURL
```bash
curl -X GET "https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/api-v1/health/services" \
  -H "Authorization: Bearer demo_public_key"
```
