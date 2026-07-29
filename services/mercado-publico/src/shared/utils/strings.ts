/**
 * String normalization helpers.
 */

/** Lowercase + remove diacritics. Used for fuzzy matching. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Convert camelCase to snake_case for dynamic SQL building. */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/** Truncate a string to maxLen, appending '...' if truncated. */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/** Remove extra whitespace and trim. */
export function cleanText(str: string | null | undefined): string | null {
  if (!str) return null;
  const cleaned = str.replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : null;
}
