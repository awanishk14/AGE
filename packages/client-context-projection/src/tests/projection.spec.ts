import {
  DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  STATED_ANSWER_PROVENANCE,
  buildProfileFromAnswers,
  produceScoredBifContext,
  type DiscoveryAnswer,
} from '@age/business-discovery-contracts';
import { OBSERVATION_SUBJECT_KINDS } from '@age/source-observation';
import { describe, expect, it } from 'vitest';

import { projectClientContext } from '../projection';

/**
 * ⚠️ WHAT THESE PROVE: that the projection a peer receives says which category
 * it came from, names every subject kind whether or not AGE holds one, and
 * carries no number a consumer could gate on.
 *
 * ⚠️ The context is built by the REAL chain, 🚫 not hand-written — a fixture
 * shaped by hand would let the projection pass over a context the pipeline
 * never produces.
 *
 * 🚫 Every fixture is obviously fictional (ADR-0053 D3, ADR-0065 D1).
 */

const ASOF = '2026-01-02T00:00:00.000Z';

function contextFrom(answers: readonly DiscoveryAnswer[]) {
  const profile = buildProfileFromAnswers(answers, DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE, {
    id: 'profile-fictional',
    capturedAt: '2026-01-01T00:00:00.000Z',
  });

  return produceScoredBifContext(profile, {
    organizationId: 'org-fictional-1',
    constructedAt: new Date('2026-01-01T00:00:00.000Z'),
    changedBy: 'operator:fictional',
    bifId: 'bif-fictional',
    questionnaire: DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  }).context;
}

const NAMED_ONLY: readonly DiscoveryAnswer[] = [
  { questionId: 'bi-name', value: 'Fictional Kite Repair', provenance: STATED_ANSWER_PROVENANCE },
];

describe('projectClientContext', () => {
  it('🚫 omits no subject kind — a missing kind would read as an answer', () => {
    const projection = projectClientContext({ context: contextFrom(NAMED_ONLY), asOf: ASOF });

    expect(projection.subjectKinds.map((kind) => kind.subjectKind)).toEqual([
      ...OBSERVATION_SUBJECT_KINDS,
    ]);
    // 🛑 Each carries its OWN reason, never a blank or a shared sentence.
    for (const kind of projection.subjectKinds) {
      expect(kind.because.length, kind.subjectKind).toBeGreaterThan(0);
    }
  });

  it('🛑 keeps "never told" apart from "told, nothing recorded"', () => {
    const projection = projectClientContext({ context: contextFrom(NAMED_ONLY), asOf: ASOF });
    const states = new Set(projection.subjectKinds.map((kind) => kind.state));

    // ⚠️ Over a context this thin AGE was told almost nothing, so at least one
    // kind must be in a NAMED silent state rather than simply absent.
    expect(states.has('never-captured') || states.has('captured-nothing-recorded')).toBe(true);

    for (const kind of projection.subjectKinds) {
      if (kind.state === 'never-captured') {
        expect(kind.because).toContain('never told');
        // 🚫 "AGE has not looked" must never read as "AGE looked and found none".
        expect(kind.because.toLowerCase()).not.toContain('the business has none');
      }
      if (kind.state === 'captured-nothing-recorded') {
        expect(kind.because).toContain('not a statement that the business has none');
      }
    }
  });

  it('🚫 carries no score across the boundary', () => {
    const context = contextFrom(NAMED_ONLY);
    const projection = projectClientContext({ context, asOf: ASOF });
    // 🛑 THE KEY SET IS PINNED, not searched. A substring check missed
    // `bifCompletenessScore` when this guard was made to fail — the casing
    // differed — and a projection is exactly the wrong place to learn that a
    // field slipped through because a scan was spelled narrowly.
    expect(Object.keys(projection).sort()).toEqual([
      'asOf',
      'bifId',
      'notCaptured',
      'notices',
      'subjectKinds',
    ]);

    // ⚠️ The second check, and 🚫 not a repetition: the figures exist on the
    // context, so a nested one would still be a number a peer could gate on.
    const serialised = JSON.stringify(projection).toLowerCase();
    expect(serialised).not.toContain('completenessscore');
    expect(serialised).not.toContain('confidencescore');
    expect(projection.notices.join(' ')).toContain('No score is included');
  });

  it('says which of the three categories this is, so a consumer cannot guess', () => {
    const projection = projectClientContext({ context: contextFrom(NAMED_ONLY), asOf: ASOF });
    const notices = projection.notices.join(' ');

    expect(notices).toContain('what the business itself stated');
    expect(notices).toContain('not a conclusion AGE drew');
    // ⚠️ Admissibility is BY SUBJECT (D4), and the peer is told the rule.
    expect(notices).toContain('admissible only if it names a subject listed here');
  });

  it('⚠️ stamps the CAPTURE time, 🚫 never the time of projection', () => {
    const projection = projectClientContext({ context: contextFrom(NAMED_ONLY), asOf: ASOF });

    expect(projection.asOf).toBe(ASOF);
    // 🚫 No relative wording: "recently" ages into a lie the moment it is stored.
    for (const forbidden of ['ago', 'today', 'recently', 'current']) {
      expect(JSON.stringify(projection).toLowerCase(), forbidden).not.toContain(forbidden);
    }
  });

  it('🚫 names no peer product and no source system (D6)', () => {
    const serialised = JSON.stringify(
      projectClientContext({ context: contextFrom(NAMED_ONLY), asOf: ASOF }),
    ).toLowerCase();

    // 🛑 Source-neutral by shape: the projection is the same answer whoever asks.
    for (const named of ['rankops', 'snara', 'humantik', 'ads', 'content intelligence']) {
      expect(serialised, named).not.toContain(named);
    }
  });

  it('carries the sections AGE holds nothing for, as limitations', () => {
    const context = contextFrom(NAMED_ONLY);
    const projection = projectClientContext({ context, asOf: ASOF });

    expect(projection.notCaptured).toEqual(context.omittedSections.map((each) => each.type));
    expect(projection.notCaptured.length).toBeGreaterThan(0);
  });
});
