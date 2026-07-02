# ADR 0011: Intelligence Processing Result and Evidence Disposition

- Status: Accepted
- Date: 2026-07-02

## Context

The Intelligence Capability (EPIC-02) processes incoming evidence through deterministic
validation, structural deduplication, quality scoring, contradiction detection, and freshness
calculation. Not all evidence survives this pipeline: some is rejected (fails validation), some
is a structural duplicate of evidence already accepted, and some is flagged as contradicting
other evidence.

`CapabilityOutput<T>` (`packages/capability-kit/src/outputs/capability-output.ts`) currently
represents only the accepted `items` produced by a capability, addressed to a `clientId`/
`organizationId` under a `Capability`/`ExecutionDomain[]`. It has no concept of rejected,
duplicate, or contradicting records, or of counts describing what happened during processing.

Two options were considered:

1. **Extend `CapabilityOutput<T>` itself** with rejection/duplicate/summary metadata, making it
   generic infrastructure for every capability.
2. **Wrap `CapabilityOutput<T>` in a capability-specific result type** owned by
   `@age/capability-intelligence`, leaving the generic envelope unchanged.

Changing the generic `CapabilityOutput<T>` before a second capability has proven the same need
risks over-fitting shared infrastructure to Intelligence's specific disposition semantics
(rejection reasons, duplicate references, contradiction flags), which may not generalize.

## Decision

Do not modify `CapabilityOutput<T>`. Introduce a capability-specific wrapper owned by
`@age/capability-intelligence`:

```ts
interface IntelligenceResult {
  readonly output: CapabilityOutput<IntelligenceOutputItem>;
  readonly summary: ProcessingSummary;
}

interface ProcessingSummary {
  readonly acceptedCount: number;
  readonly rejectedCount: number;
  readonly duplicateCount: number;
  readonly contradictionCount: number;
  readonly rejectedReasons: readonly RejectedEvidenceReason[];
  readonly duplicateReferences: readonly DuplicateEvidenceReference[];
}

type RejectedEvidenceReasonCode =
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_SOURCE'
  | 'INVALID_SIGNAL_TYPE'
  | 'STALE_BEYOND_THRESHOLD'
  | 'FAILED_SCHEMA_VALIDATION';

interface RejectedEvidenceReason {
  readonly evidenceId: string;
  readonly reasonCode: RejectedEvidenceReasonCode;
  readonly detail: string;
}

interface DuplicateEvidenceReference {
  readonly evidenceId: string;
  readonly duplicateOfEvidenceId: string;
}
```

`output` carries only accepted `IntelligenceOutputItem`s via the unmodified
`CapabilityOutput<T>`, preserving the existing generic contract used across all capabilities.
`summary` is where rejected, duplicate, and contradiction disposition lives, structured enough
to be traceable (counts plus structured reasons/references), never just a discarded count.

Disposition rules:

- `CapabilityOutput<T>.items` contains only **accepted, non-duplicate** evidence output items.
  Rejected and duplicate evidence must never appear in `output.items`.
- A contradiction-flagged record **may still be accepted and emitted** in `output.items`
  (with `isContradiction: true`), unless it is independently rejected for another validation
  reason. Being flagged as a contradiction is not itself grounds for rejection.
- **Invariant:** every rejected or duplicate evidence record must appear **exactly once** across
  `summary.rejectedReasons` / `summary.duplicateReferences` — never zero times (silently
  dropped) and never more than once (double-counted). `acceptedCount + rejectedCount +
duplicateCount` must equal the total number of evidence records processed in the batch, and
  `rejectedReasons.length === rejectedCount`, `duplicateReferences.length === duplicateCount`.
  `contradictionCount` is counted separately since contradiction-flagged records may overlap
  with accepted items rather than being mutually exclusive with them.
- `reasonCode` is a constrained union (`RejectedEvidenceReasonCode`), not an unrestricted
  `string`, so rejection reasons stay enumerable and analyzable. The initial set above covers
  the deterministic validation failures known at ADR time; extending it is a non-breaking
  additive change.

## Consequences

- `CapabilityOutput<T>` remains stable and capability-agnostic; no other capability is forced to
  reason about Intelligence-specific disposition fields.
- Rejected and duplicate evidence is never silently dropped — every non-accepted record is
  traceable to a reason or a duplicate reference in `ProcessingSummary`.
- `@age/capability-intelligence` owns `IntelligenceResult`, `ProcessingSummary`,
  `RejectedEvidenceReason`, and `DuplicateEvidenceReference` as its own exported types; they are
  not part of `@age/capability-kit`.
- If a second capability later needs equivalent disposition tracking, that need — not this
  ADR — is what should justify promoting a shared shape into `@age/capability-kit`.
- Application code consuming Intelligence must unwrap `IntelligenceResult` explicitly rather than
  treating it as a plain `CapabilityOutput<T>`.
