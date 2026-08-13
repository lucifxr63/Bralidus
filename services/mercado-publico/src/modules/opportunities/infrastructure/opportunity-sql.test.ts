import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SQL } from './opportunity-sql.ts';

/**
 * Corre con el runner nativo: `node --test src/**\/*.test.ts`.
 *
 * Este archivo NO prueba lógica: prueba una forma de escribir SQL que el
 * typecheck no ve y que sólo revienta contra el motor, en producción.
 */

// ── Lo que este archivo existe para impedir ──────────────────

/**
 * Aritmética entre dos parámetros sin tipo.
 *
 * El 2026-08-12 se agregó `LIMIT GREATEST($1 - $3, 1)`. Por el protocolo
 * extendido los parámetros llegan como `unknown`, y Postgres no tiene un '-'
 * preferido entre dos `unknown`: aborta la consulta ENTERA con
 * `operator is not unique: unknown - unknown`. Reproducido contra producción.
 *
 * Lo peligroso es lo silencioso que fue: `tsc` no mira dentro del string, la
 * consulta se validó a mano en psql —donde los números son literales tipados y
 * funciona— y el job pasó a fallar en cada corrida con 0 encontradas y 0 s de
 * duración. El síntoma no se parecía en nada a un problema de tipos.
 *
 * Ojo con el contraste: `($2 || ' days')::interval`, en la misma consulta, SÍ
 * funciona sin cast — para '||' Postgres prefiere la categoría string y resuelve
 * a text. Por eso la regla es sobre los operadores aritméticos y no sobre todo
 * parámetro.
 */
const PARAMS_EN_ARITMETICA = /\$\d+(::\w+)?\s*[-+*/%]\s*\$\d+(::\w+)?/g;

test('ningún parámetro entra sin cast a una operación aritmética', () => {
  for (const [nombre, sql] of Object.entries(SQL)) {
    for (const [expr] of sql.matchAll(PARAMS_EN_ARITMETICA)) {
      assert.ok(
        expr.split(/[-+*/%]/).every((lado) => lado.includes('::')),
        `${nombre}: "${expr.trim()}" opera entre parámetros sin tipo. ` +
          `Postgres lo rechaza con "operator is not unique: unknown - unknown". ` +
          `Castear ambos lados (p. ej. $1::int - $3::int).`,
      );
    }
  }
});

test('el cupo reservado del refresh conserva sus casts', () => {
  // La consulta puede reordenarse; lo que no puede es volver a quedar sin tipo.
  assert.match(SQL.FIND_REFRESH_CANDIDATES, /GREATEST\(\$1::int\s*-\s*\$3::int,\s*1\)/);
});
