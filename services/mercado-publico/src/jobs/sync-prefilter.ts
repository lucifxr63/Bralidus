/**
 * Pre-filtro del listado de licitaciones antes de pagar el fetch de detalle.
 *
 * El listado por fecha de MP ya incluye CodigoEstado, Tipo y Nombre; con eso
 * se descartan licitaciones que hoy terminan como NOT_FOUND (borradores,
 * canceladas) o que ningún perfil podría matchear (pre-score opt-in).
 *
 * Función pura — sin side effects, fully testable.
 */

import type { MpLicitacionRaw } from '../infrastructure/mercado-publico/mercado-publico.types.js';
import { isPymeFriendly } from '../shared/constants/tender-types.js';
import { normalizeText } from '../shared/utils/strings.js';

/** CodigoEstado 5 = Publicada (única con detalle garantizado en la API) */
export const MP_STATUS_PUBLICADA = 5;

export type StatusFilter = number[] | 'all';

export type PrefilterOptions = {
  /** CodigoEstado permitidos, o 'all' para no filtrar por estado */
  statusFilter: StatusFilter;
  /**
   * Keywords agregadas de todos los perfiles activos (sin normalizar).
   * null = pre-score deshabilitado. Solo descarta tipos NO PYME-friendly:
   * las Compras Ágiles y L1/LE se ingieren siempre.
   */
  prescoreKeywords: string[] | null;
  /** Filtro manual: solo estos tipos de licitación (L1, LE, LP…). Vacío/undefined = todos. */
  tenderTypes?: string[];
  /** Filtro manual: solo licitaciones cuyo título contenga este texto (sin acentos). */
  titleKeyword?: string;
};

export type PrefilterResult = {
  codigos: string[];
  discardedByStatus: number;
  discardedByPrescore: number;
  discardedByTipo: number;
  discardedByTitle: number;
};

/** Parsea el valor de env SYNC_STATUS_CODES ('5', '5,6,8' o 'all'). */
export function parseStatusFilter(raw: string): StatusFilter {
  if (raw.trim().toLowerCase() === 'all') return 'all';
  const codes = raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n));
  return codes.length > 0 ? codes : 'all';
}

export function prefilterListado(
  items: MpLicitacionRaw[],
  options: PrefilterOptions,
): PrefilterResult {
  const result: PrefilterResult = {
    codigos: [],
    discardedByStatus: 0,
    discardedByPrescore: 0,
    discardedByTipo: 0,
    discardedByTitle: 0,
  };

  const normalizedKeywords =
    options.prescoreKeywords && options.prescoreKeywords.length > 0
      ? options.prescoreKeywords.map((k) => normalizeText(k.trim())).filter((k) => k.length > 0)
      : null;

  const tipoFilter =
    options.tenderTypes && options.tenderTypes.length > 0
      ? new Set(options.tenderTypes.map((t) => t.toUpperCase().trim()))
      : null;

  const titleFilter = options.titleKeyword ? normalizeText(options.titleKeyword.trim()) : null;

  for (const item of items) {
    if (!item.CodigoExterno) continue;

    // ── Filtro por estado ─────────────────────────────────────
    // Si el listado no trae CodigoEstado se mantiene (beneficio de la duda).
    if (
      options.statusFilter !== 'all' &&
      typeof item.CodigoEstado === 'number' &&
      !options.statusFilter.includes(item.CodigoEstado)
    ) {
      result.discardedByStatus++;
      continue;
    }

    // ── Filtro manual por tipo de licitación ──────────────────
    if (tipoFilter && (!item.Tipo || !tipoFilter.has(item.Tipo.toUpperCase()))) {
      result.discardedByTipo++;
      continue;
    }

    // ── Filtro manual por texto en el título ──────────────────
    if (titleFilter && !normalizeText(item.Nombre ?? '').includes(titleFilter)) {
      result.discardedByTitle++;
      continue;
    }

    // ── Pre-score por título ──────────────────────────────────
    // Solo descarta tipos no PYME-friendly sin ningún hit de keyword.
    if (normalizedKeywords && item.Tipo && !isPymeFriendly(item.Tipo)) {
      const title = normalizeText(item.Nombre ?? '');
      const hasHit = normalizedKeywords.some((kw) => title.includes(kw));
      if (!hasHit) {
        result.discardedByPrescore++;
        continue;
      }
    }

    result.codigos.push(item.CodigoExterno);
  }

  return result;
}
