/**
 * Circuit breaker (Fase 2 del HARDENING_ROADMAP — resiliencia ante MP).
 *
 * Mercado Público es inestable (I3): sin esto, cuando MP está caído cada request
 * de una corrida (miles) hace el ciclo completo de reintentos → quema la corrida
 * y martilla a MP. El breaker corta rápido tras N fallas seguidas y reintenta
 * recién tras un cooldown. Máquina de estados pura, testeable con reloj inyectable.
 *
 * closed → (N fallas) → open → (cooldown) → half_open → (éxito) → closed
 *                                              └─ (falla) → open
 */

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerOptions {
  /** Fallas consecutivas para abrir el circuito. */
  failureThreshold: number;
  /** Cuánto permanece abierto antes de probar (ms). */
  cooldownMs: number;
  /** Reloj inyectable para tests. */
  now?: () => number;
}

export class CircuitBreaker {
  private failures = 0;
  private state: CircuitState = 'closed';
  private openedAt = 0;

  constructor(private readonly opts: CircuitBreakerOptions) {}

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  /** ¿Se permite el request? En open, deja pasar una prueba tras el cooldown. */
  canRequest(): boolean {
    if (this.state === 'open' && this.now() - this.openedAt >= this.opts.cooldownMs) {
      this.state = 'half_open';
    }
    return this.state !== 'open';
  }

  /** Éxito → cierra el circuito y resetea el conteo. */
  recordSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  /**
   * Falla que cuenta como "MP no saludable" (5xx/timeout/429, no 404).
   * Retorna true si ESTA falla ACABA de abrir el circuito (para alertar 1 vez).
   */
  recordFailure(): boolean {
    this.failures++;

    if (this.state === 'half_open') {
      // La prueba falló → re-abrir (ya se alertó al abrir la primera vez).
      this.state = 'open';
      this.openedAt = this.now();
      return false;
    }

    if (this.state === 'closed' && this.failures >= this.opts.failureThreshold) {
      this.state = 'open';
      this.openedAt = this.now();
      return true;
    }

    return false;
  }

  getState(): CircuitState {
    return this.state;
  }
}
