# ADR-0087 — The screen a client is allowed to see

Status: **Accepted** (2026-08-21)

🛑 **ACCEPTED BY THE PRODUCT OWNER, 2026-08-21, IN THESE WORDS VERBATIM:**

> _"ADR-0087 and ADR-0088 acceted"_ — and, correcting the typo, _"accepted"_.

⚠️ **BOTH ADRs WERE ACCEPTED IN ONE SENTENCE, AND 🚫 NEITHER CARRIES AN OPTION.** The owner named
no variant, so the acceptance carries **the ADR exactly as written and nothing beyond it** — 🚫 no
adjacent widening, and 🚫 no reading of intent into what was not said (the ADR-0084 lesson).

⚠️ **Written alongside the code rather than before it**, on the standing instruction recorded in
ADR-0085 §0. 🛑 The status above was flipped by a **separate PR**, which
carried no code.

Depends on: ADR-0079 (three scopes, clients **read-only**) · ADR-0083 (the platform principal) ·
ADR-0085 (where a platform operator stands). Supersedes: nothing.
Amends: nothing yet — 🛑 the sign-in refusal `client-scope-not-yet-served` is **left standing by
this slice** and is lifted by the next one (§6).

---

## 1. Why, and what was already built

The owner asked for the ordinary three tiers, verbatim:

> _"A super admin has access to everything, and then your agency who looks after their own client,
> and then a client who can access only their data."_

Two of the three run today. The third refuses at the door with `client-scope-not-yet-served`, and
🛑 **that refusal names the exact condition of its own removal**, in shipped code:

> _"the console renders agency views only, so admitting a client today would show them an agency's
> screens. Client sign-in arrives with the client rendering, 🚫 never before it."_

⚠️ **THE PURE CORE OF THE CLIENT TIER IS ALREADY ON `main`, AND THIS ADR DOES 🚫 NOT REBUILD IT.**
Measured 2026-08-21 by reading the code, 🚫 not by trusting a summary:

- `clientScope(agencyId, clientId)` exists, refuses a blank identifier, and carries the agency
  rather than inferring it (`access-scope.ts`).
- `decideAccess` has a **client arm**: another agency is refused, an agency-level subject is
  refused, another client is refused, and only `scope.clientId === subject.clientId` is granted.
- `scopeForMembership` turns a stored `client` membership into a `ClientScope` end to end, refusing
  a mismatched bundle, a missing organization and a missing client.
- The bundle `client-viewer` holds exactly **two** capabilities: `snapshot.read` and
  **`rendering.client`** — a capability that nothing renders.

🛑 **SO THE MISSING PIECE IS A SCREEN, 🚫 NOT A SCHEMA.** ⚠️ In particular there is **no session
column to add**: `operator_sessions` deliberately carries no scope, because _"a flag on the session
is precisely how a bypass arrives"_ (`request-scope.ts`). The session says WHO; the membership,
re-read on **every request**, says HOW FAR. A client's `clientId` therefore arrives from the
directory read, 🚫 never from the cookie.

## 2. The decision

**One route, `/client`, is the whole of the client rendering, and it renders the ONE client the
requester's own membership names.**

`requireClientRendering()` is added to `request-scope.ts` — the one module permitted to import
`@age/access-scope` — and it:

1. re-derives the scope from the store, exactly as every other request does;
2. **refuses any scope that is not `client`** with an opaque `notFound()`;
3. then asks `decideAccess` for `rendering.client` with the subject taken **from the scope itself**.

🛑 **THE `clientId` IS NEVER READ OFF THE URL ON THIS ROUTE, AND THAT IS THE POINT.** `/client`
takes 🚫 no parameter. Elsewhere a `clientId` in the path is a FILTER applied inside an entitlement
(AGE-INV-SEL-1); here there is nothing to filter — a client viewer has exactly one subject, and
offering a slot to name it would be offering a slot to name somebody else's.

## 3. Read-only, and how that is true rather than asserted

ADR-0079 §0.2 says clients are read-only. ⚠️ **That is enforced by the CAPABILITY SET, 🚫 not by
the absence of buttons.** `client-viewer` holds `snapshot.read` and `rendering.client` and nothing
else, so every write action in the console — each of which passes `requireScopedAccess` naming its
own capability — refuses a client scope at the capability check, **before** any subject comparison.
🚫 A screen that merely omits a form is not read-only; this one would refuse the action if the form
were re-created by hand.

## 4. What a client sees when there is nothing

⚠️ **`not-assessed` WITH ITS REASON, 🚫 never a zero and 🚫 never "none".** A client whose snapshot
has not been produced yet is shown that no assessment has been filed, in those words. Constitution
§2: absence is never a conclusion, and _insufficient context is a valid successful outcome_.

## 5. The guards this slice must carry

Each is written, then the implementation is deliberately mutated so it fails, and the failure is
required to **name the exact violation** before the mutation is reversed:

- an **agency** scope on `/client` → `notFound()`;
- a **platform** principal on `/client` → `notFound()` — ⚠️ 🚫 NOT a redirect to `/platform`, which
  would tell a caller the route exists;
- a client scope asking for **another client's** subject → refused;
- the route-protection contract test gains `/client`, so the boundary line cannot be dropped.

## 6. What this does NOT authorize

- 🚫 **No sign-in change.** `client-scope-not-yet-served` still refuses at the door after this
  slice, so `/client` is **unreachable by any real caller** when it merges. ⚠️ That is deliberate:
  the shipped refusal says the rendering comes first, and this is that rendering. 🛑 It also means
  🚫 **this slice cannot be browser-verified**, and 🚫 must not be reported as if it were.
- 🚫 **No client write path**, no client-initiated capture, no questionnaire for a client.
- 🚫 **No provisioning.** A client account and its membership are **owner acts**; AGE mints nothing.
- 🚫 **No cross-client anything** — no list, no count, no sibling, no "your agency also manages".
