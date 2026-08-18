# ADR-0079 — Who may sign in to AGE: three scopes, a real login page, and the four refusals it costs

Status: **Proposed** (2026-08-18) — 🛑 **A DECISION REQUEST FOR THE PRODUCT OWNER. It authorizes
NOTHING.** 🚫 Not self-accepted. 🚫 No code, migration, grant or dependency may be written against it
until the owner accepts it in their own words, recorded verbatim, in a separate PR.

Raised by: the Product Owner, 2026-08-18 — _"why there is not a simple login page with google oath
option"_, and _"we had taken a call where we will have super admin and agency and individual client
login … check the tenancy code in rankops and duplicate that."_

Depends on: ADR-0055 **D7** · ADR-0068 **§0.1c** · ADR-0074 **D3/D4** · ADR-0076 (container
isolation) · ADR-0062 **D1/D2** (the organization is the tenant; a client is a SUBJECT, never a
principal).
Amends, **if accepted**: ADR-0055 D7, ADR-0068 §0.1c, ADR-0074 D4 — 🛑 each one **explicitly**, 🚫
none by implication.

---

## 1. 🛑 THE RECORD AND THE OWNER'S INTENT HAD DIVERGED, AND THAT IS THE REAL FINDING

⚠️ The owner's words were _"I don't know when we decided this."_ **They are right to doubt it.**
`main` carries ADR-0055 **D7** — _no business-owner login, and 🚫 no preparatory code, route, model,
permission, UI or abstraction for one_ — reaffirmed **by name** in ADR-0074. 🚫 Nothing on `main`
records a decision for three sign-in scopes.

🛑 **AND THE "PACKAGE 81 / TENANCY BRIEF" WAS MISFILED, 🚫 NOT WRONG.** The handoff recorded the
owner judging it _"demonstrably from the wrong workstream"_ because **every symbol in it was absent
from AGE**. ⚠️ **Measured today: every one of those symbols exists and ships in RANKOPS** —
`Rankops/apps/backend/src/tenancy/platform-scope.ts` opens _"Package 81 (ADR-0058) — THE PLATFORM
SCOPE"_, beside `agencies.service.ts` (_"Package 81 (ADR-0058 §4) — the AGENCY navigation level"_).

⚠️ **So the earlier judgement was correct about the DOCUMENT and 🚫 was never a judgement about the
FEATURE.** A brief for one product was read in another. **The absence of a decision in AGE is not a
decision against it** — which is exactly why this ADR is a request rather than a refusal.

---

## 2. What RankOps actually built, read from its source rather than described from memory

⚠️ **A CORRECTION THE OWNER SHOULD SEE BEFORE DECIDING, because it changes the design.** "Super
admin / agency / client" is 🚫 **NOT** RankOps' role enum. RankOps separates **two axes**, and that
separation is the strongest idea in it:

- **CAPABILITIES are the enforcement; ROLES are only convenience bundles** (`authz/capabilities.ts`):
  `admin · strategist · approver · reviewer · viewer`, each a bundle of capability atoms.
  ⚠️ `Execute` exists and is 🛑 **in no bundle at all** — a capability declared but never granted.
- **SCOPE is the hierarchy** the owner is describing: **platform → organisation (agency) →
  workspace (client)**. `super_admin` is a **scope**, not a bundle.

**The four properties worth copying, each for a stated reason:**

1. 🛑 **THE PLATFORM BRANCH IS COMPOSED ON TOP, 🚫 NEVER ADDED INSIDE THE MEMBERSHIP PREDICATE.**
   Its own header says why: a platform branch inside the shared predicate _"would make every read in
   the application implicitly platform-wide"_, including reads written later by someone who never
   read the ADR. ⚠️ **This is AGE's own "a narrow scan is not a narrow rule" from the other
   direction**, and it is the property most easily lost in a port.
2. 🛑 **THE ROLE IS READ FROM THE DATABASE PER REQUEST, 🚫 NEVER FROM THE TOKEN CLAIM.** A demoted
   super admin loses platform scope on the **next request**, 🚫 not at token expiry. ⚠️ This is
   exactly AGE's shipped revocation property (`revokedAt` re-checked on every request) applied to
   the role — **so AGE already agrees with RankOps here.**
3. **`PLATFORM_WIDE` is written out literally as `{}`**, 🚫 not hidden behind a helper — _"a
   predicate that matches every row in a multi-tenant system must be impossible to reach by accident
   and obvious when read."_
4. **ONE route for every role, differing only in the predicate**, and an **opaque 404** so a client
   cannot learn how many sibling clients its agency has. 🚫 A super-admin-only surface is refused
   because it would drift from the tenancy model.

⚠️ **AND ONE THING THAT CANNOT BE COPIED.** RankOps is **NestJS + guards + JWT**; AGE is **Next.js
server actions + pure capability packages + effects at one edge**. 🛑 **The MODEL ports; the CODE
does not.** 🚫 Lifting `capability.guard.ts` into AGE would import a framework AGE does not have and
a JWT AGE deliberately does not issue. ⚠️ _"Duplicate that"_ is therefore read here as **adopt this
model**, and 🚫 not as copy these files — if the owner means the files literally, D5 says so.

---

## 3. 🛑 THE FOUR REFUSALS THIS COSTS. Each is shipped, each was deliberate, each must be named.

