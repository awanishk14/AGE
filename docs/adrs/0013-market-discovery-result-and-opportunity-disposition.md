# ADR 0013: Market Discovery Result and Opportunity Disposition

- Status: Accepted
- Date: 2026-07-02

## Context

The Market Discovery Capability (EPIC-03) derives opportunity candidates from its input contract,
then deterministically validates, structurally deduplicates, and scores them. As with evidence in
EPIC-02, not every candidate survives: some are rejected (fail validation), and some are
structural duplicates of a candidate already accepted. If those are silently dropped, the caller
cannot tell whether a candidate was never derived, was rejected, or was merged as a duplicate —
the same traceability gap ADR-0011 closed for evidence.

`CapabilityOutput<T>` (`packages/capability-kit/src/outputs/capability-output.ts`) represents only
the accepted `items` a capability produces. It has no concept of rejected or duplicate candidates,
or of counts describing what happened during processing.

Two options were considered (identical in shape to the ADR-0011 decision):

1. **Extend `CapabilityOutput<T>`** with rejection/duplicate/summary metadata, making it generic
   infrastructure for every capability.
2. **Wrap `CapabilityOutput<T>`** in a capability-specific result owned by
   `@age/capability-market-discovery`, leaving the generic envelope unchanged.

Changing the generic envelope before multiple capabilities have proven an identical need risks
over-fitting shared infrastructure. EPIC-02 already chose option 2 for Intelligence; Market
Discovery is the second capability with the same disposition need, but a single second instance is
not yet sufficient justification to promote the shape into `@age/capability-kit`.

## Decision

Do not modify `CapabilityOutput<T>`. Introduce a capability-specific wrapper owned by
`@age/capability-market-discovery`, mirroring ADR-0011:

```ts
interface MarketDiscoveryResult {
  readonly output: CapabilityOutput<MarketDiscoveryOpportunityItem>;
  readonly summary: OpportunityProcessingSummary;
}

interface OpportunityProcessingSummary {
  readonly acceptedCount: number;
  readonly rejectedCount: number;
  readonly duplicateCount: number;
  readonly rejectedReasons: readonly RejectedOpportunityReason[];
  readonly duplicateReferences: readonly DuplicateOpportunityReference[];
}

type RejectedOpportunityReasonCode =
  'MISSING_ID' | 'NO_SOURCE_REF' | 'INVALID_IMPACT' | 'INVALID_CONFIDENCE' | 'NO_EXECUTION_DOMAIN';

interface RejectedOpportunityReason {
  readonly opportunityId: string;
  readonly reasonCode: RejectedOpportunityReasonCode;
  readonly detail: string;
}

interface DuplicateOpportunityReference {
  readonly opportunityId: string;
  readonly duplicateOfOpportunityId: string;
}
```

`output` carries only accepted, non-duplicate `MarketDiscoveryOpportunityItem`s via the unmodified
`CapabilityOutput<T>`. `summary` carries the disposition of everything processed.

`RejectedOpportunityReasonCode` **must** be a constrained union (or enum), never a free-form
string. The codes above are illustrative only; the final set is fixed during EPIC-03
implementation and **must contain only codes that a validation rule actually implemented and
tested produces** — no speculative or unused codes (exactly as EPIC-02 constrained
`RejectedEvidenceReasonCode`). No code branches on `detail`.

Scoring/prioritization determinism: `MarketDiscoveryOpportunityItem`'s priority/score fields
(e.g. impact, confidence, priority) **must be deterministic and computed only from fields
explicitly present in the input contract** (`MarketDiscoveryInput` / `MarketSignal` /
`MarketOpportunitySourceRef`). No hidden heuristics, no clock reads (any time-dependent term takes
a caller-supplied timestamp), and the same input must always yield the same score. Scoring logic
must be transparent and boundary-tested.

Source-reliability weighting remains **deferred** (carried forward from EPIC-02): no source-tier
ranking across evidence/signal sources may be introduced into Market Discovery scoring unless a
dedicated future product/architecture ADR defines the ranking. Until then, scoring uses only the
explicit input fields above.

Disposition rules (mirroring ADR-0011):

- `CapabilityOutput<T>.items` contains only **accepted, non-duplicate** opportunity items.
- **Invariant:** every rejected or duplicate opportunity appears **exactly once** across
  `rejectedReasons` / `duplicateReferences` — never zero times (silently dropped) and never more
  than once. `acceptedCount + rejectedCount + duplicateCount` equals the total number of
  opportunity candidates processed, and `rejectedReasons.length === rejectedCount`,
  `duplicateReferences.length === duplicateCount`.

Unlike ADR-0011, this summary has **no contradiction concept** — contradiction detection is
specific to evidence truth-quality and is not part of opportunity identification.

## Consequences

- `CapabilityOutput<T>` remains stable and capability-agnostic; no other capability is forced to
  reason about Market Discovery-specific disposition fields.
- Rejected and duplicate opportunity candidates are never silently dropped — each is traceable to
  a reason or a duplicate reference.
- `@age/capability-market-discovery` owns `MarketDiscoveryResult`, `OpportunityProcessingSummary`,
  and the rejection/duplicate types; they are not part of `@age/capability-kit`.
- Intelligence (ADR-0011) and Market Discovery now both define parallel result/summary wrappers.
  If a **third** capability needs the same shape, that recurrence — not this ADR — is what should
  justify promoting a shared disposition contract into `@age/capability-kit`. Until then the minor
  duplication is the accepted cost of keeping the generic envelope stable.
- This adoption is **final for EPIC-03**: Market Discovery returns `MarketDiscoveryResult { output,
summary }`, never a bare `CapabilityOutput<MarketDiscoveryOpportunityItem>`. Opportunity
  disposition tracking is a required, non-optional part of the capability.
