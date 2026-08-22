# ADR-0090 — The identity a new client record is given

Status: **Accepted** (2026-08-22)

🛑 **ACCEPTED BY THE ARCHITECT, 2026-08-22, AND 🚫 NOT BY THE OWNER.** This decision is internal,
reversible in code, and reachable from the accepted ADRs, so under constitution §5 it is mine and
the owner's signature is 🚫 not spent on it. ⚠️ Recording it as `Proposed` and handing it over would
have been the abdication §5 names — _"it reads as rigour and is abdication."_ 🛑 If any part of this
turns out to provision or name a real person, account, membership, client or organization, that
part is **not** covered by this acceptance and returns to the owner.

⚠️ **Prompted by the owner's question**, 2026-08-22, verbatim:

> _"why we have complicated client onboarding, i saw client id , organisation id, now this are id
> why cant we design a format and we create this independting rather than client inventing it in
> any format"_

🚫 That is a question, 🚫 not an acceptance, and it is recorded as the thing that prompted the
review rather than as authority for the answer.

Depends on: ADR-0053 (the client registry and what a record may hold) · ADR-0058 **D4**
(Organizations is a derived band, 🚫 not a level) · ADR-0086 (one host serves one organization, and
its name is a label). Amends: ADR-0058 **D4** — see §4. Supersedes: nothing.

---

## 1. Why

Creating a business today asks the operator to type **three** things, of which **two are
identifiers**: `clientId`, `organizationId`, `displayName`. Both identifiers are free-form strings
the operator invents.

Reviewing that on its own terms produced three findings, and 🛑 only the third is a matter of taste.

### 1a — `organizationId` has exactly one accepted value, and the form asks anyway

`client-actions.ts` refuses any `organizationId` that is not the session's, naming the field. So the
server already knows the answer, already holds it, and already rejects every other answer.

🛑 **A FIELD WITH ONE VALID ANSWER IS 🚫 NOT AN INPUT.** It is a recall test whose only feedback is
a refusal. ⚠️ And the refusal is indistinguishable, to the operator, from having named an
organization that is real but not theirs.

⚠️ **This is 🚫 NOT a security defect and must not be reported as one.** Nothing can be written to
another organization through this form; the gate holds. It is a usability defect standing on top of
a correct boundary.

### 1b — The reason it is free-form has outlived the condition that made it true

ADR-0058 D4 made `organizationId` an operator-typed string because there was **no organization
anywhere** — an organization existed only because client records named it, so there was nothing to
mint an id _into_, and a minted id would have made two clients of one agency into two organizations.

⚠️ **That was correct then and is stale now.** Since the sign-in work, organizations are real:
`account_memberships.organization_id`, `AGE_STUDIO_ORGANIZATION_ID`, and ADR-0086's
`organizationsThisConsoleServes()` returning `{ id, displayName }` under a decision that **one host
serves one organization**.

🛑 **THE VALUE IS ALREADY DERIVABLE. IT IS BEING TYPED OUT OF HABIT.**

### 1c — A typed `clientId` puts the business's NAME into URLs and filenames

`clientId` is typed because it **names things**: the route (`/b/<clientId>/…`) and the operator
workspace's filenames (`operator-workspace.ts:424`). Hence the form's warning that it _"cannot be
changed later without moving them."_

But a human asked for an id and shown a business will type a **slug of that business's name**. So
the name lands in every URL, every filename on disk, and anything that records either.

🛑 **THE PROJECT ALREADY TREATS THAT EXACT LEAK AS A DEFECT ELSEWHERE.** ADR-0053 D3 keeps real
records out of the repository, and `forbidden-client-names.ts` holds the operator's live client
names as **digests** so that the guard against the leak is not itself the leak. ⚠️ Minting the same
names into routes by hand is the same disclosure through a door nobody was watching.

⚠️ **Stated honestly: this is the weakest of the three findings.** It is a real leak, but into
surfaces (a URL bar, a directory listing) whose audience is largely the operator. It is 🚫 not
equivalent to committing a name to a public repository, and this ADR does 🚫 not claim it is.

## 2. The decision

**D1 — A new client record's `clientId` is MINTED BY AGE, and the form 🚫 no longer asks for one.**

The form asks for **`displayName`** and **`externalRefs`**. That is the whole of it: what the
operator calls the business, and what other systems call it.

**D2 — A new client record's `organizationId` is DERIVED from the session, and the form 🚫 no longer
asks for one.** It is **rendered**, read-only, so the operator sees the scope they are writing
into. ⚠️ Showing it is 🚫 not asking for it.

**D3 — The mint happens at the EFFECT EDGE, 🚫 never in the pure package.** `@age/studio-shell` has
no clock and no randomness and 🛑 must not acquire either. `apps/studio` mints the id in its one
effect module and passes it **in**; the pure package validates a supplied id exactly as it does
today. ⚠️ A pure package that mints is a pure package with a hidden effect, and the next thing it
grows is a `Date.now()`.

**D4 — 🛑 EXISTING RECORDS KEEP THE IDS THEY HAVE, AND THERE IS NO MIGRATION.**
`clientId` stays "a validated non-empty string" in the type and at every read. 🚫 Nothing is
renamed, 🚫 no file is moved, 🚫 no URL breaks, and 🚫 no live client record is touched — which is
also why this ADR needs no owner act. ⚠️ The change is **at the point of creation only**.

