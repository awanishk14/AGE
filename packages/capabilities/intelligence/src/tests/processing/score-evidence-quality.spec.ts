import { describe, expect, it } from 'vitest';
import { EvidenceSource, EvidenceState, SignalType, Polarity } from '@age/evidence-contracts';
import type { Evidence } from '@age/evidence-contracts';
import { scoreEvidenceQuality } from '../../processing/score-evidence-quality';

function buildEvidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: 'evidence-1',
    source: EvidenceSource.REDDIT,
    sourceUrl: 'https://reddit.com/r/example/post-1',
    timestamp: '2026-07-01T00:00:00.000Z',
    entityLinked: {},
    signalType: SignalType.PAIN_POINT,
    rawContent: 'x'.repeat(240),
    extractedSignals: [],
    confidence: 0,
    state: EvidenceState.NEW,
    metadata: {},
    ...overrides,
  };
}

describe('scoreEvidenceQuality', () => {
  it('returns 0 for the minimum boundary: zero confidence, no signals, empty content', () => {
    const score = scoreEvidenceQuality(buildEvidence({ confidence: 0, rawContent: '' }));
    expect(score).toBe(0);
  });

  it('returns 100 for the maximum boundary: full confidence, max signal strength, full content', () => {
    const score = scoreEvidenceQuality(
      buildEvidence({
        confidence: 100,
        rawContent: 'x'.repeat(240),
        extractedSignals: [
          {
            type: 'PAIN_POINT',
            value: 'v',
            targetField: 'product.performance',
            strength: 100,
            polarity: Polarity.NEGATIVE,
          },
        ],
      }),
    );
    expect(score).toBe(100);
  });

  it('weights confidence at 55%', () => {
    const score = scoreEvidenceQuality(buildEvidence({ confidence: 100, rawContent: '' }));
    expect(score).toBe(55);
  });

  it('weights average extracted signal strength at 35%', () => {
    const score = scoreEvidenceQuality(
      buildEvidence({
        confidence: 0,
        rawContent: '',
        extractedSignals: [
          {
            type: 'PAIN_POINT',
            value: 'v',
            targetField: 'product.performance',
            strength: 100,
            polarity: Polarity.NEGATIVE,
          },
        ],
      }),
    );
    expect(score).toBe(35);
  });

  it('weights content substantiveness at 10%, capped at 240 characters', () => {
    const score = scoreEvidenceQuality(
      buildEvidence({ confidence: 0, rawContent: 'x'.repeat(240) }),
    );
    expect(score).toBe(10);

    const cappedScore = scoreEvidenceQuality(
      buildEvidence({ confidence: 0, rawContent: 'x'.repeat(10_000) }),
    );
    expect(cappedScore).toBe(10);
  });

  it('averages strength across multiple extracted signals', () => {
    const score = scoreEvidenceQuality(
      buildEvidence({
        confidence: 0,
        rawContent: '',
        extractedSignals: [
          {
            type: 'PAIN_POINT',
            value: 'v1',
            targetField: 'product.performance',
            strength: 100,
            polarity: Polarity.NEGATIVE,
          },
          {
            type: 'PAIN_POINT',
            value: 'v2',
            targetField: 'product.performance',
            strength: 0,
            polarity: Polarity.NEGATIVE,
          },
        ],
      }),
    );
    // average strength = 50 -> 0.35 * 50 = 17.5 -> rounds to 18
    expect(score).toBe(18);
  });

  it('never returns a value outside [0, 100]', () => {
    const score = scoreEvidenceQuality(
      buildEvidence({ confidence: 100, rawContent: 'x'.repeat(1000) }),
    );
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
