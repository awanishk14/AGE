# ADR-0068 — The second operator, and the caller `askEntitlement` has never had

Status: **Accepted** (2026-08-11), §5 A and B both answered by the Product Owner — see §0.1.
🚫 **NOT self-accepted.** It was raised as a decision request because ADR-0066 §7 Q4 is
**answered** — the first real human after the developer is **a second operator** (§0.6) — while
every fence in front of slice 7 was still standing, and two of them are fences only the Product
Owner may lower. ⚠️ **Those two are now lowered, together with exactly what §7's consequences
require to stand them up — and 🚫 nothing else. Read §0.1b for what was lowered and §0.1c for what
was NOT, before writing a line of slice 7.**

Depends on: ADR-0066 D7 + §0.5d + §0.6–§0.6c, ADR-0055 A2/D6/D7, ADR-0061 A2/A3, ADR-0062 D1–D3,
ADR-0058 D1/D2, ADR-0053 D4, ADR-0046 D5, ADR-0057 D4.
Supersedes: nothing.

---

## 0.1 The Product Owner's answer to §5 (2026-08-11)

⚠️ **This ADR was 🚫 NOT self-accepted.** §5 A and §5 B were put to the Product Owner as the two
questions they were written to be, and the Product Owner answered both. ⚠️ **The answer was given
as a selection from the four (A) and two (B) shapes §5 offered, 🚫 not as free prose**, so what is
recorded below is the selected option quoted **verbatim as the owner read it**. 🚫 This is not a
paraphrase, and 🚫 it is not the architect restating his own recommendation as an answer.

**Question A — how does an operator prove who they are? → A1, the operator-provisioned token:**

> **An operator-provisioned token**, issued out of band by the developer, hashed at rest, with a
> required absolute expiry. No password, no reset flow, no email. Cheapest; entirely adequate for
> two people; 🚫 unusable for a tenth operator.

**Question B — who provisions Operator 2, and is that a code path or an act? → an act:**

> If it is an act — the developer inserting one row deliberately, once — then AGE ships **no**
> provisioning code, and the first second-operator account is an event with a date, exactly as
> ADR-0055 D7's first capture write was meant to be.

### 0.1a The architect's recommendation and the owner's answer agree — and that is a fact, not a confirmation

⚠️ §5 offered **A1 + B-as-an-act** as a recommendation, explicitly _"offered as a recommendation
and 🚫 not as a decision"_, and the owner selected exactly that. ⚠️ **Agreement here is not
independent corroboration** — the owner chose from shapes the architect wrote, so the framing was
the architect's. Recorded plainly (finding 7): a recommendation the owner adopts remains a
recommendation the owner adopted, 🚫 never evidence that the recommendation was independently
correct. If the shapes were wrong, this acceptance carries that error forward.

### 0.1b What this acceptance lowers — only what §7's consequences require, and 🚫 nothing else

⚠️ The measure is **§7**, read narrowly: what is lowered is exactly what is needed to produce
_"an authenticated principal, and `askEntitlement`'s first real caller, on a read path"_, and
🚫 nothing beyond it.

- ✅ **The §3 stop condition on the session store is crossed ONCE, deliberately, with the owner's
  answer on the record** — the rows, and therefore a Postgres model, a migration and an RLS
  policy, for **the session store only**. 🚫 This is not general schema authorization: any other
  table, including a draft table, is a **separate** decision (ADR-0067).
- ✅ **`askEntitlement` may gain its first real caller**, on a **READ** path, inside the V1
  boundary. ⚠️ The guard asserting it has no caller is therefore replaced by the caller itself —
  🚫 it is not deleted "temporarily" ahead of one, and 🚫 not relaxed to make room.
- ✅ **A presented token may be VERIFIED on that read path**, and a verified request may carry the
  resulting principal. ⚠️ This is stated explicitly because §6 banned _"no session cookie
  issuance, no middleware"_ while the question was open, and A1 is unbuildable if verification has
  nowhere to live — an operator must be able to present a credential and be refused or admitted.
  🛑 **VERIFICATION IS NOT ISSUANCE.** With A1 the token is minted **out of band, by an act**
  (§0.1a, B), so AGE **reads** a credential it never issued: 🚫 no login route, 🚫 no login screen,
  🚫 no session-issuing endpoint, 🚫 no "sign in" of any kind. ⚠️ The exact placement is a design
  question for the slice's PR and must be reviewable — 🚫 it is not licence for a general auth
  framework, and 🚫 a middleware that grows an issuance path has left what was accepted here.

