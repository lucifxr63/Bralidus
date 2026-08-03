/**
 * Cliente de la API estadística del Poder Judicial.
 *
 * Fuente: https://estadisticaservices.pjud.cl — pública, SIN autenticación.
 * Auditoría completa de la fuente en docs/PJUD_API_HALLAZGOS.md.
 *
 * DOS COSAS QUE NO SE DEDUCEN DE LA ESPECIFICACIÓN
 * ------------------------------------------------
 * 1. Los parámetros `corte`, `tribunal` y `competencia` son DECORATIVOS.
 *    Verificado el 2026-07-30 comparando respuestas byte a byte: 7 valores
 *    distintos de `corte` devuelven el mismo payload. Sólo `anio` influye.
 *    Por eso los helpers de acá piden únicamente el año.
 *
 * 2. Sólo 37 de los 137 endpoints devuelven datos. El resto viene vacío (76),
 *    responde 500 (14, la familia "Quantum" de su BI interno) o trae
 *    `[{key:"OTROS",value:0}]` (8). No hay forma de saberlo desde el swagger,
 *    que no documenta absolutamente nada.
 *
 * El cliente nunca lanza por serie: devuelve `null` y el job decide. Una fuente
 * pública que se cae no debe tumbar la corrida entera.
 */

import { logger } from '../logging/logger.js';

const BASE = 'https://estadisticaservices.pjud.cl';
const TIMEOUT_MS = 30_000;

/**
 * Intervalo entre requests. No se observó rate limit en ~300 requests a 200 ms,
 * pero es infraestructura pública y algunas respuestas pesan varios MB.
 */
export const PJUD_DELAY_MS = 400;

/**
 * Techo para las series `_detalle`, que son de otro orden que el resto.
 *
 * Medido: `terminos_suprema_detalle/1/2024` son 36,5 MB. Desde una conexión
 * doméstica baja en 5 s, pero desde la función serverless bajarlo Y parsearlo
 * no entraba en los 30 s de `TIMEOUT_MS`: la lectura se abortaba a mitad y
 * `res.json()` fallaba. 2025 sí había entrado porque su serie de términos es
 * casi la mitad — el corte estaba justo entre un año y el otro.
 *
 * 120 s deja margen para 2023, que es la más grande (243.775 filas).
 */
export const PJUD_DETALLE_TIMEOUT_MS = 120_000;

/** Fila cruda: la API no normaliza sus formas, así que se acepta cualquiera. */
export type FilaPjud = Record<string, unknown>;

export interface SeriePjud {
  /** Identificador estable de la serie — es la ruta sin parámetros. */
  serie: string;
  /** Ruta concreta a consultar. */
  path: string;
  /** Si la serie es por año; false para las de Cuenta Pública sin parámetros. */
  porAnio: boolean;
}

/**
 * Series que se ingieren, elegidas del inventario por valor y por costo.
 *
 * Se dejan FUERA a propósito los `_detalle` de la Corte Suprema: devuelven
 * hasta 95.075 filas por año en un solo JSON y merecen su propia tabla e
 * ingesta paginada, no esta.
 */
