# ADR-0079 — the tenancy track, checkpoint

**Status of this document:** evidence, not authority. ADR-0079 (`Accepted` 2026-08-18) is the only
authority for what this track may build; where this file and the ADR disagree, the ADR is right and
this file is stale.

Covers slices 1–4. Written 2026-08-19 at `main` `8258f25`.

> 🛑 **Everything below is a REPOSITORY fact unless it says otherwise.** CI green is not host-level
> proof, a repository test is not a VPS fact, and `curl` is not a browser. The one gate that would
> make this track _observed_ rather than _tested_ — a human opening the console and signing in — is
> the owner's and is still open.

---

## 1. What the track was for

Before it, **being admitted was the same thing as being authorized**: any operator who held a
verified session reached every read the console could perform. ADR-0079 splits the two — a session
says _who_, and a membership says _how far_.

Three scopes, `platform | agency | client`, clients read-only.

---

## 2. The load-bearing decision, restated because it is easy to erode

> 🛑 **THE SCOPE IS READ FROM THE DATABASE ON EVERY REQUEST, 🚫 NEVER FROM A TOKEN CLAIM.**
> A demoted super admin loses platform scope on the **NEXT request**, 🚫 not at token expiry.
> ⚠️ AGE already does exactly this for `revokedAt` — the products agree; only the record disagreed.

This is why there is **no `scope` column on `operator_sessions`** and why `VerifiedSession` carries
neither a scope nor a role. 🚫 Do not add one. _A flag on the session is precisely how a bypass
arrives_ — `@age/entitlement` refused it by name long before this track existed, and slice 4 did not
quietly reverse that refusal for convenience.

---

## 3. What shipped, slice by slice

| Slice | PR   | Merge     | What it added                                                                                                                                     |
| ----- | ---- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | #381 | —         | `@age/access-scope`: capability atoms, three scope arms, `decideAccess`. Pure, zero dependencies, **and deliberately with no caller yet.**        |
| 2     | #382 | —         | The directory read and its scoped delegates; the migration.                                                                                       |
| 3     | #384 | `9e6caf6` | The real Google door. ⚠️ The paste-a-token route was **DELETED, 🚫 not kept as a fallback** — shape preserved verbatim in standing context §12bi. |
| 4     | #387 | `8258f25` | All 15 exported actions re-scoped behind one composed boundary.                                                                                   |

### Slice 4 in detail

`apps/studio/src/server/request-scope.ts` is the **one module in the product that imports
`@age/access-scope`**, and a guard pins it by full path.

- It calls **`decideSignIn` again, over rows read again** — 🚫 not a second, gentler re-check. Two
  implementations of _"may this person be here"_ is how the two drift, and **the copy that gets
  relaxed still passes its own tests.**
- A refusal **leaves by throwing**. There is no falsy return a caller could forget to check, and no
  way to write the call and carry on.
- ⚠️ A refusal is an **opaque 404, 🚫 not a 403** (ADR-0079 §2 property 4). Absence and denial must
  be indistinguishable, or a client learns how many sibling clients its agency has by counting which
  ids answer differently.
- 🛑 **The subject's agency is the session's organization, 🚫 never an argument** (AGE-INV-SEL-1). A
  caller may name a `clientId` — a filter applied _inside_ the entitlement — and 🚫 may never name
  the tenant the filter is applied within.

---

## 4. The merge gate, and how it was actually discharged

ADR-0079 §6, verbatim:

> 🛑 **Slice 4 does 🚫 NOT merge without a demonstrated cross-tenant refusal** — proven by breaking
> the scope and watching a guard name the exact violation, 🚫 never by an empty result set.

`apps/studio/src/server/request-scope-cross-tenant.test.ts`.

🚫 **No case in it asserts an empty result.** Every case asserts that the action **did not return**
and that the effect module was **never called**. An empty list is indistinguishable from a
legitimately empty one, and a refusal that still reached the store has already asked it whatever it
was refusing to ask.

⚠️ **The session row is valid in every refused case** — unexpired, unrevoked, admitted a minute ago.
What changed is the membership. If the session were the thing being invalidated, these tests would
prove only that the ADR-0074 boundary still works, which was never in doubt.

Cases: a positive control (so the refusals are refusals and not a broken wire) · a live membership
belonging to **another organization** · a membership revoked after sign-in · a disabled account · a
`platform` membership · a bundle that does not match its kind · the refusal discloses nothing.

