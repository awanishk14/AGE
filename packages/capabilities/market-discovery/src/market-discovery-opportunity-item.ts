import type { CapabilityOutputItem, ExecutionDomain } from '@age/capability-kit';
import type {
  MarketOpportunitySourceRef,
  MarketSignalTarget,
  OpportunityPriority,
  OpportunityType,
} from '@age/market-discovery-contracts';

/**
 * MarketDiscoveryOpportunityItem — a single accepted, non-duplicate opportunity
 * produced by the Market Discovery Capability.
 *
 * Scoring fields (impactScore, confidenceScore, priority) are deterministic and
 * computed only from explicit MarketSignal inputs (ADR-0013); T15 is scaffold
 * only, so no scoring logic exists yet. `executionDomains` are opaque structural
 * tags carried through from signals. `sourceRefs` traces the opportunity back to
 * its originating signal(s), including any structural duplicates merged into it.
 */
export interface MarketDiscoveryOpportunityItem extends CapabilityOutputItem {
  readonly opportunityId: string;
  readonly opportunityType: OpportunityType;
  readonly target: MarketSignalTarget;
  readonly executionDomains: readonly ExecutionDomain[];
  /** 0–100. */
  readonly impactScore: number;
  /** 0–100. */
  readonly confidenceScore: number;
  readonly priority: OpportunityPriority;
  readonly sourceRefs: readonly MarketOpportunitySourceRef[];
}
