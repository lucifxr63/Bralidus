/**
 * Conversión a UTC de la hora de pared chilena que publica Mercado Público.
 *
 * POR QUÉ EXISTE
 * --------------
 * MP entrega los timestamps SIN zona ("2026-05-14T17:57:00", "2026-07-29 12:00")
 * y son hora de Chile. `new Date(str)` resuelve un string así contra la zona
 * DEL PROCESO, así que el mismo dato daba distinto según dónde corriera la
 * ingesta.
 *
 * Medido el 2026-08-11 sobre la tabla canónica: `closing_at` tenía TRES
 * convenios mezclados en la misma columna —+4 h (backfill local, invierno),
 * +3 h (backfill local, verano) y +0 h (mp-sync en Vercel, que corre en UTC)—.
 * El desglose por mes calzaba exactamente con el horario de verano chileno, que
 * es lo que confirmó el diagnóstico. 2.111 de las 2.115 licitaciones abiertas
 * tenían la hora de cierre corrida 3–4 horas.
 *
 * NO se hardcodea el offset. Chile cambia sus reglas de horario de verano por
 * decreto —lo hizo en 2015, 2016 y 2019— y Magallanes va en otra zona. La base
 * tz del runtime, vía `Intl`, es lo único que se mantiene solo.
 */

const SANTIAGO_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Santiago',
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** El instante `t` visto como reloj de pared en Santiago, medido en ms UTC. */
function relojSantiago(t: number): number {
  const p: Record<string, string> = {};
  for (const parte of SANTIAGO_PARTS.formatToParts(new Date(t))) {
    if (parte.type !== 'literal') p[parte.type] = parte.value;
  }
  // `hour12: false` emite "24" para medianoche en algunos runtimes.
  const hora = p.hour === '24' ? 0 : Number(p.hour);
  return Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    hora,
    Number(p.minute),
    Number(p.second),
  );
}

/**
 * Formato sin zona, anclado. Si el string trae `Z` o un offset explícito NO
 * calza, y entonces ya es inequívoco: se respeta tal cual. Esa es toda la
 * distinción entre "hay que interpretarlo" y "ya viene interpretado".
 */
const SIN_ZONA = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3})\d*)?$/;

/**
 * Devuelve un ISO-8601 en UTC, o `null` si el valor no es una fecha usable.
 *
 * En los dos instantes del año en que el reloj de pared es ambiguo (el que se
 * repite al volver del horario de verano) se elige uno de los dos. Es
 * inevitable sin un offset en la fuente, y afecta a una hora al año.
 */
export function parseFechaChile(value: string | null | undefined): string | null {
  if (!value) return null;
  const txt = value.trim();
  if (!txt) return null;

  const m = SIN_ZONA.exec(txt);
  if (!m) {
    const d = new Date(txt);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  const pared = Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    m[6] ? Number(m[6]) : 0,
  );
  // Los milisegundos se reservan aparte y se reponen al final: `Intl` no los
  // expone, así que `relojSantiago` trunca al segundo y arrastrarlos por el
  // cálculo del offset los duplicaba (MP los manda en `FechaPublicacion`).
  const milis = m[7] ? Number(m[7].padEnd(3, '0')) : 0;

  // Buscamos `t` tal que relojSantiago(t) === pared. La primera pasada aplica
  // el offset del instante aproximado; la segunda lo corrige si ese instante
  // caía al otro lado de un cambio de horario.
  let t = pared;
  for (let i = 0; i < 2; i++) t = pared + (t - relojSantiago(t));

  const d = new Date(t + milis);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
