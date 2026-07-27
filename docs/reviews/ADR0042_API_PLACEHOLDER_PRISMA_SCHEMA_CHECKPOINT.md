# ADR-0042 Checkpoint — API Placeholder Prisma Schema Disposition

Records the ADR-0042 track: why a second Prisma schema existed, what removing it settled, the
operational interruption the track ran through, and what it deliberately did not change. Written at
`main` @ `9953269`, after all four PRs merged.

## 1. Where this came from

The repository carried **two** `schema.prisma` files. One was the schema of record,
`packages/persistence/src/prisma/schema.prisma`, which holds `model ScoredBifSnapshot` and the
migrations beside it. The other was `apps/api/prisma/schema.prisma`, a scaffold left over from
project setup containing a single `model HealthCheck` — a model with no table, no migration, and no
reader anywhere in the repository.

A dormant file is not by itself worth a track. What made this one worth removing is that Prisma
resolves a schema by **searching the working directory** when no `--schema` is passed. `apps/api`
declared `"prisma:migrate": "prisma migrate dev"` with no `--schema`, so the unqualified command
resolved to the placeholder rather than the schema of record. ADR-0032 D3 had already responded by
requiring every Prisma command to name its schema, and PR #109 had corrected that specific script.
But the ambiguity itself remained: a second schema in the tree means every future unqualified command
is correct only by accident of where it was run from.

ADR-0031 D3 had named a _single_ Prisma schema of record. The repository contradicted it. This track
closed that gap.

## 2. Merge ledger

| PR   | Branch                                          | Commit    | Merge     | What                                     |
| ---- | ----------------------------------------------- | --------- | --------- | ---------------------------------------- |
| #143 | `docs/adr0042-api-placeholder-prisma-schema`    | `7366159` | `295b4a8` | ADR-0042 `Status: Proposed`              |
| #144 | `docs/accept-adr0042`                           | `b76f8be` | `b6588ab` | `Status: Accepted`, user's verbatim note |
| #145 | `refactor/remove-api-placeholder-prisma-schema` | `fc37da1` | `003aefb` | The removal — 5 files, +171/−30          |
| #146 | `docs/adr0041-json-type-checkpoint`             | `74a8caa` | `9953269` | ADR-0041 checkpoint (separate track)     |

Post-merge `CI` **SUCCESS** on all four. `CI (live database)` **SUCCESS** on #145, the only one
touching a path that workflow is gated on. #143's head `7366159` is an empty commit on top of the ADR
commit `d125dcb`, created to schedule a CI run — see §4.

#146 belongs to the **ADR-0041** track, not this one. It is listed because it merged inside this
window and because it is the reason `main` is at `9953269` rather than `003aefb`. It was branched
from `main` independently and adds one new file, so it carried no rebase risk and could land in any
order after the ADR-0042 sequence finished. Its content is recorded in
`ADR0041_SNAPSHOT_CONTEXT_JSON_TYPE_CHECKPOINT.md`.

## 3. What ADR-0042 decided

Seven decisions, all ratified without amendment:

- **D1** — delete `apps/api/prisma/schema.prisma`.
- **D2** — `packages/persistence/src/prisma/schema.prisma` remains the single schema of record.
- **D3** — `apps/api` is not a schema owner by default. An application that needs one later argues
  for it in an ADR rather than inheriting the right from a scaffold.
- **D4** — no replacement placeholder and no new schema. The point is one schema, not a tidier second.
- **D5** — the two unused `apps/api` Prisma scripts go, **and so do the unused `@prisma/client`
  dependency and `prisma` devDependency**. This is the one part that touches `pnpm-lock.yaml`, and
  the ADR named that up front rather than letting it surface as an unexplained diff.
- **D6** — the ADR-0032 D3 `--schema` convention is **preserved**. Only its justification paragraph
  in `packages/persistence/src/migrations/README.md` is rewritten, because that paragraph had
  justified the rule by the placeholder's existence. The rule never depended on it; the placeholder
  was its sharpest illustration, not its cause. Deleting the illustration must not read as deleting
  the rule.
- **D7** — nothing else. No migration, no database schema, no RLS, no CI, no API runtime, no Web.

Inspection before the removal confirmed the stop conditions were unmet, verified at `4b9a5ab`:
nothing under `apps/` imported a Prisma client (the sole `@prisma/client` mention was `demo.spec.ts`
listing it as a **forbidden** import); no workflow, Nx target or script invoked the two `apps/api`
Prisma scripts; `ci-db.yml` ran only `--filter @age/persistence` commands; and `HealthCheck` had no
table, no migration and no reader.

## 4. The operational interruption

This track ran through two problems that were not code, both worth recording because they shaped the
sequence.

