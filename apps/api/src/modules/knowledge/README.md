# Knowledge Module

## Purpose

Structured business knowledge.

## Layered structure (Clean Architecture)

```
presentation/    → controllers (transport boundary)
application/     → services (use-cases), DTOs, validators
domain/          → aggregates (canonical root), repositories (ports), types, interfaces
infrastructure/  → persistence & external adapters (placeholder)
tests/           → module specs
```

Dependencies point inward: presentation → application → domain. Infrastructure
implements the domain's repository ports. Domain depends only on the
`@age/shared` kernel (Entity, AggregateRoot, ValueObject, Repository).

## Aggregate root

- `KnowledgeAggregate` — the canonical domain root.

## Repository port

- `KnowledgeRepository` (interface only).

## Identifier

- `KnowledgeId` — re-exported from `@age/shared` (single UniqueId-based identity).

## Dependencies

`@age/shared` (domain kernel only). No cross-domain dependencies.
