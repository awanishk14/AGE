# ADR 0012: Market Discovery Input Contract Boundary

- Status: Accepted
- Date: 2026-07-02

## Context

EPIC-03 introduces the **Market Discovery Capability** (`@age/capability-market-discovery`), a
pure, deterministic capability that identifies and scores opportunity candidates. Per the
Capability Contract (CAPABILITY_ARCHITECTURE §4), a capability consumes — read-only, by
reference — SIE `DecisionPackage` / `StrategyOpportunity`, BIF field references (`BIFFieldRef`),
BKG nodes, and curated evidence, and produces decision objects. It never writes to platform
engines.

Market Discovery must therefore obtain input **types** describing those references. Two options
exist for how the capability package acquires them:

1. **Direct import** from the implementation packages — `@age/strategy-intelligence-engine`,
   `@age/bif`, and the BKG package. This couples a pure capability to three engine/framework
   implementation packages. Their internal types (e.g. SIE's `DecisionPackage`,
   `StrategyOpportunity`; BIF's `BIFFieldRef`, `SectionType`) are those packages' to evolve; a
   direct dependency lets an internal refactor of any engine silently break Market Discovery, and
   drags engine implementation surface (and its transitive deps) into a capability that should be
   pure.
2. **Local re-declaration** of the needed reference shapes inside
   `@age/capability-market-discovery`. This duplicates canonical shapes (`BIFFieldRef`, SIE
   opportunity fields) and guarantees drift the first time either side changes independently.

This is the same boundary problem ADR-0010 resolved for evidence between RIE (producer) and the
Intelligence Capability (consumer): direct import couples a capability to an engine; local
re-declaration duplicates canonical definitions. ADR-0010's resolution — a neutral shared
contract package — applies directly here.

## Decision

Introduce a neutral shared contracts package: **`@age/market-discovery-contracts`**.

It owns the canonical, framework-agnostic input contract types that Market Discovery consumes:

- `MarketDiscoveryInput` — the top-level in-memory input contract for a single capability
  invocation (client/organization scope plus the read-only references below). Market Discovery
  does **not** read a live datastore; the caller assembles this contract and passes it in, exactly
  as `EvidencePackage` was passed to the Intelligence Capability in EPIC-02.
- `MarketSignal` — a neutral, read-only shape describing a market signal the capability reasons
  over (derived upstream; Market Discovery does not collect it).
- `MarketOpportunitySourceRef` — a neutral provenance reference tying a derived opportunity back
  to its originating input reference(s).
- Any read-only **reference shapes** for SIE/BIF/BKG that Market Discovery needs (e.g. a neutral
  mirror of `BIFFieldRef` and of the SIE opportunity/decision fields actually consumed). These are
  reference/address shapes only — no engine behavior, resolution, or lookup logic.

These neutral reference shapes are **intentionally small and read-only**. They mirror only the
minimal address/reference fields Market Discovery actually reads (e.g. a field reference's
`section`/`fieldKey`/`path`, or an opportunity's id/impact/confidence), **not** full copies of the
SIE/BIF/BKG domain models. The contracts package must not grow into a parallel re-implementation of
those engines' domain types.

Boundary rules (mirroring ADR-0010):

- `@age/market-discovery-contracts` must remain a **pure contract package**: no runtime services,
  no business logic, no persistence, no orchestration, and no dependency on
  `@age/strategy-intelligence-engine`, `@age/bif`, the BKG package, `@age/research-intelligence-engine`,
  `@age/capability-market-discovery`, NestJS, Prisma, or any application package. It may depend
  only on other pure contract/type packages if strictly necessary.
- `@age/capability-market-discovery` depends on `@age/capability-kit` and
  `@age/market-discovery-contracts` **only** — never directly on SIE, BIF, BKG, or RIE.
- If, in future, the producer side (SIE/BIF) should emit values conforming to these contracts,
  that alignment is a separate follow-up (as RIE's migration was under ADR-0010) and is **not**
  part of this ADR. EPIC-03 does not require SIE/BIF to change.

```
@age/market-discovery-contracts   (canonical MarketDiscoveryInput, MarketSignal,
        ^                           MarketOpportunitySourceRef, read-only refs — no logic)
        |
@age/capability-market-discovery  (consumer — pure capability)
```

This ADR decides only the **input** boundary and the existence/purity rules of the contracts
package. The **boundary decision is final**: Market Discovery consumes its input via a neutral
`@age/market-discovery-contracts` package and never imports SIE/BIF/BKG/RIE. The exact field-level
shapes of `MarketDiscoveryInput`, `MarketSignal`, `MarketOpportunitySourceRef`, and the output
`MarketDiscoveryOpportunityItem` are deliberately **not** frozen here — they are fixed in the first
EPIC-03 implementation task (package creation). Fixing shapes later does not reopen the boundary
decision.

## Consequences

- Market Discovery never depends on SIE/BIF/BKG/RIE implementation packages; those engines can
  refactor internals freely as long as they can still supply values conforming to the contracts.
- Canonical reference shapes are declared once in the neutral package, preventing drift and
  keeping the capability pure and cheap to test (no engine transitive dependencies).
- Adds one more package to build/version, and — because the contracts neutrally mirror some
  SIE/BIF reference shapes rather than importing them — introduces a small, deliberate duplication
  that must be kept consistent with those engines until/unless a future ADR aligns the producer
  side (accepted trade-off for boundary purity, consistent with ADR-0010).
- Establishes a reusable pattern: each future pure capability that consumes platform outputs gets
  a neutral `@age/<capability>-contracts` boundary rather than importing engines directly.
- The package is **not** created by this ADR; creation is the first EPIC-03 implementation task,
  gated on this ADR's acceptance.
