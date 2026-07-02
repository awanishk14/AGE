import { describe, expect, it } from 'vitest';
import { EvidenceSource, EvidenceState, SignalType, Polarity } from '@age/evidence-contracts';
import type { Evidence } from '@age/evidence-contracts';
import { validateEvidence } from '../../processing/validate-evidence';

function buildEvidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: 'evidence-1',
    source: EvidenceSource.REDDIT,
    sourceUrl: 'https://reddit.com/r/example/post-1',
    timestamp: '2026-07-01T00:00:00.000Z',
    entityLinked: {},
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

describe('validateEvidence', () => {
  it('accepts a well-formed evidence record', () => {
    expect(validateEvidence(buildEvidence())).toBeNull();
  });

  it('rejects with MISSING_ID when id is empty', () => {
    const result = validateEvidence(buildEvidence({ id: '  ' }));
    expect(result?.reasonCode).toBe('MISSING_ID');
  });

  it('rejects with EMPTY_SOURCE_URL when sourceUrl is empty', () => {
    const result = validateEvidence(buildEvidence({ sourceUrl: '' }));
    expect(result?.reasonCode).toBe('EMPTY_SOURCE_URL');
  });

  it('rejects with MISSING_TIMESTAMP when timestamp is unparseable', () => {
    const result = validateEvidence(buildEvidence({ timestamp: 'not-a-date' }));
    expect(result?.reasonCode).toBe('MISSING_TIMESTAMP');
  });

  it('rejects with MISSING_TIMESTAMP when timestamp is empty', () => {
    const result = validateEvidence(buildEvidence({ timestamp: '' }));
    expect(result?.reasonCode).toBe('MISSING_TIMESTAMP');
  });

  it('rejects with INVALID_CONFIDENCE when confidence is below 0', () => {
    const result = validateEvidence(buildEvidence({ confidence: -1 }));
    expect(result?.reasonCode).toBe('INVALID_CONFIDENCE');
  });

  it('rejects with INVALID_CONFIDENCE when confidence is above 100', () => {
    const result = validateEvidence(buildEvidence({ confidence: 101 }));
    expect(result?.reasonCode).toBe('INVALID_CONFIDENCE');
  });

  it('accepts boundary confidence values 0 and 100', () => {
    expect(validateEvidence(buildEvidence({ confidence: 0 }))).toBeNull();
    expect(validateEvidence(buildEvidence({ confidence: 100 }))).toBeNull();
  });

  it('rejects with UNRECOGNIZED_STATE when state is not a known EvidenceState', () => {
    const result = validateEvidence(
      buildEvidence({ state: 'NOT_A_STATE' as unknown as EvidenceState }),
    );
    expect(result?.reasonCode).toBe('UNRECOGNIZED_STATE');
  });

  it('rejects with RAW_CONTENT_TOO_SHORT when rawContent is under the minimum length', () => {
    const result = validateEvidence(buildEvidence({ rawContent: 'hi' }));
    expect(result?.reasonCode).toBe('RAW_CONTENT_TOO_SHORT');
  });

  it('returns exactly one reason, using the first violated rule in fixed order', () => {
    const result = validateEvidence(buildEvidence({ id: '', sourceUrl: '' }));
    expect(result?.reasonCode).toBe('MISSING_ID');
  });

  it('always attributes the reason to the correct evidenceId', () => {
    const result = validateEvidence(buildEvidence({ id: 'evidence-42', sourceUrl: '' }));
    expect(result?.evidenceId).toBe('evidence-42');
  });
});
