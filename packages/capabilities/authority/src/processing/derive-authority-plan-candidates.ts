import type { AuthorityInput } from '@age/authority-contracts';
import type { AuthorityPlanCandidate } from './authority-plan-candidate';

/**
 * deriveAuthorityPlanCandidates — deterministic structural derivation
 * (ADR-0017). One AuthorityPlanningInputItem produces exactly one raw candidate;
 * no grouping, no external data, no datastore reads, no clock reads, no use of
 * AuthorityInput.generatedAt.
 *
 * `planType` is carried from the planning item (never derived);
 * `authorityPlanId` equals the item id; `target` is the referenced target; the
 * sole source ref carries both referenceId and referenceType of the reference.
 *
 * Candidate `executionDomains` come from `item.executionDomains` (authoritative
 * planning intent) — never from `item.reference.executionDomains`, which is
 * upstream provenance context only.
 */
export function deriveAuthorityPlanCandidates(
  input: AuthorityInput,
): readonly AuthorityPlanCandidate[] {
  return input.planningItems.map((item) => ({
    authorityPlanId: item.id,
    planType: item.planType,
    target: item.reference.target,
    executionDomains: item.executionDomains,
    expectedImpact: item.expectedImpact,
    confidence: item.confidence,
    estimatedEffort: item.estimatedEffort,
    sourceRefs: [
      {
        referenceId: item.reference.referenceId,
        referenceType: item.reference.referenceType,
      },
    ],
  }));
}
