# ADR 0016: Shared Capability Disposition Contract

- Status: Proposed
- Date: 2026-07-03

## Context

Three canonical capabilities now hand-roll the same result/summary disposition wrapper:

- Intelligence — `IntelligenceResult { output, summary }`, summary interface `ProcessingSummary`
  (ADR-0011).
- Market Discovery — `MarketDiscoveryResult { output, summary }`, summary
  `OpportunityProcessingSummary` (ADR-0013).
- Growth — `GrowthResult { output, summary }`, summary `GrowthProcessingSummary` (ADR-0015).

Each `summary` is the same five-field shape — `acceptedCount`, `rejectedCount`, `duplicateCount`,
`rejectedReasons[]`, `duplicateReferences[]` — differing only in:

- the capability-specific rejected-reason type (`RejectedEvidenceReason` / `RejectedOpportunityReason`
  / `RejectedGrowthReason`, each with its own id field: `evidenceId` / `opportunityId` / `planId`,
  and its own reason-code union),
- the capability-specific duplicate-reference type (`DuplicateEvidenceReference` /
  `DuplicateOpportunityReference` / `DuplicateGrowthReference`, each with its own id fields),
- Intelligence's one extra field, `contradictionCount: number`.

ADR-0011, ADR-0013, and ADR-0015 each explicitly deferred consolidation, noting that a recurrence
would justify promoting a shared disposition contract into `@age/capability-kit`. That recurrence
has now happened three times identically. Building the next capability (Authority) with a fourth
local wrapper would duplicate a known-shared pattern and turn the eventual consolidation into a
four-way migration. The Capability Kit's charter is precisely to guarantee "consistent contracts
and output envelopes" (CAPABILITY_ARCHITECTURE §5).

This is the lowest-cost moment to consolidate — at three, before a fourth exists.

## Decision

Introduce shared, generic disposition/result types in `@age/capability-kit`, **beside** the
existing `CapabilityOutput<T>` class, and migrate the three capabilities to use them. The migration
is strictly **behavior-preserving**.

### 1. Shared generic types (new, in `@age/capability-kit`)

Generic over the capability-specific rejected/duplicate **reference types** — not over a
reason-code string, and with **no neutral id-field rename**:

```ts
export interface ProcessingSummary<TRejectedReason, TDuplicateReference> {
  readonly acceptedCount: number;
  readonly rejectedCount: number;
  readonly duplicateCount: number;
  readonly rejectedReasons: readonly TRejectedReason[];
  readonly duplicateReferences: readonly TDuplicateReference[];
}

export interface CapabilityResult<TItem extends CapabilityOutputItem, TSummary> {
  readonly output: CapabilityOutput<TItem>;
  readonly summary: TSummary;
}
```

Because the summary is generic over the reason/reference **types**, each capability keeps its exact
current public reason/reference shapes — including their id fields (`evidenceId` / `opportunityId`
/ `planId`) and their `duplicateOf*Id` fields — unchanged.

### 2. `CapabilityOutput<T>` is unchanged

The `CapabilityOutput<T>` class (`packages/capability-kit/src/outputs/capability-output.ts`) is not
modified in any way. Its constructor is unchanged, and `CapabilityOutput.producedAt` (the wall-clock
timestamp) is unchanged. Consolidation touches only the summary/result **wrapper** types, which are
new sibling types.

### 3. Each capability migrates by re-expressing its wrapper as the shared generic

Behavior-preserving type aliases; existing public names are preserved where possible:

- Market Discovery:
  ```ts
  export type OpportunityProcessingSummary = ProcessingSummary<
    RejectedOpportunityReason,
    DuplicateOpportunityReference
  >;
  export type MarketDiscoveryResult = CapabilityResult<
    MarketDiscoveryOpportunityItem,
    OpportunityProcessingSummary
  >;
  ```
- Growth:
  ```ts
  export type GrowthProcessingSummary = ProcessingSummary<
    RejectedGrowthReason,
    DuplicateGrowthReference
  >;
  export type GrowthResult = CapabilityResult<GrowthPlanItem, GrowthProcessingSummary>;
  ```

`RejectedOpportunityReason`, `DuplicateOpportunityReference`, `RejectedGrowthReason`,
`DuplicateGrowthReference`, and every reason-code union remain **capability-owned and unchanged**.

### 4. Intelligence contradiction metadata stays Intelligence-specific

Intelligence's summary carries one field the others do not — `contradictionCount: number` (the only
contradiction field that exists in the codebase today; there is no `contradictionReferences` type).
It is kept as an Intelligence-specific extension of the shared generic, not baked into it:

```ts
export type IntelligenceProcessingSummary = ProcessingSummary<
  RejectedEvidenceReason,
  DuplicateEvidenceReference
> & {
  readonly contradictionCount: number;
};
export type IntelligenceResult = CapabilityResult<
  IntelligenceOutputItem,
  IntelligenceProcessingSummary
>;
```

**One necessary type-name change:** Intelligence's current summary interface is literally named
`ProcessingSummary`, which now collides with the shared generic `ProcessingSummary<...>`. Intelligence's
extended summary is therefore renamed to `IntelligenceProcessingSummary`. This is a summary
**type-name** change only — it does **not** rename any id field (`evidenceId` stays), any reason-code
union, or any reason/reference shape. It is the single unavoidable public-name adjustment; all other
public shapes across the three capabilities are preserved verbatim.

### 5. Scope guards (explicit)

- No neutral `itemId` rename; `evidenceId` / `opportunityId` / `planId` are preserved.
- No change to any reason-code union (they remain capability-owned).
- No change to any validation rule, scoring logic, pipeline behavior, or output-item shape.
- No change to accounting invariants — they continue to hold and remain tested.
- No persistence, orchestration, AI/LLM, embeddings, semantic matching, or source-reliability
  weighting.
- Source-reliability weighting remains deferred (carried forward from EPIC-02/03/04).

### 6. Authority waits

Authority (EPIC-06) does not begin until this consolidation is complete, so it adopts the shared
`ProcessingSummary` / `CapabilityResult` from inception rather than adding a fourth local wrapper.

## Consequences

- `@age/capability-kit` becomes the single home of the disposition/result contract, fulfilling its
  §5 charter; new capabilities inherit it instead of re-deriving it.
- `CapabilityOutput<T>` and `producedAt` are untouched, so the class's stability guarantee (held
  since ADR-0011) is preserved; only additive sibling types are introduced.
- Because the generic is parameterized over reference **types**, consolidation is achieved with
  zero id-field churn — the migration is behavior-preserving and low-risk, and every existing
  capability test should pass with at most the Intelligence summary type-name adjustment.
- Intelligence's contradiction concept stays isolated to Intelligence; the shared generic remains
  minimal and does not leak evidence-specific semantics into Market Discovery / Growth / Authority.
- The migration touches shared infrastructure and three merged capabilities; it must be executed as
  small, per-capability, behavior-preserving commits (proposed T22–T26) with full monorepo CI green
  at each step, and is gated on this ADR's acceptance.
- ADR-0011/0013/0015's "deferred consolidation" notes are resolved by this ADR.
