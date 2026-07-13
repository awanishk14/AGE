import { ExecutionDomain } from '@age/capability-kit';
import type { GrowthInput, GrowthPlanningInputItem } from '@age/growth-contracts';

/** Valid growth planning item — expected ACCEPTED. */
const validItem: GrowthPlanningInputItem = {
  id: 'gp-001',
  planType: 'PAID_ACQUISITION',
  opportunity: {
    opportunityId: 'opp-001',
    opportunityType: 'DEMAND_CAPTURE',
    target: { kind: 'OPPORTUNITY', key: 'opp:smb-saas' },
    executionDomains: [ExecutionDomain.GoogleAds],
    impactScore: 70,
    confidenceScore: 65,
  },
  executionDomains: [ExecutionDomain.GoogleAds],
  expectedImpact: 80,
  confidence: 70,
  estimatedEffort: 40,
};

/** Invalid — no execution domains. Expected REJECTED (NO_EXECUTION_DOMAIN). */
const invalidItem: GrowthPlanningInputItem = {
  ...validItem,
  id: 'gp-002',
  executionDomains: [],
};

/** Structural duplicate of the valid item (same planType + target + domains). Expected DUPLICATE. */
const duplicateItem: GrowthPlanningInputItem = {
  ...validItem,
  id: 'gp-003',
};

export const growthInput: GrowthInput = {
  clientId: 'client-demo-001',
  organizationId: 'org-demo-001',
  planningItems: [validItem, invalidItem, duplicateItem],
  generatedAt: '2026-07-12T00:00:00.000Z',
};
