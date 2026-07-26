# ADR-0040 — Business Discovery Scored BIF Capture Orchestrator

- Status: Proposed
- Date: 2026-07-26
- Supersedes: none
- Related: ADR-0009 (`ClientContext` authoritative for scoping) · ADR-0026 (neutral `ScoredBifContext`)
  · ADR-0030 (append-only snapshots, caller-supplied `snapshotId`/`capturedAt`) · ADR-0034
  (`ClientContext`-bound snapshot access) · ADR-0035 (capture boundary) · ADR-0036 (capture
  orchestration) · ADR-0037 (`produceScoredBifContext`) · ADR-0038/0039 (single mapping path)

> This is a decision request. It must not be self-accepted or implemented before ratification.

## Context

Every piece is built and none of them meet.

- `produceScoredBifContext` (ADR-0037) is the single sanctioned Discovery → BIF mapping. Since
  ADR-0039 retired Path A it is the only one that exists.
- `ScoredBifSnapshotCapture` (ADR-0035) writes one immutable snapshot through a
  `ClientContext`-bound facade.
- `ScoredBifSnapshotCaptureOrchestrator` (ADR-0036) holds the long-lived port, binds a
  `ClientContext` per call, and returns `{status:'captured'|'failed'}` instead of throwing.
- `ScopedScoredBifSnapshotRepository` + the RLS migration (ADR-0033) make the database itself refuse
  cross-tenant reads.

What does not exist is anything that **produces and then captures**. The produce side ends at a
`ScoredBifContext` in memory; the capture side begins at a `ScoredBifContext` it is handed. The two
halves meet, today, only inside tests. Each half is individually proven and jointly unused.

That gap is deliberate — ADR-0036 D4/D6 kept production out of the capture orchestrator, and
ADR-0037 D7 kept persistence out of the produce chain, precisely so the join would be an explicit
decision rather than an import someone added. This ADR is that decision.

### Verified repository state

Read before proposing, not assumed:

1. `produceScoredBifContext(profile, options)` requires `organizationId`, `constructedAt` and
   `changedBy` (via `BusinessDiscoveryToBifOptions`), optionally `bifId`, `version`, `questionnaire`
   and `sectionDefinitions`. It returns `{ context, mappingMetadata, scoringMetadata }`. **No
   contract change is needed to call it** — this ADR's stop condition on that point is already
   cleared.
2. `ScoredBifSnapshotCaptureOrchestrator.capture({clientContext, snapshotId, capturedAt, context})`
   returns an outcome and **never throws**. `clientId`/`organizationId` are typed `?: never`, so
   passing either fails to compile.
3. `@age/scored-bif-snapshot-persistence` declares exactly two dependencies:
   `@age/business-discovery-contracts` and `@age/capability-kit`. A pinned test asserts that exact
   list, and asserts `@age/bif` is reached only transitively.
4. **A pinned test forbids `produceScoredBifContext` from appearing in
   `scored-bif-snapshot-capture-orchestrator.ts`** (ADR-0036 D4/D6). The existing orchestrator
   therefore cannot become this one. This ADR proposes a _new module_, which leaves that guard true
   and unweakened rather than editing it away.
5. Nothing under `apps/` invokes any of the capture stack. The demo does mapping only, and its smoke
   output asserts "no side effects were performed".

## Decision (proposed)

**D1 — Introduce a package-level use case, `BusinessDiscoveryScoredBifCaptureOrchestrator`.** It is
the first sanctioned composition of `produceScoredBifContext` with the capture stack. It is a use
case: not a mapper, not a persistence adapter, not an app endpoint, not a capability.

**D2 — It lives in a NEW package, `@age/business-discovery-capture`.** Three locations were
considered and two are wrong:

- `@age/business-discovery-contracts` is impossible. Its purity guard forbids `@prisma/client` and
  `@age/persistence` by name, and the snapshot-persistence package already depends on it — hosting
  the use case there inverts the direction and creates a cycle.
- `@age/scored-bif-snapshot-persistence` is _possible_ — it already depends on both packages the use
  case needs, so it would cost no new dependency. It is still wrong. That package is documented as
  the durable adapter for snapshots; a module inside it that maps a discovery profile and scores a
  BIF makes "persistence" mean two things, and the next person adding a use case would reasonably
  put it there too. Cheap today, a layering violation by the third one.
- A new package puts the use case _above_ both: it depends on
  `@age/business-discovery-contracts`, `@age/scored-bif-snapshot-persistence` and
  `@age/capability-kit`; nothing depends on it. No cycle, and the existing packages need no edit at
  all. This follows ADR-0031 D2, which created a package rather than widening one whose shape did
  not match.

**D3 — Dependencies are injected, never constructed.** The use case takes a
`ScoredBifSnapshotCaptureOrchestrator` (already the holder of the raw port) — it never touches
`ScoredBifSnapshotRepository`, `ClientContextBoundScoredBifSnapshotRepository`, Prisma or a
connection. It reuses ADR-0036's outcome rather than re-implementing try/catch around capture.

**D4 — `ClientContext` is the only source of `clientId` and `organizationId`.** Supplied per call,
never ambient, never inferred from the discovery profile, the BIF, the `ScoredBifContext`, snapshot
JSON, or demo metadata. `clientId`/`organizationId` are declared `?: never` on the input, matching
ADR-0034/0035/0036, so a caller assembling input in a variable still fails to compile.

**D5 — `snapshotId` and `capturedAt` are caller-supplied (ADR-0030 D4).** So are `constructedAt` and
`changedBy`, because `produceScoredBifContext` requires them and reads no clock. The use case
generates no ids, reads no wall clock, and uses no randomness — a source-scanning purity guard pins
this, as in every module on this track.

