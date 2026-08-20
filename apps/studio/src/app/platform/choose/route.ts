import { serializeActingOrganizationCookie } from '@age/session-cookie';
import { ISSUED_SESSION_LIFETIME_SECONDS } from '@age/session-store';

import { organizationsThisConsoleServes } from '@/server/operator-environment';
import { requireVerifiedPlatformSession } from '@/server/session-boundary';

export const dynamic = 'force-dynamic';

/**
 * Recording where a platform operator chose to work — ADR-0085.
 *
 * 🛑 **THE CHECK HAPPENS TWICE, AND THAT IS 🚫 NOT REDUNDANCY.** Here, so a
 * value the host never configured is never written into a cookie at all; and
 * again on **every subsequent request** in `acting-organization.ts`, because a
 * cookie that was valid when it was set is not evidence that it is valid now —
 * the host's list can change under a browser that is still holding an old one.
 * 🚫 Neither check may be removed on the grounds that the other exists.
 *
 * ⚠️ **POST ONLY, AND THE BOUNDARY COMES FIRST.** An anonymous caller cannot
 * reach this, and a TENANT operator cannot either — they already carry the one
 * organization their session speaks for, straight from its row, and 🚫 this
 * route must never become a way to change it.
 *
 * 🛑 **THE CHOICE OUTLIVES NOTHING.** It is given the same lifetime the session
 * was, so it cannot survive as a stale answer for whoever uses the browser
 * next; sign-out expires it explicitly as well.
 */
export async function POST(request: Request): Promise<Response> {
  await requireVerifiedPlatformSession();

  const submitted = await request.formData();
  const offered = submitted.get('organizationId');

  // ⚠️ `FormData.get` returns a `File` for a file part. 🚫 A non-string is not
  // an organization identifier and must not be stringified into one.
  const chosen = typeof offered === 'string' ? offered : undefined;

  // 🛑 **THE CLOSED SET, 🚫 NOT A SHAPE CHECK.** A well-formed identifier the
  // host never configured is refused exactly as hard as a malformed one.
  if (chosen === undefined || !organizationsThisConsoleServes().includes(chosen)) {
    // ⚠️ Back to the picker, with 🚫 no reason string echoing what was
    // submitted. There is nothing here an honest operator can act on — the
    // buttons on that page are the whole list — and echoing a submitted value
    // into a screen is how one gets rendered.
    return new Response(null, { status: 303, headers: { Location: '/platform' } });
  }

  return new Response(null, {
    status: 303,
    headers: {
      // ⚠️ RELATIVE, for the reason `sign-in/callback/route.ts` records: an
      // absolute redirect built from `request.url` derives from a header the
      // caller controls.
      Location: '/',
      'Set-Cookie': serializeActingOrganizationCookie(chosen, ISSUED_SESSION_LIFETIME_SECONDS),
    },
  });
}
