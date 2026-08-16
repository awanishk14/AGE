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
    return refuse('not-configured');
  }

  // 🛑 **A MALFORMED BODY IS A REFUSAL, 🚫 NOT AN EXCEPTION.** `formData()`
  // THROWS on a body that is not a form — an empty POST, a JSON body, a
  // truncated multipart. Unguarded, that produced a 500 from the one route an
  // unauthenticated caller on the public internet can reach, which is both a
  // wrong answer (nothing failed; a caller sent nonsense) and an invitation to
  // probe for a stack trace. ⚠️ It collapses into the SAME `refused=1` as a
  // wrong token: the shape of the request must not be distinguishable from the
  // correctness of the credential in it.
  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return refuse('1');
  }

  const presented = form.get('token');

  if (typeof presented !== 'string' || presented === '') {
    return refuse('1');
  }

  const verification = await verifySessionToken(presented, lookupOrganizationId);

  if (verification.outcome === 'unverified') {
    // ⚠️ 🚫 THE FIVE REASONS ARE NOT COLLAPSED INSIDE AGE — they are collapsed on
    // the way OUT, to an unauthenticated caller, and only here. Telling them
    // `revoked` rather than `no-such-session` confirms the token was once real.
    return refuse('1');
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
    headers: { Location: '/', 'Set-Cookie': cookie },
  });
}

/**
 * 🛑 **A RELATIVE `Location`, AND THAT IS A SECURITY DECISION, 🚫 NOT A STYLE.**
 *
 * These redirects used to be built with `new URL(path, request.url)`. ⚠️ MEASURED
 * ON THE REAL DEPLOYMENT: inside its container the console binds `0.0.0.0`, so
 * `request.url` became `http://0.0.0.0:3100/...` and the refusal sent a browser
 * to an address that is not a destination.
 *
 * 🚫 The fix is NOT to read a forwarded host header. `request.url` is derived
 * from a header the CALLER controls, so an absolute redirect built from it is a
 * Host-header injection primitive: on the one route an unauthenticated caller on
 * the public internet can reach, it would let that caller choose where a
 * refused sign-in lands. RFC 7231 allows a relative reference, the browser
 * resolves it against the address it actually used, and there is then no host
 * in this code at all to poison.
 */
function refuse(marker: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: `/sign-in?refused=${marker}` },
  });
}
