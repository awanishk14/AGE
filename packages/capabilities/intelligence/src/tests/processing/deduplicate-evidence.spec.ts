import { describe, expect, it } from 'vitest';
import { EvidenceSource, EvidenceState, SignalType } from '@age/evidence-contracts';
import type { Evidence } from '@age/evidence-contracts';
import { deduplicateEvidence } from '../../processing/deduplicate-evidence';

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

describe('deduplicateEvidence', () => {
  it('returns no duplicates when all records are structurally distinct', () => {
    const result = deduplicateEvidence([
      buildEvidence({ id: 'evidence-1' }),
      buildEvidence({ id: 'evidence-2', sourceUrl: 'https://reddit.com/r/example/post-2' }),
    ]);

    expect(result).toEqual([]);
  });

  it('flags a later record as a duplicate of the first with same sourceUrl and rawContent', () => {
    const result = deduplicateEvidence([
      buildEvidence({ id: 'evidence-1' }),
      buildEvidence({ id: 'evidence-2' }),
    ]);

    expect(result).toEqual([{ evidenceId: 'evidence-2', duplicateOfEvidenceId: 'evidence-1' }]);
  });

  it('treats rawContent whitespace differences as the same structural key', () => {
    const result = deduplicateEvidence([
      buildEvidence({ id: 'evidence-1', rawContent: 'Checkout was painfully slow today.' }),
      buildEvidence({ id: 'evidence-2', rawContent: '  Checkout was painfully slow today.  ' }),
    ]);

    expect(result).toEqual([{ evidenceId: 'evidence-2', duplicateOfEvidenceId: 'evidence-1' }]);
  });

  it('does not flag records with the same rawContent but different sourceUrl', () => {
    const result = deduplicateEvidence([
      buildEvidence({ id: 'evidence-1', sourceUrl: 'https://reddit.com/post-1' }),
      buildEvidence({ id: 'evidence-2', sourceUrl: 'https://reddit.com/post-2' }),
    ]);

    expect(result).toEqual([]);
  });

  it('chains duplicates back to the first-seen original, not to each other', () => {
    const result = deduplicateEvidence([
      buildEvidence({ id: 'evidence-1' }),
      buildEvidence({ id: 'evidence-2' }),
      buildEvidence({ id: 'evidence-3' }),
    ]);

    expect(result).toEqual([
      { evidenceId: 'evidence-2', duplicateOfEvidenceId: 'evidence-1' },
      { evidenceId: 'evidence-3', duplicateOfEvidenceId: 'evidence-1' },
    ]);
  });

  it('reports each evidenceId at most once across a larger batch', () => {
    const result = deduplicateEvidence([
      buildEvidence({ id: 'evidence-1' }),
      buildEvidence({ id: 'evidence-2' }),
      buildEvidence({ id: 'evidence-3' }),
      buildEvidence({ id: 'evidence-4', sourceUrl: 'https://reddit.com/post-2' }),
    ]);

    const evidenceIds = result.map((d) => d.evidenceId);
    expect(new Set(evidenceIds).size).toBe(evidenceIds.length);
    expect(evidenceIds).toEqual(['evidence-2', 'evidence-3']);
  });
});
