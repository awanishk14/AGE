import type { DerivedIntelligenceProjection } from '@age/derived-intelligence';

/**
 * What AGE CONCLUDES, shown with everything the conclusion rests on
 * (ADR-0069 D1/D2/D7).
 *
 * 🛑 **A CONCLUSION IS NEVER SHOWN WITHOUT ITS CONTRIBUTORS.** The value of a
 * derived finding is that an operator can check it. A headline with the
 * evidence one click away is a headline the operator will believe without
 * checking, so every conclusion here carries every observation that produced
 * it, quoted, with its source system and its period.
 *
 * 🛑 **THE FOUR SILENCES ARE FOUR DIFFERENT THINGS, AND THEY STAY FOUR.**
 *
 *   1. `single-producer` — one source said it. That is a report, not a finding.
 *   2. `contested-directions` — two sources disagree, and AGE does not choose.
 *   3. `no-observation-relayed` — nobody reported on a subject AGE models.
 *   4. `never-captured` / `captured-nothing-recorded` — AGE does not model
 *      subjects of that kind at all.
 *
 * 🚫 None of the four is "no issues", "stable", "healthy" or a zero. Flattening
 * any of them into a clean bill is the exact failure this screen exists to
 * prevent: 🚫 **AGE MUST NOT IMPLY KNOWLEDGE IT DOES NOT POSSESS.**
 *
 * 🛑 **THIS MODULE AUTHORS NO CONCLUSION** (D1). It re-orders nothing, ranks
 * nothing, weights nothing and computes nothing — it takes a projection a
 * deterministic rule already produced and gives it words. 🚫 A view module that
 * decided anything would be a second, unauditable rule.
 *
 * 🚫 **NOTHING HERE IS STORED** (D2). The projection is recomputed from the
 * observations and the BIF every time it is asked for, and the screen says so,
 * so no reader takes a conclusion as a fact AGE keeps.
 *
 * ⚠️ **PURE.** No clock — every instant shown is one the data carried. A
 * relative time ("3 days ago") would be a claim about now.
 */

/** ⚠️ One contributing observation, quoted. 🚫 Never summarised away. */
export interface DerivedContributorView {
  readonly sourceSystem: string;
  readonly sourceInstance: string;
  readonly sourceRecordId: string;
  readonly claim: string;
  readonly observedAt: string;
  readonly window: string;
}

export interface DerivedConclusionView {
  readonly subject: string;
  readonly subjectKind: string;
  /** ⚠️ What the rule found, in the rule's own terms. 🚫 Not a recommendation. */
  readonly statement: string;
  /** 🛑 The named rule that authored it, so the operator can go and read it. */
  readonly rule: string;
  /** 🛑 As old as its evidence. 🚫 Never "now". */
  readonly asOf: string;
  /** 🛑 Distinct source SYSTEMS. 🚫 Never a count of observations. */
  readonly producerCount: number;
  readonly contributors: readonly DerivedContributorView[];
  /** 🛑 What the conclusion is NOT. Shown with it, never below the fold. */
  readonly limitation: string;
}

/** 🛑 Something AGE will not conclude, WITH the reason and the evidence. */
export interface UnconcludedView {
  readonly subject: string;
  readonly subjectKind: string;
  readonly reason: 'single-producer' | 'contested-directions';
  readonly explanation: string;
  readonly contributors: readonly DerivedContributorView[];
}

/** 🛑 A subject AGE models that nobody reported on. 🚫 Not "unchanged". */
export interface UnobservedSubjectView {
  readonly subject: string;
  readonly subjectKind: string;
  readonly explanation: string;
}

/** 🛑 A whole kind AGE does not model. 🚫 Never rendered as "none" or "0". */
export interface UnmodelledKindView {
  readonly subjectKind: string;
  readonly explanation: string;
}

/** 🛑 A relayed observation AGE could not relate. 🚫 Carried, never dropped. */
export interface UnrelatedObservationView {
  readonly sourceSystem: string;
  readonly sourceRecordId: string;
  readonly claim: string;
  readonly observedAt: string;
  readonly explanation: string;
}

export interface DerivedIntelligenceView {
  readonly bifId: string;
  readonly conclusions: readonly DerivedConclusionView[];
  readonly unconcluded: readonly UnconcludedView[];
  readonly unobservedSubjects: readonly UnobservedSubjectView[];
  readonly unmodelledKinds: readonly UnmodelledKindView[];
  readonly unrelated: readonly UnrelatedObservationView[];
  /** 🛑 Always present, whether or not anything was concluded. */
  readonly derivationNotice: string;
  readonly persistenceNotice: string;
  /**
   * 🛑 Present when AGE concluded NOTHING. ⚠️ It says why that is not a finding
   * about the business — 🚫 an empty conclusions list must never read as "all
   * clear", which is what an unlabelled empty list always reads as.
   */
  readonly nothingConcludedNotice?: string;
}

/** 🛑 D1, on the surface: an operator can name the author of every conclusion. */
export const DERIVATION_NOTICE =
  'Every conclusion below was produced by a named deterministic rule over the observations ' +
  'shown with it, and by nothing else. No model wrote any of this. The same observations will ' +
  'always produce the same conclusion, and each one can be checked against its contributors.';

