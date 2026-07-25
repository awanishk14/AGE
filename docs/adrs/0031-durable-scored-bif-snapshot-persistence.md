# ADR 0031: Durable Scored BIF Snapshot Persistence

- Status: Accepted
- Date: 2026-07-25

## Acceptance note

ADR-0031 is accepted as the governing decision for durable scored BIF snapshot persistence. It
ratifies PostgreSQL via Prisma, a new durable adapter package rather than generalising
`@age/persistence`, a single Prisma schema of record, immutable append-only storage,
`ClientContext`-derived authoritative scope, composite identity using `clientId`, `organizationId`,
`bifId` and `snapshotId`, caller-supplied `snapshotId` and `capturedAt`, `scoringVersion` as an
attribute, `jsonb` snapshot context storage, and derived latest/current reads. It does not authorize
`Draft → Active` promotion, API/Web exposure, workspace implementation, mutable updates, deletes, or
erasure/retention implementation.

`@age/persistence` is **not** generalised by this decision. Its current shape assumes mutable,
soft-delete persistence (`save`/`softDelete` over a `PersistedBase` carrying `updatedAt`, `version`
and `deletedAt`), which conflicts with the append-only scored BIF snapshots ADR-0030 ratified. The
package is left as it stands; its longer-term fate remains undecided.

The Prisma schema named in D3 is the **single source of truth** for this path. Two active schema
sources for scored BIF snapshot persistence are not permitted.

This acceptance unblocks **ADR-0029 stage 3**, beginning with slice 3a as scoped below. It authorizes
no implementation beyond that slice, and the implementation constraints in this ADR are binding on
it.

## Context

