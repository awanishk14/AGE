import type { ClientContext } from '@age/capability-kit';
import type { RevenueInput } from '@age/revenue-contracts';
import type { RevenueResult } from './revenue-result';
import { processRevenue } from './processing/process-revenue';

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
}
