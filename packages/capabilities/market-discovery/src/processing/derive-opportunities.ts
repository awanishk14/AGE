import type {
  MarketDiscoveryInput,
  MarketSignalType,
  OpportunityType,
} from '@age/market-discovery-contracts';
import type { MarketOpportunityCandidate } from './market-opportunity-candidate';

/**
 * Fixed, deterministic lookup from signal kind to opportunity nature.
 * Exhaustive over MarketSignalType.
 */
const OPPORTUNITY_TYPE_BY_SIGNAL_TYPE: Readonly<Record<MarketSignalType, OpportunityType>> = {
  KEYWORD_GAP: 'VISIBILITY',
  RISING_TREND: 'DEMAND_CAPTURE',
  UNMET_DEMAND: 'DEMAND_CAPTURE',
  COMPETITOR_WEAKNESS: 'COMPETITIVE_DISPLACEMENT',
  CONTENT_GAP: 'CONTENT',
  LOCAL_VISIBILITY_GAP: 'LOCAL_PRESENCE',
  CONVERSION_FRICTION: 'CONVERSION',
};

/**
 * deriveOpportunities — deterministic structural derivation (ADR-0012/0013).
 * One signal produces exactly one raw candidate; no grouping, no external data,
 * no datastore reads. The candidate's opportunityId equals the source signal id.
 */
export function deriveOpportunities(
  input: MarketDiscoveryInput,
): readonly MarketOpportunityCandidate[] {
  return input.signals.map((signal) => ({
    opportunityId: signal.id,
    opportunityType: OPPORTUNITY_TYPE_BY_SIGNAL_TYPE[signal.type],
    target: signal.target,
    executionDomains: signal.executionDomains,
    strength: signal.strength,
    confidence: signal.confidence,
    demandVolume: signal.demandVolume,
    sourceRefs: [{ signalId: signal.id, signalType: signal.type }],
  }));
}
