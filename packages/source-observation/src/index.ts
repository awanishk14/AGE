/**
 * `@age/source-observation` — what an external system OBSERVED.
 *
 * 🛑 The third epistemic category, and it is kept apart from the other two
 * (ADR-0069 §2): **BIF** is what the business says · **Source Observation** is
 * what a peer product observed · **Derived Intelligence** is what AGE concludes
 * by relating them. 🚫 They are never merged and never default into each other.
 *
 * 🚫 This package is PURE: no network, no persistence, no clock, no ids. It
 * cannot record anything, on purpose — recording is a separate slice with its
 * own entitlement gate.
 */

export type { ClaimDirection, MaterialityBand, ObservationClaim } from './observation-claim';
export { CLAIM_DIRECTIONS, MATERIALITY_BANDS } from './observation-claim';

export type { ObservationPeriod } from './observation-period';
export { isParseableInstant, isWindowOrdered } from './observation-period';

export type { ClaimKind, ObservationProvenance } from './observation-provenance';
export { CLAIM_KINDS, PROVENANCE_FIELDS } from './observation-provenance';

export type {
  ModelledSubject,
  ObservationSubject,
  ObservationSubjectKind,
  SubjectBearingObservation,
} from './observation-subject';
export {
  OBSERVATION_SUBJECT_KINDS,
  isSameModelledSubject,
  subjectLabelKey,
} from './observation-subject';

export type {
  EnvelopeAccepted,
  EnvelopeAcceptance,
  EnvelopeRefusal,
  SourceObservationEnvelope,
} from './observation-envelope';
export { acceptSourceObservationEnvelope } from './observation-envelope';

export type { StoredSourceObservation } from './observation-row';
export { StoredObservationRefusedError, normalizeStoredObservation } from './observation-row';

export type { RelayOutcome, RelayRefused, RelayRelayed } from './observation-relay';
export {
  RELAY_ADMISSIBILITY_NOT_ASSESSED,
  RELAY_DOES_NOT_RECORD,
  relaySourceObservation,
} from './observation-relay';

export type { AdmissibilityOutcome } from './admissibility';
export { assessAdmissibility } from './admissibility';
