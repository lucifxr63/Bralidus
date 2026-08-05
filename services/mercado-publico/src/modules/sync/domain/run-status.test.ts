import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveRunStatus, runFailureRate } from './run-status.ts';

/**
 * Corre con el runner nativo: `node --test src/**\/*.test.ts`.
 * Sin framework a propósito — el servicio no tiene uno y `run-status` es lógica
 * pura, así que no vale traer una dependencia para tres aserciones.
 */

// ── Lo que este archivo existe para impedir ──────────────────

test('una corrida vacía NO es una corrida exitosa', () => {
  // El bug: `attempted === 0` devolvía 'success' con el comentario "no había
  // nada que hacer". El 2026-08-01 09:50 sync-compra-agil cerró así, en verde,
  // con total_found = 0. Nadie se enteró.
  assert.notEqual(deriveRunStatus({ succeeded: 0, failed: 0, found: 0 }), 'success');
  assert.equal(deriveRunStatus({ succeeded: 0, failed: 0, found: 0 }), 'empty');
});

test('sin `found` reportado se conserva el comportamiento viejo', () => {
  // Los otros cuatro jobs todavía no reportan `found`. Que no se les reescriba
  // el significado del estado de un saque.
  assert.equal(deriveRunStatus({ succeeded: 0, failed: 0 }), 'success');
});

test('encontrar cosas y procesarlas todas bien sigue siendo success', () => {
  assert.equal(deriveRunStatus({ succeeded: 50, failed: 0, found: 50 }), 'success');
});

// ── Lo que ya estaba y no se debe romper ─────────────────────

test('un 504 suelto de MP no degrada una corrida sana', () => {
  // 249 aciertos y 1 fallo cerraban en 'partial'. Si lo normal es 'partial', el
  // estado deja de significar algo.
  assert.equal(deriveRunStatus({ succeeded: 249, failed: 1, found: 250 }), 'success');
});

test('desde el 50% de fallos la corrida está fallida', () => {
  assert.equal(deriveRunStatus({ succeeded: 5, failed: 5, found: 10 }), 'failed');
});

test('entre el ruido tolerado y el 50% queda parcial', () => {
  assert.equal(deriveRunStatus({ succeeded: 80, failed: 20, found: 100 }), 'partial');
});

test('una corrida cortada a mitad es parcial aunque no haya fallado nada', () => {
  assert.equal(deriveRunStatus({ succeeded: 100, failed: 0, aborted: true, found: 500 }), 'partial');
});

test('abortada gana sobre vacía: se cortó, no es que no hubiera nada', () => {
  assert.equal(deriveRunStatus({ succeeded: 0, failed: 0, aborted: true, found: 0 }), 'partial');
});

test('runFailureRate no divide por cero', () => {
  assert.equal(runFailureRate({ succeeded: 0, failed: 0 }), 0);
});
