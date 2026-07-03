import type { RejectedGrowthReason, RejectedGrowthReasonCode } from '../growth-processing-summary';
import type { GrowthPlanCandidate } from './growth-plan-candidate';

/**
 * validateGrowthPlan — deterministic, fixed-order, first-violated-wins
 * validation of a single derived candidate (ADR-0015). Returns the first
 * violated rule as a RejectedGrowthReason, or null if the candidate is valid. A
 * candidate failing multiple rules is reported with exactly one reason (the
 * first in fixed order) — the exactly-once accounting the pipeline relies on.
 * Validation runs before scoring.
 */
export function validateGrowthPlan(candidate: GrowthPlanCandidate): RejectedGrowthReason | null {
  const rule = FIRST_VIOLATED_RULE.find(({ isViolated }) => isViolated(candidate));

  if (!rule) {
    return null;
  }

  return {
    planId: candidate.planId,
    reasonCode: rule.reasonCode,
    detail: rule.detail(candidate),
  };
}

interface ValidationRule {
  readonly reasonCode: RejectedGrowthReasonCode;
  readonly isViolated: (candidate: GrowthPlanCandidate) => boolean;
  readonly detail: (candidate: GrowthPlanCandidate) => string;
}

function isInvalidScore(value: number): boolean {
  return typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 100;
}

const FIRST_VIOLATED_RULE: readonly ValidationRule[] = [
  {
    reasonCode: 'MISSING_ID',
    isViolated: (c) => typeof c.planId !== 'string' || c.planId.trim().length === 0,
    detail: () => 'Growth plan candidate has no id.',
  },
  {
    reasonCode: 'EMPTY_PLAN_TARGET',
    isViolated: (c) => typeof c.target.key !== 'string' || c.target.key.trim().length === 0,
    detail: (c) => `Growth plan "${c.planId}" has an empty target key.`,
  },
  {
    reasonCode: 'NO_EXECUTION_DOMAIN',
    isViolated: (c) => c.executionDomains.length === 0,
    detail: (c) => `Growth plan "${c.planId}" has no execution domains.`,
  },
  {
    reasonCode: 'NO_SOURCE_REF',
    isViolated: (c) => c.sourceRefs.length === 0,
    detail: (c) => `Growth plan "${c.planId}" has no source references.`,
  },
  {
    reasonCode: 'INVALID_IMPACT',
    isViolated: (c) => isInvalidScore(c.expectedImpact),
    detail: (c) =>
      `Growth plan "${c.planId}" has an out-of-range expectedImpact: ${String(c.expectedImpact)}.`,
  },
  {
    reasonCode: 'INVALID_EFFORT',
    isViolated: (c) => isInvalidScore(c.estimatedEffort),
    detail: (c) =>
      `Growth plan "${c.planId}" has an out-of-range estimatedEffort: ${String(c.estimatedEffort)}.`,
  },
  {
    reasonCode: 'INVALID_CONFIDENCE',
    isViolated: (c) => isInvalidScore(c.confidence),
    detail: (c) =>
      `Growth plan "${c.planId}" has an out-of-range confidence: ${String(c.confidence)}.`,
  },
];
