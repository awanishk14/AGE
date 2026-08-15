import type { EpistemicState } from './epistemic-state';
import { areaHref, STUDIO_AREAS, type StudioArea } from './navigation';
import {
  presentSourceConfirmedChannel,
  type SourceConfirmedChannelView,
  type SourceConfirmedPresence,
} from './source-confirmed-channel';

/**
 * S3 · Business Profile — the subject-level landing, decided here and rendered
 * by `apps/studio`.
 *
 * ⚠️ THE NINE SUBJECT ROUTES EXISTED WITHOUT THEIR PARENT. `ST_01` places this
 * screen at `/b/[clientId]` as the parent of Discovery, the BIF, Evidence,
 * Contradictions, Strategy, Execution, History and Peer Products; every child
 * shipped and the parent never did. An operator who selected a business landed
 * nowhere and had to guess a child route.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🚫 THIS SCREEN IS A PROJECTION, NOT A RECORD, AND IT HOLDS NO BUSINESS MODEL.
 * `ST_02` §S3 states the rule and it is the one most easily broken here: the
 * owner's list — industry, market, goals, competitors, products, audience,
 * tools, channels — **is exactly the BIF's shape**, and none of it is stored
 * outside a BIF. 🚫 Do not add a field here for any of them. A second business
 * model is how two sources of truth start, and the second one is always the one
 * that drifts.
 *
 * ⚠️ SO THIS SCREEN DELIBERATELY SHOWS NO BUSINESS ATTRIBUTE AT ALL. It answers
 * the half of its question that is answerable — *where would each part come
 * from, and has anything been read?* — and sends the operator to S5 for the
 * attributes themselves. 🚫 Restating a BIF field here to make the page look
 * fuller would duplicate the projection without duplicating its provenance.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🚫 IT COMPUTES NO STATUS OF ITS OWN AND AUTHORS NO AREA COPY. Every area row
 * below is derived from `STUDIO_AREAS` — the same `wiring`, `question` and
 * `notWiredBecause` the navigation already publishes. A blocker sentence typed
 * into this module would be a second place the console explains itself, and the
 * copy that gets stale is always the one no other screen renders.
 *
 * 🚫 NO AGGREGATE. No "profile completeness", no "N of 9 areas ready", no
 * percentage, no badge and no progress bar. The areas differ in what they even
 * measure — a count across them would invent a shared scale, the same error
 * ADR-0047 D4 forbids on the readiness surface and ADR-0027 D1 forbids on
 * rankings. ⚠️ The four scores AGE really has live on S4 and S5 and 🚫 are not
 * lifted, combined or summarised onto this page.
 *
 * ⚠️ THE DISCOVERY DRAFT IS THE ONLY THING THIS SCREEN MEASURES, and it measures
 * it by being TOLD, never by looking: this package performs no I/O. Whether a
 * draft was found is a real, checkable fact that needs no operator principal to
 * establish, so it is reported — and 🚫 its absence is reported as an absence of
 * capture, never as a fact about the business.
 *
 * Pure: no clock, no ids, no randomness, no I/O.
 */

/**
 * What the caller found when it looked for this business's DISCOVERY DRAFT.
 *
 * ⚠️ THE DRAFT, NOT THE ANSWER FILE, AND THE DIFFERENCE IS DELIBERATE. Reading
 * the answer file means running the producer, which needs an operator principal
 * — and ADR-0053 D4 refuses a defaulted, generated or inferred one, so a page
 * that merely loads has nobody to name. 🚫 So this screen does not claim
 * anything about submitted answers; it reports the one thing it can check
 * without asking who is acting, and sends the operator to Discovery and to the
 * BIF for the rest.
 *
 * ⚠️ FOUR VALUES, AND THE FIRST THREE ARE NOT INTERCHANGEABLE. `not-configured`
 * means AGE never had a place to look; `none-saved` means it looked and nothing
 * had been typed; `refused` means it looked and could not proceed. 🚫 Collapsing
 * them into a boolean "has answers" would turn "AGE has not looked" into "this
 * business has told us nothing", which is a statement about the client.
 */
export type DiscoveryDraftPresence = 'not-configured' | 'none-saved' | 'refused' | 'saved';

/**
 * The business's identity, as the client record states it.
 *
 * ⚠️ `displayName` is the record's own value, carried through verbatim. 🚫 It is
 * never inferred from a domain, a document or an answer (ADR-0050 D2), and 🚫 it
 * is never defaulted when missing — a missing name is a refused record, handled
 * before this view is built.
 */
