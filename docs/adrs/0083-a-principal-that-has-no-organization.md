# ADR-0083 — A principal that has no organization

Status: **Proposed** (2026-08-19)

> 🛑 **A `Proposed` ADR AUTHORIZES NOTHING.** It is a decision request. 🚫 It will not be
> self-accepted: the owner answers §4, and a **separate** PR flips this line carrying their words
> verbatim (operating constitution §3.3).

Depends on: ADR-0082 (**Accepted**, Option A — the session row may have no organization; slices A
and B merged at `8dd8c27` and `cd41863`) · ADR-0079 (three scopes; `platformScope()` takes no
arguments) · ADR-0046 **D5** (RLS is coherence, 🚫 not authorization).
Amends: nothing yet. Supersedes: nothing.

---

## 1. The problem, stated as a fact about shipped code

ADR-0082 is merged as far as it goes, and it stops one layer short of a working sign-in.

- The **row** may now have no organization. `operator_sessions.organization_id` is nullable and
  three additive, digest-fenced policies serve it (`20260819100000_…`).
- The **decision** now admits a platform operator with `organizationId: null`
  (`AdmittedOperator`, ADR-0082 D1/D4).
- The **console still refuses them**, deliberately and at one composed edge:
  `apps/studio/src/app/sign-in/callback/route.ts:109` returns `refused=scope-not-served`.

That refusal is honest, and it is where the work stops, because everything between the row and the
screen states that a session **has** an organization — as a `string`, never nullable:

| Module                                                  | Shape                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| `@age/session-store` `SessionRecord`                    | `organizationId: string`                                      |
| `@age/session-store` `normalizeSessionRecord`           | `requiredText('organizationId', …)` — blank is refused        |
| `@age/session-store` `SessionIssuanceRequest`           | `acceptIdentifier('organizationId', …)`                       |
| `@age/session-store-persistence` `OperatorSessionScope` | `{ organizationId: string }`, set as `age.organization_id`    |
| `@age/session-issuance-persistence`                     | refuses when `record.organizationId !== scope.organizationId` |
| **`@age/entitlement` `VerifiedSession`**                | **`organizationId: string`**                                  |
| `apps/studio/src/server/request-scope.ts`               | reads `session.organizationId` **three times**                |

🛑 **THE LAST TWO ROWS ARE WHY THIS IS AN ADR AND 🚫 NOT A SLICE.** `VerifiedSession` is the
**entitlement core's model of a principal** — the value every access decision is taken against.
ADR-0082 §6 authorizes the migration, the policies, `decideSignIn` and `AdmittedOperator`. It does
🚫 **not** mention `VerifiedSession`, and widening the core's principal on the strength of an ADR
that never named it would be exactly the "implementing from a brief and then citing the brief"
failure §3.1 of the constitution forbids.

⚠️ **AND THE CORE ALREADY WROTE DOWN WHY IT IS DANGEROUS.** `packages/entitlement/src/verified-session.ts`
carries a load-bearing refusal in its own words: an empty `organizationId` would compare equal to
an empty subject identifier and the decision **would return `granted` — an authorization produced
by two absences agreeing.** A nullable field is a second way to spell that absence, in the one
module where an absence must never be allowed to agree with anything.

---

## 2. What is NOT in question

- 🚫 **The tenant path does not change.** Whatever is decided, an agency session keeps a `string`
  organization, keeps `age.organization_id`, and keeps byte-identical behaviour.
- 🚫 **Revocation and expiry do not acquire a second implementation.** They are re-checked on
  **every** request (constitution §7); two copies is two chances for one to drift, and the copy
  that drifts still passes its own tests.
- 🛑 **AGE still mints nothing.** Nothing here provisions an account, a membership or a role.
- 🚫 **No rendering is in question.** What a platform operator _sees_ is a later decision.
- 🚫 **A revoked or expired row is still never hidden** (ADR-0082): hiding it would collapse "AGE
  holds a row it decided against" into "AGE holds no such row".

---

## 3. The options

### Option A — make `organizationId` nullable all the way through, including `VerifiedSession`

One shape, one path, one set of tests. `SessionRecord`, `normalizeSessionRecord`,
`SessionIssuanceRequest` and `VerifiedSession` all take `string | null`.

