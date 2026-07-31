import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DemoPage from './page';
import type { CapabilityDemoResponse } from '@/lib/demo';

/**
 * The first rendering test in this repository (ADR-0048 D4).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY IT EXISTS.
 *
 * ADR-0047's central finding is that **the hazard is in the rendering, not the
 * wiring**. Rank, score, shortlist and "how bad is this" are acts of a
 * presentation layer, and this file is the repository's only presentation
 * layer. It was also, until now, the only layer with no way to test itself:
 * `apps/web` declared `environment: 'jsdom'` without `jsdom` installed, ran
 * `--passWithNoTests` over zero specs, and declared a `test:e2e` script that no
 * workflow invoked. It was green on every CI run and had never checked anything.
 *
 * ⚠️ D4's bar is EXECUTES IN `ci.yml`, not "harness installed." This file is
 * reached by `pnpm test` → `nx run-many -t test` → `@age/web`'s `test` script,
 * which `ci.yml` already runs. No workflow change was needed, and none should
 * be added to "make it run" — it runs.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IT PINS.
 *
 * `page.tsx` states binding ADR-0046 slice-1 presentation rules in a docstring:
 * the intake pair and the BIF pair are *"never summed, averaged or shown as one
 * headline number"*, and omitted sections are rendered *"as neutral limitations
 * — never as warnings, never as negative evidence about the business."*
 *
 * Those were comments. A comment does not survive a refactor by someone who has
 * not read it. These tests are the enforcement.
 *
 * ⚠️ The fixture below deliberately uses the pinned demo baseline —
 * **97/63 intake vs 12/17 BIF**, 7 populated + 5 omitted sections, 6
 * capabilities. Those pairs are pinned in three other places precisely because
 * a well-captured interview still yields a sparse Draft BIF. If a change makes
 * them converge, this file is not the one to edit.
 */

const PRESENT_SECTIONS = [
  'BusinessIdentity',
  'CustomerSegments',
  'Offerings',
  'CompetitiveLandscape',
  'GoalsAndConstraints',
  'ChannelsAndAcquisition',
  'OperationsSnapshot',
] as const;

const OMITTED_SECTIONS = [
  'Vision & Strategy',
  'FinancialPosition',
  'BrandAndPositioning',
  'TechnologyStack',
  'RiskRegister',
] as const;

const CAPABILITIES = [
  'Intelligence',
  'Market Discovery',
  'Growth',
  'Authority',
  'Operations',
  'Revenue',
] as const;

/** The four scores, as four distinct measurements. Never combined. */
const DISCOVERY_COMPLETENESS = 97;
const DISCOVERY_CONFIDENCE = 63;
const BIF_COMPLETENESS = 12;
const BIF_CONFIDENCE = 17;

function buildResponse(): CapabilityDemoResponse {
  return {
    title: 'AGE capability demo',
    description: 'Read-only demonstration of the six capabilities.',
    humanApprovedExecution: true,
    sideEffectsPerformed: false,
    businessDiscovery: {
      profileId: 'profile-demo-001',
      businessName: 'Northwind Consulting',
      questionnaireId: 'questionnaire-demo',
      questionnaireVersion: '1',
      profileSchemaValid: true,
      questionnaireValid: true,
      missingRequiredCount: 0,
      criticalGapCount: 2,
      discoveryCompletenessScore: DISCOVERY_COMPLETENESS,
      discoveryConfidenceScore: DISCOVERY_CONFIDENCE,
      bifCompletenessScore: BIF_COMPLETENESS,
      bifConfidenceScore: BIF_CONFIDENCE,
      bifStatus: 'Draft',
      presentSectionTypes: [...PRESENT_SECTIONS],
      omittedSectionTypes: [...OMITTED_SECTIONS],
      evidenceReferenceCount: 9,
      assumptionCount: 4,
      goalCount: 3,
      offeringCount: 2,
      customerSegmentCount: 2,
      competitorCount: 3,
    },
    reports: CAPABILITIES.map((capability) => ({
      capability,
      acceptedCount: 2,
      rejectedCount: 1,
      duplicateCount: 1,
      derivedCount: 4,
      inputItemCount: 4,
      accountingHolds: true,
      acceptedItems: [{ id: `${capability}-1`, capability }],
      rejectedReasons: [{ reasonCode: 'LowConfidence', detail: 'below threshold' }],
      duplicateReferences: [{ id: `${capability}-dup` }],
      pendingApproval: [{ capability, id: `${capability}-1` }],
    })),
    summary: {
      capabilitiesRun: 6,
      totalPendingApprovals: 6,
      accountingInvariantHolds: true,
    },
  };
}

