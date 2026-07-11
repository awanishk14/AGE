import { describe, expect, it } from 'vitest';
import { ExecutionDomain } from '@age/capability-kit';
import { deduplicateOperationsPlanCandidates } from '../../processing/deduplicate-operations-plan-candidates';
import type { OperationsPlanCandidate } from '../../processing/operations-plan-candidate';

function buildCandidate(overrides: Partial<OperationsPlanCandidate> = {}): OperationsPlanCandidate {
  return {
    operationsPlanId: 'ops-plan-1',
    planType: 'PROJECT_PLAN',
    target: { kind: 'PROJECT', key: 'project:acme' },
    executionDomains: [ExecutionDomain.Reporting],
    operationalUrgency: 80,
    deliveryRisk: 50,
    estimatedEffort: 40,
    confidence: 70,
    sourceRefs: [{ referenceId: 'ref-1', referenceType: 'AUTHORITY_PLAN' }],
    ...overrides,
  };
}

describe('deduplicateOperationsPlanCandidates', () => {
  it('keeps distinct candidates when structural keys differ', () => {
    const result = deduplicateOperationsPlanCandidates([
      buildCandidate({ operationsPlanId: 'a', planType: 'PROJECT_PLAN' }),
      buildCandidate({ operationsPlanId: 'b', planType: 'QA_PLAN' }),
    ]);
    expect(result.accepted).toHaveLength(2);
    expect(result.duplicates).toHaveLength(0);
  });

  it('treats same planType+target+domains as duplicate; first candidate wins', () => {
    const result = deduplicateOperationsPlanCandidates([
      buildCandidate({
        operationsPlanId: 'first',
        sourceRefs: [{ referenceId: 'r1', referenceType: 'A' }],
      }),
      buildCandidate({
        operationsPlanId: 'second',
        sourceRefs: [{ referenceId: 'r2', referenceType: 'B' }],
      }),
    ]);
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0]?.operationsPlanId).toBe('first');
    expect(result.duplicates).toEqual([
      { operationsPlanId: 'second', duplicateOfOperationsPlanId: 'first' },
    ]);
  });

  it('ignores candidate id and source refs when computing the key', () => {
    // Different ids and source refs, identical structural key → duplicate.
    const result = deduplicateOperationsPlanCandidates([
      buildCandidate({
        operationsPlanId: 'x',
        sourceRefs: [{ referenceId: 'ra', referenceType: 'T' }],
      }),
      buildCandidate({
        operationsPlanId: 'y',
        sourceRefs: [{ referenceId: 'rb', referenceType: 'T' }],
      }),
    ]);
    expect(result.accepted).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
  });

  it('sorts execution domains so order does not affect the key', () => {
    const result = deduplicateOperationsPlanCandidates([
      buildCandidate({
        operationsPlanId: 'first',
        executionDomains: [ExecutionDomain.Reporting, ExecutionDomain.CRM],
      }),
      buildCandidate({
        operationsPlanId: 'second',
        executionDomains: [ExecutionDomain.CRM, ExecutionDomain.Reporting],
      }),
    ]);
    expect(result.accepted).toHaveLength(1);
    expect(result.duplicates[0]?.operationsPlanId).toBe('second');
  });

  it('does NOT treat different domain sets as duplicates', () => {
    const result = deduplicateOperationsPlanCandidates([
      buildCandidate({ operationsPlanId: 'first', executionDomains: [ExecutionDomain.Reporting] }),
      buildCandidate({ operationsPlanId: 'second', executionDomains: [ExecutionDomain.CRM] }),
    ]);
    expect(result.accepted).toHaveLength(2);
    expect(result.duplicates).toHaveLength(0);
  });

  it('merges duplicate source refs immutably into the accepted original', () => {
    const first = buildCandidate({
      operationsPlanId: 'first',
      sourceRefs: [{ referenceId: 'r1', referenceType: 'A' }],
    });
    const second = buildCandidate({
      operationsPlanId: 'second',
      sourceRefs: [{ referenceId: 'r2', referenceType: 'B' }],
    });
    const originalFirstRefs = first.sourceRefs;

    const result = deduplicateOperationsPlanCandidates([first, second]);

    expect(result.accepted[0]?.sourceRefs).toEqual([
      { referenceId: 'r1', referenceType: 'A' },
      { referenceId: 'r2', referenceType: 'B' },
    ]);
    // Immutability: the input candidate's sourceRefs array is untouched.
    expect(first.sourceRefs).toBe(originalFirstRefs);
    expect(first.sourceRefs).toHaveLength(1);
    expect(result.accepted[0]).not.toBe(first);
  });

  it('preserves both referenceId and referenceType on merged source refs', () => {
    const result = deduplicateOperationsPlanCandidates([
      buildCandidate({
        operationsPlanId: 'first',
        sourceRefs: [{ referenceId: 'r1', referenceType: 'TYPE_A' }],
      }),
      buildCandidate({
        operationsPlanId: 'second',
        sourceRefs: [{ referenceId: 'r2', referenceType: 'TYPE_B' }],
      }),
    ]);
    const merged = result.accepted[0]?.sourceRefs ?? [];
    expect(merged).toContainEqual({ referenceId: 'r1', referenceType: 'TYPE_A' });
    expect(merged).toContainEqual({ referenceId: 'r2', referenceType: 'TYPE_B' });
  });

  it('returns empty result for empty input (no semantic matching / weighting)', () => {
    const result = deduplicateOperationsPlanCandidates([]);
    expect(result.accepted).toHaveLength(0);
    expect(result.duplicates).toHaveLength(0);
  });
});
