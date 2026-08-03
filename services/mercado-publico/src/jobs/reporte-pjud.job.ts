/**
 * Tablero de la Corte Suprema para la sala de control.
 *
 * QUÉ RESUELVE
 * ------------
 * `sync-pjud-suprema` ya avisaba cuántas filas escribió, que sirve para saber si
 * la ingesta anduvo y para nada más. Con 1.706.941 causas de seis años el dato
 * da para responder preguntas de fondo, y esas preguntas no se ven entrando a la
 * base: hay que publicarlas.
 *
 * QUÉ MUESTRA Y QUÉ NO
 * --------------------
 * Se descartó a propósito la métrica más tentadora: `ingresos − términos` del
 * mismo año como si fuera saldo pendiente. NO lo es — una causa que ingresó en
 * 2023 puede terminar en 2024, así que 2024 da 153 % "resuelto" y 2021 da 109 %.
 * Publicar eso como backlog sería inventar una lectura que el dato no soporta.
 *
 * Lo que sí es comparable:
 *   - el INVENTARIO, que es la medida real de causas pendientes;
 *   - la composición de los términos (confirmados / revocados), porque se compara
 *     dentro del mismo universo;
 *   - la duración media entre ingreso y fallo;
 *   - la concentración por sala y por tipo de recurso.
 *
 * FRESCURA PRIMERO
 * ----------------
 * El primer campo es cuándo se ingirió por última vez. Un tablero con cifras
 * lindas sobre datos de hace medio año es peor que no tenerlo: se lee como si
 * describiera el presente.
 */

import { bralidusQuery } from '../infrastructure/database/client/pg-client.js';
import { logger } from '../infrastructure/logging/logger.js';
import { sendOpsAlert } from '../infrastructure/ops-alert/ops-alert.js';

const JOB_NAME = 'reporte-pjud';

/** Días sin ingesta a partir de los cuales el tablero deja de ser informativo. */
const DIAS_PARA_RANCIO = 45;

interface FilaAnio {
  anio: number;
  terminos: number;
  ingresos: number;
  inventario: number;
  confirmados: number;
  revocados: number;
  pct_confirm: number | null;
  dias_promedio: number | null;
}

interface Concentracion {
  etiqueta: string;
  total: number;
}

const num = (v: unknown): number => Number(v ?? 0);

const miles = (n: number): string => n.toLocaleString('es-CL');

