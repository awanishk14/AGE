import { EvidenceState } from '../types/enums';

/**
 * EVIDENCE_LIFECYCLE — the legal primary progression of evidence state.
 *
 * Transitions must follow this order and may not skip states. REJECTED and
 * CONFLICTED (see EVIDENCE_TERMINAL_STATES) are terminal off-ramps that can
 * never reach APPLIED_TO_BIF.
 *
 * Definition only — no state-machine logic is implemented here.
 */
export const EVIDENCE_LIFECYCLE: readonly EvidenceState[] = [
  EvidenceState.NEW,
  EvidenceState.PROCESSED,
  EvidenceState.MAPPED,
  EvidenceState.APPLIED_TO_BIF,
];

/** Terminal states evidence may enter instead of being applied to BIF. */
export const EVIDENCE_TERMINAL_STATES: readonly EvidenceState[] = [
  EvidenceState.REJECTED,
  EvidenceState.CONFLICTED,
];
