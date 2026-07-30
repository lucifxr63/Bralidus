/**
 * Registro de salud de los webhooks de alerting.
 *
 * POR QUÉ EXISTE
 * --------------
 * `sendOpsAlert` nunca lanza: si Discord rechaza el envío, loguea y sigue. Es
 * lo correcto —un fallo de alerting no debe romper el flujo que lo emitió— pero
 * deja un agujero: un webhook revocado falla para siempre en silencio.
 *
 * Y el canal de `latido` es el que más sufre, porque su valor está en que el
 * SILENCIO signifique algo. Con el webhook muerto, un canal sano y una ingesta
 * detenida se ven exactamente igual.
 *
 * Acá se deja constancia en base de cada intento. La base pasa a ser la fuente
 * de verdad sobre la salud del alerting, independiente del alerting mismo — que
 * es la única forma de que un canal muerto pueda llegar a reportarse.
 *
 * CONTRATO
 * --------
 * Nada de este módulo lanza ni bloquea. Si registrar falla, se pierde el
 * registro y ya: sería absurdo que el medidor de fallos rompa lo que mide.
 */

import { bralidusQuery } from '../database/client/pg-client.js';
import { logger } from '../logging/logger.js';

const SERVICIO = 'mp-sync';

/**
 * Deja constancia del resultado de un envío. Fire-and-forget a propósito: el
 * llamador no espera y no se entera si falla.
 *
 * @param canal   canal lógico del aviso (incidentes, latido, …)
 * @param ok      si Discord aceptó el envío
 * @param error   status HTTP o mensaje. 401/404 = webhook revocado o reescrito.
 */
export function registrarEnvioWebhook(canal: string, ok: boolean, error?: string): void {
  void bralidusQuery('select public.registrar_envio_webhook($1, $2, $3, $4)', [
    SERVICIO,
    canal,
    ok,
    error ?? null,
  ]).catch((err: unknown) => {
    // A propósito `debug` y no `warn`: si la base no está disponible ya hay
    // ruido de sobra en otros lados, y este es el menos importante.
    logger.debug({ err, canal }, '[webhook-health] no se pudo registrar el envío');
  });
}

/**
 * Elige por dónde avisar que un canal se cayó.
 *
 * El problema de fondo: un canal muerto no puede reportarse a sí mismo. Si el
 * webhook de `latido` está revocado, mandar "latido está caído" a `latido` es
 * exactamente igual a no mandar nada.
 *
 * Se recorre una lista por prioridad y se devuelve el primero que NO esté en la
 * lista de caídos. `incidentes` primero porque es el canal que se mira cuando
 * algo anda mal.
 *
 * Devuelve `undefined` si están todos caídos — ahí no hay nada que hacer por
 * Discord, y la tabla en base queda como único registro. Que es justamente la
 * razón de que exista la tabla.
 */
export function canalSanoPara(caidos: readonly string[]): string | undefined {
  const porPrioridad = ['incidentes', 'latido', 'frescura', 'degradacion'];
  return porPrioridad.find((c) => !caidos.includes(c));
}

export interface CanalCaido {
  servicio: string;
  canal: string;
  fallos_consecutivos: number;
  ultimo_error: string | null;
  ultimo_exito: Date | null;
  nunca_funciono: boolean;
}

/**
 * Canales con al menos un fallo desde su último éxito, de TODOS los servicios
 * (mp-sync, edge-functions, bralidus): la URL de un canal puede quedar
 * desactualizada en un solo panel al rotarla, y ese es justo el caso que hay
 * que ver.
 *
 * Devuelve `[]` si la consulta falla — el reporte que la usa no debe caerse por
 * no poder leer esta tabla.
 */
export async function canalesCaidos(): Promise<CanalCaido[]> {
  try {
    return await bralidusQuery<CanalCaido>(
      `select servicio, canal, fallos_consecutivos, ultimo_error, ultimo_exito, nunca_funciono
         from public.ops_webhook_caidos
        order by nunca_funciono desc, fallos_consecutivos desc`,
    );
  } catch (err) {
    logger.warn({ err }, '[webhook-health] no se pudo leer ops_webhook_caidos');
    return [];
  }
}
