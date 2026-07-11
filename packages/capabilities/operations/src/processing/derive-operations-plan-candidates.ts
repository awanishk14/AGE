import type { OperationsInput } from '@age/operations-contracts';
import type { OperationsPlanCandidate } from './operations-plan-candidate';

/**
 * deriveOperationsPlanCandidates — deterministic structural derivation
 * (ADR-0018). One OperationsPlanningInputItem produces exactly one raw
 * candidate; no grouping, no external data, no datastore reads, no clock reads,
 * no use of OperationsInput.generatedAt.
 *
 * `planType` is carried from the planning item (never derived);
 * `operationsPlanId` equals the item id; `target` is the referenced target; the
 * sole source ref carries both referenceId and referenceType of the reference.
 *
 * Candidate `executionDomains` come from `item.executionDomains` (authoritative
 * planning intent) — never from `item.reference.executionDomains`, which is
 * upstream provenance context only.
 */
export function deriveOperationsPlanCandidates(
  input: OperationsInput,
): readonly OperationsPlanCandidate[] {
  return input.planningItems.map((item) => ({
    operationsPlanId: item.id,
    planType: item.planType,
    target: item.reference.target,
    executionDomains: item.executionDomains,
    operationalUrgency: item.operationalUrgency,
    deliveryRisk: item.deliveryRisk,
    estimatedEffort: item.estimatedEffort,
    confidence: item.confidence,
    sourceRefs: [
      {
        referenceId: item.reference.referenceId,
        referenceType: item.reference.referenceType,
      },
    ],
  }));
}
