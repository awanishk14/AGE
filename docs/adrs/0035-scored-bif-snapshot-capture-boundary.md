# ADR 0035: Scored BIF Snapshot Capture Boundary

- Status: Proposed
- Date: 2026-07-26

> This ADR is a **decision request**. It must not be self-accepted or implemented before ratification.

## Context

ADR-0029 through ADR-0034 built scored BIF snapshot persistence from the contract down to the database
and back up to a `ClientContext`-bound entry point:

| ADR  | What it settled                                                                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0029 | Staged approach: snapshot contract → port + in-memory adapter → durable adapter                                                                   |
| 0030 | Immutable append-only snapshots; identity = `clientId` + `organizationId` + `bifId` + `snapshotId`; `snapshotId` and `capturedAt` caller-supplied |
| 0031 | PostgreSQL via Prisma in a new package; `context` as one `jsonb` column; no update/delete path                                                    |
| 0032 | Migration convention and a live-database CI job                                                                                                   |
| 0033 | RLS on both `client_id` and `organization_id`, `FORCE`d, fail-closed, `SELECT`/`INSERT` grants only                                               |
| 0034 | `ClientContext` is the only authoritative source of scope; a bound facade with no scope parameter                                                 |

**There is still no caller.** Nothing in the repository constructs a scored BIF snapshot record. Every
layer exists and is tested; none of it has ever been invoked by code that is not a test. PR #117 named
this directly:

> The port still exists and still takes raw ids — deliberately, because adapters, tests and doubles
> need it. So _"use the facade"_ is a rule for **application** code, and the first real caller is where
> that rule gets its teeth.

This ADR decides what that first caller is.

### Verified repository state

- `ClientContextBoundScoredBifSnapshotRepository` (`@age/scored-bif-snapshot-persistence`) takes a
  `ClientContext` plus `{snapshotId, capturedAt, context}`. It assembles the composite key itself and
  its input types declare `clientId`/`organizationId` as `?: never`. `append` returns `Promise<void>`.
- It already calls `toScoredBifSnapshot(input.context)` internally, so the versioned envelope is
  applied at the facade, not by callers.
- `ScoredBifContext` (`@age/business-discovery-contracts`) is the sanctioned neutral projection of a
  scored `Draft` BIF (ADR-0026 D1). It carries `bifId`, `bifStatus`, root and section scores, present
  sections, `omittedSections`, `warnings`, `reasons`, and `metadata` — including
  `metadata.scoringVersion`. It carries **no** client or organization id.
- `projectScoredBifContext(scoredBif, { scoringMetadata })` is the only sanctioned way to produce one,
  and it lives in the contracts package because that package may legitimately import `@age/bif`.
- `scoredBifSnapshotRecordSchema` pins `capturedAt` to a canonical ISO-8601 UTC instant.

### A finding that shapes this decision

**Both adapters already validate on append.** `InMemoryScoredBifSnapshotRepository.append` and
`PrismaScoredBifSnapshotRepository.append` each call `normalizeScoredBifSnapshotRecord` before storing,
so `capturedAt` format, `snapshotId` presence and payload JSON-safety are already enforced beneath the
facade. A capture service therefore adds **no validation the port lacks**, and this ADR does not
pretend otherwise.

That leaves an honest question the recommendation has to answer rather than assume: if the facade
already accepts exactly the fields a caller may supply, and the adapters already validate them, what
is a capture service _for_? See D1 and the rejected alternative below.

### A correction to the framing of this decision

The task framing lists `scoringVersion` among the capture inputs, "if not already available from
context". It **is** already available from context: `ScoredBifContext.metadata.scoringVersion`, carried
through verbatim by `projectScoredBifContext` from the scoring layer's metadata, and projected into the
`scoring_version` column by `toScoredBifSnapshotRow`. This is the same correction ADR-0034 recorded.
Accepting it as a separate parameter would create a second, contradictable source for a value the
payload already carries. **`scoringVersion` is not a capture parameter.**