**D6 — `organizationId` appears in exactly one place, and it is not the mapper input.** This is the
sharpest question in the ADR. `produceScoredBifContext` needs an `organizationId` for the BIF it
constructs; `ClientContext` carries an authoritative one for scope. Two sources for one concept is
how they silently disagree. **Proposed: the use case passes `clientContext.organizationId` into the
mapper options and does not accept a separate one** — the mapper options exposed to the caller omit
`organizationId` (`?: never`), exactly as the capture input omits scope ids. ADR-0030 says scope is
never read _from the payload_; this is the permitted direction — authoritative scope flowing _into_
the payload it describes — and it makes disagreement unrepresentable rather than merely discouraged.

**D7 — Capture is explicitly requested, never a hidden side effect.** Two modes, on a discriminated
input:

- `produceOnly` — produce the context and **do not touch persistence at all**. The capture
  dependency is not consulted.
- `produceAndCapture` — produce, then capture exactly once.

There is no default that writes. A caller who forgets a flag gets no write, not a surprise one.

**D8 — The capture dependency is optional only for `produceOnly`.** If capture is requested and no
capture orchestrator was injected, that is a programming error and **throws** — it is not reported as
a capture failure, because nothing was attempted and calling that "failed" would let a
misconfiguration masquerade as a database problem.

**D9 — Capture failure is returned explicitly and does not discard the produced context.** The result
is a discriminated union on its `capture` member: `{kind:'not-requested'}` | `{kind:'captured',
receipt}` | `{kind:'failed', error}`. The context was genuinely produced by pure code; throwing it
away because a write failed would destroy correct work and tell the caller less. But the failure is
not swallowed either — it is a state the caller must narrow past to reach a receipt, so ignoring it
requires saying so. Like ADR-0036 D8, the error is **not classified**: the port still defines no
error taxonomy, and inventing one from message text would be a fiction dressed as a contract.

**D10 — Mapper and scorer failures stay visible as throws.** `produceScoredBifContext` throws on
invalid input via the mapper's own guard. The use case adds no validation and catches nothing on the
produce side: a profile that cannot be mapped is a caller error, not a degraded result. Only the
capture step — the one with an external cause — is converted into an outcome.

**D11 — Nothing is wired to it.** No API route, no Web page, no demo call, no capability, no
composition root. This slice adds a use case and its tests; the first _runtime_ caller remains a
separate decision, because it needs a real `ClientContext` and a real input source, and both are
still absent.

## Answers to the questions this ADR must settle

1. **First sanctioned caller of `ScoredBifSnapshotCapture`?** Indirectly, the new
   `BusinessDiscoveryScoredBifCaptureOrchestrator` — via `ScoredBifSnapshotCaptureOrchestrator`,
   which stays the only thing that constructs the bound facade (ADR-0036).
2. **Mapper, adapter, use case or endpoint?** A **use case**. Explicitly not the other three.
3. **Where does `ClientContext` come from?** The caller, per call (D4). Production wiring of a real
   one is out of scope and unauthorized.
4. **`snapshotId` / `capturedAt`?** The caller (D5).
5. **`constructedAt` / `changedBy`?** The caller, as explicit orchestration input (D5).
6. **Does it own persistence failure semantics?** It owns _reporting_ them (D9). It does not classify
   them; the taxonomy question stays where ADR-0036 left it.
7. **Does capture failure fail the whole orchestration?** No (D9). The produced context is returned
   alongside an explicit failure the caller cannot reach past without handling.
8. **Mandatory or requested?** Requested (D7).
9. **API/Web?** No.
10. **Workspace?** No.
11. **`Draft → Active`?** No. The BIF stays `Draft`; a guard pins it.
12. **Demo smoke behaviour?** Unchanged. No demo file is touched and no side effect is introduced —
    the smoke assertion "no side effects were performed" must stay true.
13. **Where does it live?** A new package, `@age/business-discovery-capture` (D2).
14. **First slice after acceptance?** The use case module, its input/result types, a barrel, the
    package manifest/tsconfig, and its tests. Nothing else.

## Consequences

- The produce and capture halves finally meet, in one named place, with the join reviewable.
- One more package. Justified by direction: it depends on the other two, neither depends on it.
- Both existing guards survive untouched — the capture orchestrator still may not name
  `produceScoredBifContext`, and the persistence package's dependency list is unchanged.
- Still no runtime caller. This slice makes the composition _available_ and _proven_; it does not put
  it on any live path, and it must not be mistaken for having done so.

## Non-goals

No API/Web exposure · no workspace semantics · no `Draft → Active` promotion · no production
`ClientContext` wiring · no capability execution · no strategy generation · no demo side effects · no
schema, migration or RLS change · no change to `produceScoredBifContext` · no change to the capture
stack · no error taxonomy.

## Stop conditions for the implementation slice

Stop and raise a decision if: the orchestrator's home is still unclear after inspection; calling
`produceScoredBifContext` turns out to need a contract change; the capture stack cannot be used
without redesign; failure semantics prove ambiguous beyond D9; or the slice needs API/Web, workspace,
`Draft → Active`, demo side effects, or a schema/migration/RLS change.

## Open questions

1. **The error taxonomy.** Still unanswered, still deliberately so. "Already captured" and "database
   unavailable" are different facts, and the port cannot yet tell them apart. Whoever needs the
   distinction owns that decision.
2. **The first runtime caller.** This use case is designed to be called; nothing calls it. The real
   input source and the real `ClientContext` remain a separate, unauthorized decision.
