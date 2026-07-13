import { ExecutionDomain } from '@age/capability-kit';
import type { AuthorityInput, AuthorityPlanningInputItem } from '@age/authority-contracts';

/** Valid authority planning item — expected ACCEPTED. */
const validItem: AuthorityPlanningInputItem = {
  id: 'ap-001',
  planType: 'THOUGHT_LEADERSHIP',
  reference: {
    referenceId: 'ref-001',
    referenceType: 'OPPORTUNITY',
    target: { kind: 'TOPIC', key: 'topic:api-security' },
    executionDomains: [ExecutionDomain.Content],
    impactScore: 70,
    confidenceScore: 65,
  },
  executionDomains: [ExecutionDomain.Content],
  expectedImpact: 80,
  confidence: 70,
  estimatedEffort: 40,
};

/** Invalid — no execution domains. Expected REJECTED (NO_EXECUTION_DOMAIN). */
const invalidItem: AuthorityPlanningInputItem = {
  ...validItem,
  id: 'ap-002',
  executionDomains: [],
};

/** Structural duplicate of the valid item (same planType + target + domains). Expected DUPLICATE. */
const duplicateItem: AuthorityPlanningInputItem = {
  ...validItem,
  id: 'ap-003',
};

export const authorityInput: AuthorityInput = {
  clientId: 'client-demo-001',
  organizationId: 'org-demo-001',
  planningItems: [validItem, invalidItem, duplicateItem],
  generatedAt: '2026-07-12T00:00:00.000Z',
};
