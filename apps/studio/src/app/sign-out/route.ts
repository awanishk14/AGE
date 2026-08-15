import { expireSessionCookie } from '@age/session-cookie';

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
export async function POST(request: Request): Promise<Response> {
  // 🚫 The outcome is not branched on. `already-ended` means somebody revoked it
  // first, which is the same destination — 🚫 and it is never reported as an
  // error, because nothing about it needs fixing.
  await endRequestSession();

  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL('/sign-in', request.url).toString(),
      'Set-Cookie': expireSessionCookie(),
    },
  });
}