/** 🛑 D2, stated so no reader takes a conclusion for a fact AGE keeps. */
export const PERSISTENCE_NOTICE =
  'AGE does not store conclusions. This is recomputed from the recorded observations and the ' +
  'business context each time it is shown, so a conclusion can never outlive the evidence for it.';

/** 🛑 The sentence that stops an empty list from reading as a clean bill. */
export const NOTHING_CONCLUDED_NOTICE =
  'AGE concluded nothing here. That is a statement about what AGE has been given, not about the ' +
  'business: it is not "no issues found" and it is not a clean result. What AGE could not ' +
  'conclude, and why, is listed below.';

export const NO_OBSERVATION_RELAYED_EXPLANATION =
  'No source system has relayed an observation about this subject. AGE does not know whether ' +
  'nothing happened, whether a source looked and found nothing, or whether nobody looked.';

const UNMODELLED_KIND_EXPLANATIONS = {
  'never-captured':
    'AGE has never captured this part of the business, so it models no subjects of this kind. ' +
    'Nothing here is a statement about the business — AGE has not looked.',
  'captured-nothing-recorded':
    'AGE captured this part of the business and recorded no subjects of this kind. That is what ' +
    'the business said, not a finding about it.',
} as const;

const UNRELATED_EXPLANATION =
  'A source system reported this, and AGE cannot relate it to anything it models. It is kept ' +
  'rather than discarded: the gap is in what AGE models, not in the observation.';

const claimOf = (direction: string, materiality: string): string => `${direction} · ${materiality}`;

const contributorOf = (contributor: {
  readonly sourceSystem: string;
  readonly sourceInstance: string;
  readonly sourceRecordId: string;
  readonly direction: string;
  readonly materiality: string;
  readonly observedAt: string;
  readonly windowStart: string;
  readonly windowEnd: string;
}): DerivedContributorView => ({
  sourceSystem: contributor.sourceSystem,
  sourceInstance: contributor.sourceInstance,
  sourceRecordId: contributor.sourceRecordId,
  claim: claimOf(contributor.direction, contributor.materiality),
  observedAt: contributor.observedAt,
  window: `${contributor.windowStart} → ${contributor.windowEnd}`,
});

/**
 * @param projection as `deriveIntelligence`/`deriveIntelligenceFromStoredObservations`
 *   produced it. ⚠️ Rendered in the order given — 🚫 nothing is re-ranked here,
 *   because an ordering a screen invented would be a judgement AGE has no
 *   ground for.
 */
export function presentDerivedIntelligence(
  projection: Readonly<DerivedIntelligenceProjection>,
): DerivedIntelligenceView {
  const conclusions: DerivedConclusionView[] = projection.conclusions.map((conclusion) => ({
    subject: conclusion.subjectLabel,
    subjectKind: conclusion.subjectKind,
    // ⚠️ The direction, and the fact that two independent systems reported it.
    // 🚫 Never "is falling", 🚫 never a magnitude, 🚫 never an implication for
    // the business — the rule established agreement, nothing more.
    statement:
      `${conclusion.producerCount} independent source systems reported ` +
      `${conclusion.direction} for this subject over their reporting windows.`,
    rule: conclusion.rule,
    asOf: conclusion.asOf,
    producerCount: conclusion.producerCount,
    contributors: Object.freeze(conclusion.contributors.map(contributorOf)),
    limitation: conclusion.limitation,
  }));

  const unconcluded: UnconcludedView[] = projection.unconcluded.map((subject) => ({
    subject: subject.subjectLabel,
    subjectKind: subject.subjectKind,
    reason: subject.reason,
    explanation: subject.explanation,
    contributors: Object.freeze(subject.contributors.map(contributorOf)),
  }));

  const unobservedSubjects: UnobservedSubjectView[] = projection.unobservedSubjects.map(
    (subject) => ({
      subject: subject.subjectLabel,
      subjectKind: subject.subjectKind,
      explanation: NO_OBSERVATION_RELAYED_EXPLANATION,
    }),
  );

  const unmodelledKinds: UnmodelledKindView[] = projection.unmodelledKinds.map((kind) => ({
    subjectKind: kind.subjectKind,
    // ⚠️ The two states are kept apart all the way to the screen. One means AGE
    // never looked; the other means AGE looked and the business said nothing.
    // 🚫 An operator's next action differs completely between them.
    explanation: UNMODELLED_KIND_EXPLANATIONS[kind.state],
  }));

  const unrelated: UnrelatedObservationView[] = projection.unrelated.map((entry) => ({
    sourceSystem: entry.contributor.sourceSystem,
    sourceRecordId: entry.contributor.sourceRecordId,
    claim: claimOf(entry.contributor.direction, entry.contributor.materiality),
    observedAt: entry.contributor.observedAt,
    explanation: UNRELATED_EXPLANATION,
  }));

  return {
    bifId: projection.bifId,
    conclusions: Object.freeze(conclusions),
    unconcluded: Object.freeze(unconcluded),
    unobservedSubjects: Object.freeze(unobservedSubjects),
    unmodelledKinds: Object.freeze(unmodelledKinds),
    unrelated: Object.freeze(unrelated),
    derivationNotice: DERIVATION_NOTICE,
    persistenceNotice: PERSISTENCE_NOTICE,
    ...(conclusions.length === 0 ? { nothingConcludedNotice: NOTHING_CONCLUDED_NOTICE } : {}),
  };
}
