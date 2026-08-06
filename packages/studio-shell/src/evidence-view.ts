import { FieldConfidence } from '@age/bif';
import type {
  BusinessDiscoveryBifMetadata,
  BusinessDiscoveryProfile,
  BusinessDiscoveryQuestionnaire,
  ScoredBifContext,
} from '@age/business-discovery-contracts';

import type { BifUnmappedFieldView } from './bif-view';
import { renderFieldValue } from './bif-view';
import type { EpistemicState } from './epistemic-state';

/**
 * The Evidence screen: what supports each belief, and which beliefs are
 * unsupported.
 *
 * ⚠️ THIS SCREEN EXISTS TO REPORT A SHORTFALL, NOT TO FILL ONE. Everything it
 * shows comes from the answer file the console already wrote and the BIF the
 * console already produced. 🚫 It attaches no file, fetches no URL, contacts
 * nothing external and verifies nothing — all of those are class 3 under
 * ADR-0057 D4, and two of them are class 3 twice over because nothing outside
 * AGE may be touched at all.
 *
 * ⚠️ THE ONE CONFUSION IT MUST PREVENT: naming evidence is not having evidence.
 * `ev-documents`, `ev-urls` and `ev-statements` record REFERENCES the operator
 * typed — a title, an address, a remembered remark. AGE has not opened any of
 * them, and nothing has checked that they say what the answers claim. 🚫 A named
 * source therefore never promotes a field to `known`: only independently
 * verified evidence is `known`, and a business's own account of itself stays
 * `unattributed` no matter how many documents are listed beside it.
 *
 * ⚠️ THE SECOND, SHARPER FACT — and it is the point of the screen.
 * `buildProfileFromAnswers` deliberately writes NO `fieldEvidence`: the
 * questionnaire captures evidence for the capture as a whole, and nothing in it
 * says which source backs which field. So the sources are recorded, the beliefs
 * are recorded, and NOTHING CONNECTS THEM. The screen reports that plainly
 * rather than implying a link the data does not contain — inferring one would be
 * exactly the fabricated provenance the mapper refuses to produce (ADR-0050 D2).
 */

/**
 * A source the operator named.
 *
 * ⚠️ `state` is `unattributed` and there is no other possible value here. It was
 * asserted, by the business or by the operator, and not checked by anything.
 * 🚫 A `locator` is a plain reference string; it is never fetched, and the screen
 * shows it as text rather than as a link so that no press can turn it into a
 * retrieval.
 */
export interface NamedEvidenceView {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly state: 'unattributed';
  readonly locator?: string;
}

/**
 * An answer no structured profile field carries.
 *
 * ⚠️ Recorded, never lost, and never reasoned over. `ev-assumptions` is the one
 * that matters most: `buildProfileFromAnswers` leaves `profile.assumptions`
 * empty on purpose, because reading an assumption out of prose is inference. So
 * the operator's words are here, and AGE holds no assumption objects at all.
 */
export interface RecordedAnswerView {
  readonly questionId: string;
  readonly prompt: string;
  readonly value: string;
}

/** One BIF field, and whether anything independent supports it. */
export interface BeliefSupportView {
  readonly sectionName: string;
  readonly fieldKey: string;
  readonly state: EpistemicState;
  readonly confidence: string;
  readonly source: string;
}

/**
 * Something the console has NOT looked at.
 *
 * ⚠️ `not-assessed`, never zero and never "none". An unlooked-at absence
 * rendered as a measured zero is the failure `17_DESIGN_SYSTEM.md` §0.1 forbids
 * by name, and it is the same error as defaulting `sufficiency` to `ready`.
 */
export interface EvidenceNotAssessedFacet {
  readonly label: string;
  readonly state: 'not-assessed';
  readonly detail: string;
}

export interface EvidenceView {
  readonly namedEvidence: readonly NamedEvidenceView[];
  readonly recordedAnswers: readonly RecordedAnswerView[];
  readonly supportedBeliefs: readonly BeliefSupportView[];
  readonly unsupportedBeliefs: readonly BeliefSupportView[];
  /**
   * Profile field paths that cite a source, from the mapper's own provenance
   * summary. 🚫 Not recomputed here — a second answer to an answered question is
   * a second answer that can disagree.
   */
  readonly citedFieldPaths: readonly string[];
  /** Captured material no BIF field carries, reported by the mapper. */
  readonly unmappedFields: readonly BifUnmappedFieldView[];
  readonly notAssessed: readonly EvidenceNotAssessedFacet[];
}

