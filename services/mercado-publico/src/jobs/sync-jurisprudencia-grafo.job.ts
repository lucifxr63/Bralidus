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
const TOP_MATERIAS = 12;

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

/**
 * Serie anual de INGRESOS por materia.
 *
 * Aparte de `serie()` porque el universo es otro: la materia sólo existe en
 * `ingresos_recursos_suprema_detalle`, que no trae `grupo_termino` ni
 * `fecha_fallo`. Reusar la otra función devolvería porcentajes de confirmación
 * en cero y parecerían un resultado en vez de un campo ausente.
 *
 * Se filtran los valores "-" y "--": 103.279 filas con un guion por materia.
 * Son nulos disfrazados y, sumados, formarían la segunda materia más grande.
 */
async function serieMateria(top: number): Promise<Map<string, FilaSerie[]>> {
  const filas = await bralidusQuery<Record<string, unknown>>(
    `WITH limpio AS (
       SELECT anio, materia
         FROM pjud_suprema_detalle
        WHERE serie='ingresos_recursos_suprema_detalle'
          AND materia IS NOT NULL
          AND btrim(materia, '- ') <> ''
     ), top AS (
       SELECT materia, count(*) AS n FROM limpio GROUP BY 1 ORDER BY 2 DESC LIMIT $1
     )
     SELECT l.materia AS clave, l.anio, count(*) AS terminos
       FROM limpio l JOIN top ON top.materia = l.materia
      GROUP BY 1,2 ORDER BY 1,2`,
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
      pct_confirmados: null,
      pct_revocados: null,
      dias_promedio: null,
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

const PANORAMA = 'Corte Suprema de Chile — Panorama estadístico';

/**
 * Aristas entre los nodos de jurisprudencia.
 *
 * QUÉ SE CONECTA Y POR QUÉ SE PUEDE
 * ---------------------------------
 * Sólo relaciones DERIVADAS DEL DATO, nunca interpretadas:
 *
 *   RESUELVE / SE_VE_EN   sala ↔ tipo de recurso. No es una suposición: en los
 *                         datos la competencia es nítida — las apelaciones de
 *                         protección van a la Tercera (Constitucional) en el
 *                         100 % de los casos, los amparos a la Segunda (Penal)
 *                         en el 100 %, la unificación laboral a la Cuarta
 *                         (Mixta) en el 100 %. Se exige además volumen y
 *                         concentración mínimos para no crear aristas por una
 *                         causa suelta mal clasificada.
 *
 *   AGREGA                el panorama contiene a cada tipo y a cada sala. Es
 *                         contención, no interpretación.
 *
 * QUÉ NO SE CONECTA, A PROPÓSITO
 * ------------------------------
 * NO se crean aristas entre jurisprudencia y normativa. Sería lo más vistoso
 * —"Apelación Protección REQUIERE_CUMPLIR Ley 21.719"— y sería inventado: en
 * `pjud_suprema_detalle` no hay ningún campo que vincule una causa con una ley.
 * Afirmar esa relación en un grafo que después alimenta a un LLM es fabricar
 * doctrina.
 *
 * Para hacerlo bien haría falta la materia de cada causa mapeada a normativa, o
 * la revisión de alguien del área. Mientras tanto, el experto legal igual trae
 * ambos mundos porque los dos grupos están en su lista de entidades.
 *
 * AMBAS DIRECCIONES
 * -----------------
 * `search_hybrid_graphrag` recorre `source_title → target_title`, así que una
 * arista en un solo sentido sólo sirve si la consulta activa justo ese extremo.
 */
async function generarAristas(): Promise<number> {
  // Umbrales: al menos 500 causas y 20 % del tipo. Por debajo de eso una
  // coincidencia puede ser ruido de clasificación, no competencia real.
  const pares = await bralidusQuery<Record<string, unknown>>(
    `WITH pares AS (
       SELECT descripcion_sala AS sala, tipo_recurso AS tipo, count(*) AS n
         FROM pjud_suprema_detalle
        WHERE serie='terminos_suprema_detalle'
          AND descripcion_sala IS NOT NULL AND tipo_recurso IS NOT NULL
        GROUP BY 1,2
     ), tot AS (SELECT tipo, sum(n) AS total FROM pares GROUP BY 1)
     SELECT p.sala, p.tipo
       FROM pares p JOIN tot t USING (tipo)
      WHERE p.n > 500 AND 100.0*p.n/t.total > 20`,
  );

  const filas: Array<[string, string, string]> = [];

  for (const p of pares) {
    const sala = `Corte Suprema — Sala ${String(p.sala)}`;
    const tipo = `Corte Suprema — ${String(p.tipo)}`;
    filas.push([sala, tipo, 'RESUELVE']);
    filas.push([tipo, sala, 'SE_VE_EN']);
  }

  // Materia ↔ tipo de recurso: por qué vía se litiga cada materia. También
  // medido, no supuesto — las Isapres llegan por apelación de protección.
  const materiaTipo = await bralidusQuery<Record<string, unknown>>(
    `WITH limpio AS (
       SELECT materia, tipo_recurso
         FROM pjud_suprema_detalle
        WHERE serie='ingresos_recursos_suprema_detalle'
          AND materia IS NOT NULL AND btrim(materia,'- ') <> ''
          AND tipo_recurso IS NOT NULL
     ), pares AS (
       SELECT materia, tipo_recurso, count(*) AS n FROM limpio GROUP BY 1,2
     ), tot AS (SELECT materia, sum(n) AS total FROM pares GROUP BY 1)
     SELECT p.materia, p.tipo_recurso
       FROM pares p JOIN tot t USING (materia)
      WHERE p.n > 500 AND 100.0*p.n/t.total > 20`,
  );

  for (const p of materiaTipo) {
    const materia = `Corte Suprema — Materia: ${String(p.materia)}`;
    const tipo = `Corte Suprema — ${String(p.tipo_recurso)}`;
    filas.push([materia, tipo, 'SE_LITIGA_VIA']);
    filas.push([tipo, materia, 'RESUELVE_MATERIA']);
  }

  // El panorama agrega a todos los demás nodos de jurisprudencia.
  const nodos = await bralidusQuery<{ document_title: string }>(
    `SELECT document_title FROM knowledge_nodes
      WHERE category=$1 AND document_title <> $2`,
    [CATEGORIA, PANORAMA],
  );
  for (const n of nodos) {
    filas.push([PANORAMA, n.document_title, 'AGREGA']);
  }

  // ── Descartar las aristas cuyos extremos no son nodos ────────────────────
  //
  // POR QUÉ HACE FALTA
  // ------------------
  // Los NODOS se crean con un tope (TOP_TIPOS=12, TOP_SALAS=7, TOP_MATERIAS=12).
  // Las ARISTAS, en cambio, salen de las consultas de arriba con un umbral
  // distinto (n > 500 y 20 %) y sin tope. Los dos conjuntos NO coinciden: una
  // materia que pasa el umbral pero queda fuera del top nunca recibe nodo, y la
  // arista igual se escribía.
  //
  // `knowledge_edges` enlaza por TÍTULO y no tiene foreign key, así que insertar
  // una arista hacia un nodo inexistente no falla — se escribe y se cuenta como
  // éxito. Al 2026-08-05 había 38 así, creadas el 03-08 por este mismo job:
  // la mitad de RESUELVE_MATERIA y SE_LITIGA_VIA apuntaba al vacío, incluidas
  // materias tan relevantes como Bancos, AFP y Carabineros.
  //
  // Y el daño no es cosmético: `search_hybrid_graphrag` recorre los vecinos con
  // un INNER JOIN contra knowledge_nodes, así que una arista huérfana **aporta
  // cero filas sin decirlo**. El grafo promete un vecino, el join lo descarta, y
  // el modelo recibe un contexto parcial indistinguible de uno completo. Eso es
  // exactamente el material del que se hacen las alucinaciones.
  const existentes = new Set(
    (
      await bralidusQuery<{ document_title: string }>(
        `SELECT document_title FROM knowledge_nodes`,
      )
    ).map((r) => r.document_title),
  );

  const validas = filas.filter(([src, tgt]) => existentes.has(src) && existentes.has(tgt));
  const descartadas = filas.length - validas.length;

  // Se borran las anteriores de estos tipos antes de reinsertar: si una sala
  // deja de ver un recurso, la arista vieja tiene que desaparecer, no quedar
  // contradiciendo al dato.
  await bralidusQuery(
    `DELETE FROM knowledge_edges
      WHERE relation_type IN ('RESUELVE','SE_VE_EN','AGREGA','SE_LITIGA_VIA','RESUELVE_MATERIA')
        AND (source_title LIKE 'Corte Suprema%' OR target_title LIKE 'Corte Suprema%')`,
  );

  let escritas = 0;
  for (const [src, tgt, rel] of validas) {
    try {
      await bralidusQuery(
        `INSERT INTO knowledge_edges (source_title, target_title, relation_type)
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [src, tgt, rel],
      );
      escritas++;
    } catch (err) {
      logger.warn({ src, tgt, rel, err }, `[${JOB_NAME}] arista rechazada`);
    }
  }

  // Descartar en silencio sería cambiar un problema por otro: el desajuste
  // significa que los topes de nodos se quedaron cortos frente a los umbrales
  // de arista, y eso hay que verlo para corregir la calibración — no taparlo.
  if (descartadas > 0) {
    const faltantes = [
      ...new Set(
        filas
          .filter(([src, tgt]) => !existentes.has(src) || !existentes.has(tgt))
          .flatMap(([src, tgt]) => [src, tgt].filter((t) => !existentes.has(t))),
      ),
    ];
    logger.warn(
      { descartadas, faltantes: faltantes.slice(0, 20) },
      `[${JOB_NAME}] aristas descartadas por apuntar a nodos inexistentes`,
    );
    void sendOpsAlert({
      level: 'warn',
      channel: 'degradacion',
      title: `${descartadas} relaciones de jurisprudencia quedaron fuera del grafo`,
      detail:
        `Los umbrales de arista (n>500 y 20 %) alcanzan entidades que los topes de ` +
        `nodo (TOP_TIPOS/TOP_SALAS/TOP_MATERIAS) dejan fuera, así que esas relaciones ` +
        `no tienen a qué apuntar y se descartan.\n\n` +
        `Sin nodo: ${faltantes.slice(0, 8).join(', ')}${faltantes.length > 8 ? `, +${faltantes.length - 8}` : ''}\n\n` +
        `Para recuperarlas hay que subir los topes, no bajar los umbrales.`,
      dedupeKey: 'jurisprudencia-aristas-descartadas',
    });
  }

  return escritas;
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

    // 3. Un nodo por MATERIA.
    //
    // La materia vive en la serie de INGRESOS (797.187 filas, 100 % con dato),
    // no en la de términos. Eso obliga a hablar de VOLUMEN DE INGRESO y no de
    // resultados: esa serie no trae `grupo_termino` ni `fecha_fallo`, así que
    // decir "X% confirmados por materia" sería mezclar universos.
    //
    // Se excluyen "-" y "--": son 103.279 filas con un guion como valor, o sea
    // nulos disfrazados. Tratarlos como una materia real crearía el nodo más
    // grande del grafo sobre nada.
    for (const [materia, filas] of await serieMateria(TOP_MATERIAS)) {
      const total = filas.reduce((a, f) => a + f.terminos, 0);
      const primero = filas[0];
      const ultimo = filas[filas.length - 1];
      const detalle = filas.map((f) => `${f.anio}: ${miles(f.terminos)}`).join(', ');

      let variacion = '';
      if (primero && ultimo && primero.terminos > 0) {
        const cambio = Math.round(((ultimo.terminos - primero.terminos) / primero.terminos) * 100);
        variacion =
          ` Entre ${primero.anio} y ${ultimo.anio} el ingreso anual por esta materia ` +
          `${cambio >= 0 ? 'subió' : 'cayó'} ${Math.abs(cambio)}%.`;
      }

      nodos.push({
        document_title: `Corte Suprema — Materia: ${materia}`,
        header_path: 'Jurisprudencia Corte Suprema / Por materia',
        content:
          `Recursos ingresados a la Corte Suprema de Chile con materia "${materia}". ` +
          `Total ${primero?.anio ?? '—'}–${ultimo?.anio ?? '—'}: ${miles(total)} recursos. ` +
          `Ingresos por año: ${detalle}.` +
          variacion +
          ' Estas cifras son de INGRESO de recursos, no de resultados: la serie de ingresos ' +
          'no registra cómo se falló cada causa. ' +
          'Fuente: estadísticas oficiales del Poder Judicial de Chile.',
        tags: ['pjud', 'corte-suprema', 'jurisprudencia', 'materia'],
      });
    }

    // 4. Panorama general, que es el nodo que ancla las preguntas amplias.
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

    const aristas = await generarAristas();

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
        {
          name: 'Aristas',
          value: `${aristas}\nsala↔recurso y panorama`,
          inline: true,
        },
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
