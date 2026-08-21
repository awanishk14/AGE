import { verifiedGoogleIdentity } from '@age/google-sign-in';
import {
  expireHandshakeCookies,
  readHandshakeCookies,
  serializeSessionCookie,
} from '@age/session-cookie';
import { decideSignInAcrossDirectories, type SignInRefusalReason } from '@age/sign-in-directory';

import {
  exchangeGoogleAuthorizationCode,
  googleSignInConfiguration,
  issueOperatorSession,
  issuePlatformSession,
  mintOpaqueValue,
  readPlatformDirectoryEntry,
  readSignInDirectoryEntry,
  sessionLookupOrganizationId,
  signInNow,
} from '@/server/operator-environment';

export const dynamic = 'force-dynamic';

/**
 * Completing a sign-in — ADR-0079 §6 slice 3.
 *
 * 🛑 **THIS IS NOW THE ONE ROUTE AN UNAUTHENTICATED CALLER ON THE PUBLIC
 * INTERNET CAN REACH THAT DOES ANYTHING**, so every input here is hostile until
 * proven otherwise, and 🚫 nothing it is handed may produce a 5xx. A 500 is the
 * response an attacker works to provoke, because it is where stack traces come
 * from.
 *
 * ⚠️ **THE ORDER OF THE CHECKS IS THE DESIGN.** Cheap and local first — the
 * handshake, then the `state` — so a forged callback never costs a request to
 * Google, let alone a database connection. The one authorized INSERT is the LAST
 * thing that happens, after four independent checks have passed.
 *
 * 🛑 **AGE MINTS NOTHING BUT THE SESSION.** Google says who this person is;
 * whether they may sign in is answered from `accounts` and `account_memberships`
 * that a human provisioned, and `age_app` holds `GRANT SELECT` on both. A defect
 * anywhere in this file cannot create an account, a membership or a role.
 */
export async function GET(request: Request): Promise<Response> {
  const configuration = googleSignInConfiguration();
  const lookupOrganizationId = sessionLookupOrganizationId();

  if (configuration === undefined || lookupOrganizationId === undefined) {
    return refuse('not-configured');
  }

  // 🛑 **THE QUERY STRING IS TAKEN OFF THE RAW TARGET AND THE HOST IS NEVER
  // PARSED AT ALL.** ⚠️ `new URL(request.url)` would read a host derived from a
  // header the CALLER controls, and `redirect-host-independence.test.ts` bans
  // that shape by name — 🚫 the guard was NOT widened to let this through, and
  // this is the narrower thing it always wanted: the callback's payload without
  // its envelope.
  const separator = request.url.indexOf('?');
  const parameters = new URLSearchParams(separator === -1 ? '' : request.url.slice(separator + 1));

  const handshake = readHandshakeCookies(request.headers.get('cookie') ?? undefined);

  // 🛑 No handshake cookie means this browser did not begin this sign-in. That
  // is the whole CSRF defence and it comes first, before anything costs
  // anything.
  if (handshake === undefined) return refuse('1');

  const state = singleValued(parameters, 'state');

  if (state === undefined || state !== handshake.state) return refuse('1');

  const code = singleValued(parameters, 'code');

  // ⚠️ Google reports its own refusals as `?error=…`. It collapses into the same
  // marker: it is not this console's news to break down.
  if (code === undefined) return refuse('1');

  const idToken = await exchangeGoogleAuthorizationCode(configuration, code);

  if (idToken === undefined) return refuse('1');

  const identity = verifiedGoogleIdentity(idToken, {
    clientId: configuration.clientId,
    // 🛑 The nonce comes from the COOKIE this browser was given, 🚫 never from
    // the token being checked. Checking a token against itself checks nothing.
    nonce: handshake.nonce,
    now: signInNow(),
  });

  if (identity.outcome === 'unverified') return refuse('1');

  // ⚠️ From here on the caller has PROVED an address to Google. The refusals
  // below may therefore be specific — they tell that person something about
  // THEMSELVES, which is not a disclosure, and an operator told only "no" would
  // retry a good Google account forever against a console that cannot admit it.
  // 🛑 **BOTH DIRECTORY CHANNELS ARE READ, AND NEITHER IS TRIED "FIRST".** The
  // tenant read compares `organization_id` for equality, so 🚫 it can never
  // return the platform membership (NULL equals nothing); the fenced platform
  // read sets 🚫 no `age.organization_id` at all, so 🚫 it can never return a
  // tenant's people. ⚠️ Asking one and falling back to the other would make the
  // ORDER decide which membership wins — and `decideSignIn` refuses exactly that
  // question, by name, inside a single entry.
  const tenantEntry = await readSignInDirectoryEntry(lookupOrganizationId, identity.email);
  const platformEntry = await readPlatformDirectoryEntry(identity.email);

  const decision = decideSignInAcrossDirectories(tenantEntry, platformEntry, lookupOrganizationId);

  if (decision.outcome === 'refused') return refuse(markerFor(decision.reason));

  // 🛑 **THE ONE AUTHORIZED INSERT.** The token is minted HERE and travels in
  // exactly two directions: into the cookie, and into the hash the row stores.
  // 🚫 It is never logged, never echoed, never put in a URL, and the row keeps
  // only its SHA-256 digest.
  const token = mintOpaqueValue();
  const issuedAt = signInNow();

  // 🛑 **THE BRANCH IS ON THE ABSENT ORGANIZATION, AND IT IS A BRANCH RATHER
  // THAN A DEFAULT** (ADR-0082 D4). ⚠️ The dangerous alternative is one
  // character away and reads as harmless: `organizationId ?? lookupOrganizationId`
  // would file a platform operator's session under the pinned tenant, and it
  // would look like a working sign-in. `issuePlatformSession` has 🚫 no
  // organization parameter at all, so that substitution has nowhere to live.
  const issued =
    decision.operator.organizationId === null
      ? await issuePlatformSession(decision.operator.accountId, token, issuedAt)
      : await issueOperatorSession(
          decision.operator.organizationId,
          decision.operator.accountId,
          token,
          issuedAt,
        );

  // ⚠️ The cookie expires WITH THE ROW, computed from the two values already in
  // hand — 🚫 not from a second reading of a clock, and 🚫 not from a lifetime
  // constant repeated here. A cookie that outlived its row would be refused on
  // the next request anyway (the row is re-checked EVERY time), so the risk is
  // only a confusing one; a cookie shorter than its row is simply honest.
  const remainingSeconds = Math.floor((Date.parse(issued.expiresAt) - issuedAt.getTime()) / 1000);

  // 🛑 **THE HANDOFF LANDS SAME-SITE, AND `/` WOULD NOT** (ADR-0084 §3 Option
  // B). ⚠️ MEASURED IN A BROWSER, 2026-08-20: this `303` sits inside a chain
  // begun by a cross-site top-level navigation from Google, so the browser
  // WITHHELD the `SameSite=Strict` session cookie set two lines below, `/` saw
  // an anonymous caller, and every operator was bounced to `/sign-in` with no
  // reason string — a failed sign-in and a successful one were the same screen.
  //
  // 🛑 **DO NOT "SIMPLIFY" THIS BACK TO `/`.** The extra hop IS the fix: the
  // landing route is reached by this same cross-site hop and asserts nothing,
  // then navigates to `/` itself — and THAT navigation is same-site, so it
  // carries the cookie.
  //
  // 🚫 **AND DO NOT FIX IT AT THE COOKIE INSTEAD.** Relaxing the attribute to
  // `Lax` was Option A; the owner's acceptance named no option, so it is 🚫 not
  // authorized, and widening a guard to make one redirect pass is exactly what
  // constitution §3.8 forbids.
  const headers = new Headers({ Location: '/sign-in/landing' });

  headers.append('Set-Cookie', serializeSessionCookie(token, remainingSeconds));

  // 🚫 The handshake is spent. Leaving it set leaves a `state` a later callback
  // could be replayed against.
  for (const expired of expireHandshakeCookies()) headers.append('Set-Cookie', expired);

  return new Response(null, { status: 303, headers });
}

