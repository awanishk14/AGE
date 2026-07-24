export type { MarketOpportunityCandidate } from './market-opportunity-candidate';
export { deriveOpportunities } from './derive-opportunities';
export { validateOpportunity } from './validate-opportunity';
export { deduplicateOpportunities } from './deduplicate-opportunities';
export type { DeduplicationResult } from './deduplicate-opportunities';
export { scoreOpportunity } from './score-opportunity';
export type { OpportunityScore } from './score-opportunity';
export { processMarketDiscovery } from './process-market-discovery';
export {
  assessMarketContextReadiness,
  MARKET_CONTEXT_READINESS_VERSION,
  MARKET_CONTEXT_READINESS_THRESHOLDS,
  REQUIRED_MARKET_CONTEXT_SECTION_TYPES,
} from './assess-market-context-readiness';
export type { AssessMarketContextReadinessOptions } from './assess-market-context-readiness';
