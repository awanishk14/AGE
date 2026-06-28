# AGE — System Map (Master Blueprint)

> **Read this first.** This is the single master blueprint of the AGE platform: every package,
> dependency, engine, capability, execution system, integration, data flow, and the rules that hold
> them together. Once approved, architecture enters **freeze mode** and implementation leads.
>
> Status: pre-freeze · Milestone: `foundation-v0.1` (Cognitive Core complete).

---

## 1. The four layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PLATFORM LAYER   Domain (DDD) · BKG · BIF · RIE · SIE                          │  pure
├─────────────────────────────────────────────────────────────────────────────┤
│ CAPABILITY LAYER Market Discovery · Intelligence · Growth · Authority ·        │  pure
│                  Operations · Revenue            (built on @age/capability-kit)│
├─────────────────────────────────────────────────────────────────────────────┤
│ EXECUTION LAYER  SEO · Ads · Content · Reporting · Proposal · CRM ·            │  SIDE EFFECTS
│                  Automation · Project Mgmt · SSH · Publishing                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ INFRASTRUCTURE   Database · Queue · Cache · Storage · Integrations             │  adapters
└─────────────────────────────────────────────────────────────────────────────┘
```

**Layer responsibilities**

| Layer          | Responsibility                                | May do                                              | May NOT do          |
| -------------- | --------------------------------------------- | --------------------------------------------------- | ------------------- |
| Platform       | Model, store and reason over business truth   | read, validate, analyze, score, reason              | side effects        |
| Capability     | Turn decisions into capability-specific plans | read, analyze, prioritize, propose                  | side effects        |
| Execution      | Carry out plans in the world                  | publish, deploy, update, create, delete, send, push | invent strategy     |
| Infrastructure | Persistence, transport, external I/O          | store, queue, cache, call APIs                      | hold business logic |

---

## 2. Packages (current — `foundation-v0.1`)

| Package                                   | Role                                                                                                                           | Internal deps                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `@age/shared`                             | Domain kernel: Entity, AggregateRoot, ValueObject, Repository, DomainEvent, Result, UniqueId, typed IDs, value objects, events | —                                                                  |
| `@age/types`                              | Shared platform types & Zod                                                                                                    | —                                                                  |
| `@age/config`                             | Shared tsconfig presets                                                                                                        | —                                                                  |
| `@age/ui`                                 | React component library (shadcn/ui)                                                                                            | —                                                                  |
| `@age/sdk`                                | Typed client SDK                                                                                                               | `@age/types`                                                       |
| `@age/integrations`                       | Integration provider contracts (Google, Meta, GitHub, …)                                                                       | `@age/types`                                                       |
| `@age/knowledge`                          | Knowledge interfaces, ontology, relationship defs                                                                              | `@age/types`                                                       |
| `@age/business-knowledge-graph` (BKG)     | Canonical ontology: 26 nodes, 22 relationships                                                                                 | `@age/shared`                                                      |
| `@age/persistence`                        | Persistence architecture (ports, base fields, audit, version, Prisma)                                                          | `@age/business-knowledge-graph`, `@age/shared`                     |
| `@age/bif`                                | Business Intelligence Framework: truth model + BIFFieldRef + truth-protection layer                                            | —                                                                  |
| `@age/research-intelligence-engine` (RIE) | Evidence sensing layer (Evidence, signals, mapping proposals)                                                                  | `@age/bif`                                                         |
| `@age/strategy-intelligence-engine` (SIE) | Decision layer (opportunities, recommendations, roadmap, simulations, DecisionPackage)                                         | `@age/bif`                                                         |
| `apps/api`                                | NestJS host (20 domain modules)                                                                                                | `@age/integrations`, `@age/knowledge`, `@age/shared`, `@age/types` |
| `apps/web`                                | Next.js front-end                                                                                                              | `@age/sdk`, `@age/types`, `@age/ui`                                |

## 3. Packages (planned — Capability Layer)

| Package                            | Role                                                                                                                       | Planned deps       |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `@age/capability-kit`              | Shared capability contracts, base, events, errors, metrics, outputs (CapabilityOutput), validators, **CapabilityRegistry** | `@age/bif`         |
| `@age/capability-market-discovery` | SEO/AEO/GEO/Local/competitor/keyword opportunities                                                                         | kit, SIE, BIF, BKG |
| `@age/capability-intelligence`     | Evidence validation, dedup, quality scoring, contradiction resolution, confidence propagation, freshness                   | kit, RIE, BIF, BKG |
| `@age/capability-growth`           | Ads plans, CRO, funnel, landing-page strategy                                                                              | kit, SIE, BIF      |
| `@age/capability-authority`        | Content, PR, backlink, review, video, podcast strategy                                                                     | kit, SIE, BIF      |
| `@age/capability-operations`       | Project plans, reporting, assignments, SOPs, QA, delivery                                                                  | kit, SIE, BIF      |
| `@age/capability-revenue`          | Proposals, lead qualification, CRM recs, pipeline, upsell                                                                  | kit, SIE, BIF      |

> `Capability` enum has 7 values; **Strategy** is realized by the platform-layer **SIE** (no
> `capabilities/` package). The other six map 1:1 to the packages above.

## 4. Dependency graph (current)

```
shared ─┬─▶ business-knowledge-graph ─▶ persistence
        └─▶ (kernel for domain modules in apps/api)

bif ─┬─▶ research-intelligence-engine (RIE)
     └─▶ strategy-intelligence-engine (SIE)

