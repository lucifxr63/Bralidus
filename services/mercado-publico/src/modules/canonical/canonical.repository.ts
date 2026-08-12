import { bralidusQuery } from '../../infrastructure/database/client/pg-client.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { env } from '../../app/env.js';
import type { NormalizedLicitacion } from '../../infrastructure/mercado-publico/mercado-publico.types.js';
import { toCanonicalRow, type CanonicalRow } from './canonical.mapper.js';

/**
 * Escritura en la tabla canónica de Bralidus/Animus (`licitaciones_mercado_publico`).
 *
 * Es el segundo destino del dual-write: el primero (Licitus) lo sigue haciendo
 * `opportunityRepository.upsertFromNormalized`, sin cambios. Aquí se escribe en
 * una base de datos DISTINTA (otro proyecto Supabase), por eso usa el pool
 * explícito `bralidusQuery` y no el `query` por defecto.
 *
 * **Nunca lanza**: el destino canónico es aditivo. Si Bralidus está caído o mal
 * configurado, la ingesta hacia Licitus —que es la que alimenta el producto en
 * producción— debe completar igual. Los fallos se loguean y se cuentan.
 */

const COLUMNS = [
  'external_code',
  'title',
  'buyer_name',
  'buyer_rut',
  'buyer_org_code',
  'source_type',
  'status_code',
  'amount_estimated',
  'currency',
  'published_at',
  'closing_at',
  'award_at',
  'category',
  'official_url',
  'attachments',
  'items',
  'raw_payload',
  'forum_start_at',
  'forum_end_at',
  'answers_published_at',
  'technical_opening_at',
  'economic_opening_at',
  'site_visit_at',
  'documents_deadline_at',
  'estimated_award_at',
  'estimated_sign_at',
  'buyer_unit_code',
  'buyer_unit_name',
  'buyer_region',
  'buyer_commune',
  'buyer_address',
  'buyer_contact_name',
  'buyer_contact_role',
  'contract_responsible_name',
  'contract_responsible_email',
  'contract_responsible_phone',
  'amount_is_public',
  'amount_estimation_type',
  'amount_justification',
] as const;

/** JSONB y timestamptz necesitan cast explícito en un INSERT parametrizado multi-fila. */
const COLUMN_CASTS: Partial<Record<(typeof COLUMNS)[number], string>> = {
  amount_estimated: '::numeric',
  published_at: '::timestamptz',
  closing_at: '::timestamptz',
  award_at: '::timestamptz',
  attachments: '::jsonb',
  items: '::jsonb',
  raw_payload: '::jsonb',
  forum_start_at: '::timestamptz',
  forum_end_at: '::timestamptz',
  answers_published_at: '::timestamptz',
  technical_opening_at: '::timestamptz',
  economic_opening_at: '::timestamptz',
  site_visit_at: '::timestamptz',
  documents_deadline_at: '::timestamptz',
  estimated_award_at: '::timestamptz',
  estimated_sign_at: '::timestamptz',
  amount_is_public: '::boolean',
  amount_estimation_type: '::smallint',
};

/**
 * El orden DEBE calzar con `COLUMNS` posición a posición. Se deriva de ahí en
 * vez de repetirse a mano: eran dos listas paralelas de 17 elementos y ahora
 * son de 39, así que un desajuste dejó de ser hipotético — y no lo detectaría
 * el compilador, sino un INSERT que guarda el teléfono en la comuna.
 */