- ✅ No duplication anywhere; every existing guard keeps covering both principals.
- 🛑 **It puts a nullable identifier inside the module that refuses absent identifiers.** Every
  comparison in the entitlement core must now be re-read asking "what if this is `null`", and the
  failure mode is silent: `null === null` is `true` in the one place where two absences agreeing is
  a granted authorization. The existing blank-identifier guard does not cover it at all: it reads
  `session[field].trim() === ''`, so a `null` reaches `.trim()` and the refusal becomes a
  **`TypeError`** — the 5xx that route already treats as the response an attacker works for.
- ⚠️ It makes the dangerous shape reachable **everywhere**, to serve one principal.

### Option B — a platform principal is a **different type**, sharing the same assessment (recommended)

`VerifiedSession` is left **byte-identical**. A platform session verifies into a separate
`VerifiedPlatformSession { sessionId, accountId }` — a type on which the organization field does
🚫 **not exist**, so no comparison against it can be written, correctly or otherwise. The two are a
discriminated union at the one boundary that already exists: `requireRequestScope()` in
`apps/studio/src/server/request-scope.ts`, the sole importer of `@age/access-scope`, which branches
once and calls `platformScope()` — a function that has taken no arguments since ADR-0079 slice 1,
for exactly this reason.

🛑 **THE SHARING IS THE POINT, AND IT IS THE PART THAT MUST BE GUARDED.** Expiry, revocation and
the not-before checks stay in **one** function over the fields both principals have; only the
construction of the identity differs. §2's second bullet is the rule this option must be held to,
and a guard must assert it product-wide — 🚫 not over one file. **A NARROW SCAN IS NOT A NARROW
RULE.**

- ✅ The entitlement core's principal is unchanged, so 🚫 nothing already shipped needs re-reading.
- ✅ The absent organization is **structurally unrepresentable** rather than defended against — the
  same reason NULL, not a reserved literal, was chosen in ADR-0082.
- ⚠️ Two verified types is a real cost: a future field added to one and not the other is a drift,
  and the guard has to be the thing that notices.

### Option C — a wholly separate platform request path

Its own store package, its own verification, its own scope runner, touching nothing shipped.

- ✅ Maximum isolation of the new path.
- 🛑 **REFUSED ON THE SAME GROUND ADR-0082 REFUSED ITS OWN OPTION C:** revocation would acquire a
  second implementation, and revocation is re-checked on every request. This is recorded as an
  option so the refusal is visible, 🚫 not because it is live.

---

## 4. The question for the Product Owner, in plain English

A platform operator (the super-admin) belongs to no organization. The database and the sign-in
decision already accept that. The last layer — the one that answers _"is this person allowed to see
this?"_ — still assumes everyone has an organization.

**Should I (A) let that layer accept "no organization" as a possible value everywhere, or (B) give
a platform operator its own separate kind of session, so "no organization" is not a value that
layer can ever be handed?**

I recommend **B**. A is fewer moving parts but it makes a blank value legal inside the one piece of
code whose comment already explains how a blank value turns into an accidental "yes". B costs a
second type and a guard to keep the two from drifting apart.

⚠️ There is no third answer that ships sooner. Both are a slice of similar size; only A carries the
risk into code that already works.

---

## 5. The Product Owner's decision

_Not yet given. 🚫 This section is filled by a separate PR, verbatim._

---

## 6. What is decided here if this is accepted

**D1.** Which of A or B the platform principal takes — the owner's answer in §4.

**D2.** The tenant path is unchanged and that is asserted by measurement, 🚫 not by reading: the
existing session, entitlement and live-database suites pass untouched.

**D3.** Expiry and revocation have **exactly one** implementation, asserted by a **product-wide**
guard, 🚫 not by a scan of the new files.

**D4.** `requireRequestScope()` remains the **only** importer of `@age/access-scope`, and the
branch between the two principals lives there and nowhere else.

**D5.** A platform session's scope runner sets `age.platform_session_token_hash` and 🚫 **never**
`age.organization_id` — the fence is the digest the caller already holds (ADR-0082).

---

## 🛠️ What this ADR does 🚫 NOT authorize

🚫 Not a rendering, 🚫 not a reach, 🚫 not a deployment, 🚫 not a provisioned super-admin. It
decides the **shape of a principal that has no organization** — and 🚫 nothing else. Whether the
deployed store ever holds a real client's data remains a separate, open, owner-only question.
