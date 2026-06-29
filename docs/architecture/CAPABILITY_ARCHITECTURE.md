# AGE — Capability Architecture (APPROVED)

> Status: **Approved with modifications** (post-Task-008, pre-Task-009). No code. This is the
> architectural contract for all future capability development. It supersedes prior discussions.

## 1. The strategic correction

Everything through Task 008 is a **platform engine**:

```
BKG  → semantic model        BIF  → business truth
RIE  → external evidence      SIE  → structured decisions
```

The temptation now is to build **channel engines** (SEO Engine, Ads Engine, Content Engine). That
is how every marketing platform (SEMrush, etc.) is built. **AGE is built differently** — it is the
**operating system for a growth agency**, so it models **how agencies create business outcomes**,
not how marketing software categorizes features. Everything after the platform layer is organized
around **business capabilities**, not channels.

> A channel (SEO, Google Ads, a blog) is an **execution path**, never a capability.

## 2. Two axes: Capability vs ExecutionDomain (Decision 1)

These are **two separate concepts and must never be collapsed into one enum.**

- **Capability** answers _"why are we doing this?"_
- **ExecutionDomain** answers _"where will this be executed?"_

```
Capability                         ExecutionDomain
----------                         ---------------
MarketDiscovery                    SEO        AEO        GEO       LocalSEO
Intelligence                       GoogleAds  MetaAds    LinkedInAds
Strategy                           CRO        Content    Email     PR
Growth                             CRM        Reporting  Automation
Authority                          SSH        Publishing
Operations
Revenue
```

`StrategyOpportunity` will eventually carry both axes:

```
StrategyOpportunity {
  capability         // why
  executionDomains[] // where
  priority
  impact
  confidence
}
```

> **`OpportunityCategory` is NOT replaced.** `Capability` and `ExecutionDomain` are introduced as
> new, separate enums. (Reconciling/retiring `OpportunityCategory` is deferred to implementation.)

## 3. Layered position & the Intelligence Capability (Decision 2)

The Intelligence Capability sits **between RIE and BIF** — it validates evidence _before_ it
becomes business truth. The corrected canonical flow:

```
External Sources
      │
      ▼
Research Intelligence Engine (RIE)        — collects evidence
      │
      ▼
Intelligence Capability                   — validates · deduplicates · scores quality ·
      │                                     resolves contradictions · confidence propagation ·
      ▼                                     evidence freshness
Business Intelligence Framework (BIF)      — stores business truth
      │
      ▼
Strategy Intelligence Engine (SIE)        — produces business decisions
      │
      ▼
Capability Layer (MarketDiscovery, Growth, Authority, Operations, Revenue)
      │
      ▼
Execution Layer (side effects only)
```

| Component                   | Responsibility                                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| RIE                         | Collects evidence                                                                                                                 |
| **Intelligence Capability** | Validates, deduplicates, scores quality, resolves contradictions, calculates confidence propagation, maintains evidence freshness |
| BIF                         | Stores business truth                                                                                                             |
| SIE                         | Produces business decisions                                                                                                       |

## 4. The Capability Contract

Every capability:

- **Consumes (read-only, by reference):** SIE `DecisionPackage`, BIF (`BIFFieldRef`), BKG nodes,
  curated evidence. It **never writes** to platform engines.
- **Produces:** capability-specific **plan / opportunity objects** — decision objects, not side effects.
- **Orchestrates multiple ExecutionDomains** beneath one business outcome.
- **Never executes.** Execution is the Execution Layer; engines there consume capability outputs.

## 5. Capability Kit (Decision 3)

A shared package every capability inherits from, guaranteeing consistent contracts and output
envelopes:

```
packages/capability-kit/src/
  contracts/    capability contract interfaces (Capability, CapabilityRegistry entry)
  base/         base capability abstractions
  events/       capability lifecycle events
  errors/       capability error types
  metrics/      capability metric contracts
  outputs/      CapabilityOutput envelope + item base
  validators/   Zod schemas
```

## 6. Package layout (Decision 4)

```
packages/
  capabilities/
    market-discovery/    @age/capability-market-discovery
    intelligence/        @age/capability-intelligence
    growth/              @age/capability-growth
    authority/           @age/capability-authority
    operations/          @age/capability-operations
    revenue/             @age/capability-revenue
  capability-kit/        @age/capability-kit
```

Capabilities live **only** under `packages/capabilities/`. No scattered capability packages.

> Note on the `Capability` enum vs packages: the enum has 7 values. **Strategy** is realized by the
> platform-layer **SIE** (not a `capabilities/` package); the other six map 1:1 to the packages above.

## 7. The capabilities

- **Market Discovery** (renamed from "Discovery", Decision 7) — find opportunities: SEO, AEO, GEO,
  Local SEO, competitor, keyword. (Renamed because Product/User/Internal Discovery may follow;
  "Discovery" alone is ambiguous.)
- **Intelligence** — truth quality (see §3); sits between RIE and BIF.
- **Growth** — Google/Meta/LinkedIn Ads plans, CRO, funnel optimization, landing-page strategy.
- **Authority** — content strategy, thought leadership, PR, backlink, review, video, podcast.
- **Operations** — project plans, client reporting, team assignments, SOP execution, QA, delivery tracking.
- **Revenue** — proposal generation, lead qualification, CRM recommendations, pipeline health, upsell, account growth.

## 8. Execution boundary (Decision 5)

**Execution engines are the ONLY components allowed to perform side effects.** Everything before
the Execution Layer must remain pure.

| Pure layers may                                                   | Execution layer may                                                          |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| read · validate · analyze · score · reason · prioritize · propose | publish · deploy · update · create · delete · modify · send · execute · push |

This boundary must never be violated.

## 9. Capability Registry (Decision 6)

Capabilities must never be hardcoded across the platform. A **CapabilityRegistry** is the canonical
source of capability metadata. Each capability declares:

```
CapabilityRegistryEntry {
  name
  consumes
  produces
  outputs
  executionDomains[]
  dependencies[]
}
```

Future capabilities (Sales, Customer Success, Finance, HR, …) must be **registerable without
architectural changes**.

## 10. Revised roadmap

| Phase | Name                     | Contents                                                                              | Status                          |
| ----- | ------------------------ | ------------------------------------------------------------------------------------- | ------------------------------- |
| 1     | **Cognitive Core**       | Domain · BKG · BIF · RIE · SIE                                                        | ✅ Complete (`foundation-v0.1`) |
| 2     | **Intelligence**         | Capability Kit · Intelligence Capability · Market Discovery Capability                | Next                            |
| 3     | **Growth**               | Growth Capability · Authority Capability                                              | —                               |
| 4     | **Agency Operations**    | Operations Capability · Revenue Capability                                            | —                               |
| 5     | **Autonomous Execution** | SEO · Ads · Content · Reporting · Proposal · CRM · Automation · PM · SSH · Publishing | —                               |

> From Task 009, implementation is organized into **epics** (e.g. Epic 01: Intelligence Platform,
> Epic 02: Market Discovery, …) with tasks inside each (e.g. `EPIC-02 / TASK-003`).

## 11. Decision records

- ADR-0006 — Capability-based architecture (Accepted).
- ADR-0007 — Separate `Capability` from `ExecutionDomain` (two axes).
- ADR-0008 — Capability Registry.

The full platform blueprint lives in [AGE_SYSTEM_MAP.md](./AGE_SYSTEM_MAP.md).
