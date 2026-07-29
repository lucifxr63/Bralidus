import { AppError } from '../../shared/errors/app-error.js';

export class MercadoPublicoNotFoundError extends AppError {
  constructor(resource: string, codigo: string) {
    super(`${resource} '${codigo}' not found in Mercado Público`, 'NOT_FOUND', 404);
  }
}

export class MercadoPublicoApiError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'EXTERNAL_API_ERROR', 502, details);
  }
}
