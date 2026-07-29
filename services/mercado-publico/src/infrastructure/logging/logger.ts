import { env } from '../../app/env.js';

/**
 * Logger estructurado sobre console, con la misma superficie que usábamos de
 * pino (`logger.info({ obj }, 'msg')` / `logger.warn('msg')` / `child()`).
 *
 * Motivo del reemplazo: pino con transport `pino-pretty` usa worker_threads y
 * streams de Node — incompatible con Cloudflare Workers. console.log emite
 * JSON que Workers Logs indexa nativamente; en Node local sigue siendo JSON
 * legible por línea.
 */

const LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
export type LogLevel = (typeof LEVELS)[number];

// Lazy: env no puede leerse en scope de módulo en Workers (bindings recién
// disponibles al atender eventos). Se resuelve y memoiza en el primer log.
let activeLevelIndex: number | null = null;
function levelIndex(): number {
  if (activeLevelIndex === null) {
    const idx = LEVELS.indexOf(env.LOG_LEVEL);
    activeLevelIndex = idx === -1 ? LEVELS.indexOf('info') : idx;
  }
  return activeLevelIndex;
}

const REDACT_KEYS = new Set(['authorization', 'password', 'token', 'apikey', 'api_key']);

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (value instanceof Error) {
    return { type: value.name, message: value.message, stack: value.stack };
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACT_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : redact(v, depth + 1);
  }
  return out;
}

type LogFn = (objOrMsg?: unknown, msg?: string) => void;

export interface Logger {
  trace: LogFn;
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  fatal: LogFn;
  child(bindings: Record<string, unknown>): Logger;
}

function emit(
  level: LogLevel,
  bindings: Record<string, unknown>,
  objOrMsg?: unknown,
  msg?: string,
): void {
  if (LEVELS.indexOf(level) < levelIndex()) return;

  const entry: Record<string, unknown> = {
    level,
    time: new Date().toISOString(),
    service: env.APP_NAME,
    env: env.NODE_ENV,
    ...bindings,
  };

  if (typeof objOrMsg === 'string') {
    entry['msg'] = objOrMsg;
  } else if (objOrMsg !== undefined && objOrMsg !== null) {
    Object.assign(entry, redact(objOrMsg) as Record<string, unknown>);
    if (msg !== undefined) entry['msg'] = msg;
  } else if (msg !== undefined) {
    entry['msg'] = msg;
  }

  const line = JSON.stringify(entry);
  if (level === 'error' || level === 'fatal') {
    // eslint-disable-next-line no-console
    console.error(line);
  } else if (level === 'warn') {
    // eslint-disable-next-line no-console
    console.warn(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

function createLogger(bindings: Record<string, unknown> = {}): Logger {
  return {
    trace: (o, m) => emit('trace', bindings, o, m),
    debug: (o, m) => emit('debug', bindings, o, m),
    info: (o, m) => emit('info', bindings, o, m),
    warn: (o, m) => emit('warn', bindings, o, m),
    error: (o, m) => emit('error', bindings, o, m),
    fatal: (o, m) => emit('fatal', bindings, o, m),
    child: (extra) => createLogger({ ...bindings, ...extra }),
  };
}

export const logger: Logger = createLogger();
