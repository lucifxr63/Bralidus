import { describe, it, expect } from 'vitest';

/**
 * E2E contra la API de BralidusPY (api.animus.scouttech.lat).
 *
 * POR QUÉ SE REESCRIBIÓ ENTERO
 * ----------------------------
 * La versión anterior no podía fallar. Cada assertion aceptaba rangos enormes
 * —`expect([200, 401, 404]).toContain(res.status)`— y todo estaba envuelto en
 * try/catch terminando en `expect(e).toBeDefined()`. Con la API entera caída
 * pasaba igual, porque "no responde" también satisfacía la condición.
 *
 * El costo real: apuntaba a `/api/v1/data/economic`, `/api/v1/rag/query` y
 * `/api/v1/query/moe`, que en esta API devuelven 404 — son rutas del gateway
 * `api-v1` de Supabase, otro servicio. O sea que testeaba la API equivocada, y
 * el 404 estaba en la lista de aceptados. Además apuntaba a un host de Railway
 * dado de baja hace meses y nadie se enteró.
 *
 * REGLAS DE ESTE ARCHIVO
 * ----------------------
 * 1. Sin try/catch alrededor de los fetch. Si la red falla, el test falla —
 *    que es exactamente la señal que se quiere.
 * 2. Status exactos, no rangos. Un rango es una forma de no decidir qué se
 *    espera, y lo que no se decide no se verifica.
 * 3. Todo lo de acá corre SIN credenciales. La auth de BralidusPY es un único
 *    secreto compartido (BRALIDUS_API_KEY, comparado por igualdad exacta), no
 *    keys por usuario del portal: una key del portal da 403, no 200. Que el
 *    test no dependa de un secreto es una ventaja, no una limitación — el gate
 *    deja de ser opcional.
 */

const BASE_URL = process.env.VITE_BRALIDUS_API_URL ?? 'https://api.animus.scouttech.lat';

/** Serverless con arranque en frío: generoso, pero acotado. */
const TIMEOUT_MS = 30_000;

/** Servicios que, si están caídos, significan que la API no sirve para nada. */
const SERVICIOS_CRITICOS = ['supabase', 'openai'];

/** Intentos ante fallo de CONEXIÓN. No aplica a respuestas: un 500 falla y ya. */
const REINTENTOS = 3;

/**
 * Techo por test. Tiene que cubrir el peor caso CON reintentos
 * (3 × 30 s + 2 s + 4 s de espera), o el test muere antes de agotarlos y los
 * reintentos no sirven de nada.
 */
const TIMEOUT_POR_TEST = REINTENTOS * TIMEOUT_MS + 10_000;

/**
 * GET/POST con reintento SÓLO ante error de red.
 *
 * POR QUÉ: el 2026-08-03 estos 6 tests fallaron en CI con
 * `ConnectTimeoutError ... timeout: 10000ms` contra api.animus.scouttech.lat,
 * mientras el servicio estaba perfectamente sano. Dos causas sumadas:
 *
 *   1. `AbortSignal.timeout` acota la RESPUESTA, pero undici (el fetch de Node)
 *      tiene su propio timeout de CONEXIÓN de 10 s que ese signal no toca.
 *   2. El servicio es serverless: medido, el primer request tras un rato de
 *      inactividad tarda ~3,5 s y los siguientes 0,2 s. Con el runner de
 *      GitHub de por medio, un arranque en frío puede rozar ese techo.
 *
 * Reintentar sólo los errores de conexión conserva el valor del test: si el
 * servicio está caído de verdad, los 3 intentos fallan y el test falla. Lo que
 * se deja de reportar es un hipo de red como si fuera una API rota — que fue
 * exactamente lo que mando un aviso rojo a la sala de control por un sistema
 * que estaba bien.
 */
async function get(path: string, init?: RequestInit): Promise<Response> {
  let ultimo: unknown;
  for (let intento = 1; intento <= REINTENTOS; intento++) {
    try {
      return await fetch(`${BASE_URL}${path}`, {
        ...init,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      ultimo = err;
      // Espera creciente: si es un arranque en frío, el segundo intento ya
      // encuentra la función caliente.
      if (intento < REINTENTOS) await new Promise((r) => setTimeout(r, intento * 2000));
    }
  }
  throw new Error(
    `${path}: sin respuesta tras ${REINTENTOS} intentos — ${
      ultimo instanceof Error ? ultimo.message : String(ultimo)
    }`,
  );
}

describe('BralidusPY — disponibilidad', () => {
  it(
    'GET /ping responde 200 y se declara ok',
    async () => {
      const res = await get('/ping');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.status).toBe('ok');
    },
    TIMEOUT_POR_TEST,
  );

  it(
    'GET /health reporta los servicios críticos sanos',
    async () => {
      const res = await get('/health');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(Array.isArray(body.services)).toBe(true);
      expect(body.services.length).toBeGreaterThan(0);

      // Se afirma sobre los críticos y no sobre `status`: el agregado los trata
      // como núcleo y devuelve "ok" aunque una integración opcional esté caída.
      // Acá interesa el detalle, no el resumen.
      for (const nombre of SERVICIOS_CRITICOS) {
        const svc = body.services.find((s: { name: string }) => s.name === nombre);
        expect(svc, `el /health no reporta el servicio "${nombre}"`).toBeDefined();
        expect(svc.ok, `"${nombre}" está caído: ${svc?.detail}`).toBe(true);
      }
    },
    TIMEOUT_POR_TEST,
  );
});

describe('BralidusPY — la auth se aplica de verdad', () => {
  it(
    'POST /query sin Authorization devuelve 401',
    async () => {
      const res = await get('/query', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });

      // Exactamente 401. Si esto pasara a 200, la API quedó abierta.
      expect(res.status).toBe(401);
    },
    TIMEOUT_POR_TEST,
  );

  it(
    'POST /query con una key inválida devuelve 403, no 200',
    async () => {
      const res = await get('/query', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer key-deliberadamente-invalida-para-el-test',
        },
        body: JSON.stringify({}),
      });

      // La diferencia entre 401 y 403 es la que importa: 401 dice "falta la
      // credencial", 403 dice "la credencial se comparó y no sirve". Si esto
      // devolviera 401 estaríamos comprobando presencia y no validez; si
      // devolviera 200, la key no se estaría mirando.
      expect(res.status).toBe(403);
    },
    TIMEOUT_POR_TEST,
  );

  it(
    'GET /jobs/list está protegido',
    async () => {
      const res = await get('/jobs/list');
      expect(res.status).toBe(401);
    },
    TIMEOUT_POR_TEST,
  );
});

describe('BralidusPY — el contrato sigue siendo el que el portal documenta', () => {
  it(
    'el OpenAPI expone las rutas que el portal promete',
    async () => {
      const res = await get('/openapi.json');
      expect(res.status).toBe(200);

      const spec = await res.json();
      const rutas = Object.keys(spec.paths ?? {});

      // Si alguna desaparece, el portal queda documentando algo inexistente —
      // que es como llegamos a tener endpoints publicados devolviendo 503.
      for (const esperada of ['/health', '/query', '/query/moe', '/licitus/mercado/activas']) {
        expect(rutas, `desapareció la ruta ${esperada}`).toContain(esperada);
      }
    },
    TIMEOUT_POR_TEST,
  );
});
