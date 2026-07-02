import { describe, expect, it } from 'vitest';
import { Capability, ClientContext } from '@age/capability-kit';
import { EvidenceSource, EvidenceState, SignalType, Polarity } from '@age/evidence-contracts';
import type { Evidence, EvidencePackage } from '@age/evidence-contracts';
import { processEvidencePackage } from '../../processing/process-evidence-package';

const RUN_AT = '2026-07-10T00:00:00.000Z';

function buildEvidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: 'evidence-valid',
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

function buildPackage(evidence: readonly Evidence[]): EvidencePackage {
  return {
    clientId: 'client-1',
    organizationId: 'org-1',
    evidence,
    generatedAt: RUN_AT,
  };
}

const context = new ClientContext('client-1', 'org-1');

describe('processEvidencePackage', () => {
  it('returns empty output and a zeroed summary for empty input', () => {
    const result = processEvidencePackage(context, buildPackage([]));

    expect(result.output.items).toEqual([]);
    expect(result.summary).toEqual({
      acceptedCount: 0,
      rejectedCount: 0,
      duplicateCount: 0,
      contradictionCount: 0,
      rejectedReasons: [],
      duplicateReferences: [],
    });
  });

  it('produces one output item per accepted, non-duplicate record with correct mapping', () => {
    const result = processEvidencePackage(context, buildPackage([buildEvidence({ id: 'e1' })]));

    expect(result.output.items).toHaveLength(1);
    const [item] = result.output.items;
    expect(item?.evidenceId).toBe('e1');
    expect(item?.capability).toBe(Capability.Intelligence);
    expect(item?.qualityScore).toBeGreaterThanOrEqual(0);
    expect(item?.qualityScore).toBeLessThanOrEqual(100);
    expect(item?.isContradiction).toBe(false);
    expect(item?.freshnessDays).toBe(9);
    expect(item?.createdAt).toEqual(new Date(RUN_AT));
  });

  describe('with mixed valid / invalid / duplicate / contradictory input', () => {
    const valid = buildEvidence({ id: 'valid-1' });
    const invalid = buildEvidence({ id: 'invalid-1', sourceUrl: '' });
    const duplicateOfValid = buildEvidence({ id: 'dup-1' }); // same sourceUrl + rawContent as valid-1
    const contradictionA = buildEvidence({
      id: 'contra-A',
      sourceUrl: 'https://reddit.com/r/example/post-praise',
      rawContent: 'Checkout felt lightning fast.',
      signalType: SignalType.PRAISE,
      entityLinked: { productId: 'product-9' },
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
    const contradictionB = buildEvidence({
      id: 'contra-B',
      sourceUrl: 'https://reddit.com/r/example/post-pain',
      rawContent: 'Checkout was unbearably slow.',
      signalType: SignalType.PRAISE,
      entityLinked: { productId: 'product-9' },
      extractedSignals: [
        {
          type: 'PRAISE',
          value: 'slow checkout',
          targetField: 'product.performance',
          strength: 65,
          polarity: Polarity.NEGATIVE,
        },
      ],
    });

    const evidencePackage = buildPackage([
      valid,
      invalid,
      duplicateOfValid,
      contradictionA,
      contradictionB,
    ]);
    const result = processEvidencePackage(context, evidencePackage);
    const outputIds = result.output.items.map((item) => item.evidenceId);

    it('excludes rejected records from output.items', () => {
      expect(outputIds).not.toContain('invalid-1');
    });

    it('excludes duplicate records from output.items', () => {
      expect(outputIds).not.toContain('dup-1');
    });

    it('records the rejection reason exactly once with a constrained code', () => {
      expect(result.summary.rejectedReasons).toEqual([
        {
          evidenceId: 'invalid-1',
          reasonCode: 'EMPTY_SOURCE_URL',
          detail: expect.any(String),
        },
      ]);
    });

    it('records the duplicate reference exactly once, pointing at the first-seen original', () => {
      expect(result.summary.duplicateReferences).toEqual([
        { evidenceId: 'dup-1', duplicateOfEvidenceId: 'valid-1' },
      ]);
    });

    it('keeps contradiction-flagged records in output with isContradiction: true', () => {
      const contraA = result.output.items.find((item) => item.evidenceId === 'contra-A');
      const contraB = result.output.items.find((item) => item.evidenceId === 'contra-B');
      expect(contraA?.isContradiction).toBe(true);
      expect(contraB?.isContradiction).toBe(true);
    });

    it('does not flag non-contradictory accepted records', () => {
      const validItem = result.output.items.find((item) => item.evidenceId === 'valid-1');
      expect(validItem?.isContradiction).toBe(false);
    });

    it('satisfies the ADR-0011 accounting invariants', () => {
      const { acceptedCount, rejectedCount, duplicateCount, contradictionCount } = result.summary;

      expect(acceptedCount + rejectedCount + duplicateCount).toBe(evidencePackage.evidence.length);
      expect(result.summary.rejectedReasons).toHaveLength(rejectedCount);
      expect(result.summary.duplicateReferences).toHaveLength(duplicateCount);
      expect(result.output.items).toHaveLength(acceptedCount);
      expect(contradictionCount).toBe(2);
    });

    it('never lets a rejected or duplicate id appear in output.items', () => {
      const rejectedIds = result.summary.rejectedReasons.map((r) => r.evidenceId);
      const duplicateIds = result.summary.duplicateReferences.map((d) => d.evidenceId);
      for (const id of [...rejectedIds, ...duplicateIds]) {
        expect(outputIds).not.toContain(id);
      }
    });

    it('lists each rejected and duplicate id exactly once', () => {
      const rejectedIds = result.summary.rejectedReasons.map((r) => r.evidenceId);
      const duplicateIds = result.summary.duplicateReferences.map((d) => d.evidenceId);
      expect(new Set(rejectedIds).size).toBe(rejectedIds.length);
      expect(new Set(duplicateIds).size).toBe(duplicateIds.length);
    });
  });

  it('computes freshness deterministically from the package generatedAt timestamp', () => {
    const evidence = buildEvidence({ id: 'e1', timestamp: '2026-07-01T00:00:00.000Z' });
    const first = processEvidencePackage(context, buildPackage([evidence]));
    const second = processEvidencePackage(context, buildPackage([evidence]));

    expect(first.output.items[0]?.freshnessDays).toBe(9);
    expect(first.output.items[0]?.freshnessDays).toBe(second.output.items[0]?.freshnessDays);
  });

  it('propagates client and organization scope to the CapabilityOutput', () => {
    const result = processEvidencePackage(context, buildPackage([buildEvidence({ id: 'e1' })]));
    expect(result.output.clientId).toBe('client-1');
    expect(result.output.organizationId).toBe('org-1');
    expect(result.output.capability).toBe(Capability.Intelligence);
  });
});
