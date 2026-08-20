import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { readSessionCookie } from '@age/session-cookie';
import {
  acceptVerifiedSession,
  hashSessionToken,
  type VerifiedPlatformSession,
  type VerifiedSession,
} from '@age/session-store';

import { chosenActingOrganization } from './acting-organization';
import {
  revokePlatformSessionByDigest,
  revokeSessionById,
  sessionLookupOrganizationId,
  verifySessionToken,
} from './operator-environment';
import { decideSessionBoundary, type BoundaryDecision } from './session-boundary-decision';

/**
 * **THE SESSION BOUNDARY** — ADR-0074 §7 slice 2, and the thing that makes
 * *"the tunnel is the authentication"* stop being true.
 *
 * 🛑 **COMPOSED IN `apps/studio` ONLY.** ADR-0074 refuses shared authentication
 * middleware BY NAME, because a middleware that "protects everything" also sits
 * in front of `apps/mcp`, whose trust boundary is settled and 🚫 must not move as
 * a side effect of a console gaining a login. The boundary is therefore a
 * FUNCTION this app's routes call, 🚫 never a framework hook that catches routes
 * nobody classified.
 *
 * 🛑 **AND IT IS NOT `middleware.ts` FOR A SECOND REASON.** Next middleware runs
 * on the edge runtime, which cannot reach Prisma — so a middleware boundary could
 * only check the cookie's SHAPE, never the ROW. A gate that admits a
 * well-formatted revoked token is worse than no gate, because it reads like one.
 *
 * 🛑 **IT RUNS BEFORE ANY PROTECTED QUERY.** `requireVerifiedSession()` is the
 * FIRST statement of every protected page, above any `@/server/*-actions` call,
 * and a route contract test asserts that ordering rather than trusting it. The
 * Product Owner's words: *"unauthenticated access denied before protected data
 * queries execute"* — 🚫 not denied while rendering, and 🚫 not denied afterwards.
 *
 * 🚫 **BEING ADMITTED IS NOT BEING AUTHORIZED** (ADR-0046 D5). A verified session
 * says WHO is asking. What they may reach is `askEntitlement` over
 * `session.organizationId`, always, afterwards — 🚫 and never over a `clientId`
 * off a URL (AGE-INV-SEL-1; slice 3 wires it).
 *
 * ⚠️ **READING REQUEST HEADERS IS NOT A PROCESS EFFECT.** `headers()` is the
 * inbound request, not the machine — no clock, no filesystem, no environment, no
 * database. Every one of those still lives in `operator-environment.ts` alone.
 */

/**
 * The token this request presents, if it presents one at all.
 *
 * ⚠️ **PARSING IS `@age/session-cookie`'s, 🚫 NOT REIMPLEMENTED HERE.** That
 * module owns the `__Host-` name and the opaque-token shape; a second parser is
 * a second definition of what counts as a token.
 */
async function presentedToken(): Promise<string | undefined> {
  const requestHeaders = await headers();

  return readSessionCookie(requestHeaders.get('cookie') ?? undefined);
}

/**
 * Decides this request's admission WITHOUT redirecting.
 *
 * ⚠️ Exported so the sign-out route can end the session it is actually holding,
 * and so a test can observe a REFUSAL rather than only a redirect. 🚫 A caller
 * that wants a protected page must still use `requireVerifiedSession`.
 */
export async function assessRequestSession(): Promise<BoundaryDecision> {
  const lookupOrganizationId = sessionLookupOrganizationId();
  const token = await presentedToken();

  // ⚠️ 🚫 THE STORE IS NOT TOUCHED UNLESS BOTH FACTS EXIST. A console with no
  // configured organization, or a request with no cookie, produces no query —
  // and that is observable, not merely claimed.
  const verification =
    lookupOrganizationId === undefined || token === undefined
      ? undefined
      : await verifySessionToken(token, lookupOrganizationId);

  return decideSessionBoundary({
    lookupOrganizationId,
    presentedCookie: token,
    verification,
  });
}

/**
 * The gate. Returns the session, or does not return.
 *
 * 🛑 **A REFUSAL LEAVES BY `redirect`, WHICH THROWS.** That is deliberate: there
 * is no falsy return value a caller could forget to check, and no way to write
 * the call and carry on. 🚫 Do not wrap this in a `try`/`catch` that swallows the
 * redirect.
 *
 * 🚫 **THE OPERATOR IS NEVER TOLD WHICH REFUSAL APPLIED** — except the one that
 * is the HOST's fault. Telling an unauthenticated caller `revoked` rather than
 * `no-such-session` confirms that the token they hold was once real.
 */
