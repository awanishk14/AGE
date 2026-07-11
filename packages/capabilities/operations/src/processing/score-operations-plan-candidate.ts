import type { OperationsPlanItem } from '../operations-plan-item';
import type { OperationsPlanCandidate } from './operations-plan-candidate';

/**
 * OperationsPlanScore — the deterministic scoring outputs for a candidate. A
 * structural subset of the public OperationsPlanItem score fields.
 */
export type OperationsPlanScore = Pick<
  OperationsPlanItem,
  'operationalImpactScore' | 'effortScore' | 'effortBand' | 'confidenceScore' | 'priority'
>;

const HIGH_EFFORT_THRESHOLD = 67;
const MEDIUM_EFFORT_THRESHOLD = 34;
const HIGH_PRIORITY_THRESHOLD = 70;
const MEDIUM_PRIORITY_THRESHOLD = 40;

/**
 * scoreOperationsPlanCandidate — deterministic operational priority scoring
 * (ADR-0018, Operations-specific model). Uses only the explicit candidate
 * inputs operationalUrgency, deliveryRisk, estimatedEffort, and confidence. No
 * channel weighting, no source-reliability weighting, no recency term, no clock
 * reads, no semantic matching.
 *
 *   urgencyScore           = clamp(operationalUrgency)
 *   riskScore              = clamp(deliveryRisk)
 *   effortScore            = clamp(estimatedEffort)
 *   confidenceScore        = clamp(confidence)
 *   riskUrgencyBlend       = round(0.5*riskScore + 0.5*urgencyScore)
 *   operationalImpactScore = round(0.6*riskUrgencyBlend + 0.4*confidenceScore)
 *   priorityScore          = round(0.7*operationalImpactScore + 0.3*(100 - effortScore))
 *   effortBand             = HIGH if effortScore >= 67, MEDIUM if >= 34, else LOW
 *   priority               = HIGH if priorityScore >= 70, MEDIUM if >= 40, else LOW
 *
 * All numeric outputs are clamped to [0, 100]; non-finite inputs clamp to 0.
 * Higher effort lowers priority.
 */
export function scoreOperationsPlanCandidate(
  candidate: OperationsPlanCandidate,
): OperationsPlanScore {
  const urgencyScore = clamp(candidate.operationalUrgency);
  const riskScore = clamp(candidate.deliveryRisk);
  const effortScore = clamp(candidate.estimatedEffort);
  const confidenceScore = clamp(candidate.confidence);

  const riskUrgencyBlend = clamp(Math.round(0.5 * riskScore + 0.5 * urgencyScore));
  const operationalImpactScore = clamp(Math.round(0.6 * riskUrgencyBlend + 0.4 * confidenceScore));
  const priorityScore = clamp(Math.round(0.7 * operationalImpactScore + 0.3 * (100 - effortScore)));

  return {
    operationalImpactScore,
    effortScore,
    effortBand: toEffortBand(effortScore),
    confidenceScore,
    priority: toPriority(priorityScore),
  };
}

function toEffortBand(effortScore: number): OperationsPlanScore['effortBand'] {
  if (effortScore >= HIGH_EFFORT_THRESHOLD) {
    return 'HIGH';
  }
  if (effortScore >= MEDIUM_EFFORT_THRESHOLD) {
    return 'MEDIUM';
  }
  return 'LOW';
}

function toPriority(priorityScore: number): OperationsPlanScore['priority'] {
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
