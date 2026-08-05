/**
 * Partir una ventana de tiempo en tramos que quepan bajo el techo de una API.
 *
 * POR QUÉ EXISTE
 * --------------
 * La API v2 de Compra Ágil tope `total_resultados` en 10.000 y **no lo dice**:
 * una ventana de 26 h y una de 72 h devuelven exactamente el mismo número, y la
 * página 201 responde `success: OK` con cero items en vez de un error. Como el
 * bucle de paginación corta en `offset >= found`, una ventana que en realidad
 * contiene 14.000 procesos termina ordenadamente habiendo ingerido 10.000 y
 * reporta éxito. Los 4.000 que faltan no aparecen en ningún contador.
 *
 * POR QUÉ NO ALCANZA UN TRAMO FIJO
 * --------------------------------
 * La actividad se concentra en horario hábil chileno. Medido el 2026-08-05 a las
 * 02:20 de Chile: 6 h → 18 resultados. La misma ventana de 6 h a media mañana
 * puede topar. Cualquier tamaño fijo es o demasiado chico de madrugada (decenas
 * de consultas para nada) o demasiado grande de día (trunca).
 *
 * CÓMO FUNCIONA
 * -------------
 * Búsqueda binaria sobre el tiempo: se pregunta cuántos hay en un tramo; si
 * llegó al techo, se parte al medio y se repite en cada mitad. Un tramo que
 * vuelve por debajo del techo es un tramo confiable.
 *
 * Es lógica pura: la consulta entra como dependencia (`contar`), así que se
 * puede probar sin red.
 */

export interface Tramo {
  /** ISO 8601. Inclusivo. */
  desde: string;
  /** ISO 8601. Inclusivo — ver la nota sobre bordes. */
  hasta: string;
  /** Lo que la fuente dijo que hay en este tramo. */
  estimado: number;
  /**
   * `true` si ni siquiera al mínimo subdivisible bajó del techo. El dato de ESTE
   * tramo va a quedar incompleto y hay que gritarlo, no tragárselo.
   */
  truncado: boolean;
}

export interface PartirOpciones {
  /** Techo de la fuente. Un tramo que lo alcanza es sospechoso, no confiable. */
  cap: number;
  /**
   * Piso de subdivisión. Por debajo de esto no se parte más: se acepta el tramo
   * marcado como truncado. Evita una recursión que se hunde hasta milisegundos
   * contra una fuente que devuelve el techo por un bug suyo.
   */
  minMs: number;
  /**
   * Tope de consultas de sondeo. Cada sondeo gasta cuota diaria, así que la
   * exploración tiene que estar acotada aunque el árbol se desequilibre.
   */
  maxSondeos: number;
}

export const PARTIR_DEFAULTS: PartirOpciones = {
  cap: 10_000,
  // 15 min. Para topar el techo en 15 minutos harían falta ~11 cambios por
  // segundo sostenidos, que no es un volumen plausible en compras públicas
  // chilenas. Si pasa, es un problema de la fuente y hay que verlo, no partirlo.
  minMs: 15 * 60_000,
  maxSondeos: 60,
};

export interface ResultadoParticion {
  tramos: Tramo[];
  /** Consultas de sondeo gastadas. Sirve para vigilar el costo en cuota. */
  sondeos: number;
  /** Se acabó el presupuesto de sondeos antes de terminar de explorar. */
  incompleto: boolean;
}

/**
 * Parte `[desde, hasta]` en tramos que no alcancen el techo.
 *
 * @param contar Devuelve cuántos resultados hay en un tramo. Típicamente una
 *   consulta con `tamano_pagina` mínimo leyendo `paginacion.total_resultados`.
 *
 * SOBRE LOS BORDES: los tramos comparten el instante de corte (el `hasta` de uno
 * es el `desde` del siguiente). Si la API trata ambos extremos como inclusivos,
 * un proceso que cambió exactamente en ese instante se ingiere dos veces — y el
 * upsert es idempotente, así que no pasa nada. La alternativa, restar un
 * milisegundo, abre un hueco por el que ese proceso no se ingiere NUNCA. Ante la
 * duda, se prefiere repetir antes que perder.
 */
export async function partirVentana(
  desde: Date,
  hasta: Date,
  contar: (desde: Date, hasta: Date) => Promise<number>,
  opciones: Partial<PartirOpciones> = {},
): Promise<ResultadoParticion> {
  const { cap, minMs, maxSondeos } = { ...PARTIR_DEFAULTS, ...opciones };
  const tramos: Tramo[] = [];
  let sondeos = 0;
  let incompleto = false;

  // Pila explícita en vez de recursión: el orden de los tramos queda cronológico
  // y no hay riesgo de pisar el stack con una ventana muy desequilibrada.
  const pendientes: Array<[Date, Date]> = [[desde, hasta]];

  while (pendientes.length > 0) {
    if (sondeos >= maxSondeos) {
      incompleto = true;
      break;
    }

    const [a, b] = pendientes.pop()!;
    const n = await contar(a, b);
    sondeos++;

    if (n < cap) {
      // Un tramo vacío no aporta nada al sync y sí gasta una corrida de
      // paginación. Se descarta acá para que la madrugada no genere ruido.
      if (n > 0) {
        tramos.push({ desde: a.toISOString(), hasta: b.toISOString(), estimado: n, truncado: false });
      }
      continue;
    }

    const duracion = b.getTime() - a.getTime();
    if (duracion <= minMs) {
      tramos.push({ desde: a.toISOString(), hasta: b.toISOString(), estimado: n, truncado: true });
      continue;
    }

    const medio = new Date(a.getTime() + Math.floor(duracion / 2));
    // Se apila el tardío primero para que al desapilar salga el temprano: los
    // tramos quedan en orden cronológico sin tener que ordenarlos después.
    pendientes.push([medio, b]);
    pendientes.push([a, medio]);
  }

  return { tramos, sondeos, incompleto };
}

/** Suma de lo que se espera ingerir. Para comparar contra lo realmente ingerido. */
export function totalEstimado(tramos: Tramo[]): number {
  return tramos.reduce((acc, t) => acc + t.estimado, 0);
}

/** Tramos que van a quedar incompletos pase lo que pase. */
export function tramosTruncados(tramos: Tramo[]): Tramo[] {
  return tramos.filter((t) => t.truncado);
}
