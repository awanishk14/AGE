# AGE — Domain Map

> Status: Layered foundation (Task 003).

## Canonical module layout (Clean Architecture)

Every domain module under `apps/api/src/modules/<module>` (example: `organization`):

```
organization/
├── README.md
├── index.ts                       # barrel
├── organization.module.ts         # NestJS module (wires presentation + application)
├── presentation/
│   ├── organization.controller.ts
│   └── index.ts
├── application/
│   ├── organization.service.ts
│   ├── dto/{create,update}-organization.dto.ts + index.ts
│   ├── validators/organization.validator.ts + index.ts
│   └── index.ts
├── domain/
│   ├── aggregates/organization.aggregate.ts + index.ts      ← OrganizationAggregate (canonical root)
│   ├── repositories/organization.repository.ts + index.ts   ← OrganizationRepository (port)
│   ├── types/organization.types.ts + index.ts               ← re-exports OrganizationId from @age/shared
│   ├── interfaces/organization.interface.ts + index.ts
│   └── index.ts
├── infrastructure/
│   └── index.ts                   # placeholder (implements domain ports later)
└── tests/
    └── organization.spec.ts
```

All 20 modules share this shape (`organization` … `workflow`, `problem`).

## Domain relationship diagram

Derived from `@age/knowledge/relationship-engine`. These are _knowledge-graph_ relationships
between business concepts (not code dependencies):

```
Organization ──OWNS──▶ Brand ──OFFERS──▶ Product ──SOLVES──▶ Problem
                                                              │
                                                          BELONGS_TO
                                                              ▼
                          Competitor ◀──CONTAINS── Market

Campaign ──PROMOTES──▶ Product
Content  ──SUPPORTS──▶ Campaign

Research ──GENERATES──▶ Evidence ──SUPPORTS──▶ Decision ──CREATES──▶ Project ──EXECUTES──▶ Strategy
```

| From         | Relationship | To         |
| ------------ | ------------ | ---------- |
| Organization | OWNS         | Brand      |
| Brand        | OFFERS       | Product    |
| Product      | SOLVES       | Problem    |
| Problem      | BELONGS_TO   | Market     |
| Market       | CONTAINS     | Competitor |
| Campaign     | PROMOTES     | Product    |
| Content      | SUPPORTS     | Campaign   |
| Evidence     | SUPPORTS     | Decision   |
| Research     | GENERATES    | Evidence   |
| Decision     | CREATES      | Project    |
| Project      | EXECUTES     | Strategy   |

## Code dependency direction (per module)

```
presentation ──▶ application ──▶ domain ◀── infrastructure
                                   │
                                   ▼
                          @age/shared (kernel)
```

No module imports another module. No cyclic dependencies. Cross-context collaboration will go
through published ports/events, never internal entities.

## Composition root

```
apps/api/src/modules/index.ts   # DOMAIN_MODULES registry + per-module barrels
apps/api/src/app.module.ts       # imports ...DOMAIN_MODULES
```
