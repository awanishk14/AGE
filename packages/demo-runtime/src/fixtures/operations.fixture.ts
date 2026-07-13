import { ExecutionDomain } from '@age/capability-kit';
import type { OperationsInput, OperationsPlanningInputItem } from '@age/operations-contracts';

/** Valid operations planning item — expected ACCEPTED. */
const validItem: OperationsPlanningInputItem = {
  id: 'op-001',
  planType: 'PROJECT_PLAN',
  reference: {
    referenceId: 'ref-001',
    referenceType: 'AUTHORITY_PLAN',
    target: { kind: 'PROJECT', key: 'project:acme-redesign' },
    executionDomains: [ExecutionDomain.Reporting],
    urgencyScore: 70,
    deliveryRiskScore: 55,
    confidenceScore: 65,
  },
  executionDomains: [ExecutionDomain.Reporting],
  operationalUrgency: 80,
  deliveryRisk: 50,
  estimatedEffort: 40,
  confidence: 70,
};

/** Invalid — no execution domains. Expected REJECTED (NO_EXECUTION_DOMAIN). */
const invalidItem: OperationsPlanningInputItem = {
  ...validItem,
  id: 'op-002',
  executionDomains: [],
};

/** Structural duplicate of the valid item (same planType + target + domains). Expected DUPLICATE. */
const duplicateItem: OperationsPlanningInputItem = {
  ...validItem,
  id: 'op-003',
};

export const operationsInput: OperationsInput = {
  clientId: 'client-demo-001',
  organizationId: 'org-demo-001',
  planningItems: [validItem, invalidItem, duplicateItem],
  generatedAt: '2026-07-12T00:00:00.000Z',
};
