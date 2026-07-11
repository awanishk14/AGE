import type {
  RejectedOperationsReason,
  RejectedOperationsReasonCode,
} from '../operations-processing-summary';
import type { OperationsPlanCandidate } from './operations-plan-candidate';

/**
 * validateOperationsPlanCandidate — deterministic, fixed-order, first-violated-
 * wins validation of a single derived candidate (ADR-0018). Returns the first
 * violated rule as a RejectedOperationsReason, or null if the candidate is
 * valid. A candidate failing multiple rules is reported with exactly one reason
 * (the first in fixed order) — the exactly-once accounting the pipeline relies
 * on. Validation runs before scoring.
 *
 * Fixed order: MISSING_ID → EMPTY_PLAN_TARGET → NO_EXECUTION_DOMAIN →
 * NO_SOURCE_REF → INVALID_URGENCY → INVALID_RISK → INVALID_EFFORT →
 * INVALID_CONFIDENCE.
 */
export function validateOperationsPlanCandidate(
  candidate: OperationsPlanCandidate,
): RejectedOperationsReason | null {
  const rule = FIRST_VIOLATED_RULE.find(({ isViolated }) => isViolated(candidate));

  if (!rule) {
    return null;
  }

  return {
    operationsPlanId: candidate.operationsPlanId,
    reasonCode: rule.reasonCode,
    detail: rule.detail(candidate),
  };
}

interface ValidationRule {
  readonly reasonCode: RejectedOperationsReasonCode;
  readonly isViolated: (candidate: OperationsPlanCandidate) => boolean;
  readonly detail: (candidate: OperationsPlanCandidate) => string;
}

function isInvalidScore(value: number): boolean {
  return typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100;
}

const FIRST_VIOLATED_RULE: readonly ValidationRule[] = [
  {
    reasonCode: 'MISSING_ID',
    isViolated: (c) =>
      typeof c.operationsPlanId !== 'string' || c.operationsPlanId.trim().length === 0,
    detail: () => 'Operations plan candidate has no id.',
  },
  {
    reasonCode: 'EMPTY_PLAN_TARGET',
    isViolated: (c) => typeof c.target.key !== 'string' || c.target.key.trim().length === 0,
    detail: (c) => `Operations plan "${c.operationsPlanId}" has an empty target key.`,
  },
  {
    reasonCode: 'NO_EXECUTION_DOMAIN',
    isViolated: (c) => c.executionDomains.length === 0,
    detail: (c) => `Operations plan "${c.operationsPlanId}" has no execution domains.`,
  },
  {
    reasonCode: 'NO_SOURCE_REF',
    isViolated: (c) => c.sourceRefs.length === 0,
    detail: (c) => `Operations plan "${c.operationsPlanId}" has no source references.`,
  },
  {
    reasonCode: 'INVALID_URGENCY',
    isViolated: (c) => isInvalidScore(c.operationalUrgency),
    detail: (c) =>
      `Operations plan "${c.operationsPlanId}" has an out-of-range operationalUrgency: ${String(c.operationalUrgency)}.`,
  },
  {
    reasonCode: 'INVALID_RISK',
    isViolated: (c) => isInvalidScore(c.deliveryRisk),
    detail: (c) =>
      `Operations plan "${c.operationsPlanId}" has an out-of-range deliveryRisk: ${String(c.deliveryRisk)}.`,
  },
  {
    reasonCode: 'INVALID_EFFORT',
    isViolated: (c) => isInvalidScore(c.estimatedEffort),
    detail: (c) =>
      `Operations plan "${c.operationsPlanId}" has an out-of-range estimatedEffort: ${String(c.estimatedEffort)}.`,
  },
  {
    reasonCode: 'INVALID_CONFIDENCE',
    isViolated: (c) => isInvalidScore(c.confidence),
    detail: (c) =>
      `Operations plan "${c.operationsPlanId}" has an out-of-range confidence: ${String(c.confidence)}.`,
  },
];