/**
 * 🛑 **A PARAMETER GIVEN TWICE IS A REFUSAL, 🚫 NOT A CHOICE.**
 *
 * ⚠️ MEASURED BY THE GUARD BEFORE THIS EXISTED: `?state=<the real one>&state=x`
 * was ADMITTED, because `URLSearchParams.get` silently returns the FIRST value.
 * That is parameter pollution, and it is dangerous here for a reason that is not
 * about this file: nginx, Next and this handler need not agree on WHICH
 * duplicate wins, and the moment they disagree the value that was CHECKED is not
 * the value that was USED. ⚠️ An empty value is absent too — `?code=` is not a
 * code.
 */
function singleValued(parameters: URLSearchParams, name: string): string | undefined {
  const values = parameters.getAll(name);

  return values.length === 1 && values[0] !== '' ? values[0] : undefined;
}

/**
 * ⚠️ **THE REASONS ARE NOT COLLAPSED INSIDE AGE, ONLY ON THE WAY OUT** — and
 * only as far as the screen can honestly help. 🚫 A person whose membership is
 * ambiguous must not be told "you are not provisioned": the operator would look
 * for the wrong thing, and the two are completely different problems.
 */
function markerFor(reason: SignInRefusalReason): string {
  switch (reason) {
    case 'ambiguous-membership':
      return 'ambiguous';
    case 'crossed-directory-channel':
    case 'incoherent-platform-membership':
    case 'incoherent-client-membership':
      // ⚠️ Not `ambiguous`, and not `scope-not-served`. The row itself is
      // malformed in a way no provisioning step produces, so the honest screen
      // is the one that says the console cannot admit this person — and the
      // distinction survives on the server side, where it is actionable.
      return 'not-provisioned';
    default:
      // ⚠️ `no-account`, `account-disabled`, `no-membership` and
      // `membership-revoked` share a marker on the SCREEN. AGE keeps the
      // distinction; what the screen can truthfully say about all four is the
      // same sentence, and it is the operator's console that resolves them.
      return 'not-provisioned';
  }
}

/**
 * 🛑 **A RELATIVE `Location` IS A SECURITY DECISION, 🚫 NOT A STYLE.**
 *
 * ⚠️ MEASURED ON THE REAL DEPLOYMENT: inside its container the console binds
 * `0.0.0.0`, so an absolute redirect built from `request.url` sent a browser to
 * `http://0.0.0.0:3100/…`, which is not a destination. 🚫 And the fix is NOT to
 * read a forwarded host header — `request.url` derives from a header the CALLER
 * controls, so an absolute redirect built from it lets that caller choose where
 * a refused sign-in lands.
 *
 * ⚠️ **A REFUSAL CLEARS THE HANDSHAKE AND 🚫 SETS NO SESSION.** The failure that
 * would matter here is a session handed out on the way to saying no.
 */
function refuse(marker: string): Response {
  const headers = new Headers({ Location: `/sign-in?refused=${marker}` });

  for (const expired of expireHandshakeCookies()) headers.append('Set-Cookie', expired);

  return new Response(null, { status: 303, headers });
}
