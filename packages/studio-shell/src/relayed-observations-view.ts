import type { StoredSourceObservation } from '@age/source-observation';

/**
 * What each peer product REPORTED, rendered as itself (ADR-0069 D5, D6).
 *
 * 🛑 **THE HARDEST THING THIS SCREEN HAS TO DO IS SAY WHAT IT DOES NOT KNOW.**
 * From AGE's side of an operator-mediated relay, three completely different
 * situations look identical:
 *
 *   1. a peer product that has never been relayed at all;
 *   2. a peer product that did not run;
 *   3. a peer product that ran and found nothing.
 *
 * Only the third would be a finding, and AGE has no basis for it. So the screen
 * reports SOURCE SYSTEMS THAT HAVE RELAYED, and says plainly that silence from
 * any other system is not information. 🚫 It never lists an expected peer
 * product, never shows a peer product with a zero beside it, and never renders
 * "no observations" as a state of the business.
 *
 * 🚫 **THERE IS NO REGISTRY OF PEER PRODUCTS HERE, ON PURPOSE** (D6). The
 * contract is source-neutral: `sourceSystem` is DATA, never a branch. A hard
 * -coded list of the five current peer products would make a sixth invisible
 * and would let the screen assert that a named product "has nothing" — which is
 * exactly the claim AGE cannot make.
 *
 * 🚫 **ARRIVAL IS NEVER CONFIRMATION** (D5). Nothing here scores, ranks,
 * weights, prefers a source, marks an observation verified or lets two sources
 * agreeing become a conclusion. A conclusion is authored by a deterministic
 * rule in `@age/derived-intelligence` and by nothing else (D1) — 🚫 never by a
 * view module.
 *
 * ⚠️ **PURE.** It takes observations a caller already read through the read
 * façade and shapes them. It opens nothing, connects to nothing, reads no clock
 * — every instant shown is the one the source reported, verbatim.
 */

/** One observation, as a screen shows it. 🚫 Nothing is summarised away. */
export interface RelayedObservationView {
  readonly observationId: string;
  readonly sourceInstance: string;
  readonly sourceRecordId: string;
  /**
   * ⚠️ Either the subject AGE models, or a plain statement that it does not.
   * 🚫 Never a guess, and 🚫 never silently dropped: an unmapped observation is
   * something a source said about this business that AGE cannot relate, and
   * hiding it would overstate how much AGE has taken in.
   */
  readonly subject: string;
  readonly subjectState: 'modelled' | 'unmapped';
  readonly subjectDetail: string;
  /** ⚠️ The direction and materiality AS REPORTED. 🚫 Not AGE's assessment. */
  readonly claim: string;
  /** 🚫 Verbatim instants. Never "3 days ago" — a relative time is a claim about now. */
  readonly observedAt: string;
  readonly window: string;
  /**
   * ⚠️ Shown BESIDE `observedAt`, never instead of it. An operator-mediated
   * relay records days after the fact by construction, so a single date would
   * make a stale observation look fresh or a fresh one look stale.
   */
  readonly relayedAt: string;
  readonly claimKind: string;
}

/** Everything ONE source system has relayed. 🚫 Not a score for that system. */
export interface RelayedSourceSystemView {
  readonly sourceSystem: string;
  readonly observations: readonly RelayedObservationView[];
  /**
   * ⚠️ A count of what ARRIVED, and the label says so. 🚫 Never presented as
   * coverage, activity, health or how much this source knows.
   */
  readonly relayedCount: number;
}

export interface RelayedObservationsView {
  readonly organizationId: string;
  readonly sourceSystems: readonly RelayedSourceSystemView[];
  readonly sourceSystemCount: number;
  readonly observationCount: number;
  /** 🛑 The sentence that stops the screen implying knowledge it does not have. */
  readonly silenceNotice: string;
  /** 🛑 What arriving does NOT mean. Shown above the list, never under it. */
  readonly arrivalNotice: string;
  /**
   * ⚠️ Present when at least one observation names a subject AGE does not
   * model. 🚫 Never a warning about the source and 🚫 never a defect: it is a
   * statement that AGE could not relate this, which is a limit of AGE's model.
   */
  readonly unmappedNotice?: string;
}

