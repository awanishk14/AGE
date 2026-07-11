import { Capability, CapabilityOutput } from '@age/capability-kit';
import type { ClientContext, ExecutionDomain } from '@age/capability-kit';
import type { OperationsInput } from '@age/operations-contracts';
import type { OperationsPlanItem } from '../operations-plan-item';
import type { OperationsResult } from '../operations-result';
import type {
  OperationsProcessingSummary,
  RejectedOperationsReason,
} from '../operations-processing-summary';
import type { OperationsPlanCandidate } from './operations-plan-candidate';
import { deriveOperationsPlanCandidates } from './derive-operations-plan-candidates';
import { validateOperationsPlanCandidate } from './validate-operations-plan-candidate';
import { deduplicateOperationsPlanCandidates } from './deduplicate-operations-plan-candidates';
import { scoreOperationsPlanCandidate } from './score-operations-plan-candidate';

/**
 * processOperations — the deterministic Operations pipeline (ADR-0018). Pure
 * function: same inputs always produce the same OperationsResult. No
 * persistence, orchestration, queues, events, external calls, AI/LLM,
 * embeddings, semantic matching, source-reliability weighting, or side effects.
 *
 * Pipeline order:
 *  1. Derive one raw candidate per planning item.
 *  2. Validate each candidate; each rejected candidate yields exactly one
 *     RejectedOperationsReason and is dropped from further steps.
 *  3. Structurally deduplicate the survivors; each duplicate yields exactly one
 *     DuplicateOperationsReference and is dropped from output (its source refs
 *     merge into the accepted original).
 *  4. Score each accepted candidate, producing one OperationsPlanItem.
 *  5. Assemble the CapabilityOutput envelope and the processing summary.
 *
 * The output is scoped by ClientContext (authoritative), never by the input.
 * `input.clientId` / `input.organizationId` are provenance/scope only.
 * `input.generatedAt` is the only time source for each item's createdAt;
 * CapabilityOutput.producedAt keeps its existing envelope wall-clock behavior.
 */
export function processOperations(
  context: ClientContext,
  input: OperationsInput,
): OperationsResult {
  const createdAt = new Date(input.generatedAt);

  // 1–3. Derive, validate, deduplicate.
  const derivedCandidates = deriveOperationsPlanCandidates(input);

  const rejectedReasons: RejectedOperationsReason[] = [];
  const validCandidates: OperationsPlanCandidate[] = [];

  for (const candidate of derivedCandidates) {
    const rejection = validateOperationsPlanCandidate(candidate);

    if (rejection) {
      rejectedReasons.push(rejection);
      continue;
    }

    validCandidates.push(candidate);
  }

  const { accepted, duplicates } = deduplicateOperationsPlanCandidates(validCandidates);

  // 4. Score + assemble one item per accepted candidate.
  const items: OperationsPlanItem[] = accepted.map((candidate) => {
    const score = scoreOperationsPlanCandidate(candidate);

    return {
      id: candidate.operationsPlanId,
      operationsPlanId: candidate.operationsPlanId,
      capability: Capability.Operations,
      createdAt,
      planType: candidate.planType,
      target: candidate.target,
      executionDomains: candidate.executionDomains,
      operationalImpactScore: score.operationalImpactScore,
      effortScore: score.effortScore,
      effortBand: score.effortBand,
      confidenceScore: score.confidenceScore,
      priority: score.priority,
      sourceRefs: candidate.sourceRefs,
    };
  });

  // 5. Assemble the envelope (scoped by ClientContext) and the summary.
  const output = new CapabilityOutput<OperationsPlanItem>({
    clientId: context.clientId,
    organizationId: context.organizationId,
    capability: Capability.Operations,
    executionDomains: unionExecutionDomains(items),
    items,
  });

  const summary: OperationsProcessingSummary = {
    acceptedCount: accepted.length,
    rejectedCount: rejectedReasons.length,
    duplicateCount: duplicates.length,
    rejectedReasons,
    duplicateReferences: duplicates,
  };

  return { output, summary };
}

/**
 * Deterministic union of the accepted items' execution domains, deduplicated
 * and sorted for stable ordering. Empty when there are no accepted items.
 */
function unionExecutionDomains(items: readonly OperationsPlanItem[]): ExecutionDomain[] {
  const domains = new Set<ExecutionDomain>();

  for (const item of items) {
    for (const domain of item.executionDomains) {
      domains.add(domain);
    }
  }

  return [...domains].sort();
}
