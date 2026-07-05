import type { AuthorityEffortBand, AuthorityPlanPriority } from '@age/authority-contracts';
import type { AuthorityPlanCandidate } from './authority-plan-candidate';

/**
 * AuthorityPlanScore — the deterministic scoring outputs for a candidate.
 */
export interface AuthorityPlanScore {
  readonly impactScore: number;
  readonly effortScore: number;
  readonly effortBand: AuthorityEffortBand;
  readonly confidenceScore: number;
  readonly priority: AuthorityPlanPriority;
}

const HIGH_EFFORT_THRESHOLD = 67;
const MEDIUM_EFFORT_THRESHOLD = 34;
const HIGH_PRIORITY_THRESHOLD = 70;
const MEDIUM_PRIORITY_THRESHOLD = 40;

/**
 * scoreAuthorityPlanCandidate — deterministic quality/priority scoring
 * (ADR-0017). Uses only the explicit candidate inputs expectedImpact,
 * confidence, and estimatedEffort. No channel weighting, no source-reliability
 * weighting, no recency term, no clock reads. Identical formula to Growth.
 *
 *   impactScore     = round(0.60*expectedImpact + 0.40*confidence)
 *   effortScore     = clamp(estimatedEffort, 0, 100)
 *   confidenceScore = clamp(confidence, 0, 100)
 *   effortBand      = HIGH if effortScore >= 67, MEDIUM if >= 34, else LOW
 *   priorityScore   = round(0.70*impactScore + 0.30*(100 - effortScore))
 *   priority        = HIGH if priorityScore >= 70, MEDIUM if >= 40, else LOW
 *
 * All numeric outputs are clamped to [0, 100]. Higher effort lowers priority.
 */
export function scoreAuthorityPlanCandidate(candidate: AuthorityPlanCandidate): AuthorityPlanScore {
  const expectedImpact = clamp(candidate.expectedImpact);
  const confidenceScore = clamp(candidate.confidence);
  const effortScore = clamp(candidate.estimatedEffort);

  const impactScore = clamp(Math.round(0.6 * expectedImpact + 0.4 * confidenceScore));
  const priorityScore = clamp(Math.round(0.7 * impactScore + 0.3 * (100 - effortScore)));

  return {
    impactScore,
    effortScore,
    effortBand: toEffortBand(effortScore),
    confidenceScore,
    priority: toPriority(priorityScore),
  };
}

function toEffortBand(effortScore: number): AuthorityEffortBand {
  if (effortScore >= HIGH_EFFORT_THRESHOLD) {
    return 'HIGH';
  }
  if (effortScore >= MEDIUM_EFFORT_THRESHOLD) {
    return 'MEDIUM';
  }
  return 'LOW';
}

function toPriority(priorityScore: number): AuthorityPlanPriority {
  if (priorityScore >= HIGH_PRIORITY_THRESHOLD) {
    return 'HIGH';
  }
  if (priorityScore >= MEDIUM_PRIORITY_THRESHOLD) {
    return 'MEDIUM';
  }
  return 'LOW';
}

function clamp(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
}
