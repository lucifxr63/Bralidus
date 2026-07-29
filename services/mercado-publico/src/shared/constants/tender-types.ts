/**
 * Códigos de mecanismo de compra de Mercado Público.
 *
 * OJO — `COT` (Compra Ágil) NO es un tipo de licitación del DS 250: es un
 * mecanismo aparte, con su propia API (`api2.mercadopublico.cl/v2/compra-agil`)
 * y su propio ciclo de vida (dos llamados, cotizaciones en vez de ofertas).
 * Se modela junto a los tipos de licitación porque comparte tabla
 * (`opportunities.tender_type_code`), no porque sea uno de ellos.
 *
 * Fuentes: DS 250/2004 art. 25 (tipos de licitación), Ley 21.634 (Compra Ágil).
 */

export const TENDER_TYPE = {
  L1: 'L1', // Licitación menor a 100 UTM  (~CLP 7M)   → PYME-friendly
  LE: 'LE', // 100 a 1.000 UTM             (~CLP 71M)  → PYME-friendly
  LP: 'LP', // 1.000 a 2.000 UTM                       → Mediana
  LQ: 'LQ', // 2.000 a 5.000 UTM                       → Grande
  LR: 'LR', // ≥ 5.000 UTM                             → Grande
  CO: 'CO', // Convenio Marco                          → Catálogo
  B2: 'B2', // Licitación con oferta electrónica simplificada (NO es Compra Ágil)
  E2: 'E2', // Trato Directo                           → Evaluar caso a caso
  CD: 'CD', // Convenio de Suministro
  COT: 'COT', // Compra Ágil ≤ 100 UTM — mecanismo propio → PYME-friendly
} as const;

export type TenderTypeCode = (typeof TENDER_TYPE)[keyof typeof TENDER_TYPE];

export const TENDER_TYPE_LABELS: Record<TenderTypeCode, string> = {
  L1: 'Licitación menor a 100 UTM',
  LE: 'Licitación 100 a 1.000 UTM',
  LP: 'Licitación 1.000 a 2.000 UTM',
  LQ: 'Licitación 2.000 a 5.000 UTM',
  LR: 'Licitación mayor a 5.000 UTM',
  CO: 'Convenio Marco',
  B2: 'Licitación simplificada',
  E2: 'Trato Directo',
  CD: 'Convenio de Suministro',
  COT: 'Compra Ágil',
};

/** Types ideal for PYMEs (small amounts, simpler process) */
export const PYME_FRIENDLY_TENDER_TYPES: TenderTypeCode[] = ['COT', 'L1', 'LE', 'B2'];

/** Types that typically require larger companies */
export const LARGE_TENDER_TYPES: TenderTypeCode[] = ['LP', 'LQ', 'LR'];

export function isPymeFriendly(code: string): boolean {
  return PYME_FRIENDLY_TENDER_TYPES.includes(code as TenderTypeCode);
}

export function isLargeTender(code: string): boolean {
  return LARGE_TENDER_TYPES.includes(code as TenderTypeCode);
}

/** Compra Ágil: reservada a PYMEs y con tope legal de 100 UTM (Ley 21.634). */
export function isCompraAgil(code: string | null | undefined): boolean {
  return code?.toUpperCase() === TENDER_TYPE.COT;
}
