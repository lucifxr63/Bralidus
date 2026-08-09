import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  esThrottling,
  esAbortoPorTiempo,
  esFuenteSinRespuesta,
  classifyEnrichment,
} from './enrich-ordenes.classify.ts';

/**
 * Corre con el runner nativo: `npm test`.
 *
 * Lo que este archivo existe para impedir
 * ---------------------------------------
 * Que un corte por PRESUPUESTO DE TIEMPO se cuente como fallo de la fila.
 *
 * `enrich-ordenes` recorre ítems con un reloj, pero sólo puede mirarlo ENTRE
 * ítems: un ítem puede quedarse hasta ~70 s adentro del bucle de reintentos del
 * cliente (5 intentos × 10 s de timeout + 20 s de backoff). Por eso el cliente
 * recibe un `shouldAbort` y corta.
 *
 * El detalle que importa es qué pasa DESPUÉS de cortar. Si ese corte llegara al
 * job como un error cualquiera, la fila sumaría un `enrichment_attempts` sin
 * tener culpa de nada — y a los cinco cortes quedaría excluida para siempre de
 * la cola. Es exactamente el razonamiento que ya estaba escrito para el 429, y
 * la razón por la que el aborto tiene que ser distinguible.
 */

// Se construyen a mano y no con AppError: este módulo se prueba SIN imports
// (ver la nota en enrich-ordenes.classify.ts). La forma es la que produce
// `AppError.externalApiError(mensaje, detalles)`.
const conDetalles = (details: Record<string, unknown>): Error =>
  Object.assign(new Error('error de MP'), { details });

const abortado = conDetalles({ aborted: true });
const throttled = conDetalles({ httpStatus: 429 });
const fallaReal = conDetalles({ httpStatus: 500 });

test('un corte por presupuesto se reconoce como aborto', () => {
  assert.equal(esAbortoPorTiempo(abortado), true);
});

test('un aborto NO se confunde con throttling — se tratan distinto', () => {
  // El 429 corta la corrida y alerta a `degradacion`; el aborto sólo cierra la
  // pasada. Mezclarlos haría alertar por un cierre normal.
  assert.equal(esThrottling(abortado), false);
  assert.equal(esAbortoPorTiempo(throttled), false);
});

test('una falla real NO es un aborto — esa sí debe gastar intento', () => {
  // Sin esto, un 500 sostenido dejaría la fila reintentándose para siempre y
  // ocupando el presupuesto de todas las corridas siguientes.
  assert.equal(esAbortoPorTiempo(fallaReal), false);
  assert.equal(esThrottling(fallaReal), false);
});

test('un error que no es AppError no es ni aborto ni throttling', () => {
  assert.equal(esAbortoPorTiempo(new Error('boom')), false);
  assert.equal(esAbortoPorTiempo(undefined), false);
  assert.equal(esThrottling('texto suelto'), false);
});

// ── classifyEnrichment, que decide si la fila quedó completa ──

test('sin detalle es not_found', () => {
  assert.equal(classifyEnrichment(null), 'not_found');
});

test('con proveedor quedó enriquecida', () => {
  assert.equal(classifyEnrichment({ supplierCode: '76086428-5' }), 'enriched');
  assert.equal(classifyEnrichment({ supplierCode: null, supplierRut: '76086428-5' }), 'enriched');
});

test('con detalle pero sin proveedor sigue incompleta', () => {
  // Distinto de not_found: MP respondió, la OC existe, pero no trae proveedor.
  // Consume intento igual, porque volver a pedirla daría lo mismo.
  assert.equal(classifyEnrichment({ supplierCode: null, supplierRut: null }), 'still_incomplete');
});


// ── La cuota diaria de MP, que costó 1.608 órdenes ───────────

const cuotaAgotada = conDetalles({
  mpCodigo: 203,
  mpMensaje: 'Ticket superó la cuota diaria asignada.',
  cuotaAgotada: true,
  sinListado: true,
});

test('cuota diaria agotada se reconoce como fuente sin respuesta', () => {
  // Medido el 2026-08-08: MP devuelve HTTP 203 con {Codigo, Mensaje} y SIN
  // Listado. El cliente hacía `raw.Listado?.[0]` y lanzaba NOT_FOUND, así que
  // el job creía que la orden no existía y le gastaba un intento.
  assert.equal(esFuenteSinRespuesta(cuotaAgotada), true);
});

test('cuota agotada NO es un aborto por tiempo ni un 429', () => {
  // Cada uno corta la corrida por su motivo y con su mensaje; mezclarlos haría
  // ilegible el diagnóstico del próximo que mire los latidos.
  assert.equal(esAbortoPorTiempo(cuotaAgotada), false);
  assert.equal(esThrottling(cuotaAgotada), false);
});

test('un NOT_FOUND real NO se confunde con la fuente sin respuesta', () => {
  // Lo que distingue "esta orden no existe" de "no pudimos preguntar" es que la
  // segunda trae `sinListado`. Sin esa marca, una orden inexistente tiene que
  // seguir gastando su intento — si no, se reintenta para siempre.
  const noExiste = conDetalles({ httpStatus: 404 });
  assert.equal(esFuenteSinRespuesta(noExiste), false);
  assert.equal(esFuenteSinRespuesta(fallaReal), false);
});

test('sin Listado alcanza aunque no sea por cuota', () => {
  // Cualquier 2xx de MP que no traiga Listado es "no pudimos preguntar",
  // aunque el mensaje sea otro.
  assert.equal(esFuenteSinRespuesta(conDetalles({ sinListado: true })), true);
});
