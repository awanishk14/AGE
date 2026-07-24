export { IntelligenceCapability } from './intelligence-capability';
export { INTELLIGENCE_CAPABILITY_ENTRY } from './intelligence-capability.entry';
export type { IntelligenceOutputItem } from './intelligence-output-item';
export type { IntelligenceResult } from './intelligence-result';
export type {
  IntelligenceProcessingSummary,
  RejectedEvidenceReasonCode,
  RejectedEvidenceReason,
  DuplicateEvidenceReference,
} from './processing-summary';
export {
  validateEvidence,
  deduplicateEvidence,
  scoreEvidenceQuality,
  calculateFreshnessDays,
  detectContradictions,
  processEvidencePackage,
} from './processing';
// Scored BIF context consumption (ADR-0026, Decision 5). Read-only assessment of
// a caller-assembled ScoredBifContext — no @age/bif dependency, no strategy.
export {
  assessScoredBifContext,
  BUSINESS_CONTEXT_ASSESSMENT_VERSION,
  BUSINESS_CONTEXT_SUPPORT_THRESHOLDS,
} from './processing';
export type { AssessScoredBifContextOptions } from './processing';
export type {
  BusinessContextSupportItem,
  BusinessContextSupportedField,
} from './business-context-support-item';
export type {
  BusinessContextAssessmentSummary,
  BusinessContextSupportThresholds,
  UnsupportedContextSection,
  MissingContextSection,
} from './business-context-assessment-summary';
export type { BusinessContextAssessmentResult } from './business-context-assessment-result';
