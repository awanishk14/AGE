import type { Evidence } from '@age/evidence-contracts';

/**
 * scoreEvidenceQuality — deterministic 0–100 quality score for a single
 * Evidence record (ADR-0011).
 *
 * DECISION FLAGGED, NOT IMPLEMENTED: per-source reliability tiers (e.g.
 * weighting G2 review evidence differently from a forum post) are
 * intentionally NOT part of this formula. No ADR, contract, or frozen spec
 * defines a reliability ranking across EvidenceSource values, and inventing
 * one here would be a business judgment call outside this task's scope.
 * If source-tier weighting is wanted, it needs an explicit product decision
 * (ideally its own ADR) defining the ranking before it can be implemented.
 *
 * Until that exists, scoring uses only fields already explicit in the
 * Evidence contract:
 *
 *   score = round(
 *     0.55 * confidence                      // Evidence.confidence, 0-100
 *   + 0.35 * averageExtractedSignalStrength   // mean of Evidence.extractedSignals[].strength, 0-100
 *   + 0.10 * contentSubstantivenessScore      // rawContent length vs CONTENT_LENGTH_CAP, 0-100
 *   )
 *
 * Each term is independently bounded to [0, 100] before weighting, and the
 * weights sum to 1.0, so the result is always in [0, 100].
 */

/** rawContent length (trimmed) at or above which content is scored as fully substantive. */
const CONTENT_LENGTH_CAP = 240;

const CONFIDENCE_WEIGHT = 0.55;
const SIGNAL_STRENGTH_WEIGHT = 0.35;
const CONTENT_SUBSTANTIVENESS_WEIGHT = 0.1;

export function scoreEvidenceQuality(evidence: Evidence): number {
  const confidenceScore = clamp(evidence.confidence);
  const signalStrengthScore = clamp(averageSignalStrength(evidence));
  const contentSubstantivenessScore = clamp(contentSubstantiveness(evidence));

  const weighted =
    CONFIDENCE_WEIGHT * confidenceScore +
    SIGNAL_STRENGTH_WEIGHT * signalStrengthScore +
    CONTENT_SUBSTANTIVENESS_WEIGHT * contentSubstantivenessScore;

  return Math.round(clamp(weighted));
}

function averageSignalStrength(evidence: Evidence): number {
  if (evidence.extractedSignals.length === 0) {
    return 0;
  }

  const total = evidence.extractedSignals.reduce((sum, signal) => sum + signal.strength, 0);
  return total / evidence.extractedSignals.length;
}

function contentSubstantiveness(evidence: Evidence): number {
  const length = typeof evidence.rawContent === 'string' ? evidence.rawContent.trim().length : 0;
  return (Math.min(length, CONTENT_LENGTH_CAP) / CONTENT_LENGTH_CAP) * 100;
}

function clamp(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}
