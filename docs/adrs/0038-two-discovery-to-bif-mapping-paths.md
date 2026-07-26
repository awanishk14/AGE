# ADR-0038 — The two Discovery → BIF mapping paths

- Status: Proposed
- Date: 2026-07-26
- Supersedes: none
- Related: ADR-0025 (Discovery → BIF prerequisites), ADR-0026 (capability consumption of
  `ScoredBifContext`), ADR-0035/0036 (snapshot capture), ADR-0037 (produce-side chain, open question 2)

> This is a decision request. It must not be self-accepted and nothing in it may be implemented
> before it is Accepted.

## Context

ADR-0037 recorded, as an open question, that the repository contains **two disjoint mappings from a
`BusinessDiscoveryProfile` toward BIF**. Both are pure and deterministic, both live in
`@age/business-discovery-contracts`, and neither calls the other. This ADR states the finding
precisely and asks for a decision, because resolving it changes demo output.

### Path A — the compatible-context path (the one the demo uses)

```
BusinessDiscoveryProfile → mapBusinessDiscoveryToBifContext → BifCompatibleBusinessContext
```

- One argument. No `organizationId`, no `constructedAt`, no `changedBy`.
- Output is a **local** shape (`bif-compatible-context.ts`), deliberately **not** from `@age/bif`.
  Its own boundary note gives the reason: the canonical `BusinessIntelligenceFramework` requires
  wall-clock `Date`s, per-field source/confidence metadata and 0–100 scores, and producing those from
  intake data "would force fabricated scoring and non-deterministic construction". The note describes
  the shape as "ready to feed a future BIF-wiring slice".
- **It is the only one of the two with a non-test caller**:
  `packages/demo-runtime/src/business-discovery.ts:99`. It produces the demo's
  "8 mapped section(s)" line.

### Path B — the scored path

```
BusinessDiscoveryProfile → mapBusinessDiscoveryToBifDraft → scoreBusinessIntelligenceFramework
                         → projectScoredBifContext
```

Since ADR-0037 this chain is written once, as `produceScoredBifContext`. It produces a real
`@age/bif` Draft BIF, scores it, and projects the neutral `ScoredBifContext` that capabilities
consume and that snapshot persistence stores.

- It requires caller-supplied `organizationId`, `constructedAt` and `changedBy` — deliberately, so
  the mapper reads no clock and invents no actor (ADR-0025).
- **It has no runtime caller at all.** Every call site is a test.

### The relationship between them

Path A's boundary note anticipated Path B: it exists because the BIF-wiring slice had not happened
yet. That slice has now happened. So the honest reading is that Path A is **an earlier answer to the
same question**, still in the demo because nothing has replaced it — not a second sanctioned
projection with its own purpose.

But they are not interchangeable today:

|                       | Path A                          | Path B                                         |
| --------------------- | ------------------------------- | ---------------------------------------------- |
| Extra inputs required | none                            | `organizationId`, `constructedAt`, `changedBy` |
| Output                | local BIF-_compatible_ grouping | scored `ScoredBifContext`                      |
| Scores                | none                            | root + per-section confidence/completeness     |
| Omitted sections      | not modelled                    | first-class                                    |
| Runtime caller        | demo-runtime                    | none                                           |

**The blocking asymmetry is the extra inputs.** The demo has no organization, no actor and no clock
it is allowed to read. Moving the demo onto Path B means the demo must supply those three values from
somewhere — and inventing them is exactly the fabrication these ADRs exist to prevent.

## Decision requested

**D1. Name Path A as superseded-in-principle, and Path B as the single sanctioned Discovery → BIF
mapping**, with Path A retained only until the demo can be moved.

**D2. Do NOT delete `mapBusinessDiscoveryToBifContext` or `BifCompatibleBusinessContext` in this
ADR.** They have a live caller. Deleting them is a demo change and needs its own slice.

**D3. Do NOT move the demo onto Path B here.** It requires deciding where the demo's
`organizationId`, `constructedAt` and `changedBy` come from — a fixed demo constant, a fixture field,
or a real input source. That is a product decision with more than one reasonable answer, and it
changes demo output, which every smoke check pins.

**D4. Record the constraint that no third path may be added.** Any new Discovery → BIF mapping must
extend Path B or be argued for in its own ADR.

**D5. Mark the demo's `mappedSectionKeys` output as the thing that will change** when D3 is
eventually decided, so the change is expected rather than discovered.

## Options considered

**Option 1 — leave both, undocumented.** Rejected: the next person to need a mapping picks one by
coin flip, and the two answer different questions.

**Option 2 — move the demo onto Path B now.** Rejected here, not on merit but on sequencing: it
forces the three-input decision (D3) inside an implementation slice, and the only ways to satisfy it
without a decision are to fabricate values or to read a clock. Both are prohibited.

**Option 3 (recommended) — declare the direction, defer the migration.** Path B is sanctioned, Path A
is legacy-with-a-caller, no third path. Nothing changes in code today; the ambiguity that made two
paths equally defensible is removed.

## Consequences

- Nothing executable changes. This ADR is documentation only.
- The demo keeps producing "8 mapped section(s)" and the baseline stays byte-identical.
- A later slice, gated on its own decision, moves the demo to Path B and then removes Path A.
- Until then, `mapBusinessDiscoveryToBifContext` stays exported and tested. It is not deprecated in
  code, because a deprecation with no available replacement path is just noise.

## Non-goals

No `Draft → Active` promotion. No API/Web exposure. No workspace. No runtime caller for Path B. No
change to any of the four functions involved. No demo change.

## Open questions

1. Where do the demo's `organizationId`, `constructedAt` and `changedBy` come from? (Blocks D3.)
2. Once the demo is on Path B, does the intake summary keep reporting mapped section keys, or does it
   report the scored context's sections and omissions instead? The second is more informative and is
   a visible output change.
3. Is there a caller other than the demo that would want the unscored grouping? None exists today.