ADR-0029 staged scored BIF persistence into three slices. Stage 1 (PR #98) delivered a pure,
versioned snapshot codec. Stage 2 (PR #101) delivered a storage-neutral repository port and an
in-memory adapter, under the identity and lifecycle rules ADR-0030 ratified. Stage 3 — a durable
adapter, a schema and a migration — was deliberately left gated behind its own Accepted ADR, because
it is the slice that crosses the project's standing "no DB/persistence writes" boundary.

Everything upstream of that boundary is now settled and merged. The port already exists and already
encodes the hard decisions:

```ts
interface ScoredBifSnapshotRepository {
  append(record: ScoredBifSnapshotRecord): Promise<void>;
  findBySnapshotId(key: ScoredBifSnapshotKey): Promise<ScoredBifSnapshotRecord | null>;
  listSeries(key: ScoredBifSnapshotSeriesKey): Promise<ReadonlyArray<ScoredBifSnapshotRecord>>;
  findLatest(key: ScoredBifSnapshotSeriesKey): Promise<ScoredBifSnapshotRecord | null>;
}
```

No `update`, no `delete`, no `upsert`. `ScoredBifSnapshotRecord` is `{ clientId, organizationId,
bifId, snapshotId, capturedAt, snapshot }`, where `capturedAt` is a validated canonical ISO-8601 UTC
string and `snapshot` is the JSON-safe `{ snapshotVersion, context }` codec output.

So this ADR is not asked to redesign the model. It is asked to decide **where a durable
implementation of that port lives, what its table looks like, and what it is forbidden from doing.**

### What the repository actually has today (verified, not assumed)

This matters because the instruction "align with the established persistence stack" only holds if one
exists. It half-exists, and the halves disagree:

| Fact                                              | State                                                                                                                                                                                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Database technology decided**                   | Yes — **PostgreSQL**, ADR-0002 (Accepted), "PostgreSQL as the system of record".                                                                                                                                                                       |
| **ORM/toolkit chosen**                            | Yes — **Prisma 5.20**, a devDependency of both `@age/persistence` and `apps/api`; `@prisma/client` is a dependency of `apps/api`.                                                                                                                      |
| **A running database in local dev**               | Yes — `docker-compose.yml` runs `postgres:16-alpine` (plus Redis, unused here).                                                                                                                                                                        |
| **`DATABASE_URL` convention**                     | Yes — `.env.example`, both schemas.                                                                                                                                                                                                                    |
| **Prisma schema files**                           | **Two**: `packages/persistence/src/prisma/schema.prisma` (datasource + generator, **zero models**) and `apps/api/prisma/schema.prisma` (datasource + generator + one placeholder `HealthCheck` model marked "remove when real models are introduced"). |
| **Migrations**                                    | **None anywhere.** `packages/persistence/src/migrations/` holds only a README saying migrations arrive "once real Prisma models are introduced".                                                                                                       |
| **A `PrismaClient` instantiated in runtime code** | **No.** The only occurrence of `@prisma/client` under `apps/api/src` is a spec listing it as a **forbidden** import for the demo path.                                                                                                                 |
| **`@age/persistence` runtime callers**            | **None.** Outside its own package it is named only by specs that list it as a forbidden import.                                                                                                                                                        |
| **A database in CI**                              | **No.** `.github/workflows/ci.yml` declares no `services:` block and no `DATABASE_URL`.                                                                                                                                                                |

The honest summary: **the technology is established; the persistence runtime is not.** There is a
decided database, a chosen ORM, a dev container and a URL convention — and no models, no migrations,
no client, no connection, no caller, and no CI database. Stage 3 is therefore not "wiring up existing
persistence"; it is the slice that stands up the persistence runtime for the first time, and it
should be sized and reviewed as such.

The two competing schema files are the sharpest consequence. Whichever this ADR does not choose will
otherwise become a second, silently divergent source of truth.

### What `@age/persistence` is, and why it cannot host this unchanged

`@age/persistence` describes itself as "architecture only: … No SQL, no Prisma models, no
migrations". Its base contract is:

```ts
interface PersistenceRepository<TEntity, TId> {
  findById(id): Promise<(TEntity & PersistedBase) | null>;
  findAll(): Promise<ReadonlyArray<TEntity & PersistedBase>>;
  save(entity): Promise<void>;
  softDelete(id): Promise<void>;
}
```

`save` + `softDelete` is a **mutable, soft-delete-aware** shape. `PersistedBase` carries `updatedAt`,
`updatedBy`, `deletedAt` and an optimistic-locking `version`. Every one of those fields is a
statement that a row can change after it is written, which is exactly what ADR-0030 forbids for
snapshots. Its repositories and mappers are BKG/strategy-shaped (opportunity, campaign, research,
decision) and it depends on `@age/business-knowledge-graph`. Nothing in it is wrong; it is simply
modelling a different lifecycle. That is why stage 2 put the snapshot port beside the contracts
instead, and it is the same tension stage 3 must resolve rather than paper over.

## Decision

Proposed, for ratification.

### D1 — The durable storage boundary is PostgreSQL, reached through Prisma

Scored BIF snapshots are owned by a **single PostgreSQL table** in the AGE system of record, accessed
through Prisma. No new database technology is introduced: ADR-0002 already decided PostgreSQL, and
introducing an object store, an event log or a document database for this one aggregate would be a
second system of record adopted as a side effect of a small slice.

The snapshot table is **owned by the snapshot boundary alone**. No foreign keys to `clients`,
organizations, or any BKG table — consistent with ADR-0009, where dependent tables hold `clientId` as
their own scoping key rather than being wired into the Client aggregate.

### D2 — The durable adapter lives in a new package, `@age/scored-bif-snapshot-persistence`

Not in `@age/persistence`, and not in `packages/business-discovery-contracts`.

- **Not in `@age/persistence`** — its base contract is mutable and soft-delete-aware (above), its
  `PersistedBase` mandates fields a snapshot must not have, it is BKG-shaped, and it carries a
  `@age/business-knowledge-graph` dependency that a scored-BIF snapshot has no business acquiring.
  Adding an append-only aggregate there means either contradicting the package's own base interface
  or generalising that interface — a much larger change to a shared package, made under the pressure
  of a small slice.
- **Not in `business-discovery-contracts`** — that package is pure by construction, and its purity is
  enforced by a test that forbids `@prisma/client`, `@age/persistence`, `node:fs`, `fetch(` and
  `process.env` in its source. Putting a Prisma client there would require deleting the guard that
  exists to prevent exactly this.

A new package keeps the port pure and the adapter impure, with the dependency arrow pointing from
infrastructure to contracts and never back. It depends on `@age/business-discovery-contracts` (for
the port, the record type and `normalizeScoredBifSnapshotRecord`) and on `@prisma/client`. Nothing
depends on it except a future composition root.

**Consequence to accept deliberately:** the repository will have two persistence-shaped packages,
one architectural and unused, one real and narrow. That is honest — they model different lifecycles
— but it should be recorded rather than discovered later. Whether `@age/persistence` is eventually
retired, generalised or left as documentation is explicitly **not** decided here.

### D3 — The Prisma schema of record for this table is `packages/persistence/src/prisma/schema.prisma`

One schema file must win, and this ADR proposes the package one, because `apps/api/prisma/schema.prisma`
is app-scoped and still carries a placeholder model marked for removal, while the package schema was
created as the persistence schema and has a `prisma:validate` script already wired.

If ratification prefers the app schema instead, that is a legitimate call — but the ADR asks for an
explicit answer, because the failure mode of not answering is two schemas that drift.

The new package does not get a third schema. It generates against, or imports the client generated
from, the single schema of record.

### D4 — Persisted identity is the ADR-0030 composite key, unchanged

Primary key: **`(clientId, organizationId, bifId, snapshotId)`**.

- `(clientId, organizationId, bifId)` is the **series**; `snapshotId` is the member.
- `clientId` is in the key because snapshot persistence is client-scoped platform data, even though
  the BIF payload primarily carries `organizationId` (ADR-0030, as ratified).
- Ordering within a series is by **`capturedAt`**, with `snapshotId` as the tie-break, exactly as the
  in-memory adapter already does — so two snapshots sharing a millisecond still yield one
  deterministic "latest".
- No surrogate auto-increment id is introduced as the identity. A surrogate column may exist for
  physical reasons if review prefers it, but the composite key remains the logical identity and must
  carry a uniqueness constraint regardless.

### D5 — Scope comes from `ClientContext`, enforced by the caller and by the database

`ClientContext(clientId, organizationId)` is authoritative for scoping (ADR-0009, ADR-0030). The port
already takes the two ids structurally rather than importing the class, and the durable adapter keeps
that shape — the adapter must not import `@age/capability-kit`.

Scope is **never inferred from the snapshot payload**, and the adapter must never read `clientId` or
`organizationId` out of `record.snapshot`. Two mechanisms, not one:

1. Every read takes the scope as part of its key. There is no "find by `snapshotId`" that omits
   `clientId` and `organizationId`, so a cross-tenant read is not expressible in the port.
2. **Row-Level Security** on the table against `organizationId`, consistent with ADR-0009's statement
   that RLS is enforced at the persistence layer against `organizationId`. Whether a matching
   `clientId` RLS predicate is added is left to the implementation slice, which should follow
   whatever the first RLS-bearing table in the repo establishes — there is none today.

### D6 — Append-only is enforced in the schema, not only in the adapter

The port has no mutation methods, but a port is a TypeScript-level guarantee and a database outlives
it. Proposed enforcement, in descending order of authority:

1. **No `update`/`delete` method exists** on the port or the adapter (unchanged from stage 2).
2. **A unique constraint on the composite key**, so a re-used `snapshotId` fails at the database, not
   only at the adapter's in-memory check.
3. **Database-level revocation** — the application role holds `INSERT` and `SELECT` on the table and
   **not** `UPDATE` or `DELETE`. This is the decision that actually holds once someone attaches a SQL
   console, and it is the one worth paying for.
4. **No `updatedAt`, no `version`, no `deletedAt` column.** Their absence is the schema stating the
   lifecycle. A row with an `updatedAt` invites an update.

An `INSERT` that violates the unique constraint is surfaced as a domain-meaningful error, not as a
raw driver error, and is never silently absorbed into an upsert.

### D7 — What is persisted, and what is not

**Persisted:**

| Column            | Source                                      | Notes                                                                                     |
| ----------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `clientId`        | `ClientContext`                             | key                                                                                       |
| `organizationId`  | `ClientContext`                             | key, RLS predicate                                                                        |
| `bifId`           | caller (subject of the snapshot)            | key                                                                                       |
| `snapshotId`      | **caller-supplied**                         | key                                                                                       |
| `capturedAt`      | **caller-supplied**, canonical ISO-8601 UTC | ordering                                                                                  |
| `snapshotVersion` | `record.snapshot.snapshotVersion`           | attribute; lifted to a column so a future major can be filtered without parsing every row |
| `scoringVersion`  | the scored context                          | **attribute, never a key** (ADR-0030)                                                     |
| `context`         | `record.snapshot.context`                   | the JSON-safe projection, stored whole                                                    |

`context` is stored as a **single JSON column** (`jsonb`), not shredded into section and field
tables. It is written by a codec that already guarantees byte-stable serialisation and JSON safety;
shredding it would duplicate the projection's structure in DDL, and every future field addition would
become a migration. Sections omitted from the projection stay omitted in storage — they are never
materialised as null rows, which is precisely what a shredded schema would tempt someone to do.

**Not persisted:**

- **No live `BusinessIntelligenceFramework`.** Stage 1 deliberately snapshots the `ScoredBifContext`
  projection and offers no reverse direction, because restoring a BIF would mean inventing its
  per-field `history` and audit actors. Storing a BIF here would re-open that door.
- **No `updatedAt`, `updatedBy`, `version`, `deletedAt`** — see D6.
- **No BIF `status`.** A snapshot must never become the thing that promotes a BIF from `Draft` to
  `Active`. If `status` is present inside the projection it travels as part of the context payload
  and is never lifted to a queryable column, so it cannot become a filter and then a trigger.
- **No recomputed or defaulted scores.** Scores are stored exactly as the snapshot carries them; the
  adapter never scores, re-scores, rounds or backfills.
- **No server-generated time.** No `DEFAULT now()`, no `@default(now())`, on any column.
- **No secrets, credentials, or raw discovery answers** beyond what the projection already contains.

### D8 — Writes are append-only; `update` and `delete` are forbidden

`append` is the only write. Yes to Q8, yes to Q9. There is no upsert, no merge, no
"append-or-replace", and no soft delete — a `deletedAt` column would be a mutable field wearing a
different name.

**Erasure is out of scope and must stay visible as an open problem.** A data-protection erasure
requirement is real and will eventually arrive; when it does it must be designed as its own decision
(hard delete by scope, crypto-shredding, or scoped purge), and it must **never** arrive disguised as
an `update` or as a general-purpose `delete` on this port. This ADR deliberately does not solve it,
and deliberately refuses to leave a door open that would be used for it by accident.

### D9 — "Latest" is derived by query, not by a mutable pointer

`findLatest(seriesKey)` is `ORDER BY capturedAt DESC, snapshotId DESC LIMIT 1` within the scope. No
`isCurrent` boolean, no `current_snapshot_id` pointer table, no "latest" flag.

A mutable current-pointer would reintroduce an updatable row into an append-only design and create a
second source of truth that can disagree with the data. If read performance ever justifies a pointer
or a materialised view, that is a later optimisation with its own decision — and the query must
remain correct without it.

### D10 — `capturedAt` and `snapshotId` are caller-supplied; content hashes are deferred again

Both stay caller-supplied, as ADR-0030 ratified and as the ADR-0026 D2 `producedAt` precedent
established. The adapter reads no clock and generates no id, so the same inputs always produce the
same stored rows and tests need no time control.

`capturedAt` is stored in a form that preserves the guarantee it was chosen for — lexicographic order
equals chronological order. Whether the column is `text` in canonical ISO-8601 UTC or
`timestamptz` is an implementation choice for the slice, subject to one constraint: **the round trip
must return the exact same canonical string the caller supplied**, since the record's schema
validates that format and normalization re-runs on read. If `timestamptz` cannot guarantee that
byte-for-byte, the column is `text`.

**Content-addressed identity is deferred again** — not adopted in stage 3. It needs a hash function
the purity guard forbids in the contracts package, and it would collapse two genuine re-scoring runs
that happen to produce identical output into one row, destroying exactly the history this design
exists to keep. It remains available later as an _attribute_ (a stored digest for integrity
checking), never as the key.

### D11 — The read model is the port's four operations, unchanged

No new read shapes, no projections, no aggregate queries, no reporting views in this stage. Rows are
read back through `normalizeScoredBifSnapshotRecord`, so **stored data is treated as untrusted
input** on the way out: it is validated, JSON-safety-asserted, and a future major `snapshotVersion`
is refused rather than coerced. A row that fails validation is an error, never a silently repaired
record.

Indexes required (Q15):

- **Unique** on `(clientId, organizationId, bifId, snapshotId)` — identity, and the append-only guard.
- **Index** on `(clientId, organizationId, bifId, capturedAt DESC, snapshotId DESC)` — serves both
  `listSeries` and `findLatest`, which are the only ordered reads that exist.

No index on `context`, on scores, or on `scoringVersion`. Indexing a score is the first step toward
querying by it, and querying by it is the first step toward ranking BIFs by score — which is
derivation, and out of scope.

## Options considered

### Option 1 — Do nothing; keep the in-memory adapter (rejected)

**For:** zero risk; the boundary stays clean.
**Against:** stage 2 was explicitly a step toward durability, and the in-memory adapter's own doc
header says it exists so a durable adapter has "a reference to match". Declining indefinitely makes
the whole persistence track ornamental. Rejected — but note that _not yet_ remains a legitimate
ratification answer, and is materially different from _never_.

### Option 2 — Implement inside `@age/persistence` (rejected)

**For:** the package is named for this; one persistence package instead of two.
**Against:** its base contract is `save`/`softDelete` over a `PersistedBase` carrying `updatedAt`,
`version` and `deletedAt`. Conforming means contradicting ADR-0030; not conforming means the package
now contains an aggregate that ignores its own base interface. It also drags a
`@age/business-knowledge-graph` dependency into a scored-BIF concern. The name matches; the shape
does not.

### Option 3 — Durable adapter in a new infrastructure package (**recommended**)

**For:** the port stays pure and its purity guard stays intact; the impure code is quarantined in one
small package with one dependency direction; the append-only shape is not forced through a mutable
base interface; blast radius is one new package plus one table.
**Against:** two persistence-shaped packages coexist, which needs explaining to any newcomer (D2
records it deliberately); a new package is new build/lint/test surface.

### Option 4 — Event log / append-only object store (rejected for now)

**For:** append-only is native; no risk of an `UPDATE` existing at all.
**Against:** introduces a second system of record against ADR-0002, for one aggregate, with no
operational precedent in this repo. The proposed Postgres table already achieves append-only via a
revoked `UPDATE` grant. Revisit only if a broader event-sourcing decision is taken for its own
reasons.

### Option 5 — Shred `context` into normalised section/field tables (rejected)

**For:** queryable sections; classic relational modelling.
**Against:** duplicates the projection's structure in DDL, makes every projection change a migration,
and creates real pressure to materialise omitted sections as null rows — the exact non-fabrication
rule ADR-0025/0026 exist to protect. The projection is already a stable, versioned, byte-stable
document; store it as one.

## Rationale

The decision reduces to three judgements.

**Shape beats name.** `@age/persistence` is the package whose name matches and whose contract
contradicts. Choosing it would have been the fastest-looking option and would have embedded a
mutable, soft-deletable base under an aggregate that ADR-0030 says is immutable.

**Enforcement belongs where it survives.** A port without `update` protects the code that goes
through the port. A revoked `UPDATE` grant and an absent `updatedAt` column protect the data from
everything else — including a future maintainer with a psql prompt and a good reason.

**Absence is the design.** No `deletedAt`, no `isCurrent`, no score index, no BIF `status` column, no
`DEFAULT now()`. Each omission is a decision that a specific future shortcut should be impossible
rather than merely discouraged. This is the same reasoning that made "no `update` on the port" the
substance of stage 2 rather than a gap in it.

## Consequences

**Easier.** Scored BIF snapshots survive the process for the first time. History is retained by
construction, so re-scoring is observable rather than destructive. The stage-2 in-memory adapter
becomes a genuine test double for a real thing, and any future caller can be written against one port
with two interchangeable implementations.

**Harder.** The repository acquires its first real table, first migration, first `PrismaClient` and
first database-dependent test — and **CI has no database today**, so the slice must either keep its
tests contract-level (running the same suite against both adapters) or add a Postgres service to CI,
which is a workflow change and therefore its own decision. Two persistence-shaped packages will need
explaining. The hard boundary "no DB/persistence writes" is amended for this aggregate only, and
every future slice will cite it as precedent — which is why the non-goals below are stated as sharply
as the decisions.

**Unchanged.** No capability imports `@age/bif`. `run` never consults context. Readiness is never a
gate. Scores are never recomputed. Omitted sections stay omitted. BIF status is never promoted. The
demo baseline stays byte-identical: nothing in this track is wired into the demo path.

## Non-goals

Explicitly **not** decided or delivered by this ADR:

1. **BIF `Draft → Active` promotion.** Untouched. Persisting a scored snapshot grants no promotion
   path and creates no promotion trigger.
2. **API or Web exposure.** No endpoint, no route, no DTO, no demo integration. Nothing reads this
   table from `apps/`.
3. **A real client workspace or input source.** Snapshots continue to arrive from callers in tests.
4. **Erasure, retention, pruning and archival.** Named as required future work (D8), deliberately
   unsolved, and explicitly forbidden from arriving as an `update`.
5. **The fate of `@age/persistence`.** Not retired, not generalised, not extended here.
6. **Content-addressed identity.** Deferred again (D10).
7. **A mutable "current snapshot" pointer.** Rejected for the first implementation (D9).
8. **Multi-region, replication, backup and DR policy.** Operational concerns, out of scope.
9. **Whether CI gains a database.** Flagged as a consequence; decided by the implementing slice or
   its own ADR, since it is a workflow change.

## Implementation constraints

Binding on any slice that implements this ADR, if accepted:

- **One slice per PR**, branched from `main`, with the standard gates.
- The adapter **reads no clock, generates no id, and uses no randomness**. `capturedAt` and
  `snapshotId` arrive from the caller.
- The adapter **never imports `@age/capability-kit`** (no `ClientContext` import) and **never imports
  `@age/bif`**.
- `packages/business-discovery-contracts` **is not modified** — its purity guard stays exactly as it
  is, and no Prisma import ever enters it.
- **No `apps/` changes.** The demo baseline stays byte-identical: 6 capabilities, 6 pending
  approvals, accounting invariant OK, no side effects.
- The migration is **additive** — one new table, no alteration of any existing table.
- The application role is granted `INSERT` and `SELECT` only.
- Tests must include a **shared contract suite executed against both the in-memory and the durable
  adapter**, so the two cannot drift. If the durable half cannot run in CI, it must be skipped
  visibly and reported — never silently.
- Any deviation from this ADR discovered during implementation stops the slice and amends the ADR; it
  is not absorbed into the PR.

## First implementation slice after acceptance

Deliberately narrow, and deliberately not the whole of D1–D11:

**Slice 3a — the table and the adapter, behind the existing port.**

1. Add the `ScoredBifSnapshot` model to the single Prisma schema of record (D3) and generate the
   first migration. Additive; one table.
2. Create `packages/scored-bif-snapshot-persistence` with one class implementing
   `ScoredBifSnapshotRepository` against Prisma — `append` plus the three reads, nothing else.
3. Extract the stage-2 behavioural expectations into a **shared contract suite** and run it against
   both adapters.
4. Verify the append-only enforcement explicitly: duplicate key rejected, no `UPDATE`/`DELETE` grant,
   no `updatedAt`/`version`/`deletedAt` column, `findLatest` correct across a `capturedAt` tie.

Explicitly **not** in slice 3a: RLS policy authoring (slice 3b, once the repo's first RLS convention
exists), CI database provisioning (its own decision), any caller, any wiring, any `apps/` change.

## Relationship to ADR-0029 and ADR-0030

- **ADR-0029** staged the work and gated stage 3 behind an Accepted ADR. This ADR is that gate,
  proposed. If accepted, it amends ADR-0029's hard boundary "no DB/persistence writes" **for scored
  BIF snapshots only** — every other package remains subject to it, and nothing here authorises
  persistence for BIFs, capabilities, plans or any other aggregate.
- **ADR-0030** decided identity and lifecycle: immutable append-only, scope from `ClientContext`,
  composite key `(clientId, organizationId, bifId, snapshotId)`, caller-supplied `snapshotId` and
  `capturedAt`, `scoringVersion` as an attribute, content-addressing deferred. **This ADR changes
  none of that.** D4, D5, D6, D8 and D10 are ADR-0030's decisions expressed in DDL; where this ADR
  adds anything it is enforcement (a revoked grant, a unique constraint, an absent column), not a new
  rule.
- ADR-0030 left content-addressing and durable storage as stage-3 questions. This ADR answers durable
  storage and defers content-addressing once more, with the reason restated rather than assumed.

If ratification disagrees with any of D1–D11 — particularly D2 (new package) or D3 (which schema is
the source of truth) — the correct outcome is a revised ADR, not an implementation that quietly picks
differently.
