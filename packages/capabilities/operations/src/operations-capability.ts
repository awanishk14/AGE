import type { ClientContext } from '@age/capability-kit';
import type { OperationsInput } from '@age/operations-contracts';
import type { OperationsResult } from './operations-result';
import { processOperations } from './processing/process-operations';

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
 * The full deterministic pipeline (derive → validate → deduplicate →
 * score/prioritize → assemble) lives in processOperations (T34); `run()` only
 * delegates to it and adds no behavior of its own.
 */
export class OperationsCapability {
  async run(context: ClientContext, input: OperationsInput): Promise<OperationsResult> {
    return processOperations(context, input);
  }
}
