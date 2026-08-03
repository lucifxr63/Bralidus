/**
 * Puente PJUD → GraphRAG: nodos de jurisprudencia para el grafo de conocimiento.
 *
 * EL PROBLEMA
 * -----------
 * `knowledge_nodes` tiene ~70 nodos sobre normativa chilena (Ley 21.521 Fintech,
 * 21.719 Datos, 21.663 Ciberseguridad, Karin 21.643): QUÉ DICE la ley. Y
 * `pjud_suprema_detalle` tiene 1.706.941 causas de la Corte Suprema: CÓMO SE
 * APLICA. Estaban completamente desconectadas — el experto legal del MoE podía
 * citar la ley y no sabía nada de cómo falla la Corte.
 *
 * SÍNTESIS, NO VOLCADO
 * --------------------
 * La tentación es indexar las causas. Sería un error: 1,7 millones de nodos
 * cuestan una fortuna en embeddings, y ninguna consulta se responde mejor
 * recuperando una causa suelta entre un millón. Nadie pregunta "¿qué pasó con el
 * rol 251723?"; preguntan "¿cómo le va a un recurso de protección en la
 * Suprema?".
 *
 * Se generan ~25 nodos AGREGADOS con la serie histórica de cada tipo de recurso
 * y de cada sala. Cada uno es un párrafo citable con cifras verificables, que es
 * exactamente lo que un RAG puede usar.
 *
 * SIN EMBEDDING A PROPÓSITO
 * -------------------------
 * Se insertan con `embedding` en NULL. Quien los vectoriza es el pipeline de
 * BralidusPY, que ya tiene la clave de OpenAI y una pasada de "embeddings
 * pendientes". Duplicar esa lógica acá significaría poner otra credencial de
 * OpenAI en otro servicio para hacer lo mismo.
 */

import { bralidusQuery } from '../infrastructure/database/client/pg-client.js';
import { logger } from '../infrastructure/logging/logger.js';
import { sendOpsAlert } from '../infrastructure/ops-alert/ops-alert.js';

const JOB_NAME = 'sync-jurisprudencia-grafo';

/**
 * Categoría de los nodos. Tiene que estar en WORKER_CATEGORIES de BralidusPY
 * (api/app.py) o los nodos nunca reciben embedding y quedan invisibles para el
 * RAG — presentes en la tabla y ausentes de toda respuesta.
 */
const CATEGORIA = 'Jurisprudencia';

/** Cuántos tipos de recurso y salas se sintetizan. La cola larga no aporta. */
const TOP_TIPOS = 12;
const TOP_SALAS = 7;

const miles = (n: number): string => Number(n).toLocaleString('es-CL');
const num = (v: unknown): number => Number(v ?? 0);

interface FilaSerie {
  clave: string;
  anio: number;
  terminos: number;
  pct_confirmados: number | null;
  pct_revocados: number | null;
  dias_promedio: number | null;
}

/** Arma el párrafo citable de una dimensión con su serie por año. */
function redactar(titulo: string, contexto: string, filas: FilaSerie[]): string {
  const total = filas.reduce((a, f) => a + f.terminos, 0);
  const porAnio = filas
    .map(
      (f) =>
        `${f.anio}: ${miles(f.terminos)} términos` +
        (f.pct_confirmados != null ? `, ${f.pct_confirmados}% confirmados` : '') +
        (f.pct_revocados != null ? `, ${f.pct_revocados}% revocados` : '') +
        (f.dias_promedio != null ? `, ${f.dias_promedio} días promedio` : ''),
    )
    .join('. ');

  const primero = filas[0];
  const ultimo = filas[filas.length - 1];
  let tendencia = '';
  if (primero && ultimo && primero.pct_confirmados != null && ultimo.pct_confirmados != null) {
    const delta = ultimo.pct_confirmados - primero.pct_confirmados;
    const signo = delta > 0 ? 'subió' : delta < 0 ? 'bajó' : 'se mantuvo';
    tendencia =
      ` Entre ${primero.anio} y ${ultimo.anio} la tasa de confirmación ${signo} ` +
      `de ${primero.pct_confirmados}% a ${ultimo.pct_confirmados}%.`;
  }

  return (
    `${contexto} En el período ${primero?.anio ?? '—'}–${ultimo?.anio ?? '—'} la Corte Suprema ` +
    `registró ${miles(total)} términos en esta categoría. Detalle por año: ${porAnio}.` +
    tendencia +
    ' Fuente: estadísticas oficiales del Poder Judicial de Chile (serie de términos de la Corte Suprema).'
  );
}

