import { describe, expect, it } from 'vitest';
import { ExecutionDomain } from '@age/capability-kit';
import type {
  BifFieldReference,
  MarketDiscoveryInput,
  MarketOpportunitySourceRef,
  MarketSignal,
  MarketSignalTarget,
  MarketSignalTargetKind,
  MarketSignalType,
  OpportunityPriority,
  OpportunityType,
} from '../index';

function buildSignal(overrides: Partial<MarketSignal> = {}): MarketSignal {
  const target: MarketSignalTarget = { kind: 'KEYWORD', key: 'crm software' };
  return {
    id: 'signal-1',
    type: 'KEYWORD_GAP',
    target,
    executionDomains: [ExecutionDomain.SEO],
    strength: 80,
    confidence: 70,
    demandVolume: 500,
    observedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('@age/market-discovery-contracts', () => {
  it('constructs a well-formed MarketSignal with explicit scoring inputs', () => {
    const signal = buildSignal();
    expect(signal.strength).toBe(80);
    expect(signal.confidence).toBe(70);
    expect(signal.demandVolume).toBe(500);
    expect(signal.target.kind).toBe('KEYWORD');
  });

  it('carries ExecutionDomain values as opaque structural tags', () => {
    const signal = buildSignal({
      executionDomains: [ExecutionDomain.SEO, ExecutionDomain.LocalSEO, ExecutionDomain.Content],
    });
    expect(signal.executionDomains).toHaveLength(3);
    expect(signal.executionDomains).toContain(ExecutionDomain.LocalSEO);
  });

  it('supports optional read-only BIF field provenance', () => {
    const bifFields: readonly BifFieldReference[] = [
      { section: 'products_services', fieldKey: 'products', path: 'products_services.products[0]' },
    ];
    const signal = buildSignal({ bifFields });
    expect(signal.bifFields?.[0]?.path).toBe('products_services.products[0]');
  });

  it('constructs a MarketDiscoveryInput batching multiple signals', () => {
    const input: MarketDiscoveryInput = {
      clientId: 'client-1',
      organizationId: 'org-1',
      signals: [
        buildSignal({ id: 'signal-1' }),
        buildSignal({ id: 'signal-2', type: 'RISING_TREND' }),
      ],
      generatedAt: '2026-07-10T00:00:00.000Z',
    };
    expect(input.signals).toHaveLength(2);
    expect(input.signals.map((s) => s.id)).toEqual(['signal-1', 'signal-2']);
    expect(input.generatedAt).toBe('2026-07-10T00:00:00.000Z');
  });

  it('constructs a MarketOpportunitySourceRef', () => {
    const ref: MarketOpportunitySourceRef = { signalId: 'signal-1', signalType: 'KEYWORD_GAP' };
    expect(ref.signalId).toBe('signal-1');
    expect(ref.signalType).toBe('KEYWORD_GAP');
  });

  it('accepts every declared MarketSignalType', () => {
    const types: readonly MarketSignalType[] = [
      'KEYWORD_GAP',
      'COMPETITOR_WEAKNESS',
      'UNMET_DEMAND',
      'RISING_TREND',
      'CONTENT_GAP',
      'LOCAL_VISIBILITY_GAP',
      'CONVERSION_FRICTION',
    ];
    expect(types).toHaveLength(7);
  });

  it('accepts every declared MarketSignalTargetKind', () => {
    const kinds: readonly MarketSignalTargetKind[] = [
      'KEYWORD',
      'COMPETITOR',
      'TOPIC',
      'LOCATION',
      'SEGMENT',
    ];
    expect(kinds).toHaveLength(5);
  });

  it('accepts every declared OpportunityType', () => {
    const opportunityTypes: readonly OpportunityType[] = [
      'VISIBILITY',
      'DEMAND_CAPTURE',
      'COMPETITIVE_DISPLACEMENT',
      'CONTENT',
      'LOCAL_PRESENCE',
      'CONVERSION',
    ];
    expect(opportunityTypes).toHaveLength(6);
  });

  it('accepts every declared OpportunityPriority band', () => {
    const priorities: readonly OpportunityPriority[] = ['LOW', 'MEDIUM', 'HIGH'];
    expect(priorities).toEqual(['LOW', 'MEDIUM', 'HIGH']);
  });
});
