# ADR-0088 — The door a client may finally come through

Status: **Accepted** (2026-08-21)

🛑 **ACCEPTED BY THE PRODUCT OWNER, 2026-08-21, IN THESE WORDS VERBATIM:**

> _"ADR-0087 and ADR-0088 acceted"_ — and, correcting the typo, _"accepted"_.

⚠️ **BOTH ADRs WERE ACCEPTED IN ONE SENTENCE, AND 🚫 NEITHER CARRIES AN OPTION.** The owner named
no variant, so the acceptance carries **the ADR exactly as written and nothing beyond it** — 🚫 no
adjacent widening, and 🚫 no reading of intent into what was not said (the ADR-0084 lesson).

⚠️ **Written alongside the code rather than before it**, on the standing instruction recorded in
ADR-0085 §0. 🛑 The status above was flipped by a **separate PR**, which
carried no code.

Depends on: ADR-0079 (three scopes, clients **read-only**) · ADR-0087 (the client rendering, which
this ADR requires to exist and 🚫 does not rebuild).
Amends: ADR-0087 §6, which said _"no sign-in change"_ — **this is that change**, and it is a
separate ADR because ADR-0087 authorized none.
Retires: the refusal reason `client-scope-not-yet-served`.

---

## 1. The condition the shipped refusal set for its own removal

`decideSignIn` has refused a client membership since ADR-0079 slice 3, in these words:

> _"the console renders agency views only, so admitting a client today would show them an agency's
> screens. Client sign-in arrives with the client rendering, 🚫 never before it."_

ADR-0087 shipped that rendering (`main` `f635ec7`). 🛑 **So the refusal's own stated condition is
met, and lifting it needs no new product judgement** — it is reachable from ADR-0079, which already
accepted three scopes with clients read-only. What it DOES need is the second half of the same
sentence to become true, and that is where this ADR does its work.

## 2. 🛑 THE MEASURED HOLE — "would show them an agency's screens" IS STILL LITERALLY TRUE

Measured 2026-08-21 by reading every route file in `apps/studio/src/app`, 🚫 not by assuming:

**All fifteen tenant routes gate on `requireVerifiedSession` and NOTHING ELSE.** That boundary
proves a session is valid; it 🚫 does not re-read the membership, so it cannot tell an agency
operator from a client. `app/page.tsx` then calls `readBusinessesView(session.organizationId)` —
**every business the agency manages**.

🛑 **SO LIFTING THE SIGN-IN REFUSAL ON ITS OWN WOULD HAND EVERY CLIENT THE WHOLE AGENCY**, including
`/b/<any-other-client-id>/…` for every sibling. ⚠️ The `requireScopedAccess` gate does refuse a
client scope — but it guards **actions**, and these pages read before any action is taken.

⚠️ **THIS IS WHY THE TWO HALVES SHIP IN ONE PR AND 🚫 NOT TWO.** The sign-in lift without the gate
is the disclosure above; the gate without the lift is code no caller can reach. 🚫 Neither half is
independently verifiable, and a "safer" split would put the unsafe half on `main` alone.

## 3. The decision

**a. A third rendering gate, `requireAgencyRendering()`, replaces `requireVerifiedSession` on all
fifteen tenant routes.** It composes rather than reimplements: `requireVerifiedSession()` for the
session (so the ADR-0085 platform acting-organization arm is untouched), then `requireRequestScope()`
to re-derive the scope from the store on this request, and a client scope is **sent to `/client`**.

⚠️ **A REDIRECT, 🚫 NOT A REFUSAL, AND THE DIFFERENCE IS DELIBERATE.** This person IS signed in and
IS provisioned; rendering them a 404 would be the ADR-0084 defect in a third costume — a working
session shown as a failed one. The opaque 404 is for someone reaching a screen that is **not
theirs**; `/` is not not-theirs, it is simply not where they live.

🛑 **THE ROUTE-PROTECTION CONTRACT TEST IS WHAT MAKES THIS NON-FORGETTABLE.** Fifteen hand-edited
files is fifteen chances to miss one, so the map now classifies every route under
`requireAgencyRendering` and asserts every other boundary absent — a missed file fails the build,
🚫 rather than quietly serving an agency dashboard to a client.

**b. `decideSignIn` admits a single live client membership in the pinned organization**, and
`client-scope-not-yet-served` is **retired from the union**, 🚫 not left as a dead branch.

**c. 🛑 AN AGENCY ROW AND A CLIENT ROW TOGETHER ARE NOW `ambiguous-membership`.** Today the agency
row silently wins. That was harmless while a client row could admit nobody; from this slice it is
this module deciding which role a person signs in with — the exact question the platform arm
already refuses by name. ⚠️ **This is a NARROWING**: a combination that used to be admitted is now
refused, and 🚫 nothing that was refused became admitted.

## 4. What is NOT changed, by name

- 🚫 **No schema, no migration, no column.** `operator_sessions` still carries no scope; the
  membership is re-read on every request. A client's `clientId` arrives from the directory read.
- 🚫 **No new capability and no widened bundle.** `client-viewer` still holds exactly
  `snapshot.read` and `rendering.client`, so read-only stays true at the capability check.
- 🚫 **No callback change.** The callback still lands on `/`, and `/` now sends a client onward —
  ⚠️ so ADR-0084's open `SameSite` measurement is untouched and 🚫 is not bundled in here.
- 🚫 **No provisioning.** A client account and its membership are **owner acts**. AGE mints nothing,
  so 🛑 **THIS SLICE CANNOT BE BROWSER-VERIFIED BY ME** — it needs a client membership only the
  owner can create, and 🚫 it must not be reported as browser-proven until they do.

## 5. The guards this slice must carry

Each written, then the implementation deliberately mutated so it fails, the failure required to
**name the exact violation**, then reversed by a targeted inverse edit:

- a client scope on `/` → redirected to `/client`, 🚫 and the businesses read never happens;
- an agency scope on `/` → still renders, so the guard above is 🚫 not refusing everyone;
- a **platform** operator with a chosen organization → still renders, so ADR-0085 is 🚫 not broken;
- `decideSignIn` admits a lone client membership, carrying its `clientId`;
- an agency row **and** a client row → `ambiguous-membership`;
- `client-scope-not-yet-served` is asserted **gone product-wide** by source scan, with a positive
  control proving the scan walked something — the pattern already used for the retired
  `platform-scope-not-yet-readable`.
