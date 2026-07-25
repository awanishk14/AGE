# Scored BIF Persistence (ADR-0029 / ADR-0030) — Stages 1–2 Checkpoint

- Date: 2026-07-25
- Baseline: `main` @ `c6e0c0f` (merge of PR #101)
- Scope: documentation only. No code, test, package, dependency, schema, configuration, workflow or
  CI change accompanies this note.

## 1. What this checkpoint records

ADR-0029 staged persistence of a scored BIF into three slices. Two are delivered; the third is
deliberately not started. ADR-0030 was written mid-track because stage 2 could not be designed
without answers ADR-0029 had left open, and it was ratified before a line of stage 2 was written.

This note records what exists, what each stage proved, the two questions that were delegated to the
implementation slice and how the evidence answered them, and precisely what stage 3 must still
settle. It is the resume point for anyone picking the track up cold.

| Stage | What                                     | State                        |
| ----- | ---------------------------------------- | ---------------------------- |
| 1     | Pure versioned snapshot codec            | **Done** — PR #98            |
| 2     | Storage-neutral port + in-memory adapter | **Done** — PR #101           |
| 3     | Durable adapter, schema, migration       | **Not started — gated (§6)** |

| ADR      | What                                     | State                                  |
| -------- | ---------------------------------------- | -------------------------------------- |
| ADR-0029 | Persistence is staged, not built at once | **Accepted** — PR #97 (proposed: #96)  |
| ADR-0030 | Snapshot identity and lifecycle          | **Accepted** — PR #100 (proposed: #99) |

## 2. Merge ledger

| PR   | What                               | Merge SHA | Post-merge CI |
| ---- | ---------------------------------- | --------- | ------------- |
| #96  | ADR-0029 proposed                  | `b7fa7a6` | SUCCESS       |
| #97  | ADR-0029 accepted                  | `3272c0a` | SUCCESS       |
| #98  | Stage 1 — snapshot codec           | `5c1af84` | SUCCESS       |
| #99  | ADR-0030 proposed                  | `ce08d70` | SUCCESS       |
| #100 | ADR-0030 accepted                  | `865c394` | SUCCESS       |
| #101 | Stage 2 — port + in-memory adapter | `c6e0c0f` | SUCCESS       |

Every slice: one branch from `main`, one PR, merged only after CI green, remote branch deleted,
post-merge `main` run verified. No CI run was manually re-triggered.

## 3. What stage 1 delivered (PR #98)

`packages/business-discovery-contracts/src/scored-bif-snapshot.ts` — a pure codec, no I/O:

- `SCORED_BIF_SNAPSHOT_VERSION = '1.0.0'`, `ScoredBifSnapshot`, `scoredBifSnapshotSchema`
- `toScoredBifSnapshot` / `fromScoredBifSnapshot` / `serializeScoredBifSnapshot`
- 36 tests; package went 190 → 226 passing

**The design call that mattered.** The codec round-trips the `ScoredBifContext` **projection**, not
the live `BusinessIntelligenceFramework`, and offers **no** context → BIF direction. A BIF carries
`Date`s, per-field version `history` and audit actors; restoring one from a snapshot would mean
inventing that history at load time. That is fabrication, which is forbidden outright — so the
direction simply does not exist rather than existing with a caveat.

**The second design call.** `assertJsonSafe` rejects a `Date`, `undefined`, `NaN`/`Infinity`, a class
instance or a cycle at snapshot time instead of letting `JSON.stringify` mangle it. `JSON.stringify`
turns `undefined` into a hole, a `Date` into a string that never returns as a `Date`, and non-finite
numbers into `null` — each one a value quietly changing meaning in storage. The rule the codec
enforces is: **a snapshot that is produced is a snapshot that round-trips.**

`serializeScoredBifSnapshot` emits sorted keys, so the same context is always byte-identical output.
That is what makes "has this scored BIF changed?" a question with an answer.

## 4. What ADR-0030 settled (PR #99 → #100)

Stage 2 was blocked on two ADR-0029 questions. ADR-0030 answered both, and corrected a premise of
ADR-0029 in the process.

**The correction.** ADR-0029 said "there is no client/workspace concept in the pure track yet." True
of the discovery/BIF pipeline, but incomplete about the repository:
`packages/capability-kit/src/context/client-context.ts` defines `ClientContext(clientId,
organizationId)`, documented as authoritative for RLS and data scoping under ADR-0009, and
`AuthorityInput` already treats those ids as authoritative against input ids that are
provenance-only. The platform's answer to "who owns this data" already existed; inventing a
BIF-specific one would have been a second competing tenancy concept.

**Ratified, as written:**

1. Snapshots are **immutable and append-only**. The port has append and reads, **no `update`, no
   `delete`**. Mutable-in-place was rejected: it destroys history — the reason to persist a score at
   all — and it makes "the BIF's score" look like a live property of the BIF, which invites treating
   a high score as a promotion trigger. A "current" pointer is derivable from an append log; a log
   is not recoverable from an overwritten row.
2. Identity is the composite scope (`clientId`, `organizationId`) + subject (`bifId`) + member
   (`snapshotId`), ordered by `capturedAt`. `(clientId, organizationId, bifId)` is the **series**.
3. Scope comes from `ClientContext` and is **authoritative** — never inferred from the payload.
4. `snapshotId` and `capturedAt` are **caller-supplied** (ADR-0026 Decision 2 `producedAt`
   precedent), so the port reads no clock, mints no id and uses no randomness.
5. `scoringVersion` is a queryable **attribute, never part of the key** — keying on it would forbid
   re-scoring twice under one version, which is a normal thing to do.

The user's ratification added one clarification worth keeping visible: **`clientId` belongs in the
key because snapshot persistence is client-scoped platform data**, even though the BIF payload
itself primarily carries `organizationId`.

Content-addressed identity was explicitly left as a **stage-3 option only**: it needs a hash function
the purity guard forbids in these modules, and it would collapse two genuine re-scoring runs into one
record — losing the fact that a re-score happened, which is history.

## 5. What stage 2 delivered (PR #101)

`scored-bif-snapshot-repository.ts` — the port, plus the record shape it stores:

| Operation               | Purpose                                            |
| ----------------------- | -------------------------------------------------- |
| `append(record)`        | add one immutable snapshot                         |
| `findBySnapshotId(key)` | one member by full identity, else `null`           |
| `listSeries(key)`       | the whole series, oldest first                     |
| `findLatest(key)`       | the append-only answer to "the current scored BIF" |

No `update`, no `delete`, no `upsert` — the absence **is** the decision, not a gap to be filled.

Also: `ScoredBifSnapshotScope` / `…SeriesKey` / `…Key` / `…Record` with Zod schemas,
`SCORED_BIF_SNAPSHOT_RECORD_VERSION = '1.0.0'`, `scoredBifSnapshotSeriesKeyOf`,
`normalizeScoredBifSnapshotRecord`.

`in-memory-scored-bif-snapshot-repository.ts` — `InMemoryScoredBifSnapshotRepository`, a `Map` behind
the port. No clock, no randomness, no I/O. Records bucket by full series key, so a snapshot appended
for one client is **structurally** unreachable from another's reads rather than protected by a rule
an adapter is trusted to remember. Re-using a `snapshotId` within a series throws: with append-only
storage, accepting it would either duplicate history or overwrite it.

**26 new tests; package 226 → 252 passing.**

### 5.1 The two choices delegated to this slice

ADR-0029 part 4 and ADR-0030's consequences section both deferred a decision to stage 2, to be made
on evidence. Both were made and are recorded here because they are the kind of thing a later reader
will otherwise assume was arbitrary.

**Where the port lives: beside the contracts, not in `@age/persistence`.** The evidence:

- `@age/persistence` is architecture-only — `src/prisma/schema.prisma` declares **zero models**.
- Its interfaces are BKG/strategy shaped (opportunity, strategy, campaign, …) and it depends on
  `@age/business-knowledge-graph`.
- Its base `PersistenceRepository` is `findById` / `findAll` / **`save`** / **`softDelete`** — a
  mutable, soft-delete-aware shape that directly contradicts ADR-0030's append-only decision.
- It has **no runtime caller**: outside its own package it is named only by specs that list it as a
  **forbidden** import for the demo path.

Hosting an append-only BIF port there would have meant either fighting that base interface or
widening a package the boundary tests currently keep out. The name matched; nothing else did.

**What the port takes for scope: two ids, not a `ClientContext`.** `ClientContext` is a class in
`@age/capability-kit`; importing it into a contracts package that capability-kit's own consumers
depend on would invert the dependency direction for no gain. The port takes the ids structurally, and
a caller holding a `ClientContext` passes `context.clientId` and `context.organizationId` — which
satisfies "scope comes from `ClientContext`" without a second tenancy concept or a package cycle.

### 5.2 One divergence from precedent, recorded deliberately

`capturedAt` is a **string** — a canonical ISO-8601 UTC instant, `YYYY-MM-DDTHH:mm:ss.sssZ`, strictly
validated — where ADR-0026's `producedAt` is a `Date`.

Two reasons. The snapshot payload beneath it is deliberately `Date`-free and JSON-safe, and a record
that is half JSON-safe is a record that changes meaning in storage. And pinning the format makes
lexicographic order agree with chronological order, so `findLatest` needs no parsing and no clock.
Accepting offsets or variable precision would have broken exactly that.

This is a local, reversible shape decision, not an amendment to ADR-0026. It is recorded here so it
is not later mistaken for an oversight.

### 5.3 What the tests hold down

- Identity: every component required; `clientId` required even though the context carries none.
- `capturedAt`: date-only, second-precision, offset and free-text spellings all rejected.
- Ordering: series sorted by `capturedAt` regardless of append order; ties broken by `snapshotId`, so
  "latest" is one specific record every time it is asked.
- Isolation: one client never reads another's series; `bifId` separates series within a scope.
- Immutability: appending twice under one `snapshotId` throws; mutating the caller's record after
  `append` cannot reach the stored copy.
- Non-fabrication: omitted sections stay omitted, `sections + omitted == canonical`, scores pinned
  (root 17 / completeness 12, 7 present, 5 omitted), status never promoted.
- Boundaries: no `new Date(` / `Date.now(` / `Math.random(` / `performance.now(`; no `fetch(`,
  `node:fs`, `process.env`, `localStorage`, `@prisma/client`, `PrismaClient`, `@age/persistence`,
  `@age/business-knowledge-graph` in executable code; no `update` / `delete` / `softDelete` /
  `upsert` declared on the port.

The purity guard inspects **comment-stripped** source for these two modules, because their doc
comments discuss `@age/persistence` and durability at length — deliberately, since that reasoning is
the point of the files.

## 6. Stage 3 is gated — what it must still answer

**Stage 3 requires its own Accepted ADR** (ADR-0029 part 3, reaffirmed by ADR-0030). The hard
boundary "no DB/persistence writes" is still in force and has been amended by nothing on this track.
Stages 1 and 2 write nothing anywhere: the codec returns a string, the adapter holds a `Map`.

Still open, and none of it may be decided by an implementation slice:

- **Storage technology, physical schema, indexing, migration policy** — and whether the durable
  adapter content-addresses.
- **Retention, pruning, archival.** Append-only storage grows without bound; there is no policy.
- **Erasure for data-protection reasons.** Append-only is a _domain_ rule about not rewriting
  history. A legal erasure path is a separate concern and must not arrive disguised as an `update`.
- **Interaction with `Draft → Active` promotion.** Undecided, and a stored score must never become an
  implicit promotion mechanism.
- **Whether `@age/persistence` is extended, bypassed, or left alone**, now that stage 2 has declined
  to host the port there.
- **Whether the demo track ever reads persisted data.** Today it is test-guarded against it, and the
  demo baseline — 6 capabilities, 6 pending approvals, accounting invariant OK, no side effects —
  must stay byte-identical.
- **Threading `ClientContext` into the discovery/BIF pipeline.** That pipeline is currently scoped
  only by the `organizationId` the mapper requires; a real caller supplying both ids does not exist
  yet.

## 7. Also still owed

A checkpoint for the ADR-0027 / ADR-0028 registry-metadata track (`assessesContext`), which closed
both ADR-0026 follow-ups but has no checkpoint note of its own.

## 8. Boundary confirmation

Across PRs #96–#101: no durable write, no DB, no Prisma model, no migration, no queue, no external
API, no AI/LLM call, no URL fetch. No API, Web or demo-runtime change. No capability package touched
and none imports `@age/bif`. No workflow or CI change. BIF status never promoted; no placeholder
sections; no fabricated scores, provenance or conclusions. The demo baseline is byte-identical.
