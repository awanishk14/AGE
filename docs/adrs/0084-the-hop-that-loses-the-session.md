# ADR-0084 — The hop that loses the session

Status: **Accepted** (2026-08-20) — by the Product Owner, whose words were, verbatim and in full:

> _"then obvioudly its accepted"_

⚠️ **WHAT THAT DOES AND DOES NOT SETTLE.** It accepts this ADR **as written**, and this ADR
recommends exactly one thing: **§3 Option B** — keep `SameSite=Strict` and land on a content-free
**same-site** hop. 🚫 The owner did **not** name an option in those words, and the architect has
recorded that reading rather than hidden it. 🛑 **Option A (`SameSite=Lax`) is therefore NOT
authorized** — it is the one branch of D1 that permanently widens the session boundary, and 🚫 no
slice may reach for it on the strength of this line. If the owner meant A, that is a one-sentence
correction and this status block is rewritten before slice 2 begins.

⚠️ D2–D5 in §4 stand or fall **on their own** — 🚫 this acceptance does not corroborate them
(constitution §3.3), and 🚫 an architect's recommendation is not corroboration of itself.

🛑 **SLICE 1 STILL COMES FIRST AND IT IS A MEASUREMENT, 🚫 NOT A FIX** (§6.1). If the real request
headers show `__Host-age_session` **IS** present on that hop, §1 is wrong, this ADR is **withdrawn**
despite being accepted, and 🚫 nothing in §6.2 is built. Acceptance authorizes the _investigation_
and, only if it confirms §1, the Option B slice — 🚫 it does not authorize the diagnosis.

Depends on: ADR-0079 (the sign-in page and the three scopes) · ADR-0083 (a principal that has no
organization) · ADR-0078 (the deployed console behind a verified-session boundary).
Amends: nothing. Supersedes: nothing.

---

## 0. How this was found, and 🛑 why no repository test could have found it

🛑 **A HUMAN SIGNED IN TO THE DEPLOYED CONSOLE ON 2026-08-20 AND WAS RETURNED TO THE SIGN-IN PAGE.**

Everything server-side had already worked. Measured on the box, 🚫 not inferred:

- Google completed, the callback ran, the platform directory read resolved, and **three sessions
  were issued** (08:39:00, 08:39:21, 08:43:24) — each with `organization_id` **NULL**, each live.
- The browser then displayed `/sign-in`, **with no reason string at all**.
- Navigating to `https://age.digitaldadi.agency/` **by hand**, in the same browser, immediately
  rendered the console shell — proving the cookie existed and the session verified.

⚠️ **To the operator, a successful sign-in and a failed one are the same screen.** The session row
is created either way, so a store-side check reports success while the person in front of the
browser cannot get in. 🛑 **THIS IS THE THIRD TIME A DEFECT HAS PASSED EVERY LOCAL GATE AND CI AND
DIED ON THE FIRST REAL RUN**, and the first one that needed a **browser** rather than a host — the
gate the repository does not have (constitution §5).

## 1. The mechanism, and it is 🚫 not a configuration problem

`apps/studio/src/app/sign-in/callback/route.ts:138` answers **`303`** with `Location: /` and
`Set-Cookie: __Host-age_session=…`. That cookie carries `SameSite=Strict`
(`packages/session-cookie/src/session-cookie.ts`, `SESSION_COOKIE_ATTRIBUTES`).

The request to `/` that the browser then makes is part of a redirect chain **initiated by a
cross-site top-level navigation from `accounts.google.com`**. Browsers compute the site-for-cookies
across the whole chain, so a `SameSite=Strict` cookie is **withheld** on that hop. `/` is therefore
anonymous, `requireVerifiedSession()` finds no cookie, and it redirects to `/sign-in`.

🛑 **THE REPOSITORY ALREADY KNOWS THIS BROWSER RULE AND WROTE IT DOWN.**
`packages/session-cookie/src/handshake-cookie.ts` states it exactly, for the handshake pair:

> _"The return from Google is a cross-site TOP-LEVEL NAVIGATION, and a browser does not send a
> `SameSite=Strict` cookie on one. A `Strict` handshake cookie is therefore not a stricter handshake
> — it is NO handshake."_

⚠️ **The reasoning was correct and was applied one hop short of where it was needed.** The handshake
cookies were made `Lax` so they survive the trip **to** the callback; nobody asked whether the
session cookie survives the trip **from** it. 🚫 This is not an oversight in the analysis — it is the
analysis stopping at the route boundary, which is exactly where a browser does not stop.

⚠️ **What this ADR treats as measured, and what it does 🚫 not:** the redirect target, the status
code, the cookie attributes and the observed behaviour are all facts. The precise per-browser
site-for-cookies computation is **read from the specification and from the repository's own comment**
— 🚫 nobody has yet watched the request headers on that hop. **Slice 1 below exists to close that
gap before anything is changed.**

## 2. What is 🚫 NOT wrong, so that no slice "fixes" it

- 🚫 **`SameSite=Strict` on the session cookie is not itself the defect.** It is a deliberate,
  documented, correct property of a session reference, and every request after the first carries it
  without difficulty.
- 🚫 **The handshake cookies are not implicated.** They are `Lax`, they work, and 🚫 nothing here
  proposes touching them.
