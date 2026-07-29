import { query, queryOne } from '../../../infrastructure/database/client/pg-client';
import type {
  SupplierProfile,
  SupplierKeyword,
  SupplierCategory,
  SupplierProfileWithKeywords,
} from '../../../shared/types/domain.types';
import {
  mapRowToSupplierProfile,
  mapRowToSupplierKeyword,
  mapRowToSupplierCategory,
} from './supplier-profile.mapper';

export type CreateSupplierProfileInput = Omit<SupplierProfile, 'id' | 'createdAt' | 'updatedAt'>;

export type UpdateSupplierProfileInput = Partial<
  Omit<SupplierProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
>;

export class SupplierProfileRepository {
  async findByUserId(userId: string): Promise<SupplierProfileWithKeywords | null> {
    const row = await queryOne<Record<string, unknown>>(
      'SELECT * FROM supplier_profiles WHERE user_id = $1',
      [userId],
    );
    if (!row) return null;

    const profile = mapRowToSupplierProfile(row);
    const [keywords, categories] = await Promise.all([
      this.findKeywordsByProfileId(profile.id),
      this.findCategoriesByProfileId(profile.id),
    ]);
    return { ...profile, keywords, categories };
  }

  async findById(id: string): Promise<SupplierProfile | null> {
    const row = await queryOne<Record<string, unknown>>(
      'SELECT * FROM supplier_profiles WHERE id = $1',
      [id],
    );
    return row ? mapRowToSupplierProfile(row) : null;
  }

  async create(input: CreateSupplierProfileInput): Promise<SupplierProfile> {
    const row = await queryOne<Record<string, unknown>>(
      `INSERT INTO supplier_profiles (
        user_id, business_name, rut, company_size, region, commune,
        business_description, average_ticket_utm,
        interested_in_utp, utp_complementary_services,
        company_age_years, capital_range,
        beneficial_owners,
        is_women_led, has_sello_40h, hires_disabled, hires_youth, indigenous_community,
        in_convenio_marco, convenio_marco_detail
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING *`,
      [
        input.userId,
        input.businessName,
        input.rut,
        input.companySize ?? null,
        input.region ?? null,
        input.commune ?? null,
        input.businessDescription ?? null,
        input.averageTicketUtm ?? null,
        input.interestedInUtp ?? false,
        input.utpComplementaryServices ?? null,
        input.companyAgeYears ?? null,
        input.capitalRange ?? null,
        JSON.stringify(input.beneficialOwners ?? []),
        input.isWomenLed ?? false,
        input.hasSello40h ?? false,
        input.hiresDisabled ?? false,
        input.hiresYouth ?? false,
        input.indigenousCommunity ?? false,
        input.inConvenioMarco ?? false,
        input.convenioMarcoDetail ?? null,
      ],
    );

    if (!row) throw new Error('Failed to create supplier profile');
    return mapRowToSupplierProfile(row);
  }

  async update(id: string, input: UpdateSupplierProfileInput): Promise<SupplierProfile> {
    const fields = Object.entries(input)
      .filter(([, v]) => v !== undefined)
      .map(([key], i) => `${toSnakeCase(key)} = $${i + 2}`)
      .join(', ');

    const values = Object.values(input).filter((v) => v !== undefined);

    const row = await queryOne<Record<string, unknown>>(
      `UPDATE supplier_profiles SET ${fields}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values],
    );

    if (!row) throw new Error('Failed to update supplier profile');
    return mapRowToSupplierProfile(row);
  }

  async findKeywordsByProfileId(profileId: string): Promise<SupplierKeyword[]> {
    const rows = await query<Record<string, unknown>>(
      'SELECT * FROM supplier_keywords WHERE profile_id = $1 ORDER BY created_at ASC',
      [profileId],
    );
    return rows.map(mapRowToSupplierKeyword);
  }

  /** Keywords únicas (solo 'include') de TODOS los perfiles — usado por el pre-score del sync. */
  async findAllKeywords(): Promise<string[]> {
    const rows = await query<{ keyword: string }>(
      "SELECT DISTINCT keyword FROM supplier_keywords WHERE keyword_type = 'include'",
      [],
    );
    return rows.map((r) => r.keyword);
  }

  async addKeyword(
    profileId: string,
    keyword: string,
    keywordType: SupplierKeyword['keywordType'] = 'include',
  ): Promise<SupplierKeyword> {
    const row = await queryOne<Record<string, unknown>>(
      `INSERT INTO supplier_keywords (profile_id, keyword, keyword_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (profile_id, keyword) DO UPDATE SET keyword_type = EXCLUDED.keyword_type
       RETURNING *`,
      [profileId, keyword.toLowerCase().trim(), keywordType],
    );
    if (!row) throw new Error('Failed to add keyword');
    return mapRowToSupplierKeyword(row);
  }

  async deleteKeyword(keywordId: string, profileId: string): Promise<void> {
    await query('DELETE FROM supplier_keywords WHERE id = $1 AND profile_id = $2', [
      keywordId,
      profileId,
    ]);
  }

  // ── Categorías UNSPSC ────────────────────────────────────────

  async findCategoriesByProfileId(profileId: string): Promise<SupplierCategory[]> {
    const rows = await query<Record<string, unknown>>(
      'SELECT * FROM supplier_categories WHERE profile_id = $1 ORDER BY created_at ASC',
      [profileId],
    );
    return rows.map(mapRowToSupplierCategory);
  }

  async addCategory(
    profileId: string,
    categoryCode: string,
    categoryName?: string,
  ): Promise<SupplierCategory> {
    const row = await queryOne<Record<string, unknown>>(
      `INSERT INTO supplier_categories (profile_id, category_code, category_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (profile_id, category_code) DO UPDATE SET category_name = EXCLUDED.category_name
       RETURNING *`,
      [profileId, categoryCode.trim(), categoryName?.trim() ?? null],
    );
    if (!row) throw new Error('Failed to add category');
    return mapRowToSupplierCategory(row);
  }

  async deleteCategory(categoryId: string, profileId: string): Promise<void> {
    await query('DELETE FROM supplier_categories WHERE id = $1 AND profile_id = $2', [
      categoryId,
      profileId,
    ]);
  }
}

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export const supplierProfileRepository = new SupplierProfileRepository();
