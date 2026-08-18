# ADR-0079 — Who may sign in to AGE: three scopes, two renderings, and a real login page

Status: **Accepted** (2026-08-18) — ⚠️ **BY THE PRODUCT OWNER, 🚫 NOT self-accepted.** This ADR
overturns four shipped refusals, so it was a decision request for the **Product Owner** and was
answered by them. The acceptance is recorded verbatim in §0.2, and the status was flipped in a
**separate** PR from the one that proposed it.

Depends on: ADR-0062 **D1/D2** · ADR-0074 **D3/D4** · ADR-0076 (container isolation).
🛑 **Overturns, EXPLICITLY:** ADR-0055 **D7** · ADR-0068 **§0.1c** · ADR-0074 **D4** ·
ADR-0062 **D2**. ⚠️ Each is named again in §3 with what replaces it — 🚫 none is deleted silently.

---

## 0.1 The owner's direction, verbatim (Product Owner, 2026-08-18)

> _"AGE has the intelligence which give a lot of insights about the client, so there has to be a
> superadmin who has access to all agency account and under agency you have mutiple clients and an
> agency can look at their own clients and then we have clients and clients should look only their
> own report. what is so complicated in this."_

And, answering the one question this ADR put back to them:

> _"two report, now go ahead"_

⚠️ **READ AS:** one snapshot underneath, **two RENDERINGS** over it — 🚫 not two separately
maintained documents. **One source of truth, two views** (§4). 🛑 If the owner meant two independent
artifacts, that changes §4 and this ADR must be corrected 🚫 rather than reinterpreted later.

---

## 0.2 The acceptance, verbatim (Product Owner, 2026-08-18)

> _"Accepted as Product Owner. One snapshot two renderings, clients read-only, proceed with slice
> 1"._

⚠️ **This answers §7 D1 and D2 explicitly** — one snapshot with two renderings, and a client
principal that is **read-only**. 🛑 **D3, D4 and D5 remain OPEN and are still the owner's**; slice 1
🚫 does not depend on any of them, and 🚫 no later slice may assume an answer.

⚠️ **Also decided, same message:** the two ADR-0078 gates (browser verification and the hand-planted
session) are 🚫 **not** taken now — _"once we create login, we will go that path."_ 🛑 **So the
deployed console stays UNREACHABLE until slice 3 lands.** That is the owner's explicit choice, 🚫
not an oversight, and 🚫 it must not be quietly worked around by planting a row anyway.

---

## 0.3 The remaining answers, verbatim (Product Owner, 2026-08-18)

🛑 **D3, D4 AND D5 WERE OPEN WHEN THIS ADR WAS ACCEPTED.** ⚠️ Slice 3 cannot be built without D4 —
a session must expire at some named instant — so the questions were put back to the owner in plain
language before any of slice 3 was written. Their answers, exactly as given:

**D4 — maximum session lifetime.** Asked as _"How long should someone stay signed in before they
have to sign in again?"_, offered 8 hours / 12 hours / 7 days / different per scope. Answered:

> _"8 hours (Recommended)"_

⚠️ **READ AS: eight hours, the SAME for every scope** — the "different per scope" option was
offered and 🚫 not taken. 🛑 The **12-hour ceiling in `session-lifetime.ts` STAYS** and 🚫 is not
relaxed: eight hours is the lifetime AGE _asks_ for, the ceiling is the lifetime AGE will _permit_,
and a chosen value that happens to sit under a bound 🚫 does not make the bound redundant.
⚠️ _"Never expires"_ was never on the table and remains refused.

**D3 — Google for all three scopes?** Answered:

> _"Google for everyone (Recommended)"_

⚠️ **READ AS: ONE sign-in path for platform, agency and client alike.** 🚫 No second credential
kind, 🚫 no magic link, 🚫 no password — for anyone. A client therefore needs a Google account, and
🛑 that is a **product** consequence the owner chose, 🚫 not an implementation detail. ⚠️ Slice 3
still ships **staff first** (§6.3); what D3 settles is that the client path, when it arrives, is
the SAME path — so 🚫 nothing in slice 3 may be shaped as "the staff-only way in".

**The Google client itself.** Asked whether AGE has its own Google OAuth client. Answered:

