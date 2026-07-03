import type { CapabilityResult } from '@age/capability-kit';
import type { MarketDiscoveryOpportunityItem } from './market-discovery-opportunity-item';
import type { OpportunityProcessingSummary } from './opportunity-processing-summary';

/**
 * MarketDiscoveryResult — the capability-specific result wrapper (ADR-0013,
 * adopted and final). Expressed as the shared `CapabilityResult` generic
 * (ADR-0016): `CapabilityOutput<T>` remains the unmodified generic envelope
 * carrying only accepted, non-duplicate items; `summary` carries the full
 * disposition of everything processed. Runtime shape is unchanged.
 */
export type MarketDiscoveryResult = CapabilityResult<
  MarketDiscoveryOpportunityItem,
  OpportunityProcessingSummary
>;
