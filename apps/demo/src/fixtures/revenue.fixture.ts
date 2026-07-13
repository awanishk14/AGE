import { ExecutionDomain } from '@age/capability-kit';
import type { RevenueInput, RevenuePlanningInputItem } from '@age/revenue-contracts';

/** Valid revenue planning item — expected ACCEPTED. Carries advisory + metadata fields. */
const validItem: RevenuePlanningInputItem = {
  id: 'rp-001',
  planType: 'UPSELL',
  reference: {
    referenceId: 'ops-001',
    referenceType: 'OPERATIONS_PLAN',
    target: { kind: 'ACCOUNT', key: 'account:acme' },
    executionDomains: [ExecutionDomain.CRM],
    expectedValueScore: 70,
    conversionProbabilityScore: 55,
    retentionRiskScore: 40,
    confidenceScore: 65,
  },
  executionDomains: [ExecutionDomain.CRM],
  expectedValue: 80,
  conversionProbability: 50,
  retentionRisk: 40,
  estimatedEffort: 40,
  confidence: 70,
  recommendsProposalDraft: true,
  monetaryAmount: 12000,
  currency: 'USD',
};

/** Invalid — no execution domains. Expected REJECTED (NO_EXECUTION_DOMAIN). */
const invalidItem: RevenuePlanningInputItem = {
  ...validItem,
  id: 'rp-002',
  executionDomains: [],
};

/** Structural duplicate of the valid item (same planType + target + domains). Expected DUPLICATE. */
const duplicateItem: RevenuePlanningInputItem = {
  ...validItem,
  id: 'rp-003',
};

export const revenueInput: RevenueInput = {
  clientId: 'client-demo-001',
  organizationId: 'org-demo-001',
  planningItems: [validItem, invalidItem, duplicateItem],
  generatedAt: '2026-07-12T00:00:00.000Z',
};
