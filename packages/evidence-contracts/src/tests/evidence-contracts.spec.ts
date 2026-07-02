import { describe, expect, it } from 'vitest';
import {
  EvidenceSource,
  SignalType,
  EvidenceState,
  Polarity,
  type Evidence,
  type EvidenceEntityLink,
  type EvidencePackage,
  type ExtractedSignal,
  type Metadata,
} from '../index';

function buildExtractedSignal(overrides: Partial<ExtractedSignal> = {}): ExtractedSignal {
  return {
    type: 'PAIN_POINT',
    value: 'checkout is slow',
    targetField: 'product.performance',
    strength: 80,
    polarity: Polarity.NEGATIVE,
    ...overrides,
  };
}

function buildEvidence(overrides: Partial<Evidence> = {}): Evidence {
  const entityLinked: EvidenceEntityLink = { organizationId: 'org-1' };
  const metadata: Metadata = { collector: 'test' };

  return {
    id: 'evidence-1',
    source: EvidenceSource.REDDIT,
    sourceUrl: 'https://reddit.com/r/example/post-1',
    timestamp: '2026-07-01T00:00:00.000Z',
    entityLinked,
    signalType: SignalType.PAIN_POINT,
    rawContent: 'Checkout was painfully slow today.',
    extractedSignals: [buildExtractedSignal()],
    confidence: 72,
    state: EvidenceState.NEW,
    metadata,
    ...overrides,
  };
}

describe('@age/evidence-contracts', () => {
  it('exposes the full EvidenceSource enum', () => {
    expect(Object.values(EvidenceSource)).toEqual([
      'REDDIT',
      'G2',
      'CAPTERRA',
      'TRUSTPILOT',
      'YOUTUBE',
      'GOOGLE_SEARCH',
      'COMPETITOR_SITE',
      'ADS',
      'SOCIAL',
      'JOB_POSTING',
      'GITHUB',
      'FORUM',
    ]);
  });

  it('exposes the full SignalType enum', () => {
    expect(Object.values(SignalType)).toEqual([
      'PAIN_POINT',
      'FEATURE_REQUEST',
      'INTENT',
      'COMPLAINT',
      'PRAISE',
      'PRICING_SIGNAL',
      'COMPETITOR_MENTION',
      'MARKET_TREND',
      'BUYING_SIGNAL',
      'TECH_STACK_SIGNAL',
    ]);
  });

  it('exposes the full EvidenceState enum with terminal off-ramps', () => {
    expect(Object.values(EvidenceState)).toEqual([
      'NEW',
      'PROCESSED',
      'MAPPED',
      'APPLIED_TO_BIF',
      'REJECTED',
      'CONFLICTED',
    ]);
  });

  it('exposes the full Polarity enum', () => {
    expect(Object.values(Polarity)).toEqual(['POSITIVE', 'NEGATIVE', 'NEUTRAL']);
  });

  it('allows constructing a well-formed Evidence record', () => {
    const evidence = buildEvidence();

    expect(evidence.id).toBe('evidence-1');
    expect(evidence.source).toBe(EvidenceSource.REDDIT);
    expect(evidence.state).toBe(EvidenceState.NEW);
    expect(evidence.extractedSignals).toHaveLength(1);
    expect(evidence.extractedSignals[0]?.polarity).toBe(Polarity.NEGATIVE);
  });

  it('allows constructing a well-formed EvidencePackage batching multiple Evidence records', () => {
    const evidencePackage: EvidencePackage = {
      clientId: 'client-1',
      organizationId: 'org-1',
      evidence: [
        buildEvidence({ id: 'evidence-1' }),
        buildEvidence({ id: 'evidence-2', source: EvidenceSource.G2 }),
      ],
      generatedAt: '2026-07-01T00:00:00.000Z',
    };

    expect(evidencePackage.evidence).toHaveLength(2);
    expect(evidencePackage.evidence.map((e) => e.id)).toEqual(['evidence-1', 'evidence-2']);
  });

  it('supports an EvidenceEntityLink with all fields optional', () => {
    const empty: EvidenceEntityLink = {};
    const full: EvidenceEntityLink = {
      organizationId: 'org-1',
      productId: 'product-1',
      competitorId: 'competitor-1',
      marketId: 'market-1',
    };

    expect(empty).toEqual({});
    expect(full.competitorId).toBe('competitor-1');
  });
});
