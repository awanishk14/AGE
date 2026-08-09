import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  buildProfileFromAnswers,
  produceScoredBifContext,
  type DiscoveryAnswer,
} from '@age/business-discovery-contracts';
import { ClientContext } from '@age/capability-kit';
import { buildContextReadinessReport } from '@age/demo-runtime/context-readiness';
import { describe, expect, it } from 'vitest';

import { intelligenceNotAssessedFacets, presentCapabilityReadiness } from './intelligence-view';
import { STATED_ANSWER_PROVENANCE } from '@age/business-discovery-contracts';

/**
 * ⚠️ Driven through the REAL chain — answers → profile → scored context → the
 * three real assessors — for the same reason as `bif-view.spec.ts` and
 * `evidence-view.spec.ts`. A hand-built report could carry any state at all, and
 * the facts this screen must get right (three adopters, three non-adopters,
 * three different denominators) are properties of the real capability packages.
 *
 * 🚫 Obviously fictional answers. Real client answers are never committed
 * (ADR-0053 D3).
 */
const ANSWERS: readonly DiscoveryAnswer[] = [
  { questionId: 'bi-name', value: 'Fictional Kite Repair', provenance: STATED_ANSWER_PROVENANCE },
  {
    questionId: 'bi-industry',
    value: 'Entirely made-up kite maintenance',
    provenance: STATED_ANSWER_PROVENANCE,
  },
  {
    questionId: 'gc-goals',
    value: 'Repair more imaginary kites',
    provenance: STATED_ANSWER_PROVENANCE,
  },
];

function presented() {
  const profile = buildProfileFromAnswers(ANSWERS, DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE, {
    id: 'profile-fictional',
    capturedAt: '2026-01-01T00:00:00.000Z',
  });

  const { context } = produceScoredBifContext(profile, {
    organizationId: 'org-fictional',
    constructedAt: new Date('2026-01-01T00:00:00.000Z'),
    changedBy: 'operator:fictional',
    bifId: 'bif-fictional',
    questionnaire: DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  });

  const report = buildContextReadinessReport(context, {
    producedAt: new Date('2026-01-01T00:00:00.000Z'),
    clientContext: new ClientContext('client-fictional', 'org-fictional'),
  });

  return presentCapabilityReadiness(report);
}

describe('presentCapabilityReadiness — the six rows', () => {
  it('emits every capability, in the report order, never sorted by state', () => {
    const view = presented();
    const report = [
      'Intelligence',
      'Market Discovery',
      'Growth',
      'Authority',
      'Operations',
      'Revenue',
    ];

    expect(view.rows.map((row) => row.capabilityName)).toEqual(report);
  });

  it('marks the three ADR-0027 adopters as assessed, carrying their own verdict', () => {
    const view = presented();
    const assessed = view.rows.filter((row) => row.state === 'known');

    expect(assessed.map((row) => row.capabilityName)).toEqual([
      'Intelligence',
      'Market Discovery',
      'Revenue',
    ]);
    for (const row of assessed) {
      expect(typeof row.assessedState).toBe('string');
      expect(row.assessedState).not.toBe('undefined');
      expect(row.notAssessedBecause).toBeUndefined();
    }
  });

  /**
   * ⚠️ THE CENTRAL HONESTY TEST OF THIS SCREEN. A capability that publishes no
   * assessment has not judged this business. 🚫 It must never render as unready,
   * as zero, or as a blank.
   */
  it('marks the three non-adopters not-assessed, never "not ready"', () => {
    const view = presented();
    const unassessed = view.rows.filter((row) => row.state === 'not-assessed');

    expect(unassessed.map((row) => row.capabilityName)).toEqual([
      'Growth',
      'Authority',
      'Operations',
    ]);
    for (const row of unassessed) {
      expect(row.assessedState).toBeUndefined();
      expect(row.notAssessedBecause).toContain('not "not ready"');
      // 🚫 No invented denominator, and no borrowed thresholds.
      expect(row.requiredSectionTypes).toBeUndefined();
      expect(row.thresholds).toEqual([]);
    }
  });

  it('gives each assessed row its OWN denominator, never a shared one', () => {
    const view = presented();
    const required = new Map(
      view.rows.map((row) => [row.capabilityName, row.requiredSectionTypes]),
    );

    // Market Discovery and Revenue each publish a required set, and the sets differ.
    expect(required.get('Market Discovery')).toBeDefined();
    expect(required.get('Revenue')).toBeDefined();
    expect(required.get('Market Discovery')).not.toEqual(required.get('Revenue'));
    // Intelligence declares no required set — it judges whatever is present.
    expect(required.get('Intelligence')).toBeUndefined();
    expect(view.rows.find((row) => row.capabilityName === 'Intelligence')?.denominator).toContain(
      'declares no required set',
    );
  });

  it('carries each assessor reasons and its own published thresholds', () => {
    const view = presented();
    const market = view.rows.find((row) => row.capabilityName === 'Market Discovery');
    const revenue = view.rows.find((row) => row.capabilityName === 'Revenue');

    expect(market?.thresholds.length).toBeGreaterThan(0);
    expect(revenue?.thresholds.length).toBeGreaterThan(0);
    for (const threshold of market?.thresholds ?? []) {
      expect(typeof threshold.value).toBe('number');
    }
    // Reasons are carried through unsuppressed for every assessed row.
    expect(
      view.rows.filter((row) => row.state === 'known').every((row) => row.reasons.length > 0),
    ).toBe(true);
  });

  it('states the incommensurability on the surface, verbatim from the report', () => {
    const view = presented();

    expect(view.incommensurabilityNotice.length).toBeGreaterThan(0);
    expect(view.incommensurabilityNotice.join(' ')).toContain('NOT comparable');
  });
});