export async function runReportePjudJob(): Promise<void> {
  try {
    // Una sola consulta por bloque, y ninguna toca la columna `raw`.
    const porAnio = await bralidusQuery<Record<string, unknown>>(
      `SELECT anio,
              count(*) FILTER (WHERE serie='terminos_suprema_detalle')          AS terminos,
              count(*) FILTER (WHERE serie='ingresos_recursos_suprema_detalle') AS ingresos,
              count(*) FILTER (WHERE serie='inventario_suprema_detalle')        AS inventario,
              count(*) FILTER (WHERE serie='terminos_suprema_detalle'
                                 AND grupo_termino='Confirmados')               AS confirmados,
              count(*) FILTER (WHERE serie='terminos_suprema_detalle'
                                 AND grupo_termino='Revocados')                 AS revocados,
              round(100.0 * count(*) FILTER (WHERE serie='terminos_suprema_detalle'
                                               AND grupo_termino='Confirmados')
                    / nullif(count(*) FILTER (WHERE serie='terminos_suprema_detalle'),0), 1) AS pct_confirm,
              round(avg(fecha_fallo - fecha_ingreso)
                    FILTER (WHERE serie='terminos_suprema_detalle'))            AS dias_promedio
         FROM pjud_suprema_detalle
        GROUP BY anio
        ORDER BY anio DESC`,
    );

    if (porAnio.length === 0) {
      logger.warn(`[${JOB_NAME}] no hay datos de PJUD; no se publica tablero`);
      return;
    }

    const anios: FilaAnio[] = porAnio.map((r) => ({
      anio: num(r.anio),
      terminos: num(r.terminos),
      ingresos: num(r.ingresos),
      inventario: num(r.inventario),
      confirmados: num(r.confirmados),
      revocados: num(r.revocados),
      pct_confirm: r.pct_confirm == null ? null : Number(r.pct_confirm),
      dias_promedio: r.dias_promedio == null ? null : Number(r.dias_promedio),
    }));

    const ultimo = anios[0]!;
    const total = anios.reduce((a, x) => a + x.terminos + x.ingresos + x.inventario, 0);

    const [frescura] = await bralidusQuery<{ dias: string | null; ultima: Date | null }>(
      `SELECT extract(day from now() - max(updated_at))::int AS dias,
              max(updated_at) AS ultima
         FROM pjud_suprema_detalle`,
    );
    const diasSinIngesta = frescura?.dias == null ? null : Number(frescura.dias);
    const rancio = diasSinIngesta != null && diasSinIngesta > DIAS_PARA_RANCIO;

    // Concentración del año más reciente: dónde se acumula el trabajo.
    const topSalas = await bralidusQuery<Record<string, unknown>>(
      `SELECT descripcion_sala AS etiqueta, count(*) AS total
         FROM pjud_suprema_detalle
        WHERE serie='terminos_suprema_detalle' AND anio=$1 AND descripcion_sala IS NOT NULL
        GROUP BY 1 ORDER BY 2 DESC LIMIT 3`,
      [ultimo.anio],
    );
    const topTipos = await bralidusQuery<Record<string, unknown>>(
      `SELECT tipo_recurso AS etiqueta, count(*) AS total
         FROM pjud_suprema_detalle
        WHERE serie='terminos_suprema_detalle' AND anio=$1 AND tipo_recurso IS NOT NULL
        GROUP BY 1 ORDER BY 2 DESC LIMIT 3`,
      [ultimo.anio],
    );

    const lista = (filas: Record<string, unknown>[], base: number): string =>
      filas.length === 0
        ? '—'
        : filas
            .map((f) => {
              const t = num(f.total);
              const pct = base > 0 ? ` (${Math.round((t / base) * 100)}%)` : '';
              return `${String(f.etiqueta)} — ${miles(t)}${pct}`;
            })
            .join('\n');

    // Tendencia como texto: seis años entran en una línea y se leen de un vistazo.
    const tendencia = [...anios]
      .reverse()
      .map((a) => `${a.anio}: ${a.pct_confirm ?? '—'}%`)
      .join('  ·  ');

    const campos = [
      {
        name: '📅 Cobertura',
        value: `**${anios.length} años** (${anios[anios.length - 1]!.anio}–${ultimo.anio})\n${miles(total)} registros`,
        inline: true,
      },
      {
        name: rancio ? '⚠️ Última ingesta' : '🔄 Última ingesta',
        value:
          diasSinIngesta == null
            ? 'desconocida'
            : `hace ${diasSinIngesta} día(s)` + (rancio ? '\nel tablero puede estar desactualizado' : ''),
        inline: true,
      },
      {
        name: `⚖️ Pendientes (${ultimo.anio})`,
        value: `**${miles(ultimo.inventario)}**\nen inventario`,
        inline: true,
      },
      {
        name: `📊 Términos ${ultimo.anio}`,
        value: `**${miles(ultimo.terminos)}** fallados\n${miles(ultimo.ingresos)} ingresados`,
        inline: true,
      },
      {
        name: '✅ Composición',
        value:
          `Confirmados **${ultimo.pct_confirm ?? '—'}%**\n` +
          `Revocados ${
            ultimo.terminos > 0 ? Math.round((ultimo.revocados / ultimo.terminos) * 100) : '—'
          }%`,
        inline: true,
      },
      {
        name: '⏱️ Duración media',
        value:
          ultimo.dias_promedio == null
            ? '—'
            : `**${ultimo.dias_promedio} días**\nde ingreso a fallo`,
        inline: true,
      },
      {
        name: '🏛️ Salas con más carga',
        value: lista(topSalas, ultimo.terminos),
        inline: false,
      },
      {
        name: '📁 Recursos más frecuentes',
        value: lista(topTipos, ultimo.terminos),
        inline: false,
      },
      {
        name: '📈 Tasa de confirmación por año',
        value:
          `${tendencia}\n` +
          '_Proporción de fallos confirmados sobre el total de términos del año._',
        inline: false,
      },
    ];

    await sendOpsAlert({
      level: rancio ? 'warn' : 'info',
      channel: 'pjud',
      title: `Corte Suprema · ${miles(total)} causas · ${anios[anios.length - 1]!.anio}–${ultimo.anio}`,
      detail: rancio
        ? `⚠️ **Sin ingesta hace ${diasSinIngesta} días.** Las cifras de abajo describen ese corte, no el presente.`
        : `Panorama del último año cerrado (**${ultimo.anio}**) y evolución desde ${anios[anios.length - 1]!.anio}.`,
      fields: campos,
      footer: `${JOB_NAME} · pjud_suprema_detalle`,
      // Una por día: si se dispara a mano varias veces, no inunda el canal.
      dedupeKey: `pjud-tablero:${new Date().toISOString().slice(0, 10)}`,
    });

    logger.info({ anios: anios.length, total, diasSinIngesta }, `[${JOB_NAME}] tablero publicado`);
  } catch (err) {
    logger.error({ err }, `[${JOB_NAME}] no se pudo componer el tablero`);
    // No se re-lanza: que falle el tablero no debe marcar en rojo la corrida de
    // otro job si algún día se encadena.
  }
}
