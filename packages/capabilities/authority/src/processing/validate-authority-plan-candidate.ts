import type {
  RejectedAuthorityReason,
  RejectedAuthorityReasonCode,
} from '../authority-processing-summary';
import type { AuthorityPlanCandidate } from './authority-plan-candidate';

/**
 * validateAuthorityPlanCandidate — deterministic, fixed-order, first-violated-
 * wins validation of a single derived candidate (ADR-0017). Returns the first
 * violated rule as a RejectedAuthorityReason, or null if the candidate is valid.
 * A candidate failing multiple rules is reported with exactly one reason (the
 * first in fixed order) — the exactly-once accounting the pipeline relies on.
 * Validation runs before scoring.
 */
export function validateAuthorityPlanCandidate(
  candidate: AuthorityPlanCandidate,
): RejectedAuthorityReason | null {
  const rule = FIRST_VIOLATED_RULE.find(({ isViolated }) => isViolated(candidate));

  if (!rule) {
    return null;
  }

  return {
    authorityPlanId: candidate.authorityPlanId,
    reasonCode: rule.reasonCode,
    detail: rule.detail(candidate),
  };
}

interface ValidationRule {
  readonly reasonCode: RejectedAuthorityReasonCode;
  readonly isViolated: (candidate: AuthorityPlanCandidate) => boolean;
  readonly detail: (candidate: AuthorityPlanCandidate) => string;
}

function isInvalidScore(value: number): boolean {
  return typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100;
}

const FIRST_VIOLATED_RULE: readonly ValidationRule[] = [
  {
    reasonCode: 'MISSING_ID',
    isViolated: (c) =>
      typeof c.authorityPlanId !== 'string' || c.authorityPlanId.trim().length === 0,
    detail: () => 'Authority plan candidate has no id.',
  },
  {
    reasonCode: 'EMPTY_PLAN_TARGET',
    isViolated: (c) => typeof c.target.key !== 'string' || c.target.key.trim().length === 0,
    detail: (c) => `Authority plan "${c.authorityPlanId}" has an empty target key.`,
  },
  {
    reasonCode: 'NO_EXECUTION_DOMAIN',
    isViolated: (c) => c.executionDomains.length === 0,
    detail: (c) => `Authority plan "${c.authorityPlanId}" has no execution domains.`,
  },
  {
    reasonCode: 'NO_SOURCE_REF',
    isViolated: (c) => c.sourceRefs.length === 0,
    detail: (c) => `Authority plan "${c.authorityPlanId}" has no source references.`,
  },
  {
    reasonCode: 'INVALID_IMPACT',
    isViolated: (c) => isInvalidScore(c.expectedImpact),
    detail: (c) =>
      `Authority plan "${c.authorityPlanId}" has an out-of-range expectedImpact: ${String(c.expectedImpact)}.`,
  },
  {
    reasonCode: 'INVALID_EFFORT',
    isViolated: (c) => isInvalidScore(c.estimatedEffort),
    detail: (c) =>
      `Authority plan "${c.authorityPlanId}" has an out-of-range estimatedEffort: ${String(c.estimatedEffort)}.`,
  },
  {
    reasonCode: 'INVALID_CONFIDENCE',
    isViolated: (c) => isInvalidScore(c.confidence),
    detail: (c) =>
      `Authority plan "${c.authorityPlanId}" has an out-of-range confidence: ${String(c.confidence)}.`,
  },
];
