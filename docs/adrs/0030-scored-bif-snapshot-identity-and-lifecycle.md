# ADR 0030: Scored BIF Snapshot Identity and Lifecycle

- Status: Proposed
- Date: 2026-07-25

## Context

ADR-0029 (Accepted) stages persistence of a scored BIF: **stage 1** a pure snapshot codec, **stage 2** a
storage-neutral repository port plus an in-memory adapter, **stage 3** a durable adapter behind its own
ADR. Stage 1 is merged (PR #98): `ScoredBifSnapshot`, `toScoredBifSnapshot` / `fromScoredBifSnapshot`,
and a deterministic `serializeScoredBifSnapshot`.

ADR-0029 listed five questions as deliberately undecided, and named two of them as blocking **stage 2**:

> **Snapshot vs mutable record.** Is each scoring run an immutable append, or is there one row per BIF
> updated in place? This drives the entire schema and cannot be retrofitted cheaply.
>
> **Identity.** What keys a stored scored BIF — the BIF id, the profile id, a client/workspace id, or a
> composite with the scoring version? There is no client/workspace concept in the pure track yet.

A repository port cannot be designed without answering both: they determine whether the port even has
an `update` operation, and what a `findLatest`-shaped query is keyed by. Guessing here is exactly the
failure ADR-0029 was written to prevent, so this ADR proposes answers before stage 2 is implemented.

### Evidence available now (verified against `main` @ `5c1af84`)

**A client/organization scoping concept does exist** — ADR-0029's "there is no client/workspace concept
in the pure track yet" was accurate about the _discovery/BIF pipeline_, but incomplete about the repo:

- `packages/capability-kit/src/context/client-context.ts` defines
  `ClientContext(clientId, organizationId)`, documented as "the scoping context passed to every
  capability invocation … the clientId and organizationId needed for RLS and data scoping. This is the
  only Client-related concept capabilities need." It cites **ADR-0009**, where capabilities never load
  the Client aggregate.
- `AuthorityInput` already draws the exact distinction this ADR needs: `ClientContext.clientId` /
  `ClientContext.organizationId` are **authoritative**, while the same fields on the input are
  **provenance/scope only**.

So the platform's answer to "who owns this data" is already `ClientContext`, and it is authoritative
rather than derived from a payload. A BIF-specific identity concept would be a second, competing answer.

**What the BIF and the pipeline supply:**

- `mapBusinessDiscoveryToBifDraft` **requires a caller-supplied non-empty `organizationId`** and refuses
  to proceed without one; the produced BIF carries `id`, `organizationId`, and an integer `version`.
- `BusinessDiscoveryProfile` carries an `id` but no organization, client, or version field.
- `ScoredBifContext` carries `bifId`, `bifStatus`, the scores, and `metadata.scoringVersion` — but
  **no** `organizationId` and **no** timestamp. The projection is deliberately `Date`-free.

**What the codec supplies:** a byte-stable serialization, so two snapshots of the same context are
byte-identical and any difference is a real difference. That makes content-addressing feasible, and it
makes "has this changed?" answerable without a clock.

**The clock constraint.** Every module on this track is pure and reads no clock; ADR-0026 Decision 2
already established the pattern for this exact problem — `producedAt` is **caller-supplied** on the
shared output contract, and the capability never calls `new Date()`. Any ordering concept a snapshot
store needs must follow that precedent rather than reintroduce a clock.

## Options considered

### Question 1 — Snapshot vs mutable record

#### Option 1A — Immutable, append-only snapshots (recommended)

Each scoring run appends a new snapshot. Nothing is ever updated in place; the port has `append`
(or `save`) and reads, but **no `update`**.

- **For:** it is what the word _snapshot_ means, and it matches the domain: a scored BIF is the output
  of a specific scoring run at a specific input state. Score **history is the point** — the reason to
  persist a confidence score at all is to see it move. It is also the only option compatible with
  `BIF_CONFIDENCE_SCORING_VERSION` changing: an in-place row silently rewrites history under a new
  algorithm, so a score you recorded is not the score you can later explain. Append-only is
  additionally the safest thing to build first, because it is the one shape a mutable model can still
  be layered on later (a "current" pointer is derivable from an append log; a log is not recoverable
  from an overwritten row).
- **Against:** unbounded growth, and "the current scored BIF" becomes a query rather than a row.
  Retention/pruning becomes a real question — deferred to stage 3, where a store actually exists.

#### Option 1B — One mutable record per BIF, updated in place

- **For:** trivially answers "the current score"; bounded size.
- **Against:** destroys history, which is the main reason to persist. It also interacts badly with the
  undecided `Draft → Active` promotion: a mutable row makes "the BIF's score" look like a live
  property of the BIF, which invites treating a high score as a promotion trigger — precisely what the
  project forbids. Rejected.

#### Option 1C — Mutable current row plus a separate history table

- **For:** fast current-state reads and retains history.
- **Against:** two sources of truth for the same fact, which must be kept consistent, at a stage where
  there is no store and no measured read pattern. This is a stage-3 optimisation being made at stage 2
  on no evidence. Rejected for now; Option 1A does not preclude it.

### Question 2 — Identity

#### Option 2A — Key by `bifId` alone

- **Against:** with append-only, `bifId` is not unique — that is the point. It also carries no scope,
  so nothing prevents one client's snapshot being read in another's context. Insufficient alone.

#### Option 2B — Composite: scope + `bifId` + caller-supplied snapshot identity (recommended)

A stored snapshot is identified by:

- **scope** — `clientId` and `organizationId`, taken from the authoritative `ClientContext`
  (ADR-0009), never inferred from the snapshot payload;
- **subject** — `bifId`, the BIF the snapshot is of;
- **snapshot identity** — a **caller-supplied** `snapshotId` and a **caller-supplied** `capturedAt`,
  following the ADR-0026 Decision 2 `producedAt` precedent. The port reads no clock and mints no id;
  both are inputs, exactly as `constructedAt` and `changedBy` are inputs to the mapper today.

`(clientId, organizationId, bifId)` identifies the **series**; `snapshotId` identifies the **member**;
`capturedAt` orders the series so "latest" is well-defined.

- **For:** reuses the platform's existing, authoritative scoping concept instead of inventing a second
  one; keeps the port pure (no clock, no id generation, no randomness); makes the series/member
  distinction explicit, which is what append-only needs; and keeps `bifId` meaningful without
  overloading it as a primary key.
- **Against:** four values to thread through, and it puts the burden of supplying `snapshotId` /
  `capturedAt` on the caller. That burden is the established pattern on this track, not a new tax.

#### Option 2C — Content-addressed identity (hash of the serialized snapshot)

The deterministic serializer makes this possible: the id _is_ the content hash.

- **For:** elegant; automatic deduplication; identity is verifiable rather than asserted.
- **Against:** hashing needs a hash function (a new dependency or `node:crypto`, which the purity
  guard forbids in these modules), and identical content from two genuinely different scoring runs
  would collapse into one record — losing the fact that it was re-scored, which is history. Also
  answers only _member_ identity, not scope. Not rejected on principle: it is a plausible **stage 3**
  storage-level optimisation, but it should not define the domain identity at stage 2.

#### Option 2D — Include `scoringVersion` in the key

- **Against:** `scoringVersion` is an **attribute** of a snapshot, not part of its identity. Putting it
  in the key implies one snapshot per version per BIF, which forbids re-scoring twice under the same
  version — a normal thing to do. It stays a queryable field. Rejected as a key component.

## Recommended decision (for ratification)

1. **Snapshots are immutable and append-only** (Option 1A). The stage-2 port exposes append and read
   operations and **no `update` and no `delete`**. A snapshot, once recorded, is never rewritten.
   Retention and pruning are deferred to stage 3.
2. **Identity is the composite in Option 2B**: scope (`clientId`, `organizationId`) + subject
   (`bifId`) + member (`snapshotId`), ordered by `capturedAt`.
3. **Scope comes from `ClientContext` and is authoritative** (ADR-0009 precedent). It is never inferred
   from the snapshot payload, and a snapshot is never readable outside the scope it was appended in.
4. **`snapshotId` and `capturedAt` are caller-supplied** (ADR-0026 Decision 2 precedent). The port
   reads no clock, generates no id, and uses no randomness — it stays as pure and deterministic as the
   codec beneath it.
5. **`scoringVersion` is a queryable attribute, never part of the key.** Content-addressing is
   explicitly left available as a possible stage-3 storage optimisation, not adopted now.
6. **Nothing here authorizes a write to a durable store.** ADR-0029's staging holds: stage 2 is the
   port plus an **in-memory** adapter only, and stage 3 still requires its own Accepted ADR.

## Consequences

**Easier.** Stage 2 becomes implementable without guessing: the port's operation set follows from
append-only, and its signatures follow from the identity composite. Score history — the reason to
persist at all — is preserved by construction, and survives a change to
`BIF_CONFIDENCE_SCORING_VERSION` instead of being silently rewritten by it. Reusing `ClientContext`
means no second, competing tenancy concept enters the codebase.

**Harder.** Callers must supply `snapshotId` and `capturedAt` on every append, and "the current scored
BIF" is a query over a series rather than a row read. Append-only storage grows without bound until a
retention policy exists. Threading `ClientContext` into the discovery/BIF pipeline is new: that
pipeline is currently scoped only by the `organizationId` the mapper already requires, so stage 2 must
decide whether the port takes a full `ClientContext` or just the two ids — a mechanical choice, made
in the slice.

**Deliberately not decided here.**

- Retention, pruning, and archival of old snapshots — stage 3, with a real store.
- The physical schema, indexing, and whether the durable adapter content-addresses — stage 3.
- Whether a snapshot may ever be deleted for data-protection reasons. Append-only is a **domain**
  rule about not rewriting history; a legal erasure path is a separate concern and must not be
  smuggled in as an `update`.
- Whether `@age/persistence` hosts the port — ADR-0029 part 4 leaves this to stage 2 on evidence.
- The remaining ADR-0029 open questions: interaction with `Draft → Active` promotion, re-scoring
  history semantics beyond append-only, and whether the demo ever reads persisted data.

**Unchanged.** Every existing guarantee holds. The hard boundary "no DB/persistence writes" stays in
force. The pipeline stays pure and deterministic; no module reads a clock; `@age/bif` is consumed,
never modified; capability packages never import `@age/bif`; omitted sections stay omitted and are
never placeholder-filled; scores, provenance and conclusions are never fabricated; **a stored score is
never a promotion trigger** — persisting a confidence score says nothing about whether a BIF may move
from `Draft` to `Active`, which remains undecided and out of scope.
