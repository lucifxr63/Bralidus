import {
  abrirCorridaSuprema,
  cerrarCorridaSuprema,
  ingerirSerieSuprema,
  type ResultadoSerieSuprema,
} from '../jobs/sync-pjud-suprema.job.js';

/**
 * Ingesta de las causas de la Corte Suprema — UN STEP POR SERIE.
 *
 * POR QUÉ SE PARTIÓ
 * -----------------
 * La primera versión hacía las tres series en un solo step. Funcionó para 2025
 * (124.245 filas) y SE CORTÓ con 2024 (164.553): inventario e ingresos entraron
 * completos y `terminos_suprema_detalle` quedó en CERO, sin error visible — el
 * step simplemente se quedó sin los 300 s de la función.
 *
 * Peor que perder la serie: el log quedaba a medias y la cuadratura no llegaba a
 * ejecutarse, así que la ingesta parecía haber terminado.
 *
 * En un durable workflow cada `'use step'` es una invocación aparte CON SU
 * PROPIO techo de 300 s. Una serie por step le da a la más grande (95.075 filas
 * en 2024, 243.775 en 2023) un presupuesto entero para ella sola.
 *
 * DETERMINISMO
 * ------------
 * El año y la lista de series se resuelven DENTRO de `abrirCorridaSuprema`, no
 * en el cuerpo del workflow: ese cuerpo tiene que poder reproducirse paso a paso
 * y `new Date()` ahí adentro lo rompe. Ya pasó con `env` en el workflow del
 * enrich — el build falla sin decir por qué.
 */

async function abrirStep(anio?: number) {
  'use step';
  return await abrirCorridaSuprema(anio);
}

async function serieStep(serie: string, anio: number): Promise<ResultadoSerieSuprema> {
  'use step';
  return await ingerirSerieSuprema(serie, anio);
}
// Sin reintento automático: el upsert es idempotente y la próxima corrida
// reingiere el año entero. Reintentar acá sólo repite una descarga de 36 MB.
serieStep.maxRetries = 1;

async function cerrarStep(logId: string, anio: number, resultados: ResultadoSerieSuprema[]) {
  'use step';
  await cerrarCorridaSuprema(logId, anio, resultados);
}

export async function syncPjudSupremaWorkflow(opts?: { anio?: number }): Promise<unknown> {
  'use workflow';

  const plan = await abrirStep(opts?.anio);
  if (!plan.logId) return { done: false, motivo: 'ya habia una corrida en curso' };

  const resultados: ResultadoSerieSuprema[] = [];
  for (const serie of plan.series) {
    resultados.push(await serieStep(serie, plan.anio));
  }

  await cerrarStep(plan.logId, plan.anio, resultados);

  return {
    done: true,
    anio: plan.anio,
    escritas: resultados.reduce((a, r) => a + r.escritas, 0),
  };
}
