import type { ClientContext } from '@age/capability-kit';
import type { GrowthInput } from '@age/growth-contracts';
import type { GrowthResult } from './growth-result';
import { processGrowth } from './processing/process-growth';

/**
 * GrowthCapability — produces growth plan candidates (paid-acquisition,
 * CRO/funnel, landing-experience, content-distribution ideas) from an in-memory
 * GrowthInput.
 *
 * Pure producer: reads an input contract, produces a GrowthResult. Never
 * executes, never persists, never performs side effects. Depends only on
 * @age/capability-kit and @age/growth-contracts (ADR-0014) — never on Market
 * Discovery, SIE, BIF, BKG, or RIE.
 *
 * Authority rule: the produced CapabilityOutput is scoped by ClientContext, not
 * by the input. `context.clientId` / `context.organizationId` are authoritative;
 * `input.clientId` / `input.organizationId` are provenance/scope only.
 *
 * The full deterministic pipeline (derive → validate → deduplicate →
 * score/prioritize → assemble) lives in processGrowth (T21).
 */
export class GrowthCapability {
  async run(context: ClientContext, input: GrowthInput): Promise<GrowthResult> {
    return processGrowth(context, input);
  }
}
