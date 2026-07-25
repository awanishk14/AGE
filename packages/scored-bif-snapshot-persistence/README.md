# @age/scored-bif-snapshot-persistence

The durable adapter for scored BIF snapshots — ADR-0029 stage 3a, governed by
**ADR-0031 (Accepted)**.

It implements the existing `ScoredBifSnapshotRepository` port from
`@age/business-discovery-contracts` unchanged: `append`, `findBySnapshotId`,
`listSeries`, `findLatest`. Storage moved; the contract did not.

## What is in this slice

- The `ScoredBifSnapshot` model in the **single Prisma schema of record**,
  `packages/persistence/src/prisma/schema.prisma` (ADR-0031 D3). This package
  declares no schema of its own and depends on no second source of truth.
- `PrismaScoredBifSnapshotRepository`, typed against a **structural** delegate
  interface rather than generated Prisma types, so it compiles with no
  `prisma generate` step, no `@prisma/client` dependency and no database.
- A **shared contract suite** run against both the in-memory adapter and this
  one, so substitutability is checked rather than asserted.

## What is NOT in this slice — read before assuming

**No test in this package has ever talked to PostgreSQL.** CI has no database
(no `services:` block, no `DATABASE_URL`) and provisioning one was explicitly
out of scope, so the durable adapter is exercised against a table double that
emulates the composite primary key and `orderBy`/`take`. That proves the
adapter issues correctly scoped, correctly ordered, insert-only queries. It does
**not** prove that the DDL applies, that the index is used, or that PostgreSQL's
collation orders `capturedAt` as `localeCompare` does.

**No migration is committed.** The repository has no migration convention to
follow — `packages/persistence/src/migrations/` holds only a README saying
migrations arrive "once real Prisma models are introduced", and Prisma's own
`migrate dev` needs a live database. Inventing a convention was not this slice's
call. The DDL the model produces is reproducible offline and is recorded in the
PR that introduced it:

```
prisma migrate diff --from-empty --to-schema-datamodel src/prisma/schema.prisma --script
```

Also absent, deliberately: RLS policies, `INSERT`/`SELECT`-only grants, any
caller, any wiring, any `apps/` change.

## Append-only is structural, not a rule

There is no `update`, `delete`, `upsert` or soft delete — not on the port, not
on the adapter, not on the delegate the adapter is handed. The table has no
`updatedAt`, `version` or `deletedAt` column and no `current`/`isCurrent` flag:
a row that cannot express "when it changed" cannot be changed quietly. "The
current scored BIF" is `findLatest`, an `ORDER BY` over an append log.

Widening the delegate interface **is** the mutation, and needs its own ADR.
