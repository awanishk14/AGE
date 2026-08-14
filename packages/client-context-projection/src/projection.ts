import type { ScoredBifContext } from '@age/business-discovery-contracts';
import { deriveModelledSubjects } from '@age/observation-association';
import { OBSERVATION_SUBJECT_KINDS, type ObservationSubjectKind } from '@age/source-observation';

/**
 * ADR-0069 deliverable 7, the PROJECTION half — what AGE will tell a peer
 * product about a business, before anything is entitled to ask for it.
 *
 * 🛑 **THIS ANSWERS ONE QUESTION: "WHAT MAY I NAME?"** A peer needs to know
 * which subjects AGE already models, because admissibility is BY SUBJECT (D4):
 * an observation naming something AGE does not model is `unmapped`, and a peer
 * that cannot see the modelled subjects can only guess. 🚫 It does NOT answer
 * "how is this business doing", and it carries no conclusion — a conclusion is
 * authored by a deterministic rule (D1) and is a different projection.
 *
 * 🛑 **IT IS WHAT THE BUSINESS SAYS, 🚫 NOT WHAT AGE CONCLUDED.** The three
 * categories stay apart: BIF (what the business says) · source observation
 * (what an external system observed) · derived intelligence (what AGE concludes
 * by relating them). This projects the FIRST one only, and says so in words a
 * consumer cannot drop, because a peer receiving a subject list has no other
 * way to tell which category it came from.
 *
 * 🚫 **NO SCORE CROSSES THIS BOUNDARY.** `bifCompletenessScore` and
 * `bifConfidenceScore` exist on the context and are deliberately not projected:
 * they describe how well AGE captured the interview, and a peer receiving a
 * number will gate on it — turning an internal quality measure into an external
 * authority nobody granted it. 🚫 Do not add one "for context".
 *
 * 🚫 **NOTHING IS EMPTY-BY-OMISSION.** Every subject kind appears, always, with
 * its own state and its own reason. A kind AGE never captured and a kind
 * captured with nothing recorded are DIFFERENT, and neither is "none" — an
 * absent kind would let a peer read silence as an answer.
 *
 * 🚫 **SOURCE-NEUTRAL** (D6). No peer product is named here, no kind is special
 * to one consumer, and there is no per-source arm. A projection that branched on
 * who was asking would be a different answer per caller, which is the opposite
 * of a shared semantic hub.
 *
 * ⚠️ **`asOf` IS A PARAMETER, 🚫 NEVER A CLOCK.** It is the moment the context
 * was captured, carried in by the caller from the stored row. Reading a clock
 * here would stamp every projection "now" and quietly claim freshness AGE
 * cannot support.
 *
 * Pure: no clock, no ids, no randomness, no I/O.
 */

/** The state of one subject kind, carried through 🚫 without collapsing. */
export type ProjectedSubjectKindState =
  /** AGE models at least one subject of this kind. */
  | 'modelled'
  /** 🛑 Every source section is absent — AGE was never told. 🚫 Not "none". */
  | 'never-captured'
  /** A section is present and still holds no subject of this kind. */
  | 'captured-nothing-recorded';

export interface ProjectedSubjectKind {
  readonly subjectKind: ObservationSubjectKind;
  readonly state: ProjectedSubjectKindState;
  /** ⚠️ AGE's own labels. 🚫 Never a source system's spelling of them. */
  readonly labels: readonly string[];
  /**
   * 🛑 Entries AGE holds here and could not read a label from. 🚫 Never dropped
   * silently: a peer must be able to see AGE held something it could not name.
   */
  readonly unreadableEntryCount: number;
  /** Why this kind is in this state, in words. ⚠️ Never blank. */
  readonly because: string;
}