function stubFetchWith(response: CapabilityDemoResponse): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => response,
    })),
  );
}

/** Render the page and wait for the loaded state. */
async function renderLoaded(response = buildResponse()): Promise<void> {
  stubFetchWith(response);
  render(<DemoPage />);
  await waitFor(() => {
    expect(screen.getByText('AGE capability demo')).toBeTruthy();
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the /demo page renders at all', () => {
  it('reaches the loaded state and renders every capability', async () => {
    await renderLoaded();

    // ⚠️ Asserted before anything below. A page stuck on "Loading…" would let
    // every absence-based assertion in this file pass vacuously.
    for (const capability of CAPABILITIES) {
      expect(
        screen.getAllByText(capability, { exact: true }).length,
        `capability "${capability}" is not rendered`,
      ).toBeGreaterThan(0);
    }

    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(CAPABILITIES.length);
  });

  it('surfaces the API error instead of rendering an empty page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 503, statusText: 'Service Unavailable' })),
    );
    render(<DemoPage />);

    await waitFor(() => {
      expect(screen.getByText('Could not reach the AGE API')).toBeTruthy();
    });
    // An unreachable API must not be indistinguishable from a system with
    // nothing to report.
    expect(screen.queryByText('AGE capability demo')).toBeNull();
  });
});

describe('ADR-0046 slice 1 — the four scores are never combined', () => {
  it('renders all four measurements, each under its own denominator heading', async () => {
    await renderLoaded();

    const intake = screen.getByText(/Intake — properties of the interview/i).closest('div');
    const bif = screen.getByText(/Draft BIF — properties of what was produced/i).closest('div');
    expect(intake).not.toBeNull();
    expect(bif).not.toBeNull();

    // Each score adjacent to its OWN denominator — the intake pair describes
    // the interview, the BIF pair describes what was produced.
    expect(within(intake as HTMLElement).getByText(String(DISCOVERY_COMPLETENESS))).toBeTruthy();
    expect(within(intake as HTMLElement).getByText(String(DISCOVERY_CONFIDENCE))).toBeTruthy();
    expect(within(bif as HTMLElement).getByText(String(BIF_COMPLETENESS))).toBeTruthy();
    expect(within(bif as HTMLElement).getByText(String(BIF_CONFIDENCE))).toBeTruthy();

    // ...and neither block contains the other's numbers.
    expect(within(intake as HTMLElement).queryByText(String(BIF_COMPLETENESS))).toBeNull();
    expect(within(bif as HTMLElement).queryByText(String(DISCOVERY_COMPLETENESS))).toBeNull();
  });

  it('renders no sum, average or headline score derived from the four', async () => {
    await renderLoaded();
    const text = document.body.textContent ?? '';
    expect(text.length).toBeGreaterThan(0);

    const four = [
      DISCOVERY_COMPLETENESS,
      DISCOVERY_CONFIDENCE,
      BIF_COMPLETENESS,
      BIF_CONFIDENCE,
    ] as const;

    // Every combination a "headline number" would plausibly be built from.
    const forbidden = new Set<number>();
    const total = four.reduce((sum, value) => sum + value, 0);
    forbidden.add(total);
    forbidden.add(Math.round(total / four.length));
    for (const [a, b] of [
      [DISCOVERY_COMPLETENESS, DISCOVERY_CONFIDENCE],
      [BIF_COMPLETENESS, BIF_CONFIDENCE],
      [DISCOVERY_COMPLETENESS, BIF_COMPLETENESS],
      [DISCOVERY_CONFIDENCE, BIF_CONFIDENCE],
    ] as const) {
      forbidden.add(a + b);
      forbidden.add(Math.round((a + b) / 2));
    }
    // Guard the guard: a combination that happens to equal one of the real
    // scores would make this test forbid a value the page must show.
    for (const value of four) forbidden.delete(value);

    let combinationsChecked = 0;
    for (const value of forbidden) {
      expect(
        screen.queryAllByText(String(value), { exact: true }),
        `a combined score of ${value} is rendered — the four measurements must never be summed or averaged`,
      ).toHaveLength(0);
      combinationsChecked += 1;
    }

    // ⚠️ Counted and asserted AFTER the loop. An empty `forbidden` set would
    // otherwise report a page with no combined score without checking one.
    expect(combinationsChecked).toBeGreaterThanOrEqual(6);
  });
});

