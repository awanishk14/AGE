import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  presentBusinessProfile,
  type DiscoveryDraftPresence,
  type BusinessProfileInput,
} from './business-profile-view';
import type { SourceConfirmedPresence } from './source-confirmed-channel';
import { STUDIO_AREAS } from './navigation';

const IDENTITY = Object.freeze({
  clientId: 'fixture-client',
  displayName: 'Fixture Business',
  organizationId: 'fixture-org',
});

/**
 * ⚠️ The second channel is a REQUIRED input (ADR-0073 D5), so the default here
 * is the honest one for a fixture that names no workspace: nothing has looked.
 * 🚫 Never `read` with a count — that would make the typed-draft cases silently
 * assert a confirmed-answer figure they say nothing about.
 */
const inputWith = (
  draft: DiscoveryDraftPresence,
  sourceConfirmed: SourceConfirmedPresence = { kind: 'not-configured' },
): BusinessProfileInput => ({
  identity: IDENTITY,
  draft,
  sourceConfirmed,
});

const ALL_PRESENCES: readonly DiscoveryDraftPresence[] = [
  'not-configured',
  'none-saved',
  'refused',
  'saved',
];

describe('the Business Profile view', () => {
  it('states the business identity from the record, verbatim', () => {
    const view = presentBusinessProfile(inputWith('saved'));

    expect(view.identity.map((fact) => fact.value)).toEqual([
      'Fixture Business',
      'fixture-client',
      'fixture-org',
    ]);
    // 🚫 Identity is read from a validated record; there is no third state here.
    expect(view.identity.every((fact) => fact.state === 'known')).toBe(true);
    expect(view.identity.every((fact) => fact.detail.trim().length > 0)).toBe(true);
  });

  /**
   * 🛑 THE RULE THIS SCREEN EXISTS UNDER (`ST_02` §S3). Every business attribute
   * lives in a BIF. A field for any of them here would be a second business
   * model, and the second source of truth is always the one that drifts.
   */
  it('holds no business attribute of its own', () => {
    const view = presentBusinessProfile(inputWith('saved'));
    const rendered = JSON.stringify(view).toLowerCase();

    const attributes = [
      'industry',
      'competitor',
      'target audience',
      'current tools',
      'current channels',
      'revenue',
      'goals',
    ];
    let checked = 0;
    for (const attribute of attributes) {
      expect(rendered, `the profile must not carry "${attribute}"`).not.toContain(attribute);
      checked += 1;
    }
    expect(checked).toBe(attributes.length);
  });

  /**
   * 🚫 NO AGGREGATE OF ANY KIND. The areas measure different things, so a count
   * across them invents a scale nothing published.
   */
  it('publishes no total, percentage or ready-count across areas', () => {
    const view = presentBusinessProfile(inputWith('saved'));

    // No numeric field anywhere in the view.
    const numbers = JSON.stringify(view).match(/:\s*-?\d+(\.\d+)?[,}]/g) ?? [];
    expect(numbers).toEqual([]);

    // ⚠️ The notice is excluded ON PURPOSE and only the notice: it DENIES these
    // words ("do not add up to a score"), so scanning it would make the guard
    // fail on the very sentence that states the rule. Everything the screen
    // asserts is still scanned.
    const { notice: _denial, ...asserted } = view;
    const rendered = JSON.stringify(asserted).toLowerCase();
    for (const banned of ['completeness', '% ', 'of 9', 'score', 'progress']) {
      expect(rendered, `the profile must not publish "${banned}"`).not.toContain(banned);
    }
  });

  it('lists every subject area, in the navigation order, never sorted by state', () => {
    const view = presentBusinessProfile(inputWith('saved'));
    const expected = STUDIO_AREAS.filter((area) => area.level === 'subject');

    // ⚠️ Assert the source list is non-empty FIRST — an empty navigation table
    // must never be able to report a compliant screen.
    expect(expected.length).toBeGreaterThanOrEqual(9);
    expect(view.areas.map((area) => area.id)).toEqual(expected.map((area) => area.id));
  });

  /**
   * 🚫 NOTHING IS AUTHORED HERE. Every sentence a row shows must be the one the
   * navigation already publishes, or the console explains itself in two places
   * and one of them goes stale.
   */
  it('carries each area question and blocker through from the navigation verbatim', () => {
    const view = presentBusinessProfile(inputWith('saved'));
    let checked = 0;

    for (const row of view.areas) {
      const source = STUDIO_AREAS.find((area) => area.id === row.id);
      expect(source).toBeDefined();
      expect(row.question).toBe(source?.question);
      expect(row.notWiredBecause).toBe(source?.notWiredBecause);
      checked += 1;
    }

    expect(checked).toBe(view.areas.length);
  });

  /**
   * ⚠️ An unwired area is `not-assessed` — AGE has not looked. 🚫 Never "not
   * ready", never a zero, never a blank, and never red.
   */
  it('reports an unwired area as not-assessed, with its reason', () => {
    const view = presentBusinessProfile(inputWith('saved'));
    const unwired = view.areas.filter((area) => area.state === 'not-assessed');

    expect(unwired.length).toBeGreaterThan(0);
    for (const area of unwired) {
      expect(area.notWiredBecause, `${area.id} is not-assessed with no reason`).toBeDefined();
      expect((area.notWiredBecause ?? '').trim().length).toBeGreaterThan(0);
    }
  });

  /**
   * ⚠️ A `wired` area is `known` ABOUT ITSELF. 🚫 It is not a green tick for this
   * business, and the screen must not imply the source has anything in it.
   */
  it('reports a wired area as known about the screen, not about the business', () => {
    const view = presentBusinessProfile(inputWith('none-saved'));
    const wired = view.areas.filter((area) => area.state === 'known');

    expect(wired.length).toBeGreaterThan(0);
    // The capture is `unknown` at the same time as areas are `known`: the two
    // are about different subjects and must not be collapsed.
    expect(view.capture.state).toBe('unknown');
  });

  it('substitutes the business into every subject route, encoded', () => {
    const view = presentBusinessProfile({
      identity: { ...IDENTITY, clientId: 'a b/c' },
      draft: 'saved',
      sourceConfirmed: { kind: 'not-configured' },
    });

    for (const area of view.areas) {
      expect(area.route).not.toContain(':clientId');
      expect(area.route).toContain(encodeURIComponent('a b/c'));
    }
  });

  describe('the discovery draft', () => {
    /**
     * 🛑 THE DISTINCTION THE WHOLE FACET EXISTS FOR. "Never looked" and "looked
     * and found nothing" are different answers, and neither is a statement
     * about the business.
     */
    it('separates not-looked-for from looked-and-found-nothing', () => {
      expect(presentBusinessProfile(inputWith('not-configured')).capture.state).toBe(
        'not-assessed',
      );
      expect(presentBusinessProfile(inputWith('none-saved')).capture.state).toBe('unknown');
    });

    it('reports a refusal as a result, not as an absence', () => {
      const capture = presentBusinessProfile(inputWith('refused')).capture;

      expect(capture.state).toBe('unknown');
      expect(capture.value).toBe('Refused');
      // 🚫 The reason is never restated here — the Discovery area states it.
      expect(capture.detail).toContain('Discovery area states why');
    });

    it('offers no next step when nothing has been looked for', () => {
      // 🚫 A link onward would suggest there is something there. There is not,
      // and nothing has looked.
      expect(presentBusinessProfile(inputWith('not-configured')).capture.nextRoute).toBeUndefined();
    });

    it('never claims a stored snapshot, nor a submission, from a saved draft', () => {
      const capture = presentBusinessProfile(inputWith('saved')).capture;

      expect(capture.state).toBe('known');
      // 🛑 A saved draft is unfinished by definition. Reading it as "Discovery
      // is done" is the single most likely misreading of this page.
      expect(capture.detail).toContain('A saved draft is not submitted answers');
      expect(capture.detail).toContain('no snapshot of this business exists');
    });

    /**
     * 🚫 THE PAGE MUST NOT REACH THE PRODUCER TO ANSWER THIS. Producing a BIF
     * needs an operator principal, and ADR-0053 D4 refuses a defaulted one — a
     * page that merely loads has nobody to name.
     */
    it('claims nothing about the answer file', () => {
      let checked = 0;
      for (const presence of ALL_PRESENCES) {
        const capture = presentBusinessProfile(inputWith(presence)).capture;
        expect(capture.value.toLowerCase()).not.toContain('answer file');
        expect(capture.detail.toLowerCase()).not.toContain('answer file');
        checked += 1;
      }
      expect(checked).toBe(ALL_PRESENCES.length);
    });

    it('gives every presence value a distinct value and a reason', () => {
      const values = new Set<string>();
      let checked = 0;

      for (const presence of ALL_PRESENCES) {
        const capture = presentBusinessProfile(inputWith(presence)).capture;
        values.add(capture.value);
        expect(capture.detail.trim().length).toBeGreaterThan(0);
        checked += 1;
      }

      expect(checked).toBe(ALL_PRESENCES.length);
      expect(values.size).toBe(ALL_PRESENCES.length);
    });
  });

  /**
   * 🛑 THE FAILURE THIS BRANCH EXISTS TO END. Before ADR-0073 there was one
   * intake channel, so "no saved draft" was a fair summary of everything AGE
   * held. With three answers confirmed from a document on disk, that same
   * sentence tells the operator their work was lost.
   */
  describe('the second intake channel', () => {
    it('never lets the typed-draft line speak for the confirmed answers', () => {
      const view = presentBusinessProfile(
        inputWith('none-saved', { kind: 'read', questionCount: 3 }),
      );

      // The typed channel is still empty and still says so — 🚫 it is not
      // "repaired" by the other channel having something.
      expect(view.capture.state).toBe('unknown');
      // ⚠️ But it must now say which channel it is talking about, and disclaim
      // the other one by name.
      expect(view.capture.label).toBe('Typed discovery draft');
      expect(view.capture.detail).toContain('answers confirmed from documents');

      expect(view.confirmations.state).toBe('known');
      expect(view.confirmations.value).toBe('3 questions answered from a document');
    });

    it('keeps the two channels as two lines, with no combined figure', () => {
      const view = presentBusinessProfile(inputWith('saved', { kind: 'read', questionCount: 2 }));

      expect(view.capture.label).not.toBe(view.confirmations.label);
      // 🚫 ADR-0073 D2/D5 — no sum, no share, no single completeness across the
      // two channels anywhere on this surface.
      const everySentence = [
        view.capture.value,
        view.capture.detail,
        view.confirmations.value,
        view.confirmations.detail,
      ].join(' ');
      expect(everySentence).not.toMatch(/\btotal\b|\bcombined\b|\bin all\b|%/i);
    });

    it('reports each presence of the confirmed channel distinctly', () => {
      const values = new Set(
        (
          [
            { kind: 'not-configured' },
            { kind: 'refused' },
            { kind: 'read', questionCount: 0 },
            { kind: 'read', questionCount: 4 },
          ] as const satisfies readonly SourceConfirmedPresence[]
        ).map(
          (presence) => presentBusinessProfile(inputWith('saved', presence)).confirmations.value,
        ),
      );

      expect(values.size).toBe(4);
    });
  });

  it('shows the no-aggregate notice on the surface', () => {
    const view = presentBusinessProfile(inputWith('saved'));

    expect(view.notice.length).toBeGreaterThanOrEqual(2);
    expect(view.notice.join(' ')).toContain('not a checklist');
  });
});