export function seriesAIngerir(anio: number): SeriePjud[] {
  const porAnio = (p: string): SeriePjud => ({
    serie: p.replace(/\/1\/\d{4}$/, '').replace(/^\//, ''),
    path: p,
    porAnio: true,
  });

  return [
    // ── Cuenta Pública: nacional, año contra año, sin parámetros ────────────
    { serie: 'cuenta-publica/ingresos-causas', path: '/cuenta-publica/ingresos-causas', porAnio: false },
    { serie: 'cuenta-publica/terminos-causas', path: '/cuenta-publica/terminos-causas', porAnio: false },
    { serie: 'cuenta-publica/tramitacion-causas', path: '/cuenta-publica/tramitacion-causas', porAnio: false },
    // La única con desglose territorial: trae 17 filas, una por región.
    { serie: 'cuenta-publica/terminos-cortes', path: '/cuenta-publica/terminos-cortes', porAnio: false },

    // ── Corte Suprema: agregados (los _detalle quedan fuera, ver arriba) ────
    porAnio(`/pjen/duracion_causas_suprema/1/${anio}`),
    porAnio(`/pjen/ingresos_recursos_suprema/1/${anio}`),
    porAnio(`/pjen/terminos_suprema/1/${anio}`),
    porAnio(`/pjen/inventario_suprema/1/${anio}`),

    // ── El PJUD como comprador público: cruza con Mercado Público ───────────
    porAnio(`/pjen/adquisiciones/1/${anio}`),
    porAnio(`/pjen/presupuesto/1/${anio}`),
    porAnio(`/pjen/ejecucion/1/${anio}`),
  ];
}

/**
 * Series `_detalle` de la Corte Suprema: causa por causa, no agregados.
 *
 * Van aparte de `seriesAIngerir` porque su destino es otra tabla
 * (`pjud_suprema_detalle`) y su volumen es de otro orden. Medido el 2026-07-31
 * para el año 2024:
 *
 *   inventario_suprema_detalle         7.469 filas ·  2,2 MB · 0,4 s
 *   ingresos_recursos_suprema_detalle 62.009 filas · 21,1 MB · 3,0 s
 *   terminos_suprema_detalle          95.075 filas · 36,5 MB · 5,3 s
 *
 * `terminos_sala_suprema_detalle` NO está en la lista a propósito: devuelve un
 * payload IDÉNTICO byte a byte al de `terminos_suprema_detalle` (mismo SHA256).
 * No es el mismo dato desglosado por sala como sugiere la documentación de la
 * fuente: es el mismo endpoint con otro nombre. Incluirla serían 95.075 filas
 * duplicadas por año.
 */
export function seriesSupremaDetalle(anio: number): SeriePjud[] {
  const det = (nombre: string): SeriePjud => ({
    serie: nombre,
    path: `/pjen/${nombre}/1/${anio}`,
    porAnio: true,
  });

  return [
    det('inventario_suprema_detalle'),
    det('ingresos_recursos_suprema_detalle'),
    det('terminos_suprema_detalle'),
  ];
}

/**
 * Devuelve las filas de una serie, o null si la fuente falló.
 *
 * @param timeoutMs techo propio. Las series `_detalle` pesan hasta 36 MB y
 *        `TIMEOUT_MS` (30 s) no alcanza para bajarlas Y parsearlas desde una
 *        función serverless — ver el porqué abajo.
 */
export async function fetchSerie(
  path: string,
  timeoutMs: number = TIMEOUT_MS,
): Promise<FilaPjud[] | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      logger.warn({ path, status: res.status }, '[pjud] respuesta no-OK');
      return null;
    }

    // El parseo va con su propio catch para poder DISTINGUIR "no se pudo leer
    // el JSON" de "vino algo que no es un arreglo".
    //
    // La version anterior hacia `.catch(() => null)` y despues logueaba
    // `typeof data`. Como `typeof null === 'object'`, un parseo fallido se
    // reportaba como "payload no es un arreglo" con tipo "object" — mandó a
    // buscar el problema en la forma del dato cuando en realidad la respuesta
    // nunca terminó de leerse. Costó una hora de diagnóstico equivocado sobre
    // terminos_suprema_detalle/2024.
    let data: unknown;
    try {
      data = await res.json();
    } catch (err) {
      logger.warn(
        { path, err, timeoutMs },
        '[pjud] no se pudo leer el JSON (respuesta cortada o timeout durante la descarga)',
      );
      return null;
    }

    if (!Array.isArray(data)) {
      logger.warn(
        { path, tipo: typeof data, claves: data && typeof data === 'object' ? Object.keys(data).slice(0, 5) : null },
        '[pjud] la fuente devolvió algo que no es un arreglo',
      );
      return null;
    }
    return data as FilaPjud[];
  } catch (err) {
    logger.warn({ path, err, timeoutMs }, '[pjud] fallo de red');
    return null;
  }
}

/**
 * ¿La serie trajo dato útil?
 *
 * La API responde 200 con `[]` o con `[{key:"OTROS",value:0}]` cuando no tiene
 * nada. Tratar eso como éxito haría que una serie que dejó de publicarse pase
 * inadvertida, que es justo lo que no queremos.
 */
export function tieneDatos(filas: FilaPjud[] | null): boolean {
  if (!filas || filas.length === 0) return false;
  if (filas.length === 1) {
    const f = filas[0]!;
    const v = Number(f['value'] ?? f['MONTO'] ?? f['Anio_actual']);
    if (String(f['key'] ?? '').toUpperCase() === 'OTROS' && (v === 0 || Number.isNaN(v))) {
      return false;
    }
  }
  return true;
}
