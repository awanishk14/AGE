import {
  DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  STATED_ANSWER_PROVENANCE,
  buildProfileFromAnswers,
  produceScoredBifContext,
  type DiscoveryAnswer,
} from '@age/business-discovery-contracts';
import { projectClientContext } from '@age/client-context-projection';
import { describe, expect, it } from 'vitest';

import {
  HOW_THIS_REACHES_A_PEER_NOTICE,
  presentClientContextProjection,
} from '../client-context-projection-view';

/**
 * ⚠️ WHAT THESE PROVE: that the operator is shown the PEER'S OWN ANSWER rather
 * than a console rendering of it — every string byte-identical to the
 * projection's — and that the screen states plainly that no peer can ask yet.
 *
 * ⚠️ The projection is produced by the REAL chain, 🚫 not hand-written: a
 * hand-shaped fixture would let this view pass over a projection
 * `projectClientContext` never produces, which is precisely the drift these
 * tests exist to catch.
 *
 * 🚫 Every fixture is obviously fictional (ADR-0053 D3, ADR-0065 D1).
 */

const ASOF = '2026-01-02T00:00:00.000Z';

const ANSWERS: readonly DiscoveryAnswer[] = [
  { questionId: 'bi-name', value: 'Fictional Kite Repair', provenance: STATED_ANSWER_PROVENANCE },
];

function projectionFixture() {
  const profile = buildProfileFromAnswers(ANSWERS, DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE, {
    id: 'profile-fictional',
    capturedAt: '2026-01-01T00:00:00.000Z',
  });

  const { context } = produceScoredBifContext(profile, {
    organizationId: 'org-fictional-1',
    constructedAt: new Date('2026-01-01T00:00:00.000Z'),
    changedBy: 'operator:fictional',
    bifId: 'bif-fictional',
    questionnaire: DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  });

  return projectClientContext({ context, asOf: ASOF });
}

