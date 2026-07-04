import { CapabilityOutput, Capability } from '@age/capability-kit';
import type { ClientContext } from '@age/capability-kit';
import type { AuthorityInput } from '@age/authority-contracts';
import type { AuthorityPlanItem } from './authority-plan-item';
import type { AuthorityProcessingSummary } from './authority-processing-summary';
import type { AuthorityResult } from './authority-result';

/**
 * AuthorityCapability — produces authority plan candidates (content-strategy,
 * thought-leadership, digital-PR, backlink, review, video, podcast plays) from
 * an in-memory AuthorityInput.
 *
 * Pure producer: reads an input contract, produces an AuthorityResult. Never
 * executes, never persists, never performs side effects. Depends only on
 * @age/capability-kit and @age/authority-contracts (ADR-0017) — never on Market
 * Discovery, Growth, SIE, BIF, BKG, or RIE.
 *
 * Authority rule: the produced CapabilityOutput is scoped by ClientContext, not
 * by the input. `context.clientId` / `context.organizationId` are authoritative;
 * `input.clientId` / `input.organizationId` are provenance/scope only.
 *
 * T27 is scaffold only: `run()` returns an empty output and a zeroed summary. No
 * derivation, validation, deduplication, or scoring exists yet. The full
 * deterministic pipeline (derive → validate → deduplicate → score/prioritize →
 * assemble) lands in T29.
 */
export class AuthorityCapability {
  async run(context: ClientContext, _input: AuthorityInput): Promise<AuthorityResult> {
    const output = new CapabilityOutput<AuthorityPlanItem>({
      clientId: context.clientId,
      organizationId: context.organizationId,
      capability: Capability.Authority,
      executionDomains: [],
      items: [],
    });

    const summary: AuthorityProcessingSummary = {
      acceptedCount: 0,
      rejectedCount: 0,
      duplicateCount: 0,
      rejectedReasons: [],
      duplicateReferences: [],
    };

    return { output, summary };
  }
}
