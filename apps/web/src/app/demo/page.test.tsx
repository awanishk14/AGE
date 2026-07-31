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

/** The three ADR-0027 adopters. The other three declare no assessment. */
const ADOPTERS = ['Intelligence', 'Market Discovery', 'Revenue'] as const;

/**
 * Three DIFFERENT state words, deliberately.
 *
 * ⚠️ If the fixture gave all three adopters the same state, every assertion
 * below about not ranking them would pass without the page ever having had the
 * opportunity to rank anything.
 */
const STATES: Readonly<Record<string, string>> = {
  Intelligence: 'partial',
  'Market Discovery': 'insufficient',
  Revenue: 'ready',
};

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
    contextReadiness: {
      incommensurabilityNotice: [
        'These readiness states are NOT comparable with one another.',
        'There is deliberately no single figure summarising them.',
        'No work is derived from any state below.',
      ],
      // Registry order — adopters and non-adopters INTERLEAVED, so that any
      // grouping or sorting by state becomes visible as a reordering.
      entries: CAPABILITIES.map((capability) =>
        ADOPTERS.includes(capability as (typeof ADOPTERS)[number])
          ? {
              capabilityName: capability,
              assessesContext: ['ScoredBifContext'],
              declaration: 'assesses the scored BIF context',
              state: STATES[capability],
              reasons: [`${capability} reason`],
              limitations: [`${capability} limitation`],
              improvementHints: [`${capability} hint`],
              requiredSectionTypes: [`${capability}Section`],
              // ⚠️ Not 40: the "no combined score" test forbids 40 as the mean
              // of the discovery-confidence / BIF-confidence pair, and a
              // threshold that collided with it would fail that test for a
              // reason that has nothing to do with what it guards.
              thresholds: { [`${capability}Floor`]: 41 },
              denominator: `${capability} judges its own declared sections`,
            }
          : {
              capabilityName: capability,
              declaration: 'does not assess external context — this capability declares none',
            },
      ),
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

    // One set of six names across BOTH stages: a readiness row and a run card
    // per capability, so a reader is never asked to align two different lists.
    for (const capability of CAPABILITIES) {
      expect(
        screen.getAllByRole('heading', { name: capability, level: 3 }),
        `"${capability}" does not appear once as a readiness row and once as a run card`,
      ).toHaveLength(2);
    }
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(CAPABILITIES.length * 2);
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

describe('ADR-0048 D3 step 5 — the readiness stage renders without ranking', () => {
  /** The readiness section, located by its own heading. */
  function readinessSection(): HTMLElement {
    const heading = screen.getByRole('heading', { name: /Context readiness/i, level: 2 });
    const section = heading.closest('section');
    expect(section, 'the readiness section is not rendered').not.toBeNull();
    return section as HTMLElement;
  }

  /** One capability's readiness row, located by its own heading. */
  function readinessRow(section: HTMLElement, capability: string): HTMLElement {
    const heading = within(section).getByRole('heading', { name: capability, level: 3 });
    const row = heading.closest('div')?.parentElement;
    expect(row, `${capability} has no readiness row`).toBeTruthy();
    return row as HTMLElement;
  }

  it('renders the incommensurability notice, not just carries it', async () => {
    const response = buildResponse();
    await renderLoaded(response);
    const section = readinessSection();

    let linesChecked = 0;
    for (const line of response.contextReadiness.incommensurabilityNotice) {
      expect(
        within(section).getByText(line, { exact: false }),
        `the notice line "${line}" is carried but not rendered`,
      ).toBeTruthy();
      linesChecked += 1;
    }
    // ⚠️ Counted and asserted AFTER the loop: an empty notice would otherwise
    // report a compliant page without a single line having been checked.
    expect(linesChecked).toBe(3);
  });

  it('renders each state adjacent to its OWN denominator and thresholds', async () => {
    await renderLoaded();
    const section = readinessSection();

    let adoptersChecked = 0;
    for (const capability of ADOPTERS) {
      const row = readinessRow(section, capability);

      expect(within(row).getByText(STATES[capability] as string)).toBeTruthy();
      expect(
        within(row).getByText(new RegExp(`${capability} judges its own declared sections`)),
        `${capability}'s state is rendered without its own denominator beside it`,
      ).toBeTruthy();
      expect(
        within(row).getByText(new RegExp(`${capability}Floor=41`)),
        `${capability}'s state is rendered without its own thresholds beside it`,
      ).toBeTruthy();
      // ...and no other capability's state or thresholds appear in this row.
      for (const other of ADOPTERS) {
        if (other === capability) continue;
        expect(
          within(row).queryByText(STATES[other] as string, { exact: true }),
          `${capability}'s row also shows ${other}'s state — the two are not comparable`,
        ).toBeNull();
        expect(
          row.textContent ?? '',
          `${capability}'s row carries ${other}'s thresholds — thresholds are never shared`,
        ).not.toContain(`${other}Floor`);
      }
      adoptersChecked += 1;
    }
    expect(adoptersChecked).toBe(3);
  });

  it('gives a non-adopter no placeholder state — not "N/A", not a zero', async () => {
    await renderLoaded();
    const section = readinessSection();

    let nonAdoptersChecked = 0;
    for (const capability of CAPABILITIES) {
      if (ADOPTERS.includes(capability as (typeof ADOPTERS)[number])) continue;
      const text = readinessRow(section, capability).textContent ?? '';

      // The row still says what it is — silence about the capability would be
      // its own misreading.
      expect(text, `${capability}'s row is empty`).toContain('declares none');
      // ⚠️ An em dash is NOT in this list: the declaration legitimately contains
      // one ("does not assess external context — this capability declares
      // none"). Forbidding it would fail on the honest sentence, and the fix
      // would then be to delete the sentence.
      for (const placeholder of ['N/A', 'n/a', 'null', 'undefined', 'unknown', '(none)']) {
        expect(
          text,
          `${capability} renders "${placeholder}" — non-adoption is a declared property, not a deficiency`,
        ).not.toContain(placeholder);
      }
      // No state word from any adopter leaked into a row that declares none.
      for (const state of Object.values(STATES)) {
        expect(text, `${capability} renders a state it never reported`).not.toContain(state);
      }
      nonAdoptersChecked += 1;
    }
    expect(nonAdoptersChecked).toBe(3);
  });

  it('never groups or sorts the rows by state, and derives nothing across them', async () => {
    await renderLoaded();
    const section = readinessSection();

    const order = within(section)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent);
    expect(order).toEqual([...CAPABILITIES]);

    // Registry order interleaves adopters and non-adopters. If the rows were
    // ever grouped by state, the adopters would become contiguous.
    const adopterPositions = order
      .map((name, index) => (ADOPTERS.includes(name as (typeof ADOPTERS)[number]) ? index : -1))
      .filter((index) => index >= 0);
    expect(adopterPositions).toHaveLength(3);
    const contiguous = adopterPositions.every(
      (index, i) => i === 0 || index === (adopterPositions[i - 1] ?? -1) + 1,
    );
    expect(contiguous, 'the adopter rows are contiguous — the block looks sorted by state').toBe(
      false,
    );

    // ⚠️ No figure computed across the rows. "N of 6" and "N ready" are the two
    // shapes this actually takes.
    //
    // ⚠️ NO TRAILING `\b` after `ready`. `textContent` concatenates sibling
    // elements with no separator, so a count rendered just above the first row
    // reads "…6 readyIntelligence…" and a trailing word boundary never matches.
    // A mutation test caught this: the guard silently passed on a real
    // "1 of 6 ready" before the anchor was removed.
    const text = section.textContent ?? '';
    expect(text.length).toBeGreaterThan(0);
    let patternsChecked = 0;
    for (const pattern of [/\b\d+\s*(of|\/)\s*6\b/i, /\b\d+\s+(capabilities?\s+)?ready/i]) {
      expect(
        text,
        `the readiness section derives a figure across the rows: ${pattern}`,
      ).not.toMatch(pattern);
      patternsChecked += 1;
    }
    expect(patternsChecked).toBe(2);
  });

  it('paints no state with an alarm or a success colour', async () => {
    await renderLoaded();
    const section = readinessSection();

    // ⚠️ BOTH directions. An amber "insufficient" renders a valid successful
    // outcome as a fault; an emerald "ready" makes the three states an ordinal
    // scale from the other end. Either one is the colour scale ADR-0047 D4
    // forbids, and reusing `Notice` here is one prop away from both.
    const graded =
      /(^|[\s-])(bg|text|border)-(red|amber|orange|rose|yellow|emerald|green|lime)-\d{2,3}(\s|$)/;
    const elements = section.querySelectorAll('*');
    expect(elements.length, 'the readiness section is empty — the scan is vacuous').toBeGreaterThan(
      0,
    );
    let elementsChecked = 0;
    for (const element of elements) {
      expect(
        element.className.toString(),
        `an element in the readiness section carries a graded colour: "${element.className}"`,
      ).not.toMatch(graded);
      elementsChecked += 1;
    }
    expect(elementsChecked).toBeGreaterThan(0);
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
