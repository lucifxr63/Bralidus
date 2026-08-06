import { env } from '../../app/env.js';
import { logger } from '../logging/logger.js';
import { AppError } from '../../shared/errors/app-error.js';
import { createHttpClient, isHttpError, type HttpClient } from '../http/http-client.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { sendOpsAlert } from '../ops-alert/ops-alert.js';
import type { MpApiResponse, MpLicitacionRaw, MpOrdenCompraRaw } from './mercado-publico.types.js';

// Lazy: env no puede leerse en scope de módulo en Workers.
const maxRetries = (): number => (env.NODE_ENV === 'test' ? 0 : 4);
const RETRY_DELAY_MS = 2000;
const RATE_LIMIT_DELAY_MS = 5000; // 429: esperar más antes de reintentar

class MercadoPublicoClient {
  private _http: HttpClient | null = null;
  private _ticket: string | null = null;
  // Un breaker POR endpoint (path): si el detalle de OC se cae pero
  // licitaciones.json responde, abrir un breaker no debe bloquear al otro.
  private readonly _breakers = new Map<string, CircuitBreaker>();

  private get http(): HttpClient {
    return (this._http ??= createHttpClient(env.MERCADO_PUBLICO_BASE_URL, 30_000));
  }

  private get ticket(): string {
    return (this._ticket ??= env.MERCADO_PUBLICO_TICKET);
  }

  private breakerFor(path: string): CircuitBreaker {
    let breaker = this._breakers.get(path);
    if (!breaker) {
      breaker = new CircuitBreaker({
        failureThreshold: env.MP_CIRCUIT_FAILURE_THRESHOLD,
        cooldownMs: env.MP_CIRCUIT_COOLDOWN_MS,
      });
      this._breakers.set(path, breaker);
    }
    return breaker;
  }

  async getLicitacionByCodigo(
    codigo: string,
    shouldAbort?: () => boolean,
  ): Promise<MpLicitacionRaw> {
    const raw = await this.get<MpApiResponse<MpLicitacionRaw>>(
      'publico/licitaciones.json',
      {
        codigo,
        ticket: this.ticket,
      },
      env.SYNC_ITEM_TIMEOUT_MS,
      shouldAbort,
    );

    const item = raw.Listado?.[0];
    if (!item) throw AppError.notFound('Licitación', codigo);
    return item;
  }

  /**
   * Busca licitaciones publicadas en una fecha específica (formato DDMMAAAA).
   * Retorna el MpApiResponse completo para que el caller pueda leer Cantidad
   * y paginar hasta agotar todos los resultados.
   */
  async getLicitacionesByFecha(fecha: string, pagina = 1): Promise<MpApiResponse<MpLicitacionRaw>> {
    return this.get<MpApiResponse<MpLicitacionRaw>>(
      'publico/licitaciones.json',
      {
        fecha,
        pagina: String(pagina),
        ticket: this.ticket,
      },
      60_000,
    ); // 60s — MP puede ser lento para fechas con muchas licitaciones
  }

  /**
   * Busca órdenes de compra aceptadas en una fecha específica (formato DDMMAAAA).
   */
  async getOrdenesCompraByFecha(
    fecha: string,
    pagina = 1,
  ): Promise<MpApiResponse<MpOrdenCompraRaw>> {
    return this.get<MpApiResponse<MpOrdenCompraRaw>>(
      'publico/ordenesdecompra.json',
      {
        fecha,
        pagina: String(pagina),
        ticket: this.ticket,
      },
      60_000,
    ); // MP puede ser muy lento para OC
  }

  /**
   * `shouldAbort` no es decorativo: sin él, un ítem lento puede consumir hasta
   * ~70 s dentro del bucle de reintentos (5 intentos × 10 s de timeout + 20 s
   * de backoff acumulado). El job que llama tiene un presupuesto de reloj, pero
   * sólo puede mirarlo ENTRE ítems — así que un ítem que arranca a los 249 s de
   * un presupuesto de 250 s termina pasado el techo de 300 s de la función, y
   * la pasada muere sin llamar a `complete()`.
   *
   * Eso es exactamente lo que dejaba huérfanas a `enrich-ordenes`: la corrida
   * quedaba en 'running', `clearStaleRunning` la marcaba `failed` horas después
   * sin excepción que leer, y en un workflow encadenado con `maxRetries = 1` se
   * llevaba puestas las pasadas que venían detrás.
   *
   * `getLicitacionByCodigo` ya recibía el gancho; este camino nunca se cableó.
   */
  async getOrdenCompraByCodigo(
    codigo: string,
    shouldAbort?: () => boolean,
  ): Promise<MpOrdenCompraRaw> {
    // OJO: el detalle usa el MISMO endpoint que el listado, con ?codigo=.
    // 'publico/OrdenCompra.json' no existe (404) — bug que dejó OC en cero.
    const raw = await this.get<MpApiResponse<MpOrdenCompraRaw>>(
      'publico/ordenesdecompra.json',
      {
        codigo,
        ticket: this.ticket,
      },
      undefined,
      shouldAbort,
    );

    const item = raw.Listado?.[0];
    if (!item) throw AppError.notFound('Orden de Compra', codigo);
    return item;
  }