async function serie(dimension: 'tipo_recurso' | 'descripcion_sala', top: number): Promise<Map<string, FilaSerie[]>> {
  const filas = await bralidusQuery<Record<string, unknown>>(
    `WITH top AS (
       SELECT ${dimension} AS clave, count(*) AS n
         FROM pjud_suprema_detalle
        WHERE serie='terminos_suprema_detalle' AND ${dimension} IS NOT NULL
        GROUP BY 1 ORDER BY 2 DESC LIMIT $1
     )
     SELECT d.${dimension} AS clave, d.anio,
            count(*) AS terminos,
            round(100.0*count(*) FILTER (WHERE d.grupo_termino='Confirmados')
                  /nullif(count(*),0),1) AS pct_confirmados,
            round(100.0*count(*) FILTER (WHERE d.grupo_termino='Revocados')
                  /nullif(count(*),0),1) AS pct_revocados,
            round(avg(d.fecha_fallo - d.fecha_ingreso)
                  FILTER (WHERE d.fecha_fallo IS NOT NULL AND d.fecha_ingreso IS NOT NULL)) AS dias_promedio
       FROM pjud_suprema_detalle d
       JOIN top ON top.clave = d.${dimension}
      WHERE d.serie='terminos_suprema_detalle'
      GROUP BY 1,2 ORDER BY 1, 2`,
    [top],
  );

  const porClave = new Map<string, FilaSerie[]>();
  for (const r of filas) {
    const clave = String(r.clave);
    if (!porClave.has(clave)) porClave.set(clave, []);
    porClave.get(clave)!.push({
      clave,
      anio: num(r.anio),
      terminos: num(r.terminos),
      pct_confirmados: r.pct_confirmados == null ? null : Number(r.pct_confirmados),
      pct_revocados: r.pct_revocados == null ? null : Number(r.pct_revocados),
      dias_promedio: r.dias_promedio == null ? null : Number(r.dias_promedio),
    });
  }
  return porClave;
}

interface NodoNuevo {
  document_title: string;
  header_path: string;
  content: string;
  tags: string[];
}

