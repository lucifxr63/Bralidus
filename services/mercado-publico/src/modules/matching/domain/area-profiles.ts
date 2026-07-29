/**
 * Especialización del matching por área/rubro (§3.3 del plan).
 *
 * El área se deriva de señales ya normalizadas: segmento UNSPSC dominante
 * de los items (2 primeros dígitos) y heurística sobre el título.
 *
 * - obras:     segmento 72 (servicios de construcción) o título con términos
 *              de obra → la cercanía regional pesa más (logística).
 * - servicios: segmentos UNSPSC 70–94 → duración/renovabilidad del contrato
 *              importan (ingreso recurrente).
 * - bienes:    segmentos 10–60 → el match UNSPSC fino (clase, 6 dígitos)
 *              vale más que el de familia.
 */

import { normalizeText } from '../../../shared/utils/strings';

export type OpportunityArea = 'obras' | 'servicios' | 'bienes' | 'desconocida';

const OBRAS_TITLE_PATTERN =
  /\b(obra|obras|construccion|edificacion|pavimentacion|demolicion|remodelacion|habilitacion|mejoramiento de infraestructura|conservacion vial)\b/;

export function resolveArea(
  title: string,
  items: Array<{ categoryCode: string | null }>,
): OpportunityArea {
  // Segmentos UNSPSC de los items (2 primeros dígitos)
  const segments: number[] = [];
  for (const item of items) {
    const code = item.categoryCode?.trim();
    if (!code || code.length < 2) continue;
    const segment = parseInt(code.slice(0, 2), 10);
    if (!Number.isNaN(segment) && segment >= 10 && segment <= 95) {
      segments.push(segment);
    }
  }

  // Obras: segmento 72 presente o título inequívoco
  if (segments.includes(72) || OBRAS_TITLE_PATTERN.test(normalizeText(title))) {
    return 'obras';
  }

  if (segments.length === 0) return 'desconocida';

  // Mayoría simple: servicios (70–94) vs bienes (10–60)
  const servicios = segments.filter((s) => s >= 70).length;
  const bienes = segments.filter((s) => s <= 60).length;
  if (servicios === 0 && bienes === 0) return 'desconocida';
  return servicios >= bienes ? 'servicios' : 'bienes';
}

// ── Modificadores por área ───────────────────────────────────

/** Multiplicador de peso regional para obras (cercanía = logística). */
export const OBRAS_REGION_MULTIPLIER = 1.5;

/** Bono por contrato renovable en servicios (ingreso recurrente). */
export const SERVICIOS_RENEWABLE_BONUS = 5;

/** Reclamos del comprador sobre este umbral generan warning. */
export const COMPLAINTS_WARNING_THRESHOLD = 5;

/**
 * Valor relativo del match UNSPSC según nivel de precisión y área.
 * En bienes el nivel clase (6 dígitos) discrimina más que la familia.
 */
export function unspscTierRatio(
  area: OpportunityArea,
  tier: 'exact' | 'class' | 'family',
): number {
  if (tier === 'exact') return 1;
  if (area === 'bienes') return tier === 'class' ? 0.8 : 0.5;
  return tier === 'class' ? 0.8 : 0.6;
}
