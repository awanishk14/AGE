import type { OpportunityPriority } from '@age/market-discovery-contracts';
import type { MarketOpportunityCandidate } from './market-opportunity-candidate';

/**
 * OpportunityScore — the deterministic scoring outputs for a candidate.
 */
export interface OpportunityScore {
  readonly impactScore: number;
  readonly confidenceScore: number;
  readonly priority: OpportunityPriority;
}

/**
 * demandVolume at or above which demand is scored as fully saturated.
 */
const DEMAND_CAP = 1000;

const HIGH_PRIORITY_THRESHOLD = 70;
const MEDIUM_PRIORITY_THRESHOLD = 40;

/**
 * scoreOpportunity — deterministic quality/priority scoring (ADR-0013). Uses
 * only the explicit candidate inputs strength, confidence, and demandVolume.
 * No source-reliability weighting, no recency term, no clock reads.
 *
 *   normalizedDemand = min(demandVolume, DEMAND_CAP) / DEMAND_CAP * 100
 *   impactScore      = round(0.50*strength + 0.30*normalizedDemand + 0.20*confidence)
 *   confidenceScore  = clamp(confidence, 0, 100)
 *   priorityScore    = round(0.70*impactScore + 0.30*confidenceScore)
 *   priority         = HIGH if priorityScore >= 70, MEDIUM if >= 40, else LOW
 *
 * All numeric outputs are clamped to [0, 100].
 */
export function scoreOpportunity(candidate: MarketOpportunityCandidate): OpportunityScore {
  const strength = clamp(candidate.strength);
  const confidenceScore = clamp(candidate.confidence);
  const normalizedDemand =
    (Math.min(clampDemand(candidate.demandVolume), DEMAND_CAP) / DEMAND_CAP) * 100;

  const impactScore = clamp(
    Math.round(0.5 * strength + 0.3 * normalizedDemand + 0.2 * confidenceScore),
  );
  const priorityScore = clamp(Math.round(0.7 * impactScore + 0.3 * confidenceScore));

  return {
    impactScore,
    confidenceScore,
    priority: toPriority(priorityScore),
  };
}

function toPriority(priorityScore: number): OpportunityPriority {
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

function clampDemand(value: number): number {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    return 0;
  }
  return value;
}
