// Enums / structural classification types + their Zod schemas.
export {
  DISCOVERY_SECTION_IDS,
  DISCOVERY_QUESTION_KINDS,
  OFFERING_KINDS,
  EVIDENCE_SOURCE_KINDS,
  GOAL_HORIZONS,
  ASSUMPTION_CONFIDENCE,
  GAP_SEVERITIES,
  discoverySectionIdSchema,
  discoveryQuestionKindSchema,
  offeringKindSchema,
  evidenceSourceKindSchema,
  goalHorizonSchema,
  assumptionConfidenceSchema,
  gapSeveritySchema,
} from './enums';
export type {
  DiscoverySectionId,
  DiscoveryQuestionKind,
  OfferingKind,
  EvidenceSourceKind,
  GoalHorizon,
  AssumptionConfidence,
  GapSeverity,
} from './enums';

// Domain model types + their Zod schemas.
export { evidenceSourceRefSchema } from './evidence-source-ref';
export type { EvidenceSourceRef } from './evidence-source-ref';

export { customerSegmentSchema } from './customer-segment';
export type { CustomerSegment } from './customer-segment';

export { offeringSchema } from './offering';
export type { Offering } from './offering';

export { competitorReferenceSchema } from './competitor-reference';
export type { CompetitorReference } from './competitor-reference';

export { businessGoalSchema } from './business-goal';
export type { BusinessGoal } from './business-goal';

export { businessAssumptionSchema } from './business-assumption';
export type { BusinessAssumption } from './business-assumption';

export { discoveryGapSchema } from './discovery-gap';
export type { DiscoveryGap } from './discovery-gap';

export { discoveryQuestionSchema } from './discovery-question';
export type { DiscoveryQuestion } from './discovery-question';

export { discoveryAnswerSchema } from './discovery-answer';
export type { DiscoveryAnswer } from './discovery-answer';

export { discoverySectionSchema } from './discovery-section';
export type { DiscoverySection } from './discovery-section';

export { businessDiscoveryProfileSchema } from './business-discovery-profile';
export type { BusinessDiscoveryProfile } from './business-discovery-profile';

// Questionnaire definition layer (curated sections/questions + Zod schemas).
export {
  PROFILE_SIGNALS,
  profileSignalSchema,
  businessDiscoveryQuestionnaireVersionSchema,
  businessDiscoveryQuestionnaireQuestionSchema,
  businessDiscoveryQuestionnaireSectionSchema,
  businessDiscoveryQuestionnaireSchema,
} from './questionnaire';
export type {
  ProfileSignal,
  BusinessDiscoveryQuestionnaireVersion,
  BusinessDiscoveryQuestionnaireQuestion,
  BusinessDiscoveryQuestionnaireSection,
  BusinessDiscoveryQuestionnaire,
} from './questionnaire';

// Curated default questionnaire (static definition, no side effects).
export { DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE } from './default-questionnaire';

// Questionnaire validation (pure, deterministic completeness check).
export {
  questionnaireValidationResultSchema,
  validateProfileAgainstQuestionnaire,
} from './questionnaire-validation';
export type { QuestionnaireValidationResult } from './questionnaire-validation';

// BIF-compatible projection shape (local; not wired into @age/bif — see file note).
export {
  BIF_COMPATIBLE_SECTION_KEYS,
  bifOrganizationIdentitySchema,
  bifMarketCompetitionSchema,
  bifCompatibleBusinessContextSchema,
} from './bif-compatible-context';
export type {
  BifCompatibleSectionKey,
  BifOrganizationIdentity,
  BifMarketCompetition,
  BifCompatibleBusinessContext,
} from './bif-compatible-context';

// Discovery -> BIF-compatible projection (pure, deterministic mapper).
export { mapBusinessDiscoveryToBifContext } from './business-discovery-bif-mapping';

// Representative sample fixture (generic fictional data, no side effects).
export { SAMPLE_BUSINESS_DISCOVERY_PROFILE } from './sample-profile';

// Field-level provenance (ADR-0025 prerequisite for Discovery -> BIF wiring).
// Optional: profiles without `fieldEvidence` remain valid and unchanged.
export {
  EVIDENCEABLE_FIELD_PATHS,
  PROFILE_SIGNAL_TO_FIELD_PATH,
  evidenceableFieldPathSchema,
  businessDiscoveryFieldEvidenceSchema,
  businessDiscoveryFieldEvidenceValidationSchema,
  danglingFieldEvidenceReferenceSchema,
  danglingAnswerEvidenceReferenceSchema,
  validateBusinessDiscoveryFieldEvidence,
  getEvidencedFieldPaths,
} from './field-provenance';
export type {
  EvidenceableFieldPath,
  BusinessDiscoveryFieldEvidence,
  BusinessDiscoveryFieldEvidenceValidation,
  DanglingFieldEvidenceReference,
  DanglingAnswerEvidenceReference,
} from './field-provenance';

// Discovery -> BIF draft mapper (ADR-0025 slice 2). Consumes @age/bif; never
// modifies it. Requires caller-supplied constructedAt / changedBy — the mapper
// reads no clock and invents no actor.
export {
  BUSINESS_DISCOVERY_TO_BIF_MAPPING_VERSION,
  PROVISIONAL_BIF_CONFIDENCE_SCORE,
  mapBusinessDiscoveryToBifDraft,
} from './business-discovery-to-bif';
export type {
  BusinessDiscoveryToBifOptions,
  BusinessDiscoveryToBifResult,
  BusinessDiscoveryBifMetadata,
  UnmappedDiscoveryField,
  ProvenanceSummary,
  BifSectionPopulation,
} from './business-discovery-to-bif';

// Completeness / discovery-input-confidence scoring (pure, deterministic).
// `discoveryConfidenceScore` means confidence in the captured discovery input,
// NOT strategic confidence — see the module note in `completeness-scoring.ts`.
export {
  BUSINESS_DISCOVERY_SCORING_VERSION,
  DISCOVERY_SECTION_WEIGHTS,
  READINESS_BANDS,
  readinessBandSchema,
  businessDiscoverySectionCompletenessSchema,
  businessDiscoveryCompletenessBreakdownSchema,
  businessDiscoveryCompletenessScoreSchema,
  calculateBusinessDiscoveryCompleteness,
} from './completeness-scoring';
export type {
  ReadinessBand,
  BusinessDiscoverySectionCompleteness,
  BusinessDiscoveryCompletenessBreakdown,
  BusinessDiscoveryCompletenessScore,
} from './completeness-scoring';