**The break:** the scope in `request-scope.ts` was deliberately mutated. **6 tests failed**, each
reporting `promise resolved "{ kind: 'found' }" instead of rejecting` — the failure names the
violation rather than merely counting. Restored by a **targeted inverse edit**, 🔴 never
`git checkout <file>`, and re-run green.

⚠️ **What this does NOT prove.** The agency arm of `decideAccess` cannot refuse through this
boundary today, because `subject.agencyId` is always the session's own organization; and the
client-crossing arm is unreachable while `decideSignIn` refuses client memberships with
`client-scope-not-yet-served`. So the demonstration was built at the level where the boundary **is**
live — the freshly-read membership — 🚫 not at a level where it would have been theatre.

---

## 5. Three guards NARROWED, 🚫 none widened or deleted

> ⚠️ **One pattern produced all three post-ADR-0078 audit gaps, and it caught slices 1 and 4 too:**
> a guard whose **SCOPE** was narrower than the **RULE** it asserted.
> 🛑 **A NARROW SCAN IS NOT A NARROW RULE.**

1. **`@age/access-scope` — "has no caller yet" → "exactly one caller, pinned by name."** Slice 4 is
   where the caller arrived. The guard was **narrowed, 🚫 not deleted** — deleting it to wire up one
   screen would have discharged ADR-0079 §6 silently, which is the exact move this repo has been
   caught by before. It now pins one importer path **and** one manifest **and** asserts the importer
   really calls `decideAccess`, so the assertion cannot keep passing against a path renamed away.
2. **`action-protection.test.ts`** — now requires a scope **and** a capability literal matching
   `requireScopedAccess('x.y',` **and** the **absence** of the old bare `requireVerifiedSession`
   call, so an action cannot reach the session boundary around the scope boundary.
3. **`@age/sign-in-directory-persistence` — pinned to its two composition doors.** Two, 🚫 not one,
   deliberately: the sign-in door can **insert a session**, and a read that happens on **every**
   request must 🚫 not travel through a door that can mint a credential. Two doors each with one
   checkable sentence beats one door whose sentence needs an _"except"_.
   ⚠️ Its product-wide walk reads **`.tsx` as well as `.ts`** — the package-local walk reads `.ts`
   because this package has no components, but a **screen** importing the directory is exactly the
   violation a `.ts`-only walk cannot see. **Proven by adding a third importer as a `.tsx` file** and
   watching the guard name it by full path.

---

## 6. What is still refused, by name

- 🛑 **A `platform` membership is refused**, here and at sign-in. **ADR-0080 is `Proposed` and
  authorizes nothing.** ⚠️ The "just match NULL too" fix is a widened guard in database form. It
  would show up in this track as the platform test being **DELETED, 🚫 not changed** — which is
  precisely why that test is written down.
- 🛑 **AGE mints nothing.** Verification is not issuance; provisioning remains a human act.
- 🚫 A membership AGE cannot express as a scope is **refused, never approximated by the nearest one
  it can** — the nearest scope that parses is always the **wider** one, so "close enough" here is a
  grant nobody wrote down.

---

## 7. Verification — and its limits

Repository, 2026-08-19:

- `nx run-many -t typecheck lint test --skip-nx-cache` → **64 projects, exit 0**
- `apps/studio` 318 tests / 30 files · `@age/access-scope` 52 · `@age/sign-in-directory` 12 ·
  `@age/sign-in-directory-persistence` 23 · `prettier --check` clean
- PR #387 CI green on the **full** `head_sha` `7dbad5384f8c4e14b87904e066340e90d36f18b6` —
  both workflows, **18 and 15 steps EXECUTED** (🚫 0 steps is not a gate, and 🚫 "the newest
  success" is not a match)

🛑 **None of this is a VPS fact.** Slice 4 has not been deployed. Three consecutive defects in this
repository's history passed every local gate **and** CI and died on the first real run on the box.

🛠️ **The remaining gate is the browser, and it is the owner's** — open the console, press _Continue
with Google_, sign in. 🚫 I never sign in as them, and 🚫 never plant a session row instead.

---

## 8. Open, and all the owner's

- **ADR-0079 D5.**
- **ADR-0080 (`Proposed`, PR #385)** — the super admin cannot sign in.
- **ADR-0081 (`Proposed`, PR #386)** — the fifth `age-deploy` wrapper, taking setting names on
  stdin so 🚫 credentials never enter `argv`.
- **ADR-0076 D8** — the peer→AGE direction.
- **The provenance threshold** — whether the deployed store begins holding **real** client data.
  ⚠️ Both snapshot rows on the box are fictional.

🚫 No slice may assume an answer to any of these.
