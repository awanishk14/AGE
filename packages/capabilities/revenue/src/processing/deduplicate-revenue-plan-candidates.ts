import type { DuplicateRevenueReference } from '../revenue-processing-summary';
import type { RevenuePlanCandidate } from './revenue-plan-candidate';

/**
 * Result of structural deduplication (ADR-0019). `accepted` are the first-seen
 * candidates (each having absorbed the source refs of any duplicates merged into
 * it); `duplicates` records each later duplicate exactly once, pointing at the
 * first-seen original.
 */
export interface RevenueDeduplicationResult {
  readonly accepted: readonly RevenuePlanCandidate[];
  readonly duplicates: readonly DuplicateRevenueReference[];
}

/**
 * deduplicateRevenuePlanCandidates — structural-only duplicate detection. Two
 * candidates are duplicates when they share the same structural key:
 *   planType + target.kind + target.key + sorted(executionDomains).
 * The key ignores candidate id, source refs, all scoring inputs (expectedValue,
 * conversionProbability, retentionRisk, estimatedEffort, confidence), and the
 * advisory/metadata fields (recommendsProposalDraft, monetaryAmount, currency).
 * Input order determines precedence: the first candidate to introduce a key is
 * the original; later candidates with the same key are duplicates, and their
 * source refs are merged immutably into the accepted original for provenance
 * (both referenceId and referenceType preserved). No semantic comparison,
 * embeddings, inference, or source-reliability weighting.
 */
export function deduplicateRevenuePlanCandidates(
  candidates: readonly RevenuePlanCandidate[],
): RevenueDeduplicationResult {
  const indexByKey = new Map<string, number>();
  const accepted: RevenuePlanCandidate[] = [];
  const duplicates: DuplicateRevenueReference[] = [];

  for (const candidate of candidates) {
    const key = structuralKey(candidate);
    const existingIndex = indexByKey.get(key);

    if (existingIndex === undefined) {
      indexByKey.set(key, accepted.length);
      accepted.push(candidate);
      continue;
    }

    const original = accepted[existingIndex];
    if (original === undefined) {
      continue;
    }

    duplicates.push({
      revenuePlanId: candidate.revenuePlanId,
      duplicateOfRevenuePlanId: original.revenuePlanId,
    });

    accepted[existingIndex] = {
      ...original,
      sourceRefs: [...original.sourceRefs, ...candidate.sourceRefs],
    };
  }

  return { accepted, duplicates };
}

function structuralKey(candidate: RevenuePlanCandidate): string {
  const sortedDomains = [...candidate.executionDomains].sort().join(',');
  return `${candidate.planType}|${candidate.target.kind}|${candidate.target.key}|${sortedDomains}`;
}
