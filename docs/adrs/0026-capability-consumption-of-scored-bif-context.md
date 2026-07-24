# ADR 0026: Capability Consumption of Scored BIF Context

- Status: Accepted
- Date: 2026-07-21

## Acceptance note

ADR-0026 was accepted after PR #81 documented the missing architectural decision for capability
consumption of scored BIF context. The accepted decision ratifies:

- capabilities must not import `@age/bif` or consume the live `BusinessIntelligenceFramework` directly;
- scored BIF context reaches capabilities through a neutral read-only `ScoredBifContext` projection;
- the caller/adapter assembles `ScoredBifContext`;
- the capability output/result contract must support caller-supplied `producedAt` for deterministic flows;
- no separate deterministic result type;
- capability sufficiency/readiness is first-class: `ready`, `partial`, `insufficient`, `blocked`;
- missing sections/fields are limitations, not negative evidence;
- the first implementation slice after acceptance is one existing pure capability consuming `ScoredBifContext`.

This PR only changes the ADR status and records acceptance. No implementation is started.

## Context

AGE can now produce a canonical `Draft` BIF from Business Discovery and score its confidence
deterministically:

```
BusinessDiscoveryProfile → questionnaire validation → discovery completeness + discovery
input confidence → field-level evidence → canonical Draft BIF (PR #75) → BIF root and
section confidence (PR #79)
```

The next approved slice was **pure capability consumption of a scored `Draft` BIF**: prove that one
existing capability can read scored business context without inventing what is missing, mutating
state, or producing confident output from sparse intelligence. Implementation was **stopped before
any code was written** because inspecting the capability packages revealed that the slice cannot be
built without silently deciding three platform-wide questions.

The stop is the point. The sample scored BIF reports `confidenceScore` **17** and
`completenessScore` **12** (10 of 84 defined fields populated, 7 of 12 sections present) from a
discovery interview that itself scored 97 for capture completeness. Every safeguard built in PRs
#74–#79 exists so that gap is visible rather than smoothed over. A capability handed that BIF is
exactly where the discipline either holds or is lost — so the rules governing it should be decided
in the open, not established as a side effect of the first implementation.

### Problem

Three blockers, each an undecided architectural question:

**1. No sanctioned path for a BIF to reach a capability.** ADR-0012 (Accepted) weighed direct import
of `@age/bif` into a capability package and rejected it: a direct dependency "lets an internal
refactor of any engine silently break Market Discovery, and drags engine implementation surface
into a capability that should be pure." Its sanctioned pattern is a neutral contracts package
carrying "reference/address shapes only", with the caller assembling the input contract and passing
it in. ADR-0010, ADR-0014, ADR-0017, ADR-0018 and ADR-0019 establish the same boundary for the other
capabilities, and every capability's source carries the comment "never on SIE, BIF, BKG, or RIE." No
capability package depends on `@age/bif` today. There is therefore no legal route for a scored BIF
to reach a capability, and inventing one touches six accepted ADRs.

**2. Capability outputs are not deterministic.** `CapabilityOutput` assigns
`this.producedAt = new Date()` inside its constructor
(`packages/capability-kit/src/outputs/capability-output.ts`), and `CapabilityOutputItem` carries a
`createdAt: Date`. Every capability result flows through that envelope, so the same scored BIF cannot
produce the same capability result. Determinism is a property the entire Discovery → BIF track has
maintained by refusing to read the clock anywhere; a capability consuming that output would be the
first link to break it.

**3. AGE has no first-class "insufficient context" concept.** ADR-0016's shared disposition contract
models accepted items plus rejected/duplicate dispositions **for inputs**. Nothing expresses
capability readiness, evidence sufficiency, capability-level confidence, or the outcome "the context
was too sparse to conclude anything." Honest degradation on a 17-confidence BIF requires that
concept. Defining it inside an implementation PR would set a platform-wide capability semantic that
all six capabilities inherit, by accident.

### Relationship to existing capability-boundary ADRs

**ADR-0026 does not override ADR-0010, ADR-0012, ADR-0014, ADR-0017, ADR-0018 or ADR-0019.** None of
their statuses change and none of their decisions are reversed. This ADR **extends** them: those ADRs
established that a capability consumes neutral, caller-assembled contract types rather than engine
internals, and left open what such a contract looks like for BIF-derived context now that a BIF can
actually be produced and scored. ADR-0026 defines that sanctioned projection path, in the same shape
those ADRs already prescribe.

---

## Decision

### Decision 1 — Transport boundary: a neutral read-only projection

**Capabilities must not import or consume the live `BusinessIntelligenceFramework` type**, nor
`@age/bif`, directly. A caller or adapter projects the scored `Draft` BIF into a neutral, read-only
capability input contract — proposed name **`ScoredBifContext`** — and passes it in, exactly as
`EvidencePackage` and `MarketDiscoveryInput` are assembled and passed today.

`ScoredBifContext` carries only what a capability needs to reason about supported context and its
limits:

