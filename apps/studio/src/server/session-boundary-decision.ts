import type { SessionPrincipal, SessionVerification } from '@age/session-store';

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
   * 🛑 The row verified as a PLATFORM principal, and the page being asked for
   * is a TENANT page (ADR-0083 D1).
   *
   * ⚠️ **THIS IS A REFUSAL BY `requireVerifiedSession`, 🚫 NOT BY THE
   * BOUNDARY.** The boundary now ADMITS a platform principal — it is a real
   * principal, and pretending otherwise is what forced the old
   * `platform-scope-not-yet-served`. What has 🚫 not been authorized is a
   * platform RENDERING (ADR-0083 §"what this does not authorize"), so the
   * sixteen tenant pages, whose type has not moved a byte, refuse it here.
   *
   * 🚫 **THE FIX IS NEVER TO COMPARE AN ABSENT ORGANIZATION AGAINST THE PINNED
   * ONE.** That is the substitution ADR-0082 D4 forbids, and it would read as a
   * working page.
   */
  | 'platform-principal-on-a-tenant-page';

export type BoundaryDecision =
  /**
   * 🛑 **THE PRINCIPAL, 🚫 NOT THE SESSION** (ADR-0083 D1). A platform
   * principal is its own type with 🚫 no organization field at all, so there is
   * nothing here for a caller to read an absent tenant out of — it has to
   * NARROW, and the compiler makes it.
   */
  | { readonly kind: 'admitted'; readonly principal: SessionPrincipal }
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

  // 🛑 **THE ORGANIZATION CHECK IS WRITTEN OVER THE TENANT ARM ALONE, AND THE
  // NARROWING IS THE COMPILER'S.** A platform principal has 🚫 no
  // `organizationId` to compare, so this is not a case that was skipped — it is
  // a case that cannot be expressed. ⚠️ A future edit that reached for
  // `input.lookupOrganizationId` on the platform arm would be filing a platform
  // principal under the pinned tenant, which ADR-0082 D4 forbids by name.
  if (
    principal.scope === 'tenant' &&
    principal.session.organizationId !== input.lookupOrganizationId
  ) {
    return { kind: 'refused', reason: 'organization-mismatch' };
  }

  // ⚠️ **ADMITTED SAYS WHO, AND STILL 🚫 NOTHING ABOUT REACH.** A platform
  // principal is admitted HERE and is refused by `requireVerifiedSession`, which
  // serves tenant pages — admission and rendering are two decisions, and
  // collapsing them is how the wrong one gets relaxed.
  return { kind: 'admitted', principal };
}