export interface BusinessIdentityInput {
  readonly clientId: string;
  readonly displayName: string;
  /**
   * ⚠️ Present only because the record carries it. 🚫 It is NOT a selectable
   * scope and 🚫 confers no navigation: ADR-0058 D4 gives Organizations no
   * route and no picker, and ADR-0054 D2 refuses a scope anyone may type.
   */
  readonly organizationId: string;
}

export interface BusinessProfileInput {
  readonly identity: BusinessIdentityInput;
  readonly draft: DiscoveryDraftPresence;
  /**
   * ⚠️ REQUIRED, and 🚫 deliberately not optional. An omitted second channel
   * would render as a page that had looked at one place and said nothing about
   * the other — which is exactly the state this screen was in before ADR-0073's
   * channel had a row of its own, and exactly the reading it produced: a
   * business with confirmed answers reported as having nothing saved.
   */
  readonly sourceConfirmed: SourceConfirmedPresence;
}

/** One fact about the business's identity. Never about the business itself. */
export interface IdentityFactView {
  readonly label: string;
  readonly value: string;
  /**
   * ⚠️ Always `known`: these come from a record that was read and validated at
   * the boundary. 🚫 If the record could not be read, no profile is built at
   * all — the screen refuses rather than rendering identity with blanks.
   */
  readonly state: 'known';
  readonly detail: string;
}

/**
 * What AGE has captured for this business, as a state rather than a count.
 *
 * ⚠️ `state` describes THE CAPTURE, not the business. 🚫 There is no field here
 * for "how much is known" — that would be an aggregate over a BIF this screen
 * does not hold.
 */
export interface CaptureStatusView {
  readonly label: string;
  readonly value: string;
  readonly state: EpistemicState;
  readonly detail: string;
  /** Where the operator goes next, when there is somewhere to go. */
  readonly nextRoute?: string;
}

/**
 * The capture status before its link is resolved.
 *
 * ⚠️ It names an AREA, not a route. 🚫 A literal route typed here would be a
 * second copy of the navigation table, and the copy that goes stale is always
 * the one no router validates.
 */
interface CaptureStatusDecision extends Omit<CaptureStatusView, 'nextRoute'> {
  readonly nextAreaId?: string;
}

/**
 * One subject area, as this screen lists it.
 *
 * ⚠️ Every field is carried through from `STUDIO_AREAS`. 🚫 Nothing is authored
 * here and 🚫 nothing is ranked: rows are emitted in the navigation's own order,
 * never sorted by wiring, because ordering by state is itself a ranking.
 */
export interface ProfileAreaView {
  readonly id: string;
  readonly label: string;
  readonly route: string;
  readonly question: string;
  readonly state: EpistemicState;
  /** Verbatim from the area's own `notWiredBecause`. Unwired areas only. */
  readonly notWiredBecause?: string;
}

export interface BusinessProfileView {
  readonly identity: readonly IdentityFactView[];
  readonly capture: CaptureStatusView;
  /**
   * The second intake channel, stated beside the first and 🚫 never merged into
   * it (ADR-0073 D2/D5).
   */
  readonly confirmations: SourceConfirmedChannelView;
  readonly areas: readonly ProfileAreaView[];
  /**
   * Shown ON the surface, never as a footnote.
   *
   * 🚫 Without it, a list of nine areas with mixed states reads as a checklist
   * with a score.
   */
  readonly notice: readonly string[];
}

const NOTICE: readonly string[] = Object.freeze([
  'This page holds no business attributes of its own. Everything AGE knows about this business ' +
    'lives in a Business Intelligence File, and this page links to it rather than restating it.',
  'The areas below are not a checklist and do not add up to a score. They measure different ' +
    'things, so there is no total, no percentage and no "ready" count.',
]);

/**
 * ⚠️ NARROWED BY ADR-0073, DELIBERATELY. It used to read "Discovery answers",
 * which was accurate while typing was the only way an answer could exist. With a
 * second channel beside it, that heading claimed to cover both and reported only
 * one — so a business whose every answer came from a document read as a business
 * with nothing saved. 🚫 Do not widen it back.
 */
const CAPTURE_LABEL = 'Typed discovery draft';

/**
 * The capture status, one arm per presence value.
 *
 * ⚠️ `absent` is `unknown`, not `not-assessed`: AGE looked in a place it was
 * given and found nothing. `not-configured` is `not-assessed`: it was never
 * given a place to look. 🚫 Neither is ever rendered as "this business has no
 * information" — that is a claim about the client that nothing computed.
 */
