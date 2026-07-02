import { describe, expect, it } from 'vitest';
import { ExecutionDomain } from '@age/capability-kit';
import { deduplicateOpportunities } from '../../processing/deduplicate-opportunities';
import type { MarketOpportunityCandidate } from '../../processing/market-opportunity-candidate';

function buildCandidate(
  overrides: Partial<MarketOpportunityCandidate> = {},
): MarketOpportunityCandidate {
  return {
    opportunityId: 'opp-1',
    opportunityType: 'VISIBILITY',
    target: { kind: 'KEYWORD', key: 'crm software' },
    executionDomains: [ExecutionDomain.SEO],
    strength: 80,
    confidence: 70,
    demandVolume: 500,
    sourceRefs: [{ signalId: 'signal-1', signalType: 'KEYWORD_GAP' }],
    ...overrides,
  };
}

describe('deduplicateOpportunities', () => {
  it('keeps structurally distinct candidates and reports no duplicates', () => {
    const result = deduplicateOpportunities([
      buildCandidate({ opportunityId: 'opp-1' }),
      buildCandidate({ opportunityId: 'opp-2', target: { kind: 'KEYWORD', key: 'erp software' } }),
    ]);
    expect(result.acceptedCandidates).toHaveLength(2);
    expect(result.duplicateReferences).toEqual([]);
  });

  it('flags a later candidate with the same structural key as a duplicate of the first', () => {
    const result = deduplicateOpportunities([
      buildCandidate({
        opportunityId: 'opp-1',
        sourceRefs: [{ signalId: 's1', signalType: 'KEYWORD_GAP' }],
      }),
      buildCandidate({
        opportunityId: 'opp-2',
        sourceRefs: [{ signalId: 's2', signalType: 'KEYWORD_GAP' }],
      }),
    ]);
    expect(result.acceptedCandidates).toHaveLength(1);
    expect(result.duplicateReferences).toEqual([
      { opportunityId: 'opp-2', duplicateOfOpportunityId: 'opp-1' },
    ]);
  });

  it('treats execution-domain order as insignificant in the structural key', () => {
    const result = deduplicateOpportunities([
      buildCandidate({
        opportunityId: 'opp-1',
        executionDomains: [ExecutionDomain.SEO, ExecutionDomain.Content],
      }),
      buildCandidate({
        opportunityId: 'opp-2',
        executionDomains: [ExecutionDomain.Content, ExecutionDomain.SEO],
      }),
    ]);
    expect(result.duplicateReferences).toEqual([
      { opportunityId: 'opp-2', duplicateOfOpportunityId: 'opp-1' },
    ]);
  });

  it('does not merge candidates differing by opportunityType or target', () => {
    const result = deduplicateOpportunities([
      buildCandidate({ opportunityId: 'opp-1', opportunityType: 'VISIBILITY' }),
      buildCandidate({ opportunityId: 'opp-2', opportunityType: 'CONTENT' }),
    ]);
    expect(result.acceptedCandidates).toHaveLength(2);
    expect(result.duplicateReferences).toEqual([]);
  });

  it('merges duplicate source refs into the accepted original for provenance', () => {
    const result = deduplicateOpportunities([
      buildCandidate({
        opportunityId: 'opp-1',
        sourceRefs: [{ signalId: 's1', signalType: 'KEYWORD_GAP' }],
      }),
      buildCandidate({
        opportunityId: 'opp-2',
        sourceRefs: [{ signalId: 's2', signalType: 'KEYWORD_GAP' }],
      }),
    ]);
    expect(result.acceptedCandidates[0]?.sourceRefs).toEqual([
      { signalId: 's1', signalType: 'KEYWORD_GAP' },
      { signalId: 's2', signalType: 'KEYWORD_GAP' },
    ]);
  });

  it('reports each duplicate exactly once and points every duplicate at the first-seen original', () => {
    const result = deduplicateOpportunities([
      buildCandidate({ opportunityId: 'opp-1' }),
      buildCandidate({ opportunityId: 'opp-2' }),
      buildCandidate({ opportunityId: 'opp-3' }),
    ]);
    const ids = result.duplicateReferences.map((d) => d.opportunityId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(result.duplicateReferences).toEqual([
      { opportunityId: 'opp-2', duplicateOfOpportunityId: 'opp-1' },
      { opportunityId: 'opp-3', duplicateOfOpportunityId: 'opp-1' },
    ]);
  });

  it('is deterministic for the same input', () => {
    const candidates = [
      buildCandidate({ opportunityId: 'opp-1' }),
      buildCandidate({ opportunityId: 'opp-2' }),
    ];
    expect(deduplicateOpportunities(candidates)).toEqual(deduplicateOpportunities(candidates));
  });
});
