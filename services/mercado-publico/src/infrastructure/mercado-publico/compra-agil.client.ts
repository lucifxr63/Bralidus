import { env } from '../../app/env.js';
import { logger } from '../logging/logger.js';
import { AppError } from '../../shared/errors/app-error.js';
import { createHttpClient, isHttpError, type HttpClient } from '../http/http-client.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { sendOpsAlert } from '../ops-alert/ops-alert.js';
import type {
  CompraAgilDetalle,
  CompraAgilEnvelope,
  CompraAgilListPayload,
} from './compra-agil.types.js';

/**
 * Cliente de la API Compra Ágil v2 (`api2.mercadopublico.cl`).
 *
 * Se mantiene separado de `mercado-publico.client.ts` a propósito: distinto
 * host, distinta autenticación (header vs query param), distinto envelope y
 * distinta semántica del 429. Compartir el cliente v1 obligaría a llenarlo de
 * condicionales por endpoint.
 */

const maxRetries = (): number => (env.NODE_ENV === 'test' ? 0 : 3);
const RETRY_DELAY_MS = 2000;

/** `tamano_pagina` admitido. El mínimo de 10 no está en la guía: sale del 400. */
export const PAGE_SIZE_MIN = 10;
export const PAGE_SIZE_MAX = 50;

export interface ListCompraAgilParams {
  /**
   * Grupo 1 — VENTANA DE CAMBIOS. Obligatoria: sin `ttlCambioMs` o
   * `cambioDesde`+`cambioHasta` la API responde 400, incluso si se envían
   * `publicadoDesde`/`publicadoHasta`. Verificado contra producción.
   */
  cambioDesde?: string;
  cambioHasta?: string;
  ttlCambioMs?: number;
  /** Grupo 2 — ventana de publicación (se intersecta con la de cambios). */
  publicadoDesde?: string;
  publicadoHasta?: string;
  /** Grupo 3 — estados; vacío = todos. */
  estados?: string[];
  /** Grupo 4 — códigos de región 1..16. */
  regiones?: number[];
  numeroPagina?: number;
  tamanoPagina?: number;
  ordenarPor?: 'FechaUltimaModificacion' | 'FechaPublicacion';
}

/** La cuota diaria se agotó: reintentar hoy no sirve, se resetea a medianoche. */
export function isQuotaExhausted(err: unknown): boolean {
  return err instanceof AppError && err.code === 'RATE_LIMITED';
}

class CompraAgilClient {
  private _http: HttpClient | null = null;
  private _ticket: string | null = null;
  private readonly _breakers = new Map<string, CircuitBreaker>();

  private get http(): HttpClient {
    return (this._http ??= createHttpClient(env.COMPRA_AGIL_BASE_URL, 60_000));
  }

  /** Mismo ticket que la API v1 — verificado: `api2` lo acepta tal cual. */
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

  async list(params: ListCompraAgilParams): Promise<CompraAgilListPayload> {
    const query = buildListQuery(params);
    const payload = await this.get<CompraAgilListPayload>('v2/compra-agil', query);
    // payload nulo con success OK no debería pasar, pero no vale la pena reventar
    return payload ?? { items: [], paginacion: emptyPaginacion() };
  }

  async getByCodigo(codigo: string): Promise<CompraAgilDetalle> {
    const payload = await this.get<CompraAgilDetalle>(
      `v2/compra-agil/${encodeURIComponent(codigo)}`,
      {},
      'v2/compra-agil/{codigo}',
    );
    if (!payload) throw AppError.notFound('Compra Ágil', codigo);
    return payload;
  }

  // ── Private ──────────────────────────────────────────────

