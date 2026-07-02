import type { ExecutionDomain } from '@age/capability-kit';
import type {
  MarketOpportunitySourceRef,
  MarketSignalTarget,
  OpportunityType,
} from '@age/market-discovery-contracts';

/**
 * MarketOpportunityCandidate — an INTERNAL capability type for a derived
 * opportunity before validation, deduplication, scoring, and assembly.
 *
 * Not exported from the package root; it is an implementation detail of the
 * processing modules. It carries only the fields those modules need. The raw
 * scoring inputs (strength/confidence/demandVolume) live here (not on the
 * public MarketDiscoveryOpportunityItem, which carries computed scores).
 */
export interface MarketOpportunityCandidate {
  readonly opportunityId: string;
  readonly opportunityType: OpportunityType;
  readonly target: MarketSignalTarget;
  readonly executionDomains: readonly ExecutionDomain[];
  readonly strength: number;
  readonly confidence: number;
  readonly demandVolume: number;
  readonly sourceRefs: readonly MarketOpportunitySourceRef[];
}
