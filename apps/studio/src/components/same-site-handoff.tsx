'use client';

import { useEffect } from 'react';

/**
 * **THE SAME-SITE HANDOFF** — ADR-0084 §3 Option B, D4.
 *
 * 🛑 **THIS COMPONENT EXISTS BECAUSE OF A BROWSER RULE, 🚫 NOT A PREFERENCE.**
 * The document that renders it was reached by a **cross-site-initiated**
 * navigation (the `303` out of the Google callback), and a browser does not send
 * a `SameSite=Strict` cookie on one. The navigation this component performs is
 * initiated by **this page**, which is same-site with `/` — so the session
 * cookie IS sent, and the boundary at `/` verifies it normally.
 *
 * 🛑 **IT ASSERTS NOTHING ABOUT THE CALLER** (D2). It does not know, and cannot
 * know, whether a session exists: the cookie is `HttpOnly` and this hop is
 * anonymous by construction. ⚠️ It therefore promises the operator **nothing** —
 * the sentence below says what is happening, 🚫 not that it worked.
 *
 * ⚠️ **`replace`, 🚫 NOT `assign`.** `assign` would leave this hop in session
 * history, so a Back press would return to a page whose only purpose is to
 * leave — and the operator would watch it bounce them forward again.
 *
 * 🛑 **THE LINK IS NOT A FALLBACK THAT NEEDS A TIMER.** 🚫 There is no
 * `setTimeout`, no "if that did not work" branch and no retry: this route cannot
 * observe whether the navigation succeeded (D4), and a page that guesses would
 * be asserting something it never measured. The link is simply always there, and
 * it is what makes the hop work with no script at all.
 */
export function SameSiteHandoff() {
  useEffect(() => {
    // 🛑 THE WHOLE POINT, IN ONE LINE. 🚫 Do not "improve" this into a router
    // push: a client-side route transition does not make a new HTTP request to
    // `/`, so the server boundary is never reached and the cookie is never
    // presented — the sign-in would appear to work and would not have.
    window.location.replace('/');
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-8">
      <div>
        <h1 className="text-xl font-semibold">AGE Studio</h1>
        {/*
          ⚠️ PRESENT TENSE, AND 🚫 NOT A CLAIM. "Signing you in" describes the
          navigation this page is performing. 🚫 "You are signed in" would be a
          statement about a session this page has never read and cannot read.
        */}
        <p className="mt-1 text-sm text-neutral-600">Opening the console.</p>
      </div>

      <p className="text-sm text-neutral-600">
        If this page does not move on by itself,{' '}
        <a href="/" className="font-medium text-neutral-900 underline">
          continue to the console
        </a>
        .
      </p>
    </main>
  );
}
