# ADR-0026 Implementation Complete — Milestone Checkpoint

> Documentation-only checkpoint. Records the state reached at `main` @
> `f697705343224d860e82625d237c4739c97b06dd` (PR #86 merged, main CI green).
> **No code, package, ADR-status or configuration change accompanies this document.**

| Field         | Value                                                                  |
| ------------- | ---------------------------------------------------------------------- |
| Date          | 2026-07-24                                                             |
| Base commit   | `f697705343224d860e82625d237c4739c97b06dd`                             |
| Branch        | `docs/adr0026-completion-checkpoint`                                   |
| Scope         | Documentation only                                                     |
| PR sequence   | #81 → #86 (ADR proposed, accepted, three contracts, one consumer)      |
| Governing ADR | ADR-0026 — Capability Consumption of Scored BIF Context (**Accepted**) |

---

## 1. Milestone summary

**A capability can now read scored business context, say how far that context carries it, and say
what it does not know — without ever seeing a BIF, reading a clock, or inventing a conclusion.**

ADR-0026 existed because the previous milestone stopped rather than guess. The BIF scoring layer
(PR #79) produced a scored `Draft` BIF that nothing could consume: there was no sanctioned path from
BIF to capability, capability output was non-deterministic, and the platform had no way to express
"I do not have enough context". Those were three platform-wide decisions, so no code was written
until they were made.

All five ADR-0026 decisions are now implemented:

| Decision | What it settled                                                                               | Delivered                          |
| -------- | --------------------------------------------------------------------------------------------- | ---------------------------------- |
| **1**    | Neutral read-only `ScoredBifContext` projection, assembled by the caller                      | PR #83                             |
| **2**    | Caller-supplied `producedAt` on the shared output contract                                    | PR #84                             |
| **3**    | First-class sufficiency: `ready \| partial \| insufficient \| blocked` with mandatory reasons | PR #85                             |
| **4**    | Non-fabrication — missing sections are limitations, never negative evidence                   | enforced by tests in #83, #85, #86 |
| **5**    | Exactly one existing pure capability consumes the projection                                  | PR #86                             |

The end-to-end deterministic flow now standing on `main`:

```
BusinessDiscoveryProfile                    (#67 — contracts, Zod-validated)
        │
        ▼
Validate questionnaire / profile            (#68)
        │
        ▼
Discovery completeness + input confidence   (#72)
        │
        ▼
Field-level evidence attached               (#74)
        │
        ▼
Canonical Draft BIF                         (#75 — mapBusinessDiscoveryToBifDraft)
        │
        ▼
BIF root + section confidence computed      (#79 — scoreBusinessIntelligenceFramework)
        │
        ▼
Neutral ScoredBifContext projection         (#83 — projectScoredBifContext)
        │                                          assembled by the caller, never by the capability
        ▼
Capability assessment + sufficiency state   (#86 — assessScoredBifContext)
```

Every step is pure, deterministic and input-derived. No step reads a clock, invents an actor,
fabricates a value, or performs I/O.

---

## 2. What each slice added

### PR #83 — `ScoredBifContext` (Decision 1)

A read-only projection living in `packages/business-discovery-contracts` — the package that already
legitimately depends on `@age/bif`. `SCORED_BIF_CONTEXT_VERSION = '1.0.0'`;
`projectScoredBifContext(bif, options)` produces present sections with their scores and fields,
explicitly listed omitted sections, and root metadata.

The point is what it does **not** carry: no `BusinessIntelligenceFramework`, no BIF enums as types,
no mutation handle, no placeholder for an absent section. A capability that holds one cannot reach
the BIF through it.

### PR #84 — caller-supplied `producedAt` (Decision 2)

`CapabilityOutput.producedAt?: Date`. The alternative — a parallel deterministic result type — was
rejected: two result shapes would have split every downstream consumer. Legacy callers that omit it
still get `new Date()`, so nothing broke; new deterministic callers supply it and the clock is never
read.

### PR #85 — the sufficiency contract (Decision 3)

`CapabilitySufficiencyState` (`ready`/`partial`/`insufficient`/`blocked`), `CapabilitySufficiency`,
`createCapabilitySufficiency`, and `CapabilityOutput.sufficiency?: CapabilitySufficiency`.

Two properties are load-bearing:

- **Reasons are mandatory at compile time.** `CapabilitySufficiencyReasons = readonly [string, ...string[]]`
  — a non-empty tuple. A state with no reason does not typecheck. There is no way to report
  `insufficient` without saying why.
- **Omitted sufficiency stays `undefined`, and never defaults to `ready`.** `undefined` means legacy
  or not reported; `ready` means explicitly assessed and supplied. Silently defaulting would have
  manufactured confidence the platform never earned, which is precisely what Decision 4 forbids.

### PR #86 — the consumer (Decision 5)

`packages/capabilities/intelligence` gained a read-only, deterministic assessment:

```
assessScoredBifContext(context, scoredBifContext, { producedAt })
  → CapabilityResult<BusinessContextSupportItem, BusinessContextAssessmentSummary>
```

reachable as `IntelligenceCapability.assessBusinessContext(...)`.

**Why Intelligence.** Every other capability (Market Discovery, Growth, Authority, Operations,
Revenue) derives plan candidates — strategy generation, which this slice excludes. Intelligence's
charter is already _assessing intelligence quality_: it validates, deduplicates and scores evidence
before it becomes business truth. Assessing how far a scored BIF context carries the platform is the
same work on the other side of the BIF, so no new capability and no new charter was invented.

**The state machine** (`BUSINESS_CONTEXT_ASSESSMENT_VERSION = '1.0.0'`):

| State          | Condition                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `blocked`      | `sections` not an array, `contextVersion` major ≠ 1, or zero populated fields — nothing to assess                         |
| `ready`        | every present section clears both section thresholds **and** no canonical section is omitted **and** root confidence ≥ 70 |
| `partial`      | at least one section clears both thresholds, but something else does not                                                  |
| `insufficient` | sections exist, none clears the thresholds — a normal `return`, never a throw                                             |

`blocked` and `insufficient` are distinct by construction and separately tested: blocked means
"nothing to assess"; insufficient means "assessed, and the honest answer is that nothing here can be
relied on".

**Thresholds** are `{ minSectionConfidenceScore: 50, minSectionCompletenessScore: 50,
minRootConfidenceScoreForReady: 70 }` — three integers, applied by plain comparison, owned by this
capability alone, and echoed into every summary so a consumer can see exactly what "supported" meant
for a given run. See §5 for why they were not promoted to a shared package.

---

## 3. The honesty proof

ADR-0026 set the bar for Decision 5 explicitly:

> Success is not a feature. Success is a capability that, given the 17-confidence sample BIF, returns
> `partial` or `insufficient` with honest reasons — and a test proving it invents nothing.

Given the sample discovery profile driven through the real pipeline, the pinned result is:

| Observation                         | Value                                                         |
| ----------------------------------- | ------------------------------------------------------------- |
| Sufficiency state                   | **`partial`**                                                 |
| Supported sections                  | 1 — `products_services` (confidence 63, completeness 100)     |
| Unsupported sections                | 6, each with the real score quoted against the real threshold |
| Missing sections                    | 5, each stated as unknown                                     |
| Root confidence / completeness      | 17 / 12 — carried through, never recomputed                   |
| Present sections / populated fields | 7 / 10                                                        |

The surrounding discipline:

- **Limitations are about the context, never the business.** A weak section "cannot be relied on
  yet … this is not a finding about the business". An absent section "is unknown … must not be read
  as a strength or a weakness".
- **Absent sections never become items.** They cannot be mistaken for findings.
- **Improvement hints say what context to gather** — never what to conclude or do.
- **Warnings from the scoring and projection layers are carried verbatim**, unsuppressed and
  unsoftened, into both `output.sufficiency.warnings` and `summary.carriedWarnings`.
- **26 tests** (package total 60 → 86) cover each of these, plus: all four states reachable and
  distinct; `ready` withheld when a section is absent and when root confidence is 69; reasons
  non-empty in every state; `producedAt` used exactly and required; deep and JSON-identical repeat
  calls; input not mutated; a purity guard on the module source; scores never recomputed; status
  carried through as `Draft` and never promoted; no placeholder sections; no separate result type.

---

## 4. Current guarantees

- **No capability depends on `@age/bif`.** Enforced by a test that parses import specifiers rather
  than substring-matching the source — necessary because the module discusses `@age/bif` in prose
  precisely to record that it must never import it. `@age/business-discovery-contracts` does depend
  on `@age/bif`; ADR-0026 Decision 1 names it as the sanctioned host for the projection. What is
  forbidden, and enforced, is the _capability package_ declaring or importing `@age/bif`, or seeing a
  `BusinessIntelligenceFramework`.
- **Determinism.** `producedAt` is caller-supplied and required in the new path; item ids are derived
  (`business-context-support:<bifId>:<sectionType>`), never generated. No clock, no randomness, no
  I/O, no `process.env`.
- **No mutation.** The projection and its arrays are never mutated; emitted arrays are fresh.
- **No fabrication.** Every emitted value is copied from the projection or is a count of it. Nothing
  is inferred, filled, or promoted.
- **Backward compatible.** The new method is additive; `IntelligenceCapability.run` and the evidence
  pipeline are untouched; all 60 pre-existing Intelligence tests pass unmodified; demo output is
  byte-identical (6 capabilities, 6 pending approvals, accounting invariant OK, no side effects).
- **Boundaries.** No API, Web, DB, persistence, demo-runtime, workflow or CI change. No AI calls, no
  external integrations, no URL fetching, no execution side effects.

---

## 5. Intentionally open questions

Both were reached during PR #86 and deliberately **not** decided in code.

### 5.1 Shared vs per-capability sufficiency thresholds

ADR-0026 Decision 3 permits implementation-defined thresholds provided they are deterministic and
explainable, and its follow-up section leaves the shared-vs-per-capability question open. PR #86
therefore keeps its thresholds local to Intelligence and publishes them in every summary; no shared
package gained a threshold and nothing was imposed on another capability.

This is sustainable for one consumer and not obviously sustainable for six. The question — whether
sufficiency thresholds are a platform policy or a capability judgement — is architectural, and
promoting them to a shared package should be an ADR, not a refactor.

### 5.2 Whether `INTELLIGENCE_CAPABILITY_ENTRY.consumes` should advertise `ScoredBifContext`

Left untouched because that metadata feeds the read-only demo registry, and this slice was required
not to change demo output. Whether the registry should describe context consumption at all — and what
a consumer of that metadata is entitled to assume — is a product and interface question, not a
mechanical edit.

### 5.3 Still undecided from earlier milestones

- **BIF status promotion (`Draft → Active`)** — a high score does **not** imply promotable. No rule
  exists, and none should be inferred from the sufficiency states added here: `ready` describes what
  a capability can rely on, not whether a BIF is ready to be promoted. These must not be conflated.

---

## 6. Recommended next slice

**A second consumer, or persistence — not both, and not a strategy layer.**

The consumption path is proven by exactly one capability against exactly one sample. The two
highest-value directions:

- **Option A — a second capability consumes `ScoredBifContext`.** This is what would actually settle
  §5.1: with two consumers, the threshold question becomes concrete rather than hypothetical, and any
  shared-threshold ADR would be written against evidence instead of speculation. It stays pure,
  package-level and small. Every candidate capability derives plan candidates, so this slice would
  have to be scoped to context _assessment_ for that capability, not plan generation — which may
  itself need an ADR, and if so, that ADR is the slice.
- **Option B — persistence of a scored BIF.** Higher value to the product, but it crosses the
  package-level boundary that has held for this entire track, and it needs decisions about ownership,
  identity and versioning that no ADR currently covers. If chosen, it starts with an ADR.

**Recommendation: Option A**, because it retires an open question this milestone created, and does so
without leaving the safety boundary.

---

## 7. What must not be done next

- Do not build a strategy, recommendation, proposal, reporting or automation layer. Nothing in this
  milestone licenses generating advice from context.
- Do not treat `ready` as permission to promote a BIF, or as a business finding.
- Do not promote thresholds to a shared package without an ADR (§5.1).
- Do not let a capability import `@age/bif`, directly or by widening a dependency.
- Do not convert absence into a negative signal anywhere downstream. Unknown stays unknown.
- Do not add API, Web, DB, persistence or demo-runtime surface as a side effect of the next slice.

---

## 8. Hard boundaries for this checkpoint PR

Documentation only. One new file under `docs/reviews/`. No code, test, package, dependency, ADR
status, schema, configuration, workflow or CI change. No ADR is superseded or amended — ADR-0026
remains Accepted exactly as written; this records that it is now implemented.
