# ADR 0032: Prisma Migration Convention and Live PostgreSQL Testing

- Status: Accepted
- Date: 2026-07-25

## Acceptance note

ADR-0032 is accepted as the governing decision for Prisma migration convention and live PostgreSQL
testing. It ratifies `packages/persistence/src/prisma/schema.prisma` as the schema of record,
`packages/persistence/src/prisma/migrations/` as the migration location, committed migration SQL as
reviewed source, explicit `--schema` usage for Prisma scripts, prohibition of `prisma db push` for
this path, a separate path-gated CI PostgreSQL job for live database tests, `*.db.spec.ts` live test
naming, a dedicated `test:db` command, and loud failure when `DATABASE_URL` is absent for live DB
test commands. **It does not authorize RLS implementation.**

The existing `Lint, Typecheck, Test, Build` job stays database-free. The `apps/api` `prisma:migrate`
script must no longer be able to silently target the placeholder `apps/api` schema for this path.
Table doubles are not replaced by live database tests; both are kept.

This acceptance authorizes exactly one implementation slice — the one named under "First
implementation slice after acceptance" below — and the implementation constraints in this ADR are
binding on it. RLS policies and `INSERT`/`SELECT`-only grants remain ADR-0031 stage 3b and stay
gated.

## Context

PR #106 delivered ADR-0031 stage 3a: the durable scored BIF snapshot persistence foundation. It
added a `ScoredBifSnapshot` model to the schema of record, a new
`@age/scored-bif-snapshot-persistence` package, a Prisma-shaped adapter behind the port ADR-0029
stage 2 established, and a shared contract suite run against both the in-memory and the durable
adapter.

It also stopped at two limits, deliberately and visibly:

1. **No migration was committed.** The implementing task permitted one only "if the repo's migration
   convention supports it". It does not. What exists is a placeholder:
   `packages/persistence/src/migrations/README.md` says "Database migrations live here once real
   Prisma models are introduced (Task 006+)", and `packages/persistence/src/migrations/index.ts` is
   an empty TypeScript module (`export {}`). That directory is a **TypeScript surface**, not a Prisma
   migrations directory — Prisma resolves migrations relative to the schema file, so a migration
   generated for the schema of record would land in `packages/persistence/src/prisma/migrations`,
   not where the README points. The convention is not merely undocumented; the one place that claims
   to be it is in the wrong location for the tool.
2. **No test has ever talked to PostgreSQL.** CI has no database: `.github/workflows/ci.yml` has no
   `services:` block and sets no `DATABASE_URL`. The durable adapter is therefore exercised against
   an in-package table double that emulates the composite primary key and `orderBy`/`take`. That is
   a real test of the adapter's query _behaviour_, and it is not evidence that the DDL applies, that
   the index is used, or that PostgreSQL's collation orders `captured_at` the way `localeCompare`
   does.

Both facts were reported rather than hidden — in the package README, the commit message and the PR
body. This ADR exists to close them.

### Verified repository state (recorded so the decision is not made from memory)

- **Two Prisma schema files exist.**
  - `packages/persistence/src/prisma/schema.prisma` — named by ADR-0031 Decision 3 as the single
    schema of record for the scored BIF snapshot path. It carries the `ScoredBifSnapshot` model
    added by PR #106, and its own header states that a second active schema source for this path is
    not permitted.
  - `apps/api/prisma/schema.prisma` — a scaffold, self-described as "Scaffold only. Domain models
    are intentionally not defined yet.", containing one placeholder `model HealthCheck`.
- **The only migration command in the repository points at the wrong schema.** `apps/api/package.json`
  defines `"prisma:migrate": "prisma migrate dev"` with no `--schema` flag, so it resolves to
  `apps/api/prisma/schema.prisma`. `packages/persistence/package.json` defines
  `"prisma:validate": "prisma validate --schema src/prisma/schema.prisma"` and **no migrate script
  at all**. Running the repo's existing migration command today would generate migrations for the
  placeholder schema and not for the schema of record. This is a live foot-gun, not a hypothetical.
