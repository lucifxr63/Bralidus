import type {
  SupplierProfile,
  SupplierKeyword,
  SupplierCategory,
} from '../../../shared/types/domain.types';

export function mapRowToSupplierProfile(row: Record<string, unknown>): SupplierProfile {
  return {
    id: row['id'] as string,
    userId: row['user_id'] as string,
    businessName: row['business_name'] as string,
    rut: row['rut'] as string,
    companySize: (row['company_size'] as SupplierProfile['companySize']) ?? null,
    region: (row['region'] as string) ?? null,
    commune: (row['commune'] as string) ?? null,
    businessDescription: (row['business_description'] as string) ?? null,
    averageTicketUtm: row['average_ticket_utm'] != null ? Number(row['average_ticket_utm']) : null,
    averageTicketClp: row['average_ticket_clp'] != null ? Number(row['average_ticket_clp']) : null,
    interestedInUtp: Boolean(row['interested_in_utp']),
    utpComplementaryServices: (row['utp_complementary_services'] as string) ?? null,
    companyAgeYears: row['company_age_years'] != null ? Number(row['company_age_years']) : null,
    capitalRange: (row['capital_range'] as SupplierProfile['capitalRange']) ?? null,
    beneficialOwners: Array.isArray(row['beneficial_owners'])
      ? (row['beneficial_owners'] as SupplierProfile['beneficialOwners'])
      : [],
    isWomenLed: Boolean(row['is_women_led']),
    hasSello40h: Boolean(row['has_sello_40h']),
    hiresDisabled: Boolean(row['hires_disabled']),
    hiresYouth: Boolean(row['hires_youth']),
    indigenousCommunity: Boolean(row['indigenous_community']),
    inConvenioMarco: Boolean(row['in_convenio_marco']),
    convenioMarcoDetail: (row['convenio_marco_detail'] as string) ?? null,
    createdAt: new Date(row['created_at'] as string).toISOString(),
    updatedAt: new Date(row['updated_at'] as string).toISOString(),
  };
}

export function mapRowToSupplierKeyword(row: Record<string, unknown>): SupplierKeyword {
  return {
    id: row['id'] as string,
    profileId: row['profile_id'] as string,
    keyword: row['keyword'] as string,
    keywordType: (row['keyword_type'] as SupplierKeyword['keywordType']) ?? 'include',
    createdAt: new Date(row['created_at'] as string).toISOString(),
  };
}

export function mapRowToSupplierCategory(row: Record<string, unknown>): SupplierCategory {
  return {
    id: row['id'] as string,
    profileId: row['profile_id'] as string,
    categoryCode: row['category_code'] as string,
    categoryName: (row['category_name'] as string) ?? null,
    createdAt: new Date(row['created_at'] as string).toISOString(),
  };
}
