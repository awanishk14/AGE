import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { readSessionCookie } from '@age/session-cookie';
import type { VerifiedSession } from '@age/session-store';

import {
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

  if (decision.kind === 'admitted') return decision.session;

  if (decision.reason === 'deployment-not-configured') {
    // ⚠️ NAMES THE VARIABLE, 🚫 never a value. This is a misconfiguration of the
    // machine, and an operator shown "sign in" would try their credential
    // forever against a console that can admit nobody.
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

  return revokeSessionById(decision.session.organizationId, decision.session.sessionId);
}
