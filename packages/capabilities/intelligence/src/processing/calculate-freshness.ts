import type { Evidence } from '@age/evidence-contracts';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * calculateFreshnessDays — deterministic age of an Evidence record in whole
 * days, measured against a caller-supplied `runAt` (ADR-0011 processing
 * pipeline). Never calls `new Date()` internally so results are reproducible
 * given the same inputs.
 *
 * Evidence with an unparseable timestamp, or a timestamp in the future
 * relative to `runAt`, is treated as 0 days old — validation is responsible
 * for rejecting malformed timestamps before freshness is calculated.
 */
export function calculateFreshnessDays(evidence: Evidence, runAt: Date): number {
  const evidenceTimeMs = Date.parse(evidence.timestamp);

  if (Number.isNaN(evidenceTimeMs)) {
    return 0;
  }

  const ageMs = runAt.getTime() - evidenceTimeMs;

  if (ageMs <= 0) {
    return 0;
  }

  return Math.floor(ageMs / MILLISECONDS_PER_DAY);
}
