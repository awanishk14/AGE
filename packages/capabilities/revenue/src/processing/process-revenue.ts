import { Capability, CapabilityOutput } from '@age/capability-kit';
import type { ClientContext, ExecutionDomain } from '@age/capability-kit';
import type { RevenueInput } from '@age/revenue-contracts';
import type { RevenuePlanItem } from '../revenue-plan-item';
import type { RevenueResult } from '../revenue-result';
import type {
  RevenueProcessingSummary,
  RejectedRevenueReason,
} from '../revenue-processing-summary';
import type { RevenuePlanCandidate } from './revenue-plan-candidate';
import { deriveRevenuePlanCandidates } from './derive-revenue-plan-candidates';
import { validateRevenuePlanCandidate } from './validate-revenue-plan-candidate';
import { deduplicateRevenuePlanCandidates } from './deduplicate-revenue-plan-candidates';
import { scoreRevenuePlanCandidate } from './score-revenue-plan-candidate';

/**
 * processRevenue — the deterministic Revenue pipeline (ADR-0019). Given the same
 * inputs it produces the same items and summary; the ONLY non-deterministic part
 * is the `CapabilityOutput.producedAt` envelope timestamp, which is wall-clock
 * behavior inherited from CapabilityOutput (the RevenueResult is therefore NOT
 * byte-for-byte deterministic — compare a producedAt-excluded view for
 * determinism). No persistence, orchestration, queues, events, external calls,
 * AI/LLM, embeddings, semantic matching, source-reliability weighting, or side
 * effects.
 *
 * Pipeline order:
 *  1. Derive one raw candidate per planning item.
 *  2. Validate each candidate; each rejected candidate yields exactly one
 *     RejectedRevenueReason and is dropped from further steps.
 *  3. Structurally deduplicate the survivors; each duplicate yields exactly one
 *     DuplicateRevenueReference and is dropped from output (its source refs
 *     merge into the accepted original).
 *  4. Score each accepted candidate, producing one RevenuePlanItem.
 *  5. Assemble the CapabilityOutput envelope and the processing summary.
 *
 * The output is scoped by ClientContext (authoritative), never by the input.
 * `input.clientId` / `input.organizationId` are provenance/scope only.
 * `input.generatedAt` is the only time source for each item's createdAt.
 */
export function processRevenue(context: ClientContext, input: RevenueInput): RevenueResult {
  const createdAt = new Date(input.generatedAt);

  // 1–3. Derive, validate, deduplicate.
  const derivedCandidates = deriveRevenuePlanCandidates(input);

  const rejectedReasons: RejectedRevenueReason[] = [];
  const validCandidates: RevenuePlanCandidate[] = [];

  for (const candidate of derivedCandidates) {
    const rejection = validateRevenuePlanCandidate(candidate);

    if (rejection) {
      rejectedReasons.push(rejection);
      continue;
    }

    validCandidates.push(candidate);
  }

  const { accepted, duplicates } = deduplicateRevenuePlanCandidates(validCandidates);

  // 4. Score + assemble one item per accepted candidate.
  const items: RevenuePlanItem[] = accepted.map((candidate) => {
    const score = scoreRevenuePlanCandidate(candidate);

    return {
      id: candidate.revenuePlanId,
      revenuePlanId: candidate.revenuePlanId,
      capability: Capability.Revenue,
      createdAt,
      planType: candidate.planType,
      target: candidate.target,
      executionDomains: candidate.executionDomains,
      revenueImpactScore: score.revenueImpactScore,
      valueBand: score.valueBand,
      effortScore: score.effortScore,
      effortBand: score.effortBand,
      confidenceScore: score.confidenceScore,
      priority: score.priority,
      sourceRefs: candidate.sourceRefs,
      recommendsProposalDraft: candidate.recommendsProposalDraft,
      monetaryAmount: candidate.monetaryAmount,
      currency: candidate.currency,
    };
  });

  // 5. Assemble the envelope (scoped by ClientContext) and the summary.
  const output = new CapabilityOutput<RevenuePlanItem>({
    clientId: context.clientId,
    organizationId: context.organizationId,
    capability: Capability.Revenue,
    executionDomains: unionExecutionDomains(items),
    items,
  });

  const summary: RevenueProcessingSummary = {
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
function unionExecutionDomains(items: readonly RevenuePlanItem[]): ExecutionDomain[] {
  const domains = new Set<ExecutionDomain>();

  for (const item of items) {
    for (const domain of item.executionDomains) {
      domains.add(domain);
    }
  }

  return [...domains].sort();
}