  // ── Private ────────────────────────────────────────────────

  private async get<T>(
    path: string,
    params: Record<string, string>,
    timeoutMs?: number,
    shouldAbort?: () => boolean,
  ): Promise<T> {
    // Circuit breaker POR endpoint: si este path viene fallando, cortar rápido
    // en vez de reintentar miles de requests contra un servicio caído — sin
    // afectar a los otros endpoints de MP.
    const breaker = this.breakerFor(path);
    if (!breaker.canRequest()) {
      throw AppError.externalApiError(`Mercado Público no disponible (circuit breaker abierto) — ${path}`, {
        circuit: 'open',
      });
    }

    let lastError: unknown;
    const MAX_RETRIES = maxRetries();

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      // Skip retries immediately if abort was requested
      if (shouldAbort?.()) break;

      try {
        logger.debug({ url: path, params: { ...params, ticket: '[REDACTED]' } }, 'MP API →');
        const data = await this.http.get<T>(path, { params, timeoutMs });
        logger.debug({ url: path }, 'MP API ←');
        breaker.recordSuccess();
        return data;
      } catch (err) {
        lastError = err;
        const status = isHttpError(err) && err.status > 0 ? err.status : undefined;
        logger.error({ url: path, status, msg: err instanceof Error ? err.message : String(err) }, 'MP API error');

        // 429 = peticiones simultáneas detectadas — reintentar con backoff largo
        if (status === 429) {
          if (shouldAbort?.()) break;
          if (attempt <= MAX_RETRIES) {
            const delay = RATE_LIMIT_DELAY_MS * attempt;
            logger.warn({ attempt, path, delay }, 'MP API rate limited (429) — backing off');
            await sleep(delay);
          }
          continue;
        }

        // No reintentar otros 4xx (errores de cliente)
        if (status != null && status >= 400 && status < 500) break;
        if (err instanceof AppError) break;
        if (shouldAbort?.()) break;

        if (attempt <= MAX_RETRIES) {
          logger.warn({ attempt, path, status }, 'MP API retry');
          await sleep(RETRY_DELAY_MS * attempt);
        }
      }
    }

    // Registrar la falla en el breaker solo si es "MP no saludable"
    // (timeout/red, 5xx o 429) y no un abort ni un 4xx normal (p. ej. 404).
    if (lastError !== undefined && !shouldAbort?.()) {
      const status = isHttpError(lastError) && lastError.status > 0 ? lastError.status : undefined;
      const mpUnhealthy = status == null || status >= 500 || status === 429;
      if (mpUnhealthy && breaker.recordFailure()) {
        const cooldownS = Math.round(env.MP_CIRCUIT_COOLDOWN_MS / 1000);
        void sendOpsAlert({
          level: 'error',
          title: `Circuit breaker de Mercado Público ABIERTO — ${path}`,
          detail: `MP (${path}) falló ${env.MP_CIRCUIT_FAILURE_THRESHOLD} veces seguidas — cortando requests por ${cooldownS}s.`,
          // Dedupe por endpoint: cada breaker (uno por path) alerta por su cuenta.
          dedupeKey: `mp-circuit-open:${path}`,
        });
      }
    }

    // Un ABORTO no es un fallo de la fila: al caller se le acabó el presupuesto
    // de reloj y cortó, nada más. Se marca distinto para que el job no lo cuente
    // como fallo ni le gaste un intento a la fila — si lo hiciera, 5 cortes de
    // presupuesto la excluirían para siempre de una cola de la que nunca tuvo la
    // culpa. Es el mismo razonamiento que ya se aplicaba al 429.
    if (shouldAbort?.()) {
      throw AppError.externalApiError(`Abortado por presupuesto de tiempo — ${path}`, {
        aborted: true,
      });
    }

    if (lastError instanceof AppError) throw lastError;
    // `httpStatus` en los detalles: sin él el llamador no puede distinguir un
    // 429 (throttling — la fila SÍ es enriquecible, sólo hay que ir más lento)
    // de un fallo real. enrich-ordenes lo necesita para no gastar un intento
    // de los 5 disponibles en filas que sólo fueron rechazadas por ritmo.
    const finalStatus = isHttpError(lastError) && lastError.status > 0 ? lastError.status : undefined;
    throw AppError.externalApiError(`Mercado Público API failed for ${path}`, {
      ...(extractDetail(lastError) as Record<string, unknown> | undefined),
      httpStatus: finalStatus,
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractDetail(err: unknown): Record<string, unknown> {
  if (isHttpError(err)) {
    return { status: err.status, data: err.data, message: err.message };
  }
  return { message: String(err) };
}

export const mercadoPublicoClient = new MercadoPublicoClient();
