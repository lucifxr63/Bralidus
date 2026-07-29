import { UUID, ISODateString, CLP } from './common.types';

// ============================================================
// User
// ============================================================
export type UserRole = 'user' | 'admin';

export type User = {
  id: UUID;
  authId: UUID;
  email: string;
  fullName: string | null;
  role: UserRole;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

// ============================================================
// Supplier Profile
// ============================================================
export type CompanySize = 'micro' | 'small' | 'medium' | 'large';
export type CapitalRange = 'lt_500utm' | '500_2000utm' | '2000_10000utm' | 'gt_10000utm';

export type BeneficialOwner = {
  rut: string;
  name: string;
};

export type SupplierProfile = {
  id: UUID;
  userId: UUID;
  businessName: string;
  rut: string;
  companySize: CompanySize | null;
  region: string | null;
  commune: string | null;
  businessDescription: string | null;
  /** Ticket promedio expresado en UTM (la normativa opera en UTM) */
  averageTicketUtm: number | null;
  /** @deprecated Usar averageTicketUtm */
  averageTicketClp: CLP | null;
  // UTP (reemplaza subcontratación — la UTP es exclusiva para PYMES desde Ley 21.634)
  interestedInUtp: boolean;
  utpComplementaryServices: string | null;
  // Capacidad y antigüedad (para matching UTP confiable)
  companyAgeYears: number | null;
  capitalRange: CapitalRange | null;
  // Beneficiarios finales (probidad Ley N° 21.634)
  beneficialOwners: BeneficialOwner[];
  // Criterios de inclusión social / sustentabilidad
  isWomenLed: boolean;
  hasSello40h: boolean;
  hiresDisabled: boolean;
  hiresYouth: boolean;
  indigenousCommunity: boolean;
  // Convenio Marco
  inConvenioMarco: boolean;
  convenioMarcoDetail: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type SupplierKeywordType = 'include' | 'exclude';

export type SupplierKeyword = {
  id: UUID;
  profileId: UUID;
  keyword: string;
  /** 'include' suma al match; 'exclude' penaliza cuando aparece en la licitación */
  keywordType: SupplierKeywordType;
  createdAt: ISODateString;
};

export type SupplierCategory = {
  id: UUID;
  profileId: UUID;
  categoryCode: string;
  categoryName: string | null;
  createdAt: ISODateString;
};

export type SupplierProfileWithKeywords = SupplierProfile & {
  keywords: SupplierKeyword[];
  categories: SupplierCategory[];
};

// ============================================================
// Opportunity
// ============================================================
/**
 * Código de tipo de licitación de Mercado Público (L1, LE, LP, LQ, LR, CO, B2, E2, CD…).
 * El catálogo canónico vive en shared/constants/tender-types.ts; se tipa como
 * string porque la API puede devolver códigos fuera del catálogo.
 */
export type TenderTypeCode = string;

/** Estado textual de la oportunidad; los códigos numéricos van en statusCode. */
export type OpportunityStatus = string;

/** Área derivada de UNSPSC + título (matching/domain/area-profiles.ts). */
export type OpportunityAreaValue = 'obras' | 'servicios' | 'bienes' | 'desconocida';

export type Opportunity = {
  id: UUID;
  externalCode: string;
  sourceType: string;
  /** Dueño de la oportunidad cuando source_type = 'private'; null para MP. */
  createdBy: UUID | null;
  title: string;
  description: string | null;
  statusCode: string | null;
  statusLabel: string | null;
  tenderTypeCode: TenderTypeCode | null;
  tenderTypeLabel: string | null;
  area: OpportunityAreaValue | null;
  buyerOrgCode: string | null;
  buyerOrgName: string | null;
  buyerUnitCode: string | null;
  buyerUnitName: string | null;
  buyerRegion: string | null;
  buyerCommune: string | null;
  publishedAt: ISODateString | null;
  closingAt: ISODateString | null;
  estimatedAwardAt: ISODateString | null;
  currency: string | null;
  estimatedAmount: number | null;
  amountVisibility: string | null;
  paymentModalityCode: string | null;
  contractDurationValue: number | null;
  contractDurationLabel: string | null;
  allowsSubcontracting: boolean | null;
  daysToClose: number | null;
  complaintsCount: number | null;
  isRenewable: boolean | null;
  awardActUrl: string | null;
  amountIsPublic: boolean | null;
  /** Fecha de visita a terreno (obras) — FechaVisitaTerreno. */
  siteVisitAt: ISODateString | null;
  /** Requiere Toma de Razón de Contraloría — TomaRazon. */
  requiresContraloria: boolean | null;
  rawPayloadJson: Record<string, unknown> | null;
  normalizedPayloadJson: Record<string, unknown> | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type OpportunityItem = {
  id: UUID;
  opportunityId: UUID;
  lineNumber: number | null;
  productCode: string | null;
  categoryCode: string | null;
  categoryName: string | null;
  productName: string | null;
  description: string | null;
  unitMeasure: string | null;
  quantity: number | null;
  createdAt: ISODateString;
};

export type OpportunityWithItems = Opportunity & {
  items: OpportunityItem[];
};

// ============================================================
// Analysis
// ============================================================
export type AnalysisRecommendation = 'apply' | 'review' | 'discard';
export type ImportanceLevel = 'high' | 'medium' | 'low';

export type AnalysisDeadline = {
  label: string;
  date: string;
  importance: ImportanceLevel;
};

export type AnalysisChecklistItem = {
  task: string;
  priority: ImportanceLevel;
  legalReference: string | null;
};

export type OpportunityAnalysis = {
  id: UUID;
  opportunityId: UUID;
  executiveSummary: string | null;
  requirementsJson: string[] | null;
  deadlinesJson: AnalysisDeadline[] | null;
  risksJson: string[] | null;
  checklistJson: AnalysisChecklistItem[] | null;
  recommendation: AnalysisRecommendation | null;
  reasoning: string | null;
  matchScore: number | null;
  matchReasoning: MatchResult | null;
  winProbability: number | null;
  llmProvider: string | null;
  llmModel: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

// ============================================================
// Matching
// ============================================================
export type PriorityLevel = 'high' | 'medium' | 'low';

export type MatchResult = {
  matchScore: number;
  priorityLevel: PriorityLevel;
  matchedKeywords: string[];
  matchedCategories: string[];
  reasons: string[];
  warnings: string[];
};

/** Match heurístico persistido por (usuario, oportunidad). */
export type UserOpportunityMatch = {
  id: UUID;
  userId: UUID;
  opportunityId: UUID;
  matchScore: number;
  priorityLevel: PriorityLevel;
  matchedKeywords: string[];
  matchedCategories: string[];
  engineVersion: number;
  profileHash: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

// ============================================================
// Purchase Order
// ============================================================
export type PurchaseOrder = {
  id: UUID;
  externalCode: string;
  licitationCode: string | null;
  orderTypeCode: string | null;
  orderTypeLabel: string | null;
  stateCode: string | null;
  supplierStateLabel: string | null;
  buyerOrgCode: string | null;
  buyerOrgName: string | null;
  supplierCode: string | null;
  supplierName: string | null;
  totalNet: number | null;
  taxes: number | null;
  total: number | null;
  currency: string | null;
  supplierRating: number | null;
  supplierRatingCount: number | null;
  issuedAt: ISODateString | null;
  acceptedAt: ISODateString | null;
  rawPayloadJson: Record<string, unknown> | null;
  normalizedPayloadJson: Record<string, unknown> | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type PurchaseOrderItem = {
  id: UUID;
  purchaseOrderId: UUID;
  lineNumber: number | null;
  productCode: string | null;
  categoryCode: string | null;
  categoryName: string | null;
  buyerSpec: string | null;
  supplierSpec: string | null;
  quantity: number | null;
  unitNetPrice: number | null;
  total: number | null;
  createdAt: ISODateString;
};

// ============================================================
// Notifications
// ============================================================
export type NotificationChannel = 'internal' | 'email' | 'push';

/** Evento que originó la notificación (catálogo §4.2 del plan). */
export type NotificationType =
  | 'generic'
  | 'match.new'
  | 'analysis.ready'
  | 'opportunity.closing_soon'
  | 'opportunity.status_changed'
  | 'digest.daily'
  | 'compliance.blocked'
  // Etapa 3: alertas post-adjudicación (módulo contracts)
  | 'contract.guarantee_expiring'
  | 'contract.milestone_due'
  | 'contract.renewal_soon';

export type Notification = {
  id: UUID;
  userId: UUID;
  opportunityId: UUID | null;
  channel: NotificationChannel;
  type: NotificationType;
  title: string;
  body: string | null;
  /** Datos estructurados del evento (score, externalCode, deadline…) */
  payload: Record<string, unknown>;
  /** Clave de deduplicación por usuario; null = sin dedupe */
  dedupeKey: string | null;
  isRead: boolean;
  /** Intentos de envío por canal externo (dispatcher outbox) */
  attempts: number;
  sentAt: ISODateString | null;
  createdAt: ISODateString;
};

export type NotificationMode = 'instant' | 'digest' | 'off';

export type NotificationPreferences = {
  userId: UUID;
  minMatchScore: number;
  mode: NotificationMode;
  channels: Record<string, string[]>;
  digestHourUtc: number;
  updatedAt: ISODateString;
};

// ============================================================
// Saved Opportunity
// ============================================================
export type SavedOpportunityStatus =
  | 'saved'
  | 'in_progress'
  | 'submitted'
  | 'won'
  | 'lost'
  | 'discarded';

export type SavedOpportunity = {
  id: UUID;
  userId: UUID;
  opportunityId: UUID;
  status: SavedOpportunityStatus;
  notes: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

// ============================================================
// Opportunity Pipeline
// ============================================================
export type PipelineStatus =
  | 'new'
  | 'reviewing'
  | 'interested'
  | 'preparing'
  | 'submitted'
  | 'won'
  | 'lost'
  | 'discarded';

export type DiscardReason =
  | 'not_relevant'
  | 'requirements_high'
  | 'budget_mismatch'
  | 'no_capacity'
  | 'competitor_strong'
  | 'other';

export type PipelineEntry = {
  id: UUID;
  userId: UUID;
  opportunityId: UUID;
  status: PipelineStatus;
  statusUpdatedAt: ISODateString;
  notes: string | null;
  discardReason: DiscardReason | null;
  submittedAt: ISODateString | null;
  submissionNotes: string | null;
  resultNotifiedAt: ISODateString | null;
  wonAmountClp: number | null;
  lossReason: string | null;
  relevanceScore: number | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type PipelineEntryWithOpportunity = PipelineEntry & {
  opportunity: {
    id: UUID;
    externalCode: string;
    title: string;
    buyerOrgName: string;
    estimatedAmountClp: number | null;
    closingDate: ISODateString | null;
    tenderTypeCode: string | null;
    region: string | null;
  };
  analysis: {
    matchScore: number | null;
    recommendation: string | null;
    winProbability: number | null;
  } | null;
};

export type PipelineStats = {
  byStatus: Record<PipelineStatus, number>;
  totalActive: number;
  totalSubmitted: number;
  totalWon: number;
  winRatePct: number | null;
  totalWonClp: number;
};
