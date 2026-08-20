import { expireActingOrganizationCookie, expireSessionCookie } from '@age/session-cookie';

import { endRequestSession } from '@/server/session-boundary';

export const dynamic = 'force-dynamic';

/**
 * Signing out — ADR-0074 D3.
 *
 * 🛑 **THE ORDER IS THE ARGUMENT: REVOKE FIRST, THEN EXPIRE THE COOKIE.** A
 * logout that only clears the cookie is not a logout — it ends the browser's
 * habit while the token stays valid in anything that copied it. `revokedAt` is
 * written to the row FIRST, so a crash between the two steps leaves the session
 * DEAD and the cookie stale, 🚫 never the reverse.
 *
 * ⚠️ **PROVED BY THE COOKIE BEING REFUSED AFTERWARDS, 🚫 NOT BY THIS REDIRECT.**
 * Landing on the sign-in screen shows only that the browser stopped sending the
 * reference. The test that matters presents the SAME cookie again and requires
 * a refusal.
 *
 * ⚠️ **POST ONLY.** A `GET /sign-out` is a logout any image tag on any page
 * could trigger; `SameSite=Strict` covers the cookie, but a route that ends a
 * session on a read is the wrong shape regardless.
 */
// ⚠️ 🚫 NO PARAMETER. The redirect below is RELATIVE, so nothing here reads the
// request's host — see the note in `sign-in/callback/route.ts`.
export async function POST(): Promise<Response> {
  // 🚫 The outcome is not branched on. `already-ended` means somebody revoked it
  // first, which is the same destination — 🚫 and it is never reported as an
  // error, because nothing about it needs fixing.
  await endRequestSession();

  const headers = new Headers({ Location: '/sign-in' });

  headers.append('Set-Cookie', expireSessionCookie());

  // 🛑 **THE CHOICE GOES WITH THE SESSION** (ADR-0085). ⚠️ It is not a
  // credential and clearing it revokes nothing — but a choice left behind is a
  // stale answer waiting for whoever signs in next at the same browser, and
  // they would be placed somewhere without being asked. 🚫 It is expired AFTER
  // the revocation above, for the same reason the session cookie is: the row
  // dying first is the failure mode that is safe.
  headers.append('Set-Cookie', expireActingOrganizationCookie());

  return new Response(null, { status: 303, headers });
}