> _"rankops already has one, use same - E:\ai-powered-crm-projects\Rankops"_

🛑 **READ AS: reuse the peer product's OAuth client ID and secret — and 🛑 THE VALUES ARE NEVER
READ, DISPLAYED OR TYPED BY ANYONE.** ⚠️ The owner asked, fairly, why _they_ should have to paste
it. **They should not, and they do not.** The transfer is done with `secretsafe pipe`, which
streams a value from RankOps' env file straight into AGE's own `/etc/age-studio/*.env` over ssh
**without the value ever reaching a terminal, a transcript or a log** — there is no code path in
that tool that writes a secret to stdout. 🚫 The architect still never SEES the secret, which is
the rule that matters; 🚫 and RankOps is not modified — the file is read by the tool, 🚫 never
opened, and reading was already the only thing ever done to that repository.

🛠️ **WHAT GENUINELY REMAINS THE OWNER'S, AND IT IS ONE CLICK:** adding AGE's redirect URI to that
Google client in the Google console. ⚠️ That needs the owner's Google login, and 🚫 an agent does
🚫 not sign in as them. ⚠️ **The risk was stated to the owner and the choice is theirs:** one client shared by
two products means one leaked secret compromises both sign-ins, and whoever owns that Google
project can revoke AGE's login. 🚫 Swapping to a dedicated client later changes two
environment values and 🚫 no code — the design must keep it that way.

**D5 — what a super admin sees — REMAINS OPEN.** ⚠️ It was 🚫 not asked, because it bears on the
renderings (slice 5) and 🚫 nothing in slice 3 may assume an answer.

---

## 1. 🛑 WHY THE OLD POSITION IS BEING OVERTURNED RATHER THAN DEFENDED

⚠️ AGE's shipped refusals — no client login, AGE mints nothing, a client is a subject — were written
when AGE was **a single-operator internal tool**. **They were correct for that.** 🛑 **The owner is
describing a PRODUCT, and those decisions describe a UTILITY.** A refusal whose premise has changed
is 🚫 not a principle; it is a stale decision, and carrying it forward unexamined would be exactly
the _"stale line is worse than a missing one"_ failure this repository names.

⚠️ **AND THE FEATURE WAS NEVER ACTUALLY REFUSED.** The _"Package 81 / tenancy"_ brief was judged
_"demonstrably from the wrong workstream"_ because **every symbol in it was absent from AGE**.
**Measured 2026-08-18: all of them ship in RANKOPS** (`Rankops/apps/backend/src/tenancy/
platform-scope.ts`, _"Package 81 (ADR-0058) — THE PLATFORM SCOPE"_). 🛑 **The judgement was about a
MISFILED DOCUMENT, 🚫 never about the feature.** So no reversal of intent is being recorded here —
only intent that was never written down.

---

## 2. The model — three scopes, and 🚫 NOT three roles

🛑 **TWO AXES, KEPT APART.** ⚠️ Collapsing them is the failure mode this design exists to avoid, and
it is the one RankOps warns about in its own source.

- **SCOPE — how far you can see.** `platform` (super admin: every agency) → `agency` (its own
  clients, 🚫 and no sibling agency) → `client` (itself, 🚫 nothing else).
- **CAPABILITY — what you may do once you can see it.** Roles are convenience **bundles** of
  capability atoms; 🛑 **capabilities are the enforcement**, 🚫 never the role name.

**Four properties adopted from RankOps, each for its stated reason:**

1. 🛑 **THE PLATFORM BRANCH IS COMPOSED ON TOP, 🚫 NEVER ADDED INSIDE THE MEMBERSHIP PREDICATE.**
   RankOps' own header: a platform branch inside the shared predicate _"would make every read in the
   application implicitly platform-wide"_, including reads written later by someone who never read
   the ADR. ⚠️ **This is AGE's own "A NARROW SCAN IS NOT A NARROW RULE" from the other direction** —
   a WIDE branch in a shared predicate silently widens every rule built on it.
2. 🛑 **THE SCOPE IS READ FROM THE DATABASE ON EVERY REQUEST, 🚫 NEVER FROM A TOKEN CLAIM.** A
   demoted super admin loses platform scope on the **NEXT request**, 🚫 not at token expiry. ⚠️ AGE
   already does exactly this for `revokedAt` — **the products agree; only the record disagreed.**
