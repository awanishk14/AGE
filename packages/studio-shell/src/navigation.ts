/**
 * The AGE Studio navigation model.
 *
 * This is the ONE place the navigation areas are declared. It lives in a package
 * rather than in a component because it is logic with rules that must be tested,
 * and `apps/studio` is a rendering layer (the split ADR-0048 already made for the
 * readiness surface). 🚫 Do not push this into a component because the component
 * is where the data is.
 *
 * The areas, and the four that were REFUSED rather than postponed, come from
 * `OX_02_UX_ARCHITECTURE.md` §2. 🚫 Do not add an area here without a reason
 * recorded there — the refusals are load-bearing:
 *
 *  - **Organizations** is 🚫 not an area. `organizationId` is a scope component
 *    read off a `ClientRecord`, never typed. Surfacing it as a level invites the
 *    fabricated scope ADR-0046 D7 was written about. It is an attribute on S2/S3.
 *  - **Administration** is 🚫 refused. It administers users, roles and tenants;
 *    there are none, and it is the first place multi-user assumptions leak in.
 *  - **Settings** is 🚫 folded into Diagnostics, which SHOWS configuration rather
 *    than accepting it.
 *  - **Knowledge** is ⚠️ deferred (gap G-11): `@age/business-knowledge-graph`
 *    has no producer wired to a real business, so the area would render an empty
 *    graph and imply AGE knows more than it does.
 */

/**
 * How much of an area actually works today.
 *
 * ⚠️ These are NOT decorative. `17_DESIGN_SYSTEM.md` §4 requires that "not
 * assessed" never share a visual treatment with "unknown" or with zero. An area
 * whose backend is not wired is NOT ASSESSED — 🚫 it is never rendered as empty,
 * as zero, or as a low score.
 */
export type AreaWiring =
  /** The screen reads a real source and can render a real result. */
  | 'wired'
  /**
   * The area exists in navigation, the backend is not connected yet, and the
   * screen says so in those words. 🚫 It renders no invented value.
   */
  | 'not-wired';

/** Which level of the navigation hierarchy an area belongs to. */
export type AreaLevel =
  /** About the console itself, not about any business. */
  | 'console'
  /** Selecting or listing businesses. */
  | 'business'
  /** Within one business's persistent context. */
  | 'subject';

export interface StudioArea {
  readonly id: string;
  readonly label: string;
  readonly route: string;
  readonly level: AreaLevel;
  /** The `OX_01` screen id this area lands on. */
  readonly screen: string;
  readonly wiring: AreaWiring;
  /** One sentence the screen shows the operator. Required when not wired. */
  readonly question: string;
  /**
   * Why it is not wired, in words the operator can act on.
   * 🚫 Required for every `not-wired` area — an unexplained empty screen is the
   * absence-looks-like-presence failure `17_DESIGN_SYSTEM.md` §0.1 forbids.
   */
  readonly notWiredBecause?: string;
}

/**
 * ⚠️ Every area is `not-wired` in this slice, and that is the honest state.
 * Wave 1 has zero database dependency; Wave 2 onward is blocked on ADR-0055 D7 —
 * the operator's own capture run. 🚫 Do not flip a `wiring` to `wired` to make a
 * screen look finished, and 🚫 do not seed a row to justify flipping one.
 */
