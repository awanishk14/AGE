# AGE — Persistence Architecture

> Status: Persistence foundation (Task 005). Architecture only — no SQL, no Prisma models, no migrations.

## The three layers

```
        Business Knowledge Graph (canonical model)
          @age/business-knowledge-graph
                      │
                      │  mapped by (mappers)
                      ▼
            Persistence Layer (ports & contracts)
                  @age/persistence
                      │
                      │  implemented by (infrastructure)
                      ▼
                  PostgreSQL (system of record)
```

## Why these are separate

1. **The Business Knowledge Graph is the canonical business model — not the database.**
   It is a pure, framework-independent representation of how AGE understands an organization.
   It must never depend on PostgreSQL, Prisma or NestJS.

2. **The Persistence Layer is how that model is _stored_, not what it _means_.**
   `@age/persistence` defines the contracts (repositories, unit of work, mappers, base fields)
   that any storage technology must satisfy. It depends on the BKG and the shared kernel, but
   contains no SQL and no Prisma models.

3. **PostgreSQL is the system of record — an implementation detail behind the ports.**
   It is chosen for durability, transactions, JSONB and operational maturity. Swapping or
   augmenting it (read replicas, a graph engine, search) must not touch the BKG or the domain.

Keeping the three separate means the canonical model stays stable while storage evolves, and the
domain never imports infrastructure (Dependency Inversion).

## Standard base fields

Every persisted record carries `PersistedBase`:

| Field                     | Purpose                                                      |
| ------------------------- | ------------------------------------------------------------ |
| `id`                      | Identity (`UniqueId`).                                       |
| `organizationId`          | **Multi-tenancy** — every record belongs to an organization. |
| `createdAt` / `updatedAt` | Timestamps.                                                  |
| `createdBy` / `updatedBy` | Audit attribution.                                           |
| `deletedAt`               | **Soft delete** (null = live).                               |
| `version`                 | Optimistic concurrency + **version history** (1, 2, … N).    |
| `metadata`                | Extensible JSON bag.                                         |

## Multi-tenancy

Every persisted object belongs to an `OrganizationId`, enabling future SaaS isolation.
**Row-Level Security (RLS) is intentionally not implemented yet** — only the architectural
requirement (the tenant column on every record) is established.

## Audit & version model

- **`AuditLog`** — append-only record of every change: `entity`, `entityId`, `action`
  (`CREATE` / `UPDATE` / `DELETE` / `RESTORE`), `before`, `after`, `timestamp`, `actor`, `reason`.
- **`AggregateVersion`** — a historical snapshot of an aggregate at version N, the placeholder
  foundation for version history and **future event sourcing**.

## Package structure

```
packages/persistence/src/
├── types/          PersistedBase, AuditLog, AuditAction, AggregateVersion, Versioned
├── interfaces/     PersistenceProvider, Transaction, UnitOfWork, RepositoryFactory, PersistenceRepository
├── repositories/   10 per-aggregate persistence repository interfaces
├── mappers/        OrganizationMapper, StrategyMapper, DecisionMapper, ResearchMapper, GraphMapper (placeholders)
├── database/       DatabaseConfig surface
├── migrations/     placeholder (added with real models later)
└── prisma/         schema.prisma (datasource + generator only)
```

## Repository layer

Persistence ports (interfaces only, no SQL) exist for: Organization, Strategy, Research, Decision,
Campaign, Project, Content, Evidence, Problem, Opportunity. Each is a
`PersistenceRepository<<Node>, <Id>>` over the BKG node type and the shared typed id.

## Prisma

Prisma is configured with a **datasource** (PostgreSQL via `DATABASE_URL`) and a **generator**
only. No models, no tables, no migrations are defined in this task.