⚠️ **The cost, named rather than discovered:** the record file will hold two shapes of id — the
three legacy typed ones and every minted one after. 🚫 That is not tidied up later by a sweep. A
sweep would move real client files and rewrite real client URLs, which is an owner act against live
client data, and 🛑 tidiness is not a reason to touch it.

**D5 — The minted form is `cli_` + 32 hex characters**, from `randomBytes(16)`.

⚠️ **`randomBytes`, 🚫 never `Math.random`** — the same choice `mintOpaqueValue` already
makes, and made the same way so there are 🚫 not two standards for randomness in one app.
🛑 A client id is 🚫 **not** a secret and this ADR does not pretend otherwise; the reason to use
the strong source is that a weak one has no upside, 🚫 not that the id defends anything. ⚠️ **It carries no meaning, and that is the
point** — 🚫 not a timestamp, 🚫 not a counter, 🚫 not a slug of the display name, 🚫 not the
organization. An id that encodes a fact is an id that becomes wrong when the fact changes, and a
slug of the name is the leak D1 exists to close.

⚠️ It must satisfy `assertSafeClientIdForFileName` like any other id. The alphabet is chosen so it
does by construction, 🚫 not so the check can be skipped: **the check still runs on the minted id.**
🛑 A mint trusted because of where it came from is exactly the "stored rows are untrusted input"
rule being waived for a value we happen to like.

## 3. What this deliberately does NOT do

- 🚫 **It does not create an organization**, and 🚫 does not add a tenant model. ADR-0086's _one host
  serves one organization_ stands. D2 reads the one that exists; it does 🚫 not invent a level.
- 🚫 **It does not provision anything.** 🛑 AGE still mints nothing **that grants access** — and
  ⚠️ the word "mint" in D1 is deliberately about an **identifier**, 🚫 never a credential, a session,
  an account or a membership. A client record is a **subject**, and creating one has been an
  entitled console action since ADR-0074 slice 3. 🛑 The refusal held across ADR-0068, 0074, 0079,
  0080, 0082, 0083 and 0086 is untouched by this ADR.
- 🚫 **It does not make `clientId` opaque at the type level.** It stays a string. Introducing a
  branded `ClientId` would touch every capability package for no behaviour, and 🚫 broad refactors
  are out (constitution §3.7).
- 🚫 **It does not change `/b/[clientId]`.** The route still takes the id; ADR-0058 D5 stands — a
  selection is a **filter**, 🚫 never a grant.

## 4. The amendment to ADR-0058 D4, said plainly

ADR-0058 D4 refused an Organizations **area** on the grounds that a selectable scope is a typed
scope by another name. 🛑 **That reasoning is untouched and this ADR strengthens it:** D2 removes
the last place `organizationId` was typed at all. 🚫 There is still no `/organizations` route, 🚫 no
picker inside a session, and 🚫 no "current organization" in state.

⚠️ What is amended is one **clause**, 🚫 not the decision: D4's _"the organization is a string the
operator supplies"_ becomes _"the organization is derived from the session."_ The Organizations band
stays **derived from the resolved records** exactly as before.

## 5. The guards

1. 🛑 **A minted id is never a slug of the display name.** Creating a record with a display name and
   asserting the returned id does 🚫 not contain any normalised run of it — the leak in 1c, asserted
   rather than described.
2. 🛑 **Two records created with the SAME display name get different ids.** The case a
   name-derived mint would fail, and it fails **loudly** rather than by overwriting a record.
3. **The minted id passes `assertSafeClientIdForFileName`** — the check runs, 🚫 it is not skipped
   for being ours.
4. **The record is written into the SESSION's organization**, and a submission carrying a different
   one is still refused. ⚠️ The field is gone from the form; 🚫 the gate behind it is not.
5. 🛑 **The pure package still mints nothing.** `@age/studio-shell` is asserted to contain no
   `randomUUID`, no `Math.random` and no `Date.now` — D3 as a test, so the next contributor cannot
   quietly move the mint inward.

⚠️ Every one of these is proven by **deliberate mutation** before it is believed (constitution §5).
🚫 A guard that has only ever passed is not evidence.

## 6. What this does NOT prove

🚫 **Nothing here is a host fact.** This ADR is a decision and its guards are repository tests.
⚠️ Whether an operator can actually create a business through the deployed console with two fields
instead of four is a **browser** gate, and 🛑 it has not been opened.

## 7. The larger question this ADR does NOT answer

The owner's word was _"onboarding"_, and the heaviest step is 🚫 not either identifier: granting a
person access still requires **root SSH and a bash script**. Moving that into the console would
overturn _"AGE mints nothing / no provisioning path"_ — a refusal held by name across seven ADRs —
and it **provisions a real person**, which is the owner's class twice over under constitution §5.

🛑 **THAT IS 🚫 NOT DECIDED HERE, AND 🚫 NOT DECIDED BY ME.** It is owed a separate ADR at
`Status: Proposed`, which is a **decision request** and authorizes nothing.
