# ADR 0017: Authority Input Contract Boundary

- Status: Proposed
- Date: 2026-07-03

## Context

EPIC-06 introduces the **Authority Capability** (`@age/capability-authority`), a pure, deterministic
capability that produces authority plan candidates (content-strategy items, thought-leadership,
digital-PR, backlink, review, and multimedia — video/podcast — plan ideas). Per the Capability
Contract (CAPABILITY_ARCHITECTURE §4, §7), a capability consumes — read-only, by reference — SIE
decisions, curated upstream opportunities/plans, BIF field references, and BKG nodes, and produces
decision objects. It never writes to platform engines and never executes.

Authority must obtain input **types** describing those references. The same boundary problem
resolved by ADR-0010 (evidence), ADR-0012 (market discovery input), and ADR-0014 (growth input)
applies again:

1. **Direct import** from implementation packages — `@age/capability-market-discovery`,
   `@age/capability-growth`, `@age/strategy-intelligence-engine`, `@age/bif`, the BKG package. This
   couples a pure capability to other capability/engine implementation packages, drags their surface
   and transitive dependencies into Authority, and lets any of their internal refactors silently
   break Authority. Importing another _capability_ package is an especially undesirable
   capability-to-capability coupling.
2. **Local re-declaration** inside `@age/capability-authority`. This duplicates canonical shapes and
   guarantees drift.

Neither preserves a clean boundary. The ADR-0010/0012/0014 resolution — a neutral shared contract
package — applies directly. EPIC-05 (ADR-0016) already consolidated the result/summary disposition
contract into `@age/capability-kit`, so Authority adopts that shared contract from inception and
needs only its **input** boundary decided here.

## Decision

Introduce a neutral shared contracts package: **`@age/authority-contracts`**.

It owns the canonical, framework-agnostic input contract types Authority consumes. The exact
field-level shapes are **not** frozen by this ADR (see below); the likely owned types are:

- `AuthorityInput` — the top-level in-memory input contract for a single Authority invocation.
- `AuthorityPlanningInputItem` — a neutral, read-only planning input the capability reasons over
  (derived upstream; Authority does not collect it).
- `AuthorityPlanSourceRef` — a neutral provenance reference tying a derived plan candidate back to
  its originating input reference(s).
- `AuthorityUpstreamReference` — a **small, read-only, neutral value shape** mirroring only the
  minimal upstream opportunity/plan/decision fields Authority reads. Declared **independently** in
  `@age/authority-contracts`; not imported or re-exported from `@age/capability-market-discovery`,
  `@age/capability-growth`, `@age/market-discovery-contracts`, or `@age/growth-contracts`.
- Authority classification enums (`AuthorityPlanType`, `AuthorityPlanTargetKind`,
  `AuthorityPlanPriority`, `AuthorityEffortBand`) and `AuthorityPlanTarget`.

Boundary rules (mirroring ADR-0010/0012/0014):

- `@age/authority-contracts` must remain a **pure contract package**: no runtime services, business
  logic, persistence, orchestration, and no dependency on `@age/capability-market-discovery`,
  `@age/capability-growth`, `@age/market-discovery-contracts`, `@age/growth-contracts`,
  `@age/strategy-intelligence-engine`, `@age/bif`, the BKG package,
  `@age/research-intelligence-engine`, `@age/capability-authority`, NestJS, Prisma, or any
  application package. It may depend only on other pure contract/type packages if strictly necessary
  (e.g. `@age/capability-kit` for the shared `ExecutionDomain` tag type, as the other
  `*-contracts` packages do).
- `@age/capability-authority` depends on `@age/capability-kit` and `@age/authority-contracts`
  **only** — never on `@age/capability-market-discovery`, `@age/capability-growth`, SIE, BIF, BKG,
  or RIE.
- `AuthorityUpstreamReference` is a **value/reference shape**, not a backdoor dependency on any
  producer capability's internals: it carries only plain data fields, exposes no upstream behavior,
  and must not import or re-export another package's types (nor pass them through). It is
  intentionally small and read-only — minimal fields Authority actually reads, not a full copy of
  the Market Discovery / Growth / SIE / BIF / BKG domain models.
- `AuthorityInput` is **caller-assembled and fully in-memory**. Authority reads no datastore and
  does not depend on persisted upstream output. The caller populates `AuthorityInput` before
  invocation, exactly as callers assembled `EvidencePackage` / `MarketDiscoveryInput` / `GrowthInput`
  in EPIC-02/03/04.
