# ADR 0036: Scored BIF Snapshot Capture Orchestration

- Status: Accepted
- Date: 2026-07-26

## Acceptance note

ADR-0036 is accepted as the governing decision for scored BIF snapshot capture orchestration. It
ratifies a package-level orchestrator as the first caller of `ScoredBifSnapshotCapture`, requires
`ClientContext` to be supplied per call as the only source of `clientId` and `organizationId`,
requires caller-supplied `snapshotId` and `capturedAt`, keeps production of the `ScoredBifContext`
upstream and pure, makes capture explicitly invoked rather than automatic, and requires capture
failure to be returned as an explicit outcome rather than thrown.

It does **not** authorize the produce-side chain, any error classification, API/Web exposure,
workspace implementation, `Draft → Active` promotion, execution, or strategy generation.

Accepted because it ratifies the architecture ADR-0009, ADR-0026, ADR-0030, ADR-0034 and ADR-0035
already established, and introduces no conflicting decision: scope stays authoritative from
`ClientContext`, identity stays caller-supplied, the pure layer stays free of persistence, and the
persistence package still never sees a `BusinessIntelligenceFramework`.

## Context

ADR-0029 through ADR-0035 built scored BIF snapshot persistence end to end: contract, port, in-memory
adapter, durable Prisma adapter, migration convention, live-database CI, row-level security,
`ClientContext`-bound access, and a package-level capture service.

