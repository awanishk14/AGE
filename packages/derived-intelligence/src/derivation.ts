import {
  type Association,
  type ModelledSubjectDerivation,
  type SubjectKindState,
  associateObservation,
} from '@age/observation-association';
import type {
  ClaimDirection,
  MaterialityBand,
  ObservationSubjectKind,
  SourceObservationEnvelope,
  StoredSourceObservation,
  SubjectBearingObservation,
} from '@age/source-observation';

/**
 * Derived Intelligence — what AGE CONCLUDES by relating several pieces of
 * context (ADR-0069 D1/D2/D7, deliverable 5).
 *
 * 🛑 **A CONCLUSION IS AUTHORED BY A DETERMINISTIC RULE AND NOTHING ELSE**
 * (D1). There is no model call here, no prompt, no sampling, no LLM provider and
 * 🚫 no seam for one: the same inputs produce byte-identical output forever, and
 * every conclusion can be re-derived and audited by reading one function. 🚫 Do
 * not add a "summarise this" step — a sentence a model wrote is not a conclusion
 * AGE can stand behind.
 *
 * 🛑 **THIS IS A COMPUTED PROJECTION, 🚫 NOT A PERSISTED ENTITY** (D2). Nothing
 * here is stored, given an id, versioned or cached. It is recomputed from the
 * observations and the BIF every time it is asked for, so a conclusion can never
 * outlive the evidence that produced it. 🚫 Do not add a table, a repository, a
 * `conclusionId` or an `updatedAt`.
 *
 * 🛑 **TWO PRODUCERS OR IT IS NOT A CONCLUSION** (D7). A finding drawn from one
 * source system is that source's observation restated in AGE's voice, which is
 * strictly worse than the observation itself because it looks like corroboration.
 * A single-producer subject is reported as `single-producer` — 🚫 never as a
 * weaker conclusion, a lower confidence or a "provisional" finding.
 *
 * 🛑 **AGE DOES NOT PICK A WINNER.** Two producers that disagree are reported as
 * `contested-directions`, with both observations shown. 🚫 Do not break the tie
 * by recency, by materiality, by source reputation or by count — AGE has no
 * ground for any of those, and inventing one would fabricate a conclusion.
 *
 * 🛑 **"NO SOURCE REPORTED" IS NOT "A SOURCE FOUND NOTHING".** An `absent`
 * claim is a source that LOOKED and found nothing; a subject with no relayed
 * observation means nobody looked, as far as AGE knows. They are separate arms
 * of this projection and 🚫 must stay separate all the way to the screen.
 *
 * 🚫 **RELATING AND CONCLUDING NEVER MOVE A SCORE.** No BIF field, status,
 * confidence or completeness figure is read, written or implied here
 * (AGE-INV-PROV-1, ADR-0069 D5).
 *
 * Pure: no clock, no ids, no randomness, no I/O.
 */

/** ⚠️ The one rule that exists. 🚫 A second rule needs its own named entry. */
export const CONVERGENT_DIRECTION_RULE = 'convergent-direction' as const;

export const TWO_PRODUCERS_REQUIRED =
  'A finding drawn from one source system is that source’s observation restated. AGE reports it ' +
  'as a single-producer observation, not as a conclusion.';

export const NOT_A_MEASUREMENT =
  'AGE concludes that two independent source systems reported the same direction over this ' +
  'subject. It does not know by how much, and it has not verified either report.';

/** ⚠️ A contributing observation, quoted — 🚫 never summarised away. */
export interface ContributingObservation {
  readonly sourceSystem: string;
  readonly sourceInstance: string;
  readonly sourceRecordId: string;
  readonly observedAt: string;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly direction: ClaimDirection;
  readonly materiality: MaterialityBand;
}

export interface DerivedConclusion {
  readonly rule: typeof CONVERGENT_DIRECTION_RULE;
  readonly subjectKind: ObservationSubjectKind;
  /** ⚠️ AGE's OWN label. 🚫 Never a source system's spelling of it. */
  readonly subjectLabel: string;
  readonly direction: ClaimDirection;
  /** 🛑 Distinct source SYSTEMS, always ≥ 2. 🚫 Never a count of observations. */
  readonly producerCount: number;
  /** ⚠️ Every contributor, in the order given. 🚫 This is not a ranking. */
  readonly contributors: readonly ContributingObservation[];
  /**
   * 🛑 The latest `observedAt` AMONG THE CONTRIBUTORS — read from the data, 🚫
   * never from a clock. A conclusion is as old as its evidence.
   */
  readonly asOf: string;
  readonly limitation: typeof NOT_A_MEASUREMENT;
}

export type UnconcludedReason =
  /** 🛑 One source system only. 🚫 NOT a weak conclusion — not a conclusion. */
  | 'single-producer'
  /** 🛑 Producers disagree. 🚫 AGE does not choose between them. */
  | 'contested-directions';