export async function requireVerifiedSession(): Promise<VerifiedSession> {
  const decision = await assessRequestSession();

  if (decision.kind === 'admitted') {
    // 🛑 **A PLATFORM PRINCIPAL IS ADMITTED, AND SINCE ADR-0085 IT REACHES A
    // TENANT PAGE — BY SAYING WHICH TENANT.** Until 2026-08-20 this arm
    // redirected to `/sign-in?refused=scope-not-served`, which told a
    // correctly-provisioned platform operator that the console does not serve
    // them. ADR-0085 replaces that dead end with a CHOICE.
    //
    // 🛑 **WHAT ADR-0082 D4 FORBIDS IS STILL FORBIDDEN, AND THE LINES BELOW ARE
    // WHERE THAT IS VISIBLE.** D4 refuses an absent organization being
    // DEFAULTED, COALESCED or GUESSED — `?? sessionLookupOrganizationId()`. It
    // does not refuse an operator NAMING one. So the organization here comes
    // from an explicit act, is re-checked against the closed set the HOST
    // configured on every request, and 🚫 has no fallback: an operator who has
    // not chosen is sent to choose, 🚫 never placed somewhere.
    //
    // ⚠️ **THE RESULT IS AN ORDINARY TENANT SESSION CARRYING 🚫 NO EXTRA
    // POWER.** It is built through the same `acceptVerifiedSession` every other
    // session passes, holds the same three fields, and every read downstream
    // still goes through `askEntitlement` over `organizationId`. There is 🚫 no
    // `isPlatform` flag on it — ADR-0062 D3, admin is never a bypass.
    if (decision.principal.scope === 'platform') {
      const actingOrganizationId = await chosenActingOrganization();

      // 🚫 **NOT A REFUSAL, AND 🚫 NOT `/sign-in`.** This operator IS signed
      // in. Sending them to the door would be the ADR-0084 defect in a second
      // costume: a working session rendered as a failed one.
      if (actingOrganizationId === undefined) redirect('/platform');

      return acceptVerifiedSession({
        sessionId: decision.principal.session.sessionId,
        organizationId: actingOrganizationId,
        accountId: decision.principal.session.accountId,
      });
    }

    return decision.principal.session;
  }

  if (decision.reason === 'deployment-not-configured') {
    // ⚠️ NAMES THE VARIABLE, 🚫 never a value. This is a misconfiguration of the
    // machine, and an operator shown "sign in" would try their credential
    // forever against a console that can admit nobody.
    redirect('/sign-in?refused=not-configured');
  }

  redirect('/sign-in');
}

/**
 * The gate for the page that belongs to a PLATFORM operator — ADR-0085.
 *
 * 🛑 **A SEPARATE FUNCTION, BECAUSE IT RETURNS A SEPARATE TYPE.** ADR-0083 D1
 * chose two principal types over one nullable field precisely so that a caller
 * has to say which it serves. This one serves the platform arm, returns a
 * `VerifiedPlatformSession`, and 🚫 there is still no conversion between them:
 * `requireVerifiedSession` above builds a tenant session out of an explicit
 * CHOICE plus three individually-checked fields, 🚫 not out of this value.
 *
 * ⚠️ **A TENANT OPERATOR IS SENT HOME, 🚫 NOT REFUSED.** They are signed in and
 * this page is simply not theirs; `/` is where their work is. 🚫 Telling them
 * "refused" would be a false alarm about a working account.
 */
export async function requireVerifiedPlatformSession(): Promise<VerifiedPlatformSession> {
  const decision = await assessRequestSession();

  if (decision.kind === 'admitted') {
    if (decision.principal.scope === 'platform') return decision.principal.session;

    redirect('/');
  }

  if (decision.reason === 'deployment-not-configured') {
    redirect('/sign-in?refused=not-configured');
  }

  redirect('/sign-in');
}

/**
 * Ends the session this request is holding, server-side.
 *
 * 🛑 **THIS IS THE HALF THAT IS ACTUALLY A LOGOUT** (ADR-0074 D3). The cookie is
 * expired by the route that calls this, and 🚫 the cookie half must never ship
 * alone — clearing it discards the operator's copy of the token, not the token.
 *
 * ⚠️ Returns `'already-ended'` for a session that was already revoked or that no
 * longer verifies. 🚫 It is not an error, and 🚫 it is not "revoked" either.
 */
export async function endRequestSession(): Promise<'revoked' | 'already-ended'> {
  const decision = await assessRequestSession();

  if (decision.kind !== 'admitted') return 'already-ended';

  // 🛑 **BOTH PRINCIPALS CAN LOG OUT, AND THAT IS 🚫 NOT A SECOND
  // REVOCATION RULE** (ADR-0083 D3). What differs is the SCOPE the one
  // `updateMany` runs inside: a tenant, or the digest this request is already
  // presenting. ⚠️ `assessSession` remains the only place revocation is READ,
  // for both.
  if (decision.principal.scope === 'platform') {
    // ⚠️ **THE FENCE IS THE DIGEST OF THE TOKEN THIS REQUEST IS PRESENTING**
    // (ADR-0083 D5), and it is re-derived from that token rather than carried
    // on the principal: `VerifiedPlatformSession` holds `sessionId` and
    // `accountId` and 🚫 deliberately no credential material. ⚠️ The hashing
    // is `@age/session-store`'s one implementation, 🚫 not a second copy.
    const token = await presentedToken();

    // 🚫 An admitted principal presented a token by construction; if that ever
    // stops being true, this ends nothing rather than ending something else.
    if (token === undefined) return 'already-ended';

    return revokePlatformSessionByDigest(
      hashSessionToken(token),
      decision.principal.session.sessionId,
    );
  }

  return revokeSessionById(
    decision.principal.session.organizationId,
    decision.principal.session.sessionId,
  );
}
