import type { ClientContext } from '@age/capability-kit';
import type { MarketDiscoveryInput } from '@age/market-discovery-contracts';
import type { MarketDiscoveryResult } from './market-discovery-result';
import { processMarketDiscovery } from './processing/process-market-discovery';

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
 * The full deterministic pipeline (derive → validate → deduplicate →
 * score/prioritize → assemble) lives in processMarketDiscovery (T17).
 */
export class MarketDiscoveryCapability {
  async run(context: ClientContext, input: MarketDiscoveryInput): Promise<MarketDiscoveryResult> {
    return processMarketDiscovery(context, input);
  }
}
