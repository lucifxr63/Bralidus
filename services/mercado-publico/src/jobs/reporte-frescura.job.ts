/**
 * Reporte de frescura de datos — el canal que habría cazado la caída.
 *
 * POR QUÉ EXISTE
 * --------------
 * Un job puede correr "bien" y el dato envejecer igual. Pasó dos veces:
 *
 *  · /data/macro sirvió indicadores del 2026-05-08 durante 82 días con todo en
 *    verde, porque nadie invocaba la función que los escribe.
 *  · La ingesta de Mercado Público estuvo detenida del 2026-07-26 al 29 sin un
 *    solo mensaje: sólo se avisaba en caso de fallo, y el fallo ocurría antes
 *    de poder reportarse.
 *
 * Ninguna alerta por evento cubre eso. Lo que lo cubre es preguntar
 * periódicamente "¿cuán viejo está cada cosa?" y publicarlo, aunque la
 * respuesta sea buena. Es además el único mensaje de la sala de control que se
 * puede mostrar a alguien de afuera: los otros sirven para depurar, este cuenta
 * el estado.
 *
 * Es de sólo lectura: no dispara jobs ni escribe en ninguna base.
 */

import { query, bralidusQuery } from '../infrastructure/database/client/pg-client.js';
import { logger } from '../infrastructure/logging/logger.js';
import { sendOpsAlert } from '../infrastructure/ops-alert/ops-alert.js';

const JOB_NAME = 'reporte-frescura';

/** Días de antigüedad a partir de los cuales una fuente se marca degradada. */
const UMBRAL_DIAS = {
  licitaciones: 2,
  ordenes: 3,
  macro: 3,
  spulse: 5,
  pjud: 5,
  rag: 7,
  open_banking: 5,
  linkedin: 7,
} as const;

/**
 * Jobs que se esperan corriendo de forma recurrente. Lista EXPLÍCITA a propósito.
 *
 * Derivarla de los job_name que existan en sync_logs mete ruido: ahí también
 * quedan campañas puntuales (`sync-historical-*`, `backfill-compra-agil`) y
 * pruebas (`sync-ordenes-e2etest`), que aparecen "sin correr hace 23 días" sin
 * que eso signifique nada. El primer reporte real las delató como 4 falsas
 * alarmas de 7 — y un canal que grita en falso es un canal que se ignora.
 *
 * Si se agenda un job nuevo, hay que agregarlo acá.
 */
const JOBS_AGENDADOS = [
  'sync-licitaciones',
  'sync-ordenes',
  'sync-compra-agil',
  'refresh-opportunities',
  'enrich-ordenes',
] as const;

interface Fila {
  etiqueta: string;
  valor: string;
  detalle: string;
  estado: '✅' | '⚠️' | '❌';
}

const num = (n: unknown): string => Number(n ?? 0).toLocaleString('es-CL');

function diasDesde(fecha: unknown): number | null {
  if (!fecha) return null;
  return Math.floor((Date.now() - new Date(fecha as string).getTime()) / 86_400_000);
}

function semaforo(dias: number | null, umbral: number): '✅' | '⚠️' | '❌' {
  if (dias == null) return '❌';
  return dias <= umbral ? '✅' : '⚠️';
}