export async function runSyncJurisprudenciaGrafoJob(): Promise<void> {
  try {
    const nodos: NodoNuevo[] = [];

    // 1. Un nodo por tipo de recurso.
    for (const [tipo, filas] of await serie('tipo_recurso', TOP_TIPOS)) {
      nodos.push({
        document_title: `Corte Suprema — ${tipo}`,
        header_path: 'Jurisprudencia Corte Suprema / Por tipo de recurso',
        content: redactar(
          tipo,
          `Comportamiento del recurso "${tipo}" ante la Corte Suprema de Chile.`,
          filas,
        ),
        tags: ['pjud', 'corte-suprema', 'jurisprudencia', 'tipo-recurso'],
      });
    }

    // 2. Un nodo por sala.
    for (const [sala, filas] of await serie('descripcion_sala', TOP_SALAS)) {
      nodos.push({
        document_title: `Corte Suprema — Sala ${sala}`,
        header_path: 'Jurisprudencia Corte Suprema / Por sala',
        content: redactar(sala, `Carga y resultados de la sala "${sala}" de la Corte Suprema.`, filas),
        tags: ['pjud', 'corte-suprema', 'jurisprudencia', 'sala'],
      });
    }

    // 3. Panorama general, que es el nodo que ancla las preguntas amplias.
    const [g] = await bralidusQuery<Record<string, unknown>>(
      `SELECT count(*) FILTER (WHERE serie='terminos_suprema_detalle')          AS terminos,
              count(*) FILTER (WHERE serie='ingresos_recursos_suprema_detalle') AS ingresos,
              count(*) FILTER (WHERE serie='inventario_suprema_detalle')        AS inventario,
              min(anio) AS desde, max(anio) AS hasta
         FROM pjud_suprema_detalle`,
    );
    if (g) {
      nodos.push({
        document_title: 'Corte Suprema de Chile — Panorama estadístico',
        header_path: 'Jurisprudencia Corte Suprema / Panorama',
        content:
          `Cobertura estadística de la Corte Suprema de Chile entre ${num(g.desde)} y ${num(g.hasta)}: ` +
          `${miles(num(g.terminos))} causas terminadas, ${miles(num(g.ingresos))} recursos ingresados y ` +
          `${miles(num(g.inventario))} causas registradas en inventario. ` +
          `El inventario es la medida de causas pendientes; NO debe estimarse restando términos a ingresos ` +
          `del mismo año, porque una causa ingresada en un año puede fallarse en otro. ` +
          `Fuente: estadísticas oficiales del Poder Judicial de Chile.`,
        tags: ['pjud', 'corte-suprema', 'jurisprudencia', 'panorama'],
      });
    }

    if (nodos.length === 0) {
      logger.warn(`[${JOB_NAME}] no se generó ningún nodo`);
      return;
    }

    // Upsert por la identidad que ya usa la tabla (document_title, header_path).
    // El embedding se pone en NULL SIEMPRE que el contenido cambia: dejar el
    // vector viejo sobre texto nuevo es la peor combinación posible — el nodo
    // se recupera por un significado que ya no tiene.
    let escritos = 0;
    for (const n of nodos) {
      await bralidusQuery(
        `INSERT INTO knowledge_nodes (document_title, header_path, content, category, tags, metadata, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6, now())
         ON CONFLICT (document_title, header_path) DO UPDATE SET
           content    = EXCLUDED.content,
           category   = EXCLUDED.category,
           tags       = EXCLUDED.tags,
           metadata   = EXCLUDED.metadata,
           embedding  = CASE WHEN knowledge_nodes.content IS DISTINCT FROM EXCLUDED.content
                             THEN NULL ELSE knowledge_nodes.embedding END,
           updated_at = now()`,
        [
          n.document_title,
          n.header_path,
          n.content,
          CATEGORIA,
          n.tags,
          JSON.stringify({ fuente: 'pjud_suprema_detalle', generado_por: JOB_NAME }),
        ],
      );
      escritos++;
    }

    const [pend] = await bralidusQuery<{ n: string }>(
      `SELECT count(*) AS n FROM knowledge_nodes WHERE category=$1 AND embedding IS NULL`,
      [CATEGORIA],
    );
    const pendientes = num(pend?.n);

    await sendOpsAlert({
      level: 'info',
      channel: 'pjud',
      title: `Jurisprudencia en el grafo · ${escritos} nodos`,
      detail:
        `Sintetizadas 1,7 M de causas en ${escritos} nodos citables (por tipo de recurso, por sala y panorama).` +
        (pendientes > 0
          ? `\n\n**${pendientes} esperan embedding.** Hasta que BralidusPY los vectorice no aparecen en el RAG.`
          : ''),
      fields: [
        { name: 'Tipos de recurso', value: String(TOP_TIPOS), inline: true },
        { name: 'Salas', value: String(TOP_SALAS), inline: true },
        { name: 'Sin embedding', value: String(pendientes), inline: true },
      ],
      footer: `${JOB_NAME} · categoría ${CATEGORIA}`,
      dedupeKey: `jurisprudencia-grafo:${new Date().toISOString().slice(0, 10)}`,
    });

    logger.info({ escritos, pendientes }, `[${JOB_NAME}] nodos de jurisprudencia actualizados`);
  } catch (err) {
    logger.error({ err }, `[${JOB_NAME}] falló la síntesis`);
    throw err;
  }
}