## Decision

### D1 — A package-level `ScoredBifSnapshotCapture` service is the first real caller

Add a small capture service whose single job is to record that a scored BIF context was captured at a
caller-supplied instant, through the `ClientContext`-bound facade.

It is deliberately thin. What it contributes is not mechanism but **a named seam**:

- It names the **event** ("this scored BIF was captured"), where the facade names the **storage**. The
  rule "application code must not construct scoped snapshot keys" needs somewhere for application code
  to go instead, and a type called `…Repository` invites callers to think in rows.
- It returns a **receipt** identifying what was written. The facade's `append` returns `void`, so a
  caller that has just captured a snapshot holds no handle on the identity it created without
  re-deriving it from its own inputs. The receipt is assembled from what was written — not read back,
  and not invented.
- It gives the ADR-0034 residual a boundary that can be enforced: one named entry point that
  application code uses, and a test that it reaches storage only through the facade.

### D2 — Inputs it may accept

`ClientContext`, plus:

- `snapshotId` — caller-supplied (ADR-0030 D4)
- `capturedAt` — caller-supplied, canonical ISO-8601 UTC
- `context` — a `ScoredBifContext`

Nothing else.

### D3 — Inputs it must not accept

`clientId` and `organizationId`, by any name, in any position — enforced by the type signature the same
way ADR-0034 D2 enforced it, not by a runtime check. Also not accepted: `scoringVersion` (see the
correction above), `bifId` as a separate parameter (it is `context.bifId`), any clock, any id
generator, and any BIF `status` input.

### D4 — `snapshotId` and `capturedAt` stay caller-supplied

The capture service mints neither and reads no clock. ADR-0030 D4 made both caller-supplied so the
persistence layer stays deterministic and testable without freezing time; a capture service that
defaulted either would quietly undo that. Whoever decides _when_ a capture happened is upstream of
this, and stays upstream of this.

### D5 — It lives in `@age/scored-bif-snapshot-persistence`

The package already depends on `@age/business-discovery-contracts` (for `ScoredBifContext`) and on
`@age/capability-kit` (for `ClientContext`), which is exactly the pair a capture service needs. No new
package, no new dependency, no new cycle.

Rejected: the contracts package (its purity guard forbids persistence dependencies outright) and a new
package (a package boundary for one small type, before a second consumer exists, is speculation).

### D6 — It accepts `ScoredBifContext`, never a `BusinessIntelligenceFramework`

`ScoredBifContext` is already the sanctioned neutral scored-context boundary (ADR-0026 D1), it is
already JSON-safe, and it already carries `bifId` and `scoringVersion`.

Accepting a live BIF instead would drag `@age/bif` into the persistence package and force it to project
— which is `projectScoredBifContext`'s job, in the one package sanctioned to import `@age/bif`. It
would also mean the persistence package could see a BIF's `status`, `history` and audit actors, none of
which belong anywhere near a write path that must never promote `Draft → Active`. **Projection stays
the caller's step, at the existing sanctioned boundary.**

### D7 — It reuses the existing serialization, and adds none of its own

The facade already applies `toScoredBifSnapshot`. The capture service must not wrap, re-encode or
re-version the payload — a second envelope would mean two shapes claiming to be the snapshot format.

### D8 — It writes through the `ClientContext`-bound facade only

It must not use `ScoredBifSnapshotRepository`, `PrismaScoredBifSnapshotRepository`,
`ScopedScoredBifSnapshotRepository` or the Prisma delegate directly, and must not assemble a composite
key itself. Scope reaches storage only as ADR-0034 D6 describes: `ClientContext` → facade → key →
transaction-local settings → policy re-check.

### D9 — Scope is never read from the payload

Not from `ScoredBifContext`, not from `context.metadata`, not from any field of the snapshot, and not
from a plausible-looking id planted in the payload JSON. `ScoredBifContext` carries no client or
organization id today and must not grow one.

### D10 — It does not read

