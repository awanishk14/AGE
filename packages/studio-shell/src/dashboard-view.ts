/**
 * The Dashboard (S1) — what the console can honestly say on its front page.
 *
 * ⚠️ WHY THIS SCREEN EXISTS NOW. Until Slice 5 the Dashboard's own recorded
 * reason for being unwired was that it "has nothing truthful to compose until at
 * least one of [the areas] is wired". Five areas are wired. The reason is
 * discharged, and leaving the sentence up would have made the console's front
 * page the one screen stating something untrue about itself.
 *
 * ⚠️ EVERY PANEL HERE IS AN AGGREGATE, AND AN AGGREGATE IS THE EASIEST PLACE TO
 * LIE (`ST_02` S1). A dashboard is where a product summarises itself, which is
 * exactly where an unlooked-at absence turns into a measured zero: "0 pending",
 * "no contradictions", "all clear". 🚫 None of those may be printed. A panel
 * either reports something a source actually said, or it reports `not-assessed`
 * with the reason nobody has looked.
 *
 * 🚫 NOTHING HERE COMPUTES ANYTHING ABOUT A BUSINESS. It composes a view that
 * was already read (the client record file) and the console's own area table.
 * It must never reach for the Discovery→BIF chain: producing on open would make
 * OPENING THE PAGE the act, and a recompute-on-open is class 3 under ADR-0057 D4
 * even though its effect is entirely internal. The BIF and Evidence screens are
 * button-pressed for that reason; the front page must not quietly undo it.
 *
 * 🚫 No trend, no sparkline, no percentage, no composite health score.
 */

import type { BusinessesView } from './businesses-view';
import { countBusinesses } from './businesses-view';
import type { EpistemicState } from './epistemic-state';
import { STUDIO_AREAS, type AreaWiring } from './navigation';

export interface DashboardPanel {
  readonly id: string;
  readonly title: string;
  /** The question the panel answers, in the operator's words. */
  readonly question: string;
  /**
   * The one line of substance.
   *
   * 🚫 Never a zero when nothing was read, and never "None" or "All clear" —
   * those read as measurements of a business AGE has not measured.
   */
  readonly value: string;
  readonly state: EpistemicState;
  /** Why the value is what it is. 🚫 Required on every panel. */
  readonly detail: string;
}

/** One row of the console describing its own coverage. */
export interface AreaCoverageRow {
  readonly id: string;
  readonly label: string;
  readonly wiring: AreaWiring;
  /**
   * What the area answers when wired, or why it is not wired.
   * 🚫 Never empty — an unexplained row is the absence-looks-like-presence
   * failure `17_DESIGN_SYSTEM.md` §0.1 forbids.
   */
  readonly note: string;
}

export interface DashboardView {
  readonly panels: readonly DashboardPanel[];
  readonly coverage: readonly AreaCoverageRow[];
  /**
   * ⚠️ These two counts describe THE CONSOLE, never a business. They are
   * honest because the area table lives in this repository and was measured.
   * 🚫 Do not derive a percentage or a progress bar from them: "42% complete"
   * is a claim about a roadmap nobody has measured.
   */
  readonly wiredAreaCount: number;
  readonly totalAreaCount: number;
}

/**
 * The console's coverage, minus the Dashboard itself.
 *
 * 🚫 The Dashboard is excluded deliberately. A panel reporting on the screen it
 * is drawn on tells the operator nothing and inflates the wired count by one.
 */
export function dashboardCoverage(): readonly AreaCoverageRow[] {
  return Object.freeze(
    STUDIO_AREAS.filter((area) => area.id !== DASHBOARD_AREA_ID).map((area) =>
      Object.freeze({
        id: area.id,
        label: area.label,
        wiring: area.wiring,
        note: area.wiring === 'wired' ? area.question : (area.notWiredBecause ?? area.question),
      }),
    ),
  );
}

const DASHBOARD_AREA_ID = 'home';

export function presentDashboard(businesses: BusinessesView): DashboardView {
  const coverage = dashboardCoverage();

  return Object.freeze({
    panels: Object.freeze([
      businessesPanel(businesses),
      NEEDS_ATTENTION_PANEL,
      INTELLIGENCE_PANEL,
      CONTRADICTIONS_PANEL,
    ]),
    coverage,
    wiredAreaCount: coverage.filter((row) => row.wiring === 'wired').length,
    totalAreaCount: coverage.length,
  });
}

