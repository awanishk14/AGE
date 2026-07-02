# ADR 0010: Evidence Contract Boundary Between RIE and Intelligence

- Status: Accepted
- Date: 2026-07-02

## Context

EPIC-02 (Intelligence Capability — Evidence Processing Layer) must consume `Evidence` and
`EvidencePackage` records produced by the Research Intelligence Engine (`@age/research-intelligence-engine`,
RIE) in order to perform deterministic validation, structural deduplication, quality scoring,
contradiction detection, and freshness calculation.

Two options exist for how `@age/capability-intelligence` obtains these types:

1. **Direct import** from `@age/research-intelligence-engine`. This couples a capability package
   to an engine implementation package. RIE's internal types (`Evidence`, `EvidenceEntityLink`,
   `ExtractedSignal`, `EvidenceSource`, `EvidenceState`, `SignalType`, `Metadata`, defined in
   `packages/research-intelligence-engine/src/evidence/evidence.ts` and `src/types/*`) are RIE's
   to evolve; a direct dependency means any RIE-internal refactor can silently break Intelligence.
2. **Local re-declaration** of `Evidence`/`EvidencePackage` inside `@age/capability-intelligence`.
   This duplicates the canonical shape, and the two definitions will drift the first time either
   package changes independently.

Neither option preserves a clean boundary. AGE's capability architecture (ADR-0006, ADR-0007)
treats capabilities as consumers of well-defined contracts, not as consumers of other packages'
implementation internals.

## Decision

Introduce a new shared contracts package: **`@age/evidence-contracts`**.

This package owns the canonical, framework-agnostic definitions of:

- `Evidence`
- `EvidenceEntityLink`
- `EvidencePackage`
- Supporting enums/types required to describe evidence (`EvidenceSource`, `EvidenceState`,
  `SignalType`, and any `Metadata` shape needed to type these contracts)

`@age/research-intelligence-engine` becomes a **producer**: it depends on
`@age/evidence-contracts` and implements/emits values conforming to those types instead of
declaring them itself.

`@age/capability-intelligence` becomes a **consumer**: it depends on `@age/evidence-contracts`
only, never on `@age/research-intelligence-engine` directly.

```
@age/evidence-contracts   (canonical Evidence, EvidencePackage — no logic)
        ^                          ^
        |                          |
@age/research-intelligence-engine  @age/capability-intelligence
        (producer)                        (consumer)
```

`@age/evidence-contracts` contains type/interface declarations and enums only — no business
logic, no persistence, no orchestration — consistent with how `@age/capability-kit` hosts shared
capability infrastructure without owning any single capability's behavior.

`@age/evidence-contracts` must remain a **pure contract package**:

- no runtime services
- no business logic
- no persistence
- no orchestration
- no dependency on `@age/research-intelligence-engine`, `@age/capability-intelligence`, NestJS,
  Prisma, or any application-layer package

It may depend only on other pure contract/type packages if strictly necessary (e.g. shared
primitive types). It must never depend "downward" on a producer or consumer package.

## Consequences

- Intelligence never depends on RIE's implementation package; RIE can refactor its internals
  freely as long as it continues to produce values conforming to `@age/evidence-contracts`.
- The canonical `Evidence`/`EvidencePackage` shape is declared exactly once, preventing drift
  between producer and consumer.
- Any future consumer of evidence (a second capability, a reporting tool, etc.) depends on
  `@age/evidence-contracts` rather than on RIE, keeping the dependency graph acyclic and shallow.
- RIE's existing `src/evidence/evidence.ts` module (and any other RIE-local module declaring
  `Evidence`, `EvidenceEntityLink`, `EvidencePackage`, or their supporting enums/types) must be
  migrated to import — and, where RIE currently re-exports these types publicly, re-export —
  the definitions from `@age/evidence-contracts`. These types must not be duplicated locally in
  RIE once the migration lands; this migration is a follow-up implementation task, not part of
  this ADR.
- Adds one more package to publish/build/version as part of the monorepo.
