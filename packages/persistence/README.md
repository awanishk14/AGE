# @age/persistence

The **persistence architecture** for AGE. Architecture only — no SQL, no Prisma
models, no migrations, no business logic.

```
src/
  types/          PersistedBase, AuditLog, AggregateVersion (base fields + audit + version)
  interfaces/     PersistenceProvider, Transaction, UnitOfWork, RepositoryFactory, PersistenceRepository
  repositories/   per-aggregate persistence repository interfaces (10)
  mappers/        placeholder mappers (Organization, Strategy, Decision, Research, Graph)
  database/       DatabaseConfig surface
  migrations/     placeholder (migrations added with real models later)
  prisma/         schema.prisma (datasource + generator only)
```

The **Business Knowledge Graph** (`@age/business-knowledge-graph`) is the canonical model.
This package describes how PostgreSQL will persist it. See
`docs/architecture/PERSISTENCE_ARCHITECTURE.md`.
