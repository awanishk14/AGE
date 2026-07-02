export { IntelligenceCapability } from './intelligence-capability';
export { INTELLIGENCE_CAPABILITY_ENTRY } from './intelligence-capability.entry';
export type { IntelligenceOutputItem } from './intelligence-output-item';
export type { IntelligenceResult } from './intelligence-result';
export type {
  ProcessingSummary,
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
} from './processing';
