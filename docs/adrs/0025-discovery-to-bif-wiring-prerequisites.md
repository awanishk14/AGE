# ADR 0025: Discovery to BIF Wiring Prerequisites

- Status: Proposed
- Date: 2026-07-20

> **Note on numbering — ADR-0021 through ADR-0024 are deliberately skipped.**
>
> The numerically next free slot is `0021`, but that number, along with `0022`, `0023` and `0024`,
> belonged to the Phase 5 execution-governance ADRs (execution foundation, execution audit
> persistence, approval workflow, and the operator/tenant context boundary). That work was reverted
> with PR #41–#61 and those ADR files no longer exist in the repository — but
> `docs/reviews/AGE_PR41_61_REVERT_PLAN.md` still refers to ADR-0021 through ADR-0024 by their
> original meanings, and so does prior project history.
>
> Reusing any of those numbers would make a reference like "ADR-0021" ambiguous: it would resolve to
> this document in the repository while resolving to reverted execution-governance work in the
> review record. **`0025` is therefore chosen deliberately** as the first number that has never been
> used, so no ADR reference is ambiguous. The gap at 0021–0024 is intentional and records that the
> reverted range is retired, not free for reuse.
>
> ADR-0020 (Branch Flow Governance) is unaffected — it was explicitly kept during the revert and
> remains Accepted.

## Context