const VALORES: Record<(typeof COLUMNS)[number], (row: CanonicalRow) => unknown> = {
  external_code: (r) => r.external_code,
  title: (r) => r.title,
  buyer_name: (r) => r.buyer_name,
  buyer_rut: (r) => r.buyer_rut,
  buyer_org_code: (r) => r.buyer_org_code,
  source_type: (r) => r.source_type,
  status_code: (r) => r.status_code,
  amount_estimated: (r) => r.amount_estimated,
  currency: (r) => r.currency,
  published_at: (r) => r.published_at,
  closing_at: (r) => r.closing_at,
  award_at: (r) => r.award_at,
  category: (r) => r.category,
  official_url: (r) => r.official_url,
  attachments: (r) => JSON.stringify(r.attachments),
  items: (r) => JSON.stringify(r.items),
  raw_payload: (r) => JSON.stringify(r.raw_payload),
  forum_start_at: (r) => r.forum_start_at,
  forum_end_at: (r) => r.forum_end_at,
  answers_published_at: (r) => r.answers_published_at,
  technical_opening_at: (r) => r.technical_opening_at,
  economic_opening_at: (r) => r.economic_opening_at,
  site_visit_at: (r) => r.site_visit_at,
  documents_deadline_at: (r) => r.documents_deadline_at,
  estimated_award_at: (r) => r.estimated_award_at,
  estimated_sign_at: (r) => r.estimated_sign_at,
  buyer_unit_code: (r) => r.buyer_unit_code,
  buyer_unit_name: (r) => r.buyer_unit_name,
  buyer_region: (r) => r.buyer_region,
  buyer_commune: (r) => r.buyer_commune,
  buyer_address: (r) => r.buyer_address,
  buyer_contact_name: (r) => r.buyer_contact_name,
  buyer_contact_role: (r) => r.buyer_contact_role,
  contract_responsible_name: (r) => r.contract_responsible_name,
  contract_responsible_email: (r) => r.contract_responsible_email,
  contract_responsible_phone: (r) => r.contract_responsible_phone,
  amount_is_public: (r) => r.amount_is_public,
  amount_estimation_type: (r) => r.amount_estimation_type,
  amount_justification: (r) => r.amount_justification,
};

function toParams(row: CanonicalRow): unknown[] {
  return COLUMNS.map((col) => VALORES[col](row));
}

/** Filas por INSERT. Postgres tope ~65535 parámetros; 39 columnas → 500×39 = 19.500. */
const BATCH_SIZE = 500;

export interface CanonicalWriteResult {
  attempted: number;
  written: number;
  failed: number;
}

class CanonicalRepository {
  /**
   * Bulk upsert por `external_code`. Un solo round-trip por lote — el patrón que
   * justificó mover el motor en TypeScript en vez de reescribirlo sobre
   * PostgREST, que no admite UPDATE masivo con valores distintos por fila.
   */
  async upsertMany(normalized: NormalizedLicitacion[]): Promise<CanonicalWriteResult> {
    const result: CanonicalWriteResult = { attempted: 0, written: 0, failed: 0 };

    if (!env.DUAL_WRITE_ENABLED || normalized.length === 0) return result;

    const rows = normalized.map(toCanonicalRow);
    result.attempted = rows.length;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);

      const values: string[] = [];
      const params: unknown[] = [];
      let p = 1;
      for (const row of batch) {
        const placeholders = COLUMNS.map((col) => `$${p++}${COLUMN_CASTS[col] ?? ''}`);
        values.push(`(${placeholders.join(', ')})`);
        params.push(...toParams(row));
      }

      // Todas las columnas menos external_code (la clave del conflicto) se
      // refrescan: un registro de MP cambia de estado, monto y fechas con el
      // tiempo y la fila canónica debe reflejar el último dato conocido.
      const updates = COLUMNS.filter((c) => c !== 'external_code')
        .map((c) => `${c} = EXCLUDED.${c}`)
        .join(', ');

      try {
        await bralidusQuery(
          `INSERT INTO licitaciones_mercado_publico (${COLUMNS.join(', ')})
           VALUES ${values.join(', ')}
           ON CONFLICT (external_code) DO UPDATE SET ${updates}`,
          params,
        );
        result.written += batch.length;
      } catch (err) {
        result.failed += batch.length;
        logger.error(
          { err, batch: batch.length, firstCode: batch[0]?.external_code },
          '[canonical] fallo al escribir lote en licitaciones_mercado_publico',
        );
      }
    }

    if (result.written > 0) {
      logger.info(
        { written: result.written, failed: result.failed },
        '[canonical] dual-write completado',
      );
    }

    return result;
  }

  /** Atajo de una fila (mismo camino que el bulk). */
  async upsertOne(normalized: NormalizedLicitacion): Promise<CanonicalWriteResult> {
    return this.upsertMany([normalized]);
  }

  /** Conteo — lo usa la verificación end-to-end del dual-write. */
  async count(): Promise<number> {
    const rows = await bralidusQuery<{ count: string }>(
      'SELECT COUNT(*) AS count FROM licitaciones_mercado_publico',
    );
    return parseInt(rows[0]?.count ?? '0', 10);
  }
}

export const canonicalRepository = new CanonicalRepository();
