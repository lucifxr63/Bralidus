import type { NormalizedAttachment } from './mercado-publico.types.js';

/**
 * Traducción pura de los `documents` de OCDS al vocabulario de adjuntos.
 *
 * Va en su propio módulo, separado de `ocds.client.ts`, porque el cliente
 * importa el HttpClient en runtime y eso impide cargarlo desde el runner de
 * tests nativo. Acá sólo hay una importación de TIPO, que el stripper elimina.
 */

/** Sólo lo que se usa; el release OCDS trae bastante más. */
export interface OcdsDocumento {
  id?: string;
  documentType?: string;
  title?: string;
  description?: string;
  url?: string;
  format?: string;
}

export const ROTULO_POR_DEFECTO = 'Documentos del proceso en Mercado Público';

/**
 * Un proceso con varias adjudicaciones repite el MISMO enlace en cada una (el
 * `enc` apunta al proceso, no al lote), así que se deduplica por URL para no
 * guardar tres veces la misma página.
 */
export function mapDocumentosOcds(
  docs: OcdsDocumento[],
  obtenidoAt = new Date().toISOString(),
): NormalizedAttachment[] {
  const vistas = new Set<string>();

  return docs.reduce<NormalizedAttachment[]>((acc, d) => {
    if (!d?.url || vistas.has(d.url)) return acc;
    vistas.add(d.url);
    acc.push({
      id: d.id ?? null,
      nombre: limpiar(d.title) ?? ROTULO_POR_DEFECTO,
      url: d.url,
      // NO es un archivo: es la página que los lista, y detrás hay un
      // reCAPTCHA Enterprise. Rotularlo como adjunto sería prometer una
      // descarga que no existe.
      tipo: 'pagina',
      origen: 'ocds_award',
      descargable: false,
      obtenido_at: obtenidoAt,
    });
    return acc;
  }, []);
}

/**
 * OCDS devuelve los textos en latin-1 mal etiquetado ("PÃ¡gina"), así que un
 * título puede llegar con caracteres rotos o en blanco.
 */
function limpiar(v: string | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}