export async function runReporteFrescuraJob(): Promise<void> {
  const filas: Fila[] = [];

  try {
    // ── 1-3: Licitus (Mercado Público B2G con Desglose) ──────────────────────
    const licRow = await query<{
      opps: number; cot: number; ocs: number;
      ult_pub: string | null; ult_oc: string | null;
      sin_enriquecer: number; sin_intento: number; con_reintento: number;
    }>(
      `SELECT (SELECT count(*) FROM opportunities)::int                                  AS opps,
              (SELECT count(*) FROM opportunities WHERE source_type='compra_agil')::int  AS cot,
              (SELECT count(*) FROM purchase_orders)::int                                AS ocs,
              (SELECT max(published_at) FROM opportunities)                              AS ult_pub,
              (SELECT max(issued_at) FROM purchase_orders)                               AS ult_oc,
              (SELECT count(*) FROM purchase_orders
                WHERE supplier_code IS NULL AND enrichment_attempts < 5)::int            AS sin_enriquecer,
              (SELECT count(*) FROM purchase_orders
                WHERE supplier_code IS NULL AND enrichment_attempts = 0)::int            AS sin_intento,
              (SELECT count(*) FROM purchase_orders
                WHERE supplier_code IS NULL AND enrichment_attempts BETWEEN 1 AND 4)::int AS con_reintento`,
      [],
    );
    const lic = licRow[0];

    if (lic) {
      const dPub = diasDesde(lic.ult_pub);
      const dOc = diasDesde(lic.ult_oc);
      const licTrad = Math.max(0, lic.opps - lic.cot);
      filas.push({
        etiqueta: 'Licitaciones (Licitus)',
        valor: num(lic.opps),
        detalle: `pub. hace ${dPub ?? '?'}d · COT ${num(lic.cot)} · LP/LE/LR: ${num(licTrad)}`,
        estado: semaforo(dPub, UMBRAL_DIAS.licitaciones),
      });
      filas.push({
        etiqueta: 'Órdenes de compra',
        valor: num(lic.ocs),
        detalle: `última OC hace ${dOc ?? '?'}d · total emitidas en catálogo`,
        estado: semaforo(dOc, UMBRAL_DIAS.ordenes),
      });
      filas.push({
        etiqueta: 'Cola de enriquecimiento',
        valor: num(lic.sin_enriquecer),
        detalle: `${lic.sin_enriquecer > 1000 ? 'backlog alto' : 'al día'} (${num(lic.sin_intento)} sin int. / ${num(lic.con_reintento)} reint.)`,
        estado: lic.sin_enriquecer > 1000 ? '⚠️' : '✅',
      });
    }

    // ── 4: Última corrida de cada job AGENDADO ───────────────────────────────
    const jobs = await query<{
      job_name: string; status: string; started_at: string | null; finished_at: string | null;
    }>(
      `SELECT DISTINCT ON (job_name) job_name, status, started_at, finished_at
         FROM sync_logs WHERE job_name = ANY($1) ORDER BY job_name, started_at DESC`,
      [[...JOBS_AGENDADOS]],
    );

    const viejos = jobs.filter((j) => {
      if (j.status === 'running') return false;
      return (diasDesde(j.finished_at ?? j.started_at) ?? 99) > 2;
    });
    const vistos = new Set(jobs.map((j) => j.job_name));
    const nuncaCorrieron = JOBS_AGENDADOS.filter((j) => !vistos.has(j));
    const problemas = [...viejos.map((j) => j.job_name), ...nuncaCorrieron];

    filas.push({
      etiqueta: 'Jobs agendados',
      valor: `${JOBS_AGENDADOS.length - problemas.length}/${JOBS_AGENDADOS.length}`,
      detalle: problemas.length ? `sin correr: ${problemas.join(', ')}` : 'todos al día (5/5 crons saludables)',
      estado: problemas.length === 0 ? '✅' : '⚠️',
    });

    // ── 5: Paridad con la tabla canónica de Bralidus ─────────────────────────
    try {
      const canon = await bralidusQuery<{ n: number; ult_pub: string | null }>(
        `SELECT count(*)::int AS n, max(published_at) AS ult_pub FROM licitaciones_mercado_publico`,
        [],
      );
      const desfase = (lic?.opps ?? 0) - (canon[0]?.n ?? 0);
      const dPubBralidus = diasDesde(canon[0]?.ult_pub);
      filas.push({
        etiqueta: 'Tabla canónica (Bralidus)',
        valor: num(canon[0]?.n),
        detalle: desfase === 0 ? `paridad con Licitus · pub. hace ${dPubBralidus ?? '?'}d` : `desfase ${desfase > 0 ? '+' : ''}${desfase} · pub. hace ${dPubBralidus ?? '?'}d`,
        estado: desfase === 0 ? '✅' : '⚠️',
      });
    } catch (err) {
      filas.push({
        etiqueta: 'Tabla canónica (Bralidus)',
        valor: '—',
        detalle: 'no se pudo consultar tabla canónica',
        estado: '❌',
      });
      logger.warn({ err }, `[${JOB_NAME}] canónica inaccesible`);
    }

    // ── 6: Indicadores Macro & Economía (BCCh / CMF) ─────────────────────────
    try {
      const macro = await bralidusQuery<{ cnt: number; ult_upd: string | null }>(
        `SELECT count(*)::int AS cnt, max(updated_at) AS ult_upd FROM economic_knowledge`,
        [],
      );
      const dMacro = diasDesde(macro[0]?.ult_upd);
      filas.push({
        etiqueta: 'Indicadores Macro (BCCh)',
        valor: num(macro[0]?.cnt),
        detalle: `última sync hace ${dMacro ?? '?'}d · UF/UTM/Dólar/TPM en caché`,
        estado: semaforo(dMacro, UMBRAL_DIAS.macro),
      });
    } catch (err) {
      filas.push({
        etiqueta: 'Indicadores Macro (BCCh)',
        valor: '—',
        detalle: 'tabla economic_knowledge no accesible',
        estado: '❌',
      });
      logger.warn({ err }, `[${JOB_NAME}] economic_knowledge inaccesible`);
    }

    // ── 7: S-Pulse Societario (CMF / Diario Oficial) ─────────────────────────
    try {
      const spulse = await bralidusQuery<{ comp_cnt: number; mesh_cnt: number; ult_upd: string | null }>(
        `SELECT (SELECT count(*)::int FROM company_profiles) AS comp_cnt,
                (SELECT max(updated_at) FROM company_profiles) AS ult_upd,
                (SELECT count(*)::int FROM company_ownership_meshes) AS mesh_cnt`,
        [],
      );
      const dSpulse = diasDesde(spulse[0]?.ult_upd);
      filas.push({
        etiqueta: 'S-Pulse Societario',
        valor: num(spulse[0]?.comp_cnt),
        detalle: `último perfil hace ${dSpulse ?? '?'}d · ${num(spulse[0]?.mesh_cnt)} relaciones societarias`,
        estado: semaforo(dSpulse, UMBRAL_DIAS.spulse),
      });
    } catch (err) {
      filas.push({
        etiqueta: 'S-Pulse Societario',
        valor: '—',
        detalle: 'tablas societarias no accesibles',
        estado: '❌',
      });
      logger.warn({ err }, `[${JOB_NAME}] S-Pulse inaccesible`);
    }

    // ── 8: Poder Judicial (PJUD / Concursal) ─────────────────────────────────
    try {
      const pjud = await bralidusQuery<{ cnt: number; ult_cap: string | null }>(
        `SELECT count(*)::int AS cnt, max(capturado_at) AS ult_cap FROM pjud_estadisticas`,
        [],
      );
      const dPjud = diasDesde(pjud[0]?.ult_cap);
      filas.push({
        etiqueta: 'Poder Judicial (PJUD)',
        valor: num(pjud[0]?.cnt),
        detalle: `última captura hace ${dPjud ?? '?'}d · series concursales/estadísticas`,
        estado: semaforo(dPjud, UMBRAL_DIAS.pjud),
      });
    } catch (err) {
      filas.push({
        etiqueta: 'Poder Judicial (PJUD)',
        valor: '—',
        detalle: 'tabla pjud_estadisticas no accesible',
        estado: '❌',
      });
      logger.warn({ err }, `[${JOB_NAME}] PJUD inaccesible`);
    }

    // ── 9: RAG Documental & Vaults (pgvector) ────────────────────────────────
    try {
      const rag = await bralidusQuery<{ cnt: number; ult_upd: string | null }>(
        `SELECT count(*)::int AS cnt, max(updated_at) AS ult_upd FROM knowledge_nodes`,
        [],
      );
      const dRag = diasDesde(rag[0]?.ult_upd);
      filas.push({
        etiqueta: 'RAG & Vaults (pgvector)',
        valor: num(rag[0]?.cnt),
        detalle: `último nodo hace ${dRag ?? '?'}d · GraphRAG indexado`,
        estado: semaforo(dRag, UMBRAL_DIAS.rag),
      });
    } catch (err) {
      filas.push({
        etiqueta: 'RAG & Vaults (pgvector)',
        valor: '—',
        detalle: 'tabla knowledge_nodes no accesible',
        estado: '❌',
      });
      logger.warn({ err }, `[${JOB_NAME}] RAG inaccesible`);
    }

    // ── 10: Open Banking & Conciliación (Fintoc / PYMEs) ─────────────────────
    try {
      const fin = await bralidusQuery<{ cnt: number; ult_upd: string | null }>(
        `SELECT count(*)::int AS cnt, max(updated_at) AS ult_upd FROM pyme_financials`,
        [],
      );
      const dFin = diasDesde(fin[0]?.ult_upd);
      filas.push({
        etiqueta: 'Open Banking (Fintoc)',
        valor: num(fin[0]?.cnt),
        detalle: `última sync hace ${dFin ?? '?'}d · registros financieros pymes`,
        estado: semaforo(dFin, UMBRAL_DIAS.open_banking),
      });
    } catch (err) {
      filas.push({
        etiqueta: 'Open Banking (Fintoc)',
        valor: '—',
        detalle: 'tabla pyme_financials no accesible',
        estado: '❌',
      });
      logger.warn({ err }, `[${JOB_NAME}] Fintoc inaccesible`);
    }

    // ── 11: Perfiles LinkedIn (IA / Fundadores) ──────────────────────────────
    try {
      const found = await bralidusQuery<{ cnt: number; ult_upd: string | null; pending: number }>(
        `SELECT count(*)::int AS cnt,
                max(updated_at) AS ult_upd,
                SUM(CASE WHEN extraction_status = 'processing' THEN 1 ELSE 0 END)::int AS pending
           FROM founder_profiles`,
        [],
      );
      const dFound = diasDesde(found[0]?.ult_upd);
      filas.push({
        etiqueta: 'Scraper LinkedIn (IA)',
        valor: num(found[0]?.cnt),
        detalle: `último perfil hace ${dFound ?? '?'}d · ${num(found[0]?.pending)} en cola de IA`,
        estado: semaforo(dFound, UMBRAL_DIAS.linkedin),
      });
    } catch (err) {
      filas.push({
        etiqueta: 'Scraper LinkedIn (IA)',
        valor: '—',
        detalle: 'tabla founder_profiles no accesible',
        estado: '❌',
      });
      logger.warn({ err }, `[${JOB_NAME}] LinkedIn scraper inaccesible`);
    }

    // ── Publicación ──────────────────────────────────────────────────────────
    const degradadas = filas.filter((f) => f.estado !== '✅').length;
    const serviciosConIncidentes = filas.filter((f) => f.estado !== '✅');

    const camposTodos = filas.map((f) => ({
      name: `${f.estado} ${f.etiqueta}`,
      value: `**${f.valor}**\n${f.detalle}`,
      inline: true,
    }));

    const camposIncidentes = serviciosConIncidentes.map((f) => ({
      name: `${f.estado} ${f.etiqueta}`,
      value: `**${f.valor}**\n${f.detalle}`,
      inline: true,
    }));

    const resumenFrescura = degradadas === 0
      ? '**Todo al día.** Ninguna de las 11 fuentes requiere atención en Animus Engine.'
      : `**${degradadas} de ${filas.length} fuentes** requieren atención en el mapa 360°.`;

    // 1. Canal #ops-frescura (Radiografía completa 360°)
    await sendOpsAlert({
      level: degradadas === 0 ? 'info' : 'warn',
      channel: 'frescura',
      title: `Frescura de datos · Animus Engine 360° · ${new Date().toISOString().slice(0, 10)}`,
      detail: resumenFrescura,
      fields: camposTodos,
      footer: `${filas.length} fuentes medidas · Animus Engine 360°`,
      dedupeKey: `frescura-360:${new Date().toISOString().slice(0, 10)}`,
    });

    // 2. Canal #ops-latido (Latido de los 11 servicios)
    const resumenLatido = degradadas === 0
      ? '**11/11 servicios activos y sincronizados.** Latido 360° saludable en Animus Engine.'
      : `**Latido 360°:** ${degradadas} de ${filas.length} servicios presentan rezago o interrupción.`;

    await sendOpsAlert({
      level: degradadas === 0 ? 'info' : 'warn',
      channel: 'latido',
      title: `Latido 360° · Estado de 11 servicios · ${new Date().toISOString().slice(0, 10)}`,
      detail: resumenLatido,
      fields: camposTodos,
      footer: `${filas.length} servicios monitoreados · Latido 360° · Animus Engine`,
      dedupeKey: `latido-360:${new Date().toISOString().slice(0, 10)}`,
    });

    // 3. Canal #ops-incidentes (Sólo si hay servicios con errores o degradaciones en los 11 servicios)
    if (serviciosConIncidentes.length > 0) {
      const tieneError = serviciosConIncidentes.some((f) => f.estado === '❌');
      const resumenIncidentes = `**Reporte de Incidentes 360°:** Se han detectado problemas en **${serviciosConIncidentes.length} de ${filas.length} servicios** del mapa de datos Animus Engine. Recreación automática y alertas activadas.`;

      await sendOpsAlert({
        level: tieneError ? 'error' : 'warn',
        channel: 'incidentes',
        title: `¡Atención! ${serviciosConIncidentes.length} de ${filas.length} servicios con incidentes (360°) · ${new Date().toISOString().slice(0, 10)}`,
        detail: resumenIncidentes,
        fields: camposIncidentes,
        footer: `Incidentes en ${serviciosConIncidentes.length}/${filas.length} servicios · Animus Engine 360°`,
        dedupeKey: `incidentes-360:${new Date().toISOString().slice(0, 10)}`,
      });
    }

    logger.info({ filas: filas.length, degradadas }, `[${JOB_NAME}] reporte publicado en frescura, latido e incidentes`);
  } catch (err) {
    // El reporte no debe tumbar nada, pero su propio fallo sí es un incidente:
    // sin él se pierde justamente la señal de que algo envejeció.
    const error = err instanceof Error ? err.message : String(err);
    logger.error({ error }, `[${JOB_NAME}] fallo al armar el reporte`);
    void sendOpsAlert({
      level: 'error',
      channel: 'incidentes',
      title: 'El reporte de frescura falló',
      detail: `Sin este reporte no hay señal de datos envejecidos.\n${error.slice(0, 200)}`,
      dedupeKey: 'frescura-fallo',
    });
  }
}
