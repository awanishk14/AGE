import { Capability, CapabilityOutput } from '@age/capability-kit';
import type { ClientContext } from '@age/capability-kit';
import type { OperationsInput } from '@age/operations-contracts';
import type { OperationsPlanItem } from './operations-plan-item';
import type { OperationsProcessingSummary } from './operations-processing-summary';
import type { OperationsResult } from './operations-result';

/**
 * OperationsCapability — produces operations plan candidates (project plans,
 * client-reporting plans, team-assignment proposals, SOP execution plans, QA
 * plans, delivery-tracking plans) from an in-memory OperationsInput.
 *
 * Pure producer: reads an input contract, produces an OperationsResult. Never
 * executes, never persists, never performs side effects. Depends only on
 * @age/capability-kit and @age/operations-contracts (ADR-0018) — never on Market
 * Discovery, Growth, Authority, SIE, BIF, BKG, or RIE.
 *
 * Operations rule: the produced CapabilityOutput is scoped by ClientContext, not
 * by the input. `context.clientId` / `context.organizationId` are authoritative;
 * `input.clientId` / `input.organizationId` are provenance/scope only.
 *
 * T32 is scaffold only: `run()` returns an empty, ClientContext-scoped output
 * with an all-zero summary and does NOT inspect `input.planningItems`. The
 * deterministic pipeline (derive → validate → deduplicate → score/prioritize →
 * assemble) is added later (T33/T34); no processing, scoring, validation, or
 * deduplication exists yet.
 */
export class OperationsCapability {
  async run(context: ClientContext, _input: OperationsInput): Promise<OperationsResult> {
    const output = new CapabilityOutput<OperationsPlanItem>({
      clientId: context.clientId,
      organizationId: context.organizationId,
      capability: Capability.Operations,
      executionDomains: [],
      items: [],
    });

    const summary: OperationsProcessingSummary = {
      acceptedCount: 0,
      rejectedCount: 0,
      duplicateCount: 0,
      rejectedReasons: [],
      duplicateReferences: [],
    };

    return { output, summary };
  }
}
