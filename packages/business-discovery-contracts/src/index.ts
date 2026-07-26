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

// Legacy Path A (`mapBusinessDiscoveryToBifContext` -> `BifCompatibleBusinessContext`)
// was RETIRED here (ADR-0039 D7) once the demo migrated to canonical Path B and
// it had no caller left. `produceScoredBifContext` is the single sanctioned
// Discovery -> BIF mapping (ADR-0038). Do not reintroduce a second path.

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

// BIF scoring layer (ADR-0025 Decision 3 follow-up, slice 3). Computes BIF
// root/section confidence from the BIF itself. Takes only a BIF — no discovery
// score is in scope, so `discoveryConfidenceScore` cannot leak into BIF
// confidence. Pure, deterministic, non-mutating; never promotes status.
export {
  BIF_CONFIDENCE_SCORING_VERSION,
  bifSectionConfidenceScoreSchema,
  bifConfidenceScoringMetadataSchema,
  scoreBusinessIntelligenceFramework,
} from './bif-confidence-scoring';
export type {
  BifSectionConfidenceScore,
  BifConfidenceScoringMetadata,
  BifConfidenceScoringResult,
  BifConfidenceScoringOptions,
} from './bif-confidence-scoring';

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

// ScoredBifContext — neutral read-only projection of a scored Draft BIF for
// capability consumption (ADR-0026, Accepted). Capabilities depend on this
// projection, never on `@age/bif`. Pure, deterministic, non-mutating; never
// promotes status, never creates placeholder sections, never infers missing
// data — absent sections are reported as limitations only.
export {
  SCORED_BIF_CONTEXT_VERSION,
  scoredBifContextFieldSchema,
  scoredBifContextSectionSchema,
  scoredBifContextOmittedSectionSchema,
  scoredBifContextMetadataSchema,
  scoredBifContextSchema,
  projectScoredBifContext,
} from './scored-bif-context';
export type {
  ScoredBifContext,
  ScoredBifContextField,
  ScoredBifContextSection,
  ScoredBifContextOmittedSection,
  ScoredBifContextMetadata,
  ScoredBifContextProjectionOptions,
} from './scored-bif-context';

// The produce side, written once (ADR-0037). Chains the three functions above —
// mapper -> scorer -> projector — in the one correct order, threading the
// scorer's metadata into the projector rather than letting it be recomputed.
// Adds no step, replaces nothing, and all three stay independently callable.
// Pure: no clock, no id, no randomness. Knows nothing about persistence.
export { produceScoredBifContext } from './produce-scored-bif-context';
export type {
  ProduceScoredBifContextOptions,
  ProduceScoredBifContextResult,
} from './produce-scored-bif-context';

// ScoredBifSnapshot — versioned, storage-neutral serialized form of a scored BIF
// context (ADR-0029 stage 1). A pure codec only: no I/O, no clock, no store.
// The hard boundary "no DB/persistence writes" stays in force — a repository
// port is stage 2 and a durable adapter needs its own Accepted ADR.
export {
  SCORED_BIF_SNAPSHOT_VERSION,
  scoredBifSnapshotSchema,
  toScoredBifSnapshot,
  fromScoredBifSnapshot,
  serializeScoredBifSnapshot,
} from './scored-bif-snapshot';
export type { ScoredBifSnapshot } from './scored-bif-snapshot';

// ScoredBifSnapshotRepository — storage-neutral append-only port for scored BIF
// snapshots, plus the in-memory adapter (ADR-0029 stage 2, ADR-0030 Accepted).
// Append and read only: no update, no delete, no clock, no durable write. Scope
// (`clientId`, `organizationId`) comes from the caller's ClientContext and is
// authoritative; `snapshotId` and `capturedAt` are caller-supplied. A durable
// adapter remains out of scope pending its own Accepted ADR.
export {
  SCORED_BIF_SNAPSHOT_RECORD_VERSION,
  scoredBifSnapshotScopeSchema,
  scoredBifSnapshotSeriesKeySchema,
  scoredBifSnapshotKeySchema,
  scoredBifSnapshotRecordSchema,
  scoredBifSnapshotSeriesKeyOf,
  normalizeScoredBifSnapshotRecord,
} from './scored-bif-snapshot-repository';
export type {
  ScoredBifSnapshotScope,
  ScoredBifSnapshotSeriesKey,
  ScoredBifSnapshotKey,
  ScoredBifSnapshotRecord,
  ScoredBifSnapshotRepository,
} from './scored-bif-snapshot-repository';

export { InMemoryScoredBifSnapshotRepository } from './in-memory-scored-bif-snapshot-repository';
