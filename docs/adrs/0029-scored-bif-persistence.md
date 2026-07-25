# ADR 0029: Persistence of a Scored Business Intelligence Framework

- Status: Accepted
- Date: 2026-07-25

## Acceptance note

ADR-0029 was accepted as written after PR #96 recorded the proposal. The accepted decision is
**Option C**, in the four parts stated under "Recommended decision":

1. Persistence is **staged, not built in one slice**: pure snapshot contract → port plus in-memory
   adapter → durable adapter. The hard boundary **"no DB/persistence writes" remains in force** and is
   not amended by this ADR.
2. The next slice is **stage 1 only** — a pure, versioned scored-BIF snapshot contract with round-trip
   tests, including explicit proof that omitted sections stay omitted and that no score, section or
   provenance value is fabricated, defaulted or lost.
3. **Stage 3 requires its own Accepted ADR.** Storage technology, schema, migration policy, the demo
   forbidden-import guard, and whether `@age/persistence` is extended or bypassed are decided there,
   not here. This ADR authorizes no database write.
4. `@age/persistence` is **not presumed to be the host** for the BIF port; that is decided in stage 2
   on evidence.

Option B (end-to-end Prisma now) is rejected as committing a schema before the serialization format,
port shape and lifecycle semantics exist. Option A (defer with no trigger) and Option D (snapshot
format only, never store) are declined.

The five questions under "Deliberately not decided here" — snapshot-vs-mutable record, identity and
keying, interaction with `Draft → Active` status promotion, re-scoring history, and whether the demo
track ever reads persisted data — stay open by design. They must be answered before stage 3, and the
first two before stage 2. This PR only changes the ADR status and records acceptance; implementation
is a separate slice.

## Context

The Business Discovery → scored BIF pipeline is complete and pure:

```
BusinessDiscoveryProfile → questionnaire validation → discovery completeness + confidence
  → field-level evidence/provenance → canonical Draft BIF
  → BIF root + section confidence (scoreBusinessIntelligenceFramework)
  → ScoredBifContext projection (projectScoredBifContext)
```

