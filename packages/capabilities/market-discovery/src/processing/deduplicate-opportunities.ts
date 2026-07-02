import type { DuplicateOpportunityReference } from '../opportunity-processing-summary';
import type { MarketOpportunityCandidate } from './market-opportunity-candidate';

/**
 * Result of structural deduplication (ADR-0013). `acceptedCandidates` are the
 * first-seen candidates (each having absorbed the source refs of any duplicates
 * merged into it); `duplicateReferences` records each later duplicate exactly
 * once, pointing at the first-seen original.
 */
export interface DeduplicationResult {
  readonly acceptedCandidates: readonly MarketOpportunityCandidate[];
  readonly duplicateReferences: readonly DuplicateOpportunityReference[];
}

/**
 * deduplicateOpportunities — structural-only duplicate detection. Two candidates
 * are duplicates when they share the same structural key:
 *   opportunityType + target.kind + target.key + sorted(executionDomains).
 * Input order determines precedence: the first candidate to introduce a key is
 * the original; later candidates with the same key are duplicates, and their
 * source refs are merged into the accepted original for provenance. No semantic
 * comparison, embeddings, or inference.
 */
export function deduplicateOpportunities(
  candidates: readonly MarketOpportunityCandidate[],
): DeduplicationResult {
  const indexByKey = new Map<string, number>();
  const acceptedCandidates: MarketOpportunityCandidate[] = [];
  const duplicateReferences: DuplicateOpportunityReference[] = [];

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
      opportunityId: candidate.opportunityId,
      duplicateOfOpportunityId: original.opportunityId,
    });

    acceptedCandidates[existingIndex] = {
      ...original,
      sourceRefs: [...original.sourceRefs, ...candidate.sourceRefs],
    };
  }

  return { acceptedCandidates, duplicateReferences };
}

function structuralKey(candidate: MarketOpportunityCandidate): string {
  const sortedDomains = [...candidate.executionDomains].sort().join(',');
  return `${candidate.opportunityType}|${candidate.target.kind}|${candidate.target.key}|${sortedDomains}`;
}
