export const dynamic = 'force-dynamic';

/**
 * The sign-in screen — ADR-0079 §6 slice 3.
 *
 * 🛑 **IT IS NOT PROTECTED, AND IT IS THE ONLY ROUTE THAT IS NOT.** Every other
 * route calls `requireVerifiedSession()` first. This one is the door, so it may
 * not stand behind itself.
 *
 * 🛑 **THE PASTE-A-TOKEN FIELD IS GONE, AND ITS ROUTE WITH IT.** ADR-0079 D3 is
 * the owner's decision that everyone signs in with Google; a second door left
 * standing is a second door to defend, and the one that keeps working while
 * nobody watches it is the one that gets weaker. 🚫 Do not restore it as a
 * fallback.
 *
 * 🛑 **AGE STILL MINTS NOTHING.** There is no sign-up, no invite, no password and
 * no "request access". Google says who you are; whether you may come in is
 * answered by rows a human provisioned. 🚫 Do not add a control that implies
 * otherwise — the database grants make sure it cannot be true, and this screen
 * must not disagree with them.
 *
 * ⚠️ **THE REFUSALS SAY AS MUCH AS THEY HONESTLY CAN AND 🚫 NO MORE.** Anything
 * before Google verified an address is a bare "not accepted": telling an
 * anonymous caller which half of their guess was right is a favour to a prober.
 * Once an address IS verified, the message may be specific, because it then
 * tells that person something about themselves — and an operator told only "no"
 * would retry a perfectly good account forever.
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
          Sign in with the Google account your operator provisioned. AGE does not create accounts.
        </p>
      </div>

      {refused === 'not-configured' ? (
        <p
          role="alert"
          className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
        >
          This deployment has not been told which organization it serves, or which Google client to
          sign in with, so it can admit nobody. This is a problem with the host, not with your
          account.
        </p>
      ) : null}

      {refused === '1' ? (
        <p
          role="alert"
          className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900"
        >
          That sign-in was not accepted. Please start again.
        </p>
      ) : null}

      {refused === 'not-provisioned' ? (
        <p
          role="alert"
          className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900"
        >
          Google confirmed that account, but it has no active access to this console. Ask your
          operator to provision it.
        </p>
      ) : null}

      {refused === 'scope-not-served' ? (
        <p
          role="alert"
          className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
        >
          That account exists, but the kind of access it holds is not served by this console yet.
          Nothing is wrong with your account.
        </p>
      ) : null}

      {refused === 'ambiguous' ? (
        <p
          role="alert"
          className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
        >
          That account holds more than one active membership here, and AGE will not choose one for
          you. Ask your operator to leave exactly one active.
        </p>
      ) : null}

      {/*
        ⚠️ A FORM, 🚫 not a link. A GET is something another page can point your
        browser at, which would overwrite the handshake cookies of a sign-in
        already in flight.
      */}
      <form method="post" action="/sign-in/start">
        <button
          type="submit"
          className="w-full rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          Continue with Google
        </button>
      </form>
    </main>
  );
}
