/**
 * Clasificadores puros de `enrich-ordenes`.
 *
 * Viven aparte del job por una razón práctica: el job importa `env`, el logger y
 * los repositorios, así que importarlo desde un test arrastra toda esa cadena y
 * el runner nativo no la resuelve. Acá la única dependencia es `AppError`, que
 * no importa nada.
 *
 * Es el mismo criterio que ya seguían `run-status` y `window-split`: la decisión
 * se separa del efecto para poder fijarla con una aserción. Y la razón por la
 * que este módulo NO importa nada —ni siquiera `AppError`— es que el runner
 * nativo corre los `.ts` sin resolver los imports con extensión `.js` que usa
 * el resto del servicio; los otros dos módulos con test también tienen cero
 * imports, y no es casualidad.
 *
 * De ahí que los predicados miren la FORMA del error en vez de su clase. No
 * pierde la protección del `instanceof AppError` que había antes: un `Error`
 * pelado no tiene `details`, así que cae igual en `false`.
 */

/** Lee `err.details` sin asumir de qué clase es el error. */
function detalles(err: unknown): Record<string, unknown> | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const d = (err as { details?: unknown }).details;
  return typeof d === 'object' && d !== null ? (d as Record<string, unknown>) : undefined;
}

/**
 * True si el error viene de que MP nos está frenando (429), no de la fila.
 * El cliente preserva el status en `details.httpStatus`.
 */
export function esThrottling(err: unknown): boolean {
  return detalles(err)?.httpStatus === 429;
}

/**
 * El cliente cortó los reintentos porque al job se le acabó el presupuesto de
 * tiempo.
 *
 * No es un fallo de la fila y no debe consumirle un intento, por la misma razón
 * que el 429: la OC sigue siendo perfectamente enriquecible y no tuvo nada que
 * ver. Cinco cortes de presupuesto sobre la misma fila la sacarían de la cola
 * para siempre.
 */
export function esAbortoPorTiempo(err: unknown): boolean {
  return detalles(err)?.aborted === true;
}

/**
 * Mercado Público respondió 2xx pero sin `Listado` — cuota diaria agotada o un
 * error suyo devuelto como éxito.
 *
 * ES LA MISMA FAMILIA QUE EL 429 Y HAY QUE TRATARLA IGUAL. La orden que se
 * estaba pidiendo no tiene nada de malo: no pudimos preguntar por ella. Hasta el
 * 2026-08-08 esto llegaba al job como `NOT_FOUND` —porque el cliente hacía
 * `raw.Listado?.[0]` sobre un cuerpo que ni siquiera traía `Listado`— y le
 * gastaba un intento. A 80 por corrida y 5 intentos cada una, dejó 1.608
 * órdenes buenas fuera de la cola para siempre.
 */
export function esFuenteSinRespuesta(err: unknown): boolean {
  const d = detalles(err);
  return d?.sinListado === true || d?.cuotaAgotada === true;
}

export type EnrichmentOutcome = 'enriched' | 'still_incomplete' | 'not_found';

/**
 * Clasifica el resultado de intentar enriquecer una OC:
 *  - not_found:        MP no devolvió detalle (raw = null / NOT_FOUND)
 *  - enriched:         el detalle trajo proveedor (supplierCode o supplierRut)
 *  - still_incomplete: hubo detalle pero sigue sin proveedor
 */
export function classifyEnrichment(
  detail: { supplierCode: string | null; supplierRut?: string | null } | null,
): EnrichmentOutcome {
  if (detail == null) return 'not_found';
  if (detail.supplierCode != null || detail.supplierRut != null) return 'enriched';
  return 'still_incomplete';
}
