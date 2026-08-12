import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseFechaChile } from './chile-time.ts';

/**
 * Corre con el runner nativo: `npm test`.
 *
 * Estos tests fijan el arreglo del desfase que dejó ~47.900 de 59.932 filas de
 * `licitaciones_mercado_publico` con la hora corrida 3–4 horas, incluidas
 * 2.111 de las 2.115 licitaciones abiertas. La causa era `new Date(str)` sobre
 * un timestamp sin zona, que resuelve contra la zona DEL PROCESO.
 */

// ── Hora de Chile, con horario de verano ────────────────────────────────────
//
// Los offsets no se eligieron: se midieron contra las fichas ya guardadas. El
// desglose por mes calzaba exactamente con el DST chileno, y eso fue lo que
// confirmó el diagnóstico.

test('invierno austral: mayo va en UTC-4', () => {
  // Cierre real de 4429-45-L126, la ficha con la que el integrador reportó.
  assert.equal(parseFechaChile('2026-05-14T17:57:00'), '2026-05-14T21:57:00.000Z');
});

test('verano austral: enero va en UTC-3', () => {
  assert.equal(parseFechaChile('2026-01-15T10:00:00'), '2026-01-15T13:00:00.000Z');
});

test('el formato corto de la API v2 se trata igual que el largo de la v1', () => {
  // Julio = invierno = UTC-4. Antes esto se pegaba una "Z" y quedaba 4 h corrido.
  assert.equal(parseFechaChile('2026-07-29 12:00'), '2026-07-29T16:00:00.000Z');
});

test('un ISO con zona explícita se respeta tal cual', () => {
  // La v2 mezcla ambos formatos en el mismo objeto. Este ya es inequívoco.
  assert.equal(parseFechaChile('2026-07-25T23:35:00.907Z'), '2026-07-25T23:35:00.907Z');
});

test('un offset explícito distinto de Z tampoco se re-interpreta', () => {
  assert.equal(parseFechaChile('2026-07-25T23:35:00-04:00'), '2026-07-26T03:35:00.000Z');
});

test('los milisegundos no se pierden', () => {
  // MP los manda en publicación: "2026-05-06T15:44:41.973".
  assert.equal(parseFechaChile('2026-05-06T15:44:41.973'), '2026-05-06T19:44:41.973Z');
});

// ── Valores que MP manda y no son fechas ────────────────────────────────────

test('nulo, vacío y basura dan null, no una fecha inventada', () => {
  for (const v of [null, undefined, '', '   ', 'no aplica']) {
    assert.equal(parseFechaChile(v), null, `debería ser null: ${JSON.stringify(v)}`);
  }
});

// ── La regresión de verdad ──────────────────────────────────────────────────

/**
 * El bug no era una fecha mal calculada: era la MISMA fecha dando resultados
 * distintos según dónde corriera el proceso. Local (Santiago) y Vercel (UTC)
 * escribían valores distintos en la misma columna.
 *
 * Un test dentro de un solo proceso no puede probar esto —hereda una sola TZ—,
 * así que el archivo se re-ejecuta a sí mismo bajo tres zonas y compara. El
 * `if` de abajo es la rama que corre en el hijo.
 */
const MUESTRAS = [
  '2026-05-14T17:57:00', // invierno
  '2026-01-15T10:00:00', // verano
  '2026-07-29 12:00', // formato corto
  '2026-07-25T23:35:00.907Z', // con zona
];

if (process.env.CHILE_TIME_PROBE) {
  process.stdout.write(JSON.stringify(MUESTRAS.map((s) => parseFechaChile(s))));
  process.exit(0);
}

test('el resultado no depende de la zona horaria del proceso', () => {
  const esteArchivo = fileURLToPath(import.meta.url);

  const bajo = (tz: string) =>
    execFileSync(process.execPath, [esteArchivo], {
      env: { ...process.env, TZ: tz, CHILE_TIME_PROBE: '1' },
      encoding: 'utf8',
    }).trim();

  const santiago = bajo('America/Santiago');
  const utc = bajo('UTC');
  const tokio = bajo('Asia/Tokyo');

  assert.equal(utc, santiago, 'UTC (Vercel) y Santiago (local) deben coincidir');
  assert.equal(tokio, santiago, 'ninguna zona del runtime debe cambiar el resultado');

  // Y el valor correcto, no sólo consistente: tres convenios iguales entre sí
  // pero todos equivocados también pasarían la comparación de arriba.
  assert.deepEqual(JSON.parse(santiago), [
    '2026-05-14T21:57:00.000Z',
    '2026-01-15T13:00:00.000Z',
    '2026-07-29T16:00:00.000Z',
    '2026-07-25T23:35:00.907Z',
  ]);
});
