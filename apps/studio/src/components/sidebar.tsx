import Link from 'next/link';

import { areasForLevel, type AreaLevel } from '@age/studio-shell';

/**
 * 🚫 The `subject` level is deliberately ABSENT. Subject areas live at
 * `/b/:clientId/...` and cannot be linked from here — the sidebar has no
 * business in hand, and a link that picked one would be inventing a scope.
 */
const SECTIONS: readonly { level: AreaLevel; heading: string }[] = [
  { level: 'console', heading: 'Console' },
  { level: 'business', heading: 'Businesses' },
];

/**
 * Studio navigation.
 *
 * ⚠️ The areas come from `@age/studio-shell`, not from a list written here. A
 * second list is a second truth. 🚫 Do not add a link that has no area.
 *
 * ⚠️ An area that is not wired says so on the item rather than presenting a
 * full navigation that leads to empty screens.
 */
export function Sidebar({
  signedIn,
  signedInEmail,
}: {
  readonly signedIn: boolean;
  /**
   * ⚠️ **A LABEL, 🚫 NOT A CREDENTIAL AND 🚫 NOT A PERMISSION.** It is the address
   * on the account this request already proved, passed in so this component
   * stays a component — 🚫 it does no I/O and must not learn how to.
   *
   * ⚠️ **`undefined` IS EXPECTED, 🚫 NOT AN ERROR STATE.** The directory read is
   * allowed to fail without costing the operator their way out, so the sign-out
   * control below is 🚫 NEVER gated on this being present.
   */
  readonly signedInEmail?: string | undefined;
}) {
  return (
    <nav aria-label="AGE Studio" className="w-72 shrink-0 border-r border-[hsl(var(--age-border))]">
      <div className="px-4 py-5">
        <p className="text-sm font-semibold tracking-tight">AGE Studio</p>
        {/*
          ⚠️ CORRECTED 2026-08-16. It said "Local operator console · 127.0.0.1".
          🛑 THAT BECAME FALSE THE DAY THE CONSOLE WAS PUBLISHED (ADR-0074 §7
          slice 4): an operator reading it on `https://age.digitaldadi.agency`
          is being told the surface is local when it is on the public internet
          behind a session boundary. ⚠️ A screen claiming a boundary the
          architecture has changed is as dishonest as one claiming a capability
          that does not exist — the same rule that removed "read-only" from the
          banner. 🚫 Do not replace it with a printed host: this component would
          then have to learn where it is running, and the request's own host is
          caller-controlled (`redirect-host-independence.test.ts`).
        */}
        <p className="mt-1 text-xs text-[hsl(var(--age-text-muted))]">
          Operator console · no business execution
        </p>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.level} className="px-2 pb-4">
          <p className="px-2 pb-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-[hsl(var(--age-text-muted))]">
            {section.heading}
          </p>
          <ul>
            {areasForLevel(section.level).map((area) => (
              <li key={area.id}>
                <Link
                  href={{ pathname: area.route }}
                  className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-[hsl(var(--age-surface))]"
                >
                  <span>{area.label}</span>
                  {area.wiring === 'not-wired' ? (
                    <span
                      className="text-[0.625rem] uppercase tracking-wide text-[hsl(var(--age-not-assessed))]"
                      title={area.notWiredBecause}
                    >
                      not wired
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="px-4 pb-6 pt-2">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[hsl(var(--age-text-muted))]">
          Within a business
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--age-text-muted))]">
          Discovery, BIF, Evidence and the rest open inside one business. Choose it under Businesses
          first — there is no default business, and none is selected for you.
        </p>
      </div>

      {/*
        🛑 **SIGNING OUT MUST BE REACHABLE, OR IT IS NOT A SESSION** — ADR-0074
        §7 slice 2. The Product Owner's definition of done ends *"logout/expiry
        works"*, and a revocation route nobody can press is a route nobody uses.

        ⚠️ **A `POST` FORM, 🚫 NEVER A LINK.** A `GET` that revoked could be
        fired by a prefetch, an image or another site. This posts, and the route
        revokes the ROW before it expires the cookie.

        🚫 **NOTHING IS SHOWN WHEN NOBODY IS SIGNED IN** — no "Sign in" link
        either. The unauthenticated caller is already being redirected to the
        door; a second, differently-worded door would be a second truth.
      */}
      {signedIn ? (
        <div className="px-4 pb-6">
          {/*
      ⚠️ **WHO IS ABOUT TO BE SIGNED OUT, DIRECTLY ABOVE THE CONTROL THAT DOES
      IT.** An operator can hold more than one address, and this console admits
      by address — so *"which one am I?"* is a question with consequences, and
      the moment it matters is the moment before signing out.

      🚫 **IT SAYS NOTHING ABOUT SCOPE.** A tier is not a fact about a person,
      it is a fact about a membership that is re-read on every request
      (ADR-0079 §2, ADR-0089). A sidebar that printed "platform" would be a
      cached authorization drawn once per navigation, and it would keep saying
      so for the whole page after the membership behind it had been revoked.

      ⚠️ `break-all` because an address is not a word and must not widen the
      rail or overflow it.
    */}
          {signedInEmail === undefined ? null : (
            <p className="mb-2 break-all text-[0.6875rem] leading-relaxed text-[hsl(var(--age-text-muted))]">
              Signed in as{' '}
              <span className="font-medium text-[hsl(var(--age-text))]">{signedInEmail}</span>
            </p>
          )}
          <form method="post" action="/sign-out">
            <button
              type="submit"
              className="w-full rounded border border-[hsl(var(--age-border))] px-2 py-1.5 text-xs hover:bg-[hsl(var(--age-surface))]"
            >
              Sign out
            </button>
          </form>
          <p className="mt-2 text-[0.6875rem] leading-relaxed text-[hsl(var(--age-text-muted))]">
            Signing out revokes this session in the store, not only in this browser. The same token
            is refused afterwards.
          </p>
        </div>
      ) : null}
    </nav>
  );
}
