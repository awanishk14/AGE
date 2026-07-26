# ADR-0042 — API Placeholder Prisma Schema Disposition

- Status: Accepted
- Date: 2026-07-26
- Related: ADR-0002, ADR-0029, ADR-0031 (D3), ADR-0032 (D1, D3), ADR-0033, PR #106, PR #109

## Acceptance note

ADR-0042 is accepted as the governing decision for the apps/api placeholder Prisma schema. It
ratifies packages/persistence/src/prisma/schema.prisma as the active schema of record for current
persistence work, rejects apps/api as a default schema owner, and authorizes removal of the
placeholder apps/api Prisma schema if inspection confirms it has no legitimate live dependency. It
does not authorize schema relocation, migration changes, API/Web behavior changes, workspace
implementation, Draft → Active promotion, runtime caller wiring, or new persistence functionality.

## Context

The repository contains **two** Prisma schema files. Only one is a source of truth.

| File                                            | What it is                                                                                                                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/persistence/src/prisma/schema.prisma` | The **schema of record** (ADR-0031 D3, ratified again by ADR-0032 D1). One model, `ScoredBifSnapshot`, plus one committed migration.                                                             |
| `apps/api/prisma/schema.prisma`                 | A **scaffold**, 16 lines, self-described as "Scaffold only. Domain models are intentionally not defined yet.", carrying one `model HealthCheck` marked "remove when real models are introduced". |

ADR-0032 D1 left the second file in place deliberately and said so in as many words: it "never
receives a domain model", and its removal was recorded as a decision that had not been made. This
ADR is that decision. Nothing about it is urgent; what makes it worth settling is that the schema
of record's own conventions are currently written **around** the placeholder's existence.

### What the repository actually shows

Everything below was verified by reading the repository at `main` @ `4b9a5ab`, not inferred.

1. **Nothing imports a Prisma client in `apps/api`.** No `PrismaClient` construction, no
   `@prisma/client` import, anywhere under `apps/api/src`. The single occurrence of the string
   `@prisma/client` in that tree is in `apps/api/src/modules/demo/tests/demo.spec.ts`, where it is
   listed as a **forbidden** import for the demo module. The API references Prisma only to forbid it.
2. **Nothing generates a client from it.** `apps/api` declares
   `"prisma:generate": "prisma generate --schema prisma/schema.prisma"` and
   `"prisma:migrate:scaffold": "prisma migrate dev --schema prisma/schema.prisma"`. Neither is
   invoked by any workflow, any Nx target, any other script, or any documentation as a step to run.
   `apps/api/project.json` declares no Prisma target at all — its targets are `build`, `dev`,
   `typecheck`, `lint`, `test`, `test:e2e`.
3. **CI never touches it.** `.github/workflows/ci-db.yml` runs exactly four Prisma commands, all
   `pnpm --filter @age/persistence …` (`prisma:validate`, `prisma:generate`, `prisma:migrate:deploy`,
   `prisma:migrate:drift`). `ci.yml` runs none. No workflow references `apps/api/prisma`.
4. **The `HealthCheck` model has no table, no migration and no reader.** The only committed migration
   is `packages/persistence/src/prisma/migrations/20260725000000_scored_bif_snapshots/migration.sql`,
   which states in its own header that it creates the snapshot table and "Nothing else. No
   `HealthCheck`". The string `HealthCheck` appears nowhere in executable code outside the
   placeholder file itself; every other occurrence is prose in an ADR or a schema comment describing
   the placeholder.
5. **`apps/api` declares Prisma dependencies it does not use** — `@prisma/client` (dependency) and
   `prisma` (devDependency). They exist to make the two scripts above runnable. With the schema gone,
   both scripts go, and the dependencies have no remaining consumer in that package.
6. **PR #109 already removed the sharp edge, not the ambiguity.** It renamed the API's
   `prisma:migrate` to `prisma:migrate:scaffold` and added `--schema` to both, so an unqualified
   `prisma migrate dev` can no longer resolve to the placeholder by accident. What survives is the
   quieter hazard: a second schema file that a reader, a tool, or a future contributor can mistake
   for the schema of record.

### Why this is worth deciding rather than leaving

The placeholder is inert, so the argument for removal is not that it does damage today. It is that
**two other documents currently justify their rules by pointing at it**:

- `packages/persistence/src/migrations/README.md` explains the mandatory `--schema` convention with
  "because the repository contains a second, placeholder Prisma schema under `apps/api/prisma/`".
- ADR-0031 records "Prisma schema files: **Two**" as the state of the repository.

A rule whose stated reason evaporates is a rule that gets questioned later for the wrong reason. The
`--schema` convention (ADR-0032 D3) must survive this change on its own merits — and it does, because
explicit resolution is correct whether or not a competing file exists.

## Decision

### D1 — The `apps/api` placeholder Prisma schema is removed

`apps/api/prisma/schema.prisma` is deleted, together with the now-unreferenced `apps/api/prisma/`
directory. The findings above establish that nothing imports it, generates from it, migrates it,
tests it, or ships it.

Removal is conditional on that evidence, not on preference: if inspection at implementation time
finds a live dependency the survey missed, the implementation stops and this decision is revisited.

### D2 — `packages/persistence/src/prisma/schema.prisma` remains the single schema of record

Unchanged from ADR-0031 D3 and ADR-0032 D1. This ADR narrows the repository to one schema file; it
does not move, rename, or alter the surviving one. No model is added, removed or edited.

### D3 — `apps/api` does not own persistence schema by default

The API is not a schema owner. Persistence schema lives in the persistence package, behind ports, and
reaches the API — if it ever does — through a package boundary, not by the API declaring tables of
its own. Should `apps/api` ever need a schema, that is a new decision with its own ADR, not a
resumption of a scaffold left lying around.

### D4 — No replacement placeholder, and no new Prisma schema

Nothing is added back: no empty schema, no commented-out schema, no `.example` file, no
`README` standing in for one. A placeholder is precisely what is being removed; recreating a tidier
one would reintroduce the ambiguity under a better name. The repository ends this change with exactly
one Prisma schema file.

### D5 — The unused Prisma scripts and dependencies in `apps/api` go with it

`prisma:generate` and `prisma:migrate:scaffold` in `apps/api/package.json` are deleted: both name a
file that will not exist, so leaving them turns a harmless no-op into a command that fails when run.

The unused `@prisma/client` dependency and `prisma` devDependency are removed from `apps/api` for the
same reason — they exist only to serve those two scripts. This is the one part of the change that
touches `pnpm-lock.yaml`, and it is included rather than deferred because a Prisma toolchain
installed into an application that neither imports nor configures Prisma is the residue that lets a
placeholder come back.

This does **not** touch `packages/persistence`, which legitimately declares both and whose live
database specs import `PrismaClient` directly.

### D6 — The `--schema` convention is preserved, and its justification is rewritten rather than dropped

ADR-0032 D3 stands unamended: every Prisma command in `packages/persistence` continues to pass
`--schema` explicitly. What changes is one paragraph of
`packages/persistence/src/migrations/README.md`, which currently justifies the rule by the existence
of the second schema. The rule is restated on its own footing — explicit resolution does not depend
on a competing file being present — so that removing the placeholder cannot later be read as having
removed the reason for the convention.

### D7 — Nothing else changes

No migration is generated, edited or deleted. No database schema changes. No RLS, grant, role or
policy changes. No CI workflow changes. No API runtime behaviour changes — no controller, module,
provider, route or response is touched. No Web change. No persistence feature change. No port change.
No runtime caller wiring.

## Answers to the questions this ADR was asked

1. **Why does `apps/api` have a placeholder Prisma schema?** It is original scaffolding, from before
   persistence had a decided home. ADR-0002 chose PostgreSQL; the API was generated with the
   conventional `prisma/schema.prisma` and a `HealthCheck` model whose own comment says to remove it
   when real models arrive. Real models arrived — in `packages/persistence` (PR #106), not here.
2. **Is anything using it?** No. No import, no client generation, no migration, no test, no workflow,
   no Nx target, no documented procedure. Its two `package.json` scripts are its only referents, and
   nothing invokes them.
3. **Does removing it affect current persistence?** No. The schema of record, its one migration and
   the live database CI job are all in `packages/persistence` and reference the placeholder nowhere.
4. **Does removing it affect `apps/api` tests?** No. The API's 36 tests never load a schema. The one
   test that mentions Prisma asserts the demo module does **not** reference it — an assertion removal
   makes easier to satisfy, never harder.
5. **Does removing it affect Prisma scripts?** Only the two in `apps/api`, which are deleted with it
   (D5). All six scripts in `packages/persistence` are untouched and keep their explicit `--schema`.
6. **Does removing it affect CI?** No. No workflow references it. `ci-db.yml` is path-gated on
   `packages/persistence/**`, `packages/scored-bif-snapshot-persistence/**` and its own file — an
   `apps/api` deletion does not trigger it, and does not need to.
7. **Should `apps/api` ever own a Prisma schema?** Not by default (D3). If that ever becomes the right
   answer it is a new architectural decision, made deliberately, not inherited from a scaffold.
8. **What remains the schema of record?** `packages/persistence/src/prisma/schema.prisma`, unchanged
   (D2).
9. **Is a replacement placeholder needed?** No (D4).
10. **What is the first implementation slice after acceptance?** One PR: delete
    `apps/api/prisma/schema.prisma`; delete the two `apps/api` Prisma scripts and the two unused
    Prisma dependencies; correct the one paragraph in
    `packages/persistence/src/migrations/README.md`; add a guard test that fails if a second Prisma
    schema or an unqualified Prisma command reappears. Nothing else.

## Consequences

**Good.** One Prisma schema file in the repository, so "the schema of record" is a fact about the
filesystem rather than a convention a reader has to know. The `--schema` rule stops resting on a
justification that was about to disappear. An application that does not use Prisma stops declaring it.

**Costs, stated plainly.**

- `pnpm-lock.yaml` changes. It is the only file outside the deletion's immediate blast radius, and it
  changes because a dependency was genuinely removed.
- The historical record in ADR-0031 ("Prisma schema files: **Two**") becomes a description of a past
  state. That is correct — ADRs are dated decisions, not living documents, and it is not edited.
- If `apps/api` ever does need Prisma, it will be re-added deliberately. That is the intended cost.

**What this does not buy.** No runtime behaviour improves, no test gets faster, no bug is fixed. This
is hygiene, and it should be judged as hygiene.

## Non-goals

Runtime caller wiring · a production `ClientContext` source · a real input source · API or Web
exposure · workspace implementation · `Draft → Active` promotion · schema, migration or RLS changes ·
relocating the schema of record · new persistence functionality.

## Open questions

1. **The `@age/persistence` package's own fate remains undecided** (recorded first in ADR-0031). It is
   architecture-only apart from the snapshot table, and its base repository shape contradicts
   append-only. Untouched here.
2. **Whether the guard test should assert repository-wide "exactly one `schema.prisma`"** or only
   "none under `apps/`". The narrower assertion is less likely to obstruct a legitimate future
   package; the broader one states the actual intent. To be settled by the implementation slice on
   evidence, and reported.