/**
 * The one panel with a real source behind it.
 *
 * ⚠️ Four outcomes, and the distinction between the middle two is the point:
 * "nobody said where to look" is `not-assessed`, "we looked and were refused"
 * is `unknown` (AGE looked; the answer is a refusal, which is a result), and
 * "we read the file and it names none" is `unknown` with a different sentence.
 * 🚫 A count is reported only in the case where records were actually read.
 */
function businessesPanel(businesses: BusinessesView): DashboardPanel {
  const base = {
    id: 'businesses',
    title: 'Businesses',
    question: 'Which businesses does AGE have records for?',
  } as const;

  switch (businesses.kind) {
    case 'not-configured':
      return Object.freeze({
        ...base,
        // 🚫 NOT "0 businesses". `countBusinesses` returns `undefined` here for
        // exactly this reason, and the panel must not re-introduce the zero the
        // registry was careful not to produce.
        value: 'Not assessed',
        state: 'not-assessed',
        detail:
          `No client record file is configured, so the console has not looked for one. Set ` +
          `${businesses.variable} to a path outside this repository. This is not a report that ` +
          `there are no businesses.`,
      });

    case 'refused':
      return Object.freeze({
        ...base,
        value: 'Refused',
        state: 'unknown',
        detail:
          `${businesses.reason} No partial or repaired registry is used in its place, and no ` +
          `count is shown for a file that could not be read.`,
      });

    case 'none':
      return Object.freeze({
        ...base,
        value: 'The record file names no businesses',
        state: 'unknown',
        detail:
          'The record file was read and every record validated. It names none — AGE looked, and ' +
          'that is the answer, not a failure.',
      });

    case 'listed': {
      const count = countBusinesses(businesses);
      const bands = businesses.bands.length;

      return Object.freeze({
        ...base,
        value: `${String(count)} ${plural(count ?? 0, 'business', 'businesses')} in ${String(bands)} ${plural(bands, 'organization band', 'organization bands')}`,
        state: 'known',
        detail:
          "Read from the operator's client record file. Organization bands are DERIVED from the " +
          'records — they are not a level you can navigate into, and no organization id was typed.',
      });
    }
  }
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * 🚫 "Nothing is pending" is not something this console may say. Pending work
 * would have to come from a capability run against a real business, and none
 * has run — so the honest report is that the question is unmeasured.
 */
const NEEDS_ATTENTION_PANEL: DashboardPanel = Object.freeze({
  id: 'needs-attention',
  title: 'Needs attention',
  question: 'What is waiting on the operator?',
  value: 'Not assessed',
  state: 'not-assessed',
  detail:
    'Pending work would come from a capability run or a stored snapshot. Neither exists for a real ' +
    'business: nothing has read the capture store (ADR-0055 D7), and no capability has been given a ' +
    'real client. AGE has not looked, so it cannot report that there is nothing to do.',
});

const INTELLIGENCE_PANEL: DashboardPanel = Object.freeze({
  id: 'intelligence',
  title: 'Recent intelligence',
  question: 'What have the capabilities produced?',
  value: 'Not assessed',
  state: 'not-assessed',
  detail:
    'The six capabilities produce output only in the demo scenario, which is a fixed fixture and ' +
    'says nothing about any business. No capability has been given a real client, so there is ' +
    'nothing here to summarise.',
});

/**
 * ⚠️ THE MOST DANGEROUS PANEL ON THE PAGE.
 *
 * A structural contradiction detector exists and works (`detectContradictions`,
 * ADR-0011). It takes `Evidence` records, and AGE holds none: the Evidence
 * screen established that discovery answers name sources as TEXT and attach
 * them to nothing. Running a real detector over an empty list returns an empty
 * set — and rendering that as "no contradictions" would turn "we have never
 * looked" into "we checked this business and it is consistent".
 *
 * 🚫 That sentence must never be printed, and 🚫 the detector must not be run
 * here to produce it.
 */
const CONTRADICTIONS_PANEL: DashboardPanel = Object.freeze({
  id: 'contradictions',
  title: 'Contradictions',
  question: 'Where does AGE disagree with itself?',
  value: 'Not assessed',
  state: 'not-assessed',
  detail:
    'A structural detector exists, and it has not been run: it compares evidence records, and AGE ' +
    'holds none — discovery names sources as text and attaches them to no belief. An empty result ' +
    'from an empty input is not a finding about this business.',
});
