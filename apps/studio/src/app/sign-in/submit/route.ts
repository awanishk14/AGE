import { MAXIMUM_SESSION_LIFETIME_SECONDS } from '@age/session-store';
import { serializeSessionCookie } from '@age/session-cookie';

import { sessionLookupOrganizationId, verifySessionToken } from '@/server/operator-environment';

export const dynamic = 'force-dynamic';

/**
 * Signing in — ADR-0074 §7 slice 2.
 *
 * 🛑 **SIGNING IN IS VERIFICATION WITH A COOKIE SET AS A CONSEQUENCE.** No row is
 * created, no token is minted, no account is provisioned. `age_app` holds
 * `GRANT SELECT` plus `GRANT UPDATE ("revoked_at")` and no INSERT, so even a
 * defect here could not become an issuance path.
 *
 * ⚠️ **A ROUTE HANDLER RATHER THAN A SERVER ACTION, FOR ONE REASON:** the
 * `Set-Cookie` value comes from `serializeSessionCookie`, which owns `HttpOnly`,
 * `Secure`, `SameSite=Strict`, `Path=/`, the `__Host-` prefix and the lifetime
 * ceiling in ONE place. Setting the cookie through the framework's own helper
 * would be a SECOND definition of those attributes, and the copy that quietly
 * loses `Secure` is the copy that still passes its own tests.
 *
 * 🚫 **THE TOKEN IS NEVER LOGGED, NEVER ECHOED AND NEVER PUT IN A URL.** It
 * arrives in a POST body and leaves in a cookie; the redirect below carries
 * nothing but a refusal marker.
 */
export async function POST(request: Request): Promise<Response> {
  const lookupOrganizationId = sessionLookupOrganizationId();

  if (lookupOrganizationId === undefined) {
    return refuse('not-configured', request);
  }

  const form = await request.formData();
  const presented = form.get('token');

  if (typeof presented !== 'string' || presented === '') {
    return refuse('1', request);
  }

  const verification = await verifySessionToken(presented, lookupOrganizationId);

  if (verification.outcome === 'unverified') {
    // ⚠️ 🚫 THE FIVE REASONS ARE NOT COLLAPSED INSIDE AGE — they are collapsed on
    // the way OUT, to an unauthenticated caller, and only here. Telling them
    // `revoked` rather than `no-such-session` confirms the token was once real.
    return refuse('1', request);
  }

  // 🚫 The row is the authority, re-checked on EVERY later request. This cookie
  // is a browser convenience with a ceiling: if it outlives the row, the next
  // request is refused and the operator is sent back here. ⚠️ That is the
  // fail-CLOSED direction, and it is why the ceiling is acceptable while a
  // cookie that could outlive the ceiling is not.
  const cookie = serializeSessionCookie(presented, MAXIMUM_SESSION_LIFETIME_SECONDS);

  return new Response(null, {
    // ⚠️ 303, so the browser follows with GET. A 302 after a POST is
    // under-specified and some clients re-POST.
    status: 303,
    headers: { Location: new URL('/', request.url).toString(), 'Set-Cookie': cookie },
  });
}

function refuse(marker: string, request: Request): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: new URL(`/sign-in?refused=${marker}`, request.url).toString() },
  });
}
