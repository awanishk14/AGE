# ADR 0018: Operations Input Contract Boundary

- Status: Accepted
- Date: 2026-07-11

## Context

**Execution EPIC-07 — Operations Capability** introduces the **Operations Capability**
(`@age/capability-operations`), a pure, deterministic capability that produces operations plan
candidates / decision objects (project plans, client-reporting plans, team-assignment proposals, SOP
execution plans, QA plans, delivery-tracking plans). It is the first of the two Phase 4 capabilities.

This work implements **Product Roadmap Phase 4 / conceptual EPIC-05 "Agency Operations"** (Operations
Capability · Revenue Capability), per `docs/product/15_PRODUCT_ROADMAP.md` §3–4 and
`docs/architecture/CAPABILITY_ARCHITECTURE.md` §7, §10.

> **Note on EPIC numbering.** Product Bible EPIC numbers are **conceptual capability groupings**
> (`15_PRODUCT_ROADMAP.md` §4/§8.4: "EPICs are a capability organization framework — not an
> implementation roadmap"). The Product Bible labels _Agency Operations_ as **conceptual EPIC-05** and
> _Revenue_ as conceptual EPIC-06. **Execution EPIC numbers** follow Git / project delivery history
> (EPIC-01 Intelligence Platform, EPIC-02 Evidence Processing, EPIC-03 Market Discovery, EPIC-04
> Growth, EPIC-05 Shared Disposition, EPIC-06 Authority). The next execution epic is therefore
> **Execution EPIC-07 = Operations Capability**. The two schemes are intentionally distinct; this ADR
> uses the **execution** numbering (EPIC-07) for delivery continuity while noting the conceptual
> mapping above. The `Capability.Operations` enum value already exists in
> `packages/capability-kit/src/enums/capability.enum.ts`, and the package path
> `packages/capabilities/operations/ → @age/capability-operations` is already reserved
> (`CAPABILITY_ARCHITECTURE.md` §6).

Per the Capability Contract (`CAPABILITY_ARCHITECTURE.md` §2, §7, §8), a capability consumes —
read-only, by reference — SIE decisions, curated upstream opportunities/plans, BIF field references,
and BKG nodes, and produces decision objects. It never writes to platform engines and never executes.

Operations must obtain input **types** describing those references. The same boundary problem
resolved by ADR-0010 (evidence), ADR-0012 (market discovery input), ADR-0014 (growth input), and
ADR-0017 (authority input) applies again:

1. **Direct import** from implementation packages — `@age/capability-market-discovery`,
   `@age/capability-growth`, `@age/capability-authority`, `@age/strategy-intelligence-engine`,
   `@age/bif`, the BKG package. This couples a pure capability to other capability/engine
   implementation packages, drags their surface and transitive dependencies into Operations, and lets
   any of their internal refactors silently break Operations. Importing another _capability_ package
   is an especially undesirable capability-to-capability coupling.
2. **Local re-declaration** inside `@age/capability-operations`. This duplicates canonical shapes and
   guarantees drift.

Neither preserves a clean boundary. The ADR-0010/0012/0014/0017 resolution — a neutral shared
contract package — applies directly. EPIC-05 (ADR-0016) already consolidated the result/summary
disposition contract into `@age/capability-kit`, so Operations adopts that shared contract from
inception and needs only its **input** boundary decided here.

## Decision

Introduce a neutral shared contracts package: **`@age/operations-contracts`**.

It owns the canonical, framework-agnostic input contract types Operations consumes. The exact
field-level shapes are **not** frozen by this ADR (see Open Decisions below); the likely owned types
are:

- `OperationsInput` — the top-level in-memory input contract for a single Operations invocation.
- `OperationsPlanningInputItem` — a neutral, read-only planning input the capability reasons over
  (derived upstream; Operations does not collect it).
- `OperationsPlanSourceRef` — a neutral provenance reference tying a derived plan candidate back to
  its originating input reference(s).
- `OperationsPlanReference` — a **small, read-only, neutral value shape** mirroring only the minimal
  upstream opportunity/plan/decision fields Operations reads. Declared **independently** in
  `@age/operations-contracts`; not imported or re-exported from any producer capability or its
  contracts package.
- `OperationsPlanTarget` and Operations classification enums (Operations-specific plan type / target
  kind / priority / effort band unions) **if needed** — the concrete set is an Open Decision.

Boundary rules (mirroring ADR-0010/0012/0014/0017):

- `@age/operations-contracts` must remain a **pure contract package**: no runtime services, business
  logic, persistence, orchestration, and no dependency on `@age/capability-market-discovery`,
  `@age/capability-growth`, `@age/capability-authority`, `@age/market-discovery-contracts`,
  `@age/growth-contracts`, `@age/authority-contracts`, `@age/strategy-intelligence-engine`,
  `@age/bif`, the BKG package, `@age/research-intelligence-engine`, `@age/capability-operations`,
  NestJS, Prisma, or any application package or execution engine. It may depend only on other pure
  contract/type packages if strictly necessary (e.g. `@age/capability-kit` for the shared
  `ExecutionDomain` tag type, as the other `*-contracts` packages do).
- `@age/capability-operations` depends on `@age/capability-kit` and `@age/operations-contracts`
  **only** — never on `@age/capability-market-discovery`, `@age/capability-growth`,
  `@age/capability-authority`, SIE, BIF, BKG, RIE, NestJS, Prisma, application packages, or execution
  engines.
- `OperationsPlanReference` is a **value/reference shape**, not a backdoor dependency on any producer
  capability's internals: it carries only plain data fields, exposes no upstream behavior, and must
  not import or re-export another package's types (nor pass them through). It is intentionally small
  and read-only — minimal fields Operations actually reads, not a full copy of the upstream domain
  models.
- `OperationsInput` is **caller-assembled and fully in-memory**. Operations reads no datastore and
  does not depend on persisted upstream output. The caller populates `OperationsInput` before
  invocation, exactly as callers assembled `EvidencePackage` / `MarketDiscoveryInput` / `GrowthInput`
  / `AuthorityInput` in EPIC-02/03/04/06.
- **`ClientContext` remains authoritative** for the produced `CapabilityOutput`'s `clientId` and
  `organizationId` (enforced from the capability layer, not by this contract type). If
  `OperationsInput` carries `clientId` / `organizationId`, they are **provenance/scope fields only**
  and must never be used to scope the output. Any future mismatch check is an explicit validation
  rule / ADR concern, never a silent reconciliation.

```
@age/operations-contracts  (canonical OperationsInput, OperationsPlanningInputItem,
        ^                    OperationsPlanSourceRef, OperationsPlanReference,
        |                    OperationsPlanTarget — small read-only shapes, no logic)
        |
@age/capability-operations (consumer — pure capability)
```

This ADR decides only the **input** boundary and the existence/purity rules of the contracts package.
If accepted, this ADR decides the input boundary: Operations consumes its input via a neutral
`@age/operations-contracts` package and never imports the Market Discovery / Growth / Authority
capability or contracts packages, SIE, BIF, BKG, or RIE. The exact field-level shapes of
`OperationsInput`, `OperationsPlanningInputItem`, `OperationsPlanSourceRef`,
`OperationsPlanReference`, `OperationsPlanTarget`, and the output `OperationsPlanItem` are deliberately
**not** frozen here — they are fixed in the first Execution EPIC-07 implementation planning step
(field-shape approval) after this ADR is accepted. Fixing shapes later does not reopen the boundary
decision.

### Output & disposition (adopts ADR-0016)

Operations uses the shared disposition/result generics from `@age/capability-kit` (ADR-0016) from
inception — it does **not** define a local result-wrapper interface with the same five fields:

```ts
export type OperationsProcessingSummary = ProcessingSummary<
  RejectedOperationsReason,
  DuplicateOperationsReference
>;
export type OperationsResult = CapabilityResult<OperationsPlanItem, OperationsProcessingSummary>;
```

Operations-specific `RejectedOperationsReasonCode`, `RejectedOperationsReason`, and
`DuplicateOperationsReference` are capability-owned and expected; capability-specific id naming is
preserved (e.g. `operationsPlanId`, `duplicateOfOperationsPlanId`) — **no neutral `itemId`**.
Operations has no contradiction concept (that is Intelligence-specific).

### Operations output boundary — scope guards (explicit)

- Operations produces **operations plan candidates / decision objects only** — never executable
  actions. It must not:
  - create tasks or work items,
  - perform assignment execution (only propose assignments as decision data),
  - send or distribute client reports,
  - trigger workflows or automations,
  - perform SOP execution side effects,
  - call external APIs,
  - publish to queues or emit events,
  - persist anything, or drive platform-engine behavior.
- Execution domains (illustratively reporting, automation, CRM, and project-management-related
  domains) are **opaque structural tags only** and cannot trigger any execution behavior. The
  concrete allowed tag set must be confirmed against `ExecutionDomain` and is an Open Decision below.
- No persistence, orchestration, queues, events, AI/LLM, embeddings, semantic matching, or
  source-reliability weighting. Source-reliability weighting remains deferred (carried forward from
  EPIC-02/03/04/06).
- `CapabilityOutput<T>` and `CapabilityOutput.producedAt` remain unchanged.

## Open Decisions (require explicit founder review before / during field-shape approval)

The boundary above is final; the following Operations-domain semantics are **deliberately unresolved**
and must be decided explicitly (they are not settled by precedent because Operations is a
delivery/QA/assignment domain, not an impact/effort growth domain):

1. **Operations plan types** — the concrete `OperationsPlanType` union (e.g. `PROJECT_PLAN`,
   `CLIENT_REPORTING`, `TEAM_ASSIGNMENT`, `SOP_EXECUTION`, `QA_PLAN`, `DELIVERY_TRACKING`, …). Exact
   members and granularity are undecided.
2. **Operations target kinds** — the `OperationsPlanTargetKind` union (e.g. project, deliverable,
   engagement, team/assignee, SOP, report, …). Undecided.
3. **Validation reason codes** — the `RejectedOperationsReasonCode` union (which fixed-order,
   first-violated-wins rules apply, and their codes). Undecided.
4. **Deduplication key** — the structural dedup key for Operations plan candidates (Authority used
   `planType | target.kind | target.key | sorted(domains)`; whether the same structure fits
   Operations is undecided).
5. **Scoring formula** — undecided, and **flagged as the highest-risk open question**: whether
   Operations reuses the shared Growth/Authority scoring formula
   (`impact/effort/confidence → priority`) or requires a **different scoring model**. Operations
   reasons about delivery, QA, capacity, and assignment — impact/effort growth semantics may not map
   cleanly. This must be decided before T33/T34 processing implementation.
6. **Whether Growth/Authority scoring can be reused** at all, or whether Operations needs its own
   dedicated model (subsumes #5 — explicitly called out per review requirement).
7. **Allowed `ExecutionDomain` tags for Operations planning inputs** — which `ExecutionDomain` enum
   values are valid on Operations planning items. Candidate examples include reporting, automation,
   CRM, and project-management-related domains; the exact enum values must be confirmed against
   `ExecutionDomain` before implementation. Undecided.

These Open Decisions do **not** block acceptance of the boundary decision in this ADR; they block the
subsequent field-shape approval and processing-implementation tasks.

## Governance discrepancy (flagged, not resolved here)

`docs/product/15_PRODUCT_ROADMAP.md` §6 (Release Principles) states the branch flow is
`feature → develop → main`. Recent execution history (EPIC-02…06) has instead used
`feature → main` directly (integration branch = `main`; `develop` is stale and does not contain
EPIC-01). This is a **governance discrepancy** to reconcile **before the EPIC-07 PR/merge**. Per
instruction, this ADR does **not** resolve it — it is recorded here so it is not lost and can be
decided by the founder ahead of EPIC-07 integration.

## Consequences

- Operations never depends on another capability package or on SIE/BIF/BKG/RIE implementation
  packages; those can refactor internals freely as long as they can still supply values conforming to
  the contracts.
- Capability-to-capability coupling (Operations → Market Discovery / Growth / Authority) is avoided:
  Operations consumes upstream _concepts_ through a neutral value shape, keeping the capability
  dependency graph acyclic and shallow.
- Operations continues the ADR-0016 shared disposition contract adoption from inception (as Authority
  did), avoiding a local wrapper.
- The neutral `OperationsPlanReference` deliberately duplicates a small subset of upstream fields;
  that minor, intentional duplication is the accepted cost of boundary purity (consistent with
  ADR-0010/0012/0014/0017).
- Continues the reusable pattern for every future pure capability consuming upstream outputs: a
  neutral `@age/<capability>-contracts` boundary, never a direct engine/capability import.
- The package is **not** created by this ADR; creation is the first Execution EPIC-07 implementation
  task, gated on this ADR's acceptance, the Open-Decisions resolution, and the field-shape approval
  step.
