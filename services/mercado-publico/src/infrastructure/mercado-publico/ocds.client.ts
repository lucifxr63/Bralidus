import { createHttpClient, isHttpError, type HttpClient } from '../http/http-client.js';
import { logger } from '../logging/logger.js';
import type { NormalizedAttachment } from './mercado-publico.types.js';
import { mapDocumentosOcds, type OcdsDocumento } from './ocds.mapper.js';

/**
 * API OCDS de ChileCompra (Open Contracting Data Standard).
 *
 * QUÉ APORTA Y QUÉ NO — medido el 2026-08-11 contra licitaciones reales.
 *
 * Aporta un enlace profundo a la página de anexos del proceso, que la API v1 no
 * entrega por ningún lado. No aporta la lista de archivos: `documents` trae UNA
 * entrada genérica por adjudicación, con `format: "text/html"` y el título
 * "Página documentos del proceso de contratación". Nombre, tipo, tamaño y URL de
 * descarga de cada anexo NO están acá — el listado se pide por AJAX detrás de un
 * reCAPTCHA Enterprise, así que no se puede resolver desde el servidor.
 *
 * Cobertura: SÓLO procesos adjudicados. Probado sobre 5 licitaciones, el
 * endpoint `tender` dio 0 documentos en las 5 y `award` dio 1 en 3 de ellas. Una
 * licitación abierta —justo la que sirve para postular— no trae nada. Por eso
 * `fetchEnlaceAnexos` ni siquiera consulta cuando el proceso no está adjudicado:
 * sería gastar una llamada para recibir un release vacío.
 *
 * No pide ticket, así que no toca la cuota diaria de MP.
 */

const OCDS_BASE = 'https://api.mercadopublico.cl/APISOCDS/OCDS';

interface OcdsAwardResponse {
  releases?: Array<{
    awards?: Array<{ documents?: OcdsDocumento[] }>;
  }>;
}

let _http: HttpClient | null = null;
const http = () => (_http ??= createHttpClient(OCDS_BASE, 15_000));

/**
 * El `enc` de la URL se regenera en cada respuesta: dos llamadas seguidas al
 * mismo proceso devuelven enlaces distintos. Verificado que un enlace emitido
 * 12 minutos antes seguía sirviendo la página, así que no es un nonce de un solo
 * uso — pero no hay forma de saber su caducidad real sin observarla en el
 * tiempo. Por eso cada enlace viaja con la fecha en que se obtuvo: si algún día
 * empiezan a morir, el dato para detectarlo ya está guardado.
 */
export interface ResultadoAnexos {
  anexos: NormalizedAttachment[];
  /**
   * `false` = NO se pudo preguntar (429, timeout, 5xx). Distinto de preguntar y
   * que no haya documentos.
   *
   * La distinción no es cosmética: sin ella, el backfill de 5.850 licitaciones
   * reportó "22,8 % con enlace" cuando el dry-run de 30 había dado 93 % — la
   * diferencia eran 429 contados como ausencias. Es el mismo defecto que el
   * repo ya tenía documentado para la sonda de compra ágil: un error que llega
   * como "cero resultados" cierra la corrida en verde habiendo perdido todo.
   */
  consultado: boolean;
}

export async function fetchEnlaceAnexos(
  codigo: string,
  opts: { adjudicada: boolean },
): Promise<ResultadoAnexos> {
  if (!opts.adjudicada) return { anexos: [], consultado: true };

  try {
    const data = await http().get<OcdsAwardResponse>(
      `/award/${encodeURIComponent(codigo)}`,
    );

    const docs = (data.releases ?? [])
      .flatMap((r) => r.awards ?? [])
      .flatMap((a) => a.documents ?? [])
      .filter((d): d is OcdsDocumento & { url: string } => Boolean(d?.url));

    return { anexos: mapDocumentosOcds(docs), consultado: true };
  } catch (err) {
    // Aditivo: si OCDS no responde, la ingesta sigue. Es un enlace de más, no
    // un dato del que dependa la ficha. Pero el caller se entera.
    const status = isHttpError(err) ? err.status : undefined;
    logger.warn({ codigo, status, err: String(err) }, '[ocds] no se pudo consultar');
    return { anexos: [], consultado: false };
  }
}
