import type { RevenueInput } from '@age/revenue-contracts';
import type { RevenuePlanCandidate } from './revenue-plan-candidate';

/**
 * deriveRevenuePlanCandidates — deterministic structural derivation (ADR-0019).
 * One RevenuePlanningInputItem produces exactly one raw candidate; no grouping,
 * no external data, no datastore reads, no clock reads, no use of
 * RevenueInput.generatedAt.
 *
 * `planType` is carried from the planning item (never derived); `revenuePlanId`
 * equals the item id; `target` is the referenced target; the sole source ref
 * carries both referenceId and referenceType of the reference (including
 * `OPERATIONS_PLAN`). Advisory/metadata fields (recommendsProposalDraft,
 * monetaryAmount, currency) are copied through untouched.
 *
 * Candidate `executionDomains` come from `item.executionDomains` (authoritative
 * planning intent) — never from `item.reference.executionDomains`, which is
 * upstream provenance context only.
 */
export function deriveRevenuePlanCandidates(input: RevenueInput): readonly RevenuePlanCandidate[] {
  return input.planningItems.map((item) => ({
    revenuePlanId: item.id,
    planType: item.planType,
    target: item.reference.target,
    executionDomains: item.executionDomains,
    expectedValue: item.expectedValue,
    conversionProbability: item.conversionProbability,
    retentionRisk: item.retentionRisk,
    estimatedEffort: item.estimatedEffort,
    confidence: item.confidence,
    sourceRefs: [
      {
        referenceId: item.reference.referenceId,
        referenceType: item.reference.referenceType,
      },
    ],
    recommendsProposalDraft: item.recommendsProposalDraft,
    monetaryAmount: item.monetaryAmount,
    currency: item.currency,
  }));
}
