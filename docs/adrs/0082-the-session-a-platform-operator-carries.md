# ADR-0082 — The session a platform operator carries

Status: **Accepted** (2026-08-19) — **OPTION A.** Accepted by the Product Owner, whose words are
recorded verbatim in §5 and are the whole of what they decided. ⚠️ They answered **D1**; D2–D4 below
remain the architect’s under the standing autonomy grant, and 🚫 acceptance of this ADR is 🚫 NOT
corroboration of them.

Depends on: ADR-0080 (reaching a platform membership — **Accepted**, Option A, and the read path it
authorized is merged at `e719e50`) · ADR-0079 (three scopes, and the session issuance it authorized)
· ADR-0046 **D5** (RLS is coherence, 🚫 not authorization).

> 🛠️ **THIS ADR IS NOW ACCEPTED, AND §6 IS WHAT IT AUTHORIZES — 🚫 NOTHING BEYOND IT.** It was opened
> as `Proposed` in PR #397 and the status is flipped here, in a **separate** PR carrying the owner’s
> words, as §3.3 of the operating constitution requires. ⚠️ The closing section still stands: what is
> authorized is a session shape, 🚫 not a rendering, 🚫 not a reach, and 🚫 not a deployment.

---

## 1. The problem, stated as a fact about shipped code

ADR-0080's read path is merged. A platform operator's account and membership are now **readable at
sign-in**, fenced by the Google-verified address. What is still refused is everything that comes
after: `decideSignIn` still answers `platform-scope-not-yet-readable`, and 🚫 no session is issued.

The reason is one column.

- `operator_sessions.organization_id` is **`String`, NOT NULL** (`schema.prisma`).
- Three policies compare it for **equality** against `age.organization_id` — `…_issue_in_scope`
  (`FOR INSERT`), `…_revoke_in_scope` (`FOR UPDATE`), and the verification read.
- A platform membership has **no organization**. `platformScope()` in `@age/access-scope` — merged
  in ADR-0079 slice 1 — **takes no arguments**, because a platform operator does not have one.

🛑 **THE AUTHORIZATION LAYER AND THE SESSION TABLE DISAGREE, AND THE TABLE IS THE ONE THAT IS
WRONG.** Everything above the database already models platform scope as organization-less. Only the
session row insists on a value that does not exist.

⚠️ **THIS IS WHY IT IS AN ADR AND 🚫 NOT A PATCH.** The one-line fix — put a reserved string in the
column — is a schema-shaped answer to an identity question, and §3 shows what it costs.

---

## 2. What is NOT in question

- 🛑 **AGE still mints nothing.** ADR-0079 bought an `INSERT` on `operator_sessions` and 🚫 on
  nothing else. 🚫 No option below creates an account, a membership or a role, and 🚫 none asks for
  a `GRANT` beyond what is already held.
- 🚫 **No option changes what a platform operator may SEE once admitted.** That is ADR-0079 §4's
  two renderings. This ADR is only about **what row records that they are signed in**.
- 🚫 **No option touches a tenant session.** Every tenant `operator_sessions` row keeps the exact
  shape and the exact policies it has today, or the option is refused.
- 🚫 **No provisioning path.** Making a named address a super-admin remains a **human act** against
  the deployed store (ADR-0080 §6).

---

## 3. The options

### Option A — the column becomes nullable, and platform sessions get their own named policies

`organization_id` becomes `String?`. A platform session stores **NULL**, and a new, separately named
policy authorizes issuing, verifying and revoking exactly those rows. The three existing policies
are **untouched**, and because NULL is never equal to anything, they continue to match exactly the
tenant rows they match today — 🚫 not one row more.

This is the same shape ADR-0080 chose for the read, one layer down: 🛑 **the platform path is
NAMED, 🚫 never smuggled through a tenant clause.**

⚠️ **Cost, stated plainly:** it is a schema change plus new policy SQL, and a nullable column means
every reader must handle NULL rather than assume a string. That handling is the point — it is where
"this session belongs to no organization" becomes something the code says out loud.

### Option B — a reserved literal id, e.g. `superadmin`

The column stays NOT NULL and platform sessions store a reserved string. One line, ships today, and
🚫 no migration to the shape of anything.