  /**
   * @param breakerKey path lógico para el circuit breaker — el detalle usa una
   * URL distinta por código, así que se agrupa bajo una sola clave.
   */
  private async get<T>(
    path: string,
    params: Record<string, string>,
    breakerKey = path,
  ): Promise<T | null> {
    const breaker = this.breakerFor(breakerKey);
    if (!breaker.canRequest()) {
      throw AppError.externalApiError(
        `API Compra Ágil no disponible (circuit breaker abierto) — ${breakerKey}`,
        { circuit: 'open' },
      );
    }

    let lastError: unknown;
    const MAX_RETRIES = maxRetries();

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      try {
        const body = await this.http.get<CompraAgilEnvelope<T>>(path, {
          params,
          headers: { ticket: this.ticket },
        });
        breaker.recordSuccess();
        return unwrap(body, breakerKey);
      } catch (err) {
        lastError = err;

        // Cuota diaria agotada: NO reintentar. Según la guía oficial se
        // restablece recién al cambiar el día calendario, así que un backoff
        // solo quema tiempo y deja el resto de la corrida igual de muerta.
        if (isQuotaExhausted(err)) {
          logger.error({ path }, 'API Compra Ágil: cuota diaria agotada');
          void sendOpsAlert({
            level: 'error',
            title: 'Cuota diaria de la API Compra Ágil agotada',
            detail:
              'La API respondió 429. La cuota se restablece al inicio del próximo día calendario; el sync se detiene hasta entonces.',
            dedupeKey: 'compra-agil-quota-exhausted',
          });
          throw err;
        }

        const status = isHttpError(err) && err.status > 0 ? err.status : undefined;
        logger.error(
          { path, status, msg: err instanceof Error ? err.message : String(err) },
          'API Compra Ágil error',
        );

        // 4xx que no son 429: error de cliente, reintentar no cambia nada.
        if (status != null && status >= 400 && status < 500) break;
        if (err instanceof AppError && err.code !== 'EXTERNAL_API_ERROR') break;

        if (attempt <= MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * attempt);
        }
      }
    }

    if (lastError !== undefined) {
      const status = isHttpError(lastError) && lastError.status > 0 ? lastError.status : undefined;
      // Solo cuenta como "API no saludable" lo que no es culpa del request.
      const unhealthy = status == null || status >= 500;
      if (unhealthy && breaker.recordFailure()) {
        const cooldownS = Math.round(env.MP_CIRCUIT_COOLDOWN_MS / 1000);
        void sendOpsAlert({
          level: 'error',
          title: `Circuit breaker de la API Compra Ágil ABIERTO — ${breakerKey}`,
          detail: `Falló ${env.MP_CIRCUIT_FAILURE_THRESHOLD} veces seguidas — cortando requests por ${cooldownS}s.`,
          dedupeKey: `compra-agil-circuit-open:${breakerKey}`,
        });
      }
    }

    if (lastError instanceof AppError) throw lastError;
    throw AppError.externalApiError(`API Compra Ágil falló en ${breakerKey}`, extractDetail(lastError));
  }
}

// ── Helpers ─────────────────────────────────────────────────

function unwrap<T>(body: CompraAgilEnvelope<T>, path: string): T | null {
  if (body?.success === 'NOK') {
    const first = body.errors?.[0];
    const codigo = first?.codigo ?? 'desconocido';
    const mensaje = first?.mensaje ?? 'Error sin detalle';

    if (codigo === '429') throw AppError.tooManyRequests(`Compra Ágil: ${mensaje}`);
    if (codigo === '404') throw AppError.notFound('Compra Ágil');
    if (codigo === '401' || codigo === '403') {
      throw AppError.externalApiError(`Compra Ágil: ticket rechazado (${codigo}) — ${mensaje}`);
    }
    throw AppError.externalApiError(`Compra Ágil ${codigo} en ${path}: ${mensaje}`, {
      codigo,
      detalle: first?.detalle ?? null,
    });
  }
  return body?.payload ?? null;
}

function buildListQuery(params: ListCompraAgilParams): Record<string, string> {
  const q: Record<string, string> = {};

  if (params.ttlCambioMs != null) q['ttl_cambio_ms'] = String(params.ttlCambioMs);
  if (params.cambioDesde) q['cambio_desde'] = params.cambioDesde;
  if (params.cambioHasta) q['cambio_hasta'] = params.cambioHasta;
  if (params.publicadoDesde) q['publicado_desde'] = params.publicadoDesde;
  if (params.publicadoHasta) q['publicado_hasta'] = params.publicadoHasta;
  if (params.estados && params.estados.length > 0) q['estado'] = params.estados.join(',');
  if (params.regiones && params.regiones.length > 0) q['region'] = params.regiones.join(',');
  if (params.numeroPagina != null) q['numero_pagina'] = String(params.numeroPagina);
  if (params.tamanoPagina != null) {
    q['tamano_pagina'] = String(clampPageSize(params.tamanoPagina));
  }
  if (params.ordenarPor) q['ordenar_por'] = params.ordenarPor;

  return q;
}

export function clampPageSize(size: number): number {
  return Math.min(PAGE_SIZE_MAX, Math.max(PAGE_SIZE_MIN, Math.trunc(size)));
}

function emptyPaginacion(): CompraAgilListPayload['paginacion'] {
  return { total_paginas: 0, numero_pagina: 1, tamano_pagina: 0, total_resultados: 0 };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractDetail(err: unknown): Record<string, unknown> {
  if (isHttpError(err)) return { status: err.status, data: err.data, message: err.message };
  return { message: String(err) };
}

export const compraAgilClient = new CompraAgilClient();
