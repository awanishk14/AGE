import type { GrowthEffortBand, GrowthPlanPriority } from '@age/growth-contracts';
import type { GrowthPlanCandidate } from './growth-plan-candidate';

/**
 * GrowthPlanScore — the deterministic scoring outputs for a candidate.
 */
export interface GrowthPlanScore {
  readonly impactScore: number;
  readonly effortScore: number;
  readonly effortBand: GrowthEffortBand;
  readonly confidenceScore: number;
  readonly priority: GrowthPlanPriority;
}

const HIGH_EFFORT_THRESHOLD = 67;
const MEDIUM_EFFORT_THRESHOLD = 34;
const HIGH_PRIORITY_THRESHOLD = 70;
const MEDIUM_PRIORITY_THRESHOLD = 40;

/**
 * scoreGrowthPlan — deterministic quality/priority scoring (ADR-0015). Uses only
 * the explicit candidate inputs expectedImpact, confidence, and estimatedEffort.
 * No channel weighting, no source-reliability weighting, no recency term, no
 * clock reads.
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
export function scoreGrowthPlan(candidate: GrowthPlanCandidate): GrowthPlanScore {
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

function toEffortBand(effortScore: number): GrowthEffortBand {
  if (effortScore >= HIGH_EFFORT_THRESHOLD) {
    return 'HIGH';
  }
  if (effortScore >= MEDIUM_EFFORT_THRESHOLD) {
    return 'MEDIUM';
  }
  return 'LOW';
}

function toPriority(priorityScore: number): GrowthPlanPriority {
  if (priorityScore >= HIGH_PRIORITY_THRESHOLD) {
    return 'HIGH';
  }
  if (priorityScore >= MEDIUM_PRIORITY_THRESHOLD) {
    return 'MEDIUM';
  }
  return 'LOW';
}

function clamp(value: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
}