describe('ADR-0046 slice 1 — omitted sections are limitations, not warnings', () => {
  it('renders every omitted section, labelled as an intake limitation', async () => {
    await renderLoaded();

    const note = screen.getByText(/Limitations of the intake — not findings about the business\./i);
    const block = note.parentElement;
    expect(block).not.toBeNull();

    for (const section of OMITTED_SECTIONS) {
      expect(
        within(block as HTMLElement).getByText(section, { exact: true }),
        `omitted section "${section}" is not rendered in the limitations block`,
      ).toBeTruthy();
    }
    expect(
      screen.getByText(`Sections discovery could not populate (${OMITTED_SECTIONS.length})`),
    ).toBeTruthy();
  });

  it('renders the omitted-section block in neutral styling, never as an alarm', async () => {
    await renderLoaded();

    const note = screen.getByText(/Limitations of the intake — not findings about the business\./i);
    const block = note.parentElement as HTMLElement;

    // Walk from the block to the document root: no ancestor may carry an
    // alarm colour. Absence of evidence is not negative evidence, and must not
    // be painted as though it were.
    const alarm = /(^|[\s-])(bg|text|border)-(red|amber|orange|rose|yellow)-\d{2,3}(\s|$)/;
    let node: HTMLElement | null = block;
    let ancestorsChecked = 0;
    while (node && node !== document.body) {
      expect(
        node.className,
        `an ancestor of the omitted-section block carries an alarm colour: "${node.className}"`,
      ).not.toMatch(alarm);
      ancestorsChecked += 1;
      node = node.parentElement;
    }
    expect(ancestorsChecked).toBeGreaterThan(0);

    // ...and the same for every element inside it.
    const descendants = block.querySelectorAll('*');
    expect(descendants.length).toBeGreaterThan(0);
    for (const element of descendants) {
      expect(element.className.toString()).not.toMatch(alarm);
    }
  });
});

describe('ADR-0047 D4 / ADR-0048 D7 — no ordinal colour scale on any score', () => {
  /**
   * ⚠️ This is a SOURCE scan, and it is here rather than in a lint rule because
   * ADR-0048 D4 named the mechanism concretely: `Notice` renders an
   * emerald/amber pair off a boolean, and reusing it for a graded value is one
   * prop away. That would introduce a colour scale **by component reuse rather
   * than by anyone deciding to** — which is exactly the class of change a
   * reviewer does not notice.
   */
  it('uses the emerald/amber Notice only for boolean invariants, never for a value', () => {
    // Resolved from the vitest root (`apps/web`) rather than from
    // `import.meta.url`, which is not a file URL under this transform.
    const source = readFileSync(resolve(process.cwd(), 'src/app/demo/page.tsx'), 'utf8');
    expect(source.length, 'page.tsx could not be read — the scan is vacuous').toBeGreaterThan(0);

    // Strip comments first: this file's own explanation of the rule would
    // otherwise match the patterns it forbids.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

    const noticeProps = [...code.matchAll(/<Notice\s+ok=\{([^}]*)\}/g)].map((match) => match[1]);
    expect(
      noticeProps.length,
      'no <Notice ok={...}> call sites found — the scan is vacuous',
    ).toBeGreaterThan(0);

    // ⚠️ Case-SENSITIVE, matching the camelCase segment rather than any
    // substring. A case-insensitive `count` matches `accountingHolds`, which is
    // a boolean invariant and a legitimate use of this component — a scan that
    // flagged it would be edited into uselessness on its first false positive.
    const GRADED_VALUE = /(Score|Count|Completeness|Confidence|Readiness|Priority|Impact|Effort)/;
    for (const prop of noticeProps) {
      expect(
        prop,
        `<Notice ok={${prop}}> is driven by a graded value, not a boolean invariant`,
      ).not.toMatch(GRADED_VALUE);
    }
  });
});
