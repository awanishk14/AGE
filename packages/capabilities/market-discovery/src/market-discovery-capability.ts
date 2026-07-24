import type { ClientContext } from '@age/capability-kit';
import type { MarketDiscoveryInput } from '@age/market-discovery-contracts';
import type { ScoredBifContext } from '@age/business-discovery-contracts';
import type { MarketDiscoveryResult } from './market-discovery-result';
import type { MarketContextReadinessResult } from './market-context-readiness-result';
import { processMarketDiscovery } from './processing/process-market-discovery';
import {
  assessMarketContextReadiness,
  type AssessMarketContextReadinessOptions,
} from './processing/assess-market-context-readiness';

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

  /**
   * Assess whether a caller-assembled `ScoredBifContext` carries enough context
   * for market discovery work (ADR-0027, Decision 4).
   *
   * Read-only and deterministic: reports which of the sections this capability
   * needs are supported, weak or absent, and carries a first-class sufficiency
   * state with mandatory reasons. Depends only on the neutral projection contract
   * — never on `@age/bif` — and `producedAt` is caller-supplied (ADR-0026
   * Decision 2); nothing here reads the wall clock.
   *
   * This is NOT a gate. `run` above does not consult it, is not blocked by it,
   * and is unchanged by it (ADR-0027 Decision 1). It derives, ranks, names and
   * hints at no market opportunity whatsoever: its result carries no items.
   */
  assessMarketContext(
    context: ClientContext,
    scoredBifContext: ScoredBifContext,
    options: AssessMarketContextReadinessOptions,
  ): MarketContextReadinessResult {
    return assessMarketContextReadiness(context, scoredBifContext, options);
  }
}
