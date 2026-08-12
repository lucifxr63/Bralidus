/**
 * backfill-ocds-anexos.ts — agrega a las licitaciones ADJUDICADAS ya cargadas
 * el enlace a la página de anexos que publica la API OCDS de ChileCompra.
 *
 * POR QUÉ EXISTE
 * --------------
 * La API v1 de Mercado Público no expone adjuntos de licitación en ninguna de
 * sus 15.387 fichas. OCDS sí publica un enlace profundo a la página donde están
 * listados —lo único que hay para el hueco más grande del expediente— pero sólo
 * en procesos adjudicados: ~5.850 de 15.695.
 *
 * NO baja archivos. El listado detrás de ese enlace se pide por AJAX con un
 * token de reCAPTCHA Enterprise, así que desde el servidor no se puede resolver.
 * Lo que se guarda queda rotulado `tipo: 'pagina'`, `descargable: false`.
 *
 * CONTRATO
 * --------
 * Usa `mapDocumentosOcds` y `fetchEnlaceAnexos` — los MISMOS que la ingesta— en
 * vez de reimplementar el mapeo. Es deliberado: la divergencia entre un backfill
 * y su mapper ya causó que el sync siguiente reescribiera con strings vacíos lo
 * que el backfill había dejado limpio.
 *
 * Es idempotente: reejecutarlo sólo refresca el enlace.
 *
 * USO
 *   npx tsx scripts/backfill-ocds-anexos.ts --dry-run --limit 20
 *   npx tsx scripts/backfill-ocds-anexos.ts --limit 500
 *   npx tsx scripts/backfill-ocds-anexos.ts            # todas
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fetchEnlaceAnexos } from '../src/infrastructure/mercado-publico/ocds.client.ts';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const iLimit = args.indexOf('--limit');
const LIMIT = iLimit >= 0 ? Number(args[iLimit + 1]) : null;
const iConc = args.indexOf('--concurrency');
/** Conservador a propósito: OCDS es un servicio público y gratuito. */
const CONCURRENCY = iConc >= 0 ? Number(args[iConc + 1]) : 3;

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')];
    }),
);

const client = new pg.Client({ connectionString: env.BRALIDUS_DATABASE_URL });
await client.connect();

/**
 * Por defecto sólo las que todavía no tienen enlace. Reconsultar las 1.336 ya
 * escritas no aporta —el enlace sirve igual— y sí suma presión sobre un
 * servicio que ya devolvió 429. `--refrescar` fuerza todas.
 */
const REFRESCAR = args.includes('--refrescar');

const { rows } = await client.query<{ external_code: string }>(
  `select external_code
     from licitaciones_mercado_publico
    where source_type <> 'agile_purchase'
      and status_code = 'adjudicada'
      ${REFRESCAR ? '' : `and not (attachments @> '[{"origen":"ocds_award"}]'::jsonb)`}
    order by published_at desc
    ${LIMIT ? `limit ${Number(LIMIT)}` : ''}`,
);

console.log(
  `Licitaciones adjudicadas a consultar: ${rows.length}` +
    (DRY_RUN ? '  [DRY RUN — no escribe]' : '') +
    `  · concurrencia ${CONCURRENCY}`,
);

let conEnlace = 0;
let sinDocumentos = 0;
/** No se pudo preguntar. NO es lo mismo que "no tiene documentos". */
let noConsultadas = 0;
let escritas = 0;
const t0 = Date.now();

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * OCDS responde 429 sostenido. La primera corrida completa lo comió como
 * ausencia y reportó 22,8 % de cobertura donde el dry-run de 30 había dado
 * 93 %: la diferencia entera eran throttles. Ahora se reintenta con backoff y,
 * si aun así no se pudo preguntar, se cuenta aparte.
 */
async function conReintento(codigo: string) {
  for (let intento = 0; intento < 4; intento++) {
    const r = await fetchEnlaceAnexos(codigo, { adjudicada: true });
    if (r.consultado) return r;
    await dormir(500 * 2 ** intento + Math.random() * 250);
  }
  return { anexos: [], consultado: false };
}

/** Pool simple: N trabajadores tirando de la misma cola. */
const cola = [...rows];
async function trabajador() {
  for (let fila = cola.shift(); fila; fila = cola.shift()) {
    const { anexos, consultado } = await conReintento(fila.external_code);

    if (!consultado) {
      noConsultadas++;
    } else if (anexos.length === 0) {
      sinDocumentos++;
    } else {
      conEnlace++;
      if (!DRY_RUN) {
        await client.query(
          `update licitaciones_mercado_publico
              set attachments = $2::jsonb, updated_at = now()
            where external_code = $1`,
          [fila.external_code, JSON.stringify(anexos)],
        );
        escritas++;
      }
    }

    const hechas = conEnlace + sinDocumentos + noConsultadas;
    if (hechas % 250 === 0) {
      const seg = (Date.now() - t0) / 1000;
      console.log(
        `  ${hechas}/${rows.length} · enlace ${conEnlace} · sin docs ${sinDocumentos} ` +
          `· NO consultadas ${noConsultadas} · ${(hechas / seg).toFixed(1)}/s`,
      );
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, trabajador));
await client.end();

const seg = ((Date.now() - t0) / 1000).toFixed(0);
const preguntadas = conEnlace + sinDocumentos;
console.log(
  `\nTotal ${rows.length} en ${seg}s\n` +
    `  con enlace     ${conEnlace}\n` +
    `  sin documentos ${sinDocumentos}\n` +
    `  NO consultadas ${noConsultadas}  <- se ignoran, no son ausencias\n` +
    `  escritas       ${escritas}\n` +
    `Cobertura sobre las que SÍ se pudieron consultar: ` +
    `${((conEnlace / Math.max(preguntadas, 1)) * 100).toFixed(1)}%`,
);
console.log(
  'Recordatorio: esto NO son archivos descargables. Cada entrada va como ' +
    "`tipo: 'pagina'`, `descargable: false`.",
);