| Carried                                                                   | Purpose                                                              |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `bifId`, `bifStatus`                                                      | Identity and lifecycle state of the source BIF                       |
| `bifConfidenceScore`, `bifCompletenessScore`                              | Root trust and population, as computed by the scoring layer          |
| Section references with per-section `confidenceScore`/`completenessScore` | Which sections exist and how far each can be trusted                 |
| Field references with `source` and `confidence`                           | Whether an individual value can support an insight                   |
| Omitted/missing sections (and missing required fields where known)        | The limits, stated as limits                                         |
| Scoring `warnings` / `reasons`                                            | Why the scores are what they are, so a capability can explain itself |

Constraints on the contract:

- **No mutation APIs.** It is a read-only projection; a capability cannot write back.
- **No full BIF internals.** Reference and score shapes only — not a parallel copy of the BIF domain
  model, per ADR-0012's warning that a contracts package "must not grow into a parallel
  re-implementation of those engines' domain types."
- **No means to create placeholder sections or infer missing data.** Absence is represented as
  absence; there is no writable slot a capability could fill.
- **Assembled by the caller.** The capability does not fetch, resolve or dereference anything.

Where the projection lives (an existing contracts package, a new neutral one, or the
discovery/BIF-adjacent package that already depends on `@age/bif`) is left to the implementation
slice, subject to one rule: **the capability package's dependency set must not gain `@age/bif`.**

### Decision 2 — Deterministic capability output via caller-supplied `producedAt`

**The shared capability output/result contract shall support a caller-supplied `producedAt`** (and,
where applicable, item `createdAt`). Deterministic capability entrypoints receive the timestamp from
their caller and **must not read the wall clock internally**.

**A separate deterministic result type is explicitly rejected.** It would split AGE into two parallel
capability-output systems — one deterministic, one not — and every downstream consumer, registry
entry and test would then have to know which world it is in. Better to amend the shared contract once.

Implementation may be additive so existing callers keep working:

- allow `producedAt` to be passed into `CapabilityOutput` (constructor props, factory, or options);
- keep existing callers compatible temporarily if required;
- mark internally generated wall-clock timestamps as **legacy / non-deterministic**;
- **require new deterministic capability flows to pass `producedAt` explicitly.**

**This ADR is documentation-only. `CapabilityOutput` is not modified by it.**

### Decision 3 — Capability sufficiency / readiness as a first-class outcome

A capability result produced from `ScoredBifContext` **must carry a deterministic sufficiency state**,
drawn from a small closed set:

| State          | Meaning                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `ready`        | Enough scored context exists for the capability to produce its normal read-only insight.                                       |
| `partial`      | Some supported insight can be produced, but important sections or fields are missing or too low-confidence to rely on.         |
| `insufficient` | Context is too sparse or too weak to produce meaningful insight without fabricating something. The capability says so plainly. |
| `blocked`      | Required context is absent, structurally invalid, or violates the capability input contract. Nothing is produced.              |

Rules:

- Thresholds may remain **implementation-defined initially**, but must be **deterministic and
  explainable** — a fixed arithmetic function of the context, never a judgement call.
- The result **must carry reasons/warnings explaining the state**: which sections were missing, which
  confidences were too low, what would raise it.
- The state is **computed, never asserted by the caller**.
- Naming may be adjusted at acceptance if existing repo vocabulary suggests a better fit (for example
  the discovery `readinessBand` wording), provided the four meanings survive.

`insufficient` is deliberately a **successful, informative outcome** — not an error. A capability that
correctly reports "I cannot conclude this from a 12%-populated BIF" has done its job.

### Decision 4 — Non-fabrication rule

**Missing BIF sections and fields are limitations, not negative evidence.**

A capability consuming `ScoredBifContext` **must not**:

- infer missing intelligence;
- treat absence as a conclusion;
- create placeholder sections;
- generate strategy beyond what the populated context supports;
- produce confident output from sparse context;
- hide or restate away a low BIF confidence score;
- convert "unknown" into "bad" or "good".

A capability **may** state:

- what is supported by populated fields (with their provenance);
- what is missing;
- what limits confidence;
- what additional context would improve sufficiency.

That an ICP section is absent means the ICP is **unknown** — not that the business has no ICP, and
not that its ICP is weak. This is the same discipline the mapper and scoring layer already hold, now
extended to the point of use, which is where it is easiest to lose.

### Decision 5 — First implementation slice after this ADR is accepted

A **tiny, pure, package-level proof**: one existing capability consumes a `ScoredBifContext` and
returns a read-only capability result carrying a sufficiency state, supported insights, and stated
limitations.

Boundaries for that later slice:

- **one existing pure capability only**;
- **no direct `@age/bif` dependency in the capability package**;
- no API · no Web · no DB · no persistence;
- no demo-runtime changes unless absolutely necessary;
- no AI · no external calls · no URL fetching;
- no execution · no strategy document generation · no BIF status promotion;
- no SAGE.