describe('presentCapabilityReadiness — what it refuses to say', () => {
  /**
   * 🚫 NO AGGREGATE. Three states over three different denominators have no
   * shared scale, so any figure spanning them invents one (ADR-0047 D4).
   */
  it('derives no aggregate, count, score or ranking across capabilities', () => {
    const view = presented();

    // ⚠️ STRUCTURAL, not a word scan over the whole payload. The assessors' own
    // reasons and thresholds legitimately contain "score" — `minSectionConfidenceScore`
    // is a capability's OWN published number, and 🚫 suppressing it would strip
    // each row of the denominator that makes its state readable. What is
    // forbidden is a value spanning MORE THAN ONE capability, so the guard is on
    // the shape the view itself introduces.
    expect(Object.keys(view).sort()).toEqual(['incommensurabilityNotice', 'notAssessed', 'rows']);

    // 🚫 No top-level number, and no top-level anything beyond the three lists.
    for (const value of Object.values(view)) {
      expect(Array.isArray(value)).toBe(true);
    }

    // 🚫 Every numeric value anywhere in the view belongs to exactly one
    // capability's own published thresholds. A number reached by any other path
    // would be a figure computed across capabilities.
    const numbersOutsideThresholds = view.rows.flatMap((row) =>
      Object.entries(row)
        .filter(([key]) => key !== 'thresholds')
        .flatMap(([, value]) => (typeof value === 'number' ? [value] : [])),
    );
    expect(numbersOutsideThresholds).toEqual([]);

    // ⚠️ The prose the VIEW authors (as opposed to prose it carries through) must
    // not describe capabilities collectively.
    const authored = [
      ...view.notAssessed.map((facet) => facet.detail),
      ...view.rows.flatMap((row) =>
        row.notAssessedBecause === undefined ? [] : [row.notAssessedBecause],
      ),
    ].join(' ');
    for (const banned of [
      'overall',
      'of the six are',
      'most ready',
      'least ready',
      '2 of 3',
      '3 of 6',
    ]) {
      expect(authored.toLowerCase()).not.toContain(banned.toLowerCase());
    }
  });

  /**
   * ⚠️ Readiness is not production, and this is the confusion the screen exists
   * to prevent. Even when a capability reports `ready`, nothing has run.
   */
  it('reports produced output as not-assessed, never as zero or "none"', () => {
    const facets = intelligenceNotAssessedFacets();
    const produced = facets.find((facet) => facet.label === 'What the capabilities produced');

    expect(produced?.state).toBe('not-assessed');
    expect(produced?.detail).toContain('nothing has run');
    for (const facet of facets) {
      expect(facet.state).toBe('not-assessed');
      expect(facet.detail).not.toMatch(/\bno (output|results|findings)\b/i);
    }
  });

  it('never claims a stored context was assessed', () => {
    const stored = intelligenceNotAssessedFacets().find(
      (facet) => facet.label === 'Readiness of a stored BIF',
    );

    expect(stored?.state).toBe('not-assessed');
    expect(stored?.detail).toContain('Nothing has read the capture store');
  });
});

describe('intelligence-view purity', () => {
  it('performs no retrieval, runs no capability and has no import path to persistence', () => {
    // ⚠️ Made to fail during development by adding a `runAllCapabilities` import
    // and separately a `new Date(` call; the guard named each one, and both were
    // removed.
    const source = readFileSync(
      fileURLToPath(new URL('./intelligence-view.ts', import.meta.url)),
      'utf8',
    )
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    expect(source).toContain('import');
    expect(source).not.toContain('fetch(');
    expect(source).not.toContain('node:fs');
    expect(source).not.toContain('new Date(');
    expect(source).not.toContain('Date.now(');
    expect(source).not.toContain('Math.random(');
    expect(source).not.toContain('process.env');
    expect(source).not.toContain('@age/persistence');
    expect(source).not.toContain('business-discovery-capture');
    expect(source).not.toContain('produceAndCapture');
    // 🚫 The capability RUNNER must not be reachable from a decision module.
    expect(source).not.toContain('runAllCapabilities');
    // 🚫 The bare demo-runtime index pulls the runner and the demo fixtures.
    expect(source).not.toContain("from '@age/demo-runtime'");
  });

  /**
   * ⚠️ The reuse rule, asserted rather than trusted: the readiness report has
   * exactly ONE implementation and the console imports it. A second normalizer
   * would drift, and the drifted surface is the one nobody runs `pnpm demo`
   * against.
   */
  it('imports the one readiness implementation rather than reimplementing it', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./intelligence-view.ts', import.meta.url)),
      'utf8',
    );

    expect(source).toContain("from '@age/demo-runtime/context-readiness'");
    expect(source).not.toContain('assessScoredBifContext');
    expect(source).not.toContain('assessMarketContextReadiness');
    expect(source).not.toContain('assessRevenueContextReadiness');
  });
});
