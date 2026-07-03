import type { DuplicateGrowthReference } from '../growth-processing-summary';
import type { GrowthPlanCandidate } from './growth-plan-candidate';

/**
 * Result of structural deduplication (ADR-0015). `acceptedCandidates` are the
 * first-seen candidates (each having absorbed the source refs of any duplicates
 * merged into it); `duplicateReferences` records each later duplicate exactly
 * once, pointing at the first-seen original.
 */
export interface GrowthDeduplicationResult {
  readonly acceptedCandidates: readonly GrowthPlanCandidate[];
  readonly duplicateReferences: readonly DuplicateGrowthReference[];
}

/**
 * deduplicateGrowthPlans — structural-only duplicate detection. Two candidates
 * are duplicates when they share the same structural key:
 *   planType + target.kind + target.key + sorted(executionDomains).
 * Input order determines precedence: the first candidate to introduce a key is
 * the original; later candidates with the same key are duplicates, and their
 * source refs are merged into the accepted original for provenance. No semantic
 * comparison, embeddings, or inference.
 */
export function deduplicateGrowthPlans(
  candidates: readonly GrowthPlanCandidate[],
): GrowthDeduplicationResult {
  const indexByKey = new Map<string, number>();
  const acceptedCandidates: GrowthPlanCandidate[] = [];
  const duplicateReferences: DuplicateGrowthReference[] = [];

  for (const candidate of candidates) {
    const key = structuralKey(candidate);
    const existingIndex = indexByKey.get(key);

    if (existingIndex === undefined) {
      indexByKey.set(key, acceptedCandidates.length);
      acceptedCandidates.push(candidate);
      continue;
    }

    const original = acceptedCandidates[existingIndex];
    if (original === undefined) {
      continue;
    }

    duplicateReferences.push({
      planId: candidate.planId,
      duplicateOfPlanId: original.planId,
    });

    acceptedCandidates[existingIndex] = {
      ...original,
      sourceRefs: [...original.sourceRefs, ...candidate.sourceRefs],
    };
  }

  return { acceptedCandidates, duplicateReferences };
}

function structuralKey(candidate: GrowthPlanCandidate): string {
  const sortedDomains = [...candidate.executionDomains].sort().join(',');
  return `${candidate.planType}|${candidate.target.kind}|${candidate.target.key}|${sortedDomains}`;
}
