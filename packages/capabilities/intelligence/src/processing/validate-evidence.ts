import { EvidenceState } from '@age/evidence-contracts';
import type { Evidence } from '@age/evidence-contracts';
import type { RejectedEvidenceReason, RejectedEvidenceReasonCode } from '../processing-summary';

/** Minimum non-whitespace length for rawContent to be considered substantive. */
const MIN_RAW_CONTENT_LENGTH = 5;

const RECOGNIZED_STATES: ReadonlySet<string> = new Set(Object.values(EvidenceState));

/**
 * validateEvidence — deterministic, field-level validation of a single
 * Evidence record (ADR-0011). Returns the first violated rule as a
 * RejectedEvidenceReason, or null if the record is valid.
 *
 * Rules are evaluated in a fixed order so results are reproducible; an
 * evidence record failing multiple rules is still reported with exactly one
 * reason (ADR-0011 "exactly once" accounting), the first rule it violates.
 */
export function validateEvidence(evidence: Evidence): RejectedEvidenceReason | null {
  const rule = FIRST_VIOLATED_RULE.find(({ isViolated }) => isViolated(evidence));

  if (!rule) {
    return null;
  }

  return {
    evidenceId: evidence.id,
    reasonCode: rule.reasonCode,
    detail: rule.detail(evidence),
  };
}

interface ValidationRule {
  readonly reasonCode: RejectedEvidenceReasonCode;
  readonly isViolated: (evidence: Evidence) => boolean;
  readonly detail: (evidence: Evidence) => string;
}

const FIRST_VIOLATED_RULE: readonly ValidationRule[] = [
  {
    reasonCode: 'MISSING_ID',
    isViolated: (e) => typeof e.id !== 'string' || e.id.trim().length === 0,
    detail: () => 'Evidence record has no id.',
  },
  {
    reasonCode: 'EMPTY_SOURCE_URL',
    isViolated: (e) => typeof e.sourceUrl !== 'string' || e.sourceUrl.trim().length === 0,
    detail: (e) => `Evidence "${e.id}" has an empty sourceUrl.`,
  },
  {
    reasonCode: 'MISSING_TIMESTAMP',
    isViolated: (e) =>
      typeof e.timestamp !== 'string' ||
      e.timestamp.trim().length === 0 ||
      Number.isNaN(Date.parse(e.timestamp)),
    detail: (e) => `Evidence "${e.id}" has a missing or unparseable timestamp.`,
  },
  {
    reasonCode: 'INVALID_CONFIDENCE',
    isViolated: (e) =>
      typeof e.confidence !== 'number' ||
      Number.isNaN(e.confidence) ||
      e.confidence < 0 ||
      e.confidence > 100,
    detail: (e) => `Evidence "${e.id}" has an out-of-range confidence: ${String(e.confidence)}.`,
  },
  {
    reasonCode: 'UNRECOGNIZED_STATE',
    isViolated: (e) => !RECOGNIZED_STATES.has(e.state),
    detail: (e) => `Evidence "${e.id}" has an unrecognized state: ${String(e.state)}.`,
  },
  {
    reasonCode: 'RAW_CONTENT_TOO_SHORT',
    isViolated: (e) =>
      typeof e.rawContent !== 'string' || e.rawContent.trim().length < MIN_RAW_CONTENT_LENGTH,
    detail: (e) =>
      `Evidence "${e.id}" rawContent is shorter than the minimum of ${MIN_RAW_CONTENT_LENGTH} characters.`,
  },
];
