/**
 * `@age/observation-association` — relating what a source observed to what the
 * business says (ADR-0069 D4/D5, deliverable 4).
 *
 * 🛑 **RELATING IS NOT BELIEVING**, and 🚫 nothing in this package moves a score,
 * a status, a field or a completeness figure. It reads a read-only projection
 * and returns new values.
 *
 * 🛑 **"AGE HAS NEVER LOOKED" AND "AGE LOOKED AND HOLDS NOTHING" ARE DIFFERENT
 * ANSWERS HERE, AND THEY MUST STAY DIFFERENT ALL THE WAY TO THE SCREEN.**
 *
 * 🚫 PURE: no network, no persistence, no clock, no ids, no randomness.
 */

export type {
  ModelledSubjectDerivation,
  SubjectKindDerivation,
  SubjectKindState,
  SubjectSource,
  SubjectSourceReading,
  SubjectSourceState,
} from './context-subjects';
export { SUBJECT_SOURCES, deriveModelledSubjects } from './context-subjects';

export type { Association, AssociationOutcome } from './association';
export {
  ASSOCIATION_IS_NOT_BELIEF,
  associateObservation,
  associateObservations,
} from './association';
