import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  dashboardCoverage,
  presentDashboard,
  type DashboardPanel,
  type DashboardView,
} from './dashboard-view';
import { STUDIO_AREAS } from './navigation';
import type { BusinessesView } from './businesses-view';

/**
 * ⚠️ Obviously fictional throughout (ADR-0053 D3). A real client's name must
 * never appear in a commit, and obvious fictionality IS the guard.
 */
const twoRecords: BusinessesView = {
  kind: 'listed',
  bands: [
    {
      organizationId: 'org_fictional_alpha',
      clients: [
        {
          clientId: 'cl_fictional_one',
          displayName: 'Entirely Fictional Bakery',
          organizationId: 'org_fictional_alpha',
          externalRefs: {},
        },
        {
          clientId: 'cl_fictional_two',
          displayName: 'Entirely Fictional Garage',
          organizationId: 'org_fictional_alpha',
          externalRefs: {},
        },
      ],
    },
  ],
};

function panel(view: DashboardView, id: string): DashboardPanel {
  const found = view.panels.find((candidate) => candidate.id === id);
  expect(found, `no panel with id "${id}"`).toBeDefined();
  return found as DashboardPanel;
}

describe('presentDashboard — the businesses panel', () => {
  it('reports a real count only when records were actually read', () => {
    const view = panel(presentDashboard(twoRecords), 'businesses');

    expect(view.state).toBe('known');
    expect(view.value).toContain('2');
  });

  /**
   * ⚠️ THE LOAD-BEARING CASE. An unconfigured record file is "AGE has not
   * looked", and 🚫 it must never render as a measured zero — the same error
   * class as "Last onboarding: Never" and as defaulting `sufficiency` to
   * `ready`.
   */
  it('never reports a count when nothing was read', () => {
    for (const businesses of [
      { kind: 'not-configured', variable: 'AGE_CLIENT_RECORD_FILE' },
      { kind: 'refused', reason: 'The record file named a position that could not be parsed.' },
    ] satisfies BusinessesView[]) {
      const view = panel(presentDashboard(businesses), 'businesses');

      expect(view.state).toBe(businesses.kind === 'refused' ? 'unknown' : 'not-assessed');
      expect(view.value).not.toMatch(/\b0\b/);
      expect(view.value.toLowerCase()).not.toContain('no businesses');
      expect(view.detail.length).toBeGreaterThan(0);
    }
  });

  /**
   * ⚠️ A file that was read and names nothing is `unknown`, not
   * `not-assessed`: AGE looked, and the answer is a result.
   */
  it('separates "read and empty" from "not looked at"', () => {
    const readEmpty = panel(presentDashboard({ kind: 'none' }), 'businesses');
    const notLooked = panel(
      presentDashboard({ kind: 'not-configured', variable: 'AGE_CLIENT_RECORD_FILE' }),
      'businesses',
    );

    expect(readEmpty.state).toBe('unknown');
    expect(notLooked.state).toBe('not-assessed');
    expect(readEmpty.value).not.toBe(notLooked.value);
  });

  it('names the variable the operator has to set', () => {
    const view = panel(
      presentDashboard({ kind: 'not-configured', variable: 'AGE_CLIENT_RECORD_FILE' }),
      'businesses',
    );

    expect(view.detail).toContain('AGE_CLIENT_RECORD_FILE');
  });

  /**
   * 🚫 The refusal reason is surfaced verbatim because it is already written to
   * name a POSITION and never a record's contents.
   */
  it('carries the refusal reason rather than an empty list', () => {
    const view = panel(
      presentDashboard({ kind: 'refused', reason: 'Record 3 is missing organizationId.' }),
      'businesses',
    );

    expect(view.detail).toContain('Record 3 is missing organizationId.');
  });
});

