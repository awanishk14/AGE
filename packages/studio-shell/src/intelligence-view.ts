import type {
  ContextReadinessEntry,
  ContextReadinessReport,
} from '@age/demo-runtime/context-readiness';

import type { EpistemicState } from './epistemic-state';

/**
 * The Intelligence screen: what each capability would need, and what none of
 * them has produced.
 *
 * ⚠️ THE AREA'S QUESTION HAS TWO HALVES AND ONLY ONE OF THEM HAS AN ANSWER.
 * "What did the capabilities produce, and were they ready to run?" The second
 * half is real and computable today: three of the six capabilities publish an
 * ADR-0027 readiness assessment, and each one runs over the `ScoredBifContext`
 * this console already produces from the answer file it wrote. The first half
 * has no answer at all — no capability has been given a real client, so nothing
 * has been produced. 🚫 The screen must never let the half it can answer stand
 * in for the half it cannot.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ READINESS IS NOT PRODUCTION, AND THIS IS THE CONFUSION THE SCREEN EXISTS TO
 * PREVENT. A capability reporting `ready` has produced NOTHING. It has stated
 * that the captured context carries it far enough to run, and nothing has run.
 * 🚫 A `ready` row is never rendered as an accomplishment, never as a result,
 * and never beside a count of outputs — because there are no outputs.
 *
 * ⚠️ THE SECOND CONFUSION: THREE CAPABILITIES DECLARE NO READINESS AT ALL.
 * Growth, Authority and Operations publish no assessment and no required
 * section set. That is a property THEY declare about themselves, not a verdict
 * about this business. 🚫 They are therefore `not-assessed` — never "not ready",
 * never a zero, never a blank cell, and never a low score. Rendering a
 * non-adopter as unready would turn "this capability has never said what it
 * needs" into "this business does not have what it needs", which is a statement
 * about the client that nothing computed.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🚫 NO AGGREGATE OF ANY KIND, and this is binding prose from ADR-0047 D4 rather
 * than a preference. The three assessments differ in DENOMINATOR, not merely in
 * threshold: Market Discovery and Revenue each require a different set of BIF
 * sections, and Intelligence declares no required set and judges whatever is
 * present. So there is no scale in which "2 of 3 ready", an overall percentage,
 * a badge, a progress bar or a "most ready" could be expressed. Any number that
 * is a function of more than one capability's readiness invents the shared scale
 * three ADRs went out of their way not to create.
 *
 * 🚫 Rows are emitted in the report's FIXED registry order and are never sorted,
 * grouped or reordered by state. Ordering by state is itself a ranking, and
 * ADR-0027 D1 forbids a readiness surface to rank or shortlist.
 *
 * ⚠️ THE ONE IMPLEMENTATION RULE. `buildContextReadinessReport` is NOT
 * reimplemented here. It is imported through the `@age/demo-runtime/context-readiness`
 * subpath — the same technique as `@age/capture/composition` — precisely so the
 * console and the CLI cannot drift. A second normalizer would be the surface
 * nobody runs `pnpm demo` against, and the drifted one is always the one that
 * ships a falsehood. 🚫 Do not import `@age/demo-runtime` bare from the console:
 * its index also exports `runAllCapabilities` and the demo fixtures, and neither
 * belongs anywhere near a real business.
 */

/** One published threshold, as a label and its number. */
export interface ReadinessThresholdView {
  readonly label: string;
  readonly value: number;
}

/**
 * One capability's row.
 *
 * ⚠️ `state` describes THE ASSESSMENT, not the business. `known` means a named
 * assessor with published thresholds reached a verdict over a context AGE really
 * built — the verdict is attributable. 🚫 It is emphatically not a claim that
 * the underlying BIF fields are verified; they are `unattributed`, as the
 * Evidence screen reports, and a readiness verdict over unattributed input is
 * still an honest verdict about the capture.
 */
export interface CapabilityReadinessRowView {
  readonly capabilityName: string;
  readonly declaration: string;
  readonly state: EpistemicState;
  /** The assessor's own sufficiency state, verbatim. Adopters only. */
  readonly assessedState?: string;
  /** Why there is no assessment. Non-adopters only, and always present for them. */
  readonly notAssessedBecause?: string;
  readonly reasons: readonly string[];
  readonly limitations: readonly string[];
  readonly improvementHints: readonly string[];
  /** This capability's OWN denominator. Absent where it declares none. */
  readonly requiredSectionTypes?: readonly string[];
  /** The denominator in words, so the row is readable without the ADRs. */
  readonly denominator?: string;
  /** This capability's OWN published thresholds. Never another's. */
  readonly thresholds: readonly ReadinessThresholdView[];
  readonly assessesContext?: readonly string[];
}

/**
 * Something the console has NOT looked at.
 *
 * ⚠️ `not-assessed`, never zero and never "none".
 */
export interface IntelligenceNotAssessedFacet {
  readonly label: string;
  readonly state: 'not-assessed';
  readonly detail: string;
}

export interface CapabilityReadinessView {
  /**
   * The incommensurability, carried through verbatim from the report and shown
   * ON the surface (ADR-0047 D4). 🚫 Not a footnote and not a tooltip: without
   * it, three states in one list read as a scale.
   */
  readonly incommensurabilityNotice: readonly string[];
  readonly rows: readonly CapabilityReadinessRowView[];
  readonly notAssessed: readonly IntelligenceNotAssessedFacet[];
}

