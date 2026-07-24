import type { CapabilityResult } from '@age/capability-kit';
import type { BusinessContextSupportItem } from './business-context-support-item';
import type { BusinessContextAssessmentSummary } from './business-context-assessment-summary';

/**
 * BusinessContextAssessmentResult — the result of assessing a `ScoredBifContext`
 * (ADR-0026, Decision 5).
 *
 * Expressed as the SHARED `CapabilityResult` generic (ADR-0016), exactly like
 * `IntelligenceResult`. No separate or parallel result type is introduced: the
 * sufficiency state rides on the shared `CapabilityOutput` envelope
 * (`result.output.sufficiency`, ADR-0026 Decision 3) and the timestamp is the
 * caller-supplied `producedAt` (Decision 2).
 */
export type BusinessContextAssessmentResult = CapabilityResult<
  BusinessContextSupportItem,
  BusinessContextAssessmentSummary
>;