- **`ClientContext` remains authoritative** for the produced `CapabilityOutput`'s `clientId` and
  `organizationId` (enforced from the capability layer, not by this contract type). If
  `AuthorityInput` carries `clientId` / `organizationId`, they are **provenance/scope fields only**
  and must never be used to scope the output. Any future mismatch check is an explicit validation
  rule / ADR concern, never a silent reconciliation.
- **Authority plan type is caller-provided, not derived.** There is no canonical deterministic
  mapping from a market/growth opportunity to an authority-plan type — the same opportunity may
  support thought leadership, digital PR, review building, content strategy, backlink strategy,
  video, or podcast depending on caller strategy. Authority carries caller intent (`planType` on the
  planning item) rather than inventing product strategy, following the Growth precedent (ADR-0014/0015).

```
@age/authority-contracts   (canonical AuthorityInput, AuthorityPlanningInputItem,
        ^                    AuthorityPlanSourceRef, AuthorityUpstreamReference — small
        |                    read-only shapes, no logic)
        |
@age/capability-authority  (consumer — pure capability)
```

This ADR decides only the **input** boundary and the existence/purity rules of the contracts
package. The **boundary decision is final**: Authority consumes its input via a neutral
`@age/authority-contracts` package and never imports the Market Discovery / Growth capability or
contracts packages, SIE, BIF, BKG, or RIE. The exact field-level shapes of `AuthorityInput`,
`AuthorityPlanningInputItem`, `AuthorityPlanSourceRef`, `AuthorityUpstreamReference`, and the output
`AuthorityPlanItem` are deliberately **not** frozen here — they are fixed in the first EPIC-06
implementation planning step (field-shape approval) after this ADR is accepted. Fixing shapes later
does not reopen the boundary decision.

### Output & disposition (adopts ADR-0016)

Authority uses the shared disposition/result generics from `@age/capability-kit` (ADR-0016) from
inception — it does **not** define a local result-wrapper interface with the same five fields:

```ts
export type AuthorityProcessingSummary = ProcessingSummary<
  RejectedAuthorityReason,
  DuplicateAuthorityReference
>;
export type AuthorityResult = CapabilityResult<AuthorityPlanItem, AuthorityProcessingSummary>;
```

Authority-specific `RejectedAuthorityReasonCode`, `RejectedAuthorityReason`, and
`DuplicateAuthorityReference` are capability-owned and expected; capability-specific id naming is
preserved (e.g. `authorityPlanId`, `duplicateOfAuthorityPlanId`) — **no neutral `itemId`**.
Authority has no contradiction concept (that is Intelligence-specific).

### Scope guards (explicit)

- Authority produces **plan candidates only** (decision objects) — never executable actions. It must
  not write, execute, publish, schedule, generate content, perform PR/backlink/review outreach,
  distribute content, call external APIs, or drive platform-engine behavior.
- Execution domains (`Content`, `PR`, `Publishing`, `SSH`, etc.) are **opaque structural tags only**
  and cannot trigger any execution behavior.
- No persistence, orchestration, queues, events, AI/LLM, embeddings, semantic matching, or
  source-reliability weighting. Source-reliability weighting remains deferred (carried forward from
  EPIC-02/03/04).
- `CapabilityOutput<T>` and `CapabilityOutput.producedAt` remain unchanged.

## Consequences

- Authority never depends on another capability package or on SIE/BIF/BKG/RIE implementation
  packages; those can refactor internals freely as long as they can still supply values conforming
  to the contracts.
- Capability-to-capability coupling (Authority → Market Discovery / Growth) is avoided: Authority
  consumes upstream _concepts_ through a neutral value shape, keeping the capability dependency graph
  acyclic and shallow.
- Authority is the first capability to adopt the ADR-0016 shared disposition contract from inception,
  validating that consolidation and avoiding a fourth local wrapper.
- The neutral `AuthorityUpstreamReference` deliberately duplicates a small subset of upstream fields;
  that minor, intentional duplication is the accepted cost of boundary purity (consistent with
  ADR-0010/0012/0014).
- Establishes/continues the reusable pattern for every future pure capability consuming upstream
  outputs: a neutral `@age/<capability>-contracts` boundary, never a direct engine/capability import.
- The package is **not** created by this ADR; creation is the first EPIC-06 implementation task,
  gated on this ADR's acceptance and the field-shape approval step.