Everything lives in `packages/business-discovery-contracts`, is deterministic, in-memory, and
package-level. Consumption semantics are now settled too: ADR-0026 (context projection + sufficiency),
ADR-0027 (non-gating readiness assessment, three adopters), ADR-0028 (registry `assessesContext`
metadata, implemented in PR #95). The next unbuilt thing on the roadmap is **persistence of a scored
BIF** — everything downstream (API exposure, re-scoring over time, promotion `Draft → Active`, real
client workspaces) presupposes that a scored BIF can outlive the process that computed it.

Persistence is also the first item on this track that **directly touches the project's hard
boundaries**: "no DB/persistence writes", "in-memory only", "no real side effects". Per the standing
decision rule, that makes it an ADR question, not an implementation slice.

### What already exists (verified against `main` @ `29e1d1b`)

This matters because the roadmap's "add persistence" reads as though nothing is there. Something is —
but far less than the name suggests.

- **`packages/persistence` (`@age/persistence`) exists and is architecture-only.** Its own module doc
  says so: "Architecture only … No SQL, no Prisma models, no migrations, no business logic." It ships
  repository/provider/unit-of-work/transaction **interfaces**, base-field and audit/version types, and
  **placeholder** mappers (`strategy-mapper`, `research-mapper`, `graph-mapper`, …).
- **`src/prisma/schema.prisma` is 14 lines: a generator and a datasource. Zero models, zero tables,
  zero migrations.** Its header states the canonical model is the Business Knowledge Graph and that
  "PostgreSQL persists it in a later task."
- **The repository interfaces are BKG/strategy-shaped, not BIF-shaped** (`opportunity`, `strategy`,
  `campaign`, `content`, `evidence`, `decision`, `problem`, `project`, `organization`, `research`).
  There is no BIF repository, no BIF mapper, and no BIF table.
- **`@age/persistence` has no runtime caller.** The only files that name it outside its own package
  are three specs — and they name it as a **forbidden import**: `demo-runtime/src/tests/runner.spec.ts`
  and `apps/demo/src/tests/run.spec.ts` assert the demo path imports none of
  `['prisma', '@age/persistence', '@age/integrations', 'ioredis', 'redis', 'axios', …]`.
- `@age/api` declares `@prisma/client`, `prisma` and `ioredis` as dependencies with `prisma:generate`
  and `prisma:migrate` scripts, but there is no schema with models for them to act on.

So the honest position is: **a persistence _architecture_ exists, a persistence _implementation_ does
not, and the demo track is actively test-guarded against importing it.** Any BIF persistence work is
net-new modelling, not "wiring up what's already there." A `@age/bif` ↔ storage mapping does not exist
in any form.

### What "persist a scored BIF" actually requires

Decomposed, the ask is at least four separable problems, currently conflated under one roadmap line:

1. **A stable serialized form.** A scored BIF must survive a round trip to a storage-neutral
   representation without losing or inventing anything — scores, per-field provenance/evidence,
   confidence enums, omitted sections (which must stay _omitted_, never placeholder-filled per
   ADR-0025), and the scoring-version stamp.
2. **A storage-neutral port.** What operations does the domain need — `save`, `findById`,
   `findLatestForProfile`, history? Who owns identity, and what is the key?
3. **An adapter.** In-memory, file, PostgreSQL/Prisma — and the schema and migration that implies.
4. **Lifecycle and identity semantics.** Is a scored BIF an immutable snapshot appended per scoring
   run, or a mutable row updated in place? What is the identity of "the BIF for this client"? How does
   a stored score interact with **BIF status promotion**, which is explicitly undecided — and where a
   high score deliberately does **not** imply promotable?

Only (3) is a boundary violation. (1) and (2) are pure, deterministic, package-level work of exactly
the kind every merged slice on this track has been. (4) is a semantics question that must be answered
before any row is written, because the wrong answer is expensive to reverse once data exists.

## Options considered

### Option A — Defer persistence entirely

Keep the boundary as-is; build nothing until a real client workspace or API-exposure requirement
forces the question.

- **For:** zero risk; the pure track still has unbuilt work (expanded mapping coverage, further
  readiness adopters); no premature schema commitment.
- **Against:** persistence is the acknowledged next milestone and the blocker for every downstream
  capability. Deferring with no stated trigger is how a roadmap stalls — and ADR-0027/0028 set the
  precedent that "defer" needs a named threshold, not an open end.

### Option B — Build it end-to-end: Prisma models, migration, PostgreSQL repository

Add BIF models to `schema.prisma`, generate a client, implement a `BifRepository` in `@age/persistence`,
wire it into `@age/api`.

- **For:** delivers the actual capability in one go; the datasource and tooling are already declared.
- **Against:** it violates the hard boundaries in a single step, and does so while **all four**
  sub-problems above are unanswered. It commits a database schema to a serialization format that has
  never been round-tripped, to a port shape with no proven consumer, and to lifecycle semantics
  entangled with the undecided `Draft → Active` promotion rules. It would also be the first code to
  breach the demo's forbidden-import guard, requiring that guard to be weakened. Rejected as
  premature — this is precisely the "guess at an architectural decision" the project's decision rule
  forbids.

### Option C — Pure serialization contract first, then a port, then an adapter (recommended)

Stage the work so that each stage is independently valuable, testable, and — for the first two —
entirely inside the existing boundaries.

- **Stage 1 (next slice, pure).** A versioned, storage-neutral **snapshot contract** for a scored BIF
  in `packages/business-discovery-contracts` (or a sibling contracts package): a deterministic
  `toScoredBifSnapshot` / `fromScoredBifSnapshot` pair, a `SCORED_BIF_SNAPSHOT_VERSION`, and
  round-trip tests over the real sample fixture proving byte-stable output, exact score preservation
  (root 17 / completeness 12 and all seven section scores), preserved per-field provenance, and — the
  honesty proof — that the five **omitted sections stay omitted** across the round trip. No I/O, no
  `Date.now`, no storage. This is a pure function pair; the existing purity-guard test pattern applies
  unchanged.
- **Stage 2 (pure).** A storage-neutral **repository port** — a narrow interface plus an **in-memory
  adapter** with tests. Still no DB, no side effects. This is what proves the operation set is right
  before a schema hardens around it. It also answers whether `@age/persistence`'s existing
  BKG-shaped interfaces are the right host or whether the BIF port belongs beside the contracts.
- **Stage 3 (boundary change, its own ADR).** Only then: a durable adapter, schema, migration, and any
  demo/API wiring — with the forbidden-import guard revisited explicitly rather than incidentally.
  Stage 3 must not begin until stages 1 and 2 are merged and the lifecycle/identity semantics in the
  open-question list below are ratified.

- **For:** each stage is a small, reviewable slice matching every merged slice on this track; the
  boundary is crossed exactly once, deliberately, and only after the format and port are proven; a
  round-trip-tested serialization contract is valuable on its own (fixtures, transport, API responses)
  even if durable storage is never built. It also keeps the "unknown is never converted into good or
  bad" guarantee testable at the persistence layer, where placeholder-filling is most tempting.
- **Against:** slower to a working database; stages 1–2 could be judged speculative if stage 3 never
  happens. Mitigated by stage 1 having standalone uses, and by requiring stage 3 to be ratified
  separately rather than assumed.

### Option D — Snapshot format only; no port, no storage, ever

Stop after stage 1 and treat scored BIFs as recomputed-on-demand forever.

- **For:** maximal purity; the pipeline is deterministic, so a scored BIF _can_ always be recomputed
  from the profile.
- **Against:** recomputation is only equivalent while the scoring algorithm is frozen. The moment
  `BIF_CONFIDENCE_SCORING_VERSION` moves, historical scores become unreproducible, and score history
  over time is exactly what makes confidence scoring useful. Rejecting storage outright is a bigger
  decision than deferring it, and nothing forces it now.

## Recommended decision (for ratification)

Adopt **Option C**, in four parts:

1. **Persistence is staged, not built in one slice**: serialization contract → port + in-memory
   adapter → durable adapter. The hard boundary "no DB/persistence writes" **remains in force** and is
   not amended by this ADR.
2. **The next slice is stage 1 only**: a pure, versioned scored-BIF snapshot contract with round-trip
   tests, including an explicit test that omitted sections stay omitted and no score, section, or
   provenance value is fabricated, defaulted, or lost.
3. **Stage 3 requires its own Accepted ADR.** That ADR — not this one — decides storage technology,
   schema, migration policy, the demo forbidden-import guard, and whether `@age/persistence` is
   extended or bypassed. This ADR explicitly does **not** authorize writing to a database.
4. **`@age/persistence` is not presumed to be the host.** Its current interfaces are BKG/strategy
   shaped and have no runtime caller; whether the BIF port lives there is decided in stage 2 on
   evidence, not by name.

## Consequences

**Easier.** The roadmap's largest remaining item becomes three small slices instead of one boundary-
breaking leap. A round-trip-tested snapshot contract gives the API and fixtures a stable shape
immediately. The decision about database technology is made with a proven format and port in hand
rather than as a guess.

**Harder.** Durable storage is further away in wall-clock terms, and there is a real risk of building
a port whose only consumer is an in-memory adapter if stage 3 is never ratified. Two extra ADR/slice
cycles are spent before a row is ever written.

**Deliberately not decided here** (these must be answered before stage 3, and several before stage 2):

- **Snapshot vs mutable record.** Is each scoring run an immutable append, or is there one row per
  BIF updated in place? This drives the entire schema and cannot be retrofitted cheaply.
- **Identity.** What keys a stored scored BIF — the BIF id, the profile id, a client/workspace id, or
  a composite with the scoring version? There is no client/workspace concept in the pure track yet.
- **Interaction with status promotion.** `Draft → Active` promotion is undecided (ADR-0025 context),
  and a high score explicitly does not imply promotable. Persisting `status` must not become an
  implicit promotion mechanism.
- **History and re-scoring.** Whether prior scores are retained when the scoring version changes, and
  whether a stored score is ever recomputed in place (which would silently rewrite history).
- **Whether the demo track ever reads persisted data.** Today it is test-guarded against it, and the
  demo baseline (6 capabilities / 6 approvals / invariant OK / no side effects) must stay byte-identical.

**Unchanged.** Every existing guarantee holds: the pipeline stays pure and deterministic; `@age/bif` is
consumed, never modified; capability packages never import `@age/bif`; partial Draft BIFs omit sections
and are never placeholder-filled; provenance, scores and conclusions are never fabricated; insufficient
context remains a valid successful outcome. This ADR adds a **plan and a staging rule** for persistence;
it grants no new side-effect capability and writes nothing to any store.
