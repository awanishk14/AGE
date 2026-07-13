import { ExecutionDomain } from '@age/capability-kit';
import type { MarketDiscoveryInput, MarketSignal } from '@age/market-discovery-contracts';

/** Valid signal — expected ACCEPTED. */
const validSignal: MarketSignal = {
  id: 'sig-001',
  type: 'UNMET_DEMAND',
  target: { kind: 'SEGMENT', key: 'segment:smb-saas' },
  executionDomains: [ExecutionDomain.SEO],
  strength: 72,
  confidence: 66,
  demandVolume: 820,
  observedAt: '2026-07-01T00:00:00.000Z',
};

/** Invalid — no execution domains. Expected REJECTED (NO_EXECUTION_DOMAIN). */
const invalidSignal: MarketSignal = {
  ...validSignal,
  id: 'sig-002',
  executionDomains: [],
};

/** Structural duplicate of the valid signal (same type + target + domains). Expected DUPLICATE. */
const duplicateSignal: MarketSignal = {
  ...validSignal,
  id: 'sig-003',
};

export const marketDiscoveryInput: MarketDiscoveryInput = {
  clientId: 'client-demo-001',
  organizationId: 'org-demo-001',
  signals: [validSignal, invalidSignal, duplicateSignal],
  generatedAt: '2026-07-12T00:00:00.000Z',
};
