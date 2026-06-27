# ADR 0002: Use PostgreSQL (not Neo4j) as the system of record

- Status: Accepted
- Date: 2026-06-27

## Context

AGE's canonical model is the Business Knowledge Graph (BKG) — a graph of business concepts and
relationships. A graph model naturally suggests a graph database (Neo4j). We must choose the
system of record that persists the BKG.

## Decision

We will use **PostgreSQL** as the system of record. The BKG remains the canonical _model_;
PostgreSQL _persists_ it. The graph is not the database.

Rationale:

- **Operational maturity** — ubiquitous hosting, backups, replication, tooling and team familiarity.
- **Transactions & integrity** — strong ACID guarantees for multi-tenant, audited, versioned data.
- **Flexibility** — JSONB covers extensible `metadata`; relationships persist as edge rows.
- **One system** — relational + graph-style edges + search (later) without operating a second
  specialised datastore early.
- **Reversibility** — the BKG is framework-independent; a graph engine can be added later as a
  read/inference layer behind the persistence ports without touching the domain.

## Consequences

- Graph traversals are modeled as relational edge tables, not native graph queries (acceptable at
  current scale; revisit if deep traversal becomes hot).
- Prisma is the ORM/migration tool over PostgreSQL.
- If graph workloads demand it later, a dedicated graph engine can be introduced behind
  `@age/persistence` interfaces — a contained change.