`ScoredBifSnapshotCapture` (ADR-0035, merged in PR #120) takes a
`ClientContextBoundScoredBifSnapshotRepository` and one input `{snapshotId, capturedAt, context}`, and
returns a receipt. **Nothing calls it.** PR #120 recorded that plainly:

> There is still no runtime caller. This is the first _package-level_ caller of the facade; nothing
> under `apps/` invokes it. Wiring capture into a runtime needs a real input source and is a separate
> decision.

This ADR decides how capture is invoked, and by what.

### Verified repository state

- `projectScoredBifContext(scoredBif, options)` — `packages/business-discovery-contracts` — has **no
  production caller anywhere in the repository**. Every call site is a test. The same is true of
  `scoreBusinessIntelligenceFramework` and `mapBusinessDiscoveryToBifDraft`.
- **Nine separate test files each re-derive the same three-step chain locally**
  (mapper → scorer → projector), in `business-discovery-contracts`, `persistence`,
  `scored-bif-snapshot-persistence`, and the intelligence / market-discovery / revenue capabilities.
  No production module chains any two of those steps.
- Nothing under `apps/` imports `@age/business-discovery-contracts` or
  `@age/scored-bif-snapshot-persistence`. There is no application entry point to wire into.
- `@age/business-discovery-contracts` depends on `@age/bif` and `zod` only. It does **not** depend on
  `@age/capability-kit`, and no file in it imports `ClientContext`. Its purity guard forbids
  `@prisma/client`, `PrismaClient`, `@age/persistence`, `@age/business-knowledge-graph`, `fetch(`,
  `node:fs`, `node:path`, `process.env` and `localStorage`.
- `@age/scored-bif-snapshot-persistence` depends on `@age/business-discovery-contracts` and
  `@age/capability-kit`. That is the only package that can see both `ScoredBifContext` and
  `ClientContext`.
- Both adapters' `append` **throw** on a duplicate `snapshotId` — the in-memory one directly, the
  Prisma one by translating `P2002`. Both throw a plain `Error`; there is no error taxonomy.

### The fork this decision has to be honest about

There are two different things "the first caller" could mean, and they are not the same slice:

1. **The consume side** — something that holds a `ClientContext` and an already-produced
   `ScoredBifContext`, and captures it.
2. **The produce side** — something that chains mapper → scorer → projector to _make_ a
   `ScoredBifContext` in the first place, which nine test fixtures currently each do by hand.

This ADR decides **(1) only**. (2) is a real and separately evidenced gap — nine duplications is
evidence, not speculation — but it is a different decision with a different blast radius: the produce
chain operates on a live `BusinessIntelligenceFramework`, and ADR-0035 D6 deliberately kept
`@age/bif` out of the persistence package. Chaining production and capture in one type would either
violate that or require a new package. **Neither is decided here.** It is recorded as the next
candidate decision so it does not get absorbed silently into an implementation slice.

### The risk this decision has to answer

A capture orchestrator that only forwards to `ScoredBifSnapshotCapture` would be a second thin layer
on top of a first thin layer. ADR-0035 already warned that "thin layers earn their keep or get
deleted". So the recommendation below has to say what this one does that nothing else does, or not
exist. See D1.

## Decision

### D1 — A package-level `ScoredBifSnapshotCaptureOrchestrator` is the first caller

It does two things neither the capture service nor the facade can do, both of which are consequences
of the facade being **bound to one `ClientContext` for its lifetime**:

- **It binds scope per call.** The facade and the capture service are per-`ClientContext` objects; the
  port is not. Something must hold the long-lived port and construct
  `new ScoredBifSnapshotCapture(new ClientContextBoundScoredBifSnapshotRepository(ctx, port))` for the
  `ClientContext` in hand. Today that "something" would be every call site, each holding the raw port.
  Centralising it makes "the raw port is only ever handed to the facade constructor" a property one
  test can assert, instead of a rule every future call site has to remember.
- **It reports capture failure explicitly.** Both adapters throw. An orchestrator that lets that
  propagate makes a snapshot-persistence failure indistinguishable from a programming error at the
  caller. It returns an outcome instead (D8).

If it ever stops doing both of those, it should be deleted rather than kept for symmetry.

### D2 — Where `ClientContext` comes from

From the caller, per call — never constructed by the orchestrator, never read from configuration, and
never derived from a payload. It stays authoritative for `clientId` and `organizationId` (ADR-0009,
ADR-0034 D1/D2). The orchestrator holds no default and no ambient scope.

### D3 — Where `snapshotId` and `capturedAt` come from

From the caller, unchanged (ADR-0030 D4, ADR-0035 D4). The orchestrator mints neither, reads no clock,
and defaults neither. Whoever decides _when_ a capture happened stays upstream of persistence.

### D4 — What produces the `ScoredBifContext`

`projectScoredBifContext`, in `@age/business-discovery-contracts` — the only sanctioned producer
(ADR-0026 D1). The orchestrator does **not** call it, does not call the scorer or the mapper, and does
not accept a `BusinessIntelligenceFramework` (ADR-0035 D6 stands unchanged). It accepts a
`ScoredBifContext` that the caller has already produced.

### D5 — Capture is explicitly invoked, never automatic

No hook, no subscription, no side effect of scoring or projection. A caller that wants a snapshot
calls one method. Scoring and projection remain pure functions with no persistence dependency, and
nothing captures as a side effect of being scored.

### D6 — Capture is orchestration, not scoring, projection or adapter internals

It sits above the facade and below any application. Persistence never moves into the pure layer; the
pure layer never learns that persistence exists.

### D7 — Capture is independent of capability consumption

A `ScoredBifContext` may be consumed by capabilities, captured, both, or neither, in any order.
Capture neither triggers capability execution nor depends on it, and no capability is invoked from the
persistence side. Ordering is the caller's choice because the projection is immutable and identical
either way.

### D8 — Capture failure is returned, not thrown

The orchestrator returns a discriminated outcome:

- `{ status: 'captured', receipt }` — the ADR-0035 receipt, unchanged
- `{ status: 'failed', error }` — carrying the original `Error`, not a message string

It does **not** classify the failure. Both adapters throw a plain `Error` and the port defines no error
taxonomy, so any duplicate-vs-outage distinction would have to be inferred by matching message text —
which would be a fiction dressed as a contract. Classifying capture failures needs a port-level error
taxonomy, and that is its own decision (see open questions).

The orchestrator catches only what `capture` throws, and rethrows nothing it did not cause.

### D9 — Scope is never taken from a payload

Not from the `ScoredBifContext`, not from its `metadata`, not from anything planted in the snapshot
JSON. Enforced by type (`clientId`/`organizationId` declared `?: never` on the input) and by a
source-scan test, as in ADR-0034 and ADR-0035.

### D10 — It lives in `@age/scored-bif-snapshot-persistence`

It is the only package that can see both `ClientContext` and `ScoredBifContext`, and it already holds
the facade and the capture service. A new package for one class, before a second orchestrated concern
exists, is speculation — the same reasoning ADR-0035 D5 applied.

Recorded honestly: an orchestration type in a package named `…-persistence` is a naming compromise. If
the produce-side decision later creates a genuine orchestration package, this class should move there,
and moving it is a rename plus an export change.

### D11 — Not authorized

No API exposure. No Web exposure. No demo-runtime change. No `apps/` change. No workspace. No
`Draft → Active` promotion. No execution, strategy, proposal or reporting generation. No schema,
migration, RLS, grant, role or CI workflow change. No port change. No adapter change. No contracts
package change. No `@age/persistence` generalisation.

## The twelve questions, answered

1. **First real caller of `ScoredBifSnapshotCapture`?** `ScoredBifSnapshotCaptureOrchestrator` (D1).
2. **Where does `ClientContext` come from?** The caller, per call (D2).
3. **Where do `snapshotId` and `capturedAt` come from?** The caller (D3).
4. **What produces the `ScoredBifContext`?** `projectScoredBifContext`, upstream of this (D4).
5. **Automatic or explicit?** Explicit (D5).
6. **Scoring, projection, persistence or orchestration?** Orchestration (D6).
7. **Before or after capability consumption?** Independent of it, in either order (D7).
8. **Does capture failure fail the pipeline?** No — it is returned as an explicit outcome (D8).
9. **Does this require API/Web?** No (D11).
10. **Does this require workspace?** No (D11).
11. **Does this require `Draft → Active`?** No (D11).
12. **First implementation slice?** The section below.

## Consequences

- **The raw port gets exactly one holder.** The orchestrator is the only application-facing type that
  takes a `ScoredBifSnapshotRepository`, and the only thing it does with it is hand it to the facade
  constructor. It never assembles a composite key. That makes ADR-0034's "application code must use
  the facade" enforceable at one place rather than asserted at many.
- **Capture failure stops being a thrown surprise.** Callers must handle an outcome, which is the
  point: a snapshot that failed to persist is information, not an exception to be swallowed upstream.
- **Still no application caller.** This adds a package-level orchestration boundary. Nothing under
  `apps/` invokes it, because nothing under `apps/` has a `BusinessDiscoveryProfile` to start from.
  That gap is the produce-side decision, not this one.
- **A second thin layer exists and is on notice.** D1 names the two things that justify it. If either
  disappears, deleting it is a small, reversible change.

### Open questions this ADR deliberately does not answer

1. **The produce-side chain.** Nine test fixtures each re-derive mapper → scorer → projector. Whether
   that belongs in a production module, and in which package given ADR-0035 D6, is the next candidate
   decision.
2. **A port-level error taxonomy.** D8 returns the raw `Error` because there is nothing better to
   return. Distinguishing "already captured" from "database unavailable" requires the port to say so.
3. **A real input source.** No application holds a `BusinessDiscoveryProfile`. Until one does, there
   is no runtime caller to wire, and inventing one would be fabricating a workspace by another name.

### Alternative considered and rejected: let the caller compose it themselves

A caller could construct the facade and the capture service inline; ADR-0035 already left that
possible. Rejected because it hands the raw port to every call site — the exact shape ADR-0034 exists
to stop — and because it leaves every caller to decide independently whether a capture failure should
throw. One of those decisions being made once, in the open, is worth one class.

### Alternative considered and rejected: a `(ClientContext) => ScoredBifSnapshotCapture` factory

Equivalent binding with more indirection and no additional safety, and it provides no place for the
failure-outcome decision to live. Rejected as ceremony.

## Implementation constraints (binding on the slice that follows)

1. No change to `packages/business-discovery-contracts` — its purity guard stays as is.
2. No change to the port, to any adapter, to the facade, to `ScoredBifSnapshotCapture`, or to any
   migration, policy, grant, role or workflow authorized by ADR-0032/ADR-0033.
3. No clock, no randomness, no id generation, no environment reads in the orchestrator.
4. Every existing test stays green, including the live RLS and live database suites.
5. The demo baseline stays byte-identical.

## First implementation slice after acceptance

One PR, in `@age/scored-bif-snapshot-persistence`:

- a `ScoredBifSnapshotCaptureOrchestrator` taking a `ScoredBifSnapshotRepository` port, with one
  method accepting `{clientContext, snapshotId, capturedAt, context}` and returning
  `{status: 'captured', receipt}` or `{status: 'failed', error}`;
- tests proving scope comes only from the supplied `ClientContext`, that neither scope id is
  expressible as an input, that a payload cannot influence scope, that two different `ClientContext`s
  route to two different scopes through one orchestrator instance, that `snapshotId` and `capturedAt`
  are carried not generated, that no clock or randomness is read, that the port is reached only
  through the facade and the capture service, and that a throwing adapter yields `failed` rather than
  propagating.

Not in it: the produce-side chain, any error classification, any read operation, any `apps/` change,
any API/Web/demo-runtime change, any schema/migration/RLS change, and any change to the port, its
adapters, the facade or the capture service.
