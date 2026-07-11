import { describe, expect, it } from 'vitest';
import { ExecutionDomain } from '@age/capability-kit';
import { deduplicateRevenuePlanCandidates } from '../../processing/deduplicate-revenue-plan-candidates';
import type { RevenuePlanCandidate } from '../../processing/revenue-plan-candidate';

function buildCandidate(overrides: Partial<RevenuePlanCandidate> = {}): RevenuePlanCandidate {
  return {
    revenuePlanId: 'rev-plan-1',
    planType: 'UPSELL',
    target: { kind: 'ACCOUNT', key: 'account:acme' },
    executionDomains: [ExecutionDomain.CRM],
    expectedValue: 80,
    conversionProbability: 50,
    retentionRisk: 40,
    estimatedEffort: 40,
    confidence: 70,
    sourceRefs: [{ referenceId: 'ops-1', referenceType: 'OPERATIONS_PLAN' }],
    ...overrides,
  };
}

describe('deduplicateRevenuePlanCandidates', () => {
  it('passes distinct candidates through when structural keys differ', () => {
    const r = deduplicateRevenuePlanCandidates([
      buildCandidate({ revenuePlanId: 'a', planType: 'UPSELL' }),
      buildCandidate({ revenuePlanId: 'b', planType: 'RENEWAL' }),
    ]);
    expect(r.accepted).toHaveLength(2);
    expect(r.duplicates).toHaveLength(0);
  });

  it('treats same planType+target+domains as duplicate; first-seen wins', () => {
    const r = deduplicateRevenuePlanCandidates([
      buildCandidate({ revenuePlanId: 'first' }),
      buildCandidate({ revenuePlanId: 'second' }),
    ]);
    expect(r.accepted).toHaveLength(1);
    expect(r.accepted[0]?.revenuePlanId).toBe('first');
    expect(r.duplicates).toEqual([{ revenuePlanId: 'second', duplicateOfRevenuePlanId: 'first' }]);
  });

  it('sorts execution domains so order does not affect the key', () => {
    const r = deduplicateRevenuePlanCandidates([
      buildCandidate({
        revenuePlanId: 'first',
        executionDomains: [ExecutionDomain.CRM, ExecutionDomain.Reporting],
      }),
      buildCandidate({
        revenuePlanId: 'second',
        executionDomains: [ExecutionDomain.Reporting, ExecutionDomain.CRM],
      }),
    ]);
    expect(r.accepted).toHaveLength(1);
    expect(r.duplicates[0]?.revenuePlanId).toBe('second');
  });

  it('different planType is not a duplicate', () => {
    const r = deduplicateRevenuePlanCandidates([
      buildCandidate({ revenuePlanId: 'a', planType: 'UPSELL' }),
      buildCandidate({ revenuePlanId: 'b', planType: 'CROSS_SELL' }),
    ]);
    expect(r.accepted).toHaveLength(2);
    expect(r.duplicates).toHaveLength(0);
  });

  it('different target key is not a duplicate', () => {
    const r = deduplicateRevenuePlanCandidates([
      buildCandidate({ revenuePlanId: 'a', target: { kind: 'ACCOUNT', key: 'account:acme' } }),
      buildCandidate({ revenuePlanId: 'b', target: { kind: 'ACCOUNT', key: 'account:other' } }),
    ]);
    expect(r.accepted).toHaveLength(2);
    expect(r.duplicates).toHaveLength(0);
  });

  it('different executionDomains is not a duplicate', () => {
    const r = deduplicateRevenuePlanCandidates([
      buildCandidate({ revenuePlanId: 'a', executionDomains: [ExecutionDomain.CRM] }),
      buildCandidate({ revenuePlanId: 'b', executionDomains: [ExecutionDomain.Reporting] }),
    ]);
    expect(r.accepted).toHaveLength(2);
    expect(r.duplicates).toHaveLength(0);
  });

  it('ignores scoring inputs and monetary metadata when computing the key', () => {
    const r = deduplicateRevenuePlanCandidates([
      buildCandidate({
        revenuePlanId: 'first',
        expectedValue: 10,
        conversionProbability: 10,
        retentionRisk: 10,
        estimatedEffort: 10,
        confidence: 10,
        monetaryAmount: 1,
        currency: 'USD',
        recommendsProposalDraft: false,
      }),
      buildCandidate({
        revenuePlanId: 'second',
        expectedValue: 99,
        conversionProbability: 99,
        retentionRisk: 99,
        estimatedEffort: 99,
        confidence: 99,
        monetaryAmount: 999999,
        currency: 'EUR',
        recommendsProposalDraft: true,
      }),
    ]);
    // Same structural key despite wildly different scoring/metadata → duplicate.
    expect(r.accepted).toHaveLength(1);
    expect(r.duplicates).toHaveLength(1);
  });

  it('merges duplicate source refs immutably into the accepted original', () => {
    const first = buildCandidate({
      revenuePlanId: 'first',
      sourceRefs: [{ referenceId: 'r1', referenceType: 'A' }],
    });
    const second = buildCandidate({
      revenuePlanId: 'second',
      sourceRefs: [{ referenceId: 'r2', referenceType: 'B' }],
    });
    const originalRefs = first.sourceRefs;

    const r = deduplicateRevenuePlanCandidates([first, second]);

    expect(r.accepted[0]?.sourceRefs).toEqual([
      { referenceId: 'r1', referenceType: 'A' },
      { referenceId: 'r2', referenceType: 'B' },
    ]);
    // Immutability: the input candidate is untouched.
    expect(first.sourceRefs).toBe(originalRefs);
    expect(first.sourceRefs).toHaveLength(1);
    expect(r.accepted[0]).not.toBe(first);
  });

  it('preserves both referenceId and referenceType on merged source refs', () => {
    const r = deduplicateRevenuePlanCandidates([
      buildCandidate({
        revenuePlanId: 'first',
        sourceRefs: [{ referenceId: 'r1', referenceType: 'OPERATIONS_PLAN' }],
      }),
      buildCandidate({
        revenuePlanId: 'second',
        sourceRefs: [{ referenceId: 'r2', referenceType: 'GROWTH_PLAN' }],
      }),
    ]);
    const merged = r.accepted[0]?.sourceRefs ?? [];
    expect(merged).toContainEqual({ referenceId: 'r1', referenceType: 'OPERATIONS_PLAN' });
    expect(merged).toContainEqual({ referenceId: 'r2', referenceType: 'GROWTH_PLAN' });
  });

  it('returns empty result for empty input (no semantic / source-reliability behavior)', () => {
    const r = deduplicateRevenuePlanCandidates([]);
    expect(r.accepted).toHaveLength(0);
    expect(r.duplicates).toHaveLength(0);
  });
});
