import { describe, expect, it } from 'vitest';
import { ExecutionDomain } from '@age/capability-kit';
import { validateRevenuePlanCandidate } from '../../processing/validate-revenue-plan-candidate';
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

describe('validateRevenuePlanCandidate', () => {
  it('returns null for a valid candidate', () => {
    expect(validateRevenuePlanCandidate(buildCandidate())).toBeNull();
  });

  it('accepts boundary values 0 and 100 for all scoring inputs', () => {
    expect(
      validateRevenuePlanCandidate(
        buildCandidate({
          expectedValue: 0,
          conversionProbability: 100,
          retentionRisk: 0,
          estimatedEffort: 100,
          confidence: 0,
        }),
      ),
    ).toBeNull();
  });

  it('flags MISSING_ID for blank id and reports revenuePlanId (never itemId)', () => {
    const r = validateRevenuePlanCandidate(buildCandidate({ revenuePlanId: '   ' }));
    expect(r?.reasonCode).toBe('MISSING_ID');
    expect(r?.revenuePlanId).toBe('   ');
    expect(r && 'itemId' in r).toBe(false);
  });

  it('flags EMPTY_PLAN_TARGET for blank target key', () => {
    expect(
      validateRevenuePlanCandidate(buildCandidate({ target: { kind: 'ACCOUNT', key: '' } }))
        ?.reasonCode,
    ).toBe('EMPTY_PLAN_TARGET');
  });

  it('flags NO_EXECUTION_DOMAIN for empty executionDomains', () => {
    expect(validateRevenuePlanCandidate(buildCandidate({ executionDomains: [] }))?.reasonCode).toBe(
      'NO_EXECUTION_DOMAIN',
    );
  });

  it('flags NO_SOURCE_REF for empty sourceRefs', () => {
    expect(validateRevenuePlanCandidate(buildCandidate({ sourceRefs: [] }))?.reasonCode).toBe(
      'NO_SOURCE_REF',
    );
  });

  it('flags INVALID_EXPECTED_VALUE for out-of-range / non-finite expectedValue', () => {
    expect(validateRevenuePlanCandidate(buildCandidate({ expectedValue: -1 }))?.reasonCode).toBe(
      'INVALID_EXPECTED_VALUE',
    );
    expect(validateRevenuePlanCandidate(buildCandidate({ expectedValue: 101 }))?.reasonCode).toBe(
      'INVALID_EXPECTED_VALUE',
    );
    expect(
      validateRevenuePlanCandidate(buildCandidate({ expectedValue: Number.NaN }))?.reasonCode,
    ).toBe('INVALID_EXPECTED_VALUE');
  });

  it('flags INVALID_CONVERSION_PROBABILITY', () => {
    expect(
      validateRevenuePlanCandidate(buildCandidate({ conversionProbability: 200 }))?.reasonCode,
    ).toBe('INVALID_CONVERSION_PROBABILITY');
    expect(
      validateRevenuePlanCandidate(
        buildCandidate({ conversionProbability: Number.POSITIVE_INFINITY }),
      )?.reasonCode,
    ).toBe('INVALID_CONVERSION_PROBABILITY');
  });

  it('flags INVALID_RETENTION_RISK', () => {
    expect(validateRevenuePlanCandidate(buildCandidate({ retentionRisk: -0.5 }))?.reasonCode).toBe(
      'INVALID_RETENTION_RISK',
    );
  });

  it('flags INVALID_EFFORT', () => {
    expect(
      validateRevenuePlanCandidate(buildCandidate({ estimatedEffort: 100.5 }))?.reasonCode,
    ).toBe('INVALID_EFFORT');
  });

  it('flags INVALID_CONFIDENCE', () => {
    expect(validateRevenuePlanCandidate(buildCandidate({ confidence: -10 }))?.reasonCode).toBe(
      'INVALID_CONFIDENCE',
    );
  });

  it('applies fixed order, first-violated-wins (all violated → MISSING_ID)', () => {
    const allBad = buildCandidate({
      revenuePlanId: '',
      target: { kind: 'ACCOUNT', key: '' },
      executionDomains: [],
      sourceRefs: [],
      expectedValue: -1,
      conversionProbability: -1,
      retentionRisk: -1,
      estimatedEffort: -1,
      confidence: -1,
    });
    expect(validateRevenuePlanCandidate(allBad)?.reasonCode).toBe('MISSING_ID');
  });

  it('reports expectedValue before conversion before risk before effort before confidence', () => {
    expect(
      validateRevenuePlanCandidate(
        buildCandidate({
          expectedValue: -1,
          conversionProbability: -1,
          retentionRisk: -1,
          estimatedEffort: -1,
          confidence: -1,
        }),
      )?.reasonCode,
    ).toBe('INVALID_EXPECTED_VALUE');
    expect(
      validateRevenuePlanCandidate(buildCandidate({ conversionProbability: -1, retentionRisk: -1 }))
        ?.reasonCode,
    ).toBe('INVALID_CONVERSION_PROBABILITY');
  });

  it('ignores monetaryAmount / currency during validation', () => {
    // Negative monetaryAmount + junk currency but all scoring inputs valid → null.
    expect(
      validateRevenuePlanCandidate(
        buildCandidate({ monetaryAmount: -9999, currency: 'not-a-currency' }),
      ),
    ).toBeNull();
  });
});