3. **The platform predicate is written out literally as `{}`** — _"a predicate that matches every row
   in a multi-tenant system must be impossible to reach by accident and obvious when read."_
4. **ONE route for every scope, differing only in the predicate**, with an **opaque 404** for
   anything outside it. 🚫 **No super-admin-only surface** — a second surface drifts from the model,
   and the copy that drifts is the copy still passing its own tests. ⚠️ A client must 🚫 not be able
   to learn **how many sibling clients its agency has** — absence and denial must be
   indistinguishable.

⚠️ **THE MODEL PORTS; THE CODE DOES 🚫 NOT.** RankOps is NestJS + guards + JWT; AGE is Next.js
server actions + pure capability packages + effects at one edge. 🚫 No file is copied, and 🚫 AGE
does not take on NestJS or issue a JWT. **Confirmed with the owner's _"duplicate that"_ read as
ADOPT THE MODEL.**

---

## 3. What this overturns, and what replaces it — 🚫 nothing deleted quietly

| Overturned                                                     | Replaced by                                                                                                                                                                                                             |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ADR-0055 D7** — no business-owner login, no preparatory code | Clients sign in, **scoped to themselves alone**, and see the **client rendering only** (§4)                                                                                                                             |
| **ADR-0068 §0.1c / ADR-0074 D4** — AGE mints nothing           | AGE **may issue a session** after verifying an external identity. ⚠️ `GRANT INSERT` on the sessions table becomes necessary — 🛑 **and the column-scoped `UPDATE ("revoked_at")` STAYS**, so revocation keeps its shape |
| **ADR-0062 D2** — a client is a SUBJECT, never a principal     | A client is **both**: the subject of a BIF **and** a principal who may read its own. ⚠️ 🛑 **A client principal NEVER gains authorship** — §5                                                                           |
| **No external APIs / no URL fetching**, ADR-0076 egress        | The studio container may reach **Google's endpoints ONLY**, for sign-in. 🚫 Egress is 🚫 not opened generally, and 🚫 never to a peer product's store                                                                   |

🛑 **WHAT IS 🚫 NOT OVERTURNED, AND MUST SURVIVE EVERY SLICE:** append-only snapshots ·
**AGE-INV-PROV-1** (provenance alone never changes a score) · the mapper transcribes and never infers
· absence is never a conclusion · no outbound WRITE surface · effects at one edge.

---

## 4. 🛑 THE TWO RENDERINGS — the only genuinely hard decision here

⚠️ **Scoping reads is plumbing. THIS is the product decision**, and it is the reason the owner was
asked before anything was written.

AGE's output is an **assessment OF a client** — gaps, weaknesses, what a business cannot articulate
about itself, a score. **Written for an agency, it is candid by design.** 🛑 The same words shown to
the client are 🚫 not automatically the right words.

**DECIDED: ONE snapshot, TWO renderings.**

- **Agency rendering** — everything: findings, gaps, the candid assessment layer, and the commercial
  reading (where the work is).
- **Client rendering** — their BIF, their score, their findings, **stated as findings 🚫 rather than
  as verdicts.**

🛑 **THE HARD RULES, and they are what make this honest 🚫 rather than two versions of reality:**

1. 🚫 **THE CLIENT RENDERING NEVER CONTRADICTS THE AGENCY RENDERING.** Different **framing** is
   allowed; a different **fact** is 🚫 not. ⚠️ **This is testable and MUST have a guard.**
2. 🚫 **NEITHER RENDERING INVENTS.** Both derive from **one** stored snapshot. **A rendering is a
   projection, 🚫 never a second capture** — a second capture is a second provenance, and
   AGE-INV-PROV-1 forbids that.
3. 🛑 **`not-assessed` STAYS `not-assessed` IN BOTH, WITH ITS REASON.** ⚠️ 🚫 It must never soften
   into "none", a zero, or a blank in the client view. **Absence is never a conclusion** — 🚫 least
   of all when the reader is the business being assessed.
