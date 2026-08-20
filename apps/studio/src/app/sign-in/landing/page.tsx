import { SameSiteHandoff } from '@/components/same-site-handoff';

/**
 * The landing hop — ADR-0084 §3 Option B, §6.2.
 *
 * 🛑 **THIS ROUTE IS UNAUTHENTICATED BY CONSTRUCTION, AND THAT IS ITS DESIGN
 * RATHER THAN A GAP.** The browser arrives here on the `303` out of the Google
 * callback — a **cross-site-initiated** navigation, on which a
 * `SameSite=Strict` session cookie is withheld. So this page could not identify
 * its caller even if it tried, and 🚫 it must never try: a route reached
 * anonymously that attempted to be helpful would become a **second session
 * boundary**, and the constitution puts that boundary in exactly one place
 * (ADR-0084 D2).
 *
 * 🛑 **IT RENDERS NO DATA WHATSOEVER** (D3) — 🚫 no operator, 🚫 no
 * organization, 🚫 no client, 🚫 not even a name. It imports one client
 * component and nothing else, and `landing-hop-isolation.test.ts` fails if that
 * ever stops being true. 🚫 Do not add a greeting, a spinner fed by a fetch, or
 * a "welcome back" — each of those needs something this page must not have.
 *
 * ⚠️ **IT IS DELIBERATELY NOT `force-dynamic`.** Every other route in this app
 * declares it, because every other route reads something per-request. This one
 * reads **nothing**, so it renders once, statically — and a statically rendered
 * page **cannot** read a cookie. 🚫 Do not add the export "for consistency": it
 * would remove a property the guard relies on and replace it with a promise.
 *
 * 🛑 **THE FIX IS THE SECOND NAVIGATION, 🚫 NOT THIS PAGE.** What actually
 * repairs sign-in is `SameSiteHandoff` performing a **same-site** navigation to
 * `/`, which does carry the cookie. This file exists only to be a same-site
 * place to stand.
 */
export default function Page() {
  return <SameSiteHandoff />;
}