function captureStatusOf(presence: DiscoveryDraftPresence): CaptureStatusDecision {
  switch (presence) {
    case 'saved':
      return Object.freeze({
        label: CAPTURE_LABEL,
        value: 'A draft has been saved',
        state: 'known' as EpistemicState,
        detail:
          'The console has a saved discovery draft for this business. ⚠️ A saved draft is not ' +
          'submitted answers: nothing can be produced from a draft, and this page does not say ' +
          'whether Discovery was submitted. 🚫 Nothing has been stored either — no snapshot of ' +
          'this business exists, and the History area says so in its own words.',
        nextAreaId: 'discovery',
      });
    case 'none-saved':
      return Object.freeze({
        label: CAPTURE_LABEL,
        value: 'Nothing saved yet',
        state: 'unknown' as EpistemicState,
        detail:
          'The console looked where it was told to look and found no typed draft for this ' +
          'business. That is a fact about the capture, not about the business — nothing here ' +
          'says this business has little to tell, and 🚫 it says nothing at all about answers ' +
          'confirmed from documents, which are reported on their own line.',
        nextAreaId: 'discovery',
      });
    case 'refused':
      return Object.freeze({
        label: CAPTURE_LABEL,
        value: 'Refused',
        state: 'unknown' as EpistemicState,
        detail:
          'The console tried to read this business’s draft and refused to proceed. The ' +
          'Discovery area states why. No partial or repaired capture is used in its place.',
        nextAreaId: 'discovery',
      });
    case 'not-configured':
      return Object.freeze({
        label: CAPTURE_LABEL,
        value: 'Not looked for',
        state: 'not-assessed' as EpistemicState,
        detail:
          'No workspace was configured, so the console has not looked for a draft at all. ' +
          'This is not "no answers" — nothing has looked.',
      });
  }
}

/**
 * The state a subject area is listed with.
 *
 * ⚠️ A `wired` area is `known` **about itself** — the screen reads a real
 * source. 🚫 It is NOT a promise that the source has anything in it, and 🚫 it
 * must never be read as a green tick for this business.
 */
function areaStateOf(area: StudioArea): EpistemicState {
  return area.wiring === 'wired' ? 'known' : 'not-assessed';
}

/**
 * Build the profile.
 *
 * ⚠️ `clientId` is substituted into each subject route so the links are usable.
 * 🚫 There is no fallback business, no "first" and no "last selected" — the
 * caller supplies the scope the operator chose, and `MissingClientScopeError`
 * exists in `navigation.ts` for the case where it did not.
 */
export function presentBusinessProfile(input: BusinessProfileInput): BusinessProfileView {
  const { clientId, displayName, organizationId } = input.identity;

  const identity: readonly IdentityFactView[] = Object.freeze([
    Object.freeze({
      label: 'Business',
      value: displayName,
      state: 'known' as const,
      detail:
        'The name recorded in the client record file, shown exactly as it is written there. ' +
        'AGE never infers a business name.',
    }),
    Object.freeze({
      label: 'Client id',
      value: clientId,
      state: 'known' as const,
      detail: 'The identifier every file and every attribution for this business is keyed by.',
    }),
    Object.freeze({
      label: 'Organization',
      value: organizationId,
      state: 'known' as const,
      detail:
        'The organization this record belongs to. It is shown because the record carries it, ' +
        'and it is not a scope you can select or navigate into.',
    }),
  ]);

  const areas: readonly ProfileAreaView[] = Object.freeze(
    STUDIO_AREAS.filter((area) => area.level === 'subject').map((area) =>
      Object.freeze({
        id: area.id,
        label: area.label,
        // 🚫 The substitution is DELEGATED, never restated. `areaHref` owns the
        // encoding and the missing-scope refusal; a second copy here is the one
        // that would forget to encode.
        route: areaHref(area, clientId),
        question: area.question,
        state: areaStateOf(area),
        ...(area.notWiredBecause === undefined ? {} : { notWiredBecause: area.notWiredBecause }),
      }),
    ),
  );

  const decision = captureStatusOf(input.draft);
  const nextArea =
    decision.nextAreaId === undefined
      ? undefined
      : STUDIO_AREAS.find((area) => area.id === decision.nextAreaId);

  // 🚫 An area id that does not resolve is a programming error, not a state to
  // render. The link is omitted rather than pointed at a route that may not
  // exist — a dead link on this page would read as a screen that is missing.
  const { nextAreaId: _ignored, ...capture } = decision;

  return Object.freeze({
    identity,
    capture: Object.freeze({
      ...capture,
      ...(nextArea === undefined ? {} : { nextRoute: areaHref(nextArea, clientId) }),
    }),
    // 🚫 DELEGATED, never restated. The second channel's sentences have exactly
    // one implementation, so the copy on this screen cannot drift from the copy
    // Discovery renders.
    confirmations: presentSourceConfirmedChannel(input.sourceConfirmed),
    areas,
    notice: NOTICE,
  });
}
