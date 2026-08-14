import type { ClientContextProjection } from '@age/client-context-projection';

/**
 * What AGE WOULD TELL A PEER, put on a screen (ADR-0069 deliverable 7).
 *
 * 🛑 **THE OPERATOR SEES THE PEER'S ANSWER, 🚫 NOT A DESCRIPTION OF IT.** Every
 * string this view hands to a screen is carried from the projection unchanged —
 * byte-identical. 🚫 It must never re-word, soften, shorten, re-order or
 * summarise one: two answers to "what may a peer name?" means the one that
 * drifts is still the one the operator trusts, and the operator would then be
 * auditing a rendering rather than the thing itself. `readClientContextProjection`
 * holds that rule on the read path; this module holds it on the render path,
 * and its spec is the guard.
 *
 * 🛑 **THIS MODULE AUTHORS EXACTLY ONE SENTENCE**, `HOW_THIS_REACHES_A_PEER_NOTICE`,
 * and it is a statement about AGE's own surface rather than about the business
 * or the projection. Everything else is a pass-through. 🚫 Do not add a second
 * authored string here — a per-kind heading, a friendlier `because`, a count
 * rendered as a summary — because each one is a second answer growing beside
 * the first.
 *
 * 🛑 **NO PEER ASKS, AND THAT IS A DECISION — 🚫 NOT A MISSING FEATURE.**
 * ADR-0071 D1: V1 outbound is **operator-mediated**, so the operator carries
 * this to the peer (`buildClientContextHandover`). 🚫 Do not "finish" it with a
 * peer credential, a session, an endpoint or MCP middleware — all four are
 * refused by name in ADR-0071 §5, and D3 leaves the authenticated peer protocol
 * deliberately unresolved. ⚠️ D2: that is a **V1 transport constraint with an
 * expiry condition**, 🚫 not a principle. Showing this projection without the
 * notice would let an operator conclude peers are already being served.
 *
 * 🚫 **NOTHING HERE IS EMPTY-BY-OMISSION.** Every subject kind the projection
 * carries is rendered, including the two silent states, and `never-captured` and
 * `captured-nothing-recorded` stay apart — 🚫 neither says the business has none.
 *
 * 🚫 **NO SCORE APPEARS.** The projection deliberately carries none, and 🚫 a
 * view must not reach past it to the context for one "for the operator": the
 * operator is auditing what a peer receives, and a figure only the console shows
 * is a figure the audit cannot check.
 *
 * ⚠️ **PURE.** No clock — `asOf` is the stored capture time, carried through. A
 * relative time would be a claim about now.
 */

/** ⚠️ One subject kind, exactly as the projection stated it. */
export interface ProjectedSubjectKindView {
  readonly subjectKind: string;
  /** 🛑 The three states stay three. 🚫 Never collapsed into "empty". */
  readonly state: 'modelled' | 'never-captured' | 'captured-nothing-recorded';
  /** ⚠️ AGE's own labels, in the projection's order. 🚫 Never re-sorted. */
  readonly labels: readonly string[];
  /** 🛑 Entries AGE holds and could not name. 🚫 Never dropped silently. */
  readonly unreadableEntryCount: number;
  /** 🛑 The projection's own reason, verbatim. 🚫 Never re-worded here. */
  readonly because: string;
}

export interface ClientContextProjectionView {
  readonly bifId: string;
  /** 🛑 When the context was CAPTURED. 🚫 Not when it was projected or shown. */
  readonly asOf: string;
  readonly subjectKinds: readonly ProjectedSubjectKindView[];
  /** ⚠️ Limitations, 🚫 never negative evidence about the business. */
  readonly notCaptured: readonly string[];
  /** 🚫 A screen cannot drop these; they are what the answer is not. */
  readonly notices: readonly string[];
  /** 🛑 Always present, whatever the projection contains. */
  readonly howThisReachesAPeerNotice: string;
}

/**
 * 🛑 The one sentence this module authors — and it is about AGE's surface, never
 * about the business. 🚫 It is not softened to "coming soon": an operator
 * reading this screen must not conclude that peers are already being served.
 *
 * ⚠️ **CORRECTED AT ADR-0071.** The previous wording said no peer could ask
 * because AGE "cannot yet verify a presented credential". Both halves of that
 * had stopped being true: credential verification shipped (ADR-0068 §0.1b), and
 * ADR-0071 D1 then decided that in V1 **no peer asks at all — the operator
 * carries it**. 🚫 Describing a decided architecture as a missing feature told
 * the operator to wait for something nobody is building.
 */
export const HOW_THIS_REACHES_A_PEER_NOTICE =
  'No peer product can ask AGE for this, and in V1 none is meant to: the operator is the ' +
  'transport. You carry this answer to the peer yourself, unchanged. That is a V1 transport ' +
  'constraint and not a permanent one. Nothing has been sent from this screen, and no peer ' +
  'product contains AGE code — so this is not evidence that any peer has received it, asked for ' +
  'it, or is being served.';

/**
 * @param projection as `projectClientContext` produced it. ⚠️ Rendered in the
 *   order given, with every string carried through unchanged.
 */
export function presentClientContextProjection(
  projection: Readonly<ClientContextProjection>,
): ClientContextProjectionView {
  const subjectKinds: ProjectedSubjectKindView[] = projection.subjectKinds.map((kind) => ({
    subjectKind: kind.subjectKind,
    state: kind.state,
    labels: Object.freeze([...kind.labels]),
    unreadableEntryCount: kind.unreadableEntryCount,
    // 🚫 Carried, never re-worded. The projection's reason IS the answer.
    because: kind.because,
  }));

  return {
    bifId: projection.bifId,
    // ⚠️ The stored capture time. 🚫 Never re-formatted into a relative phrase.
    asOf: projection.asOf,
    subjectKinds: Object.freeze(subjectKinds),
    notCaptured: Object.freeze([...projection.notCaptured]),
    notices: Object.freeze([...projection.notices]),
    howThisReachesAPeerNotice: HOW_THIS_REACHES_A_PEER_NOTICE,
  };
}