describe('presentClientContextProjection', () => {
  it('🛑 shows the peer’s own answer — every carried string byte-identical', () => {
    const projection = projectionFixture();
    const view = presentClientContextProjection(projection);

    expect(view.bifId).toBe(projection.bifId);
    expect(view.asOf).toBe(projection.asOf);
    expect(view.notCaptured).toEqual([...projection.notCaptured]);
    // 🛑 The notices are what the answer is NOT. A screen that re-worded one
    // would be telling the operator a different thing from the peer.
    expect(view.notices).toEqual([...projection.notices]);

    expect(view.subjectKinds).toHaveLength(projection.subjectKinds.length);
    expect(view.subjectKinds.length).toBeGreaterThan(0);
    view.subjectKinds.forEach((kind, index) => {
      const source = projection.subjectKinds[index];
      if (source === undefined) {
        throw new Error(`the projection carried no kind at index ${String(index)}`);
      }
      expect(kind.subjectKind, 'order is the projection’s').toBe(source.subjectKind);
      expect(kind.state, source.subjectKind).toBe(source.state);
      expect(kind.because, source.subjectKind).toBe(source.because);
      expect(kind.labels, source.subjectKind).toEqual([...source.labels]);
      expect(kind.unreadableEntryCount, source.subjectKind).toBe(source.unreadableEntryCount);
    });
  });

  it('🛑 authors exactly ONE sentence of its own, and it is about AGE’s surface', () => {
    const projection = projectionFixture();
    const view = presentClientContextProjection(projection);

    // ⚠️ Counted, not eyeballed: every string the view emits is either carried
    // from the projection or is the one notice this module is allowed to author.
    const carried = new Set<string>([
      projection.bifId,
      projection.asOf,
      ...projection.notCaptured,
      ...projection.notices,
      ...projection.subjectKinds.flatMap((kind) => [
        kind.subjectKind,
        kind.state,
        kind.because,
        ...kind.labels,
      ]),
    ]);

    const emitted = [
      view.bifId,
      view.asOf,
      view.howThisReachesAPeerNotice,
      ...view.notCaptured,
      ...view.notices,
      ...view.subjectKinds.flatMap((kind) => [
        kind.subjectKind,
        kind.state,
        kind.because,
        ...kind.labels,
      ]),
    ];

    expect(emitted.length).toBeGreaterThan(1);
    const authored = emitted.filter((value) => !carried.has(value));
    expect(authored).toEqual([HOW_THIS_REACHES_A_PEER_NOTICE]);
  });

  it('🛑 says the OPERATOR carries it — 🚫 never that peers are being served', () => {
    const view = presentClientContextProjection(projectionFixture());

    expect(view.howThisReachesAPeerNotice).toBe(HOW_THIS_REACHES_A_PEER_NOTICE);
    expect(view.howThisReachesAPeerNotice).toContain('the operator is the transport');
    // 🛑 It says the peer's silence is a DECISION, 🚫 not a missing feature.
    expect(view.howThisReachesAPeerNotice).toContain('in V1 none is meant to');
    // ⚠️ ADR-0071 D2 — a constraint with an expiry, 🚫 never a principle.
    expect(view.howThisReachesAPeerNotice).toContain('not a permanent one');
    // 🚫 The gap is stated as a gap, not as a schedule — "coming soon" invites
    // an operator to wait rather than to read what is actually true today.
    for (const forbidden of ['coming soon', 'currently serving', 'peers receive']) {
      expect(view.howThisReachesAPeerNotice.toLowerCase(), forbidden).not.toContain(forbidden);
    }
  });

  it('🚫 adds no score, and 🚫 no field the projection does not have', () => {
    const view = presentClientContextProjection(projectionFixture());

    // 🛑 THE KEY SET IS PINNED, NOT SEARCHED — the same rule the projection's
    // own guard learned: a substring scan spelled narrowly misses a field.
    expect(Object.keys(view).sort()).toEqual([
      'asOf',
      'bifId',
      'howThisReachesAPeerNotice',
      'notCaptured',
      'notices',
      'subjectKinds',
    ]);

    const serialised = JSON.stringify(view).toLowerCase();
    expect(serialised).not.toContain('completenessscore');
    expect(serialised).not.toContain('confidencescore');
  });

  it('⚠️ carries the CAPTURE time and 🚫 no relative wording', () => {
    const view = presentClientContextProjection(projectionFixture());

    expect(view.asOf).toBe(ASOF);
    // 🚫 A relative phrase would be a claim about now, from a pure module that
    // has no clock and no right to make one.
    for (const forbidden of ['ago', 'today', 'recently']) {
      expect(JSON.stringify(view).toLowerCase(), forbidden).not.toContain(forbidden);
    }
  });

  it('🛑 keeps the two silences apart — 🚫 neither says the business has none', () => {
    const view = presentClientContextProjection(projectionFixture());
    const states = new Set(view.subjectKinds.map((kind) => kind.state));

    expect(states.has('never-captured') || states.has('captured-nothing-recorded')).toBe(true);

    // ⚠️ The two silent states must reach the screen with DIFFERENT reasons —
    // 🚫 a view that gave them one shared sentence would have merged "AGE never
    // looked" into "AGE looked and the business said nothing", and an
    // operator's next act differs completely between them.
    const reasons = new Map<string, Set<string>>();
    let checked = 0;
    for (const kind of view.subjectKinds) {
      expect(kind.because.length, kind.subjectKind).toBeGreaterThan(0);
      if (kind.state === 'never-captured' || kind.state === 'captured-nothing-recorded') {
        const seen = reasons.get(kind.state) ?? new Set<string>();
        seen.add(kind.because);
        reasons.set(kind.state, seen);
        checked += 1;
      }
    }
    // ⚠️ Counted after the loop: a scan that examined nothing must not report
    // compliance.
    expect(checked).toBeGreaterThan(0);

    const silent = [...reasons.values()].flatMap((seen) => [...seen]);
    expect(new Set(silent).size).toBe(silent.length);
  });
});
