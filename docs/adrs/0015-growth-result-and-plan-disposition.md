# ADR 0015: Growth Result and Plan Disposition

- Status: Proposed
- Date: 2026-07-03

## Context

The Growth Capability (EPIC-04) derives growth plan candidates from its input contract, then
deterministically validates, structurally deduplicates, and scores them. As with evidence
(EPIC-02) and opportunities (EPIC-03), not every candidate survives: some are rejected (fail
validation) and some are structural duplicates of a candidate already accepted. If those are
silently dropped, the caller cannot tell whether a candidate was never derived, was rejected, or
was merged as a duplicate — the traceability gap ADR-0011/0013 closed.

`CapabilityOutput<T>` (`packages/capability-kit/src/outputs/capability-output.ts`) represents only
the accepted `items` a capability produces. It has no concept of rejected or duplicate candidates,
or of counts describing what happened during processing.

Two options were considered (identical in shape to ADR-0011/0013):

1. **Extend `CapabilityOutput<T>`** with rejection/duplicate/summary metadata, making it generic
   infrastructure for every capability.
2. **Wrap `CapabilityOutput<T>`** in a capability-specific result owned by `@age/capability-growth`,
   leaving the generic envelope unchanged.

Changing the generic envelope before the need is broadly proven risks over-fitting shared
infrastructure. Intelligence (ADR-0011) and Market Discovery (ADR-0013) both chose option 2. Growth
is the third capability with the same disposition need. Even so, per ADR-0013's own reasoning, the
recurrence that would justify promoting a shared disposition contract into `@age/capability-kit`
is a decision to weigh explicitly (see Consequences) — not something this ADR forces.

## Decision

Do not modify `CapabilityOutput<T>`. Introduce a capability-specific wrapper owned by
`@age/capability-growth`, mirroring ADR-0013:

```ts
interface GrowthResult {
  readonly output: CapabilityOutput<GrowthPlanItem>;
  readonly summary: GrowthProcessingSummary;
}

interface GrowthProcessingSummary {
  readonly acceptedCount: number;
  readonly rejectedCount: number;
  readonly duplicateCount: number;
  readonly rejectedReasons: readonly RejectedGrowthReason[];
  readonly duplicateReferences: readonly DuplicateGrowthReference[];
}

type RejectedGrowthReasonCode =
  | 'MISSING_ID'
  | 'EMPTY_PLAN_TARGET'
  | 'NO_EXECUTION_DOMAIN'
  | 'NO_SOURCE_REF'
  | 'INVALID_IMPACT'
  | 'INVALID_EFFORT'
  | 'INVALID_CONFIDENCE';

interface RejectedGrowthReason {
  readonly planId: string;
  readonly reasonCode: RejectedGrowthReasonCode;
  readonly detail: string;
}

interface DuplicateGrowthReference {
  readonly planId: string;
  readonly duplicateOfPlanId: string;
}
```

`output` carries only accepted, non-duplicate `GrowthPlanItem`s via the unmodified
`CapabilityOutput<T>`. `summary` carries the disposition of everything processed.

`RejectedGrowthReasonCode` **must** be a constrained union (or enum), never a free-form string.
The codes above are illustrative only; the final set is fixed during EPIC-04 implementation and
**must contain only codes that a validation rule actually implemented and tested produces** — no
speculative or unused codes (exactly as EPIC-02/03 constrained their reason codes). No code
branches on `detail`.

Scoring/prioritization determinism: `GrowthPlanItem`'s score/priority fields (e.g. impact, effort,
confidence, priority) **must be deterministic and computed only from fields explicitly present in
the input contract** (`GrowthInput` / `GrowthPlanningInputItem` / `MarketOpportunityReference` /
`GrowthPlanSourceRef`). No hidden heuristics, no clock reads (any time-dependent term takes a
caller-supplied timestamp), and the same input must always yield the same score. Scoring logic must
be transparent and boundary-tested.

Source-reliability weighting remains **deferred** (carried forward from EPIC-02/03): no source-tier
ranking may be introduced into Growth scoring unless a dedicated future product/architecture ADR
defines the ranking. Until then, scoring uses only the explicit input fields above.

Disposition rules (mirroring ADR-0013):

- `CapabilityOutput<T>.items` contains only **accepted, non-duplicate** plan items.
- **Invariant:** every rejected or duplicate plan candidate appears **exactly once** across
  `rejectedReasons` / `duplicateReferences` — never zero times (silently dropped) and never more
  than once. `acceptedCount + rejectedCount + duplicateCount` equals the total number of plan
  candidates processed, and `rejectedReasons.length === rejectedCount`,
  `duplicateReferences.length === duplicateCount`.

There is **no contradiction concept** — contradiction detection is specific to evidence
truth-quality (ADR-0011) and is not part of growth plan generation, unless a future ADR explicitly
introduces one.

Execution boundary: Growth produces **plan candidates only** (decision objects). It must never
create campaigns, configure ad accounts, publish landing pages, make live website changes, schedule
tasks, call external APIs, or own channel-specific engine logic. `GrowthPlanItem.executionDomains`
are opaque structural tags, never interpreted as execution instructions.

## Consequences

- `CapabilityOutput<T>` remains stable and capability-agnostic; no other capability is forced to
  reason about Growth-specific disposition fields.
- Rejected and duplicate plan candidates are never silently dropped — each is traceable to a reason
  or a duplicate reference.
- `@age/capability-growth` owns `GrowthResult`, `GrowthProcessingSummary`, and the
  rejection/duplicate types; they are not part of `@age/capability-kit`.
- This is now the **third** capability (Intelligence, Market Discovery, Growth) with a parallel
  result/summary wrapper. That recurrence is a concrete signal: a future ADR should evaluate
  promoting a shared disposition contract (e.g. a generic `ProcessingSummary<TReasonCode>`) into
  `@age/capability-kit`. This ADR does **not** perform that promotion — it keeps Growth consistent
  with the established per-capability pattern and defers the consolidation decision to its own ADR,
  so EPIC-04 introduces no change to the generic envelope.
- This adoption is **final for EPIC-04**: Growth returns `GrowthResult { output, summary }`, never a
  bare `CapabilityOutput<GrowthPlanItem>`. Plan disposition tracking is a required, non-optional
  part of the capability.