- 🚫 **`refused=scope-not-served` is not a failure** (`session-boundary.ts:112`). A platform
  principal is admitted and reaches nothing, exactly as ADR-0083 authorizes. ⚠️ It is 🚫 not part of
  this decision and 🚫 must not be bundled into it.
- 🚫 **No session was lost, leaked or duplicated.** The rows are correct; only their delivery to the
  browser fails.

## 3. The decision requested — **D1**, and it is the owner's

### Option A — make the session cookie `SameSite=Lax`

One line. The redirect works immediately, and it is what most OAuth deployments ship.

- 🛑 **It widens the session boundary for EVERY request, permanently, to fix ONE hop.** `Lax` sends
  the session cookie on **all** cross-site top-level `GET` navigations — every link into AGE from
  anywhere, forever. The defect is one redirect; the remedy is unbounded in scope and unbounded in
  time.
- ⚠️ **It is not reversed later.** A relaxation that works is invisible, and 🚫 nothing will ever
  fail to prompt its revisit. Constitution §3.8: 🚫 do not widen a guard to make something pass.
- ⚠️ **It contradicts a shipped, reasoned refusal.** `SESSION_COOKIE_ATTRIBUTES` is commented
  🚫 "Not configurable" and `handshake-cookie.ts` says in terms 🚫 "do not 'make these consistent'
  with it". Overturning that is a **decision**, 🚫 not an edit.

### Option B — keep `Strict`, land on a same-site hop **(RECOMMENDED)**

The callback redirects to a small **same-site** landing route instead of `/`. That route is reached
by the same cross-site-initiated hop and so is **also** anonymous — it therefore asserts nothing
about the caller, renders no operator data, and performs a **client-initiated same-site navigation**
to `/`. That second navigation is same-site, carries the `Strict` cookie, and `/` verifies normally.

- ✅ **The guard survives intact.** 🚫 No cross-site request ever carries the session reference.
- ✅ **The cost is bounded and named:** one extra hop, one route, and a page that must be provably
  content-free.
- ✅ **It is cheap to reverse.** If the owner later prefers `Lax`, the route is deleted.
- ⚠️ **It is more code than Option A**, and 🛑 **the new route is a new surface** — it must be
  unauthenticated by construction, must render 🚫 no operator, organization or client data, and must
  🚫 never read the session. A guard asserts this, 🚫 not a comment.
- ⚠️ **It is not free for the operator:** a visible extra step during sign-in.

### Option C — do nothing, and document the manual navigation

🚫 **Rejected, and named only so it is not re-proposed.** It makes every sign-in look like a failure
and trains operators to retry — which mints a session row per attempt (three exist already from one
person, one afternoon). ⚠️ **A product whose success and failure look identical is not shipped.**

## 4. Decisions the architect takes under the standing autonomy grant

🚫 None of these are corroborated by the owner accepting **D1**; they stand or fall on their own.

- **D2 — the landing route asserts nothing.** It reads 🚫 no cookie, 🚫 no session, 🚫 no directory,
  and 🚫 no organization. ⚠️ A route reached anonymously that tried to be helpful would be a second
  session boundary, and the constitution puts that boundary at exactly one place.
- **D3 — it renders no data whatsoever**, and a guard fails if it imports anything that could carry
  some. 🚫 Not "renders little"; renders none.
- **D4 — the second navigation is deliberate and observable**, 🚫 not a `<meta refresh>` race. It
  fires from the page itself, and 🚫 the route never guesses whether it "worked".
- **D5 — the refusal path is unchanged.** A callback that refuses still goes straight to
  `/sign-in?refused=…` — 🚫 refusals do not route through the landing hop, because a refusal has no
  session to deliver.

## 5. What this ADR does 🚫 NOT authorize

- 🚫 **No rendering for a platform principal.** `scope-not-served` stays exactly as it is; ADR-0083
  authorized the shape of that principal and 🚫 explicitly not a page for it.
- 🚫 **No change to the handshake cookies**, their names, attributes or lifetime.
- 🚫 **No change to session issuance, verification, revocation, or the 8-hour ceiling.**
- 🚫 **No new outbound surface**, 🚫 no new endpoint that accepts data, 🚫 no middleware — the session
  boundary stays composed in `apps/studio` alone (a shared middleware was refused by name, and 🚫
  that refusal is not reopened here).
- 🚫 **No deployment.** 🚫 Nothing on the box changes until a slice says so.

## 6. Slices, if accepted — 🛑 and slice 1 comes first

1. 🛑 **Measure the hop before changing it.** Capture the actual request headers on the
   callback → `/` redirect in a real browser and record whether `__Host-age_session` is present.
   ⚠️ **If it IS present, §1 is wrong and this ADR is withdrawn** — the defect would be elsewhere and
   every slice below would be built on a misdiagnosis. 🚫 No code changes in this slice.
2. The landing route, its guard (D2/D3), and the callback redirect target — one PR.
3. Deploy, then 🛑 **sign in through a browser and confirm the console renders without typing a
   URL.** 🚫 The slice is not done because CI is green; the browser is the gate.

⚠️ **The evidence for all of this lives in `docs/SESSION_HANDOVER.md` §2c**, alongside what the
first real sign-in did and did not prove.
