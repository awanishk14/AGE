import type {
  RejectedOpportunityReason,
  RejectedOpportunityReasonCode,
} from '../opportunity-processing-summary';
import type { MarketOpportunityCandidate } from './market-opportunity-candidate';

/**
 * validateOpportunity — deterministic, fixed-order, first-violated-wins
 * validation of a single derived candidate (ADR-0013). Returns the first
 * violated rule as a RejectedOpportunityReason, or null if the candidate is
 * valid. A candidate failing multiple rules is reported with exactly one
 * reason (the first in fixed order) — the exactly-once accounting the pipeline
 * relies on. Validation runs before scoring.
 */
export function validateOpportunity(
  candidate: MarketOpportunityCandidate,
): RejectedOpportunityReason | null {
  const rule = FIRST_VIOLATED_RULE.find(({ isViolated }) => isViolated(candidate));

  if (!rule) {
    return null;
  }

  return {
    opportunityId: candidate.opportunityId,
    reasonCode: rule.reasonCode,
    detail: rule.detail(candidate),
  };
}

interface ValidationRule {
  readonly reasonCode: RejectedOpportunityReasonCode;
  readonly isViolated: (candidate: MarketOpportunityCandidate) => boolean;
  readonly detail: (candidate: MarketOpportunityCandidate) => string;
}

function isInvalidScore(value: number): boolean {
  return typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 100;
}

const FIRST_VIOLATED_RULE: readonly ValidationRule[] = [
  {
    reasonCode: 'MISSING_ID',
    isViolated: (c) => typeof c.opportunityId !== 'string' || c.opportunityId.trim().length === 0,
    detail: () => 'Opportunity candidate has no id.',
  },
  {
    reasonCode: 'EMPTY_TARGET_KEY',
    isViolated: (c) => typeof c.target.key !== 'string' || c.target.key.trim().length === 0,
    detail: (c) => `Opportunity "${c.opportunityId}" has an empty target key.`,
  },
  {
    reasonCode: 'NO_EXECUTION_DOMAIN',
    isViolated: (c) => c.executionDomains.length === 0,
    detail: (c) => `Opportunity "${c.opportunityId}" has no execution domains.`,
  },
  {
    reasonCode: 'NO_SOURCE_REF',
    isViolated: (c) => c.sourceRefs.length === 0,
    detail: (c) => `Opportunity "${c.opportunityId}" has no source references.`,
  },
  {
    reasonCode: 'INVALID_STRENGTH',
    isViolated: (c) => isInvalidScore(c.strength),
    detail: (c) =>
      `Opportunity "${c.opportunityId}" has an out-of-range strength: ${String(c.strength)}.`,
  },
  {
    reasonCode: 'INVALID_CONFIDENCE',
    isViolated: (c) => isInvalidScore(c.confidence),
    detail: (c) =>
      `Opportunity "${c.opportunityId}" has an out-of-range confidence: ${String(c.confidence)}.`,
  },
  {
    reasonCode: 'INVALID_DEMAND_VOLUME',
    isViolated: (c) =>
      typeof c.demandVolume !== 'number' || Number.isNaN(c.demandVolume) || c.demandVolume < 0,
    detail: (c) =>
      `Opportunity "${c.opportunityId}" has an invalid demandVolume: ${String(c.demandVolume)}.`,
  },
];
