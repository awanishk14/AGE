import { describe, expect, it } from 'vitest';
import * as evidenceContracts from '@age/evidence-contracts';
import { EvidenceSource, SignalType, EvidenceState, Polarity } from '../types/enums';
import type { Metadata } from '../types/common';
import type { ExtractedSignal } from '../signals/extracted-signal';
import type { Evidence, EvidenceEntityLink } from '../evidence/evidence';
import { EVIDENCE_LIFECYCLE, EVIDENCE_TERMINAL_STATES } from '../evidence/lifecycle';
import { evidenceSchema } from '../validators/evidence.schema';

/**
 * T9 migration proof: RIE's evidence types/enums are now re-exports of
 * @age/evidence-contracts (ADR-0010), not local declarations. These tests
 * assert the migration is behavior-preserving — same runtime values, same
 * shapes, same schema validation — from RIE's own module paths.
 */
describe('RIE evidence contract migration (ADR-0010)', () => {
  it('re-exports the exact same enum objects as @age/evidence-contracts', () => {
    expect(EvidenceSource).toBe(evidenceContracts.EvidenceSource);
    expect(SignalType).toBe(evidenceContracts.SignalType);
    expect(EvidenceState).toBe(evidenceContracts.EvidenceState);
    expect(Polarity).toBe(evidenceContracts.Polarity);
  });

  it('preserves the evidence lifecycle definitions built on the re-exported EvidenceState', () => {
    expect(EVIDENCE_LIFECYCLE).toEqual([
      EvidenceState.NEW,
      EvidenceState.PROCESSED,
      EvidenceState.MAPPED,
      EvidenceState.APPLIED_TO_BIF,
    ]);
    expect(EVIDENCE_TERMINAL_STATES).toEqual([EvidenceState.REJECTED, EvidenceState.CONFLICTED]);
  });

  it('validates a well-formed Evidence record against the unchanged zod schema', () => {
    const extractedSignal: ExtractedSignal = {
      type: 'PAIN_POINT',
      value: 'checkout is slow',
      targetField: 'product.performance',
      strength: 80,
      polarity: Polarity.NEGATIVE,
    };

    const entityLinked: EvidenceEntityLink = { organizationId: 'org-1' };
    const metadata: Metadata = { collector: 'test' };

    const evidence: Evidence = {
      id: 'evidence-1',
      source: EvidenceSource.REDDIT,
      sourceUrl: 'https://reddit.com/r/example/post-1',
      timestamp: '2026-07-01T00:00:00.000Z',
      entityLinked,
      signalType: SignalType.PAIN_POINT,
      rawContent: 'Checkout was painfully slow today.',
      extractedSignals: [extractedSignal],
      confidence: 72,
      state: EvidenceState.NEW,
      metadata,
    };

    expect(() => evidenceSchema.parse(evidence)).not.toThrow();
  });
});
