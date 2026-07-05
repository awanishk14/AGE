import { describe, expect, it } from 'vitest';
import { ExecutionDomain } from '@age/capability-kit';
import { deduplicateAuthorityPlanCandidates } from '../../processing/deduplicate-authority-plan-candidates';
import type { AuthorityPlanCandidate } from '../../processing/authority-plan-candidate';

function buildCandidate(overrides: Partial<AuthorityPlanCandidate> = {}): AuthorityPlanCandidate {
  return {
    authorityPlanId: 'plan-1',
    planType: 'CONTENT_STRATEGY',
    target: { kind: 'OPPORTUNITY', key: 'opp:signal-1' },
    executionDomains: [ExecutionDomain.Content],
    expectedImpact: 80,
    confidence: 70,
    estimatedEffort: 40,
    sourceRefs: [{ referenceId: 'ref-1', referenceType: 'OPPORTUNITY' }],
    ...overrides,
  };
}

describe('deduplicateAuthorityPlanCandidates', () => {
  it('keeps structurally distinct candidates and reports no duplicates', () => {
    const result = deduplicateAuthorityPlanCandidates([
      buildCandidate({ authorityPlanId: 'plan-1' }),
      buildCandidate({
        authorityPlanId: 'plan-2',
        target: { kind: 'OPPORTUNITY', key: 'opp:other' },
      }),
    ]);
    expect(result.acceptedCandidates).toHaveLength(2);
    expect(result.duplicateReferences).toEqual([]);
  });

  it('flags a later candidate with the same structural key as a duplicate of the first', () => {
    const result = deduplicateAuthorityPlanCandidates([
      buildCandidate({ authorityPlanId: 'plan-1' }),
      buildCandidate({ authorityPlanId: 'plan-2' }),
    ]);
    expect(result.acceptedCandidates).toHaveLength(1);
    expect(result.duplicateReferences).toEqual([
      { authorityPlanId: 'plan-2', duplicateOfAuthorityPlanId: 'plan-1' },
    ]);
  });

  it('treats execution-domain order as insignificant in the structural key', () => {
    const result = deduplicateAuthorityPlanCandidates([
      buildCandidate({
        authorityPlanId: 'plan-1',
        executionDomains: [ExecutionDomain.Content, ExecutionDomain.PR],
      }),
      buildCandidate({
        authorityPlanId: 'plan-2',
        executionDomains: [ExecutionDomain.PR, ExecutionDomain.Content],
      }),
    ]);
    expect(result.duplicateReferences).toEqual([
      { authorityPlanId: 'plan-2', duplicateOfAuthorityPlanId: 'plan-1' },
    ]);
  });

  it('does not merge candidates differing by planType or target', () => {
    const result = deduplicateAuthorityPlanCandidates([
      buildCandidate({ authorityPlanId: 'plan-1', planType: 'CONTENT_STRATEGY' }),
      buildCandidate({ authorityPlanId: 'plan-2', planType: 'THOUGHT_LEADERSHIP' }),
    ]);
    expect(result.acceptedCandidates).toHaveLength(2);
    expect(result.duplicateReferences).toEqual([]);
  });

  it('merges duplicate source refs into the accepted original immutably, preserving referenceType', () => {
    const first = buildCandidate({
      authorityPlanId: 'plan-1',
      sourceRefs: [{ referenceId: 'r1', referenceType: 'OPPORTUNITY' }],
    });
    const originalRefs = first.sourceRefs;
    const result = deduplicateAuthorityPlanCandidates([
      first,
      buildCandidate({
        authorityPlanId: 'plan-2',
        sourceRefs: [{ referenceId: 'r2', referenceType: 'GROWTH_PLAN' }],
      }),
    ]);
    expect(result.acceptedCandidates[0]?.sourceRefs).toEqual([
      { referenceId: 'r1', referenceType: 'OPPORTUNITY' },
      { referenceId: 'r2', referenceType: 'GROWTH_PLAN' },
    ]);
    // original input candidate was not mutated
    expect(first.sourceRefs).toBe(originalRefs);
    expect(first.sourceRefs).toHaveLength(1);
  });

  it('reports each duplicate exactly once and points every duplicate at the first-seen original', () => {
    const result = deduplicateAuthorityPlanCandidates([
      buildCandidate({ authorityPlanId: 'plan-1' }),
      buildCandidate({ authorityPlanId: 'plan-2' }),
      buildCandidate({ authorityPlanId: 'plan-3' }),
    ]);
    const ids = result.duplicateReferences.map((d) => d.authorityPlanId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(result.duplicateReferences).toEqual([
      { authorityPlanId: 'plan-2', duplicateOfAuthorityPlanId: 'plan-1' },
      { authorityPlanId: 'plan-3', duplicateOfAuthorityPlanId: 'plan-1' },
    ]);
  });

  it('is deterministic for the same input', () => {
    const candidates = [
      buildCandidate({ authorityPlanId: 'plan-1' }),
      buildCandidate({ authorityPlanId: 'plan-2', target: { kind: 'TOPIC', key: 't:x' } }),
    ];
    expect(deduplicateAuthorityPlanCandidates(candidates)).toEqual(
      deduplicateAuthorityPlanCandidates(candidates),
    );
  });
});