- **`@prisma/client` is a dependency of `apps/api` only**, alongside `prisma:generate`. The new
  persistence package deliberately depends on neither.
- **A local PostgreSQL is already provisioned for development.** `docker-compose.yml` runs
  `postgres:16-alpine` with a health check, and `.env.example` defines
  `DATABASE_URL=postgresql://age:age@localhost:5432/age?schema=public`. The local story is solved;
  the CI story is not.
- **CI runs `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and the API demo smoke**, each
  via `nx run-many`. There is no database, no `services:` block, and no per-package test split
  between "pure" and "integration".
- **GitHub Actions minutes are a live constraint.** The repository is private, so Actions minutes are
  billed, and usage is reported near the monthly cap. Any decision that adds CI work must be weighed
  against that, not waved through.

### Why this must be decided before the next implementation slice

ADR-0031 left RLS policies and `INSERT`/`SELECT`-only grants to a later slice (3b). Neither is
expressible in the Prisma schema language: both are raw SQL that can only reach a database through a
migration. And neither can be _verified_ by a table double — a policy that is never enforced by a
real PostgreSQL is a policy that has not been tested, only typed. So 3b is blocked on both halves of
this ADR: a migration convention to carry the SQL, and a live database to prove it works. Guessing
either would decide the project's persistence workflow by accident, inside a slice about something
else.

## Decision

### D1 — The single Prisma schema of record is unchanged

`packages/persistence/src/prisma/schema.prisma` remains the single schema of record, exactly as
ADR-0031 Decision 3 ratified. This ADR does not reopen that decision.

`apps/api/prisma/schema.prisma` is a **scaffold, not a second source of truth**. It is left in place
by this ADR — removing or merging it is a separate decision about the API application's persistence
story, and doing it here would widen this slice. What this ADR does settle is that it must never
receive a domain model and must never be the target of a migration.

### D2 — Migrations live beside the schema of record

Migrations are stored in `packages/persistence/src/prisma/migrations/`, the directory Prisma itself
resolves relative to the schema of record. The location is chosen by the tool, not by preference:
placing them anywhere else means passing a non-default path to every Prisma invocation forever, and
one forgotten flag silently produces a second migration history.

`packages/persistence/src/migrations/` — the TypeScript placeholder — is **not** the migrations
directory and never becomes one. Its README is factually misleading today and should be corrected in
the first implementation slice to point at the real location, or the directory removed if it has no
other purpose.

### D3 — Migrations are generated from the schema of record, by an explicit named script

`packages/persistence/package.json` gains migration scripts that always pass
`--schema src/prisma/schema.prisma` explicitly. No migration is ever generated by a command that
relies on Prisma's default schema resolution, because in this repository the default resolves to the
wrong file.

`apps/api`'s `"prisma:migrate": "prisma migrate dev"` is **corrected or removed** in the first
implementation slice. Leaving a command in the repository that generates migrations for the
placeholder schema is a defect, and it is the single most likely way this convention gets violated by
accident.

### D4 — Migration files are committed to the repository

Migration SQL is reviewed source, versioned with the code that depends on it. Schema state is never
derived at deploy time from `prisma db push`, from `migrate dev` run against a shared environment, or
from any command that diffs a live database and applies the result unreviewed.

The consequence is deliberate: **the SQL that will run against production is a file a human reads in
a pull request.** For an append-only table whose guarantees are enforced by absent columns and by
grants, that is the only review surface that exists.

### D5 — The allowed generation commands

Two commands are sanctioned, for two different situations:

- **Offline, no database required** — the authoring path:

  ```
  prisma migrate diff \
    --from-migrations src/prisma/migrations \
    --to-schema-datamodel src/prisma/schema.prisma \
    --script
  ```

  This computes the SQL from the committed migration history and the schema, with no database
  contacted. The output is written by hand into a new timestamped directory under
  `src/prisma/migrations/` following Prisma's own naming (`<timestamp>_<name>/migration.sql`).

- **With a local database available** — the ergonomic path:

  ```
  prisma migrate dev --schema src/prisma/schema.prisma --name <name>
  ```

  This produces the same artefact through Prisma's own workflow and additionally applies it, proving
  it runs.

Both are permitted. The offline path exists so that authoring a migration never _requires_ a running
database (see D6); the `migrate dev` path exists because it is the tool's intended workflow and
catches mistakes the diff path does not.

`prisma db push` is **forbidden** in this repository. It mutates a database without producing a
migration file, which contradicts D4 directly.

### D6 — A live local database is recommended for authoring, not required

Authoring a migration must remain possible offline via D5's `migrate diff` path. Requiring a running
PostgreSQL to write a migration would make the persistence path undevelopable on a machine without
Docker, and PR #106 demonstrated that meaningful persistence work can be done offline.

But "not required" is not "not recommended". A migration authored offline has been _computed_, not
_executed_. The reviewer of such a migration is reading SQL that has never run. D7 and D8 exist
because of that gap.

### D7 — Migration files are reviewed as SQL, in the pull request

Every migration is reviewed as raw SQL, on its own merits, by a human. The review must confirm at
minimum:

- the SQL matches the schema change it claims to accompany;
- no `DROP`, no destructive `ALTER`, and no data-loss operation arrives unannounced — any such
  operation is called out explicitly in the PR body with its justification;
- for the scored BIF snapshot table specifically, that nothing adds `updated_at`, `version`,
  `deleted_at`, or a mutable `current`/`is_current` column, and nothing grants `UPDATE` or `DELETE`.
  ADR-0030 and ADR-0031 make append-only a structural guarantee; a migration is the one artefact that
  can quietly revoke it.

Migrations are never squashed, rewritten or edited after merge. A mistake is corrected by a new
migration.

### D8 — CI validates migrations by applying them to a real, empty database

CI validation is `prisma migrate deploy` against a freshly created, empty PostgreSQL, followed by
`prisma migrate diff --from-migrations … --to-schema-datamodel … --exit-code` to assert the migration
history and the schema of record have not drifted apart.

This is the check that catches the failure mode PR #106 could not: a migration that is syntactically
plausible, review-approved, and does not actually apply. It requires a database, which is D9.

### D9 — CI does provision PostgreSQL, in a separate job, and only after this ADR is accepted

A PostgreSQL service is added to CI. The recommendation is deliberately narrow because Actions
minutes are near the monthly cap:

- It is a **separate job**, not a service attached to the existing `Lint, Typecheck, Test, Build`
  job. Attaching a database to the main job would make every documentation-only PR pay for a
  database it does not use.
- The database job runs **only when the persistence path changes** — gated on paths covering
  `packages/persistence/**`, `packages/scored-bif-snapshot-persistence/**` and the workflow file
  itself.
- The existing job is **unchanged**, keeps no database, and keeps passing for every pure package.

### D10 — How CI provisions it

A GitHub Actions `services:` block running `postgres:16-alpine` — matching `docker-compose.yml`, so
local and CI run the same major version — with a `pg_isready` health check, exposing a
`DATABASE_URL` pointing at a scratch database. Credentials for a throwaway CI database are inline in
the workflow; **no secret is required, and none may be introduced by this path.** A live-database CI
job that needs a repository secret is a different and larger decision.

**This ADR does not write that workflow.** The exact YAML is authored in the implementation slice
(see "First implementation slice"), reviewed there as a workflow change, and is the one place a
CI change is authorized. Nothing in this document should be read as that change having been made.

### D11 — Which tests require live PostgreSQL

Only tests whose subject **is** the database:

- migration application (`migrate deploy` succeeding against an empty database);
- migration/schema drift (`migrate diff --exit-code`);
- that the real DDL produces the intended constraint behaviour — the composite primary key rejecting
  a duplicate `snapshot_id` with `P2002`, the series index existing;
- PostgreSQL's own ordering semantics for `captured_at` as text, which the table double asserts using
  JavaScript comparison and therefore cannot prove;
- later, and only later: grants (`INSERT`/`SELECT` only) and RLS policies. See D16.

### D12 — Which tests may use table doubles

Everything whose subject is **the adapter's behaviour**, not the database's: the shared contract
suite, the adapter's query shape (what it asks for, what it never asks for), row mapping, error
translation, purity guards, and every pure package in the repository.

The table double is not a stopgap to be deleted once a live database exists. It stays. It runs in
milliseconds, needs no service, and asserts things a live database makes _harder_ to assert — such as
"the adapter issued exactly `create`, `findUnique` and `findMany`, and never an `update`". Live tests
are added **alongside** it, not instead of it.

### D13 — How the two are separated

By file-name convention and a distinct test script, not by a runtime `if` inside a shared suite:

- live-database specs are named `*.db.spec.ts`;
- the default `test` script **excludes** them;
- a separate `test:db` script runs **only** them;
- the shared contract suite stays storage-agnostic and is invoked from both a pure spec and a live
  spec, exactly as it is invoked from two adapters today.

A live-database spec that finds no `DATABASE_URL` **fails loudly**; it does not silently pass. Skips
that report as green are how a suite comes to prove nothing. Whether a run _includes_ live specs is
decided by which script CI invokes — a visible choice in a workflow file — not by an environment
variable quietly changing what a green check means.

### D14 — Required environment variables

One: **`DATABASE_URL`**, the existing convention from `.env.example` and both schema files. No new
variable is introduced.

The live test harness must point it at a **dedicated, disposable database**, never a developer's
working database and never anything shared, because the harness truncates or recreates state between
runs. The implementation slice decides the exact mechanism (a distinct database name, a per-run
schema); it must not decide "the developer's normal database is fine".

### D15 — Live database tests do not run by default in CI

They run in the separate, path-gated job of D9 — which means they do not run on documentation PRs,
ADRs, capability work, or anything else that cannot affect the persistence path. On the paths where
they do apply, they are **required**, not advisory.

Rationale is the Actions budget, stated plainly: a database job on every PR is a cost this repository
cannot currently absorb, and paying it for a PR that only edits Markdown buys nothing.

### D16 — RLS is tested only against live PostgreSQL, and remains a later slice

Row-level security is a PostgreSQL feature. There is no honest way to test an RLS policy without
PostgreSQL: a table double asserting "the adapter passed `organizationId`" proves the adapter's
intent, never the database's enforcement. RLS tests must connect as a **non-superuser, non-owner
role** — a superuser bypasses RLS, so a test run as the owner can pass against a policy that protects
nothing. The same applies to grants: proving `UPDATE` is denied requires attempting one as the
restricted role and observing the refusal.

None of that is authorized here. **RLS remains ADR-0031's stage 3b and is explicitly not authorized
by this ADR.** What this ADR does is remove the two blockers standing in front of it.

### D17 — First implementation slice after acceptance

Named in full below under "First implementation slice after acceptance".

## Rationale

**Why commit migrations rather than derive schema state.** The alternative — pushing the schema and
letting the database's shape be whatever Prisma computes — has no review surface. For a table whose
central guarantee is _the absence of columns and the absence of grants_, the reviewable artefact is
the point. A committed migration is the only place a reviewer can see that nothing added
`updated_at`.

**Why beside the schema.** Prisma resolves migrations relative to the schema file. Choosing any other
location means every invocation, forever, must pass a non-default path, and the first one that
forgets creates a silent second history. The tool's convention costs nothing and removes a class of
mistake.

**Why offline authoring stays possible.** PR #106 was written and fully tested with no database
running. Making a migration require Docker would regress that, and `migrate diff --from-migrations`
makes the requirement unnecessary.

**Why a separate, path-gated CI job.** The honest tension is between a budget near its cap and the
fact that a table double cannot prove a migration applies. A separate job resolves it without
compromise on either side: pure PRs pay nothing, persistence PRs get real verification.

**Why live tests fail rather than skip.** PR #106's limits were reported loudly and were still easy to
overlook. A skipped test reports as a pass. The failure mode this ADR most wants to prevent is a
future session concluding "the live suite is green" when the live suite did not run.

**Why the table double survives.** The two suites answer different questions. "Does the adapter ever
issue an `UPDATE`?" is a question about the adapter, and the double answers it faster and more
directly than PostgreSQL can. Deleting it to celebrate a live database would lose coverage.

## Options considered

### Migration convention

- **Option A — migrations in `packages/persistence/src/prisma/migrations/`, committed. RECOMMENDED.**
  Prisma's own convention; reviewable SQL; no flags to forget.
- **Option B — migrations under the new `@age/scored-bif-snapshot-persistence` package.** _Rejected._
  Migrations belong to the schema, and ADR-0031 D3 put the schema in `@age/persistence`. Splitting
  them creates two migration histories for one database — the exact outcome D1 forbids.
- **Option C — no migrations; `prisma db push` from the schema.** _Rejected._ No reviewable artefact,
  no history, and no way for a reviewer to see that a change did not add a mutation column or a
  destructive `ALTER`.
- **Option D — hand-written SQL files under a bespoke runner.** _Rejected._ Discards Prisma's drift
  detection and ordering for no gain; the repository already depends on Prisma.

### Live PostgreSQL testing

- **Option A — separate, path-gated CI job with a `postgres:16-alpine` service; live specs excluded
  from the default `test` script. RECOMMENDED.** Real verification where it matters, zero cost where
  it does not.
- **Option B — attach a database service to the existing `Lint, Typecheck, Test, Build` job.**
  _Rejected._ Every documentation PR would provision PostgreSQL. Against a near-cap Actions budget
  that is pure waste.
- **Option C — no CI database; keep table doubles only.** _Rejected._ It is the status quo, and it
  cannot verify a migration or an RLS policy. Accepting it means RLS can never be honestly tested.
- **Option D — live tests that skip when `DATABASE_URL` is absent.** _Rejected_, and the most
  tempting of the rejected options. A suite that skips silently reports green while proving nothing;
  the whole reason this ADR exists is that PR #106 refused to do exactly this.
- **Option E — an external hosted test database via a repository secret.** _Rejected for now._ Adds
  secret management, a shared mutable resource, and cross-PR interference. A disposable service
  container is simpler and strictly safer.

## Consequences

**Positive.** Migrations become reviewable, ordered, committed source. The wrong-schema foot-gun in
`apps/api` is closed. The scored BIF snapshot DDL gets executed rather than merely computed. ADR-0031
stage 3b (grants and RLS) becomes implementable and, more importantly, _verifiable_. The distinction
between "the adapter behaves" and "the database enforces" becomes visible in the file names.

**Negative, stated honestly.** CI gains a job, and therefore cost — bounded by path gating, but not
zero. Persistence PRs get slower. The repository acquires a second test command (`test:db`) that a
newcomer can forget exists; D13's naming convention and the implementation slice's documentation are
the mitigation. And a live-database suite that fails rather than skips will, occasionally, fail for
environmental reasons — which is the price of it meaning something when it passes.

**Neutral.** The existing table-double suite is unaffected and keeps running everywhere. No pure
package changes. `@age/persistence` is still not generalised and its longer-term fate is still
undecided.

## Non-goals

- **No RLS policy design or implementation.** Stage 3b, unchanged, still gated.
- **No grant authoring** (`INSERT`/`SELECT` only). Same slice as RLS.
- **No decision about the fate of `apps/api/prisma/schema.prisma`** beyond "it never receives a domain
  model and is never a migration target".
- **No decision about the fate of `@age/persistence`.** ADR-0031 left it undecided; it stays undecided.
- **No caller, no wiring, no composition root.** Nothing constructs the durable adapter yet.
- **No BIF `Draft → Active` promotion.** Untouched by anything here.
- **No API or Web exposure of persisted snapshots.**
- **No deployment, release or production migration process.** This ADR covers authoring, review and
  CI validation. How a migration reaches a production database is a separate decision with separate
  risks.
- **No erasure or retention design.** Still owed, still out of scope.
- **No seed data, no fixtures loaded into a shared database.**

## Implementation constraints

Binding on the slice that follows acceptance:

1. **One PR.** If the slice grows beyond migration convention + first migration + live test harness,
   stop and split it.
2. **The workflow change is authorized only for the new, path-gated job.** The existing
   `Lint, Typecheck, Test, Build` job must not gain a database, must not gain a `services:` block,
   and must keep passing with no `DATABASE_URL`. This is the _only_ CI change this ADR sanctions.
3. **No repository secret may be introduced.** If the live job cannot work without one, stop and
   report rather than adding it.
4. **Do not manually rerun CI.** The Actions budget constraint stands.
5. **The first migration must be additive and must contain exactly the `scored_bif_snapshots` table
   and its index** — the DDL that PR #106 recorded but did not commit. No other table, no `HealthCheck`,
   no `DROP`, no grant, no policy.
6. **Live specs must fail, never skip, when `DATABASE_URL` is absent.** No conditional `describe.skip`.
7. **The table-double suite must keep passing unchanged**, and the shared contract suite must remain
   storage-agnostic — invoked from both, importing nothing database-specific.
8. **The demo baseline must stay byte-identical**: 6 capabilities, 6 pending approvals, accounting
   invariant OK, no side effects.
9. **`packages/business-discovery-contracts` must not be modified.** Its purity guard stays as is.
10. **If any of the following is true, stop and report instead of proceeding:** the CI database job
    cannot be made to work without a secret; the live harness would require a shared or non-disposable
    database; the migration cannot be generated offline; or the slice would require changing the
    existing CI job.

## First implementation slice after acceptance

Exactly this, in one PR:

1. Add migration scripts to `packages/persistence/package.json` that pass `--schema` explicitly
   (D3, D5).
2. Correct or remove `apps/api`'s `"prisma:migrate": "prisma migrate dev"` so no command in the
   repository generates migrations for the placeholder schema (D3).
3. Commit the **first migration** — `packages/persistence/src/prisma/migrations/<timestamp>_scored_bif_snapshots/migration.sql`
   — containing the `scored_bif_snapshots` table and its series index, and nothing else (D2, D4).
4. Correct `packages/persistence/src/migrations/README.md`, which currently points at the wrong
   location, or remove the directory if it serves no other purpose (D2).
5. Add the live test harness: `*.db.spec.ts` naming, a `test:db` script, and the shared contract
   suite invoked against a real PostgreSQL-backed adapter (D11, D12, D13).
6. Add the **separate, path-gated CI job** with a `postgres:16-alpine` service, running
   `migrate deploy`, the drift check, and `test:db` (D8, D9, D10, D15).

**Not in that slice:** RLS, grants, any caller, any wiring, any `apps/` change beyond the script
correction in step 2, any change to the existing CI job, any production deployment process.

## Relationship to ADR-0031 and PR #106

**ADR-0031** decided _what_ is persisted and _how it is shaped_: PostgreSQL via Prisma, a new adapter
package, a single schema of record, append-only storage, composite identity, `jsonb` context, derived
latest. It left grants and RLS to stage 3b and deliberately kept the CI-database question separate,
saying so in as many words.

This ADR decides _how schema change reaches a database and how any of it is proved_. It amends
nothing in ADR-0031 — D1 restates ADR-0031 D3 rather than revisiting it — and adds no requirement to
the shape of the table.

**PR #106** is the evidence base. Its two reported limits are this ADR's two questions, and its
recorded offline DDL is the content of the first migration. The order matters: the schema was
committed first, deliberately, with the migration gap named rather than filled by guesswork. This ADR
is that guess being replaced by a decision.

**Chain:** ADR-0029 (staging) → ADR-0030 (identity and lifecycle) → ADR-0031 (durable persistence,
stage 3a implemented in PR #106) → **ADR-0032 (this: migration convention and live testing)** →
stage 3b (grants and RLS), which remains gated and unauthorized.
