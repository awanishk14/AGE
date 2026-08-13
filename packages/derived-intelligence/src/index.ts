/**
 * `@age/derived-intelligence` — what AGE concludes by relating several pieces
 * of context (ADR-0069 D1/D2/D7, deliverable 5).
 *
 * 🛑 **A DETERMINISTIC RULE AUTHORS EVERY CONCLUSION.** 🚫 No model call, no
 * prompt, no sampling, and 🚫 no seam for one.
 *
 * 🛑 **A COMPUTED PROJECTION, 🚫 NEVER A PERSISTED ENTITY** — recomputed from
 * the observations and the BIF every time, so a conclusion cannot outlive its
 * evidence.
 *
 * 🛑 **TWO PRODUCERS OR IT IS NOT A CONCLUSION.**
 *
 * 🚫 PURE: no network, no persistence, no clock, no ids, no randomness.
 */

export type {
  ContributingObservation,
  DerivedConclusion,
  DerivedIntelligenceProjection,
  UnconcludedReason,
  UnconcludedSubject,
  UnmodelledKind,
  UnobservedSubject,
  UnrelatedObservation,
} from './derivation';
export {
  CONVERGENT_DIRECTION_RULE,
  NOT_A_MEASUREMENT,
  TWO_PRODUCERS_REQUIRED,
  deriveIntelligence,
  deriveIntelligenceFromStoredObservations,
} from './derivation';
