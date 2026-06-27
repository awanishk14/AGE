# Campaign Module

## Purpose

Campaigns, channels and timelines.

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

- `CampaignAggregate` — the canonical domain root.

## Repository port

- `CampaignRepository` (interface only).

## Identifier

- `CampaignId` — re-exported from `@age/shared` (single UniqueId-based identity).

## Dependencies

`@age/shared` (domain kernel only). No cross-domain dependencies.