### 0.1c What this acceptance does 🚫 NOT lower — read before writing a line of slice 7

- 🚫 **No provisioning surface, of any kind.** B-as-an-act means AGE ships **no** account-creation
  code: no route, no CLI subcommand, no seeding script, no "just for the first one" helper. The
  first second-operator row is inserted by the developer, deliberately, once, and it is **an event
  with a date**. ⚠️ A provisioning code path is a **write surface** (ADR-0057 D4) and was refused
  here by name.
- 🚫 **No login route, no login screen, no session issuance, no "sign in".** A1's token is minted
  by an act, out of band; AGE only ever **verifies** one (§0.1b). ⚠️ A route that hands back a
  session in exchange for anything is issuance, whatever it is called.
- 🚫 **No second-operator UI and no operator switcher** — both refused by name in §6 and 🚫 not
  reached by this acceptance. ⚠️ The proof §0.1d demands is a `denied`, 🚫 not a screen.
- 🚫 **No password, no reset flow, no email, no lockout, no rotation** — A2 was not chosen, and
  each of those arrives only with it. 🚫 No OIDC, no external identity provider, no new network
  trust boundary (A3 was not chosen).
- 🚫 **A1 is adequate for two people and NOT for ten** — the owner accepted that limit in the same
  sentence that accepted the shape. 🚫 A tenth operator is a **new ADR**, and 🚫 the token model
  must not be built "so it can grow later": _"future compatible"_ is the named failure mode
  (§6, ADR-0066 §0.6).
- 🚫 **ADR-0055 D7 remains undischarged** — this is a read path, 🚫 not a capture write, and 🚫 it
  does not become one.
- 🚫 **No business-owner anything** — independently refused (§6, ADR-0066 §0.6), untouched here.
- 🚫 **The V1 boundary is unchanged**: read / browse / inspect / understand. A second operator
  authorizes **no** business action and **no** write capability.
- ⚠️ **RLS is still coherence, not authorization** (ADR-0046 D5). 🚫 Crossing the §3 condition to
  write an RLS policy does 🚫 **not** turn that policy into the isolation proof.

### 0.1d The acceptance criterion, unchanged by this acceptance

🛑 **The proof is a real `denied`, raised BEFORE a query exists** (§4). 🚫 An empty result set is
**not** a proof — it is indistinguishable from a business with no data. ⚠️ And ADR-0066 §0.6a
still governs what "done" means: _"Operator 2 is not just another login screen. It is the first
real proof that ADR-0055's entitlement problem has actually been solved."_ A slice 7 that ships a
working token login while `askEntitlement` still has no real caller has 🚫 **not** shipped slice 7.

### 0.1e What is authorized, precisely

⚠️ **This acceptance authorizes the SHAPE, 🚫 not a slice.** Slice 7 is now buildable under the
standing per-slice process — smallest slice, one branch, one PR, gates verified — and every
boundary in §0.1c binds it. 🚫 Nothing here authorizes ADR-0067's question, which is separate and
answered separately.

---

## 1. Why this ADR exists

Slices 5 and 6 have shipped. Slice 7 — the second operator — is next in ADR-0066 §5's order, and
§0.6c is explicit that Q4's answer **removed the open question and lowered none of the fences**:

- 🛑 the **session store rows** (ADR-0055 A2's Postgres model + migration + RLS) are independently
  a **§3 stop condition**;
- 🛑 **ADR-0066 D7** forbids any inbound surface accepting tenant-scoped data until
  `askEntitlement` has a real caller;
- ⚠️ and **RLS is a coherence constraint, not an authorization boundary** (ADR-0046 D5), so
  _"Operator 2 only sees their rows because RLS says so"_ would 🚫 **not** be the proof §0.6a
  demands.

So slice 7 cannot be built by deciding to build it. ⚠️ **This ADR does not build it and does not
authorize it.** It records the design that Q4's answer settled, names the exact things that are
missing, and asks the two questions whose answers are not the architect's to give.

🛑 **THE ACCEPTANCE CRITERION IS THE OWNER'S SENTENCE, NOT A LOGIN SCREEN:**

> **"Operator 2 is not just another login screen. It is the first real proof that ADR-0055's
> entitlement problem has actually been solved."**

A slice that produces a working second login while `askEntitlement` still has no real caller has
🚫 **not** done what slice 7 is for.

## 2. What is NOT in question

- 🚫 **NO BUSINESS-OWNER LOGIN, AND NO PREPARATORY WORK FOR ONE — OF ANY KIND.** The owner
  enumerated it: routes, models, permissions, UI, abstractions (§0.6b). 🚫 Not a `principalType`
  union with a second arm "for later", 🚫 not a client-scoped entitlement shape nothing calls,
  🚫 not a screen behind a flag. ⚠️ "Future compatible" is the **named failure mode**, not a
  justification. If a business owner is ever to access AGE, that is a **separate ADR**.
- 🚫 **ADR-0062 D2 stands.** The business is a **subject** of the system, never an authorized
  principal, and a client record does not become an identity.
- 🚫 **THE V1 BOUNDARY IS UNCHANGED — read / browse / inspect / understand.** A second operator is
  a second **reader**. 🚫 "Second operator" authorizes no business action and no write capability,
  and ADR-0057 D4's class 3 refusal is untouched (a "preview" or "dry run" is still class 3).
- 🚫 **A `VerifiedSession` IS NOT AN `OperatorPrincipal`** (ADR-0053 D4, ADR-0061 A2). One says who
  was authenticated; the other is caller-asserted provenance. 🚫 Neither is ever promoted into the
  other, and 🚫 an `OperatorPrincipal` is never accepted as an `Authentication`.
- 🚫 **A session carries no role, no `isAdmin` and no permission list** (ADR-0062 D3). Admin is
  never a bypass, and a flag on a session is how a bypass arrives.
- 🚫 **`not-established` never collapses to `denied` or to `false`** (ADR-0058 D2). It is an
  epistemic state, and it renders as `not-assessed` — 🚫 never as a failure, a warning or a red
  state.
- 🚫 **DO NOT SEED A ROW.** Neither a session row nor a snapshot row. ADR-0055 D7 has still never
  happened, and a seeded row would make the first real proof a proof of the seeding.

## 3. What is actually missing, named exactly

Everything below exists as **rules with no performer**. That is deliberate, and it is why the gap
is narrow rather than vague.

| #   | Missing thing                                                       | Where its rules already live                                              | Why it is missing                                                            |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | The session **rows** — a Postgres model, a migration, RLS           | `@age/session-store` (shape + `assessSession`, storing nothing)           | Schema/migration/RLS is a **§3 stop condition**                              |
| 2   | Minting a session — the effect that issues a token and writes row 1 | `hashSessionToken`, `sessionExpiryFrom` (pure)                            | An effect needs a composition root and a decided credential model            |
| 3   | The **caller** for `askEntitlement`                                 | `@age/entitlement` (one implementation, a guard asserts it has no caller) | ADR-0066 D7 — the caller must arrive **deliberately**, in the required chain |
| 4   | A second operator **account**                                       | nothing                                                                   | Question B below                                                             |

⚠️ **Item 3 is the one that matters.** The required chain is the owner's, verbatim:

> `principal → entitlement → scope → allowed operation → data`

🚫 and never `caller → clientId → database`. ⚠️ The entitlement check must precede **application
acceptance, persistence, transformation, queuing, or any other processing** of a tenant-scoped
payload (§0.5d). 🚫 "We only buffered it", 🚫 "we only parsed it to route it", 🚫 "we only enqueued
it" are **not** exceptions.

⚠️ Note what item 3 does **not** require: it does not require an ingest endpoint. A real caller can
be a **read** path — which is exactly the V1 boundary — and that is the cheapest honest way to
discharge D7 without building the most expensive mistake available in this repository.

## 4. The design Q4's answer settles (recorded, 🚫 not authorized)

Stated so that the eventual slice is judged against a written shape rather than against whatever
gets built:

1. **Two operator accounts, one organization.** The tenant is the **organization** (ADR-0062 D1).
   Operator 2 is entitled to the same organization as Operator 1, and to nothing else. 🚫 The
   `client` arm of an entitlement subject is not the organization arm with extra filtering.
2. **Isolation is proven by a denial, not by an absence.** The proof §0.6a demands is a real
   `denied` — an operator of organization A asking for organization B's scope and being refused by
   `askEntitlement`, **before** any query is built. 🚫 An empty result set is not a proof: it is
   indistinguishable from a business with no data.
3. **RLS is the second line, and is described as coherence** (ADR-0046 D5). ⚠️ If the entitlement
   answer and the RLS outcome ever disagree, that is a **defect**, and the disagreement must be
   detectable rather than absorbed.
4. **Every screen already refuses honestly.** A second operator changes who is asking; 🚫 it does
   not change what AGE can say, and 🚫 no `not-assessed` becomes an answer because a second human
   logged in.

## 5. The questions for the Product Owner

**Question A — how does an operator prove who they are?** AGE has never had a credential model,
and 🚫 the architect must not invent one. Four shapes, and the fourth is a real answer:

1. **An operator-provisioned token**, issued out of band by the developer, hashed at rest, with a
   required absolute expiry. No password, no reset flow, no email. Cheapest; entirely adequate for
   two people; 🚫 unusable for a tenth operator.
2. **Password + hash**, with everything a password implies — reset, lockout, rotation, and a
   support path that is itself an authentication bypass if done casually.
3. **An external identity provider** (OIDC). Strongest, and the only one that scales past a
   handful of humans; adds an external dependency and a network trust boundary AGE does not have
   today.
4. **None yet — Operator 2 arrives without persistence**, proving entitlement over a session
   verified in-process for one run. Proves the chain; proves nothing about durability.

**Question B — who provisions Operator 2, and is that a code path or an act?** If it is a code
path, it is an account-creation surface, and 🚫 that is a write surface with all that implies. If
it is an act — the developer inserting one row deliberately, once — then AGE ships **no**
provisioning code, and the first second-operator account is an event with a date, exactly as
ADR-0055 D7's first capture write was meant to be.

⚠️ **A recommendation, offered as a recommendation and 🚫 not as a decision:** **A1 + B-as-an-act.**
It is the smallest thing that can produce the owner's proof — a real `granted`, a real `denied`,
and a real second human — without inventing a credential model AGE will have to live with, and
without shipping a provisioning surface before anyone has been provisioned.

## 6. What may proceed before this ADR is answered

> ⚠️ **THIS SECTION IS SPENT — the ADR is answered (§0.1, 2026-08-11).** It is kept as the record
> of what was refused while the question was open, 🚫 not as a live list. ⚠️ **Read §0.1b and
> §0.1c instead**, which state exactly which bans were lifted — the session-store rows, the
> `askEntitlement` caller, and **token verification** on the read path — and which remain in force
> **unchanged**: 🚫 the login route and any session **issuance**, 🚫 the second-operator UI, 🚫 the
> operator switcher, 🚫 any provisioning surface, and, independently, 🚫 business-owner anything.
> 🛑 **The line below reading "no session cookie issuance, no middleware" is now PARTLY lifted and
> partly not** — verification yes, issuance **no** (§0.1b). 🚫 Do not cite a lifted line here to
> justify a banned one, and 🚫 do not read "no schema change" as still binding the session store.

🚫 **Nothing that touches items 1–4 of §3.** Specifically, and by name:

- 🚫 No schema change, no migration, no RLS policy.
- 🚫 No login route, no session cookie issuance, no middleware.
- 🚫 No caller for `askEntitlement` — the guard that asserts it has none stays, and 🚫 it is not
  relaxed "temporarily".
- 🚫 No second-operator UI, and 🚫 no "operator switcher".
- 🚫 And, independently of all of the above: no business-owner anything.

✅ **What may proceed:** documentation, this ADR, and slices that touch none of the above.

## 7. Consequences if this ADR is accepted as recommended

- AGE gains its first **authenticated** principal, and `askEntitlement` gains its first real
  caller, on a **read** path — inside the V1 boundary.
- ADR-0055 D7 remains undischarged: 🚫 this is not a capture write, and 🚫 it does not become one.
- The session store gains rows and therefore a migration — the §3 stop condition is crossed
  **once, deliberately, with the owner's answer on the record**, which is the only way it should
  ever be crossed.
- ⚠️ The proof is a **denial** that happens before a query exists. If the eventual slice cannot
  demonstrate that, it has not shipped slice 7, whatever else it shipped.