export interface UnconcludedSubject {
  readonly subjectKind: ObservationSubjectKind;
  readonly subjectLabel: string;
  readonly reason: UnconcludedReason;
  readonly contributors: readonly ContributingObservation[];
  readonly explanation: typeof TWO_PRODUCERS_REQUIRED | 'Producers disagree about the direction.';
}

/** 🛑 A subject AGE models that NO source has reported on. 🚫 Not "unchanged". */
export interface UnobservedSubject {
  readonly subjectKind: ObservationSubjectKind;
  readonly subjectLabel: string;
  readonly state: 'no-observation-relayed';
}

/** 🛑 A kind AGE has never captured. 🚫 Never rendered as "none" or "0". */
export interface UnmodelledKind {
  readonly subjectKind: ObservationSubjectKind;
  readonly state: Exclude<SubjectKindState, 'derived'>;
}

export interface UnrelatedObservation {
  readonly association: Association;
  readonly contributor: ContributingObservation;
}

export interface DerivedIntelligenceProjection {
  readonly bifId: string;
  readonly conclusions: readonly DerivedConclusion[];
  readonly unconcluded: readonly UnconcludedSubject[];
  readonly unobservedSubjects: readonly UnobservedSubject[];
  readonly unmodelledKinds: readonly UnmodelledKind[];
  /** Relayed observations AGE could not relate — carried, 🚫 never discarded. */
  readonly unrelated: readonly UnrelatedObservation[];
  /** ⚠️ Stated so no reader has to infer it. 🚫 Do not remove. */
  readonly persistence: 'computed-projection-not-stored';
}

const contributorOf = (envelope: Readonly<SourceObservationEnvelope>): ContributingObservation => ({
  sourceSystem: envelope.provenance.sourceSystem,
  sourceInstance: envelope.provenance.sourceInstance,
  sourceRecordId: envelope.provenance.sourceRecordId,
  observedAt: envelope.period.observedAt,
  windowStart: envelope.period.windowStart,
  windowEnd: envelope.period.windowEnd,
  direction: envelope.claim.direction,
  materiality: envelope.claim.materiality,
});

/**
 * What the rule actually needs from an observation: the subject it is about,
 * and the facts a reader must be able to quote back.
 *
 * ⚠️ **WHY THERE IS AN INTERMEDIATE SHAPE AT ALL.** AGE has two honest shapes
 * for an observation — the INBOUND envelope, which carries the scope the source
 * asserted, and the STORED row, which deliberately does not (rebuilding an
 * envelope from a row would mean inventing that field back). Both reduce to
 * this, so 🛑 **THE RULE EXISTS EXACTLY ONCE** and neither entry point can drift
 * into a second, gentler version of D7.
 */
interface RelatableObservation {
  readonly observation: Readonly<SubjectBearingObservation>;
  readonly contributor: ContributingObservation;
}

/**
 * ⚠️ The row's provenance is FLAT where the envelope's is nested, and 🚫 that is
 * the only difference this adapter is allowed to have. It reads columns; it
 * defaults nothing, and 🚫 it must never fill a field the row does not hold.
 */
const storedContributorOf = (row: Readonly<StoredSourceObservation>): ContributingObservation => ({
  sourceSystem: row.sourceSystem,
  sourceInstance: row.sourceInstance,
  sourceRecordId: row.sourceRecordId,
  observedAt: row.period.observedAt,
  windowStart: row.period.windowStart,
  windowEnd: row.period.windowEnd,
  direction: row.claim.direction,
  materiality: row.claim.materiality,
});

interface Bucket {
  readonly subjectKind: ObservationSubjectKind;
  readonly subjectLabel: string;
  readonly contributors: ContributingObservation[];
}

/**
 * Computes the projection.
 *
 * @param derivation what AGE models, from `deriveModelledSubjects`. 🚫 Never
 *   built from the observations themselves.
 * @param envelopes the relayed observations. ⚠️ An empty list is legitimate and
 *   yields no conclusions — 🚫 not an empty finding, and 🚫 never a clean bill.
 */
export function deriveIntelligence(
  derivation: Readonly<ModelledSubjectDerivation>,
  envelopes: readonly Readonly<SourceObservationEnvelope>[],
): DerivedIntelligenceProjection {
  return deriveFromRelatable(
    derivation,
    envelopes.map((envelope) => ({ observation: envelope, contributor: contributorOf(envelope) })),
  );
}

