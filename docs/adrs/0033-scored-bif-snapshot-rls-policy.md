# ADR 0033: Scored BIF Snapshot Row-Level Security Policy

- Status: Proposed
- Date: 2026-07-25

> This ADR is a **decision request**. It must not be self-accepted, and it authorizes no
> implementation until its status is flipped to `Accepted` in a separate pull request. No RLS policy,
> role, grant or test described here has been built.

## Context

ADR-0031 stage 3a (PR #106) put a durable scored BIF snapshot adapter behind the existing port, and
ADR-0031 Decisions 5 and 6 named two mechanisms that would enforce its guarantees in the database
itself: row-level security on `organizationId`, and `INSERT`/`SELECT`-only grants. Both were deferred
to a later slice — stage 3b — because at the time the repository had neither a migration convention
nor any way to run a test against PostgreSQL. A policy that cannot be tested is a policy nobody should
trust.

ADR-0032 (accepted, PR #108) and PR #109 removed both obstacles:

- `packages/persistence/src/prisma/migrations/` exists, holds the repository's first migration, and
  has a reviewed-SQL convention (ADR-0032 D2, D4, D7). A policy is DDL; it now has a home.
- `.github/workflows/ci-db.yml` provisions `postgres:16-alpine` with inline throwaway credentials and
  runs 26 live tests against it. A policy can now be executed and observed rather than asserted.

So stage 3b is unblocked in the sense that its prerequisites exist. It is not unblocked in the sense
that it can simply be written, and ADR-0032 D16 says why:

> RLS is tested only against live PostgreSQL, as a **non-superuser, non-owner role**, because a
> superuser bypasses RLS entirely.

**The live CI job as it stands connects as `age`, the role that created the database and owns every
object in it.** PostgreSQL exempts two kinds of role from row-level security: superusers and roles with
`BYPASSRLS`, always; and **the table owner**, unless the table is put into `FORCE ROW LEVEL SECURITY`.
The current connection is the owner. If a policy were added to the migration today and the existing 26
tests were re-run unchanged, every one of them would still pass — and would still pass if the policy
were syntactically present but semantically empty, or restricted the wrong column, or were silently
disabled. **The suite would report green while proving nothing about isolation.** That is the exact
failure mode ADR-0032 D13 exists to prevent, arriving through a different door.

This ADR therefore treats the role model as the substance of the decision rather than a deployment
detail. An RLS policy is only as real as the role it was tested against.

### What already holds, and is not reopened here

- **Identity** (ADR-0030, accepted): a snapshot is keyed by `(clientId, organizationId, bifId,
snapshotId)`; scope comes from `ClientContext` and is never inferred from the payload.
- **Append-only** (ADR-0030, ADR-0031 D6/D8/D9): no `update`, no `delete`, no `upsert` on the port; no
  `updated_at`, `version`, `deleted_at` or `current` column; the composite primary key rejects a reused
  `snapshotId`, and PR #109 proved the database itself does the rejecting.
- **Migration discipline** (ADR-0032, amended): SQL is committed, reviewed, never rewritten after
  merge; `prisma db push` is forbidden; every Prisma invocation passes `--schema`.

### What is unresolved, and why it matters now

Nothing in the running system currently prevents a query with the wrong `organizationId` in its
`WHERE` clause from returning another tenant's snapshots. Scope isolation today is enforced entirely by
the adapter's shape: the port takes the scope as a key, the row mapper reads it from the key rather
than the payload, and PR #109's live tests confirm a wrong `clientId` or wrong `organizationId` returns
nothing. That is real, and it is not defence in depth — it is one layer, in application code, with no
backstop. ADR-0009 designated `ClientContext` as authoritative for RLS-based data scoping; the database
half of that has never been written.

## Decision

### D1 — RLS is enabled on `scored_bif_snapshots`, and on nothing else

This ADR governs exactly one table: `scored_bif_snapshots`, the only table in the schema of record.
`apps/api`'s placeholder `HealthCheck` model is out of scope and is not a migration target
(ADR-0032 D1).

Whether RLS becomes a general convention for future tenant-scoped tables is deliberately left open. One
table with a tested policy is worth more than a convention applied to a table nobody has queried.

### D2 — `organization_id` is the database-enforced tenant boundary; `client_id` stays application identity

The RLS predicate is written on **`organization_id` alone**.

`client_id` remains part of the composite primary key, part of the port's key type, part of every
adapter query, and part of the live test suite. It is not removed, weakened, or made optional. It is
simply not what the database-level tenant boundary is built on.

The reasoning is that these two identifiers are not the same kind of thing. ADR-0030 recorded that
`clientId` is in the key because snapshot persistence is client-scoped platform data, while the BIF
payload primarily carries `organizationId`; ADR-0009 names `ClientContext` authoritative for data
scoping. A tenant boundary should be the smallest predicate that is unambiguously true, checkable in
one place, and impossible to satisfy accidentally. Adding a second scoping variable doubles the surface
on which a session can be misconfigured, and a policy that is subtly wrong is worse than a policy that
is absent, because it looks like protection.

An alternative — putting both ids in the policy — is considered and rejected below, but the ADR records
explicitly that this is the decision most worth arguing with. If the reviewer believes a client
boundary must also be enforced by PostgreSQL, this is the point to say so, and the shape below extends
to it cleanly.

### D3 — Three roles, with distinct privileges

| Role           | Purpose                                                         | Privileges                                                                                                        |
| -------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `age_owner`    | Owns the schema and every object in it. Runs migrations.        | Owner of `scored_bif_snapshots`. Never used by application code or by RLS tests.                                  |
| `age_app`      | The runtime/application identity. All adapter reads and writes. | **`SELECT` and `INSERT` only** on `scored_bif_snapshots`. `NOSUPERUSER`, `NOBYPASSRLS`, owns nothing.             |
| `age_rls_test` | Live RLS tests.                                                 | Identical privileges to `age_app`. Exists so tests cannot silently drift into more privilege than production has. |

`age_rls_test` may reasonably turn out to be unnecessary — if the live tests simply connect as
`age_app`, they are testing production's exact identity, which is stronger. The ADR proposes the
separate role only so that a test can never be "fixed" by widening the role the application actually
uses. **This is a secondary question and the reviewer may collapse the two roles without changing
anything else.**

Migrations run as `age_owner` (D5). Application code never connects as `age_owner`. No role used by
tests or the application has `SUPERUSER` or `BYPASSRLS`.

### D4 — Grants: `SELECT` and `INSERT` only. `UPDATE` and `DELETE` are forbidden

`age_app` is granted exactly `SELECT` and `INSERT` on `scored_bif_snapshots`, and nothing else. No
`UPDATE`. No `DELETE`. No `TRUNCATE`. No `REFERENCES`. Ownership stays with `age_owner`.

This is ADR-0031 D6 stated as DDL. Append-only currently rests on two supports — a port that declares
no mutation method, and a table with no column a mutation would need. This adds the third and the only
one that holds regardless of what code is written: even a caller that bypasses the port entirely and
issues raw SQL as `age_app` cannot modify or remove a stored snapshot.

A migration that grants `UPDATE` or `DELETE` on this table revokes a guarantee ratified across three
ADRs. ADR-0032 D7 already requires a reviewer to check for exactly that.

### D5 — Migrations run as the owner; the application never does

`prisma migrate deploy` connects as `age_owner`. Creating policies, altering tables and managing grants
are owner operations, and the application role is deliberately incapable of them.

This means the live CI job needs **two** connection strings: one for the migration step, one for the
test step. That is the concrete change to `ci-db.yml` this ADR implies, described in D11.

### D6 — RLS applies to both `SELECT` and `INSERT`

Two policies, not one:

- a `SELECT` policy (`USING`) so a row is visible only when its `organization_id` matches the active
  organization scope;
- an `INSERT` policy (`WITH CHECK`) so a row can be written only when its `organization_id` matches the
  active organization scope.

Protecting reads alone would leave a tenant able to write rows attributed to another organization —
rows it could not then see, which makes the corruption silent. Since the only two operations granted
are `SELECT` and `INSERT` (D4), covering both means every permitted operation is covered, and no
`UPDATE`/`DELETE` policy needs to exist because no `UPDATE`/`DELETE` privilege does.

`FORCE ROW LEVEL SECURITY` is enabled on the table. Without it the owner bypasses its own policies,
which would mean the policy behaves differently for the role that runs migrations than for the role
that runs the application — a difference that is invisible until it matters.

### D7 — Scope is supplied by a transaction-local setting, and its absence fails closed

The active organization scope is provided as a transaction-local PostgreSQL setting:

```sql
SET LOCAL age.organization_id = '<organization id>';
```

and the policies read it via `current_setting('age.organization_id', true)`.

**`SET LOCAL`, not `SET`.** A session-level setting outlives the work it was set for, and with a
connection pool the next borrower of that connection would inherit another tenant's scope. Transaction
scope means the setting cannot outlive its transaction, which also means **every adapter operation must
run inside an explicit transaction** — a real constraint on the implementation slice, named here rather
than discovered later.

**Missing setting fails closed.** The second argument to `current_setting` (`true`) makes it return
`NULL` instead of raising when the setting is absent. The policies must be written so that `NULL`
matches nothing:

- no rows are visible to a `SELECT`;
- every `INSERT` is rejected by the `WITH CHECK`.

An unconfigured session must be useless, not permissive. The failure of an unset scope has to look like
a broken query — not like an empty result that reads as "this organization has no snapshots", and
never like a successful read of everything. The live tests must pin all three behaviours (D10).

The exact predicate shape — a direct comparison against `current_setting`, versus a `SECURITY DEFINER`
helper function — is left to the implementation slice, with one requirement: whatever is chosen must be
`NULL`-safe, so that a missing setting can never satisfy the predicate.

### D8 — `client_id` is not in the RLS predicate, and is not in the setting

Following D2: one setting, one predicate, one boundary. `client_id` continues to be enforced by the
composite primary key and by every adapter query, and PR #109's wrong-client test continues to prove
that a wrong `client_id` returns nothing.

The ADR records the residual honestly: **with this decision, a caller that supplies the correct
`organization_id` but the wrong `client_id` is stopped by the application, not by the database.** If a
reviewer considers that unacceptable, D2 and D8 should be amended together to add
`age.client_id` and a second conjunct to both policies. The mechanism is identical; only the number of
settings changes.

### D9 — Append-only and duplicate inserts under RLS

RLS does not alter append-only in any way. It adds a constraint on _which_ rows may be inserted, not on
_how many times_ one may be.

A duplicate composite identity is still rejected by the primary key, still surfaces as Prisma `P2002`,
and the adapter still recognises the database's own answer rather than pre-checking (PR #106, confirmed
live in PR #109). One interaction is worth stating because it is counter-intuitive and must be pinned
by a test: **a unique-violation error is itself an information leak.** Attempting to insert a row whose
key already exists — under a _different_ organization the session cannot see — reveals that the key is
taken. The implementation slice must determine what PostgreSQL actually does here and record it; this
ADR does not guess. The blast radius is small (the key contains the organization id, so a cross-tenant
collision requires already knowing the other tenant's id), but "small" is a finding to be measured, not
assumed.

### D10 — Live RLS tests run as a non-owner, non-superuser role, and nothing else counts as proof

New live specs, in the existing `*.db.spec.ts` convention, connecting as `age_app` (or `age_rls_test`,
per D3) — **never** as `age_owner`. At minimum:

1. A wrong-organization read returns nothing **with the policy doing the work** — the query must carry
   no `organization_id` filter of its own, so that a passing test cannot be explained by the `WHERE`
   clause. This is the single most important test in the suite, and the one the existing wrong-org test
   does not perform, because it filters by key.
2. A wrong-organization insert is **rejected**, not silently accepted-and-invisible.
3. An unset `age.organization_id` yields zero rows and a rejected insert (D7's fail-closed behaviour),
   asserted separately from the wrong-org cases.
4. A correct-scope read and insert both succeed — the policy must not be vacuously restrictive.
5. The connected role is **verified to be non-superuser, non-`BYPASSRLS`, and not the table owner**, by
   querying `pg_roles`/`pg_class` — asserted, not assumed. This is what stops the suite from silently
   becoming meaningless if a future change alters how CI connects.
6. `UPDATE` and `DELETE` are **rejected as privilege errors** for this role.
7. A wrong-client read still returns nothing (the application-level boundary, D8) — retained so the
   distinction between the two boundaries stays visible in the tests.
8. The scope setting does not leak across transactions (D7's `SET LOCAL` guarantee).

The existing 26 owner-connected tests keep running. They test the schema, the adapter and append-only,
all of which are orthogonal to RLS, and re-pointing them at the app role would weaken them (the app
role cannot `TRUNCATE`).

**A test that passes as the owner is not evidence.** If the RLS suite is ever observed to pass while
connected as `age_owner`, it must be treated as a failed suite, not a passing one.

### D11 — The CI database job gains roles, not a secret

`ci-db.yml` is extended to create `age_owner`, `age_app` (and `age_rls_test`, if D3 keeps it) with
inline throwaway credentials, exactly as it creates the current database. The migration steps connect
as the owner; the live-RLS step connects as the app role. **No repository secret is introduced**
(ADR-0032 D9 stands).

Two mechanisms are available: a `postgres` service plus an explicit SQL bootstrap step, or the existing
service with `CREATE ROLE` statements run before the migration. The choice is left to the slice; the
constraint is that **role creation must not live in the committed migration SQL**, because roles are
environment identities, not schema. Grants and policies _are_ schema and _do_ belong in the migration.

Path-gating, `postgres:16-alpine`, the DB-free status of `ci.yml`, and the "do not manually rerun CI"
constraint are all unchanged.

## Rationale

**Why the role model is the decision.** Every other question here has a conventional answer. This one
does not, and it is the one that determines whether the rest is real. PostgreSQL will happily accept a
policy, report it as enabled, and never apply it to the connection your tests use. The failure is
silent, it is green, and it survives review — because reviewing a policy tells you what it says, not
whether it ran. ADR-0032 D16 anticipated this; PR #109 then built a CI job that connects as the owner,
so the trap is currently armed.

**Why `organization_id` alone.** A tenant boundary earns its keep by being obviously correct. One
column, one setting, one predicate can be verified by reading it. The moment a second variable is
added, every session must configure both correctly, and a session that sets one and forgets the other
produces a partially-enforced boundary — which is the worst outcome, because it is indistinguishable
from a working one until a specific pair of ids collides. `client_id` loses nothing by remaining an
application-level key: it is in the primary key, so it cannot be dropped, forgotten, or bypassed by the
adapter.

**Why fail closed, and why that is not paranoia.** The alternative — treating a missing setting as "no
restriction" — turns every unconfigured code path into a full table scan across all tenants. The
alternative that looks safer, returning an empty set, is subtly worse than an error, because empty is a
legitimate answer to "what snapshots does this organization have?" A caller cannot distinguish
"none exist" from "I forgot to set the scope". Hence D7 requires the unset case to be _pinned by test_
in all three respects, so the behaviour is a decision rather than an accident.

**Why `FORCE`.** Without it, the owner silently bypasses. That means the policy would behave one way
under migration/maintenance and another way under application traffic, and anyone debugging as the
owner would see a database that appears to have no isolation at all.

**Why grants and policies belong in the migration, but roles do not.** Grants and policies describe the
table, travel with it, and must be reviewable as SQL alongside the columns they protect (ADR-0032 D4,
D7). Roles describe an environment: CI's throwaway `age_app` and a production `age_app` are different
principals with different credentials, and committing `CREATE ROLE` would either hard-code CI's
identities into the schema or force a production database to adopt them.

**Why this is a separate ADR rather than an ADR-0031 amendment.** ADR-0031 D5/D6 said RLS on
`organizationId` and `INSERT`/`SELECT`-only grants, and this ADR does not contradict either. But
"enable RLS" is one line and the decisions underneath it — three roles, transaction-local scope, fail
closed, `FORCE`, what counts as proof — are not amendments to a persistence decision. They are a
security model. It deserves its own reviewable document.

## Options considered

### The scope boundary

| Option                                          | Verdict                                                                                                                                                                                                                           |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. `organization_id` only** (recommended, D2) | One predicate, one setting, verifiable by reading it. `client_id` keeps its full role in the key and the adapter. Residual: a wrong `client_id` is caught by the application, not the database.                                   |
| **B. `organization_id` + `client_id`**          | Rejected for now, but the strongest alternative. Strictly more enforcement; strictly more ways for a session to be half-configured. Mechanism is identical — one more setting, one more conjunct — so adopting it later is cheap. |
| **C. `client_id` only**                         | Rejected. Inverts ADR-0009 and ADR-0031 D5, both of which name the organization as the scoping boundary, and would leave the BIF payload's own primary scope unenforced.                                                          |
| **D. No RLS; rely on the adapter**              | Rejected. This is the status quo, and it is a single layer of defence in application code. It is exactly what ADR-0031 D5 committed to replacing.                                                                                 |

### How scope reaches the policy

| Option                                                                 | Verdict                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. `SET LOCAL` + `current_setting`, `NULL`-safe** (recommended, D7)  | Standard PostgreSQL multi-tenancy. Transaction-scoped, pool-safe, and the policy cannot be satisfied by forgetting to set it. Cost: every operation must run in a transaction.                                                    |
| **B. Session-level `SET`**                                             | Rejected. Outlives the work; with pooling, leaks scope to the next borrower of the connection.                                                                                                                                    |
| **C. A role per organization**                                         | Rejected. Does not scale, turns tenant onboarding into DDL, and multiplies credentials.                                                                                                                                           |
| **D. Predicates against a session-user-to-organization mapping table** | Rejected for now. Avoids the setting entirely and is attractive at scale, but requires a tenancy table that does not exist and a join in every policy evaluation. Revisit if organizations ever become first-class database rows. |

### What RLS covers

| Option                                          | Verdict                                                                                                                                                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. `SELECT` + `INSERT`** (recommended, D6)    | Covers every operation the app role is granted.                                                                                                                                                         |
| **B. `SELECT` only**                            | Rejected. Permits writing rows attributed to another organization — invisible to the writer, therefore silent.                                                                                          |
| **C. All commands including `UPDATE`/`DELETE`** | Rejected as unnecessary, and mildly harmful: writing policies for privileges that are deliberately not granted implies they might be, and would need deleting the day someone reads them as permission. |

### Who the tests connect as

| Option                                                                                                 | Verdict                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. A non-owner, non-superuser app role, with the role's own attributes asserted** (recommended, D10) | The only option that can fail when the policy is wrong.                                                                                                                                                                                                     |
| **B. The existing owner connection**                                                                   | Rejected outright. Would pass against a policy that does nothing. This is the trap ADR-0032 D16 named.                                                                                                                                                      |
| **C. Owner with `FORCE RLS` relied upon**                                                              | Rejected. `FORCE` does make the owner subject to policies, so this is not absurd — but it leaves the suite one `NO FORCE` away from silently proving nothing, and it never exercises the grant model, since the owner can `UPDATE` and `DELETE` regardless. |

## Security model

The boundary is: **a session that has not declared an organization scope can read nothing and write
nothing; a session that has declared one can read and append only within it.**

Trust is layered deliberately:

1. **Application** — the port takes scope as a key; the row mapper reads scope from the key, never the
   payload (ADR-0031 D5). Prevents honest mistakes.
2. **Schema** — the composite primary key makes identity unforgeable and duplicates impossible; absent
   columns make mutation unexpressible.
3. **Privilege** — `age_app` holds `SELECT` and `INSERT` only. Prevents mutation even via raw SQL.
4. **Policy** — RLS restricts both to the active organization. Prevents cross-tenant access even by
   correctly-privileged raw SQL.

Layers 3 and 4 are what this ADR adds. Their value is precisely that they do not depend on the
application being correct.

Explicitly **not** claimed: this is not protection against an attacker holding `age_owner` credentials,
nor against a superuser, nor against direct filesystem or backup access. RLS is a boundary between
legitimate tenants sharing a database, not a defence against compromise of the database itself.

## Role model

- **`age_owner`** — owns the schema and all objects; runs `prisma migrate deploy`; used by no
  application code and by no RLS test. Subject to its own policies via `FORCE ROW LEVEL SECURITY`.
- **`age_app`** — `NOSUPERUSER`, `NOBYPASSRLS`, owns nothing, `SELECT`/`INSERT` only on
  `scored_bif_snapshots`. The runtime identity, and the identity the RLS tests use.
- **`age_rls_test`** — optional (D3); if kept, identical in privilege to `age_app`.

Roles are created per environment and are never committed in migration SQL (D11).

## Grants model

```
GRANT SELECT, INSERT ON scored_bif_snapshots TO <app role>;
```

No `UPDATE`, no `DELETE`, no `TRUNCATE`, no `REFERENCES`, no ownership transfer. No grant to `PUBLIC`.
Sequence grants are not required — the table has no generated column and every identifier is
caller-supplied (ADR-0030).

## RLS policy model

```
ALTER TABLE scored_bif_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE scored_bif_snapshots FORCE ROW LEVEL SECURITY;
```

- **`SELECT` policy** — `USING`: the row's `organization_id` equals the active organization scope.
- **`INSERT` policy** — `WITH CHECK`: the new row's `organization_id` equals the active organization
  scope.
- Both must be **`NULL`-safe**, so an unset scope satisfies neither.
- No `UPDATE` or `DELETE` policy exists, because no such privilege is granted.

Active scope is `current_setting('age.organization_id', true)`, established per transaction with
`SET LOCAL`.

## CI / live database test model

- `ci-db.yml` creates the owner and app roles with inline throwaway credentials. **No repository
  secret.**
- Migration steps connect as the owner; live RLS specs connect as the app role. Two connection strings.
- New specs follow the `*.db.spec.ts` convention and run under `test:db`. They fail loudly when their
  connection details are absent — never skip (ADR-0032 D13).
- The suite asserts the connected role's own attributes (non-superuser, non-`BYPASSRLS`, non-owner)
  before asserting anything about policies.
- The existing 26 owner-connected live tests remain, unchanged.
- The path-gate, the DB-free `ci.yml`, and the no-manual-rerun constraint are unchanged.

## Consequences

- Cross-tenant access becomes impossible at the database level, not merely unlikely at the application
  level. ADR-0009's scoping intent gains its database half.
- **Every adapter operation must run inside a transaction** that sets the scope. This is the largest
  practical consequence and it changes how the adapter is called — the current adapter issues bare
  queries.
- The composition root gains a responsibility it does not have today: translating a `ClientContext`
  into a transaction-local setting. Getting this wrong fails closed, which is the point, but it will
  fail visibly and often during development.
- CI grows a role-bootstrap step and a second connection string. Modest, and gated to persistence paths.
- Debugging changes character: a query that returns nothing may now mean "wrong scope" rather than "no
  data". D10's fail-closed tests exist partly so this failure mode is documented in executable form.
- A future migration that adds `UPDATE`/`DELETE` grants, drops `FORCE`, or adds a `BYPASSRLS` role
  silently removes protection. ADR-0032 D7's review checklist must be extended to cover it.

## Non-goals

- **No implementation.** No policy, role, grant, migration or test is written by this ADR.
- **No RLS for other tables**, and no general convention. One table, one tested policy.
- **No production role provisioning, deployment or credential management.** ADR-0032 already scoped
  production migration delivery out; this inherits that.
- **No connection pooling or transaction-management framework decision** beyond the requirement that
  scope be transaction-local.
- **No caller, no wiring, no composition root.** Still nothing constructs the durable adapter.
- **No BIF `Draft → Active` promotion. No API or Web exposure. No workspace.**
- **No erasure or retention design.** Still owed. RLS is not a deletion mechanism, and the absence of
  `DELETE` makes that owed decision more pressing, not less.
- **No change to the port, the adapter's API, or the record contract.**
- **No `@age/persistence` generalisation.**

## Implementation constraints

Binding on the slice that follows acceptance:

1. **Roles first, in their own step.** Role creation must not appear in committed migration SQL.
2. **Grants and policies are committed migration SQL**, reviewed under ADR-0032 D4 and D7.
3. **The migration must not add `updated_at`, `version`, `deleted_at` or `current`, and must not grant
   `UPDATE` or `DELETE`.** Unchanged from ADR-0032 D7 and restated because this is the migration most
   likely to be tempted.
4. **No repository secret.** If the role model cannot work without one, stop and report.
5. **RLS tests connect as a non-owner, non-superuser role, and assert that they do.** A suite that
   passes as the owner is a failed suite.
6. **Live specs fail, never skip, when their connection details are absent.**
7. **The existing 26 live tests and the 64 table-double tests must keep passing unchanged.**
8. **The demo baseline stays byte-identical**; `ci.yml` stays database-free; the path-gate stays.
9. **Do not manually rerun CI.**
10. **Stop and report instead of proceeding if:** the app role cannot be created without a secret;
    enforcing the policy requires changing the port or the adapter's public API beyond adding
    transaction handling; `FORCE ROW LEVEL SECURITY` breaks the existing owner-connected tests in a way
    that cannot be resolved without weakening them; the transaction requirement turns out to demand a
    pooling or transaction-management decision this ADR has not made; or the slice would need to touch
    `ci.yml`, `apps/`, or any capability package.

## First implementation slice after acceptance

One PR, containing:

1. A CI bootstrap step creating `age_owner` and the app role with inline throwaway credentials, and a
   second connection string for the test step.
2. One migration adding `ENABLE`/`FORCE ROW LEVEL SECURITY`, the `SELECT` and `INSERT` policies, and
   the `SELECT, INSERT` grant. Nothing else.
3. Transaction-scoped scope handling sufficient for the adapter to operate under the policy — the
   minimum that makes `SET LOCAL` reach the same transaction as the query.
4. New `*.db.spec.ts` RLS specs per D10, connecting as the app role, including the role-attribute
   assertions.
5. A recorded finding on the D9 duplicate-insert question — what PostgreSQL actually does when a key
   collides across an invisible organization.

**Not in it:** any caller, any wiring, any composition root, any API/Web/demo-runtime change, RLS for
any other table, production role provisioning, erasure/retention, `Draft → Active` promotion.

## Relationship to ADR-0030, ADR-0031, ADR-0032, PR #106 and PR #109

- **ADR-0030** supplies the identity this policy is written against and the append-only lifecycle D4
  and D9 protect. Unchanged.
- **ADR-0031** D5 and D6 committed to RLS on `organizationId` and `INSERT`/`SELECT`-only grants and
  deferred them to stage 3b. **This ADR is stage 3b's decision**; it specifies them and does not
  contradict them. D2's decision to omit `client_id` from the predicate is consistent with D5, which
  named the organization as the boundary.
- **ADR-0032** supplies the migration convention that gives a policy a reviewable home, and D16
  supplies the rule this ADR is largely an answer to: RLS is tested only against live PostgreSQL as a
  non-superuser, non-owner role. Its CI constraints (no secret, path-gate, DB-free `ci.yml`, no manual
  reruns) are inherited unchanged.
- **PR #106** built the adapter whose structural guarantees D4 turns into privileges, and reported the
  limit — no test had reached PostgreSQL — that made stage 3b untestable.
- **PR #109** removed that limit and, in doing so, created the specific gap this ADR closes: a live
  database CI job that connects as the table owner, against which any RLS policy would appear to work.
