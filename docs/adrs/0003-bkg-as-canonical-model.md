# ADR 0003: The Business Knowledge Graph is the canonical business model

- Status: Accepted
- Date: 2026-06-27

## Context

AGE will grow many surfaces — API modules, AI agents, workflows, reporting, recommendations. Each
could define its own notion of "what an organization is." Without a single source of truth these
notions drift, and cross-feature reasoning becomes impossible.

## Decision

The **Business Knowledge Graph (BKG)** (`@age/business-knowledge-graph`) is the single canonical
representation of how AGE understands an organization. It is a pure, framework-independent domain
model (nodes, relationships, ontology). Every module, agent and workflow conforms to it; the
database and APIs are derived from it, never the reverse.

Rationale:

- **Shared understanding** — one vocabulary (closed `NodeType` / `RelationshipType` enums) for the
  whole platform.
- **AI-ready** — agents reason over a consistent, explicit ontology rather than ad-hoc shapes.
- **Stability** — the model evolves through deliberate, reviewable ontology changes.

## Consequences

- The BKG must not depend on PostgreSQL, Prisma or NestJS.
- The Prisma schema and module aggregates conform to the ontology; a drift check should enforce this.
- Adding a concept is an ontology change (extend the enums + registry), not an ad-hoc string.
