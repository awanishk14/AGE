import { describe, expect, it } from 'vitest';
import { EvidenceSource, EvidenceState, SignalType, Polarity } from '@age/evidence-contracts';
import type { Evidence } from '@age/evidence-contracts';
import { detectContradictions } from '../../processing/detect-contradictions';

function buildEvidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: 'evidence-1',
    source: EvidenceSource.REDDIT,
    sourceUrl: 'https://reddit.com/r/example/post-1',
    timestamp: '2026-07-01T00:00:00.000Z',
    entityLinked: { productId: 'product-1' },
    signalType: SignalType.PAIN_POINT,
    rawContent: 'Checkout was painfully slow today.',
    extractedSignals: [
      {
        type: 'PAIN_POINT',
        value: 'slow checkout',
        targetField: 'product.performance',
        strength: 80,
        polarity: Polarity.NEGATIVE,
      },
    ],
    confidence: 72,
    state: EvidenceState.NEW,
    metadata: {},
    ...overrides,
  };
}

describe('detectContradictions', () => {
  it('flags two records with opposite polarity on the same targetField and entity', () => {
    const positive = buildEvidence({
      id: 'evidence-1',
      extractedSignals: [
        {
          type: 'PRAISE',
          value: 'fast checkout',
          targetField: 'product.performance',
          strength: 70,
          polarity: Polarity.POSITIVE,
        },
      ],
    });
    const negative = buildEvidence({ id: 'evidence-2' });

    const result = detectContradictions([positive, negative]);
    expect(result.has('evidence-1')).toBe(true);
    expect(result.has('evidence-2')).toBe(true);
  });

  it('does not flag records targeting different fields', () => {
    const a = buildEvidence({
      id: 'evidence-1',
      extractedSignals: [
        {
          type: 'PRAISE',
          value: 'v',
          targetField: 'product.pricing',
          strength: 70,
          polarity: Polarity.POSITIVE,
        },
      ],
    });
    const b = buildEvidence({ id: 'evidence-2' });

    const result = detectContradictions([a, b]);
    expect(result.size).toBe(0);
  });

  it('does not flag records for unrelated entities', () => {
    const a = buildEvidence({
      id: 'evidence-1',
      entityLinked: { productId: 'product-A' },
      extractedSignals: [
        {
          type: 'PRAISE',
          value: 'v',
          targetField: 'product.performance',
          strength: 70,
          polarity: Polarity.POSITIVE,
        },
      ],
    });
    const b = buildEvidence({ id: 'evidence-2', entityLinked: { productId: 'product-B' } });

    const result = detectContradictions([a, b]);
    expect(result.size).toBe(0);
  });

  it('does not flag two records with the same (non-opposing) polarity', () => {
    const a = buildEvidence({ id: 'evidence-1' });
    const b = buildEvidence({ id: 'evidence-2' });

    const result = detectContradictions([a, b]);
    expect(result.size).toBe(0);
  });

  it('does not treat NEUTRAL polarity as contradicting anything', () => {
    const neutral = buildEvidence({
      id: 'evidence-1',
      extractedSignals: [
        {
          type: 'PRAISE',
          value: 'v',
          targetField: 'product.performance',
          strength: 70,
          polarity: Polarity.NEUTRAL,
        },
      ],
    });
    const negative = buildEvidence({ id: 'evidence-2' });

    const result = detectContradictions([neutral, negative]);
    expect(result.size).toBe(0);
  });

  it('does not flag records with different signalType even if entity and polarity oppose', () => {
    const a = buildEvidence({
      id: 'evidence-1',
      signalType: SignalType.FEATURE_REQUEST,
      extractedSignals: [
        {
          type: 'PRAISE',
          value: 'v',
          targetField: 'product.performance',
          strength: 70,
          polarity: Polarity.POSITIVE,
        },
      ],
    });
    const b = buildEvidence({ id: 'evidence-2', signalType: SignalType.PAIN_POINT });

    const result = detectContradictions([a, b]);
    expect(result.size).toBe(0);
  });

  it('returns an empty set for a batch with no contradictions', () => {
    const result = detectContradictions([buildEvidence({ id: 'evidence-1' })]);
    expect(result.size).toBe(0);
  });
});
