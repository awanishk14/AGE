/**
 * The entitlement question — the missing middle (ADR-0058 D1, D2, D8 item 1).
 *
 * AGE has always been able to say WHO acted (`OperatorPrincipal`, caller-asserted)
 * and WHAT a record is about (`clientId` + a derived `organizationId`). It has
 * never been able to say WHAT SOMEONE MAY ACT ON. This module is that question,
 * and today its only honest answer is that nobody has looked.
 *
 * 🛑 THIS IS THE ONE IMPLEMENTATION OF THE ENTITLEMENT QUESTION IN THE REPO, and
 * a guard fails the build if a second appears. The reason is the
 * `openLocalPrismaCaptureConnection` reason, unchanged: **the copy that gets
 * relaxed still passes its own tests.**
 *
 * 🚫 THERE IS NO CALLER, DELIBERATELY, AND A GUARD ASSERTS THAT. ADR-0058 D8
 * authorizes the question as types and one pure function and nothing else — no
 * middleware, no route guard, no session, no read path. Wiring this into a query
 * would silently discharge ADR-0055 D7, which is 🛑 still undischarged.
 *
 * Pure: no clock, no ids, no randomness, no I/O.
 */

/**
 * The three-valued answer (ADR-0058 D2).
 *
 * 🚫 IT MUST NEVER COLLAPSE TO A BOOLEAN. `not-established` is not a shy
 * `denied`: a denial is a decision AGE made after looking, and `not-established`
 * means AGE has no way to look at all. Collapsing them loses the only
 * distinction that makes the refusal safe to ship, because a blanket `false`
 * cannot be told apart from a decided denial — and the first thing anyone adds
 * to a blanket `false` is a bypass to get past it.
 *
 * ⚠️ `not-established` is an EPISTEMIC STATE, NOT AN ERROR, and it maps to
 * `not-assessed` in `17_DESIGN_SYSTEM.md` §4. 🚫 It must never render as a
 * failure, a warning, or a red state.
 */
export type EntitlementAnswer = 'granted' | 'denied' | 'not-established';

/**
 * What the caller has managed to prove about who is asking.
 *
 * ⚠️ THIS TYPE HAS EXACTLY ONE INHABITANT TODAY, AND THAT IS THE POINT. There is
 * no identity provider and no session (ADR-0058 §5 — recorded is not
 * authorized), so `none` is the only thing a caller can honestly construct.
 *
 * 🚫 An `OperatorPrincipal` IS NOT AN AUTHENTICATION AND MUST NEVER BE ACCEPTED
 * HERE (ADR-0053 D4). It is caller-asserted provenance — it says a named human
 * acted, and it is believed. Passing it in as proof of identity would make the
 * caller grant itself access by naming itself, which is the same error class as
 * letting a record grant access to itself.
 *
 * ⚠️ When authentication arrives it adds an arm here, and every `switch` over
 * this union becomes a compile error until it is revisited. That is the intended
 * cost.
 */
export type Authentication = { readonly kind: 'none' };

/** The only authentication anyone can construct today. */
export const NO_AUTHENTICATION: Authentication = Object.freeze({ kind: 'none' });

/**
 * What the caller wants to act on.
 *
 * 🛑 THE TWO ARMS ARE NOT A DECISION ABOUT THE TENANT BOUNDARY. ADR-0058 §6
 * open question 1 — _is the tenant boundary the organization, or the client?_ —
 * is 🛑 **UNANSWERED**, and the Product Owner's acceptance did not answer it
 * (§0.1b). Both arms exist so the question can be ASKED about either without
 * this module quietly picking the answer, and 🚫 neither arm is privileged.
 *
 * ⚠️ A test asserts both arms produce the SAME answer, which is what makes the
 * claim "no boundary has been chosen" checkable rather than merely stated.
 */
export type EntitlementSubject =
  | { readonly kind: 'organization'; readonly organizationId: string }
  | { readonly kind: 'client'; readonly clientId: string };

export interface EntitlementQuestion {
  readonly authentication: Authentication;
  readonly subject: EntitlementSubject;
}

export interface EntitlementDecision {
  readonly answer: EntitlementAnswer;
  /**
   * Why the answer is what it is, in words that can be shown to an operator.
   *
   * 🚫 It names no subject value. A refusal message must not carry a real
   * client's or organization's identifier into a log (ADR-0054 D3).
   */
  readonly because: string;
}

/**
 * ⚠️ THE WORDS ARE LOAD-BEARING AND ARE WHAT THE SINGLE-IMPLEMENTATION GUARD
 * MATCHES ON. Changing them is fine; changing them in a second copy is not.
 */
const NOT_ESTABLISHED_BECAUSE =
  'AGE cannot say what anyone may act on, because no authenticated identity exists. ' +
  'Access is limited by the loopback bind only (ADR-0057 D2), which is necessary and not sufficient.';

/**
 * Ask the entitlement question.
 *
 * 🚫 THERE IS NO DEFAULT ARM, NO `allowAll`, NO `SYSTEM_PRINCIPAL`, NO
 * `entitlementOrDefault` AND NO DEV-MODE BYPASS (ADR-0058 D2). While there is no
 * authenticated principal the answer is `not-established`, and it does not
 * depend on the subject — because depending on the subject would be the scope
 * granting access to itself (D1), the more tempting error and the more dangerous
 * one.
 */
export function askEntitlement(question: EntitlementQuestion): EntitlementDecision {
  switch (question.authentication.kind) {
    case 'none':
      return Object.freeze({
        answer: 'not-established' as EntitlementAnswer,
        because: NOT_ESTABLISHED_BECAUSE,
      });
  }
}