4. ⚠️ **A SUPPRESSED SECTION IS VISIBLY SUPPRESSED**, 🚫 never silently missing. A client seeing a
   shorter report must be able to tell that it is shorter. 🚫 **A hidden section that looks like an
   absent one is a lie by omission**, and it is the exact failure the third rule already refuses.

---

## 5. 🛑 THE LINE A CLIENT PRINCIPAL NEVER CROSSES

⚠️ **A client may READ. 🚫 A CLIENT MAY NEVER WRITE.** 🚫 No answer, no passage, no source
confirmation, no correction, no dispute recorded as fact.

**Why, and it is 🚫 not caution:** AGE's provenance model is _an operator captured what the business
said_. 🛑 **A client writing directly is a SECOND, UNRECONCILED PROVENANCE for the same field** —
and AGE-INV-PROV-1 says two origins for one field stay two, and an incomplete provenance is
**refused, never downgraded**. ⚠️ **The mapper transcribes and never infers**; a client-supplied
correction is neither a transcription nor an operator capture.

🚫 A "client can suggest an edit" feature is **NOT authorized by this ADR** and would need its own,
because it is a provenance decision wearing a UI decision's clothes.

---

## 6. Slices — 🛑 designed for TWO PRINCIPAL TYPES FROM SLICE 1

⚠️ **The owner said clients are coming. Building as though they are not is paying for principal
types twice** — a retrofit, in a codebase where every read would already have been written assuming
one. 🚫 **So clients are 🚫 not deferred to "later"; only their UI is later.**

1. **The scope model, pure.** `platform | agency | client` + capability atoms + bundles. 🚫 No I/O,
   🚫 no framework, no Prisma. **Guards: a client predicate can never widen; the platform predicate
   is reachable only by name.**
2. **Accounts, memberships and session issuance.** Migration, `GRANT INSERT`, the revocation grant
   unchanged. 🛑 **Guard: issuance exists at EXACTLY ONE named module**, proven by the repo-wide
   walk pattern that closed PRs #377/#378 — **scanned over the PRODUCT, 🚫 not one package.**
3. **Google sign-in, operators and super admin first.** Egress to Google only.
4. 🛑 **Re-scope EVERY existing read behind the composed predicate.** ⚠️ All 10 server actions.
   **The most dangerous slice** — a missed read is a cross-tenant leak.
5. **The two renderings** (§4), with the never-contradicts guard.
6. **Agency surface**, then **7. client surface** (read-only, client rendering).

⚠️ **Each slice is its own PR, its own guards, and its own inverse mutation.** 🛑 **Slice 4 does 🚫
NOT merge without a demonstrated cross-tenant refusal** — proven by breaking the scope and watching a
guard name the exact violation, 🚫 never by an empty result set (**isolation is proven by neither RLS
nor an empty result**).

---

## 7. Decision requests — ⚠️ the shape is settled; these are the remainder

- **D1.** Confirm §4's reading: **one snapshot, two renderings** (🚫 not two maintained documents).
- **D2.** Confirm §5: **a client principal is READ-ONLY, permanently.**
- **D3.** ✅ **ANSWERED §0.3** — _"Google for everyone"_. One path for all three scopes.
- **D4.** ✅ **ANSWERED §0.3** — _"8 hours"_, the same for every scope. 🛑 The 12-hour ceiling
  STAYS. ⚠️ "Never expires" remains **refused**.
- **D5.** Does a **super admin** see the agency rendering, the client rendering, or **both, labelled**?
  ⚠️ Recommended: **both, always labelled** — 🚫 an unlabelled view is how a candid line reaches a
  client by accident.

---

## 8. 🛑 ACCEPTANCE — the one thing still owed

⚠️ **This ADR is `Proposed`. 🚫 It authorizes nothing yet, and 🚫 the architect does not accept it.**

To authorize slice 1, the owner states acceptance **in their own words** — ⚠️ they are recorded here
verbatim, and the status is flipped in a **separate** PR. **An acceptance must answer D1 and D2
explicitly**; 🚫 the remaining decision requests may follow.

🚫 **Until then: no code, no migration, no `GRANT`, no egress, no dependency, and 🚫 nothing done to
RankOps** — it was **READ** here and 🚫 must never be modified to prepare for this.
