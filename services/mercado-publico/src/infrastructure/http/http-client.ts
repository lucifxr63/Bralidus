/**
 * Cliente HTTP mínimo sobre fetch nativo (reemplaza axios).
 * fetch existe en Node >= 18 y en Cloudflare Workers — mismo código en ambos.
 */

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly data: unknown,
    message: string,
    readonly url?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function isHttpError(err: unknown): err is HttpError {
  return err instanceof HttpError;
}

export interface RequestOptions {
  params?: Record<string, string>;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export class HttpClient {
  constructor(
    private readonly baseURL: string,
    private readonly defaultTimeoutMs = 10_000,
  ) {}

  async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  async post<T>(path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  private async request<T>(
    method: string,
    path: string,
    body: unknown,
    options: RequestOptions,
  ): Promise<T> {
    const url = new URL(
      path.replace(/^\//, ''),
      this.baseURL.endsWith('/') ? this.baseURL : `${this.baseURL}/`,
    );
    for (const [k, v] of Object.entries(options.params ?? {})) {
      url.searchParams.set(k, v);
    }

    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined && { 'Content-Type': 'application/json' }),
          ...options.headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      // Timeout (TimeoutError) o fallo de red — sin status HTTP
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpError(0, null, `${method} ${url.pathname} failed: ${message}`, url.toString());
    }

    const text = await res.text();
    let data: unknown = text;
    try {
      data = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      /* respuesta no-JSON: se conserva el texto crudo */
    }

    if (!res.ok) {
      throw new HttpError(
        res.status,
        data,
        `${method} ${url.pathname} responded ${res.status}`,
        url.toString(),
      );
    }

    return data as T;
  }
}

export function createHttpClient(baseURL: string, timeoutMs = 10_000): HttpClient {
  return new HttpClient(baseURL, timeoutMs);
}