Business Discovery is complete as a pure intake domain: contracts (PR #67), questionnaire and
validation (PR #68), sample profile and a **BIF-compatible projection** (PR #69), CLI demo
integration (PR #70), a decision to skip read-only API/Web exposure (PR #71), and completeness plus
discovery-input-confidence scoring (PR #72).

The next slice on the product path is wiring discovery output into the canonical
`@age/bif` model. That slice cannot start, because the canonical model demands four things intake
cannot currently supply honestly. Each was discovered by reading the actual BIF source, not inferred:

1. **Wall-clock `Date`s.** `BusinessIntelligenceFramework` requires `createdAt`, `updatedAt` and
   `lastSyncedAt` as `Date` (`packages/bif/src/core/framework.ts`); `BIFSection` requires
   `lastVerifiedAt`; `BIFField` requires `lastVerifiedAt`, and every `FieldVersion` requires
   `timestamp`. Every pure package in this repo is deterministic and input-derived — Business
   Discovery's own `capturedAt` is a caller-supplied ISO string precisely to avoid reading the clock.

2. **Per-field provenance.** `BIFField` requires `source: FieldSource` and
   `confidence: FieldConfidence` on **every** field, plus `changedBy: string` on every
   `FieldVersion`. Business Discovery can only express provenance at **answer level**, via
   `DiscoveryAnswer.evidenceSourceIds`. Structured profile fields that satisfy questionnaire signals
   directly (via `satisfiedBy`) have nowhere to carry an evidence reference — the KNOWN LIMITATION
   recorded in `completeness-scoring.ts`. There is also no actor identity anywhere in discovery to
   populate `changedBy`.

3. **Score semantics.** PR #72 produced `completenessScore` and `discoveryConfidenceScore`, both
   0–100. BIF has numeric `confidenceScore` / `completenessScore` at root and section level — but
   `FieldConfidence` is an **enum** (`USER_CONFIRMED` / `EVIDENCE_VERIFIED` / `AI_INFERRED`), not a
   number. The two models therefore do not line up field-for-field, and the _meaning_ of "confidence"
   differs: discovery measures how well-sourced the captured input is, while BIF's confidence
   describes trust in the business intelligence itself.

4. **Missing submodels.** The BIF-compatible projection covers 8 grouping keys. `SectionType` defines
   **12**: discovery has no source whatsoever for `vision_strategy`, `marketing_intelligence`,
   `technology_stack` or `kpis`.

Deciding these ad hoc during implementation is exactly the "silently reinterpret a missing
architectural decision" failure the working conventions forbid. Hence this ADR.

## Decision Drivers

- **No fabricated data.** The entire Business Discovery track has refused to invent numbers or
  provenance; PR #69 deferred BIF construction for this reason, and PR #72 was refined twice
  specifically to stop nominal evidence from inflating a score. Wiring must not undo that.
- **Determinism.** Pure `@age/*` packages produce identical output for identical input. No wall-clock,
  no randomness.
- **BIF is consumed, not modified.** Established across the slice plan and PR #69's boundary note.
  `@age/bif` currently has **no** runtime consumer that constructs a root; changing it is a much
  larger decision than wiring one producer into it.
- **Small, reviewable slices** that keep CI green and the demo side-effect-free.
- **Provenance is BIF's core value.** `BIFField` exists to carry source, confidence and history. A BIF
  populated with wrong provenance is worse than no BIF, because history is append-only and
  mislabelled origins propagate into every downstream capability.
- **Roadmap position.** `AGE_IMPLEMENTATION_RESTART_CHECKPOINT.md` frames the path as
  Discovery → BIF → Intelligence; BIF population is the gate for capabilities reading real context
  instead of fixtures.

## Decision 1 — Date determinism

### Options considered

| Option                                                                 | Assessment                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Keep `Date` in BIF; require caller-provided deterministic dates** | No change to `@age/bif`. Matches the existing convention exactly (`capturedAt` is already a caller-supplied ISO string). Mapper stays pure and unit-testable. Cost: every construction site must pass a timestamp explicitly. |
| B. Change BIF root fields to ISO strings                               | Modifies `@age/bif`, which this track has consistently treated as consumed-not-modified, and would touch four other packages that already import it. A large blast radius to serve one new producer.                          |
| C. Allow wall-clock construction in the wiring layer                   | Makes the mapper non-deterministic and its tests time-dependent — the exact property every other pure package guarantees. Rejected.                                                                                           |
| D. Static fixture dates only for demos                                 | Works for the demo and nothing else; pushes the real decision into the first production caller. Rejected as a non-decision.                                                                                                   |

### Proposed decision

**Option A.** The Discovery → BIF mapper takes an explicit caller-supplied timestamp
(`constructedAt: Date`, or an injected clock function) as a required parameter. Pure package code
never reads wall-clock time. Where a natural input-derived value exists — notably
`profile.capturedAt` — it seeds the corresponding BIF timestamps rather than introducing a second
notion of "now". Demos and tests pass a fixed date; only an outermost non-pure caller (an app, never
a package) may obtain a real clock reading and pass it in.

## Decision 2 — Field-level provenance

### Options considered

| Option                                                                             | Assessment                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Add field-level evidence references to Business Discovery structured fields** | Fixes the root cause. Lets a genuinely evidence-backed structured field map to `EVIDENCE_VERIFIED` instead of being silently downgraded. Cost: a contract change to `@age/business-discovery-contracts` and its own slice. |
| B. Derive field provenance only from answer-level evidence                         | Covers a small minority of data. Most of the sample profile is captured as structured fields, not answers, so nearly every BIF field would carry no evidence — while the data itself may be well-sourced.                  |
| C. Mark BIF fields as partial/unknown provenance where evidence is absent          | Not expressible: `FieldSource` and `FieldConfidence` are closed enums with no `UNKNOWN` member, so this option requires modifying `@age/bif` after all.                                                                    |
| D. Delay BIF wiring until field-level provenance exists                            | Correct instinct, but stated as an indefinite block rather than a plan.                                                                                                                                                    |

### Proposed decision

**Option A, sequenced as a prerequisite slice before any BIF construction.** Business Discovery gains
field-level evidence references so provenance can be expressed where the data actually lives.

Two rules make the mapping honest and total:

- **Default when no reference exists:** `FieldSource.USER` with `FieldConfidence.USER_CONFIRMED`.
  Client-stated intake genuinely _is_ user-provided; this is accurate, not a placeholder.
- **Upgrade only on a real citation**, mapping `EvidenceSourceKind` → `FieldSource`:
  `client-statement` → `USER`, `document` → `DOCUMENT`, `url` → `WEBSITE`; and only a cited field may
  claim `FieldConfidence.EVIDENCE_VERIFIED`. `AI_INFERRED` is **never** emitted by discovery, which
  performs no inference.

`changedBy` has no discovery source and must not be invented. It requires a caller-supplied actor
identity on the same footing as the timestamp in Decision 1 — supplied by the outermost caller, never
defaulted to a fabricated string.

## Decision 3 — Confidence and completeness mapping

### Options considered

| Option                                                                               | Assessment                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Map both discovery scores directly into BIF root scores                           | Conflates two different meanings. `discoveryConfidenceScore` measures sourcing quality of _intake_; BIF `confidenceScore` describes trust in the _intelligence_. PR #72 deliberately named the field `discoveryConfidenceScore` to prevent exactly this. |
| **B. Map completeness directly; keep discovery confidence as input confidence only** | `completenessScore` means the same thing in both models ("how much is populated"), so it transfers honestly. Confidence does not, and is withheld.                                                                                                       |
| C. Create separate BIF metadata for discovery input confidence                       | Requires modifying `@age/bif`, against the consumed-not-modified driver, and pre-commits the canonical model to an intake-specific concept.                                                                                                              |
| D. Require a later BIF scoring layer                                                 | Right for confidence, insufficient alone — it says nothing about completeness, which is ready today.                                                                                                                                                     |

### Proposed decision

**Option B, with D as its sequenced follow-up.** `completenessScore` maps directly to BIF root and
section completeness. `discoveryConfidenceScore` is **not** written into any BIF confidence field; it
travels alongside the BIF as intake metadata in the wiring result, retaining its name.

Because BIF's root `confidenceScore` is a required number, and no honest value for it exists before a
BIF scoring layer: the first wiring emits `BIFStatus.Draft` and a documented conservative value, and
**must not** derive that value from `discoveryConfidenceScore`. Populating it properly is the job of
a dedicated BIF scoring layer — a distinct, later slice with its own ADR if the rule is non-obvious.

## Decision 4 — Partial BIF construction

### Options considered

| Option                                                               | Assessment                                                                                                                                                                                                   |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A. Full canonical BIF                                                | Impossible without fabrication: 4 of 12 section types have no discovery source.                                                                                                                              |
| B. Partial BIF-compatible projection only                            | This is what already exists (PR #69). Repeating it advances nothing.                                                                                                                                         |
| **C. Partial BIF with explicitly omitted sections, `status: Draft`** | The canonical model already anticipates incompleteness — `BIFStatus.Draft` exists for precisely this. Produces a real, typed `BusinessIntelligenceFramework` that downstream capabilities can consume today. |
| D. No BIF until all submodels complete                               | Blocks indefinitely on data AGE does not collect at intake (`technology_stack`, `kpis`) and that later capabilities are meant to supply.                                                                     |

### Proposed decision

**Option C.** The first wiring constructs a real `BusinessIntelligenceFramework` with
`status: BIFStatus.Draft`, containing only the sections discovery can genuinely populate. Sections
with no discovery source are **omitted, never emitted with placeholder values**. `SectionCompleteness`
and `missingFields` carry what is absent, so the gap is visible in the model rather than hidden.

## Consequences

**Easier.** Downstream capabilities can consume a typed canonical BIF instead of fixtures. Provenance
is expressible where the data lives. Scores mean one thing each. Determinism and testability survive
into the wiring layer. `@age/bif` remains unmodified, so its four existing importers are unaffected.

**Harder / accepted costs.** Wiring is gated behind a field-level-provenance slice, so it lands later.
Every construction site must thread a timestamp and an actor identity. A `Draft` BIF is not a
finished one — consumers must handle omitted sections. BIF root `confidenceScore` stays provisional
until a BIF scoring layer exists. The prerequisite slice is a breaking-ish contract addition to
`@age/business-discovery-contracts` (additive and optional if designed carefully).

**If this ADR is rejected**, the alternative is fabricating provenance and confidence at wiring time —
which would silently corrupt an append-only, versioned model.

## Non-goals

Not decided here, and explicitly out of scope: modifying `@age/bif` in any way · the BIF scoring layer
itself · persistence of a BIF · any API, Web, DB or demo surface · strategy generation, opportunity
scoring or execution planning · execution-governance work of any kind · autonomous execution · SAGE,
which is a separate product in its own repository · touching `develop`.

## Implementation guardrails

For the slices this ADR enables:

- Pure packages only; no wall-clock, no randomness, no I/O, no AI/LLM, no network. Evidence locators
  stay references and are never fetched.
- No `FieldConfidence.AI_INFERRED` and no `FieldSource.AI_INFERRED` emitted by discovery.
- No placeholder values for absent data — omit the section or field instead.
- `changedBy` and timestamps are caller-supplied; never defaulted, never invented.
- Inputs validated at the boundary and never mutated; results deterministic and unit-tested with
  pinned values.
- Each slice keeps `pnpm lint/typecheck/test/build` and `smoke:demo` green, and adds no API/Web/DB
  surface without its own decision.
- `@age/bif` stays untouched; if a slice appears to require changing it, stop and raise a new ADR.

## Follow-up slices enabled by this ADR

Sequenced; each needs explicit authorization before starting:

1. **Field-level evidence references in `@age/business-discovery-contracts`** (Decision 2) — additive
   contract change plus scoring update, so structured fields can carry provenance. Lifts the KNOWN
   LIMITATION recorded in `completeness-scoring.ts`.
2. **Discovery → BIF mapper** (Decisions 1, 3, 4) — pure, caller-supplied timestamp and actor,
   producing a `Draft` partial BIF with completeness mapped and confidence withheld.
3. **BIF scoring layer** (Decision 3 follow-up) — computes root and section `confidenceScore` from
   field-level provenance, replacing the provisional value.
4. **Capability consumption of a real BIF** — the point of the whole exercise: capabilities read
   captured business context instead of fixtures.

---

**This document is a proposal only.** No code, package, API, Web, DB, persistence or ADR-status
changes are made by it, no other ADR's status is altered, and no implementation is started — pending
Product Owner acceptance before slice 1 begins.
