export const dynamic = 'force-dynamic';

/**
 * The sign-in screen — ADR-0074 §7 slice 2.
 *
 * 🛑 **IT IS NOT PROTECTED, AND IT IS THE ONLY ROUTE THAT IS NOT.** Every other
 * route calls `requireVerifiedSession()` first. This one is the door, so it may
 * not stand behind itself.
 *
 * 🛑 **AGE MINTS NOTHING HERE** (ADR-0068, ADR-0074). There is no "sign up", no
 * "forgot password", no email, no invite and no password at all. The operator
 * PASTES a token that was provisioned out of band as an ACT, and this screen
 * hands it to `verifyPresentedSessionToken`. 🚫 Do not add a field, a link or a
 * button that implies AGE could issue one — the database grants make sure it
 * cannot, and this screen must not disagree with them.
 *
 * ⚠️ **THE REFUSAL IS DELIBERATELY UNINFORMATIVE, WITH ONE EXCEPTION.** AGE
 * knows whether a token was never real, was revoked, or simply expired, and it
 * keeps that distinction internally (ADR-0068). Telling an UNAUTHENTICATED
 * caller which one applied would confirm that a token they hold was once
 * genuine. The exception is `not-configured`, which is the HOST's fault, not the
 * caller's: an operator shown "check your token" would try a good credential
 * forever against a console that can admit nobody.
 */
export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly refused?: string }>;
}) {
  const { refused } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-8">
      <div>
        <h1 className="text-xl font-semibold">AGE Studio</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Present your operator session token. AGE does not issue tokens — yours was provisioned out
          of band.
        </p>
      </div>

      {refused === 'not-configured' ? (
        <p
          role="alert"
          className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
        >
          This deployment has not been told which organization it serves, so it can admit nobody.
          Set <code>AGE_STUDIO_ORGANIZATION_ID</code> on the host. This is not a problem with your
          token.
        </p>
      ) : null}

      {refused === '1' ? (
        <p
          role="alert"
          className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900"
        >
          That token was not accepted.
        </p>
      ) : null}

      <form method="post" action="/sign-in/submit" className="flex flex-col gap-3">
        <label htmlFor="token" className="text-sm font-medium">
          Session token
        </label>
        {/*
          ⚠️ `type="password"` so a shoulder or a screen share does not carry the
          credential, and `autoComplete="off"` so a browser does not offer to
          keep something AGE never issued. 🚫 The value is never echoed back.
        */}
        <input
          id="token"
          name="token"
          type="password"
          autoComplete="off"
          spellCheck={false}
          required
          className="rounded border border-neutral-300 p-2 font-mono text-sm"
        />
        <button
          type="submit"
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          Continue
        </button>
      </form>
    </main>
  );
}
