import { EvidenceSource, EvidenceState, Polarity, SignalType } from '@age/evidence-contracts';
import type { Evidence, EvidencePackage } from '@age/evidence-contracts';

/** Valid, substantive evidence record — expected ACCEPTED. */
const validEvidence: Evidence = {
  id: 'ev-001',
  source: EvidenceSource.REDDIT,
  sourceUrl: 'https://reddit.com/r/saas/comments/onboarding-pain',
  timestamp: '2026-07-01T00:00:00.000Z',
  entityLinked: { organizationId: 'org-demo-001' },
  signalType: SignalType.PAIN_POINT,
  rawContent:
    'Users repeatedly complain that onboarding takes too long and support is slow to respond.',
  extractedSignals: [
    {
      type: 'pain',
      value: 'slow onboarding',
      targetField: 'product.onboarding',
      strength: 75,
      polarity: Polarity.NEGATIVE,
    },
  ],
  confidence: 82,
  state: EvidenceState.NEW,
  metadata: {},
};

/** Invalid — empty sourceUrl. Expected REJECTED (EMPTY_SOURCE_URL). */
const invalidEvidence: Evidence = {
  ...validEvidence,
  id: 'ev-002',
  sourceUrl: '',
};

/** Structural duplicate of the valid record (same sourceUrl + rawContent). Expected DUPLICATE. */
const duplicateEvidence: Evidence = {
  ...validEvidence,
  id: 'ev-003',
};

export const intelligenceInput: EvidencePackage = {
  clientId: 'client-demo-001',
  organizationId: 'org-demo-001',
  evidence: [validEvidence, invalidEvidence, duplicateEvidence],
  generatedAt: '2026-07-12T00:00:00.000Z',
};