export interface ClientContextProjection {
  readonly bifId: string;
  /** ⚠️ When the context was captured. 🚫 Not when it was projected. */
  readonly asOf: string;
  /** Every kind, always, in a fixed order. 🚫 None is omitted. */
  readonly subjectKinds: readonly ProjectedSubjectKind[];
  /**
   * 🛑 The canonical sections AGE holds nothing for. ⚠️ Limitations, 🚫 never
   * negative evidence about the business (ADR-0026 D4).
   */
  readonly notCaptured: readonly string[];
  /** 🚫 A consumer cannot drop these; they are what the numbers are not. */
  readonly notices: readonly string[];
}

const CATEGORY_NOTICE =
  'This is what the business itself stated, recorded during discovery. It is not an observation ' +
  'any system made and it is not a conclusion AGE drew — those are separate answers and are not ' +
  'mixed into this one.';

const ADMISSIBILITY_NOTICE =
  'An observation is admissible only if it names a subject listed here. One that names something ' +
  'else is not rejected as false — AGE simply cannot relate it, and reports it as unrelated with ' +
  'that reason.';

const SILENCE_NOTICE =
  'A subject kind AGE never captured and a kind captured with nothing recorded are different ' +
  'states, and neither means the business has none. AGE not having been told is not a finding ' +
  'about the business.';

const NO_SCORE_NOTICE =
  'No score is included. AGE holds completeness and confidence figures about its own capture of ' +
  'the interview, and they describe AGE, not the business — acting on one here would give an ' +
  'internal measure an authority it was never granted.';

/** ⚠️ Its own words per state — 🚫 never one sentence with a state appended. */
function becauseOf(state: ProjectedSubjectKindState, labelCount: number): string {
  if (state === 'never-captured') {
    return (
      'AGE was never told about this. Every part of the business context that could name one is ' +
      'absent, so AGE has not looked and found nothing — it has nothing to look at.'
    );
  }

  if (state === 'captured-nothing-recorded') {
    return (
      'The business context covering this is present and records no subject of this kind. That is ' +
      'what was captured, not a statement that the business has none.'
    );
  }

  return `AGE models ${String(labelCount)} subject(s) of this kind, as the business stated them.`;
}

export interface ClientContextProjectionInput {
  readonly context: Readonly<ScoredBifContext>;
  /** ⚠️ The stored row's capture time. 🚫 Never defaulted, never `now`. */
  readonly asOf: string;
}

/**
 * Projects the business context into the shape a peer product can act on.
 *
 * 🚫 It decides nothing and filters nothing: every kind, every label AGE could
 * read, every entry it could not, and every canonical section it holds nothing
 * for.
 */
export function projectClientContext(input: ClientContextProjectionInput): ClientContextProjection {
  const { context, asOf } = input;

  // ⚠️ ONE READING RULE, SHARED. The subjects a peer is told about are derived
  // by the SAME function admissibility is assessed against — a second reading
  // here would let AGE advertise a subject it would then refuse to relate.
  const derivation = deriveModelledSubjects(context);

  const subjectKinds = OBSERVATION_SUBJECT_KINDS.map((subjectKind) => {
    const derived = derivation.kinds.find((kind) => kind.subjectKind === subjectKind);
    const state: ProjectedSubjectKindState =
      derived === undefined
        ? 'never-captured'
        : derived.state === 'derived'
          ? 'modelled'
          : derived.state;
    const labels = derived === undefined ? [] : derived.subjects.map((subject) => subject.label);

    return {
      subjectKind,
      state,
      labels,
      unreadableEntryCount:
        derived === undefined
          ? 0
          : derived.readings.reduce((total, reading) => total + reading.unreadableEntryCount, 0),
      because: becauseOf(state, labels.length),
    };
  });

  return {
    bifId: derivation.bifId,
    asOf,
    subjectKinds,
    // ⚠️ Carried through as the context stated them — 🚫 not counted, not
    // summarised, and 🚫 never rendered as a score.
    notCaptured: context.omittedSections.map((section) => section.type),
    notices: [CATEGORY_NOTICE, ADMISSIBILITY_NOTICE, SILENCE_NOTICE, NO_SCORE_NOTICE],
  };
}