export const STUDIO_AREAS: readonly StudioArea[] = Object.freeze([
  {
    id: 'home',
    label: 'Dashboard',
    route: '/',
    level: 'console',
    screen: 'S1',
    wiring: 'not-wired',
    question: 'What changed, what is waiting, and what is broken?',
    notWiredBecause:
      'The dashboard is composed from the areas below. It has nothing truthful to compose until at least one of them is wired.',
  },
  {
    id: 'businesses',
    label: 'Businesses',
    route: '/businesses',
    level: 'business',
    screen: 'S2',
    wiring: 'not-wired',
    question: 'Which businesses does AGE know, and under what scope?',
    notWiredBecause:
      'Reads the operator record file through @age/client-registry. Not connected in this slice.',
  },
  {
    id: 'discovery',
    label: 'Discovery',
    route: '/discovery',
    level: 'subject',
    screen: 'S4',
    wiring: 'not-wired',
    question: 'What has the operator told AGE, and what is still unanswered?',
    notWiredBecause: 'Reads the questionnaire and an answer file. Not connected in this slice.',
  },
  {
    id: 'bif',
    label: 'Business Information Framework',
    route: '/bif',
    level: 'subject',
    screen: 'S5',
    wiring: 'not-wired',
    question: 'What does AGE believe about this business, section by section?',
    notWiredBecause:
      'Reads a stored snapshot projection. Blocked on ADR-0055 D7 — one real business must pass through the CLI capture path first. A row must not be seeded to unblock it.',
  },
  {
    id: 'evidence',
    label: 'Evidence',
    route: '/evidence',
    level: 'subject',
    screen: 'S6',
    wiring: 'not-wired',
    question: 'What supports each belief, and which beliefs are unsupported?',
    notWiredBecause: 'Blocked on ADR-0055 D7, as above.',
  },
  {
    id: 'contradictions',
    label: 'Contradictions',
    route: '/contradictions',
    level: 'subject',
    screen: 'S7',
    wiring: 'not-wired',
    question: 'Where does AGE disagree with itself?',
    notWiredBecause: 'Blocked on ADR-0055 D7, as above.',
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    route: '/intelligence',
    level: 'subject',
    screen: 'S8',
    wiring: 'not-wired',
    question: 'What did the capabilities produce, and were they ready to run?',
    notWiredBecause: 'Blocked on ADR-0055 D7, as above.',
  },
  {
    id: 'strategy',
    label: 'Strategy',
    route: '/strategy',
    level: 'subject',
    screen: 'S9',
    wiring: 'not-wired',
    question: 'What does AGE propose, and on what basis?',
    notWiredBecause:
      '@age/strategy-intelligence-engine has no caller wired to a real business (gap G-12).',
  },
  {
    id: 'execution',
    label: 'Execution',
    route: '/execution',
    level: 'subject',
    screen: 'S10',
    wiring: 'not-wired',
    question: 'What awaits approval, and what was approved?',
    notWiredBecause:
      'Approval is a business action and is a V2 capability (18_AGE_STUDIO.md §2.1). This area reads; it never approves.',
  },
  {
    id: 'history',
    label: 'History',
    route: '/history',
    level: 'subject',
    screen: 'S11',
    wiring: 'not-wired',
    question: 'How has what AGE believes changed over time?',
    notWiredBecause: 'Blocked on ADR-0055 D7, as above.',
  },
  {
    id: 'peer-products',
    label: 'Peer Products',
    route: '/peer-products',
    level: 'subject',
    screen: 'S12',
    wiring: 'not-wired',
    question: 'What does each peer product report, and what did AGE do with it?',
    notWiredBecause:
      'No peer product contract is wired. This screen must show ZERO peer products honestly before it shows one.',
  },
  {
    id: 'diagnostics',
    label: 'Diagnostics',
    route: '/diagnostics',
    level: 'console',
    screen: 'S13',
    wiring: 'not-wired',
    question: 'Is the console telling the truth about itself?',
    notWiredBecause:
      'Slice 1.2 wires this: bind address, database host only, questionnaire version, refusal log.',
  },
]);

/** Areas that are refused or deferred, and must NOT appear in navigation. */
export const REFUSED_AREAS: readonly string[] = Object.freeze([
  'organizations',
  'administration',
  'settings',
  'knowledge',
]);

export function areasForLevel(level: AreaLevel): readonly StudioArea[] {
  return STUDIO_AREAS.filter((area) => area.level === level);
}

export function areaByRoute(route: string): StudioArea | undefined {
  return STUDIO_AREAS.find((area) => area.route === route);
}

/**
 * True when no area can render a real result yet.
 *
 * The shell uses this to state its own condition plainly rather than looking
 * like a working product with empty screens.
 */
export function everyAreaIsUnwired(): boolean {
  return STUDIO_AREAS.every((area) => area.wiring === 'not-wired');
}
