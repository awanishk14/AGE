# ADR 0037: Scored BIF Context Production Chain

- Status: Accepted
- Date: 2026-07-26

## Acceptance note

ADR-0037 is accepted as the governing decision for producing a `ScoredBifContext`. It ratifies one
pure chaining function in `@age/business-discovery-contracts`, beside the three functions it chains;
requires it to stay pure and to pass every mapper input through unchanged; requires scoring metadata
to be threaded into the projector rather than recomputed; requires both metadata sets to be returned;
and keeps it ignorant of persistence.

It is accepted because it introduces no new architectural direction. It adds no dependency, creates no
package, crosses no boundary, changes no existing function, and restates decisions already made:
purity as a source-scanned property, caller-supplied values instead of ambient ones (ADR-0026 D2,
ADR-0030 D4), and persistence kept out of pure logic (ADR-0031, ADR-0035). The anticipated
package-boundary question turned out not to exist, so no genuine architectural fork remained to
choose between.

It does **not** authorize any runtime caller, any migration of the existing hand-rolled test chains,
any change to the demo's mapping path or to `mapBusinessDiscoveryToBifContext`, API/Web exposure,
workspace implementation, `Draft → Active` promotion, execution, or any schema, migration, RLS or CI
change.

The two open questions it records — the relationship between the two mapping paths, and the first
runtime caller and its real input source — stay open and each need their own decision.

## Context

ADR-0036 delivered the consume side: `ScoredBifSnapshotCaptureOrchestrator` takes an already-produced
`ScoredBifContext` and captures it. It recorded, as an open question, the gap on the other side:

> Nothing in production produces a `ScoredBifContext`. Every test that needs one re-derives it by
> hand from the three pure functions.

This ADR decides whether that chain becomes a production function, and where it lives.

### Verified repository state

The pipeline is three pure functions, all in **`@age/business-discovery-contracts`**:

| Function                                                              | File                               |
| --------------------------------------------------------------------- | ---------------------------------- |
| `mapBusinessDiscoveryToBifDraft(profile, options) → {bif, metadata}`  | `src/business-discovery-to-bif.ts` |
| `scoreBusinessIntelligenceFramework(bif, options?) → {bif, metadata}` | `src/bif-confidence-scoring.ts`    |
| `projectScoredBifContext(scoredBif, options?) → ScoredBifContext`     | `src/scored-bif-context.ts`        |

All three are exported from the package barrel. All three import `@age/bif` directly — verified by
reading the import specifiers, not inferred from the package manifest.

**Eleven files call the chain. Every one of them is a test.** Nine chain all three functions
together:

- `packages/business-discovery-contracts/src/tests/` — `scored-bif-context.spec.ts`,
  `scored-bif-snapshot.spec.ts`, `scored-bif-snapshot-repository.spec.ts`,
  `bif-confidence-scoring.spec.ts`
- `packages/persistence/src/tests/` — `scored-bif-snapshot.db.spec.ts`,
  `scored-bif-snapshot-rls.db.spec.ts`
- `packages/capabilities/{intelligence,market-discovery,revenue}/src/tests/processing/` — the three
  readiness specs

Plus `packages/business-discovery-contracts/src/tests/business-discovery-to-bif.spec.ts` (the mapper's
own spec) and `packages/scored-bif-snapshot-persistence/src/tests/scored-bif-snapshot-repository-contract.ts`
— a test-only helper module, the single place the chain is currently written once and shared, and only
within one package:

```ts
export function sampleContext(): ScoredBifContext {
  const { bif } = mapBusinessDiscoveryToBifDraft(SAMPLE_BUSINESS_DISCOVERY_PROFILE, MAPPER_OPTIONS);
  const { bif: scored, metadata } = scoreBusinessIntelligenceFramework(bif);
  return projectScoredBifContext(scored, { scoringMetadata: metadata });
}
```

**No production module chains two or more of them.** The orchestrator merged in PR #123 explicitly does
not, and its spec asserts the absence.

### A correction to what ADR-0036 assumed

ADR-0036's open question anticipated a package-boundary problem: that chaining would pull `@age/bif`
somewhere it is not allowed, forcing either a new package or a contested home. **That problem does not
exist.** All three functions already live in one package, that package already depends on `@age/bif`,
and it is the package ADR-0035 D6 names as the sanctioned place for exactly this. A chaining function
placed beside them adds no dependency, crosses no boundary, and needs no new package.

### A second finding, recorded because it is easy to trip over

There are **two** discovery-to-BIF mapping paths in the same package, and they are disjoint:

|                    | `mapBusinessDiscoveryToBifDraft`                    | `mapBusinessDiscoveryToBifContext`                |
| ------------------ | --------------------------------------------------- | ------------------------------------------------- |
| Output             | a canonical `BusinessIntelligenceFramework` (Draft) | `BifCompatibleBusinessContext`                    |
| Imports `@age/bif` | yes                                                 | no                                                |
| Scored             | yes, by the chain below                             | never                                             |
| Production caller  | none                                                | `packages/demo-runtime/src/business-discovery.ts` |

The demo line "Business Discovery intake loaded … 8 mapped section(s)" comes from the **second**,
shallower path. It is a structural re-grouping with no BIF, no scoring and no confidence. The demo has
never touched the scored chain.

That the two exist side by side is a real question — but it is a question about the demo's mapping
path, not about this chain, and answering it would change demo output. **This ADR does not answer it**
(see Open questions).

## Decision

**D1 — One pure production function chains the three.** A single exported function that takes a
`BusinessDiscoveryProfile` and the inputs the mapper already requires, and returns the projected
`ScoredBifContext` together with the metadata the steps produced. It replaces nothing: the three
functions stay exported and stay independently callable.

