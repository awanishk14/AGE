# ADR 0019: Revenue Input Contract Boundary

- Status: Accepted
- Date: 2026-07-11

## Context

**Execution EPIC-08 — Revenue Capability** introduces the **Revenue Capability**
(`@age/capability-revenue`), a pure, deterministic capability that produces revenue plan
candidates / decision objects (e.g. upsell/cross-sell plans, renewal plans, pricing/packaging
proposals, expansion plans, retention/churn-mitigation plans, proposal-drafting plans). It is the
second of the two Phase 4 capabilities and the counterpart to the Operations Capability delivered in
Execution EPIC-07 (ADR-0018).

This work implements **Product Roadmap Phase 4 / conceptual EPIC-06 "Revenue"**, per
`docs/product/15_PRODUCT_ROADMAP.md` §3–4 and `docs/architecture/CAPABILITY_ARCHITECTURE.md` §7, §10.

> **Note on EPIC numbering.** Product Bible EPIC numbers are **conceptual capability groupings**
> (`15_PRODUCT_ROADMAP.md` §4/§8.4: "EPICs are a capability organization framework — not an
> implementation roadmap"). The Product Bible labels _Agency Operations_ as **conceptual EPIC-05** and
> _Revenue_ as **conceptual EPIC-06**. **Execution EPIC numbers** follow Git / project delivery
> history (EPIC-01 Intelligence Platform, EPIC-02 Evidence Processing, EPIC-03 Market Discovery,
> EPIC-04 Growth, EPIC-05 Shared Disposition, EPIC-06 Authority, EPIC-07 Operations). The next
> execution epic is therefore **Execution EPIC-08 = Revenue Capability**. The two schemes are
> intentionally distinct; this ADR uses the **execution** numbering (EPIC-08) for delivery continuity
> while noting the conceptual mapping above. The `Capability.Revenue` enum value already exists in
> `packages/capability-kit/src/enums/capability.enum.ts`, and the package path
> `packages/capabilities/revenue/ → @age/capability-revenue` is reserved
> (`CAPABILITY_ARCHITECTURE.md` §6).

Per the Capability Contract (`CAPABILITY_ARCHITECTURE.md` §2, §7, §8), a capability consumes —
read-only, by reference — SIE decisions, curated upstream opportunities/plans, BIF field references,
and BKG nodes, and produces decision objects. It never writes to platform engines and never executes.

Revenue must obtain input **types** describing those references. The same boundary problem resolved by
ADR-0010 (evidence), ADR-0012 (market discovery input), ADR-0014 (growth input), ADR-0017 (authority
input), and ADR-0018 (operations input) applies again:

1. **Direct import** from implementation packages — `@age/capability-market-discovery`,
   `@age/capability-growth`, `@age/capability-authority`, `@age/capability-operations`,
   `@age/strategy-intelligence-engine`, `@age/bif`, the BKG package. This couples a pure capability to
   other capability/engine implementation packages, drags their surface and transitive dependencies
   into Revenue, and lets any of their internal refactors silently break Revenue. Importing another
   _capability_ package is an especially undesirable capability-to-capability coupling.
2. **Local re-declaration** inside `@age/capability-revenue`. This duplicates canonical shapes and
   guarantees drift.

Neither preserves a clean boundary. The ADR-0010/0012/0014/0017/0018 resolution — a neutral shared
contract package — applies directly. EPIC-05 (ADR-0016) already consolidated the result/summary
disposition contract into `@age/capability-kit`, so Revenue adopts that shared contract from inception
and needs only its **input** boundary decided here.

Revenue is notable in one respect: it is the first capability whose most natural upstream input
includes **another Phase 4 capability's output** (Operations plan candidates), in addition to
SIE decisions and Growth/Authority plans. This makes the capability-to-capability coupling risk more
acute and the neutral-value-shape boundary more important, not less.

## Decision (proposed)

Introduce a neutral shared contracts package: **`@age/revenue-contracts`**.

It owns the canonical, framework-agnostic input contract types Revenue consumes. The exact field-level
shapes are **not** frozen by this ADR (see Open Decisions below); the likely owned types are:

- `RevenueInput` — the top-level in-memory input contract for a single Revenue invocation.
- `RevenuePlanningInputItem` — a neutral, read-only planning input the capability reasons over
  (derived upstream; Revenue does not collect it).
- `RevenuePlanSourceRef` — a neutral provenance reference tying a derived plan candidate back to its
  originating input reference(s).
- `RevenuePlanReference` — a **small, read-only, neutral value shape** mirroring only the minimal
  upstream opportunity/plan/decision fields Revenue reads (including any minimal Operations-plan
  fields). Declared **independently** in `@age/revenue-contracts`; not imported or re-exported from
  any producer capability or its contracts package.
- `RevenuePlanTarget` and Revenue classification enums (Revenue-specific plan type / target kind /
  priority / effort or value band unions) **if needed** — the concrete set is an Open Decision.

### 1. What Revenue consumes

Revenue consumes, read-only and by reference, curated upstream **revenue-relevant** concepts assembled
by the caller into an in-memory `RevenueInput`: SIE decisions, Growth plans, Authority plans, and —
distinctively — **Operations plan candidates**, plus BIF field references and BKG nodes as needed. It
consumes these only as neutral value shapes (`RevenuePlanReference` / `RevenuePlanningInputItem`),
never as live producer-package objects. Revenue reads no datastore.

### 2. What Revenue produces

Revenue produces **revenue plan candidates / decision objects only** — a `RevenueResult` wrapping a
`CapabilityOutput<RevenuePlanItem>` plus a processing summary. These are decision data (proposed
revenue actions), never executed actions.

### 3. Neutral `@age/revenue-contracts` package — yes

A neutral contracts package **is** required, for the same reasons as ADR-0017/0018. Boundary rules
(mirroring those ADRs):

- `@age/revenue-contracts` must remain a **pure contract package**: no runtime services, business
  logic, persistence, orchestration, and no dependency on `@age/capability-market-discovery`,
  `@age/capability-growth`, `@age/capability-authority`, `@age/capability-operations`,
  `@age/market-discovery-contracts`, `@age/growth-contracts`, `@age/authority-contracts`,
  `@age/operations-contracts`, `@age/strategy-intelligence-engine`, `@age/bif`, the BKG package,
  `@age/research-intelligence-engine`, `@age/capability-revenue`, NestJS, Prisma, or any application
  package or execution engine. It may depend only on other pure contract/type packages if strictly
  necessary (e.g. `@age/capability-kit` for the shared `ExecutionDomain` tag type, as the other
  `*-contracts` packages do).
- `@age/capability-revenue` depends on `@age/capability-kit` and `@age/revenue-contracts` **only** —
  never on `@age/capability-market-discovery`, `@age/capability-growth`, `@age/capability-authority`,
  `@age/capability-operations`, SIE, BIF, BKG, RIE, NestJS, Prisma, application packages, or execution
  engines.

### 4. Upstream concepts referenced only through neutral value shapes

Revenue may reference upstream **opportunities, Growth plans, Authority plans, Operations plan
candidates, SIE decisions, BIF field references, and BKG nodes** — but only through
`RevenuePlanReference` (a small, read-only, independently-declared value shape carrying plain data:
e.g. `referenceId`, `referenceType`, a `RevenuePlanTarget`, opaque `executionDomains`, and the minimal
numeric fields Revenue reads). `referenceType` is a plain string mirror (e.g. `'OPPORTUNITY'`,
`'GROWTH_PLAN'`, `'AUTHORITY_PLAN'`, `'OPERATIONS_PLAN'`, `'SIE_DECISION'`). The reference carries only
data, exposes no upstream behavior, and must not import or re-export another package's types.

### 5. Packages Revenue must not import

`@age/capability-market-discovery`, `@age/capability-growth`, `@age/capability-authority`,
`@age/capability-operations`, `@age/market-discovery-contracts`, `@age/growth-contracts`,
`@age/authority-contracts`, `@age/operations-contracts`, `@age/strategy-intelligence-engine` (SIE),
`@age/bif` (BIF), the BKG package, `@age/research-intelligence-engine` (RIE), NestJS, Prisma, any
application package, and any execution engine.

### 6. Consuming Operations output — only through a neutral reference shape

Revenue must **not** consume Operations output by importing `@age/capability-operations` or
`@age/operations-contracts`. It consumes Operations plan candidates only as a neutral
`RevenuePlanReference` (e.g. `referenceType: 'OPERATIONS_PLAN'`) that the caller populates in-memory.
This keeps the capability dependency graph acyclic and shallow and prevents Operations internal
refactors from breaking Revenue. The minor, intentional duplication of a small subset of Operations
fields into the neutral shape is the accepted cost of boundary purity (consistent with
ADR-0010/0012/0014/0017/0018).

### 7. Revenue produces plan candidates / decision objects only

Yes. Revenue produces revenue plan candidates / decision objects only — never executable actions.

### 8. Revenue output boundary — scope guards (explicit)

Revenue produces **revenue plan candidates / decision objects only**. It must **not**:

- create invoices,
- send proposals,
- charge customers,
- trigger payments,
- modify CRM / deal state,
- send emails or messages,
- execute workflows or automations,
- persist anything,
- publish to queues or emit events,
- call external APIs, or drive platform-engine behavior.

"Proposal-drafting plans" means a decision object recommending that a proposal be drafted later.
Revenue must not generate proposal documents, create proposal content, send proposals, or invoke any
document/email/workflow engine.

Additionally (carried forward from EPIC-02/03/04/06/07): no orchestration, AI/LLM, embeddings, semantic
matching, or source-reliability weighting. Source-reliability weighting remains deferred. Execution
domains (illustratively CRM, Reporting, Automation, and related domains) are **opaque structural tags
only** and cannot trigger any execution behavior; the concrete allowed tag set must be confirmed
against `ExecutionDomain` and is an Open Decision below. `CapabilityOutput<T>` and
`CapabilityOutput.producedAt` remain unchanged. **`ClientContext` remains authoritative** for the
produced output's `clientId` and `organizationId` (enforced from the capability layer). If
`RevenueInput` carries `clientId` / `organizationId`, they are **provenance/scope fields only** and
must never scope the output; any future mismatch check is an explicit validation rule / ADR concern,
never a silent reconciliation.

### 9. Output & disposition (adopts ADR-0016)

Revenue uses the shared disposition/result generics from `@age/capability-kit` (ADR-0016) from
inception — it does **not** define a local result-wrapper interface with the same five fields:

```ts
export type RevenueProcessingSummary = ProcessingSummary<
  RejectedRevenueReason,
  DuplicateRevenueReference
>;
export type RevenueResult = CapabilityResult<RevenuePlanItem, RevenueProcessingSummary>;
```

Revenue-specific `RejectedRevenueReasonCode`, `RejectedRevenueReason`, and `DuplicateRevenueReference`
are capability-owned and expected; capability-specific id naming is preserved (e.g. `revenuePlanId`,
`duplicateOfRevenuePlanId`) — **no neutral `itemId`**. Revenue has no contradiction concept (that is
Intelligence-specific).

```
@age/revenue-contracts  (canonical RevenueInput, RevenuePlanningInputItem,
        ^                 RevenuePlanSourceRef, RevenuePlanReference,
        |                 RevenuePlanTarget — small read-only shapes, no logic)
        |
@age/capability-revenue (consumer — pure capability)
```

This ADR decides only the **input** boundary and the existence/purity rules of the contracts package.
The exact field-level shapes of `RevenueInput`, `RevenuePlanningInputItem`, `RevenuePlanSourceRef`,
`RevenuePlanReference`, `RevenuePlanTarget`, and the output `RevenuePlanItem` are deliberately **not**
frozen here — they are fixed in the first Execution EPIC-08 implementation planning step (field-shape
approval) after this ADR is accepted. Fixing shapes later does not reopen the boundary decision.

## Open Decisions (require explicit founder review before / during field-shape approval)

The boundary above is proposed as final; the following Revenue-domain semantics are **deliberately
unresolved** and must be decided explicitly (they are not settled by precedent because Revenue is a
monetization/expansion/retention domain, distinct from Operations' delivery/QA/assignment domain and
Growth's impact/effort domain):

1. **Revenue plan types** — the concrete `RevenuePlanType` union (e.g. `UPSELL`, `CROSS_SELL`,
   `RENEWAL`, `EXPANSION`, `PRICING_PACKAGING`, `RETENTION`, `PROPOSAL_DRAFT`, …). Exact members and
   granularity undecided.
2. **Revenue target kinds** — the `RevenuePlanTargetKind` union (e.g. account, engagement, deal,
   contract, subscription/plan, opportunity, …). Undecided.
3. **Revenue scoring inputs** — the explicit numeric inputs on `RevenuePlanningInputItem` (candidate
   examples: expected value / deal size, win/conversion probability, effort or cost-to-serve, churn
   risk, confidence). Undecided.
4. **Deduplication key** — the structural dedup key for Revenue plan candidates (Authority/Operations
   used `planType | target.kind | target.key | sorted(domains)`; whether the same structure fits
   Revenue is undecided).
5. **Validation reason codes** — the `RejectedRevenueReasonCode` union (which fixed-order,
   first-violated-wins rules apply, and their codes). Undecided.
6. **Allowed `ExecutionDomain` tags for Revenue planning inputs** — which `ExecutionDomain` enum values
   are valid on Revenue planning items. Candidate examples include CRM, Reporting, and Automation; the
   exact enum values must be confirmed against `ExecutionDomain` before implementation. No new
   `ExecutionDomain` member (e.g. a "Sales"/"Billing" domain) may be added without a separate explicit
   decision. Undecided.
7. **Scoring model** — **flagged as the highest-risk open question**: whether Revenue reuses any prior
   scoring model (Growth `impact/effort/confidence → priority`; Authority's identical formula; or the
   Operations `urgency/risk/effort/confidence` model from ADR-0018) or requires a **new
   Revenue-specific model**. Revenue reasons about monetary value, conversion probability, and churn
   risk — none of the prior models maps cleanly (expected value and probability are not "impact", and
   Operations' urgency/delivery-risk semantics are delivery-oriented). This subsumes the general
   reuse-vs-new question and must be decided before the Revenue processing-implementation tasks. If a
   new model is proposed, its inputs and exact formula (with clamping and band thresholds) must be
   specified and justified.

These Open Decisions do **not** block acceptance of the boundary decision in this ADR; they block the
subsequent field-shape approval and processing-implementation tasks.

## Governance note (flagged, not resolved here)

`docs/product/15_PRODUCT_ROADMAP.md` §6 (Release Principles) states the branch flow is
`feature → develop → main`. Recent execution history has instead used `feature → main` directly.
**Execution EPIC-07 (Operations) followed the established `feature → main` execution path** used for
EPIC-02 through EPIC-06, and **ADR-0018 previously flagged this roadmap discrepancy**. Consistent with
ADR-0018, **ADR-0019 does not resolve or modify that broader governance issue** — it is recorded here
so it is not lost and can be decided by the founder ahead of any future integration.

## Consequences

- Revenue never depends on another capability package (including Operations) or on SIE/BIF/BKG/RIE
  implementation packages; those can refactor internals freely as long as they can still supply values
  conforming to the contracts.
- Capability-to-capability coupling (Revenue → Market Discovery / Growth / Authority / Operations) is
  avoided: Revenue consumes upstream _concepts_ through a neutral value shape, keeping the capability
  dependency graph acyclic and shallow — important given Revenue's natural dependence on Operations
  output.
- Revenue continues the ADR-0016 shared disposition contract adoption from inception (as Authority and
  Operations did), avoiding a local wrapper.
- The neutral `RevenuePlanReference` deliberately duplicates a small subset of upstream fields; that
  minor, intentional duplication is the accepted cost of boundary purity (consistent with
  ADR-0010/0012/0014/0017/0018).
- Continues the reusable pattern for every future pure capability consuming upstream outputs: a neutral
  `@age/<capability>-contracts` boundary, never a direct engine/capability import.
- The package is **not** created by this ADR; creation is the first Execution EPIC-08 implementation
  task, gated on this ADR's acceptance, the Open-Decisions resolution, and the field-shape approval
  step.
