import { describe, expect, it } from 'vitest';
import { ExecutionDomain } from '@age/capability-kit';
import { validateOperationsPlanCandidate } from '../../processing/validate-operations-plan-candidate';
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

describe('validateOperationsPlanCandidate', () => {
  it('returns null for a valid candidate', () => {
    expect(validateOperationsPlanCandidate(buildCandidate())).toBeNull();
  });

  it('accepts boundary values 0 and 100 for all scoring inputs', () => {
    expect(
      validateOperationsPlanCandidate(
        buildCandidate({
          operationalUrgency: 0,
          deliveryRisk: 100,
          estimatedEffort: 0,
          confidence: 100,
        }),
      ),
    ).toBeNull();
  });

  it('flags MISSING_ID for blank id', () => {
    const r = validateOperationsPlanCandidate(buildCandidate({ operationsPlanId: '   ' }));
    expect(r?.reasonCode).toBe('MISSING_ID');
    expect(r?.operationsPlanId).toBe('   ');
  });

  it('flags EMPTY_PLAN_TARGET for blank target key', () => {
    const r = validateOperationsPlanCandidate(
      buildCandidate({ target: { kind: 'PROJECT', key: '' } }),
    );
    expect(r?.reasonCode).toBe('EMPTY_PLAN_TARGET');
  });

  it('flags NO_EXECUTION_DOMAIN for empty executionDomains', () => {
    const r = validateOperationsPlanCandidate(buildCandidate({ executionDomains: [] }));
    expect(r?.reasonCode).toBe('NO_EXECUTION_DOMAIN');
  });

  it('flags NO_SOURCE_REF for empty sourceRefs', () => {
    const r = validateOperationsPlanCandidate(buildCandidate({ sourceRefs: [] }));
    expect(r?.reasonCode).toBe('NO_SOURCE_REF');
  });

  it('flags INVALID_URGENCY for out-of-range / non-finite operationalUrgency', () => {
    expect(
      validateOperationsPlanCandidate(buildCandidate({ operationalUrgency: 101 }))?.reasonCode,
    ).toBe('INVALID_URGENCY');
    expect(
      validateOperationsPlanCandidate(buildCandidate({ operationalUrgency: -1 }))?.reasonCode,
    ).toBe('INVALID_URGENCY');
    expect(
      validateOperationsPlanCandidate(buildCandidate({ operationalUrgency: Number.NaN }))
        ?.reasonCode,
    ).toBe('INVALID_URGENCY');
  });

  it('flags INVALID_RISK for out-of-range deliveryRisk', () => {
    expect(validateOperationsPlanCandidate(buildCandidate({ deliveryRisk: 200 }))?.reasonCode).toBe(
      'INVALID_RISK',
    );
    expect(
      validateOperationsPlanCandidate(buildCandidate({ deliveryRisk: Number.POSITIVE_INFINITY }))
        ?.reasonCode,
    ).toBe('INVALID_RISK');
  });

  it('flags INVALID_EFFORT for out-of-range estimatedEffort', () => {
    expect(
      validateOperationsPlanCandidate(buildCandidate({ estimatedEffort: -5 }))?.reasonCode,
    ).toBe('INVALID_EFFORT');
  });

  it('flags INVALID_CONFIDENCE for out-of-range confidence', () => {
    expect(validateOperationsPlanCandidate(buildCandidate({ confidence: 100.5 }))?.reasonCode).toBe(
      'INVALID_CONFIDENCE',
    );
  });

  it('applies fixed order, first-violated-wins (id before target before domains before refs)', () => {
    // Every rule violated at once → must report MISSING_ID (first in order).
    const allBad = buildCandidate({
      operationsPlanId: '',
      target: { kind: 'PROJECT', key: '' },
      executionDomains: [],
      sourceRefs: [],
      operationalUrgency: -1,
      deliveryRisk: -1,
      estimatedEffort: -1,
      confidence: -1,
    });
    expect(validateOperationsPlanCandidate(allBad)?.reasonCode).toBe('MISSING_ID');
  });

  it('reports target before domains when both violated', () => {
    const r = validateOperationsPlanCandidate(
      buildCandidate({ target: { kind: 'PROJECT', key: '' }, executionDomains: [] }),
    );
    expect(r?.reasonCode).toBe('EMPTY_PLAN_TARGET');
  });

  it('reports urgency before risk before effort before confidence when all invalid', () => {
    const r = validateOperationsPlanCandidate(
      buildCandidate({
        operationalUrgency: -1,
        deliveryRisk: -1,
        estimatedEffort: -1,
        confidence: -1,
      }),
    );
    expect(r?.reasonCode).toBe('INVALID_URGENCY');
  });

  it('reports risk before effort when both invalid but urgency valid', () => {
    const r = validateOperationsPlanCandidate(
      buildCandidate({ deliveryRisk: -1, estimatedEffort: -1 }),
    );
    expect(r?.reasonCode).toBe('INVALID_RISK');
  });
});
