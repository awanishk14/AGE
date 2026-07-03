import { Capability, CapabilityOutput } from '@age/capability-kit';
import type { ClientContext } from '@age/capability-kit';
import type { GrowthInput } from '@age/growth-contracts';
import type { GrowthPlanItem } from './growth-plan-item';
import type { GrowthResult } from './growth-result';

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
 * Contract scaffold only (T19). The deterministic pipeline (derive → validate →
 * deduplicate → score/prioritize → assemble) lands in T20/T21.
 */
export class GrowthCapability {
  async run(context: ClientContext, _input: GrowthInput): Promise<GrowthResult> {
    const output = new CapabilityOutput<GrowthPlanItem>({
      clientId: context.clientId,
      organizationId: context.organizationId,
      capability: Capability.Growth,
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