/**
 * ⚠️ THE PURITY GUARD. Copied from the pattern in `08_REPO_QUICK_FACTS`: this
 * module decides, and 🚫 must never grow a clock, a read or an environment
 * lookup. Effects belong in `apps/studio/src/server/operator-environment.ts`,
 * which is the console's ONE effects module.
 */
describe('the Business Profile view is pure', () => {
  const source = readFileSync(
    fileURLToPath(new URL('./business-profile-view.ts', import.meta.url)),
    'utf8',
  );

  it('reads the module at all', () => {
    // ⚠️ Assert the read found something FIRST — an empty string passes every
    // "does not contain" assertion below.
    expect(source.length).toBeGreaterThan(1000);
  });

  it('performs no effect', () => {
    const banned = [
      'new Date(',
      'Date.now(',
      'Math.random(',
      'performance.now(',
      'fetch(',
      'node:fs',
      'process.env',
      '@prisma/client',
      '@age/persistence',
      'localStorage',
    ];
    let checked = 0;
    for (const token of banned) {
      expect(source, `the profile view must not use ${token}`).not.toContain(token);
      checked += 1;
    }
    expect(checked).toBe(banned.length);
  });

  /**
   * 🚫 It must not reach the BIF either. A profile that could produce a BIF
   * would be a second place the console runs the Discovery→BIF chain, and the
   * two would disagree the first time one of them changed.
   */
  it('has no import path to a producer', () => {
    for (const token of ['@age/bif', 'produceScoredBifContext', 'generateBifFromAnswerFile']) {
      expect(source).not.toContain(token);
    }
  });
});
