import type { SessionVerification, VerifiedSession } from '@age/session-store';

/**
 * The session boundary's DECISIONS — ADR-0074 §7 slice 2.
 *
 * 🛑 **PURE ON PURPOSE, AND SEPARATE FROM THE DOOR ON PURPOSE.** Every fact this
 * module needs arrives as an argument: the configured lookup organization, the
 * cookie value, the verification the store returned. It reads no clock, no
 * environment and no cookie jar, so the whole admit/refuse rule can be exercised
 * without a database and without a request.
 *
 * 🛑 **ADMISSION IS NOT AUTHORIZATION** (ADR-0046 D5, ADR-0068). Being admitted
 * says WHO is asking. What they may reach is `askEntitlement`, always,
 * afterwards, against `session.organizationId` — 🚫 never against anything this
 * module was handed.
 */

/**
 * ⚠️ **EVERY REFUSAL KEEPS ITS OWN REASON, AND THEY ARE NOT MERGED.** An expired
 * session, a revoked one, a token that never existed and a console that was
 * never told which tenant it serves are four different situations, and an
 * operator who cannot tell them apart cannot fix any of them.
 *
 * ⚠️ **WHAT THE OPERATOR IS SHOWN IS A SEPARATE DECISION FROM WHAT IS RECORDED**
 * — the SCREEN says only "sign in", because telling an unauthenticated caller
 * *which* of `no-such-session` / `revoked` / `expired` applied confirms whether a
 * token was ever real. 🚫 Do not render this reason to an unauthenticated caller.
 */
export type BoundaryRefusal =
  /** 🚫 No cookie was presented at all. The ordinary first visit. */
  | 'no-cookie'
  /** The presented value is not a session token by shape. */
  | 'malformed-token'
  /** No row carries that digest in this deployment's scope. */
  | 'no-such-session'
  /** 🛑 The row exists and was ENDED. This is what a real logout produces. */
  | 'revoked'
  /** 🛑 The row exists and its absolute expiry has passed. */
  | 'expired'
  /** A row exists but does not satisfy the session shape — refused, never repaired. */
  | 'unreadable'
  /**
   * 🛑 The deployment did not say which organization it serves, so it can admit
   * NOBODY. ⚠️ It is not "no sessions exist" and 🚫 must never be rendered as a
   * rejected credential — the fault is the host's, not the operator's.
   */
  | 'deployment-not-configured'
  /**
   * 🛑 The verified row's organization is not the one this deployment looks up
   * in. Under RLS this should be unreachable; that is exactly why it is checked.
   * ⚠️ A boundary that only handles the cases it believes possible is a boundary
   * that fails open the day one of them turns out to be possible.
   */
  | 'organization-mismatch'
  /**
   * 🛑 The row verified, and it speaks for 🚫 NO organization — a PLATFORM
   * principal (ADR-0083 D1). This console does not serve one YET, so it says so
   * HERE, at the one composed edge, exactly as the sign-in callback declines to
   * ISSUE one.
   *
   * ⚠️ **THIS IS A NARROWING, 🚫 NOT A WIDENED GUARD.** The organization check
   * below is now written over the TENANT arm alone; a platform principal never
   * reaches it and 🚫 must never be made to satisfy it by comparing an absent
   * organization against the pinned one — that is the substitution ADR-0082 D4
   * forbids. 🚫 Nothing became reachable that was not reachable before.
   */
  | 'platform-scope-not-yet-served';

export type BoundaryDecision =
  | { readonly kind: 'admitted'; readonly session: VerifiedSession }
  | { readonly kind: 'refused'; readonly reason: BoundaryRefusal };

/**
 * Decides whether a presented cookie admits the caller.
 *
 * ⚠️ **THE ORDER IS THE ARGUMENT.** Configuration first (a console that cannot
 * name its tenant must not go on to imply a credential was wrong), then the
 * cookie's presence, then the store's verdict, then the organization agreement.
 * 🚫 No step may be skipped by a caller, because there is no way to call the
 * later ones on their own.
 */
export function decideSessionBoundary(input: {
  readonly lookupOrganizationId: string | undefined;
  readonly presentedCookie: string | undefined;
  /**
   * ⚠️ `undefined` when no lookup was performed — which is the ONLY honest value
   * when there was no configuration or no cookie to look anything up with.
   */
  readonly verification: SessionVerification | undefined;
}): BoundaryDecision {
  if (input.lookupOrganizationId === undefined) {
    return { kind: 'refused', reason: 'deployment-not-configured' };
  }

  if (input.presentedCookie === undefined || input.presentedCookie === '') {
    return { kind: 'refused', reason: 'no-cookie' };
  }

  if (input.verification === undefined) {
    // 🚫 An absent verdict is never an admission. A caller that forgot to look
    // the token up is refused, not trusted.
    return { kind: 'refused', reason: 'unreadable' };
  }

  if (input.verification.outcome === 'unverified') {
    return { kind: 'refused', reason: input.verification.reason };
  }

  const principal = input.verification.principal;

  if (principal.scope === 'platform') {
    return { kind: 'refused', reason: 'platform-scope-not-yet-served' };
  }

  if (principal.session.organizationId !== input.lookupOrganizationId) {
    return { kind: 'refused', reason: 'organization-mismatch' };
  }

  return { kind: 'admitted', session: principal.session };
}
