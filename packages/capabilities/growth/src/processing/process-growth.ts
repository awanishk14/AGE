import { Capability, CapabilityOutput } from '@age/capability-kit';
import type { ClientContext, ExecutionDomain } from '@age/capability-kit';
import type { GrowthInput } from '@age/growth-contracts';
import type { GrowthPlanItem } from '../growth-plan-item';
import type { GrowthResult } from '../growth-result';
import type { GrowthProcessingSummary, RejectedGrowthReason } from '../growth-processing-summary';
import type { GrowthPlanCandidate } from './growth-plan-candidate';
import { deriveGrowthPlans } from './derive-growth-plans';
import { validateGrowthPlan } from './validate-growth-plan';
import { deduplicateGrowthPlans } from './deduplicate-growth-plans';
import { scoreGrowthPlan } from './score-growth-plan';

/**
 * processGrowth — the deterministic Growth pipeline (ADR-0014/0015). Pure
 * function: same inputs always produce the same GrowthResult. No persistence,
 * orchestration, or side effects.
 *
 * Pipeline order:
 *  1. Derive one raw candidate per planning item.
 *  2. Validate each candidate; each rejected candidate yields exactly one
 *     RejectedGrowthReason and is dropped from further steps.
 *  3. Structurally deduplicate the survivors; each duplicate yields exactly one
 *     DuplicateGrowthReference and is dropped from output (its source refs merge
 *     into the accepted original).
 *  4. Score each accepted candidate, producing one GrowthPlanItem.
 *
 * The output is scoped by ClientContext (authoritative), never by the input.
 * `input.generatedAt` is the only time source (each item's createdAt).
 */
export function processGrowth(context: ClientContext, input: GrowthInput): GrowthResult {
  const createdAt = new Date(input.generatedAt);

  // 1–3. Derive, validate, deduplicate.
  const derivedCandidates = deriveGrowthPlans(input);

  const rejectedReasons: RejectedGrowthReason[] = [];
  const validCandidates: GrowthPlanCandidate[] = [];

  for (const candidate of derivedCandidates) {
    const rejection = validateGrowthPlan(candidate);

    if (rejection) {
      rejectedReasons.push(rejection);
      continue;
    }

    validCandidates.push(candidate);
  }

  const { acceptedCandidates, duplicateReferences } = deduplicateGrowthPlans(validCandidates);

  // 4. Score + assemble one item per accepted candidate.
  const items: GrowthPlanItem[] = acceptedCandidates.map((candidate) => {
    const score = scoreGrowthPlan(candidate);

    return {
      id: candidate.planId,
      capability: Capability.Growth,
      createdAt,
      planId: candidate.planId,
      planType: candidate.planType,
      target: candidate.target,
      executionDomains: candidate.executionDomains,
      impactScore: score.impactScore,
      effortScore: score.effortScore,
      effortBand: score.effortBand,
      confidenceScore: score.confidenceScore,
      priority: score.priority,
      sourceRefs: candidate.sourceRefs,
    };
  });

  const output = new CapabilityOutput<GrowthPlanItem>({
    clientId: context.clientId,
    organizationId: context.organizationId,
    capability: Capability.Growth,
    executionDomains: unionExecutionDomains(items),
    items,
  });

  const summary: GrowthProcessingSummary = {
    acceptedCount: acceptedCandidates.length,
    rejectedCount: rejectedReasons.length,
    duplicateCount: duplicateReferences.length,
    rejectedReasons,
    duplicateReferences,
  };

  return { output, summary };
}

/**
 * Deterministic union of the accepted items' execution domains, deduplicated
 * and sorted for stable ordering.
 */
function unionExecutionDomains(items: readonly GrowthPlanItem[]): ExecutionDomain[] {
  const domains = new Set<ExecutionDomain>();

  for (const item of items) {
    for (const domain of item.executionDomains) {
      domains.add(domain);
    }
  }

  return [...domains].sort();
}
