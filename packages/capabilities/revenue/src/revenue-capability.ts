import { Capability, CapabilityOutput } from '@age/capability-kit';
import type { ClientContext } from '@age/capability-kit';
import type { RevenueInput } from '@age/revenue-contracts';
import type { RevenuePlanItem } from './revenue-plan-item';
import type { RevenueProcessingSummary } from './revenue-processing-summary';
import type { RevenueResult } from './revenue-result';

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
 * T37 is scaffold only: `run()` returns an empty, ClientContext-scoped output
 * with an all-zero summary and does NOT inspect `input.planningItems`. The
 * deterministic pipeline (derive → validate → deduplicate → score/prioritize →
 * assemble) is added later; no processing, scoring, validation, or
 * deduplication exists yet.
 */
export class RevenueCapability {
  async run(context: ClientContext, _input: RevenueInput): Promise<RevenueResult> {
    const output = new CapabilityOutput<RevenuePlanItem>({
      clientId: context.clientId,
      organizationId: context.organizationId,
      capability: Capability.Revenue,
      executionDomains: [],
      items: [],
    });

    const summary: RevenueProcessingSummary = {
      acceptedCount: 0,
      rejectedCount: 0,
      duplicateCount: 0,
      rejectedReasons: [],
      duplicateReferences: [],
    };

    return { output, summary };
  }
}
