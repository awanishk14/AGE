import { describe, expect, it } from 'vitest';
import { EvidenceSource, EvidenceState, SignalType } from '@age/evidence-contracts';
import type { Evidence } from '@age/evidence-contracts';
import { calculateFreshnessDays } from '../../processing/calculate-freshness';

function buildEvidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: 'evidence-1',
    source: EvidenceSource.REDDIT,
    sourceUrl: 'https://reddit.com/r/example/post-1',
    timestamp: '2026-07-01T00:00:00.000Z',
    entityLinked: {},
    signalType: SignalType.PAIN_POINT,
    rawContent: 'Checkout was painfully slow today.',
    extractedSignals: [],
    confidence: 72,
    state: EvidenceState.NEW,
    metadata: {},
    ...overrides,
  };
}

describe('calculateFreshnessDays', () => {
  it('accepts runAt as an explicit input rather than reading the system clock', () => {
    const runAt = new Date('2026-07-05T00:00:00.000Z');
    const evidence = buildEvidence({ timestamp: '2026-07-01T00:00:00.000Z' });
    expect(calculateFreshnessDays(evidence, runAt)).toBe(4);
  });

  it('returns 0 when the evidence timestamp equals runAt', () => {
    const runAt = new Date('2026-07-01T00:00:00.000Z');
    const evidence = buildEvidence({ timestamp: '2026-07-01T00:00:00.000Z' });
    expect(calculateFreshnessDays(evidence, runAt)).toBe(0);
  });

  it('floors partial days', () => {
    const runAt = new Date('2026-07-02T23:59:00.000Z');
    const evidence = buildEvidence({ timestamp: '2026-07-01T00:00:00.000Z' });
    expect(calculateFreshnessDays(evidence, runAt)).toBe(1);
  });

  it('returns 0 for a timestamp in the future relative to runAt', () => {
    const runAt = new Date('2026-07-01T00:00:00.000Z');
    const evidence = buildEvidence({ timestamp: '2026-07-05T00:00:00.000Z' });
    expect(calculateFreshnessDays(evidence, runAt)).toBe(0);
  });

  it('returns 0 for an unparseable timestamp', () => {
    const runAt = new Date('2026-07-05T00:00:00.000Z');
    const evidence = buildEvidence({ timestamp: 'not-a-date' });
    expect(calculateFreshnessDays(evidence, runAt)).toBe(0);
  });

  it('is deterministic given the same inputs', () => {
    const runAt = new Date('2026-08-01T00:00:00.000Z');
    const evidence = buildEvidence({ timestamp: '2026-07-01T00:00:00.000Z' });
    const first = calculateFreshnessDays(evidence, runAt);
    const second = calculateFreshnessDays(evidence, runAt);
    expect(first).toBe(second);
    expect(first).toBe(31);
  });
});
