import { describe, expect, it } from 'vitest';
import { ExecutionDomain } from '@age/capability-kit';
import { validateOpportunity } from '../../processing/validate-opportunity';
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

describe('validateOpportunity', () => {
  it('returns null for a well-formed candidate', () => {
    expect(validateOpportunity(buildCandidate())).toBeNull();
  });

  it('rejects with MISSING_ID when opportunityId is blank', () => {
    expect(validateOpportunity(buildCandidate({ opportunityId: '  ' }))?.reasonCode).toBe(
      'MISSING_ID',
    );
  });

  it('rejects with EMPTY_TARGET_KEY when target key is blank', () => {
    const result = validateOpportunity(buildCandidate({ target: { kind: 'KEYWORD', key: '' } }));
    expect(result?.reasonCode).toBe('EMPTY_TARGET_KEY');
  });

  it('rejects with NO_EXECUTION_DOMAIN when executionDomains is empty', () => {
    expect(validateOpportunity(buildCandidate({ executionDomains: [] }))?.reasonCode).toBe(
      'NO_EXECUTION_DOMAIN',
    );
  });

  it('rejects with NO_SOURCE_REF when sourceRefs is empty', () => {
    expect(validateOpportunity(buildCandidate({ sourceRefs: [] }))?.reasonCode).toBe(
      'NO_SOURCE_REF',
    );
  });

  it('rejects with INVALID_STRENGTH when strength is out of range', () => {
    expect(validateOpportunity(buildCandidate({ strength: -1 }))?.reasonCode).toBe(
      'INVALID_STRENGTH',
    );
    expect(validateOpportunity(buildCandidate({ strength: 101 }))?.reasonCode).toBe(
      'INVALID_STRENGTH',
    );
  });

  it('rejects with INVALID_CONFIDENCE when confidence is out of range', () => {
    expect(validateOpportunity(buildCandidate({ confidence: 101 }))?.reasonCode).toBe(
      'INVALID_CONFIDENCE',
    );
  });

  it('rejects with INVALID_DEMAND_VOLUME when demandVolume is negative', () => {
    expect(validateOpportunity(buildCandidate({ demandVolume: -5 }))?.reasonCode).toBe(
      'INVALID_DEMAND_VOLUME',
    );
  });

  it('accepts boundary score values 0 and 100', () => {
    expect(
      validateOpportunity(buildCandidate({ strength: 0, confidence: 0, demandVolume: 0 })),
    ).toBeNull();
    expect(validateOpportunity(buildCandidate({ strength: 100, confidence: 100 }))).toBeNull();
  });

  it('returns exactly one reason using the first violated rule in fixed order', () => {
    const result = validateOpportunity(
      buildCandidate({
        opportunityId: '',
        target: { kind: 'KEYWORD', key: '' },
        executionDomains: [],
      }),
    );
    expect(result?.reasonCode).toBe('MISSING_ID');
  });

  it('attributes the reason to the correct opportunityId', () => {
    const result = validateOpportunity(buildCandidate({ opportunityId: 'opp-9', sourceRefs: [] }));
    expect(result?.opportunityId).toBe('opp-9');
  });
});