/**
 * Why a capability carries no readiness state.
 *
 * ⚠️ Phrased about the CAPABILITY, never about the business. The distinction is
 * the whole point: a non-adopter has not judged this client and found it
 * wanting; it has never published a judgement of any kind.
 */
const NON_ADOPTER_REASON =
  'This capability publishes no readiness assessment and declares no required BIF sections. ' +
  'Nothing has judged whether the captured context carries it, so this is not "not ready" — ' +
  'it is a property this capability declares about itself, and it says nothing about this business.';

/**
 * Render a threshold object as label/value pairs.
 *
 * ⚠️ Each adopter publishes a differently-SHAPED threshold set, because each
 * judges a different denominator. 🚫 The pairs are read off whichever object
 * this capability published and are never normalized to a common set of keys —
 * flattening them would assert a shared shape they do not have, which is the
 * comparison ADR-0027 D2 refused.
 */
function thresholdsOf(entry: ContextReadinessEntry): readonly ReadinessThresholdView[] {
  if (entry.thresholds === undefined) {
    return Object.freeze([]);
  }

  return Object.freeze(
    Object.entries(entry.thresholds)
      .filter((pair): pair is [string, number] => typeof pair[1] === 'number')
      .map(([label, value]) => Object.freeze({ label, value })),
  );
}

function rowOf(entry: ContextReadinessEntry): CapabilityReadinessRowView {
  // ⚠️ Adoption is decided by whether the capability published a state, not by a
  // hard-coded list of the three adopters. 🚫 A name list here would silently
  // mis-report the next capability that adopts the pattern — and it would
  // mis-report it as unassessed while it was really assessing.
  const assessed = entry.state !== undefined;

  return Object.freeze({
    capabilityName: entry.capabilityName,
    declaration: entry.declaration,
    state: (assessed ? 'known' : 'not-assessed') as EpistemicState,
    ...(assessed ? { assessedState: entry.state } : { notAssessedBecause: NON_ADOPTER_REASON }),
    // 🚫 Carried through unsuppressed. An assessor's reasons are the only thing
    // that makes its state readable, and a state shown without them is a verdict
    // with the argument removed.
    reasons: Object.freeze([...(entry.reasons ?? [])]),
    limitations: Object.freeze([...(entry.limitations ?? [])]),
    improvementHints: Object.freeze([...(entry.improvementHints ?? [])]),
    ...(entry.requiredSectionTypes === undefined
      ? {}
      : { requiredSectionTypes: Object.freeze([...entry.requiredSectionTypes]) }),
    ...(entry.denominator === undefined ? {} : { denominator: entry.denominator }),
    thresholds: thresholdsOf(entry),
    ...(entry.assessesContext === undefined
      ? {}
      : { assessesContext: Object.freeze([...entry.assessesContext]) }),
  });
}

/**
 * Present the readiness of every capability over a context the console produced.
 *
 * ⚠️ The report is the single argument and there is no default. This function
 * recomputes nothing and re-judges nothing: it carries each assessor's own
 * verdict, own reasons, own thresholds and own denominator through to the
 * screen. 🚫 A view that re-derived any of them would be a second opinion about
 * a settled fact, and a second opinion can disagree.
 */
export function presentCapabilityReadiness(
  report: ContextReadinessReport,
): CapabilityReadinessView {
  return Object.freeze({
    incommensurabilityNotice: Object.freeze([...report.incommensurabilityNotice]),
    // 🚫 `.map` over the report's own order — never `.sort`, never `.filter`.
    rows: Object.freeze(report.entries.map(rowOf)),
    notAssessed: intelligenceNotAssessedFacets(),
  });
}

/**
 * What the console has never looked at on this screen, and why.
 *
 * ⚠️ The first facet is the important one, and it is the half of the area's
 * question that has no answer. 🚫 None of these is a "coming soon": running a
 * capability against a real business is not merely unimplemented here, it is a
 * decision that has not been taken.
 */
export function intelligenceNotAssessedFacets(): readonly IntelligenceNotAssessedFacet[] {
  return Object.freeze([
    Object.freeze({
      label: 'What the capabilities produced',
      state: 'not-assessed' as const,
      detail:
        'No capability has been run for this business. The six capabilities produce output only in ' +
        'the demo scenario, which is a fixed fixture and says nothing about any client. This is not ' +
        '"they ran and found nothing" — nothing has run at all, so there is nothing here to report.',
    }),
    Object.freeze({
      label: 'Readiness of a stored BIF',
      state: 'not-assessed' as const,
      detail:
        'The readiness below was assessed against a BIF produced in memory from the answer file, ' +
        'and discarded. Nothing has read the capture store, so no stored context has ever been ' +
        'assessed and no readiness has ever been recorded.',
    }),
    Object.freeze({
      label: 'Whether readiness has changed',
      state: 'not-assessed' as const,
      detail:
        'Nothing has assessed this business before, so there is nothing to compare against. This is ' +
        'not "readiness is unchanged" — there is no earlier assessment in existence.',
    }),
  ]);
}
