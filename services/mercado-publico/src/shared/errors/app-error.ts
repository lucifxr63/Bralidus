export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'EXTERNAL_API_ERROR'
  | 'LLM_ERROR'
  | 'DATABASE_ERROR'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number,
    details?: unknown,
    isOperational = true,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }

  static notFound(resource: string, id?: string): AppError {
    const msg = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    return new AppError(msg, 'NOT_FOUND', 404);
  }

  static validationError(message: string, details?: unknown): AppError {
    return new AppError(message, 'VALIDATION_ERROR', 400, details);
  }

  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError(message, 'UNAUTHORIZED', 401);
  }

  static forbidden(message = 'Forbidden'): AppError {
    return new AppError(message, 'FORBIDDEN', 403);
  }

  static conflict(message: string): AppError {
    return new AppError(message, 'CONFLICT', 409);
  }

  static tooManyRequests(message = 'Too many requests'): AppError {
    return new AppError(message, 'RATE_LIMITED', 429);
  }

  static externalApiError(message: string, details?: unknown): AppError {
    return new AppError(message, 'EXTERNAL_API_ERROR', 502, details);
  }

  static llmError(message: string, details?: unknown): AppError {
    return new AppError(message, 'LLM_ERROR', 502, details);
  }

  static internal(message = 'Internal server error'): AppError {
    return new AppError(message, 'INTERNAL_ERROR', 500, undefined, false);
  }

  /** Falla de infraestructura (DB/Hyperdrive caída, timeout, cuota agotada). 503, no 401 —
   *  el cliente no hizo nada mal, debe reintentar. */
  static databaseError(message = 'Database temporarily unavailable', details?: unknown): AppError {
    return new AppError(message, 'DATABASE_ERROR', 503, details, false);
  }
}
