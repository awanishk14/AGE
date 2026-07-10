import type { DuplicateAuthorityReference } from '../authority-processing-summary';
import type { AuthorityPlanCandidate } from './authority-plan-candidate';

/**
 * Result of structural deduplication (ADR-0017). `acceptedCandidates` are the
 * first-seen candidates (each having absorbed the source refs of any duplicates
 * merged into it); `duplicateReferences` records each later duplicate exactly
 * once, pointing at the first-seen original.
 */
export interface AuthorityDeduplicationResult {
  readonly acceptedCandidates: readonly AuthorityPlanCandidate[];
  readonly duplicateReferences: readonly DuplicateAuthorityReference[];
}

/**
 * deduplicateAuthorityPlanCandidates — structural-only duplicate detection. Two
 * candidates are duplicates when they share the same structural key:
 *   planType + target.kind + target.key + sorted(executionDomains).
 * Input order determines precedence: the first candidate to introduce a key is
 * the original; later candidates with the same key are duplicates, and their
 * source refs are merged immutably into the accepted original for provenance
 * (both referenceId and referenceType preserved). No semantic comparison,
 * embeddings, or inference.
 */
export function deduplicateAuthorityPlanCandidates(
  candidates: readonly AuthorityPlanCandidate[],
): AuthorityDeduplicationResult {
  const indexByKey = new Map<string, number>();
  const acceptedCandidates: AuthorityPlanCandidate[] = [];
  const duplicateReferences: DuplicateAuthorityReference[] = [];

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
      authorityPlanId: candidate.authorityPlanId,
      duplicateOfAuthorityPlanId: original.authorityPlanId,
    });

    acceptedCandidates[existingIndex] = {
      ...original,
      sourceRefs: [...original.sourceRefs, ...candidate.sourceRefs],
    };
  }

  return { acceptedCandidates, duplicateReferences };
}

function structuralKey(candidate: AuthorityPlanCandidate): string {
  const sortedDomains = [...candidate.executionDomains].sort().join(',');
  return `${candidate.planType}|${candidate.target.kind}|${candidate.target.key}|${sortedDomains}`;
}
