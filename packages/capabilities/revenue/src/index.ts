export { RevenueCapability } from './revenue-capability';
export { REVENUE_CAPABILITY_ENTRY } from './revenue-capability.entry';
export type { RevenuePlanItem } from './revenue-plan-item';
export type { RevenueResult } from './revenue-result';
export type {
  RevenueProcessingSummary,
  RejectedRevenueReasonCode,
  RejectedRevenueReason,
  DuplicateRevenueReference,
} from './revenue-processing-summary';
// Context readiness assessment (ADR-0027, Decision 1; third adopter). Read-only
// assessment of a caller-assembled ScoredBifContext — no @age/bif dependency, and
// no revenue plan derived, ranked, named or hinted at.
export {
  assessRevenueContextReadiness,
  REVENUE_CONTEXT_READINESS_VERSION,
  REVENUE_CONTEXT_READINESS_THRESHOLDS,
  REQUIRED_REVENUE_CONTEXT_SECTION_TYPES,
} from './processing';
export type { AssessRevenueContextReadinessOptions } from './processing';
export type {
  RevenueContextReadinessSummary,
  RevenueContextReadinessThresholds,
  SupportedRevenueContextSection,
  WeakRevenueContextSection,
  AbsentRevenueContextSection,
} from './revenue-context-readiness-summary';
export type { RevenueContextReadinessResult } from './revenue-context-readiness-result';
