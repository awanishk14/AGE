# ADR-0068 — The second operator, and the caller `askEntitlement` has never had

Status: **Proposed** (2026-08-10). 🚫 **NOT self-accepted, and 🚫 nothing here authorizes code.**
This is a decision request. It is raised because ADR-0066 §7 Q4 is now **answered** — the first
real human after the developer is **a second operator** (§0.6) — while every fence in front of
slice 7 is still standing, and two of them are fences only the Product Owner may lower.

Depends on: ADR-0066 D7 + §0.5d + §0.6–§0.6c, ADR-0055 A2/D6/D7, ADR-0061 A2/A3, ADR-0062 D1–D3,
ADR-0058 D1/D2, ADR-0053 D4, ADR-0046 D5, ADR-0057 D4.
Supersedes: nothing.

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
