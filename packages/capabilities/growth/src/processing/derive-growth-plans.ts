import type { GrowthInput } from '@age/growth-contracts';
import type { GrowthPlanCandidate } from './growth-plan-candidate';

/**
 * deriveGrowthPlans — deterministic structural derivation (ADR-0014/0015). One
 * GrowthPlanningInputItem produces exactly one raw candidate; no grouping, no
 * external data, no datastore reads. `planType` is carried from the planning
 * item (never derived); `planId` equals the item id; `target` is the referenced
 * opportunity's target; the sole source ref is the referenced opportunity id.
 */
export function deriveGrowthPlans(input: GrowthInput): readonly GrowthPlanCandidate[] {
  return input.planningItems.map((item) => ({
    planId: item.id,
    planType: item.planType,
    target: item.opportunity.target,
    executionDomains: item.executionDomains,
    expectedImpact: item.expectedImpact,
    confidence: item.confidence,
    estimatedEffort: item.estimatedEffort,
    sourceRefs: [{ opportunityId: item.opportunity.opportunityId }],
  }));
}
