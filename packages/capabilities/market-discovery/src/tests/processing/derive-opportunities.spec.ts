import { describe, expect, it } from 'vitest';
import { ExecutionDomain } from '@age/capability-kit';
import type {
  MarketDiscoveryInput,
  MarketSignal,
  MarketSignalType,
  OpportunityType,
} from '@age/market-discovery-contracts';
import { deriveOpportunities } from '../../processing/derive-opportunities';

function buildSignal(overrides: Partial<MarketSignal> = {}): MarketSignal {
  return {
    id: 'signal-1',
    type: 'KEYWORD_GAP',
    target: { kind: 'KEYWORD', key: 'crm software' },
    executionDomains: [ExecutionDomain.SEO],
    strength: 80,
    confidence: 70,
    demandVolume: 500,
    observedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function buildInput(signals: readonly MarketSignal[]): MarketDiscoveryInput {
  return {
    clientId: 'client-1',
    organizationId: 'org-1',
    signals,
    generatedAt: '2026-07-10T00:00:00.000Z',
  };
}

describe('deriveOpportunities', () => {
  const mappings: ReadonlyArray<readonly [MarketSignalType, OpportunityType]> = [
    ['KEYWORD_GAP', 'VISIBILITY'],
    ['RISING_TREND', 'DEMAND_CAPTURE'],
    ['UNMET_DEMAND', 'DEMAND_CAPTURE'],
    ['COMPETITOR_WEAKNESS', 'COMPETITIVE_DISPLACEMENT'],
    ['CONTENT_GAP', 'CONTENT'],
    ['LOCAL_VISIBILITY_GAP', 'LOCAL_PRESENCE'],
    ['CONVERSION_FRICTION', 'CONVERSION'],
  ];

  it.each(mappings)('maps signal type %s to opportunity type %s', (signalType, opportunityType) => {
    const [candidate] = deriveOpportunities(buildInput([buildSignal({ type: signalType })]));
    expect(candidate?.opportunityType).toBe(opportunityType);
  });

  it('produces exactly one candidate per signal', () => {
    const candidates = deriveOpportunities(
      buildInput([
        buildSignal({ id: 'signal-1' }),
        buildSignal({ id: 'signal-2' }),
        buildSignal({ id: 'signal-3' }),
      ]),
    );
    expect(candidates).toHaveLength(3);
    expect(candidates.map((c) => c.opportunityId)).toEqual(['signal-1', 'signal-2', 'signal-3']);
  });

  it('returns an empty list for empty input', () => {
    expect(deriveOpportunities(buildInput([]))).toEqual([]);
  });

  it('uses the signal id as the opportunity id and a single provenance source ref', () => {
    const [candidate] = deriveOpportunities(buildInput([buildSignal({ id: 'signal-42' })]));
    expect(candidate?.opportunityId).toBe('signal-42');
    expect(candidate?.sourceRefs).toEqual([{ signalId: 'signal-42', signalType: 'KEYWORD_GAP' }]);
  });

  it('preserves target, executionDomains, and scoring inputs', () => {
    const [candidate] = deriveOpportunities(
      buildInput([
        buildSignal({
          target: { kind: 'COMPETITOR', key: 'competitor:acme' },
          executionDomains: [ExecutionDomain.PR, ExecutionDomain.Content],
          strength: 61,
          confidence: 42,
          demandVolume: 900,
        }),
      ]),
    );
    expect(candidate?.target).toEqual({ kind: 'COMPETITOR', key: 'competitor:acme' });
    expect(candidate?.executionDomains).toEqual([ExecutionDomain.PR, ExecutionDomain.Content]);
    expect(candidate?.strength).toBe(61);
    expect(candidate?.confidence).toBe(42);
    expect(candidate?.demandVolume).toBe(900);
  });

  it('is deterministic for the same input', () => {
    const input = buildInput([buildSignal({ id: 'signal-1' }), buildSignal({ id: 'signal-2' })]);
    expect(deriveOpportunities(input)).toEqual(deriveOpportunities(input));
  });
});
