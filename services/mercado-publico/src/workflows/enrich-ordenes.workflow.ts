import { runEnrichOrdenesJob } from '../jobs/enrich-ordenes.job.js';

/**
 * Pasadas encadenadas por disparo.
 *
 * Constante y no `env`: el cuerpo de un `'use workflow'` tiene que ser
 * determinista para poder reproducirse paso a paso, y leer configuración ahí
 * adentro significa que un cambio de variable entre reintentos cambiaría la
 * cantidad de iteraciones de una corrida ya empezada.
 *
 * 10 x ENRICH_OC_MAX_ITEMS (90) = 900 OCs por disparo. Con el cron cada 2 h son
 * ~10.800 por día: la cola de 78.556 se vacía en alrededor de una semana.
 */
const MAX_PASADAS = 10;

/**
 * Enriquecimiento de OCs como Workflow propio, ENCADENANDO VARIAS PASADAS.
 *
 * POR QUÉ EXISTE
 * --------------
 * `enrich-ordenes` sólo corría encadenado al final de `sync-ordenes`, o sea una
 * vez al día. Con el tope por pasada (ENRICH_OC_MAX_ITEMS) eso pone un techo
 * duro al drenaje de la cola.
 *
 * POR QUÉ AHORA SON VARIAS PASADAS
 * --------------------------------
 * Medido el 2026-07-31: 78.731 OCs pendientes, 100 por pasada. Con una pasada
 * por disparo son 787 disparos — a uno por día, más de dos años. El tope de 100
 * no lo pone Mercado Público sino el límite de 300 s de la función: 100 ítems ×
 * 2,5 s de ritmo ≈ 250 s, y ahí se acaba el presupuesto.
 *
 * En un durable workflow cada `'use step'` es una invocación aparte, con SU
 * propio presupuesto de 300 s. Encadenar N pasadas multiplica por N lo que se
 * drena por disparo sin acercarse al límite en ninguna.
 *
 * CUÁNDO CORTA LA CADENA
 * ----------------------
 * No encadena a ciegas. Se detiene si:
 *   - la cola quedó vacía (`candidates === 0`)
 *   - MP frenó con 429 (`throttled > 0`) — insistir sólo suma 429s, y la cola
 *     queda intacta porque el throttling no consume intentos
 *   - la pasada se salteó o reventó (`skipped`)
 *
 * Ese corte es lo que hace que subir ENRICH_OC_MAX_SLICES sea seguro: el techo
 * real lo pone la API, no la configuración.
 */

interface ResultadoPasada {
  candidates: number;
  enriched: number;
  throttled: number;
  skipped: boolean;
}

async function enrichStep(): Promise<ResultadoPasada> {
  'use step';
  const stats = await runEnrichOrdenesJob();
  return {
    candidates: stats.candidates,
    enriched: stats.enriched,
    throttled: stats.throttled,
    skipped: stats.skipped,
  };
}
// 1 reintento: si MP está saturado, el job ya corta solo por 429 y la próxima
// corrida retoma la cola intacta. Insistir acá sólo sumaría 429s.
enrichStep.maxRetries = 1;

export async function enrichOrdenesWorkflow(): Promise<unknown> {
  'use workflow';

  let enriquecidas = 0;
  let pasadas = 0;
  let motivo = 'se agotaron las pasadas del disparo';

  for (let i = 0; i < MAX_PASADAS; i++) {
    const r = await enrichStep();
    pasadas++;
    enriquecidas += r.enriched;

    if (r.skipped) {
      motivo = 'la pasada se salteó o falló';
      break;
    }
    if (r.candidates === 0) {
      motivo = 'la cola quedó vacía';
      break;
    }
    if (r.throttled > 0) {
      motivo = 'MP frenó con 429 — la cola queda intacta';
      break;
    }
  }

  // Sin logger acá a propósito: importar pino en el módulo del workflow hace
  // que el bundler de workflows arrastre `@opentelemetry/api`, que no está
  // instalado, y el build de nitro falla con UNRESOLVED_IMPORT. El workflow es
  // orquestación pura; cada pasada ya loguea lo suyo dentro del step.
  return { done: true, pasadas, enriquecidas, motivo };
}