🛑 **AND IT IS THE ONE OPTION THAT FAILS SILENTLY.** NULL never equals anything — that is precisely
why platform rows are structurally invisible today, and what ADR-0080 §1 called a feature.
`'superadmin'` **does** equal things. The moment it is in the column:

- Every existing tenant policy treats the super-admin as **a real tenant that happens to be
  empty**. A query that ought to REFUSE instead SUCCEEDS and returns nothing, and ⚠️ "no data" is
  indistinguishable from "empty tenant" — the failure renders as a working screen.
- If an organization is ever created with that id, or `age.organization_id` is ever set to that
  string by a defect, the super-admin's scope and that tenant's scope become **the same scope**.
- 🚫 The reserved string becomes a value the product must never collide with, enforced nowhere.

⚠️ This is the shape ADR-0080 already refused once, in the "just match NULL too" fix — a widened
guard wearing database clothes.

### Option C — a platform sign-in is not an `operator_sessions` row at all

A separate table for platform sessions. Perfectly isolated, and 🚫 **rejected as invention**: it
duplicates issuance, expiry and revocation, and 🛑 revocation re-checked on every request is a
shipped guarantee that must not acquire a second implementation. Two copies of it are two chances to
disagree, and the copy that gets relaxed still passes its own tests.

### Recommendation

**Option A.** The extra work is one migration. Option B's cost is a failure mode that looks like
success, and 🛑 a refusal is a result — a silently-empty screen is not.

---

## 4. The question for the Product Owner, in plain English

> When a platform operator signs in, what organization does their session belong to? Nothing at all,
> or a placeholder id we agree to reserve?

---

## 5. The Product Owner's decision (2026-08-19)

The owner was asked the question in §4, in plain English, and answered:

> _"platform operator should not have an organisation id as there is no single organization. or if
> any dummy id works we can put as superadmin. i think - build everything up to that point and come
> back to me with the tradeoff in plain English rather than guess."_

The tradeoff in §3 was put to them, and they answered:

> _"no organisation id"_

⚠️ **THE OWNER NAMED THE DUMMY ID AS AN ACCEPTABLE FALLBACK BEFORE HEARING THE COST, AND DECLINED IT
AFTER.** Both statements are recorded because the second is only meaningful next to the first.

### What that settles

**D1 — Option A.** `operator_sessions.organization_id` becomes nullable; a platform session stores
NULL and is reached by its own named policies.

### D2, D3 and D4, decided by the architect under the standing autonomy grant

⚠️ **The owner answered D1 and 🚫 nothing else.** These are recorded separately so they can be
overturned without disturbing the words above.

**D2 — the three existing policies are 🚫 NOT modified.** New policies are added alongside them.
Permissive policies OR, so a tenant read, issue and revoke stay byte-identical, and that is asserted
against live PostgreSQL rather than reasoned about.

**D3 — the new policies are gated on a setting that is 🚫 NOT `age.organization_id`.** Reusing the
tenant setting with an agreed sentinel value is Option B by another route.

**D4 — a NULL `organization_id` is 🚫 NEVER defaulted, coalesced or rendered as a tenant.** A reader
that finds NULL where it expected a tenant **refuses**; 🚫 it does not substitute one. ⚠️ Absence is
never a conclusion, and a session belonging to no organization is a fact, 🚫 not a missing value.

---

## 6. What is decided here if this is accepted

- `organization_id` on `operator_sessions` becomes nullable, in one migration.
- Platform session issuance, verification and revocation each get **one named policy**, added
  alongside the tenant policies and 🚫 replacing none of them.
- `decideSignIn` may stop refusing `platform-scope-not-yet-readable` and admit a platform operator.
- `AdmittedOperator`'s `organizationId` stops being an unconditional `string`.

## 🛠️ What this ADR does 🚫 NOT authorize

- 🚫 **No rendering change.** ADR-0079 §4's two renderings are untouched. A platform operator who
  signs in sees what the console already shows, 🚫 nothing more, and 🚫 nothing about any tenant.
- 🚫 **No widening of what a platform operator may read.** ADR-0080's fence is unchanged; 🚫 this is
  about being signed in, not about reach.
- 🚫 **No provisioning path**, and 🚫 no deployment. Applying any migration to the deployed store is
  a separate, owner-gated act.
- 🚫 **No peer→AGE direction** (ADR-0076 D8), which remains open and the owner's.
