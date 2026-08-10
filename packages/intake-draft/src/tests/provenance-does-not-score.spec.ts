import {
  DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  STATED_ANSWER_PROVENANCE,
  buildProfileFromAnswers,
  calculateBusinessDiscoveryCompleteness,
  getEvidencedFieldPaths,
  produceScoredBifContext,
  type AnswerProvenance,
  type DiscoveryAnswer,
} from '@age/business-discovery-contracts';
import { describe, expect, it } from 'vitest';

import { draftAnswers, emptyIntakeDraft, recordAnswerInDraft } from '../index';

/**
 * **AGE-INV-PROV-1 STILL HOLDS THROUGH THE DRAFT** (ADR-0066 §0.3c, on the same
 * footing as OX-INV-1): identical profile facts with different provenance MUST
 * produce **byte-identical scoring and BIF results**.
 *
 * ⚠️ Slice 2 proved this for answers handed straight to the mapper. This slice
 * introduces a new road into the mapper — the draft — and 🚫 a new road is
 * exactly how an invariant quietly stops holding. The draft is where provenance
 * may **live**; it is 🚫 not a place where provenance may start to **count**.
 *
 * ⚠️ **THE ONLY PERMITTED SENTENCE IS "Provenance alone never changes a score."**
 * 🚫 Never *"a document can never raise a score"* — §0.3a forbids that wording by
 * name. A future ADR may decide a source's **content** is evidence, explicitly.
 *
 * ⚠️ Every fixture is DELIBERATELY FICTIONAL (ADR-0053 D3, ADR-0065 D1).
 */

const OPTIONS = { id: 'profile-1', capturedAt: '2026-01-01T00:00:00.000Z' } as const;

const BIF_OPTIONS = {
  organizationId: 'org-fixture',
  constructedAt: new Date('2026-01-01T00:00:00.000Z'),
  changedBy: 'operator@example.invalid',
} as const;

const CONFIRMED: AnswerProvenance = {
  kind: 'confirmed-from-source',
  sourceId: 'src-fictional-brief',
  locator: 'Fictional onboarding brief (page 2)',
  confirmedBy: 'operator:fictional',
};

const SIGNAL_QUESTIONS = DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE.sections.flatMap((section) =>
  section.questions.filter((question) => question.satisfiedBy !== undefined),
);

function questionIdFor(signal: string): string {
  const question = SIGNAL_QUESTIONS.find((candidate) => candidate.satisfiedBy === signal);

  // ⚠️ Fail loudly rather than build an answer set for a question that does not
  // exist — that would test nothing and report success.
  expect(question, `default questionnaire must carry a question for ${signal}`).toBeDefined();

  return question!.id;
}

function answer(
  signal: string,
  value: string | readonly string[],
  provenance: AnswerProvenance,
): DiscoveryAnswer {
  return { questionId: questionIdFor(signal), value, provenance };
}

/** The same facts twice: all stated, and the same answers half confirmed. */
function answerSet(mixed: boolean): readonly DiscoveryAnswer[] {
  const other = mixed ? CONFIRMED : STATED_ANSWER_PROVENANCE;

  return [
    answer('businessName', 'Fictional Kite Repairs', other),
    answer('industry', 'Leisure equipment repair', STATED_ANSWER_PROVENANCE),
    answer('businessModel', 'Business to business', other),
    answer('brandPositioning', 'The coast’s dependable repairer', other),
    answer('geographies', ['Northern coast', 'Southern coast'], other),
    answer('marketingChannels', ['School fairs', 'Email'], STATED_ANSWER_PROVENANCE),
    answer('segments', ['Coastal schools'], other),
    answer('competitors', ['Fictional Sail Menders'], other),
    answer('goals', ['Open a second workshop'], STATED_ANSWER_PROVENANCE),
    answer('constraints', ['One repair bench'], other),
    answer('assets', ['A ten-year repair log'], other),
  ];
}

/** Records an answer set into a draft, then hands it through the ONE door. */
function answersViaDraft(mixed: boolean): readonly DiscoveryAnswer[] {
  return draftAnswers(
    answerSet(mixed).reduce(
      (draft, entry) => recordAnswerInDraft(draft, entry),
      emptyIntakeDraft(),
    ),
  );
}

const STATED_PROFILE = buildProfileFromAnswers(
  answersViaDraft(false),
  DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  OPTIONS,
);
const MIXED_PROFILE = buildProfileFromAnswers(
  answersViaDraft(true),
  DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  OPTIONS,
);

describe('AGE-INV-PROV-1 holds through the draft', () => {
  it('the two draft answer sets really do differ in provenance', () => {
    // ⚠️ Sentinel FIRST. Every equality below would pass trivially if the two
    // sets were the same answers, and the suite would report an invariant it
    // never exercised.
    const stated = answersViaDraft(false);
    const mixed = answersViaDraft(true);

    expect(stated).toHaveLength(mixed.length);
    expect(JSON.stringify(stated)).not.toEqual(JSON.stringify(mixed));
    expect(mixed.some((entry) => entry.provenance.kind === 'confirmed-from-source')).toBe(true);
    expect(stated.every((entry) => entry.provenance.kind === 'stated')).toBe(true);
  });

  it('the draft hands the mapper plain answers — no draft type escapes', () => {
    expect(answersViaDraft(true)).toEqual(answerSet(true));
  });

  it('produces byte-identical completeness scores', () => {
    expect(JSON.stringify(calculateBusinessDiscoveryCompleteness(MIXED_PROFILE))).toEqual(
      JSON.stringify(calculateBusinessDiscoveryCompleteness(STATED_PROFILE)),
    );
  });

  it('produces byte-identical scored BIF contexts', () => {
    expect(JSON.stringify(produceScoredBifContext(MIXED_PROFILE, BIF_OPTIONS))).toEqual(
      JSON.stringify(produceScoredBifContext(STATED_PROFILE, BIF_OPTIONS)),
    );
  });

  it('🚫 a confirmed answer recorded in a draft creates no evidence', () => {
    // ⚠️ `fieldEvidence` IS NOT INERT — it is read by completeness scoring and by
    // the BIF mapper. Provenance leaking into it would move the pinned baseline.
    // 🚫 A client-typed answer is NOT less trustworthy for having no document
    // behind it: extraction does not promote, and typing does not demote.
    expect(getEvidencedFieldPaths(MIXED_PROFILE)).toEqual([]);
    expect(getEvidencedFieldPaths(STATED_PROFILE)).toEqual([]);
  });
});
