import type { ClientContext } from '@age/capability-kit';
import type { RevenueInput } from '@age/revenue-contracts';
import type { ScoredBifContext } from '@age/business-discovery-contracts';
import type { RevenueResult } from './revenue-result';
import type { RevenueContextReadinessResult } from './revenue-context-readiness-result';
import { processRevenue } from './processing/process-revenue';
import {
  assessRevenueContextReadiness,
  type AssessRevenueContextReadinessOptions,
} from './processing/assess-revenue-context-readiness';

/**
 * RevenueCapability — produces revenue plan candidates (upsell, cross-sell,
 * renewal, expansion, retention, pricing/packaging plans) from an in-memory
 * RevenueInput.
 *
 * Pure producer: reads an input contract, produces a RevenueResult. Never
 * executes, never persists, never performs side effects. It must never create
 * invoices, send proposals, charge customers, trigger payments, modify CRM/deal
 * state, send emails/messages, execute workflows, publish queues/events, or call
 * external APIs (ADR-0019). Depends only on @age/capability-kit and
 * @age/revenue-contracts — never on Market Discovery, Growth, Authority,
 * Operations, SIE, BIF, BKG, or RIE.
 *
 * Revenue rule: the produced CapabilityOutput is scoped by ClientContext, not by
 * the input. `context.clientId` / `context.organizationId` are authoritative;
 * `input.clientId` / `input.organizationId` are provenance/scope only.
 *
 * The full deterministic pipeline (derive → validate → deduplicate →
 * score/prioritize → assemble) lives in processRevenue (T39); `run()` only
 * delegates to it and adds no behavior of its own.
 */
export class RevenueCapability {
  async run(context: ClientContext, input: RevenueInput): Promise<RevenueResult> {
    return processRevenue(context, input);
  }

  /**
   * Assess whether a caller-assembled `ScoredBifContext` carries enough context
   * for revenue work (ADR-0027, Decision 1; third adopter of the pattern).
   *
   * Read-only and deterministic: reports which of the sections this capability
   * needs are supported, weak or absent, and carries a first-class sufficiency
   * state with mandatory reasons. Depends only on the neutral projection contract
   * — never on `@age/bif` — and `producedAt` is caller-supplied (ADR-0026
   * Decision 2); nothing here reads the wall clock.
   *
   * This is NOT a gate. `run` above does not consult it, is not blocked by it,
   * and is unchanged by it (ADR-0027 Decision 1). It derives, ranks, names and
   * hints at no revenue plan whatsoever: its result carries no items.
   */
  assessRevenueContext(
    context: ClientContext,
    scoredBifContext: ScoredBifContext,
    options: AssessRevenueContextReadinessOptions,
  ): RevenueContextReadinessResult {
    return assessRevenueContextReadiness(context, scoredBifContext, options);
  }
}
