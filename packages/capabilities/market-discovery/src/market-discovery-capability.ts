import { Capability, CapabilityOutput } from '@age/capability-kit';
import type { ClientContext } from '@age/capability-kit';
import type { MarketDiscoveryInput } from '@age/market-discovery-contracts';
import type { MarketDiscoveryOpportunityItem } from './market-discovery-opportunity-item';
import type { MarketDiscoveryResult } from './market-discovery-result';

/**
 * MarketDiscoveryCapability — identifies and scores market opportunity
 * candidates from an in-memory MarketDiscoveryInput.
 *
 * Pure producer: reads an input contract, produces a MarketDiscoveryResult.
 * Never executes, never persists, never performs side effects. Depends only on
 * @age/capability-kit and @age/market-discovery-contracts (ADR-0012) — never on
 * SIE, BIF, BKG, or RIE.
 *
 * Authority rule: the produced CapabilityOutput is scoped by ClientContext, not
 * by the input. `context.clientId` / `context.organizationId` are authoritative;
 * `input.clientId` / `input.organizationId` are provenance/scope only.
 *
 * Contract scaffold only (T15). The deterministic pipeline (derive → validate →
 * deduplicate → score/prioritize → assemble) lands in T16/T17.
 */
export class MarketDiscoveryCapability {
  async run(context: ClientContext, _input: MarketDiscoveryInput): Promise<MarketDiscoveryResult> {
    const output = new CapabilityOutput<MarketDiscoveryOpportunityItem>({
      clientId: context.clientId,
      organizationId: context.organizationId,
      capability: Capability.MarketDiscovery,
      executionDomains: [],
      items: [],
    });

    return {
      output,
      summary: {
        acceptedCount: 0,
        rejectedCount: 0,
        duplicateCount: 0,
        rejectedReasons: [],
        duplicateReferences: [],
      },
    };
  }
}