**GitHub Actions hit 100% of its usage limit while PR #143 was open.** Both CI runs for that PR were
**refused before any step started** — they failed in about four seconds with an empty steps array and
the annotation _"The job was not started because recent account payments have failed or your spending
limit needs to be increased."_ This is a distinct failure mode from a failing build, and the
distinction matters: a refused run is not a red check to be investigated, and it is not a green check
either. Blocked jobs consume no minutes, which is why the empty-commit probe `7366159` cost nothing
while still proving the block was live rather than a stale check.

All remote work was paused. Local commits continued on one branch per slice with the full gate suite
run before each, and the green-CI gate was never bypassed — the stack simply waited.

**The repository was then made public**, deliberately, which resolved the block: Actions minutes are
billed only for private repositories. The consequence to carry forward is that **the repository is
now world-readable** — no secrets, credentials, private client documents or sensitive strategy data
may be committed to it.

**The default branch was corrected from `develop` to `main`.** GitHub still reported `develop` as the
default long after `main` had become the working branch; `develop` has been stale since `7245dcc` and
is not used. The correction had to be made from the `awanishk14` owner account: the collaborator
account this work is pushed from has push and merge rights but not admin, so repository settings
endpoints return `404` for it. That is a permission level, not a missing token scope.

Neither change touched the tree. They are recorded here because they explain the gap in the merge
timestamps and because the visibility change carries a standing constraint.

## 5. What the removal shipped

PR #145, 5 files, +171/−30:

- **Deleted** `apps/api/prisma/schema.prisma`; the directory is gone.
- **`apps/api/package.json`** — removed the `prisma:generate` and `prisma:migrate:scaffold` scripts,
  the `@prisma/client` dependency and the `prisma` devDependency.
- **`pnpm-lock.yaml`** — regenerated via `pnpm install --lockfile-only`, six deletions.
- **`packages/persistence/src/migrations/README.md`** — the D6 justification paragraph rewritten.
- **NEW** `packages/persistence/src/tests/prisma-schema-of-record.spec.ts`, 8 tests.

The guard asserts, by walking the repository rather than by inspecting a fixed list: that exactly one
`schema.prisma` exists and it is the schema of record; that none exists under `apps/`; that the
schema of record declares `model ScoredBifSnapshot` and no longer declares `model HealthCheck`; that
every Prisma command resolving a schema names one (ADR-0032 D3); that no script points at the deleted
path; that no package under `apps/` declares a Prisma dependency; and — deliberately — that
`@age/persistence` **still** declares `prisma` and `@prisma/client`, because that package legitimately
uses them and a guard that forbade Prisma everywhere would be wrong rather than strict.

## 6. Two findings

**ADR-0042 open question 2 is settled: the guard asserts repo-wide "exactly one `schema.prisma`",
not merely "none under `apps/`".** The narrower assertion would pass while a second schema appeared
in a _package_ — the same ambiguity relocated one directory up. D4 states the intent as exactly one
schema file, and the broader assertion is what expresses it. A legitimate future schema is not
blocked so much as routed through an ADR, which is the intended cost.

The guard was **proven to bite**: temporarily recreating `apps/api/prisma/schema.prisma` fails exactly
two of its tests. Its first test asserts the walk finds files at all — more than ten `package.json`
files and at least one schema — so a scan that silently matched nothing cannot report compliance. A
guard that passes vacuously is the failure mode these tests exist to prevent.

**`pnpm --filter @age/persistence prisma:validate` fails locally with P1012 "Environment variable not
found: DATABASE_URL". This is environmental, not a regression.** Prisma resolves `env("DATABASE_URL")`
at validation time, so validation needs the variable set even though it touches no database. With any
dummy value the schema of record validates. `ci-db.yml` sets `DATABASE_URL` before invoking it, so CI
is unaffected. Recorded so the next person to hit it does not read it as damage from this track.

## 7. What did not change

No migration was added or altered. No database schema changed. No RLS policy, grant or role changed.
`ci.yml` and `ci-db.yml` were untouched. No API runtime code, no Web code, no workspace, no
`Draft → Active` promotion. The `--schema` convention from ADR-0032 D3 stands exactly as it did.

`pnpm demo` output was byte-identical to the prior baseline — 6 capabilities, 6 approvals, accounting
invariant OK, no side effects, 7 populated and 5 omitted sections — and `@age/api` kept its 36 passing
tests. Removing an unused dependency from an application is the kind of change that looks safe and
occasionally is not; the demo baseline and the API suite are what make "unused" a measurement rather
than an assertion.

## 8. Residual

**There is still no runtime caller.** Nothing under `apps/` invokes the scored BIF snapshot
orchestrator, the capture boundary, or the persistence adapter. That residual predates this track and
is untouched by it — ADR-0042 removed a schema nobody read, which changes nothing about the fact that
the pipeline it belongs to is not yet wired to anything that runs.

Wiring the first caller needs a real `ClientContext` and a real input source. Both are product
decisions, so it needs its own Proposed ADR and is explicitly not authorized here.

Also unchanged and still open: **ADR-0041 open question 1** — the single remaining JSON conversion at
the mapper, unremovable while `ScoredBifContextField.value` is typed `unknown`.