describe('presentDashboard — the aggregate panels', () => {
  /**
   * ⚠️ `ST_02` S1: "Every panel on this screen is an aggregate, and an aggregate
   * is the easiest place to lie." 🚫 An empty pending list must never render as
   * 0, as "All clear", or as a green state.
   */
  it('renders every unmeasured aggregate as not assessed, with a reason', () => {
    const view = presentDashboard(twoRecords);
    const aggregates = view.panels.filter((candidate) => candidate.id !== 'businesses');

    expect(aggregates.length).toBeGreaterThan(0);
    for (const candidate of aggregates) {
      expect(candidate.state, `${candidate.id} must be not-assessed`).toBe('not-assessed');
      expect(candidate.value).not.toMatch(/\b0\b/);
      expect(candidate.value.toLowerCase()).not.toContain('all clear');
      expect(candidate.value.toLowerCase()).not.toContain('none');
      expect(candidate.detail.length, `${candidate.id} must say why`).toBeGreaterThan(0);
    }
  });

  /**
   * 🚫 "No contradictions" is the single most dangerous sentence this console
   * could print. A structural detector exists, and it has never been given an
   * input — that is not the same as a business with no contradictions.
   */
  it('does not claim the business has no contradictions', () => {
    const view = panel(presentDashboard(twoRecords), 'contradictions');

    expect(view.value.toLowerCase()).not.toContain('no contradictions');
    expect(view.detail.toLowerCase()).toContain('has not');
  });

  it('says the pending work is unmeasured rather than empty', () => {
    const view = panel(presentDashboard(twoRecords), 'needs-attention');

    expect(view.detail.toLowerCase()).not.toContain('nothing is pending');
    expect(view.detail.length).toBeGreaterThan(0);
  });

  /** 🚫 No trend, no sparkline, no percentage, no "up 12%" (`ST_02` S1). */
  it('shows no trend, movement or percentage anywhere', () => {
    const view = presentDashboard(twoRecords);
    let inspected = 0;

    for (const candidate of view.panels) {
      const text = `${candidate.title} ${candidate.value} ${candidate.detail}`;
      expect(text, `${candidate.id} carries a trend`).not.toMatch(
        /\d\s?%|[↑↓▲▼]|\btrend(ing)?\b|\bup \d|\bdown \d/i,
      );
      inspected += 1;
    }

    // ⚠️ The scan must be shown to have examined something — an empty loop
    // reporting compliance is the guard failure `CLAUDE.md` §8 names.
    expect(inspected).toBe(view.panels.length);
    expect(inspected).toBeGreaterThan(3);
  });

  /**
   * 🚫 No composite health score, no headline number. Four scores are shown as
   * four elsewhere for the same reason.
   */
  it('produces no overall score', () => {
    const view = presentDashboard(twoRecords);

    expect(Object.keys(view)).not.toContain('score');
    expect(Object.keys(view)).not.toContain('health');
  });
});

describe('dashboardCoverage — the console describing itself', () => {
  it('reports every area except the dashboard itself', () => {
    const coverage = dashboardCoverage();

    expect(coverage.map((row) => row.id)).not.toContain('home');
    expect(coverage).toHaveLength(STUDIO_AREAS.length - 1);
  });

  it('carries a reason on every area that is not wired', () => {
    const notWired = dashboardCoverage().filter((row) => row.wiring === 'not-wired');

    expect(notWired.length).toBeGreaterThan(0);
    for (const row of notWired) {
      expect(row.note.length, `${row.id} must explain itself`).toBeGreaterThan(0);
    }
  });

  /**
   * ⚠️ The counts describe THE CONSOLE, never a business. They are honest
   * because the area table is in this repository and was measured — 🚫 do not
   * add a percentage or a progress bar over them.
   */
  it('counts the wired areas without inventing a completion figure', () => {
    const view = presentDashboard(twoRecords);

    expect(view.wiredAreaCount).toBe(
      STUDIO_AREAS.filter((area) => area.id !== 'home' && area.wiring === 'wired').length,
    );
    expect(view.totalAreaCount).toBe(STUDIO_AREAS.length - 1);
    expect(view.wiredAreaCount).toBeLessThan(view.totalAreaCount);
  });
});

describe('presentDashboard — purity', () => {
  it('is deterministic across repeated calls', () => {
    expect(presentDashboard(twoRecords)).toStrictEqual(presentDashboard(twoRecords));
  });

  /**
   * ⚠️ The purity guard, and it is comment-stripped: this file's own
   * explanation of a banned token must not be what the scan matches.
   *
   * 🚫 The dashboard must not read a file, a clock or the environment — and in
   * particular it must NOT reach for the BIF, evidence or discovery chains. A
   * dashboard that recomputes on open is a system-initiated act, which is class
   * 3 under ADR-0057 D4 even though its effect is entirely internal.
   */
  it('performs no effect and reaches no producer', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./dashboard-view.ts', import.meta.url)),
      'utf8',
    )
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    const banned = [
      'new Date(',
      'Date.now(',
      'Math.random(',
      'fetch(',
      'node:fs',
      'process.env',
      '@prisma/client',
      '@age/persistence',
      '@age/business-discovery-capture',
      '@age/business-discovery-contracts',
      'produceScoredBifContext',
      'localStorage',
    ];

    for (const token of banned) {
      expect(source, `dashboard-view.ts must not contain ${token}`).not.toContain(token);
    }

    expect(banned).toHaveLength(12);
  });
});