🚫 **None of these can be quietly relaxed.** Accepting this ADR is accepting all four.

1. 🛑 **ADR-0055 D7 — no business-owner login, and no preparatory code for one.** ⚠️ A **client**
   login IS a business-owner login. This is 🚫 not adjacent to D7; **it is D7's exact subject.**
2. 🛑 **ADR-0068 §0.1c / ADR-0074 D4 — AGE mints nothing.** ⚠️ Enforced **at the database**:
   `age_app` has `GRANT SELECT` + `GRANT UPDATE ("revoked_at")` and 🚫 **no INSERT**. Any login page
   ends in a session row, so this requires `GRANT INSERT` — 🛑 **deleting the one control that holds
   against code nobody has written yet.**
3. 🛑 **ADR-0062 D2 — a client is a SUBJECT, never a principal.** ⚠️ A client that signs in becomes
   a principal. **The whole BIF model treats clients as things AGE reasons ABOUT**; this makes some
   of them things that reason back. 🚫 This is a product-model change, not an auth change.
4. 🛑 **"No external APIs, no URL fetching" + ADR-0076's container isolation** — **only if Google is
   chosen.** AGE today makes **no outbound call at all**, and its container was given no route out
   on purpose. ⚠️ Verifying Google's assertions means fetching its signing keys, i.e. **egress from
   the one container isolated on a host carrying four peer products.**

---

## 4. Options

**Option 1 — Operator-only login, no tenancy.** A sign-in page for AGE's operators; 🚫 no client
accounts. Costs refusals **2** (and **4** if Google). ⚠️ Keeps D7 and ADR-0062 D2 intact.
**It answers the login complaint and 🚫 not the three-scope one.**

**Option 2 — Adopt RankOps' model in full: platform → agency → client, capability-bundled.**
Costs **all four** refusals. ⚠️ Realistically **6–10 slices**: accounts and roles · session issuance
· the scope predicate composed on top · every existing read re-scoped · the opaque-404 boundary ·
client-facing UI. 🛑 **AGE has 10 server actions and 3 database writes today; every one is touched.**

**Option 3 — Option 2's MODEL, adopted in stages, with clients LAST.** Slice 1 is operator sign-in
and the capability layer; the client principal is 🛑 **a separate later acceptance**, so refusals 1
and 3 are 🚫 not spent until the thing that needs them is actually being built.
⚠️ **This is the recommendation.**

**Option 4 — Keep today's hand-planted token.** 🚫 Costs nothing, 🚫 answers nothing. ⚠️ Recorded
because _"do nothing"_ must stay a visible option; **the owner has already measured its cost.**

---

## 5. The recommendation, and the dissent that came with it

**Recommended: Option 3, with Google as the identity provider for OPERATORS only.**

The reasoning: the owner's intent is clear and is the owner's to set, but **refusals 1 and 3 are
product-model decisions, 🚫 not login decisions** — spending them in the same breath as "I want a
login page" is how a stance gets reversed by accident. Staging them keeps every step reversible.

⚠️ **THE DISSENT, RECORDED RATHER THAN RESOLVED.** Staging has a real failure mode: an operator
login shipped now, with clients _"later"_, becomes an architecture that assumed one principal type
forever — and refusal 3 gets paid **twice**, once as a retrofit. 🛑 **If the owner is certain clients
will sign in, designing for two principal types from slice 1 is cheaper than discovering it in slice 7.** ⚠️ **This dissent is not overridden by the recommendation**; it is precisely what D1 asks.

---

## 6. Decision requests — 🛑 EACH ANSWERED SEPARATELY, 🚫 none inferred from another

- **D1.** Option **1**, **2**, **3** or **4**?
- **D2.** 🛑 **May AGE mint a session?** ⚠️ Yes ⇒ amends ADR-0068 §0.1c and ADR-0074 D4 and
  authorizes `GRANT INSERT` on `operator_sessions`. 🚫 A choice of option is **not** consent here.
- **D3.** 🛑 **May a CLIENT sign in?** ⚠️ Yes ⇒ overturns **ADR-0055 D7** and amends **ADR-0062 D2**
  (a client becomes a principal). 🚫 This is the product-model question and is 🚫 not implied by D1.
- **D4.** 🛑 **May the studio container reach the public internet?** Required by Google, 🚫 by
  nothing else. ⚠️ Reverses part of ADR-0076's isolation on a shared host.
- **D5.** _"Duplicate that"_ — **adopt RankOps' MODEL** (recommended; its code is NestJS/JWT and
  cannot run in AGE), or 🛑 **literally port its files**, which would mean AGE takes on NestJS?
- **D6.** Do AGE's roles mirror RankOps' five bundles, or does AGE get its own? ⚠️ 🚫 Do not answer
  _"the same"_ by default — AGE's verbs (capture, map, score, snapshot) are 🚫 not RankOps' verbs.

---

## 7. What is 🚫 NOT authorized by this document

🚫 No code. 🚫 No migration. 🚫 No `GRANT`. 🚫 No egress. 🚫 No accounts table. 🚫 No sign-in page.
🚫 No file copied from RankOps. 🛑 **And 🚫 nothing is done to RankOps itself** — it was **READ**
here and 🚫 must never be modified to _"prepare"_ for this.

⚠️ **Signing in TODAY is independent of every question above.** Planting one session row by hand is
the already-accepted act under the existing design and 🚫 needs no decision here.
