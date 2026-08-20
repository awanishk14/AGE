import { organizationsThisConsoleServes } from '@/server/operator-environment';
import { requireVerifiedPlatformSession } from '@/server/session-boundary';

export const dynamic = 'force-dynamic';

/**
 * **THE PLATFORM OPERATOR'S FIRST SCREEN** — ADR-0085.
 *
 * 🛑 **THIS PAGE EXISTS BECAUSE A PLATFORM PRINCIPAL HAS NO ORGANIZATION, AND
 * SOMETHING HAD TO ASK.** ADR-0083 D1 gave that principal a type with no
 * `organizationId` on purpose, and ADR-0082 D4 forbids inventing one for it.
 * Both remain true. What ADR-0085 adds is the missing third option: 🚫 not
 * defaulting, 🚫 not refusing — **asking**.
 *
 * 🛑 **IT RENDERS THE HOST'S LIST, 🚫 NOT A DIRECTORY QUERY.** The organizations
 * below come from the root-owned deployment file, which is the same closed set
 * the choice is re-checked against on every later request. 🚫 This page does not
 * read `accounts`, `account_memberships` or any tenant's rows — a platform
 * operator being able to enumerate tenants from a screen is a different
 * decision, and it has not been made.
 *
 * ⚠️ **ONE ENTRY IS THE EXPECTED CASE, AND IT IS STILL A CHOICE.** This
 * deployment serves one organization (`operator-environment.ts`). 🚫 Do not
 * "helpfully" auto-submit when the list has length one — an automatic choice is
 * a default wearing a form, and the operator would never see where they were
 * put.
 */
export default async function Page() {
  // 🛑 THE BOUNDARY, BEFORE ANYTHING ELSE. ⚠️ It is the PLATFORM boundary: a
  // tenant operator is sent to `/`, and an unauthenticated caller to the door.
  await requireVerifiedPlatformSession();

  const organizations = organizationsThisConsoleServes();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-8">
      <div>
        <h1 className="text-xl font-semibold">Choose where to work</h1>
        <p className="mt-1 text-sm text-neutral-600">
          You are signed in with platform access, which belongs to no single organization. Pick the
          one you want to work in. Everything you do afterwards is filed under it.
        </p>
      </div>

      {organizations.length === 0 ? (
        /*
          ⚠️ NAMES THE VARIABLE, 🚫 never a value — and says whose fault it is.
          An operator shown an empty list with no explanation would assume their
          access was wrong.
        */
        <p
          role="alert"
          className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
        >
          This deployment has not been told which organization it serves, so there is nothing to
          choose. This is a problem with the host, not with your account.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {organizations.map((organizationId) => (
            <li key={organizationId}>
              {/*
                ⚠️ A FORM, 🚫 not a link — the same reason as the sign-in
                button. A GET is something another page can point a browser at,
                and choosing where an operator stands is not a read.
              */}
              <form method="post" action="/platform/choose">
                <input type="hidden" name="organizationId" value={organizationId} />
                <button
                  type="submit"
                  className="w-full rounded bg-neutral-900 px-4 py-2 text-left text-sm font-medium text-white"
                >
                  {organizationId}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form method="post" action="/sign-out">
        <button type="submit" className="text-sm text-neutral-600 underline">
          Sign out
        </button>
      </form>
    </main>
  );
}
