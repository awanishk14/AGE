import type { CapabilityOutput } from '@age/capability-kit';
import type { MarketDiscoveryOpportunityItem } from './market-discovery-opportunity-item';
import type { OpportunityProcessingSummary } from './opportunity-processing-summary';

/**
 * MarketDiscoveryResult — the capability-specific result wrapper (ADR-0013,
 * adopted and final). `CapabilityOutput<T>` remains the unmodified generic
 * envelope and carries only accepted, non-duplicate items; `summary` carries
 * the full disposition of everything processed.
 */
export interface MarketDiscoveryResult {
  readonly output: CapabilityOutput<MarketDiscoveryOpportunityItem>;
  readonly summary: OpportunityProcessingSummary;
}
