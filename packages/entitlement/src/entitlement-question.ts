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
 * 🚫 THERE IS STILL NO CALLER, DELIBERATELY, AND A GUARD STILL ASSERTS THAT.
 * ADR-0061 A3 authorizes the DECISION — an authenticated arm and real `granted`
 * and `denied` answers — and 🚫 it does not authorize a middleware, a route
 * guard, a session store or a read path. Each of those is its own slice, and
 * wiring this into a query would silently discharge ADR-0055 D7.
 *
 * Pure: no clock, no ids, no randomness, no I/O.
 */

import { acceptVerifiedSession, type VerifiedSession } from './verified-session';

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
 * ⚠️ **THE SECOND ARM ARRIVED WITH ADR-0061 A2, AND IT COST WHAT IT WAS MEANT TO
 * COST** — the `switch` below stopped compiling until every arm was answered
 * deliberately, and 🚫 **no `default` arm was added to silence it** (A3). A
 * `default` would answer a question nobody had thought about, which is the whole
 * mechanism this union exists to prevent.
 *
 * 🚫 An authentication is a VERIFIED SESSION or it is NOTHING. There is no
 * `trusted-caller` arm, no `local` arm and no `development` arm: A2 is explicit
 * that AGE trusts a verified session and nothing else.
 *
 * 🚫 An `OperatorPrincipal` IS NOT AN AUTHENTICATION AND MUST NEVER BE ACCEPTED
 * HERE (ADR-0053 D4, unchanged by A2 — the principal is NOT promoted). It is
 * caller-asserted provenance: it says a named human acted, and it is believed.
 * Passing it in as proof of identity would make the caller grant itself access
 * by naming itself, which is the same error class as letting a record grant
 * access to itself.
 */
export type Authentication =
  | { readonly kind: 'none' }
  | { readonly kind: 'verified-session'; readonly session: VerifiedSession };

/** The only authentication anyone can construct today. */
export const NO_AUTHENTICATION: Authentication = Object.freeze({ kind: 'none' });

/**
 * What the caller wants to act on.
 *
 * 🛑 **THE BOUNDARY HAS NOW BEEN CHOSEN, AND THE TWO ARMS ARE NO LONGER
 * SYMMETRIC** — ADR-0062 **D1**: the tenant is the ORGANIZATION. ADR-0058 §6
 * open question 1 is answered, by the Product Owner and not by this module.
 *
 * ⚠️ The symmetry test that pinned "no boundary has been chosen" was therefore
 * **deliberately changed in this slice, citing ADR-0062 D1** (ADR-0061 A3).
 * 🚫 It was not quietly deleted — it now pins the asymmetry and says why, so the
 * choice stays as checkable as its absence used to be.
 *
 * 🚫 The `client` arm is NOT the organization arm with extra filtering
 * (ADR-0062 D2). A client is a SUBJECT of isolation inside a tenant, and which
 * tenant a given client belongs to is a fact held by the client registry — not
 * one this module may infer, and 🚫 not one a caller may assert by passing it in.
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
 * ⚠️ Both session-answer sentences name a RELATIONSHIP and 🚫 never an
 * identifier. A decision is logged; an identifier in a decision is a real
 * organization's name in a log file (ADR-0054 D3).
 */
const GRANTED_BECAUSE =
  'The verified session speaks for this organization, which is the tenant (ADR-0062 D1).';

const DENIED_BECAUSE =
  'The verified session speaks for a different organization. This is a decision AGE made ' +
  'after looking, not an absence of information.';

/**
 * 🛑 A CLIENT SUBJECT IS `not-established` EVEN WITH A VERIFIED SESSION, and
 * that is not a shortcut. Answering it needs the client-to-organization binding
 * from the client registry; taking it from the caller would let the caller
 * choose the answer, and inferring it here would make the inner boundary "the
 * organization query, minus some rows" — the one shape ADR-0062 D2 refuses by
 * name. 🚫 It must never be softened into `denied`: AGE has not looked.
 */
const CLIENT_NOT_ESTABLISHED_BECAUSE =
  'AGE cannot say whether this session may act on that client, because the client-to-organization ' +
  'binding is not available to this decision. The session establishes an organization only, and ' +
  'no authenticated identity exists for a client (ADR-0062 D2).';

/**
 * Ask the entitlement question.
 *
 * 🚫 THERE IS NO DEFAULT ARM, NO `allowAll`, NO `SYSTEM_PRINCIPAL`, NO
 * `entitlementOrDefault` AND NO DEV-MODE BYPASS (ADR-0058 D2, ADR-0061 A3).
 * Every arm of both unions is enumerated; adding an arm to either must break the
 * build, and a `default` here would silently answer a question nobody asked.
 *
 * ⚠️ WITHOUT A SESSION THE ANSWER IS `not-established` AND DOES NOT DEPEND ON
 * THE SUBJECT — depending on the subject would be the scope granting access to
 * itself (ADR-0058 D1), the more tempting error and the more dangerous one.
 *
 * ⚠️ WITH A SESSION THE ANSWER DEPENDS ON THE ORGANIZATION AND NOTHING ELSE. It
 * is decided by comparing the session's tenant with the subject's, and 🚫 the
 * session grants nothing beyond it — ADR-0062 D3: admin is never a bypass, and
 * there is no arm here for one to arrive through.
 */
export function askEntitlement(question: EntitlementQuestion): EntitlementDecision {
  switch (question.authentication.kind) {
    case 'none':
      return Object.freeze({
        answer: 'not-established' as EntitlementAnswer,
        because: NOT_ESTABLISHED_BECAUSE,
      });
    case 'verified-session': {
      // ⚠️ Re-accepted at the point of USE, not merely at the point of
      // construction. A caller can build the object literal itself, and a blank
      // organization would otherwise compare equal to a blank subject.
      const session = acceptVerifiedSession(question.authentication.session);

      switch (question.subject.kind) {
        case 'organization':
          return question.subject.organizationId === session.organizationId
            ? Object.freeze({ answer: 'granted' as EntitlementAnswer, because: GRANTED_BECAUSE })
            : Object.freeze({ answer: 'denied' as EntitlementAnswer, because: DENIED_BECAUSE });
        case 'client':
          return Object.freeze({
            answer: 'not-established' as EntitlementAnswer,
            because: CLIENT_NOT_ESTABLISHED_BECAUSE,
          });
      }
    }
  }
}