/**
 * The same projection, over observations AGE has ALREADY RECORDED.
 *
 * 🛑 **THE SAME RULE, 🚫 NOT A SECOND ONE.** This funnels into the identical
 * core as `deriveIntelligence`, so D7 (two producers), the contested arm, the
 * unobserved arm and `asOf`-from-the-data cannot differ between the relay's view
 * and the operator's view. 🚫 Do not give it its own thresholds, its own
 * ordering or its own explanation strings.
 *
 * 🚫 **A ROW IS NOT PROMOTED TO AN ENVELOPE HERE.** Nothing invents the
 * `organizationScope` the source asserted — the caller has already resolved
 * scope in order to read these rows at all, and re-asserting it from the row
 * would be a fabricated provenance.
 *
 * @param rows the recorded observations for ONE organisation. ⚠️ Scope is the
 *   caller's to enforce; 🚫 this function reads `organizationId` for nothing and
 *   must never become the place isolation is decided.
 */
export function deriveIntelligenceFromStoredObservations(
  derivation: Readonly<ModelledSubjectDerivation>,
  rows: readonly Readonly<StoredSourceObservation>[],
): DerivedIntelligenceProjection {
  return deriveFromRelatable(
    derivation,
    rows.map((row) => ({ observation: row, contributor: storedContributorOf(row) })),
  );
}

function deriveFromRelatable(
  derivation: Readonly<ModelledSubjectDerivation>,
  relatable: readonly RelatableObservation[],
): DerivedIntelligenceProjection {
  const buckets = new Map<string, Bucket>();
  const unrelated: UnrelatedObservation[] = [];

  for (const { observation, contributor } of relatable) {
    const association = associateObservation(derivation, observation);

    if (association.outcome.kind !== 'associated') {
      unrelated.push({ association, contributor });
      continue;
    }

    const { subjectKind, resolvedLabel } = association.outcome;
    const key = `${subjectKind}::${resolvedLabel}`;
    const bucket = buckets.get(key) ?? {
      subjectKind,
      subjectLabel: resolvedLabel,
      contributors: [],
    };
    bucket.contributors.push(contributor);
    buckets.set(key, bucket);
  }

  const conclusions: DerivedConclusion[] = [];
  const unconcluded: UnconcludedSubject[] = [];

  for (const bucket of buckets.values()) {
    const { contributors } = bucket;
    const first = contributors[0];
    // ⚠️ A bucket exists only because an observation landed in it, so this can
    // not be empty. 🚫 It is checked rather than asserted: an assertion is where
    // an empty bucket would become a conclusion with no evidence.
    if (first === undefined) continue;

    const producers = new Set(contributors.map((each) => each.sourceSystem));

    // 🛑 D7, and it is checked FIRST so no downstream branch can ever produce a
    // conclusion from one producer by falling through.
    if (producers.size < 2) {
      unconcluded.push({
        subjectKind: bucket.subjectKind,
        subjectLabel: bucket.subjectLabel,
        reason: 'single-producer',
        contributors,
        explanation: TWO_PRODUCERS_REQUIRED,
      });
      continue;
    }

    const directions = new Set(contributors.map((each) => each.direction));
    if (directions.size > 1) {
      unconcluded.push({
        subjectKind: bucket.subjectKind,
        subjectLabel: bucket.subjectLabel,
        reason: 'contested-directions',
        contributors,
        explanation: 'Producers disagree about the direction.',
      });
      continue;
    }

    // ⚠️ Read from the contributors, 🚫 never from a clock.
    const asOf = contributors
      .map((each) => each.observedAt)
      .reduce((latest, each) => (Date.parse(each) > Date.parse(latest) ? each : latest));

    conclusions.push({
      rule: CONVERGENT_DIRECTION_RULE,
      subjectKind: bucket.subjectKind,
      subjectLabel: bucket.subjectLabel,
      direction: first.direction,
      producerCount: producers.size,
      contributors,
      asOf,
      limitation: NOT_A_MEASUREMENT,
    });
  }

  const spokenFor = new Set(
    [...conclusions, ...unconcluded].map((each) => `${each.subjectKind}::${each.subjectLabel}`),
  );

  const unobservedSubjects: UnobservedSubject[] = derivation.subjects
    .filter((subject) => !spokenFor.has(`${subject.subjectKind}::${subject.label}`))
    .map((subject) => ({
      subjectKind: subject.subjectKind,
      subjectLabel: subject.label,
      state: 'no-observation-relayed' as const,
    }));

  const unmodelledKinds: UnmodelledKind[] = [];
  for (const kind of derivation.kinds) {
    // ⚠️ The two non-`derived` states are carried through UNCHANGED: one means
    // AGE never looked, the other means AGE looked and holds nothing. 🚫 Do not
    // collapse them here — no screen downstream can reconstruct the difference.
    if (kind.state === 'derived') continue;
    unmodelledKinds.push({ subjectKind: kind.subjectKind, state: kind.state });
  }

  return {
    bifId: derivation.bifId,
    conclusions,
    unconcluded,
    unobservedSubjects,
    unmodelledKinds,
    unrelated,
    persistence: 'computed-projection-not-stored',
  };
}
