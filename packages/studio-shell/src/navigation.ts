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
 * ⚠️ Subject-level routes carry the business in the PATH — `/b/:clientId/...`.
 *
 * This is not cosmetic. A subject screen is meaningless without a scope, and a
 * scope held only in memory is a scope that survives a reload, a bookmark and a
 * second tab differently from the URL the operator is looking at. Putting the
 * `clientId` in the path makes the scope of every subject screen legible,
 * shareable and impossible to lose track of.
 *
 * 🚫 There is no `/b/:organizationId/...`. The organization is read OFF the
 * resolved record, never typed and never selected — ADR-0054 D2 refuses a typed
 * scope by name, and a level you can navigate into is a level you can select.
 */
export const SUBJECT_ROUTE_PREFIX = '/b';

/** The placeholder a subject route template carries in place of a clientId. */
export const CLIENT_ID_PARAMETER = ':clientId';

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
 * ⚠️ Five areas are now `wired` — Businesses, Diagnostics, Discovery, the BIF
 * and Evidence — because each reads a real source and can render a real result.
 * Everything else is `not-wired`, and that is still the honest state: those
 * areas read a STORED projection, and nothing has read the capture store
 * (ADR-0055 D7, the operator's own capture run).
 *
 * 🚫 Do not flip a `wiring` to `wired` to make a screen look finished, and 🚫 do
 * not seed a row to justify flipping one. `wired` means the screen reads the
 * real source — it does NOT promise the source has anything in it. A wired
 * screen over an empty source renders "unknown"; an unwired screen renders
 * "not assessed"; those are different states and both are honest.
 */
export const STUDIO_AREAS: readonly StudioArea[] = Object.freeze([
  {
    id: 'home',
    label: 'Dashboard',
    route: '/',
    level: 'console',
    screen: 'S1',
    // ⚠️ `wired` because its own recorded blocker was DISCHARGED, not waived:
    // the dashboard "has nothing truthful to compose until at least one of
    // [the areas] is wired", and five now are. Leaving that sentence up would
    // have made the console's front page the one screen stating something
    // untrue about itself.
    // 🚫 It is NOT a claim that the panels have data. Every aggregate AGE has
    // not measured renders `not-assessed` with its reason — 🚫 never as a zero,
    // never as "all clear", and 🚫 never by running a producer on page load.
    wiring: 'wired',
    question: 'What changed, what is waiting, and what is broken?',
  },
  {
    id: 'businesses',
    label: 'Businesses',
    route: '/businesses',
    level: 'business',
    screen: 'S2',
    wiring: 'wired',
    question: 'Which businesses does AGE know, and under what scope?',
  },
  {
    id: 'discovery',
    label: 'Discovery',
    route: '/b/:clientId/discovery',
    level: 'subject',
    screen: 'S4',
    wiring: 'wired',
    question: 'What has the operator told AGE, and what is still unanswered?',
  },
  {
    id: 'bif',
    label: 'Business Information Framework',
    route: '/b/:clientId/bif',
    level: 'subject',
    screen: 'S5',
    // ⚠️ `wired` because the screen reads a real source and can produce a real
    // result: the answer file this console wrote, through the same
    // Discovery→BIF mapping and scoring the CLI runs.
    // 🚫 It is NOT a claim that the STORED half works. Nothing has read the
    // capture store (ADR-0055 D7), and the screen reports every stored fact as
    // `not-assessed` rather than as a zero. 🚫 No row was seeded to flip this.
    wiring: 'wired',
    question: 'What does AGE believe about this business, section by section?',
  },
  {
    id: 'evidence',
    label: 'Evidence',
    route: '/b/:clientId/evidence',
    level: 'subject',
    screen: 'S6',
    // ⚠️ `wired` because the screen reads a real source: the answer file this
    // console wrote, and the mapper's own account of what it could and could not
    // carry. 🚫 It is NOT a claim that any evidence has been checked — nothing
    // is fetched, opened or contacted, and the screen reports every belief of a
    // first discovery run as unsupported because that is what it is.
    wiring: 'wired',
    question: 'What supports each belief, and which beliefs are unsupported?',
  },
  {
    id: 'contradictions',
    label: 'Contradictions',
    route: '/b/:clientId/contradictions',
    level: 'subject',
    screen: 'S7',
    wiring: 'not-wired',
    question: 'Where does AGE disagree with itself?',
    notWiredBecause: 'Blocked on ADR-0055 D7, as above.',
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    route: '/b/:clientId/intelligence',
    level: 'subject',
    screen: 'S8',
    // ⚠️ `wired` because HALF the question has a real answer: three capabilities
    // publish an ADR-0027 readiness assessment, and each one runs over a context
    // built from the answer file this console wrote.
    // 🚫 It is NOT a claim that anything has been PRODUCED. No capability has
    // been run for a real business — that is refused, not pending — and the
    // screen reports the produced half as `not-assessed` rather than as zero
    // output. 🚫 It reads no stored context: ADR-0055 D7 is untouched and no row
    // was seeded to flip this.
    wiring: 'wired',
    question: 'What did the capabilities produce, and were they ready to run?',
  },
  {
    id: 'strategy',
    label: 'Strategy',
    route: '/b/:clientId/strategy',
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
    route: '/b/:clientId/execution',
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
    route: '/b/:clientId/history',
    level: 'subject',
    screen: 'S11',
    wiring: 'not-wired',
    question: 'How has what AGE believes changed over time?',
    notWiredBecause: 'Blocked on ADR-0055 D7, as above.',
  },
  {
    id: 'peer-products',
    label: 'Peer Products',
    route: '/b/:clientId/peer-products',
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
    wiring: 'wired',
    question: 'Is the console telling the truth about itself?',
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

/** True when this area's route needs a business before it can be linked to. */
export function areaNeedsClientId(area: StudioArea): boolean {
  return area.route.includes(CLIENT_ID_PARAMETER);
}

/**
 * Raised when a subject-level route is asked for without a business.
 *
 * 🚫 There is deliberately no fallback clientId, no "first business", and no
 * "last selected". Substituting any of those would put a scope into circulation
 * that the operator did not choose — the same failure class as a fabricated
 * record (ADR-0054 D3), reached from the navigation layer instead.
 */
export class MissingClientScopeError extends Error {
  readonly areaId: string;

  constructor(areaId: string) {
    super(
      `The "${areaId}" area is scoped to one business and cannot be linked to without a clientId. ` +
        'No business is substituted: a scope the operator did not choose is not a default, it is an invention.',
    );
    this.name = 'MissingClientScopeError';
    this.areaId = areaId;
  }
}

/**
 * The href for an area, with the business substituted into subject routes.
 *
 * @throws {MissingClientScopeError} when a subject area is asked for with no
 *         business selected.
 */
export function areaHref(area: StudioArea, clientId?: string): string {
  if (!areaNeedsClientId(area)) {
    return area.route;
  }

  if (clientId === undefined || clientId.trim() === '') {
    throw new MissingClientScopeError(area.id);
  }

  return area.route.replace(CLIENT_ID_PARAMETER, encodeURIComponent(clientId));
}

export interface MatchedRoute {
  readonly area: StudioArea;
  /** Present only for subject-level routes. */
  readonly clientId?: string;
}

/**
 * Resolve a real pathname back to its area and business.
 *
 * ⚠️ Returns `undefined` for anything unrecognised. 🚫 No nearest-match, no
 * redirect to a plausible screen — an unknown route is an unknown route.
 */
export function matchAreaRoute(pathname: string): MatchedRoute | undefined {
  const exact = areaByRoute(pathname);
  if (exact !== undefined && !areaNeedsClientId(exact)) {
    return { area: exact };
  }

  const segments = pathname.split('/').filter((segment) => segment !== '');
  if (segments.length !== 3 || `/${segments[0]}` !== SUBJECT_ROUTE_PREFIX) {
    return undefined;
  }

  const rawClientId = segments[1] ?? '';
  const tail = segments[2] ?? '';
  const clientId = decodeURIComponent(rawClientId);
  if (clientId.trim() === '') {
    return undefined;
  }

  const area = STUDIO_AREAS.find(
    (candidate) => candidate.route === `${SUBJECT_ROUTE_PREFIX}/${CLIENT_ID_PARAMETER}/${tail}`,
  );

  return area === undefined ? undefined : { area, clientId };
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
