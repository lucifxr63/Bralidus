import type { ISODateString } from '../../../shared/types/common.types.js';

export type BuyerReputation = {
  buyerOrgCode: string;
  buyerOrgName: string | null;
  avgSupplierRating: number | null; // 1-5 escala Mercado Público
  totalRatingCount: number;
  totalOrdersCount: number;
  totalSpentClp: number | null;
  lastOrderAt: ISODateString | null;
  updatedAt: ISODateString;
};

export type ReputationLabel = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';

export type ReputationScore = {
  score: number; // 0-100 normalizado
  label: ReputationLabel;
  rawRating: number | null; // Rating original 1-5 de MP
  totalEvaluations: number;
};