/**
 * 🚫 A statement about the RELAY, never about the peer products.
 *
 * ⚠️ It is shown whether the list is empty or full, because the reasoning does
 * not change: a source system absent from this screen has not been relayed, and
 * that is all that can be said about it.
 */
export const RELAY_SILENCE_NOTICE =
  'Only source systems that have relayed an observation appear here. A peer product that is ' +
  'absent has not been relayed to AGE — it may never have been connected, it may not have run, ' +
  'or it may have run and found nothing. Those are three different situations and AGE cannot ' +
  'tell them apart from here, so none of them is shown as a finding.';

/** 🛑 ADR-0069 D5, stated on the surface rather than left to be inferred. */
export const RELAY_ARRIVAL_NOTICE =
  'These are things a source system reported. Arriving is not being confirmed: AGE has not ' +
  'verified any of them, they do not move a BIF field, and they change no score. Two sources ' +
  'agreeing is still two reports until a rule relates them.';

export const RELAY_UNMAPPED_NOTICE =
  'Some observations name a subject AGE does not model. They are shown rather than dropped — a ' +
  'source said something about this business that AGE cannot relate to anything it holds, and ' +
  'that is a limit of what AGE models, not a fault in the observation.';

const describeSubject = (
  observation: StoredSourceObservation,
): Pick<RelayedObservationView, 'subject' | 'subjectState' | 'subjectDetail'> =>
  observation.subject.kind === 'modelled'
    ? {
        subject: observation.subject.label,
        subjectState: 'modelled',
        subjectDetail: `A ${observation.subject.subjectKind} AGE models for this business.`,
      }
    : {
        // ⚠️ `topicLabel`, the raw topic the source used, shown as the source
        // wrote it. 🚫 Never tidied toward the nearest subject AGE does model —
        // that would be the coercion `@age/source-observation` refuses to make.
        subject: observation.subject.topicLabel,
        subjectState: 'unmapped',
        subjectDetail:
          'AGE does not model this subject, so this observation is recorded but cannot be ' +
          'related to anything AGE holds.',
      };

/**
 * @param organizationId The scope the read ran under, echoed so the operator can
 *        see it was DERIVED from the client record rather than typed.
 * @param observations As read, newest-observed first. 🚫 Not re-ordered here.
 */
export function presentRelayedObservations(
  organizationId: string,
  observations: ReadonlyArray<StoredSourceObservation>,
): RelayedObservationsView {
  // ⚠️ Grouped in ARRIVAL ORDER OF FIRST APPEARANCE, which preserves the
  // newest-observed-first ordering the read established. 🚫 Not sorted
  // alphabetically and 🚫 emphatically not sorted by count — ordering source
  // systems by how much they relayed would rank them, and a source that
  // relayed more is not a better source.
  const grouped = new Map<string, RelayedObservationView[]>();

  for (const observation of observations) {
    const view: RelayedObservationView = {
      observationId: observation.observationId,
      sourceInstance: observation.sourceInstance,
      sourceRecordId: observation.sourceRecordId,
      ...describeSubject(observation),
      claim: `${observation.claim.direction} · ${observation.claim.materiality}`,
      observedAt: observation.period.observedAt,
      window: `${observation.period.windowStart} → ${observation.period.windowEnd}`,
      relayedAt: observation.recordedAt,
      claimKind: observation.claimKind,
    };

    const existing = grouped.get(observation.sourceSystem);
    if (existing === undefined) {
      grouped.set(observation.sourceSystem, [view]);
    } else {
      existing.push(view);
    }
  }

  const sourceSystems: RelayedSourceSystemView[] = [...grouped.entries()].map(
    ([sourceSystem, views]) => ({
      sourceSystem,
      observations: Object.freeze([...views]),
      relayedCount: views.length,
    }),
  );

  const hasUnmapped = observations.some((observation) => observation.subject.kind === 'unmapped');

  return {
    organizationId,
    sourceSystems: Object.freeze(sourceSystems),
    sourceSystemCount: sourceSystems.length,
    observationCount: observations.length,
    silenceNotice: RELAY_SILENCE_NOTICE,
    arrivalNotice: RELAY_ARRIVAL_NOTICE,
    ...(hasUnmapped ? { unmappedNotice: RELAY_UNMAPPED_NOTICE } : {}),
  };
}