The first slice captures; it does not query. Reads already exist on the facade and need no second
front door. Whether capture should offer a "latest" convenience read is a question for the first
consumer that actually needs one — not a guess made before any consumer exists.

### D11 — Not authorized

No API exposure. No Web exposure. No demo-runtime change. No workspace implementation. No
`Draft → Active` promotion. No execution. No strategy, proposal or reporting generation. No
erasure/retention. No schema, migration or RLS change. No `@age/persistence` generalisation. No change
to the port or to any existing adapter.

## The twelve questions, answered

1. **First real caller of the `ClientContext`-bound repository?** `ScoredBifSnapshotCapture` (D1).
2. **What inputs may it accept?** `ClientContext`, `snapshotId`, `capturedAt`, `context` (D2).
3. **What is forbidden?** `clientId`, `organizationId`, `scoringVersion`, a separate `bifId`, a clock,
   an id generator (D3).
4. **Who supplies `snapshotId`?** The caller (D4).
5. **Who supplies `capturedAt`?** The caller (D4).
6. **Where does it live?** `@age/scored-bif-snapshot-persistence` (D5).
7. **BIF, `ScoredBifContext`, or both?** `ScoredBifContext` only (D6).
8. **Serialize or reuse?** Reuse; the facade already applies the envelope (D7).
9. **Writes through the facade only?** Yes (D8).
10. **Does it read latest snapshots?** No, not in this slice (D10).
11. **What is out of scope?** D11.
12. **What is the first slice?** The section below.

## Consequences

- **The "use the facade" rule becomes checkable.** There is now one named application entry point, and
  a test can assert it reaches storage through no other path. That is what PR #117 recorded as still
  missing.
- **It is a thin layer, and thin layers earn their keep or get deleted.** Its whole substance is a
  receipt and a name. If a second capture concern never materialises, folding it back into the facade
  is a small, reversible change — which is the point of adding it small.
- **Still no runtime caller.** This slice adds the first _package-level_ caller of the facade; nothing
  under `apps/` invokes it. Wiring capture into a runtime needs a real input source and is a separate
  decision.
- **The receipt is a new public shape.** It carries `bifId`, `snapshotId` and `capturedAt` and
  deliberately not the scope ids — the caller already holds the `ClientContext` those came from, and
  echoing them back would make the scope look like something the write produced rather than something
  the caller was already bound to.

### Alternative considered and rejected: add nothing

The facade already accepts exactly the permitted fields, and the adapters already validate them, so
"the facade _is_ the capture boundary" is a real option and was weighed as one.

It is rejected because the facade is an adapter-layer type in a persistence package: it is the right
place to _enforce_ scope and the wrong place to be the application's vocabulary for a domain event.
Left as-is, "application code must use the facade" stays a sentence in an ADR with nothing to point at.
The cost of being wrong here is one small file.

## Implementation constraints (binding on the slice that follows)

1. No change to `packages/business-discovery-contracts` — its purity guard stays as is.
2. No change to the port, to any existing adapter, or to any migration, policy, grant, role or
   workflow authorized by ADR-0032/ADR-0033.
3. No clock, no randomness, no id generation in the capture service.
4. Every existing test stays green, including the live RLS and live database suites.
5. The demo baseline stays byte-identical.

## First implementation slice after acceptance

One PR, in `@age/scored-bif-snapshot-persistence`:

- a `ScoredBifSnapshotCapture` service taking a `ClientContext`-bound repository, with a single capture
  operation accepting `{snapshotId, capturedAt, context}` and returning a receipt;
- tests proving scope comes only from `ClientContext`, that neither scope id is expressible as an
  input, that a payload cannot influence scope, that `snapshotId` and `capturedAt` are carried not
  generated, that no clock or randomness is read, and that storage is reached only through the facade.

Not in it: any read operation, any runtime caller, any wiring, any `apps/` change, any API/Web/
demo-runtime change, any schema, migration or RLS change, and any change to the port or its adapters.
