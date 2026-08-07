import type { EvidenceView, NamedEvidenceView } from './evidence-view';

/**
 * S7 — Contradictions. "Where does AGE disagree with itself?"
 *
 * 🚫 THE DETECTOR IS NOT IMPORTED HERE AND MUST NEVER BE.
 *
 * ⚠️ THIS IS THE MOST DANGEROUS SCREEN IN THE CONSOLE, and the danger is the
 * opposite of the usual one. `detectContradictions` EXISTS and WORKS. It would
 * run without error. It would return an empty set. Rendering that empty set as
 * "no contradictions found" turns *"AGE has never looked"* into *"AGE checked
 * this business and it is consistent"* — a sentence about a real business that
 * nothing supports. 🚫 That sentence must never be printed.
 *
 * ⚠️ The reason the detector returns nothing is not a bug and not a gap in this
 * screen. It takes `Evidence` records, and AGE holds none: discovery records a
 * source as TEXT attached to nothing (see `evidence-view.ts` — every named
 * source is `unattributed`). An empty input is why the answer is empty.
 *
 * So the screen reports the detector's OWN preconditions against what the
 * answer file actually yields, and states plainly that it did not run. The
 * state is `not-assessed` — never a zero, never "none", never "all clear".
 */

/** One precondition `detectContradictions` requires of its input. */
export interface ContradictionPreconditionView {
  /** What the detector requires, phrased as the algorithm requires it. */
  readonly requirement: string;
  /** What the captured material actually provides. */
  readonly observed: string;
  /**
   * ⚠️ Three-valued on purpose. `unmet` is a measured shortfall; `unevaluable`
   * is a precondition that cannot even be checked because an earlier one failed
   * — 🚫 collapsing them would present "we could not look" as "we looked".
   */
  readonly status: 'met' | 'unmet' | 'unevaluable';
}

/** Something this screen has NOT looked at, and why. */
export interface ContradictionsNotAssessedFacet {
  readonly facet: string;
  readonly because: string;
  readonly state: 'not-assessed';
}

export interface ContradictionsView {
  /**
   * Named sources the capture recorded, counted from the evidence account.
   * 🚫 NOT a count of contradiction inputs — see `signalCarryingSourceCount`.
   */
  readonly namedSourceCount: number;
  /**
   * How many of those carry what the detector reads: an extracted signal with a
   * polarity, and a linked entity. ⚠️ Derived from the recorded sources, not
   * asserted — see `carriesDetectableSignal`.
   */
  readonly signalCarryingSourceCount: number;
  readonly preconditions: readonly ContradictionPreconditionView[];
  /**
   * 🚫 The only value this field may ever take while the detector's input is
   * empty. A `'consistent'` member does not exist in this union, so no future
   * edit can render one by accident.
   */
  readonly outcome: 'not-run';
  readonly outcomeBecause: string;
  readonly notAssessed: readonly ContradictionsNotAssessedFacet[];
}

/**
 * Does this recorded source carry what `detectContradictions` reads?
 *
 * ⚠️ Derived, not hard-coded to `false`. The detector needs an extracted signal
 * (a `targetField` and a polarity) AND an entity link. A `NamedEvidenceView`
 * carries an id, a label, a kind, an optional locator and the state
 * `unattributed` — none of those is either of them. If evidence ever gains a
 * signal, this predicate is where it becomes visible, and `contradictions-view`
 * must then be rewritten rather than quietly starting to report results.
 */
function carriesDetectableSignal(source: NamedEvidenceView): boolean {
  const carrier = source as NamedEvidenceView & {
    readonly extractedSignals?: readonly unknown[];
    readonly entityLinked?: unknown;
  };
  return (carrier.extractedSignals?.length ?? 0) > 0 && carrier.entityLinked !== undefined;
}

const NOT_ASSESSED_FACETS: readonly ContradictionsNotAssessedFacet[] = Object.freeze([
  Object.freeze({
    facet: 'Whether this business contradicts itself',
    because:
      'The detector was not run. It compares evidence records, and none exist for this business, ' +
      'so its answer would be empty for a reason that has nothing to do with the business.',
    state: 'not-assessed' as const,
  }),
  Object.freeze({
    facet: 'Disagreement between two capture runs',
    because:
      'Nothing has read the capture store, so there is no earlier run to compare this one against.',
    state: 'not-assessed' as const,
  }),
  Object.freeze({
    facet: 'Disagreement between what the client said and an outside source',
    because:
      'No outside source has been retrieved or contacted. That is refused, not pending, so there ' +
      'is no second account to disagree with.',
    state: 'not-assessed' as const,
  }),
]);

/**
 * Report why AGE cannot yet say whether it disagrees with itself.
 *
 * ⚠️ Takes the evidence account rather than recomputing anything — a second
 * answer to an answered question is a second answer that can disagree.
 */
export function presentContradictions(evidence: EvidenceView): ContradictionsView {
  const namedSourceCount = evidence.namedEvidence.length;
  const signalCarryingSourceCount = evidence.namedEvidence.filter(carriesDetectableSignal).length;
  const comparable = signalCarryingSourceCount >= 2;

  const preconditions: readonly ContradictionPreconditionView[] = Object.freeze([
    Object.freeze({
      requirement:
        'Evidence records carrying an extracted signal — a target field and a polarity, positive ' +
        'or negative.',
      observed:
        signalCarryingSourceCount === 0
          ? `${namedSourceCount} source${namedSourceCount === 1 ? '' : 's'} recorded, none carrying a signal. ` +
            'Discovery records a source as text; nothing extracts a polarity from it.'
          : `${signalCarryingSourceCount} of ${namedSourceCount} recorded sources carry a signal.`,
      status: signalCarryingSourceCount > 0 ? ('met' as const) : ('unmet' as const),
    }),
    Object.freeze({
      requirement:
        'Each record linked to an entity — an organization, product, competitor or market id. Two ' +
        'records about different entities are never compared.',
      observed:
        signalCarryingSourceCount === 0
          ? 'Not reached. A recorded source is attached to no entity; it is attached to nothing at all.'
          : `${signalCarryingSourceCount} linked records available to compare.`,
      status: signalCarryingSourceCount > 0 ? ('met' as const) : ('unmet' as const),
    }),
    Object.freeze({
      requirement:
        'At least two records sharing a signal type and an entity, so that a comparison has two ' +
        'sides.',
      observed: comparable
        ? `${signalCarryingSourceCount} records could be paired.`
        : 'Cannot be checked: there are no signal-carrying records to pair.',
      status: comparable ? ('met' as const) : ('unevaluable' as const),
    }),
    Object.freeze({
      requirement:
        'Two paired records opposing on the same target field — one positive, one negative. That ' +
        'opposition is what a contradiction IS.',
      observed: comparable
        ? 'Would be checked by the detector.'
        : 'Cannot be checked: nothing was paired.',
      status: comparable ? ('met' as const) : ('unevaluable' as const),
    }),
  ]);

  return {
    namedSourceCount,
    signalCarryingSourceCount,
    preconditions,
    outcome: 'not-run',
    outcomeBecause:
      'The detector was deliberately not run. Over an empty set of evidence records it returns an ' +
      'empty set, and an empty result shown here would be read as a clean bill of health for this ' +
      'business. Nothing about this business has been checked. Those are different statements, and ' +
      'the screen will not make the stronger one.',
    notAssessed: NOT_ASSESSED_FACETS,
  };
}
