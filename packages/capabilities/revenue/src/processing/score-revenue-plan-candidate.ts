import type { RevenuePlanItem } from '../revenue-plan-item';
import type { RevenuePlanCandidate } from './revenue-plan-candidate';

/**
 * RevenuePlanScore — the deterministic scoring outputs for a candidate. A
 * structural subset of the public RevenuePlanItem score fields.
 */
export type RevenuePlanScore = Pick<
  RevenuePlanItem,
  'revenueImpactScore' | 'valueBand' | 'effortScore' | 'effortBand' | 'confidenceScore' | 'priority'
>;

const HIGH_VALUE_THRESHOLD = 67;
const MEDIUM_VALUE_THRESHOLD = 34;
const HIGH_EFFORT_THRESHOLD = 67;
const MEDIUM_EFFORT_THRESHOLD = 34;
const HIGH_PRIORITY_THRESHOLD = 70;
const MEDIUM_PRIORITY_THRESHOLD = 40;

/**
 * scoreRevenuePlanCandidate — deterministic revenue priority scoring (ADR-0019,
 * Revenue-specific model). Uses only the explicit candidate inputs
 * expectedValue, conversionProbability, retentionRisk, estimatedEffort, and
 * confidence. `monetaryAmount` / `currency` are NEVER used. No channel weighting,
 * no source-reliability weighting, no recency term, no clock reads, no semantic
 * matching.
 *
 *   valueScore       = clamp(expectedValue)
 *   conversionScore  = clamp(conversionProbability)
 *   riskScore        = clamp(retentionRisk)
 *   effortScore      = clamp(estimatedEffort)
 *   confidenceScore  = clamp(confidence)
 *   valueRiskBlend   = round(0.7*valueScore + 0.3*riskScore)
 *   pwRevenueScore   = round(valueRiskBlend * conversionScore / 100)
 *   revenueImpact    = round(pwRevenueScore * (0.7 + 0.3*confidenceScore/100))
 *   priorityScore    = round(0.7*revenueImpact + 0.3*(100 - effortScore))
 *   valueBand        = HIGH if revenueImpact >= 67, MEDIUM if >= 34, else LOW
 *   effortBand       = HIGH if effortScore >= 67, MEDIUM if >= 34, else LOW
 *   priority         = HIGH if priorityScore >= 70, MEDIUM if >= 40, else LOW
 *
 * All numeric outputs are clamped to [0, 100]; non-finite inputs clamp to 0.
 * Because revenueImpact is proportional to conversionScore, a conversion of 0
 * forces revenueImpact to 0 regardless of confidence — confidence can dampen or
 * support probability-weighted impact but can never manufacture it.
 */
export function scoreRevenuePlanCandidate(candidate: RevenuePlanCandidate): RevenuePlanScore {
  const valueScore = clamp(candidate.expectedValue);
  const conversionScore = clamp(candidate.conversionProbability);
  const riskScore = clamp(candidate.retentionRisk);
  const effortScore = clamp(candidate.estimatedEffort);
  const confidenceScore = clamp(candidate.confidence);

  const valueRiskBlend = clamp(Math.round(0.7 * valueScore + 0.3 * riskScore));
  const probabilityWeightedRevenueScore = clamp(
    Math.round((valueRiskBlend * conversionScore) / 100),
  );
  const revenueImpactScore = clamp(
    Math.round(probabilityWeightedRevenueScore * (0.7 + (0.3 * confidenceScore) / 100)),
  );
  const priorityScore = clamp(Math.round(0.7 * revenueImpactScore + 0.3 * (100 - effortScore)));

  return {
    revenueImpactScore,
    valueBand: toValueBand(revenueImpactScore),
    effortScore,
    effortBand: toEffortBand(effortScore),
    confidenceScore,
    priority: toPriority(priorityScore),
  };
}

function toValueBand(revenueImpactScore: number): RevenuePlanScore['valueBand'] {
  if (revenueImpactScore >= HIGH_VALUE_THRESHOLD) {
    return 'HIGH';
  }
  if (revenueImpactScore >= MEDIUM_VALUE_THRESHOLD) {
    return 'MEDIUM';
  }
  return 'LOW';
}

function toEffortBand(effortScore: number): RevenuePlanScore['effortBand'] {
  if (effortScore >= HIGH_EFFORT_THRESHOLD) {
    return 'HIGH';
  }
  if (effortScore >= MEDIUM_EFFORT_THRESHOLD) {
    return 'MEDIUM';
  }
  return 'LOW';
}

function toPriority(priorityScore: number): RevenuePlanScore['priority'] {
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
