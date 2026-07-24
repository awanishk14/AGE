export { MarketDiscoveryCapability } from './market-discovery-capability';
export { MARKET_DISCOVERY_CAPABILITY_ENTRY } from './market-discovery-capability.entry';
export type { MarketDiscoveryOpportunityItem } from './market-discovery-opportunity-item';
export type { MarketDiscoveryResult } from './market-discovery-result';
export type {
  OpportunityProcessingSummary,
  RejectedOpportunityReasonCode,
  RejectedOpportunityReason,
  DuplicateOpportunityReference,
} from './opportunity-processing-summary';
// Context readiness assessment (ADR-0027, Decision 4). Read-only assessment of a
// caller-assembled ScoredBifContext — no @age/bif dependency, and no market
// opportunity derived, ranked, named or hinted at.
export {
  assessMarketContextReadiness,
  MARKET_CONTEXT_READINESS_VERSION,
  MARKET_CONTEXT_READINESS_THRESHOLDS,
  REQUIRED_MARKET_CONTEXT_SECTION_TYPES,
} from './processing';
export type { AssessMarketContextReadinessOptions } from './processing';
export type {
  MarketContextReadinessSummary,
  MarketContextReadinessThresholds,
  SupportedMarketContextSection,
  WeakMarketContextSection,
  AbsentMarketContextSection,
} from './market-context-readiness-summary';
export type { MarketContextReadinessResult } from './market-context-readiness-result';
