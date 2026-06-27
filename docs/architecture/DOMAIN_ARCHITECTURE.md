# AGE — Domain Architecture

> Status: Layered foundation (Task 003). No business logic implemented.

AGE (Adaptive Growth Engine) is built as a **Modular Monolith** that is **microservice-ready**,
following **Domain-Driven Design (DDD)**, **Clean Architecture**, and **SOLID**. The architecture
is designed to scale from **Founder Edition → Agency Edition → Commercial SaaS → Enterprise**
without major restructuring.

## The four layers

Each domain module is split into four layers plus tests:

```
presentation/    Controllers — the transport/delivery boundary.
application/     Use-cases (services), DTOs, validators — orchestrates the domain.
domain/          Entities, aggregates, repository ports, types, interfaces — the core.
infrastructure/  Persistence & external adapters that implement domain ports.
tests/           Module specs.
```

## Dependency direction (Clean Architecture)

Dependencies always point **inward**. Outer layers know about inner layers; inner
layers know nothing about outer layers.

```
        Presentation
             │  depends on
             ▼
        Application
             │  depends on
             ▼
          Domain  ◄── implemented by ── Infrastructure
             │
             ▼
   @age/shared (domain kernel)
```

- **Presentation** depends on **Application** (calls use-cases). It never touches the domain directly for logic.
- **Application** depends on **Domain** (entities, aggregates, repository ports).
- **Domain** depends on nothing except the **`@age/shared` kernel** (`Entity`, `AggregateRoot`,
  `ValueObject`, `Repository`, `DomainEvent`, …). It has **no** framework, DB, or transport imports.
- **Infrastructure** depends on **Domain** — it _implements_ the repository ports defined there.
  The domain never imports infrastructure (Dependency Inversion).

This keeps the domain pure and portable: swapping Postgres, the web framework, or extracting a
module into its own service does not touch domain code.

## Domain kernel — `@age/shared/domain`

Base abstractions every domain builds on (placeholders, no business logic):

| Abstraction     | Role                                          |
| --------------- | --------------------------------------------- |
| `Entity`        | Identity-based domain object.                 |
| `AggregateRoot` | Consistency boundary; collects domain events. |
| `ValueObject`   | Immutable, equality-by-value object.          |
| `DomainEvent`   | Base for events raised by aggregates.         |
| `Repository`    | Persistence port for an aggregate.            |
| `Specification` | Composable business rule.                     |
| `Result`        | Explicit success/failure outcome.             |
| `DomainError`   | Base domain error with a stable `code`.       |
| `UniqueId`      | Typed identifier base.                        |
| `Clock`         | Abstraction over current time (testability).  |

Shared **value objects** (`Email`, `Phone`, `URL`, `Money`, `Percentage`, `DateRange`,
`GeoLocation`, `Language`, `Country`, `Currency`, `Timezone`, `Slug`, `Identifier`) and shared
**domain events** (`OrganizationCreated`, `StrategyUpdated`, `ResearchCompleted`,
`CampaignApproved`, `ContentPublished`, `DecisionApproved`, `ProjectCompleted`, `EvidenceAdded`,
`KnowledgeUpdated`) extend these base classes.

## Bounded contexts (20 domain modules)

`organization`, `people`, `brand`, `product`, `service`, `market`, `icp`, `competitor`,
`strategy`, `research`, `evidence`, `knowledge`, `campaign`, `content`, `project`, `decision`,
`integration`, `reporting`, `workflow`, `problem` — each under `apps/api/src/modules/<module>`
with the four-layer structure above and a placeholder **aggregate root (canonical domain root)**
plus repository port. Standalone entity placeholders were removed; the aggregate is the root.
Identifiers (`<Module>Id`) are re-exported from the `@age/shared` kernel.

## Canonical model — `@age/business-knowledge-graph`

The canonical data model of AGE is the **Business Knowledge Graph (BKG)**: a pure,
framework-independent ontology of 26 node types and 22 relationships that every module, agent and
workflow reads. See [BUSINESS_KNOWLEDGE_GRAPH.md](./BUSINESS_KNOWLEDGE_GRAPH.md).

## Knowledge layer — `@age/knowledge`

- **Ontology** (`ontology/`): one `OntologyNode` per concept (`Organization`, `Brand`, `Product`,
  `Service`, `Market`, `ICP`, `Competitor`, `Goal`, `Objective`, `Initiative`, `Campaign`,
  `Content`, `Decision`, `Evidence`, `Research`, `Project`, `Workflow`, `Asset`, `Integration`),
  each exposing `name`, `description`, `relationships`, `metadata`.
- **Relationship engine** (`relationship-engine/`): typed `RelationshipDefinition` records (e.g.
  `Organization OWNS Brand`, `Evidence SUPPORTS Decision`, `Project EXECUTES Strategy`).

## Modular Monolith → Microservices

All modules register through `DOMAIN_MODULES` and compose in `AppModule`. Because each module is
self-contained with explicit boundaries and a pure domain, extracting one into its own service
later means moving the folder and adding a transport — not rewriting domain logic.