Success is not a feature. Success is a capability that, given the 17-confidence sample BIF, returns
`partial` or `insufficient` with honest reasons — and a test proving it invents nothing.

---

## Alternatives considered

| Alternative                                                     | Verdict                   | Reasoning                                                                                                                                                                                                   |
| --------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Direct capability import of `@age/bif`                       | **Rejected**              | Violates the capability boundary ADR-0010/0012/0014/0017/0018/0019 set, and couples pure capabilities to BIF internals that are `@age/bif`'s to evolve. ADR-0012 already weighed and rejected exactly this. |
| 2. Neutral `ScoredBifContext` projection                        | **Accepted (Decision 1)** | Keeps capability packages pure, protects engine internals, and reuses the established neutral-contract pattern rather than inventing a new one.                                                             |
| 3. Separate deterministic result type                           | **Rejected**              | Creates a parallel capability-output system. Two result shapes means every consumer, registry entry and test must know which world it is in — a permanent tax to avoid one additive change.                 |
| 4. Caller-supplied `producedAt` in the shared capability output | **Accepted (Decision 2)** | Fixes determinism once, at the contract level, for every capability — instead of routing around it per capability.                                                                                          |
| 5. Let each capability invent its own readiness semantics       | **Rejected**              | Guarantees inconsistent behaviour and confidence inflation: one capability's "partial" would mean another's "ready", and nothing would be comparable across capabilities.                                   |
| 6. Delay consumption; build API / Web / persistence first       | **Rejected**              | Freezes storage schemas and public interfaces before honest consumption semantics are proven. The first real consumer is exactly what would reveal those shapes are wrong.                                  |

---

## Consequences

**Easier.** A sanctioned, reusable path exists for any capability to read scored business context.
Determinism becomes a property of the shared contract rather than of each capability's discipline.
Sufficiency becomes comparable across capabilities, so "partial" means the same thing everywhere.
The non-fabrication rule that made the BIF trustworthy now extends to the point of use.

**Harder.** Consuming BIF context requires an assembled projection rather than passing the BIF —
one more step, deliberately. `CapabilityOutput` must gain an additive, backward-compatible
`producedAt`, which is a shared-contract change affecting all six capabilities and governed by
ADR-0016. Capability results grow a sufficiency state that consumers must handle, including the case
where the honest answer is "not enough context".

**Accepted cost.** Capabilities consuming sparse BIFs will frequently return `partial` or
`insufficient`. That will look like the platform underperforming. It is the platform being accurate,
and the alternative — confident output from ten fields — is the failure mode this whole track exists
to prevent.

**If this ADR is rejected**, the alternatives are to let capabilities import `@age/bif` directly
(breaking six accepted boundary ADRs), or to let the first implementation slice invent transport,
determinism and sufficiency semantics inline — which is the "silently reinterpret a missing
architectural decision" failure the working conventions forbid.

---

## Implementation guidance

Sequenced; each needs explicit authorization before starting, and **none of it is started by this
document**:

1. **`ScoredBifContext` projection** (Decision 1) — neutral read-only contract plus a pure adapter
   from a scored `Draft` BIF. No capability package changes.
2. **Caller-supplied `producedAt`** (Decision 2) — additive change to `@age/capability-kit`,
   preserving existing callers; new deterministic flows must pass it explicitly.
3. **Sufficiency state** (Decision 3) — the closed set plus deterministic, explainable thresholds and
   reasons.
4. **First consuming capability** (Decision 5) — one existing pure capability, package-level only.

Steps 1–3 may be combined into a single slice if that keeps the diff small; step 4 must be separate,
so the proof is reviewed against a contract that was decided beforehand.

## Non-goals

This ADR does **not**:

- implement `ScoredBifContext`, modify `CapabilityOutput`, or change any capability package;
- change the status or decisions of ADR-0010/0012/0014/0016/0017/0018/0019, or of ADR-0025;
- change any BIF schema, type or enum, or promote a BIF out of `Draft`;
- add API, Web, DB, persistence or demo-runtime surface;
- introduce AI calls, external integrations or URL fetching;
- define BIF status promotion rules (still undecided — a high score does not imply promotability);
- authorize strategy document generation, execution planning or execution-governance work.

## Follow-up work

- Decide **where** the `ScoredBifContext` projection lives, and which package owns the adapter.
- Decide the **sufficiency thresholds** and whether they are per-capability or shared.
- Decide whether item-level `createdAt` follows `producedAt` into caller-supplied form.
- Revisit **BIF status promotion** (ADR-0025 follow-up) once a capability has consumed a scored BIF —
  consumption is what will reveal what `Active` needs to mean.
- Consider whether `ScoredBifContext` should eventually carry BKG/SIE-derived context too, or stay
  BIF-specific.

---

**This document is a proposal only.** Its status is `Proposed`. No code, package, API, Web, DB,
persistence or demo-runtime change is made by it; no other ADR's status is altered;
`ScoredBifContext` is not created, `CapabilityOutput` is not modified, no capability package is
touched, and no implementation is started — pending Product Owner acceptance.
