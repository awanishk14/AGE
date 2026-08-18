import { googleAuthorizationUrl } from '@age/google-sign-in';
import { serializeHandshakeCookies } from '@age/session-cookie';

import {
  googleSignInConfiguration,
  mintOpaqueValue,
  sessionLookupOrganizationId,
} from '@/server/operator-environment';

export const dynamic = 'force-dynamic';

/**
 * Beginning a sign-in — ADR-0079 §6 slice 3.
 *
 * 🛑 **THIS ROUTE MINTS A HANDSHAKE, 🚫 NOT A CREDENTIAL.** The `state` and the
 * `nonce` admit nobody: one makes a forged callback detectable, the other makes
 * a replayed identity token detectable. The session is minted at the END of the
 * callback, and only for an account a human already provisioned — **AGE mints
 * nothing.**
 *
 * ⚠️ **A POST, 🚫 NOT A GET.** A GET here is a link, and a link is something a
 * third-party page can point a browser at to overwrite the handshake cookies of
 * a sign-in already in flight. The button on `/sign-in` submits a form.
 *
 * 🚫 **NOTHING ABOUT THE CALLER IS READ.** No email, no hint, no `login_hint`,
 * no redirect target from the query string. An `?next=` parameter would be an
 * open redirect on the one route an unauthenticated caller can reach, and the
 * console has exactly one destination anyway.
 */
export async function POST(): Promise<Response> {
  const configuration = googleSignInConfiguration();
  const lookupOrganizationId = sessionLookupOrganizationId();

  // 🛑 **BOTH, BEFORE ANYTHING.** A console that knows its Google client but not
  // its organization can complete a whole Google round trip and then admit
  // nobody — which reads to the operator as "Google rejected me". ⚠️ The refusal
  // names the HOST's problem here, deliberately, because it is not the caller's.
  if (configuration === undefined || lookupOrganizationId === undefined) {
    return refuse('not-configured');
  }

  const state = mintOpaqueValue();
  const nonce = mintOpaqueValue();

  // ⚠️ Built by the pure package, which refuses a non-https redirect URI and a
  // handshake value that is not 32 bytes of hex. 🚫 There is no branch here that
  // could assemble a weaker request.
  const authorization = googleAuthorizationUrl({
    clientId: configuration.clientId,
    redirectUri: configuration.redirectUri,
    state,
    nonce,
  });

  const headers = new Headers({ Location: authorization });

  // ⚠️ Two `Set-Cookie` headers, appended — 🚫 not joined. A single header with
  // two cookies in it is not two cookies.
  for (const cookie of serializeHandshakeCookies({ state, nonce })) {
    headers.append('Set-Cookie', cookie);
  }

  // ⚠️ 303, so the browser follows with GET. ⚠️ This `Location` is ABSOLUTE
  // because it is Google's — a constant from `@age/google-sign-in`, 🚫 never a
  // host from a header, a claim or the environment. Every redirect back into
  // AGE stays relative, for the reason `refuse` states.
  return new Response(null, { status: 303, headers });
}

/**
 * 🛑 **A RELATIVE `Location` IS A SECURITY DECISION, 🚫 NOT A STYLE.**
 *
 * ⚠️ MEASURED ON THE REAL DEPLOYMENT: inside its container the console binds
 * `0.0.0.0`, so an absolute redirect built from `request.url` sent a browser to
 * `http://0.0.0.0:3100/…`, which is not a destination. 🚫 And the fix is NOT to
 * read a forwarded host header: `request.url` derives from a header the CALLER
 * controls, so an absolute redirect built from it is a Host-header injection
 * primitive on a route an unauthenticated caller on the public internet can
 * reach. A relative reference leaves no host in this code to poison.
 */
function refuse(marker: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: `/sign-in?refused=${marker}` },
  });
}
