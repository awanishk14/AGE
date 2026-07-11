import type {
  RejectedRevenueReason,
  RejectedRevenueReasonCode,
} from '../revenue-processing-summary';
import type { RevenuePlanCandidate } from './revenue-plan-candidate';

/**
 * validateRevenuePlanCandidate — deterministic, fixed-order, first-violated-wins
 * validation of a single derived candidate (ADR-0019). Returns the first
 * violated rule as a RejectedRevenueReason, or null if the candidate is valid. A
 * candidate failing multiple rules is reported with exactly one reason (the
 * first in fixed order) — the exactly-once accounting the pipeline relies on.
 * Validation runs before scoring.
 *
 * `monetaryAmount` / `currency` are metadata, NOT scoring inputs, and are never
 * validated here.
 *
 * Fixed order: MISSING_ID → EMPTY_PLAN_TARGET → NO_EXECUTION_DOMAIN →
 * NO_SOURCE_REF → INVALID_EXPECTED_VALUE → INVALID_CONVERSION_PROBABILITY →
 * INVALID_RETENTION_RISK → INVALID_EFFORT → INVALID_CONFIDENCE.
 */
export function validateRevenuePlanCandidate(
  candidate: RevenuePlanCandidate,
): RejectedRevenueReason | null {
  const rule = FIRST_VIOLATED_RULE.find(({ isViolated }) => isViolated(candidate));

  if (!rule) {
    return null;
  }

  return {
    revenuePlanId: candidate.revenuePlanId,
    reasonCode: rule.reasonCode,
    detail: rule.detail(candidate),
  };
}

interface ValidationRule {
  readonly reasonCode: RejectedRevenueReasonCode;
  readonly isViolated: (candidate: RevenuePlanCandidate) => boolean;
  readonly detail: (candidate: RevenuePlanCandidate) => string;
}

function isInvalidScore(value: number): boolean {
  return typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100;
}

const FIRST_VIOLATED_RULE: readonly ValidationRule[] = [
  {
    reasonCode: 'MISSING_ID',
    isViolated: (c) => typeof c.revenuePlanId !== 'string' || c.revenuePlanId.trim().length === 0,
    detail: () => 'Revenue plan candidate has no id.',
  },
  {
    reasonCode: 'EMPTY_PLAN_TARGET',
    isViolated: (c) => typeof c.target.key !== 'string' || c.target.key.trim().length === 0,
    detail: (c) => `Revenue plan "${c.revenuePlanId}" has an empty target key.`,
  },
  {
    reasonCode: 'NO_EXECUTION_DOMAIN',
    isViolated: (c) => c.executionDomains.length === 0,
    detail: (c) => `Revenue plan "${c.revenuePlanId}" has no execution domains.`,
  },
  {
    reasonCode: 'NO_SOURCE_REF',
    isViolated: (c) => c.sourceRefs.length === 0,
    detail: (c) => `Revenue plan "${c.revenuePlanId}" has no source references.`,
  },
  {
    reasonCode: 'INVALID_EXPECTED_VALUE',
    isViolated: (c) => isInvalidScore(c.expectedValue),
    detail: (c) =>
      `Revenue plan "${c.revenuePlanId}" has an out-of-range expectedValue: ${String(c.expectedValue)}.`,
  },
  {
    reasonCode: 'INVALID_CONVERSION_PROBABILITY',
    isViolated: (c) => isInvalidScore(c.conversionProbability),
    detail: (c) =>
      `Revenue plan "${c.revenuePlanId}" has an out-of-range conversionProbability: ${String(c.conversionProbability)}.`,
  },
  {
    reasonCode: 'INVALID_RETENTION_RISK',
    isViolated: (c) => isInvalidScore(c.retentionRisk),
    detail: (c) =>
      `Revenue plan "${c.revenuePlanId}" has an out-of-range retentionRisk: ${String(c.retentionRisk)}.`,
  },
  {
    reasonCode: 'INVALID_EFFORT',
    isViolated: (c) => isInvalidScore(c.estimatedEffort),
    detail: (c) =>
      `Revenue plan "${c.revenuePlanId}" has an out-of-range estimatedEffort: ${String(c.estimatedEffort)}.`,
  },
  {
    reasonCode: 'INVALID_CONFIDENCE',
    isViolated: (c) => isInvalidScore(c.confidence),
    detail: (c) =>
      `Revenue plan "${c.revenuePlanId}" has an out-of-range confidence: ${String(c.confidence)}.`,
  },
];
