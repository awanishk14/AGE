# ADR 0014: Growth Input Contract Boundary

- Status: Accepted
- Date: 2026-07-03

## Context

EPIC-04 introduces the **Growth Capability** (`@age/capability-growth`), a pure, deterministic
capability that produces growth plan candidates (ads-plan ideas, CRO/funnel ideas, landing-page
strategy items, content-distribution plan items). Per the Capability Contract
(CAPABILITY_ARCHITECTURE §4), a capability consumes — read-only, by reference — SIE
`DecisionPackage` / `StrategyOpportunity`, curated upstream opportunities (e.g. Market Discovery
output), BIF field references, and BKG nodes, and produces decision objects. It never writes to
platform engines and never executes.

Growth's most natural upstream is the **Market Discovery Capability** output
(`MarketDiscoveryOpportunityItem`) and/or SIE decisions. Growth must therefore obtain input
**types** describing those references. The same boundary problem resolved by ADR-0010 (evidence)
and ADR-0012 (market discovery input) applies again:

1. **Direct import** from implementation packages — `@age/capability-market-discovery`,
   `@age/strategy-intelligence-engine`, `@age/bif`, the BKG package. This couples a pure
   capability to other capability/engine implementation packages, drags their surface and
   transitive dependencies into Growth, and lets any of their internal refactors silently break
   Growth. Importing another _capability_ package (`@age/capability-market-discovery`) is an
   especially undesirable capability-to-capability coupling.
2. **Local re-declaration** inside `@age/capability-growth`. This duplicates canonical shapes and
   guarantees drift.

Neither preserves a clean boundary. ADR-0010/0012's resolution — a neutral shared contract
package — applies directly.

## Decision

Introduce a neutral shared contracts package: **`@age/growth-contracts`**.

It owns the canonical, framework-agnostic input contract types Growth consumes:

- `GrowthInput` — the top-level in-memory input contract for a single Growth invocation
  (client/organization scope, a caller-supplied `generatedAt` timestamp, and the read-only
  planning references below). Growth reads no datastore; the caller assembles this contract and
  passes it in, exactly as `MarketDiscoveryInput` was passed to Market Discovery.
- `GrowthPlanningInputItem` — a neutral, read-only planning input the capability reasons over
  (derived upstream; Growth does not collect it). The exact field-level shape is fixed in the
  first EPIC-04 implementation task.
- `GrowthPlanSourceRef` — a neutral provenance reference tying a derived plan candidate back to
  its originating input reference(s).
- `MarketOpportunityReference` — a **small, read-only, neutral mirror** of the minimal
  Market Discovery opportunity fields Growth consumes (e.g. an opportunity id, its type, target
  identity, execution-domain tags, and score). This is a **value/reference shape**, defined and
  owned by `@age/growth-contracts` — **not a backdoor dependency on Market Discovery internals**.
  It carries only plain data fields; it exposes no Market Discovery behavior, and reading it never
  reaches into the `@age/capability-market-discovery` package. Growth therefore consumes Market
  Discovery _concepts_ through a neutral contract, never the capability package.

  Furthermore, `@age/growth-contracts` **must not import or re-export any type from**
  `@age/capability-market-discovery` (nor from `@age/market-discovery-contracts` for the purpose of
  passing Market Discovery types through). `MarketOpportunityReference` is declared independently
  in `@age/growth-contracts`; re-exporting another package's types would reintroduce the coupling
  this boundary exists to prevent.

- Read-only SIE/BIF/BKG reference shapes **only if actually required** by the fixed field-level
  design; if not required, they are omitted (not stubbed), following ADR-0012's restraint.

Boundary rules (mirroring ADR-0010/0012):

- `@age/growth-contracts` must remain a **pure contract package**: no runtime services, business
  logic, persistence, orchestration, and no dependency on `@age/capability-market-discovery`,
  `@age/strategy-intelligence-engine`, `@age/bif`, the BKG package,
  `@age/research-intelligence-engine`, `@age/capability-growth`, NestJS, Prisma, or any
  application package. It may depend only on other pure contract/type packages if strictly
  necessary (e.g. `@age/capability-kit` for the shared `ExecutionDomain` tag type, as
  `@age/market-discovery-contracts` does).
- `@age/capability-growth` depends on `@age/capability-kit` and `@age/growth-contracts` **only** —
  never on `@age/capability-market-discovery`, SIE, BIF, BKG, or RIE.
- Neutral reference shapes are **intentionally small and read-only** — minimal address/value
  fields Growth actually reads, not full copies of the Market Discovery / SIE / BIF / BKG domain
  models. The contracts package must not become a parallel re-implementation of those models.
- `GrowthInput` is **caller-assembled and fully in-memory**. Growth does **not** read a datastore
  and does **not** depend on persisted Market Discovery output (or any persisted upstream). The
  caller is responsible for populating `GrowthInput` (including any `MarketOpportunityReference`
  values) before invocation, exactly as callers assembled `EvidencePackage` / `MarketDiscoveryInput`
  in EPIC-02/03.
- **`ClientContext` remains authoritative** for the produced `CapabilityOutput`'s `clientId` and
  `organizationId` (enforced from the capability layer, not by this contract type). If `GrowthInput`
  carries `clientId` / `organizationId`, they are **provenance/scope fields only** and must never be
  used to scope the output. Any future mismatch check between the two is an explicit validation
  rule / ADR concern, never a silent reconciliation.

```
@age/growth-contracts   (canonical GrowthInput, GrowthPlanningInputItem, GrowthPlanSourceRef,
        ^                MarketOpportunityReference — small read-only shapes, no logic)
        |
@age/capability-growth  (consumer — pure capability)
```

This ADR decides only the **input** boundary and the existence/purity rules of the contracts
package. The **boundary decision is final**: Growth consumes its input via a neutral
`@age/growth-contracts` package and never imports `@age/capability-market-discovery`, SIE, BIF,
BKG, or RIE. The exact field-level shapes of `GrowthInput`, `GrowthPlanningInputItem`,
`GrowthPlanSourceRef`, `MarketOpportunityReference`, and the output `GrowthPlanItem` are
deliberately **not** frozen here — they are fixed in the first EPIC-04 implementation task
(package creation). Fixing shapes later does not reopen the boundary decision.

## Consequences

- Growth never depends on another capability package or on SIE/BIF/BKG/RIE implementation
  packages; those can refactor internals freely as long as they can still supply values conforming
  to the contracts.
- Capability-to-capability coupling (Growth → Market Discovery) is avoided: Growth consumes Market
  Discovery _concepts_ through a neutral mirror, keeping the capability dependency graph acyclic
  and shallow.
- Canonical reference shapes are declared once, preventing drift and keeping Growth pure and cheap
  to test.
- The neutral `MarketOpportunityReference` deliberately duplicates a small subset of Market
  Discovery's opportunity fields; that minor, intentional duplication is the accepted cost of
  boundary purity (consistent with ADR-0010/0012). If a future ADR aligns producers to emit these
  contracts directly, that is a separate follow-up.
- Establishes the reusable pattern for every future pure capability consuming upstream outputs:
  a neutral `@age/<capability>-contracts` boundary, never a direct engine/capability import.
- The package is **not** created by this ADR; creation is the first EPIC-04 implementation task,
  gated on this ADR's acceptance.
