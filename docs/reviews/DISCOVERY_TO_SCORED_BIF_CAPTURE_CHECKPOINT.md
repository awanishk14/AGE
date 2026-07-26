# Checkpoint — Discovery to scored BIF capture path

> Documentation only. Records the state of the Discovery → scored BIF → snapshot path as of
> `main` @ `df8652c`. Decides nothing; every decision cited here lives in its own ADR.

## 1. What this track was

Four accepted ADRs turned a set of pure functions that had never met into one named, reviewable
path. Read in order they are a single argument:

| ADR  | Question it answered                                                                                                 | Outcome                                                                                                                                                 |
| ---- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0037 | Where does the produce-side chain live, and who writes it once?                                                      | `produceScoredBifContext` in `@age/business-discovery-contracts` — no new package needed; the package-boundary fork ADR-0036 anticipated did not exist. |
| 0038 | Two disjoint Discovery→BIF mapping paths existed. Which is canonical?                                                | Path B (`produceScoredBifContext`) is the only sanctioned mapping. Path A is a legacy demo bridge with one caller.                                      |
| 0039 | The demo could not move to Path B without `organizationId` / `constructedAt` / `changedBy`. Where do they come from? | An explicit, frozen `DEMO_SCENARIO_METADATA` module, passed as a required parameter. Not invented constants, not fixture fakes, not a third path.       |
| 0040 | Produce and capture were both built and never joined. Where does the join go?                                        | A package-level use case, `@age/business-discovery-capture`. Not inside the mapper, not inside persistence, not an endpoint.                            |

The shape of the arc: **chain written once → single mapping path → demo migrated onto it → produce
and capture joined**.

## 2. Merge ledger

| PR   | What                                                        | Merge     |
| ---- | ----------------------------------------------------------- | --------- |
| #124 | ADR-0037 Proposed                                           | `467347d` |
| #125 | ADR-0037 Accepted                                           | `52cd977` |
| #126 | `produceScoredBifContext` (+40 tests)                       | `e30133f` |
| #127 | Eight hand-rolled test chains migrated onto it              | `394f1c8` |
| #128 | ADR-0038 Proposed                                           | `d71aa3e` |
| #129 | ADR-0038 amended (D6: demo migration blocked, not deferred) | `67af8ed` |
| #130 | ADR-0038 Accepted                                           | `d1c6e9a` |
| #131 | Path A caller guard (6 tests pinning its single caller)     | `0fb0612` |
| #132 | ADR-0039 Proposed                                           | `4f0d581` |
| #133 | ADR-0039 Accepted                                           | `56d35c8` |
| #134 | Demo migrated to Path B via explicit metadata               | `edfd39a` |
| #135 | Path A deleted — no shim, no alias, no deprecation stub     | `38459c4` |
| #136 | ADR-0040 Proposed                                           | `3ca0dd6` |
| #137 | ADR-0040 Accepted                                           | `cc7d433` |
| #138 | `BusinessDiscoveryScoredBifCaptureOrchestrator` (+18 tests) | `df8652c` |

Every post-merge CI run reported SUCCESS. The path-gated live-database workflow ran only where a
persistence path was touched.

## 3. The path as it stands

```
BusinessDiscoveryProfile
  → produceScoredBifContext(profile, { organizationId, constructedAt, changedBy, … })   [Path B, the only one]
      → mapBusinessDiscoveryToBifDraft → scoreBusinessIntelligenceFramework → projectScoredBifContext
  → ScoredBifContext
      → BusinessDiscoveryScoredBifCaptureOrchestrator.execute({ mode, clientContext, … })
          → ScoredBifSnapshotCaptureOrchestrator
              → ClientContextBoundScoredBifSnapshotRepository
                  → ScoredBifSnapshotRepository (in-memory | Prisma, RLS-scoped)
```

Layering that held throughout: pure production knows nothing about persistence; the capture stack
knows nothing about discovery; the use case composes both and implements neither. The new package
depends on three packages and **nothing depends on it** — no cycle, and no existing package needed
an edit to admit it.

## 4. Design calls worth remembering

- **One source for `organizationId` (ADR-0040 D6).** The mapper needs one for the BIF it builds and
  `ClientContext` carries an authoritative one for scope. Rather than accept both and compare, the
  use case declares the mapper's own `organizationId` as `?: never` and flows the authoritative one
  in. Disagreement is unrepresentable, not detected.
- **Misconfiguration is not a capture failure (D8 vs D9).** Requesting capture with no injected
  dependency **throws** — nothing was attempted. Only a real attempt that failed becomes a returned
  `{ kind: 'failed', error }`, and that error stays **unclassified**, because the port defines no
  error taxonomy and inferring "already captured" from message text would be a fiction dressed as a
  contract.
- **Two explicit modes, never a default that writes (D7).** A caller who forgets a flag gets no
  write, not a surprise one.
- **The context survives a capture failure (D9).** It was genuinely produced by pure code; discarding
  correct work because a write failed tells the caller less.
- **Path A was deleted, not deprecated (#135).** A shim would have left two paths in the repo with a
  sign on one. The replacing spec forbids the retired names repo-wide, _including inside the package_.
- **The demo's output changed honestly (#134).** Eight invented grouping keys became seven populated
  and five omitted canonical sections. The migration was allowed to change what the demo prints
  rather than be tuned to preserve it.

## 5. Findings recorded, not smoothed over

1. **Two test bugs in #138, both tests-wrong-not-code.**
   - An assertion that changing `changedBy` changes the output was **vacuous**: `changedBy` lands on
     BIF `FieldVersion`s, which the neutral projection deliberately does not carry. It was replaced by
     proof at the source (the values are spread through, never defaulted locally) plus a compile-time
     requirement that the caller supply them.
   - A speculative `result.context.organizationId` assertion did not typecheck — and that is the
     point. PR #126 finding 1 (the projection carries no `organizationId`) now holds at the type
     level and is pinned as `expect(result.context).not.toHaveProperty('organizationId')`.
2. **The `Draft → Active` question never arose and was never answered.** Every context produced along
   this path is `Draft`, asserted at each stage.
3. **`ScoredBifSnapshotRow.context` is still `unknown`** (PR #109 finding 2), so the Prisma delegate
   needs a documented cast at the composition root. Untouched by this track.

## 6. The residual

**Nothing is wired to any of it (ADR-0040 D11).** No API route, no Web page, no demo call, no
capability, no composition root invokes the use case. The first runtime caller needs a real
`ClientContext` and a real input source, and both are still absent. That is one decision, not an
oversight, and it is the reason this track stops here.

## 7. Still open

- The first runtime caller / real input source — the blocking one.
- `Draft → Active` promotion rules.
- API/Web exposure, workspace implementation, erasure/retention.
- Narrowing `ScoredBifSnapshotRow.context`.
- The `apps/api` placeholder Prisma schema (deleting it is a decision, not a cleanup).

Each falls under a stop-and-ask condition. None should be started without its own decision.