**D2 — It lives in `@age/business-discovery-contracts`, beside the three functions it chains.** No new
package. No new dependency. Per the correction above, the boundary concern that would have justified
either does not apply.

**D3 — It stays pure.** No clock, no id generation, no randomness, no I/O, no `process.env`. The same
purity guard the three steps already carry applies to it, and is asserted by reading its source.

**D4 — Every value the mapper requires stays caller-supplied and passes straight through.**
`organizationId`, `constructedAt`, `changedBy`, and the optional `bifId`, `version` and
`questionnaire`. The chain defaults none of them and invents none of them. `constructedAt` in
particular is a caller input precisely because the mapper never reads a clock, and a chain that
supplied `new Date()` on the caller's behalf would silently destroy that property.

**D5 — Scoring metadata is threaded through, not recomputed.** The projector is called with
`{ scoringMetadata }` from the scorer, exactly as the existing helper does. Letting the projector
recompute omissions structurally when the scorer already reported them would create two answers to the
same question.

**D6 — It returns the metadata from both steps, not only the context.** The mapper reports unmapped
fields and per-field provenance; the scorer reports omitted sections, warnings, reasons and
`scoringVersion`. A chain that returned only the `ScoredBifContext` would discard the mapper's
metadata, and a caller wanting it would be pushed straight back to re-deriving the chain by hand —
which is the problem this function exists to remove.

**D7 — It does not persist, and does not know persistence exists.** It never imports
`@age/scored-bif-snapshot-persistence`, never mentions capture, snapshots, `snapshotId` or
`capturedAt`. The produce side and the consume side meet in the caller, not in either of them. This is
the ADR-0031/0035 direction restated: persistence stays out of pure logic.

**D8 — It gets no runtime caller in this slice.** Adding one means choosing a real input source, which
is still undecided and is still outside the approved boundary. The honest position after this ADR is
that both halves exist and nothing yet joins them at runtime.

**D9 — It does not change any existing function, spec or fixture.** Migrating the nine hand-rolled
test chains onto it is a mechanical follow-up worth doing, but doing it in the same slice would mix a
new API with a nine-file edit and make a regression hard to attribute. The test-only
`sampleContext()` helper stays exactly as it is until then.

**D10 — Not authorized by this ADR:** any `apps/`, API, Web or demo-runtime change; any change to
`mapBusinessDiscoveryToBifContext` or the demo's mapping path; `Draft → Active` promotion; workspace;
execution, strategy, proposal or reporting layers; any schema, migration, RLS, grant, role or CI
change; any change to `@age/bif`; and any persistence wiring.

## Rationale

The chain is three lines. That is exactly why it is worth naming once: three lines repeated in nine
files, each free to drift in the option values it passes, is nine chances for a test to prove
something about a pipeline nobody actually assembles that way. The `sampleContext()` helper already
demonstrates the value of writing it once — it is simply trapped in one package's test directory, where
no production caller can reach it.

It is also the smaller half of the remaining gap. "There is no runtime caller" has two causes: nothing
produces a context, and nothing decides when to capture one. This ADR removes the first without
pretending to answer the second, and it does so without touching a boundary, a dependency or an
existing function.

## Alternatives considered

**Leave it in tests.** Defensible today — nothing in production needs a `ScoredBifContext` yet, and an
unused function is a maintenance cost. Rejected because the first real caller will need this chain
assembled correctly, and the option values threaded through it (particularly `scoringMetadata`) are
exactly the kind of detail that is silently got wrong when copied. The alternative is not "no chain",
it is "the chain, re-derived by whoever wires it first".

**Export `sampleContext()` from the test helper.** Rejected outright: it is bound to
`SAMPLE_BUSINESS_DISCOVERY_PROFILE` and to hard-coded mapper options including a fixed
`constructedAt`. It is a fixture, not a pipeline, and promoting a fixture to production API would ship
sample data as a default.

**Fold the chain into the orchestrator.** Rejected. It would put production of the context inside the
persistence package, which needs `@age/bif` — the exact import ADR-0035 D6 forbids there — and would
make scoring a side effect of persisting.

**Chain the mapper and scorer only, leaving projection to the caller.** Rejected as an arbitrary cut.
The projector is where scoring metadata gets threaded in, which is the step most likely to be got
wrong; stopping short of it leaves the sharp edge exposed.

## Open questions

1. **The two mapping paths.** `mapBusinessDiscoveryToBifContext` and the scored chain both project a
   `BusinessDiscoveryProfile`, and only the shallower one has a production caller. Whether the demo
   should eventually move to the scored chain, whether the two should converge, or whether they are
   legitimately different things serving different purposes, is undecided. It touches demo output and
   therefore needs its own decision.
2. **The first runtime caller.** Still open, still needs a real input source, still outside the
   approved boundary.
3. **Migrating the nine test chains** onto the new function (D9) — sequencing, not architecture.

## First implementation slice after acceptance

One PR, in `@age/business-discovery-contracts`: the chaining function of D1 with its input and result
types, exported from the barrel; tests proving the returned context is identical to the hand-rolled
three-call chain for the sample profile, that scoring metadata is threaded through rather than
recomputed, that both metadata sets survive, that every caller-supplied value passes through
unchanged, that no clock, id or randomness is read, that an invalid profile still fails at the
mapper's existing guard rather than being swallowed, and that the module names nothing from the
persistence packages.

**Not in it:** any runtime caller, any migration of the existing nine test chains, any change to the
three functions it chains, any change to the demo path or `mapBusinessDiscoveryToBifContext`, and any
`apps/` change.