/**
 * Which answered questions no profile signal carries.
 *
 * ⚠️ Derived from the questionnaire's `satisfiedBy`, not from a list of question
 * ids. 🚫 Hard-coding `ev-assumptions` here would silently stop reporting the
 * next question added without a signal, and the screen would then imply AGE
 * structured something it did not.
 */
function recordedAnswersOf(
  profile: BusinessDiscoveryProfile,
  questionnaire: BusinessDiscoveryQuestionnaire,
): readonly RecordedAnswerView[] {
  const unsignalled = new Map<string, string>();
  for (const section of questionnaire.sections) {
    for (const question of section.questions) {
      if (question.satisfiedBy === undefined) {
        unsignalled.set(question.id, question.prompt);
      }
    }
  }

  return profile.sections.flatMap((section) =>
    section.answers.flatMap((answer) => {
      const prompt = unsignalled.get(answer.questionId);
      if (prompt === undefined) {
        return [];
      }
      return [
        Object.freeze({
          questionId: answer.questionId,
          prompt,
          value: renderFieldValue(answer.value),
        }),
      ];
    }),
  );
}

/**
 * Assemble the evidence ledger for a produced BIF.
 *
 * ⚠️ Every argument is required and none has a default. The profile holds the
 * sources, the context holds the beliefs and the metadata holds the mapper's own
 * account of what it could not carry; a view that reconstructed any of them
 * would be a second opinion about a settled fact.
 */
export function presentEvidence(
  profile: BusinessDiscoveryProfile,
  context: ScoredBifContext,
  mappingMetadata: BusinessDiscoveryBifMetadata,
  questionnaire: BusinessDiscoveryQuestionnaire,
): EvidenceView {
  const beliefs = context.sections.flatMap((section) =>
    section.fields.map((field) =>
      Object.freeze({
        sectionName: section.name,
        fieldKey: field.key,
        // 🚫 The SAME rule as the BIF screen, not a second one: `known` requires
        // `EVIDENCE_VERIFIED` and nothing else earns it.
        state: (String(field.confidence) === FieldConfidence.EVIDENCE_VERIFIED
          ? 'known'
          : 'unattributed') as EpistemicState,
        confidence: String(field.confidence),
        source: String(field.source),
      }),
    ),
  );

  return Object.freeze({
    namedEvidence: profile.evidenceSources.map((source) =>
      Object.freeze({
        id: source.id,
        label: source.label,
        kind: String(source.kind),
        state: 'unattributed' as const,
        ...(source.locator === undefined ? {} : { locator: source.locator }),
      }),
    ),
    recordedAnswers: recordedAnswersOf(profile, questionnaire),
    supportedBeliefs: beliefs.filter((belief) => belief.state === 'known'),
    unsupportedBeliefs: beliefs.filter((belief) => belief.state !== 'known'),
    citedFieldPaths: [...mappingMetadata.provenanceSummary.evidencedDiscoveryFieldPaths],
    unmappedFields: mappingMetadata.unmappedDiscoveryFields.map((entry) =>
      Object.freeze({ field: entry.field, reason: entry.reason }),
    ),
    notAssessed: evidenceNotAssessedFacets(),
  });
}

/**
 * What the console has never looked at, and why it will not.
 *
 * ⚠️ These are permanent statements of scope for the first two and a blocked
 * state for the third. 🚫 None of them is a "coming soon": external retrieval is
 * REFUSED under ADR-0057 D4 class 3, not deferred.
 */
export function evidenceNotAssessedFacets(): readonly EvidenceNotAssessedFacet[] {
  return Object.freeze([
    Object.freeze({
      label: 'External verification',
      state: 'not-assessed' as const,
      detail:
        'AGE has not opened a document, fetched a web reference or contacted any external system. ' +
        'Anything that changes or reads outside AGE is refused, not postponed, so no listed source ' +
        'has been checked against the world.',
    }),
    Object.freeze({
      label: 'Which source backs which belief',
      state: 'not-assessed' as const,
      detail:
        'The questionnaire records evidence for the capture as a whole and never asks which source ' +
        'backs which field. AGE does not guess the link, so no belief below can be traced to a ' +
        'source above.',
    }),
    Object.freeze({
      label: 'Stored evidence history',
      state: 'not-assessed' as const,
      detail:
        'Nothing has read the capture store. This is not "no evidence was ever recorded" — it is ' +
        'that nothing has looked.',
    }),
  ]);
}
