/**
 * Estado final de una corrida de ingesta, derivado de sus contadores.
 *
 * POR QUÉ EXISTE
 * --------------
 * Cinco jobs repetían la misma expresión inline:
 *
 *   aborted ? 'partial' : failed === 0 ? 'success' : succeeded === 0 ? 'failed' : 'partial'
 *
 * O sea: UN solo fallo bastaba para degradar la corrida a 'partial'. Con las
 * APIs de Mercado Público eso es demasiado estricto — devuelven 504 de forma
 * rutinaria en el endpoint de detalle. El 2026-07-29, sync-compra-agil cerró
 * en 'partial' con 249 aciertos y 1 fallo: una corrida sana reportada como
 * degradada.
 *
 * Importa más de lo que parece desde que cada corrida se reporta al canal de
 * ops: si lo normal es 'partial', el estado deja de significar algo y se
 * vuelve ruido que se aprende a ignorar — que es justo lo que no queremos
 * después de tres días de ingesta caída sin que nadie lo notara.
 */

export type RunStatus = 'success' | 'partial' | 'failed' | 'empty';

/**
 * Fracción de fallos que se atribuye a inestabilidad del upstream y NO degrada
 * la corrida. 5% sobre lotes de cientos de items tolera los 504 sueltos de MP
 * sin tapar una degradación real.
 */
export const UPSTREAM_NOISE_TOLERANCE = 0.05;

/** Desde esta fracción de fallos, la corrida se considera fallida. */
export const FAILURE_RATE_THRESHOLD = 0.5;

export interface RunCounters {
  succeeded: number;
  failed: number;
  /** El job se cortó antes de terminar (abort pedido, cuota agotada, …). */
  aborted?: boolean;
  /**
   * Cuántos procesos dijo la fuente que había. Distingue "no había nada que
   * hacer" de "no encontramos nada" — ver la nota de `deriveRunStatus`.
   * Omitirlo conserva el comportamiento viejo para los jobs que no lo reportan.
   */
  found?: number;
}

export function runFailureRate({ succeeded, failed }: RunCounters): number {
  const attempted = succeeded + failed;
  return attempted > 0 ? failed / attempted : 0;
}

export function deriveRunStatus(counters: RunCounters): RunStatus {
  // Cortada a mitad: el dato quedó incompleto a propósito, sin importar cuántos
  // items alcanzó a procesar bien.
  if (counters.aborted) return 'partial';

  const attempted = counters.succeeded + counters.failed;

  // UNA CORRIDA VACÍA NO ES UNA CORRIDA EXITOSA.
  //
  // Esto devolvía 'success' con el comentario "no había nada que hacer". Es
  // cierto para un feriado sin publicaciones, y falso para el caso que importa:
  // pedimos y volvimos con las manos vacías. Los dos casos son indistinguibles
  // por los contadores de procesamiento, así que colapsarlos en 'success'
  // convierte la falta de resultados en un dato — la misma clase de fallo
  // silencioso que tuvo cuatro extractores de Bralidus muertos durante meses.
  //
  // `found` desempata: es lo que la fuente dijo que había. Si el job lo
  // reporta, una corrida sin nada es 'empty' y se puede vigilar (tres 'empty'
  // seguidas alertan). Si no lo reporta, se conserva el comportamiento viejo
  // para no reescribir el historial de los otros cuatro jobs de un saque.
  if (attempted === 0) {
    return counters.found === undefined ? 'success' : 'empty';
  }

  const rate = runFailureRate(counters);
  if (rate === 0) return 'success';
  if (rate >= FAILURE_RATE_THRESHOLD) return 'failed';
  if (rate <= UPSTREAM_NOISE_TOLERANCE) return 'success';
  return 'partial';
}
