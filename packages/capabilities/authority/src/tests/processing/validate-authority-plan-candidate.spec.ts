import { describe, expect, it } from 'vitest';
import { ExecutionDomain } from '@age/capability-kit';
import { validateAuthorityPlanCandidate } from '../../processing/validate-authority-plan-candidate';
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

describe('validateAuthorityPlanCandidate', () => {
  it('returns null for a valid candidate', () => {
    expect(validateAuthorityPlanCandidate(buildCandidate())).toBeNull();
  });

  it('rejects a blank / whitespace-only id with MISSING_ID', () => {
    const reason = validateAuthorityPlanCandidate(buildCandidate({ authorityPlanId: '   ' }));
    expect(reason?.reasonCode).toBe('MISSING_ID');
    expect(reason?.authorityPlanId).toBe('   ');
  });

  it('rejects a blank target key with EMPTY_PLAN_TARGET', () => {
    const reason = validateAuthorityPlanCandidate(
      buildCandidate({ target: { kind: 'OPPORTUNITY', key: '  ' } }),
    );
    expect(reason?.reasonCode).toBe('EMPTY_PLAN_TARGET');
  });

  it('rejects empty executionDomains with NO_EXECUTION_DOMAIN', () => {
    const reason = validateAuthorityPlanCandidate(buildCandidate({ executionDomains: [] }));
    expect(reason?.reasonCode).toBe('NO_EXECUTION_DOMAIN');
  });

  it('rejects empty sourceRefs with NO_SOURCE_REF', () => {
    const reason = validateAuthorityPlanCandidate(buildCandidate({ sourceRefs: [] }));
    expect(reason?.reasonCode).toBe('NO_SOURCE_REF');
  });

  it('rejects an out-of-range expectedImpact with INVALID_IMPACT', () => {
    expect(
      validateAuthorityPlanCandidate(buildCandidate({ expectedImpact: 101 }))?.reasonCode,
    ).toBe('INVALID_IMPACT');
    expect(validateAuthorityPlanCandidate(buildCandidate({ expectedImpact: -1 }))?.reasonCode).toBe(
      'INVALID_IMPACT',
    );
  });

  it('rejects an out-of-range estimatedEffort with INVALID_EFFORT', () => {
    expect(
      validateAuthorityPlanCandidate(buildCandidate({ estimatedEffort: 200 }))?.reasonCode,
    ).toBe('INVALID_EFFORT');
  });

  it('rejects an out-of-range confidence with INVALID_CONFIDENCE', () => {
    expect(validateAuthorityPlanCandidate(buildCandidate({ confidence: -5 }))?.reasonCode).toBe(
      'INVALID_CONFIDENCE',
    );
  });

  it('rejects non-finite scores as invalid', () => {
    expect(
      validateAuthorityPlanCandidate(buildCandidate({ expectedImpact: Number.NaN }))?.reasonCode,
    ).toBe('INVALID_IMPACT');
    expect(
      validateAuthorityPlanCandidate(buildCandidate({ estimatedEffort: Number.POSITIVE_INFINITY }))
        ?.reasonCode,
    ).toBe('INVALID_EFFORT');
    expect(
      validateAuthorityPlanCandidate(buildCandidate({ confidence: Number.NEGATIVE_INFINITY }))
        ?.reasonCode,
    ).toBe('INVALID_CONFIDENCE');
  });

  it('accepts boundary values 0 and 100', () => {
    expect(
      validateAuthorityPlanCandidate(
        buildCandidate({ expectedImpact: 0, estimatedEffort: 0, confidence: 0 }),
      ),
    ).toBeNull();
    expect(
      validateAuthorityPlanCandidate(
        buildCandidate({ expectedImpact: 100, estimatedEffort: 100, confidence: 100 }),
      ),
    ).toBeNull();
  });

  it('applies fixed order, first-violated-wins', () => {
    // Violates every rule at once; MISSING_ID is first in fixed order.
    const reason = validateAuthorityPlanCandidate(
      buildCandidate({
        authorityPlanId: '',
        target: { kind: 'OPPORTUNITY', key: '' },
        executionDomains: [],
        sourceRefs: [],
        expectedImpact: 999,
        estimatedEffort: 999,
        confidence: 999,
      }),
    );
    expect(reason?.reasonCode).toBe('MISSING_ID');
  });

  it('prefers EMPTY_PLAN_TARGET over later violations when id is valid', () => {
    const reason = validateAuthorityPlanCandidate(
      buildCandidate({
        target: { kind: 'OPPORTUNITY', key: '' },
        executionDomains: [],
        sourceRefs: [],
        expectedImpact: 999,
      }),
    );
    expect(reason?.reasonCode).toBe('EMPTY_PLAN_TARGET');
  });

  it('prefers NO_EXECUTION_DOMAIN over NO_SOURCE_REF and score errors', () => {
    const reason = validateAuthorityPlanCandidate(
      buildCandidate({ executionDomains: [], sourceRefs: [], expectedImpact: 999 }),
    );
    expect(reason?.reasonCode).toBe('NO_EXECUTION_DOMAIN');
  });

  it('prefers NO_SOURCE_REF over score errors', () => {
    const reason = validateAuthorityPlanCandidate(
      buildCandidate({ sourceRefs: [], expectedImpact: 999 }),
    );
    expect(reason?.reasonCode).toBe('NO_SOURCE_REF');
  });

  it('prefers INVALID_IMPACT over INVALID_EFFORT and INVALID_CONFIDENCE', () => {
    const reason = validateAuthorityPlanCandidate(
      buildCandidate({ expectedImpact: 999, estimatedEffort: 999, confidence: 999 }),
    );
    expect(reason?.reasonCode).toBe('INVALID_IMPACT');
  });

  it('prefers INVALID_EFFORT over INVALID_CONFIDENCE', () => {
    const reason = validateAuthorityPlanCandidate(
      buildCandidate({ estimatedEffort: 999, confidence: 999 }),
    );
    expect(reason?.reasonCode).toBe('INVALID_EFFORT');
  });
});
