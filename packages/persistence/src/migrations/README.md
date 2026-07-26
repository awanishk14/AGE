# migrations (TypeScript surface — NOT the Prisma migrations directory)

**Prisma migrations do not live here.** They live beside the schema of record, where Prisma itself
resolves them:

| What                 | Where                                           |
| -------------------- | ----------------------------------------------- |
| **Schema of record** | `packages/persistence/src/prisma/schema.prisma` |
| **Migrations**       | `packages/persistence/src/prisma/migrations/`   |

This directory previously claimed migrations would be created here ("once real Prisma models are
introduced"). That was wrong for the tool: Prisma resolves the migrations directory relative to the
schema file, so a migration generated for the schema of record lands under `src/prisma/migrations/`
and never here. ADR-0032 D2 settles the location; this file is the correction.

What remains here is a plain TypeScript module surface (`index.ts`) for any future hand-written
migration helper. It carries no SQL and no Prisma state.

## Working with migrations

All Prisma commands in this package pass `--schema` explicitly (ADR-0032 D3). The rule does not
depend on a competing schema existing: Prisma resolves a schema by searching the working directory,
so a command without `--schema` says nothing about which schema it means and is correct only by
accident of where it was run from. Naming the file is what makes the target a fact.

This paragraph previously justified the rule by the presence of a second, placeholder Prisma schema
under `apps/api/prisma/`. That schema was removed (ADR-0042 D1) and the rule is unchanged — it was
never the reason, only the sharpest illustration of it.

```bash
pnpm --filter @age/persistence prisma:validate         # offline, no database
pnpm --filter @age/persistence prisma:migrate:diff     # offline, prints the DDL for an empty database
pnpm --filter @age/persistence prisma:migrate          # requires a local database (migrate dev)
pnpm --filter @age/persistence prisma:migrate:deploy   # applies committed migrations
```

Rules that are not negotiable without an ADR:

- **Migration SQL is committed and reviewed** (ADR-0032 D4). `prisma db push` is **forbidden** for
  this path — it mutates a database and leaves no reviewable artefact.
- **Migrations are never edited, squashed or rewritten after merge.** A mistake is corrected by a new
  migration.
- **Nothing may add `updated_at`, `version`, `deleted_at` or a mutable `current`/`is_current` column
  to `scored_bif_snapshots`, and nothing may grant `UPDATE` or `DELETE` on it** (ADR-0030, ADR-0031,
  ADR-0032 D7). Those absences are the append-only guarantee.

### A note on generating the _next_ migration

The first migration was generated fully offline with `--from-empty`, which needs no database.
Prisma's `migrate diff --from-migrations` — the form that diffs a committed history against the
schema — replays that history into a **shadow database** and therefore does need one available. So
"authoring does not require a database" (ADR-0032 D6) holds strictly for the first migration and for
hand-written deltas; a computed diff against an existing history needs either a local database or
`--shadow-database-url`. This is a limitation of the tool, recorded here rather than discovered
later.

## Live database tests

Specs that require a real PostgreSQL are named `*.db.spec.ts` and are excluded from the default
`test` and `typecheck` targets, so the pure test suite stays database-free (ADR-0032 D13). Run them
with:

```bash
DATABASE_URL=postgresql://age:age@localhost:5432/age_test pnpm --filter @age/persistence test:db
```

They **fail loudly** if `DATABASE_URL` is absent. They never skip: a skipped test reports as a pass,
and a suite that silently proves nothing is the failure mode ADR-0032 exists to prevent.

Point `DATABASE_URL` at a **disposable** database. The harness deletes the rows it owns and expects
the committed migrations to have been applied first (`prisma:migrate:deploy`).