types ─▶ sdk, integrations, knowledge
apps/api  ─▶ integrations, knowledge, shared, types
apps/web  ─▶ sdk, types, ui
```

Planned capability edges:

```
capability-kit ─▶ {market-discovery, intelligence, growth, authority, operations, revenue}
intelligence  ─▶ RIE, BIF, BKG
{market-discovery, growth, authority, operations, revenue} ─▶ SIE, BIF, BKG
```

## 5. Dependency rules (enforced)

1. **Dependencies point inward.** Presentation → Application → Domain ← Infrastructure. The domain
   depends only on `@age/shared`.
2. **No cross-domain module imports.** Domain modules collaborate via published ports/events.
3. **The BKG is canonical.** Schemas and APIs conform to the ontology, never the reverse.
4. **Engines never write upstream.** RIE proposes (never writes BIF); SIE reads (never writes
   BIF/RIE/BKG); capabilities read (never write platform engines).
5. **Only the Execution Layer has side effects.** Every layer above it is pure.
6. **Capabilities are registry-driven.** No hardcoded capability references (see CapabilityRegistry).
7. **One identity concept.** All IDs are `UniqueId`-based (branded) from `@age/shared`.

## 6. Canonical data flow (end-to-end lifecycle)

```
(1) External Sources         Reddit · G2 · Competitor sites · Google · YouTube · Ads · GitHub · …
        │  raw data
(2) RIE                      adapters → normalize → extract signals → Evidence (state: NEW)
        │  Evidence + ExtractedSignals + BIFMapping proposals
(3) Intelligence Capability  validate · dedup · quality-score · resolve conflicts · propagate
        │                    confidence · freshness        (Evidence → PROCESSED → MAPPED)
        │  curated, trusted evidence + resolved conflicts
(4) BIF                      apply approved mappings → fields gain value+source+confidence+history
        │                    (Evidence → APPLIED_TO_BIF; conflicts tracked, never overwritten)
        │  business truth (versioned, provenance-aware)
(5) SIE                      opportunity discovery → prioritization → recommendations →
        │                    roadmap → simulation → DecisionPackage
        │  DecisionPackage (opportunities, recommendations, roadmap, simulations)
(6) Capability Layer         each capability turns decisions into capability plans across its
        │                    ExecutionDomains (e.g. Market Discovery → SEO/AEO/GEO plans)
        │  capability plans (still pure decision objects)
(7) Execution Layer          SIDE EFFECTS: publish, deploy, send, update, push
        │  results / outcomes
(8) Feedback loop            execution outcomes re-enter as new Evidence → back to (2)
```

Every step is **traceable**: signal → evidence → mapping → exact `BIFFieldRef` → decision →
capability plan → execution. Contradictions are lifecycle-tracked, never silently overwritten.

## 7. Engines & capabilities (summary)

- **Platform engines:** BKG (semantic), BIF (truth), RIE (evidence), SIE (decisions).
- **Capabilities:** Market Discovery, Intelligence, Growth, Authority, Operations, Revenue
  (extensible via the registry — Sales, Customer Success, Finance, HR, … register without
  architectural change).
- **Execution systems (Phase 5):** SEO, Ads, Content, Reporting, Proposal, CRM, Automation,
  Project Management, SSH, Publishing.

## 8. Integrations

Contracts live in `@age/integrations` (common `IntegrationProvider`): Google, Google Ads, Search
Console, GA4, Meta, LinkedIn, GitHub, SSH, Reddit, G2, YouTube, Trustpilot. Concrete adapters are
infrastructure; they are sources for RIE and execution surfaces for the Execution Layer. No API
calls exist yet — interfaces only.

## 9. Infrastructure

| Concern       | Technology           | Where                                                   |
| ------------- | -------------------- | ------------------------------------------------------- |
| Database      | PostgreSQL + Prisma  | `@age/persistence` (architecture); `docker-compose.yml` |
| Cache / Queue | Redis                | `docker-compose.yml`; adapters later                    |
| Storage       | TBD (object storage) | infrastructure layer                                    |
| Integrations  | provider adapters    | `@age/integrations` + execution engines                 |

## 10. Roadmap & delivery model

| Phase | Name                 | Contents                                                                              | Status               |
| ----- | -------------------- | ------------------------------------------------------------------------------------- | -------------------- |
| 1     | Cognitive Core       | Domain · BKG · BIF · RIE · SIE                                                        | ✅ `foundation-v0.1` |
| 2     | Intelligence         | Capability Kit · Intelligence · Market Discovery                                      | Next                 |
| 3     | Growth               | Growth · Authority                                                                    | —                    |
| 4     | Agency Operations    | Operations · Revenue                                                                  | —                    |
| 5     | Autonomous Execution | SEO · Ads · Content · Reporting · Proposal · CRM · Automation · PM · SSH · Publishing | —                    |

From Phase 2, work is organized into **epics** with tasks inside them
(e.g. `Epic 02: Market Discovery / TASK-003`).

## 11. Decision records

ADR-0001 Record decisions · 0002 PostgreSQL over Neo4j · 0003 BKG canonical · 0004 Modular monolith ·
0005 LangGraph · 0006 Capability-based architecture · 0007 Capability vs ExecutionDomain ·
0008 Capability Registry. See [`docs/adrs/`](../adrs/) and
[CAPABILITY_ARCHITECTURE.md](./CAPABILITY_ARCHITECTURE.md).
