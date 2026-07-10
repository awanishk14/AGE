import { Capability, CapabilityOutput } from '@age/capability-kit';
import type { ClientContext, ExecutionDomain } from '@age/capability-kit';
import type { AuthorityInput } from '@age/authority-contracts';
import type { AuthorityPlanItem } from '../authority-plan-item';
import type { AuthorityResult } from '../authority-result';
import type {
  AuthorityProcessingSummary,
  RejectedAuthorityReason,
} from '../authority-processing-summary';
import type { AuthorityPlanCandidate } from './authority-plan-candidate';
import { deriveAuthorityPlanCandidates } from './derive-authority-plan-candidates';
import { validateAuthorityPlanCandidate } from './validate-authority-plan-candidate';
import { deduplicateAuthorityPlanCandidates } from './deduplicate-authority-plan-candidates';
import { scoreAuthorityPlanCandidate } from './score-authority-plan-candidate';

/**
 * processAuthority — the deterministic Authority pipeline (ADR-0017). Pure
 * function: same inputs always produce the same AuthorityResult. No persistence,
 * orchestration, or side effects.
 *
 * Pipeline order:
 *  1. Derive one raw candidate per planning item.
 *  2. Validate each candidate; each rejected candidate yields exactly one
 *     RejectedAuthorityReason and is dropped from further steps.
 *  3. Structurally deduplicate the survivors; each duplicate yields exactly one
 *     DuplicateAuthorityReference and is dropped from output (its source refs
 *     merge into the accepted original).
 *  4. Score each accepted candidate, producing one AuthorityPlanItem.
 *
 * The output is scoped by ClientContext (authoritative), never by the input.
 * `input.generatedAt` is the only time source (each item's createdAt).
 */
export function processAuthority(context: ClientContext, input: AuthorityInput): AuthorityResult {
  const createdAt = new Date(input.generatedAt);

  // 1–3. Derive, validate, deduplicate.
  const derivedCandidates = deriveAuthorityPlanCandidates(input);

  const rejectedReasons: RejectedAuthorityReason[] = [];
  const validCandidates: AuthorityPlanCandidate[] = [];

  for (const candidate of derivedCandidates) {
    const rejection = validateAuthorityPlanCandidate(candidate);

    if (rejection) {
      rejectedReasons.push(rejection);
      continue;
    }

    validCandidates.push(candidate);
  }

  const { acceptedCandidates, duplicateReferences } =
    deduplicateAuthorityPlanCandidates(validCandidates);

  // 4. Score + assemble one item per accepted candidate.
  const items: AuthorityPlanItem[] = acceptedCandidates.map((candidate) => {
    const score = scoreAuthorityPlanCandidate(candidate);

    return {
      id: candidate.authorityPlanId,
      authorityPlanId: candidate.authorityPlanId,
      capability: Capability.Authority,
      createdAt,
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

  const output = new CapabilityOutput<AuthorityPlanItem>({
    clientId: context.clientId,
    organizationId: context.organizationId,
    capability: Capability.Authority,
    executionDomains: unionExecutionDomains(items),
    items,
  });

  const summary: AuthorityProcessingSummary = {
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
function unionExecutionDomains(items: readonly AuthorityPlanItem[]): ExecutionDomain[] {
  const domains = new Set<ExecutionDomain>();

  for (const item of items) {
    for (const domain of item.executionDomains) {
      domains.add(domain);
    }
  }

  return [...domains].sort();
}
