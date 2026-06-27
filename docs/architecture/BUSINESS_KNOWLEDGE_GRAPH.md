# AGE — Business Knowledge Graph (BKG)

> Status: Canonical domain representation (Task 004). No implementation, no database.

## Purpose

The Business Knowledge Graph is the **core data model of AGE** — the canonical representation of
how AGE understands an organization. It is **not** a database and **not** an ORM model. Every
future module, AI agent, workflow and recommendation reads this model.

It lives in `packages/business-knowledge-graph` and is a **pure, framework-independent domain
model**: it does not depend on PostgreSQL, Prisma, or NestJS. The only dependency is the
`@age/shared` kernel (for the single `UniqueId` identity concept).

## Node Types (26)

The graph recognises exactly these concepts (no more, no fewer):

`Organization`, `Person`, `Brand`, `Product`, `Service`, `Market`, `ICP`, `Competitor`,
`Strategy`, `Goal`, `Initiative`, `Campaign`, `Content`, `Research`, `Evidence`, `Decision`,
`Project`, `Workflow`, `Asset`, `Integration`, `Problem`, `Opportunity`, `Metric`, `Document`,
`Meeting`, `Technology`.

Every node exposes the common `BusinessNode` shape: `id`, `nodeType`, `metadata`, `createdAt`,
`updatedAt`.

## Relationship Types (16 verbs)

`OWNS`, `OFFERS`, `SOLVES`, `EXISTS_IN`, `CONTAINS`, `TARGETS`, `DEFINES`, `CREATES`,
`PROMOTES`, `SUPPORTS`, `GENERATES`, `EXECUTES`, `PRODUCES`, `ENABLES`, `CONNECTS`, `IMPACTS`.

## Canonical Relationships (22)

| From         | Verb      | To         |
| ------------ | --------- | ---------- |
| Organization | OWNS      | Brand      |
| Brand        | OFFERS    | Product    |
| Product      | SOLVES    | Problem    |
| Problem      | EXISTS_IN | Market     |
| Market       | CONTAINS  | Competitor |
| Competitor   | TARGETS   | ICP        |
| Strategy     | DEFINES   | Goal       |
| Goal         | CREATES   | Initiative |
| Initiative   | CREATES   | Project    |
| Campaign     | PROMOTES  | Product    |
| Campaign     | TARGETS   | ICP        |
| Content      | SUPPORTS  | Campaign   |
| Research     | GENERATES | Evidence   |
| Evidence     | SUPPORTS  | Decision   |
| Decision     | CREATES   | Workflow   |
| Workflow     | EXECUTES  | Project    |
| Project      | PRODUCES  | Metric     |
| Meeting      | PRODUCES  | Decision   |
| Document     | SUPPORTS  | Strategy   |
| Technology   | ENABLES   | Workflow   |
| Integration  | CONNECTS  | Technology |
| Opportunity  | IMPACTS   | Goal       |

## Design Principles

1. **Canonical, not convenient.** The ontology is the single source of truth for what AGE knows.
   Modules and the database conform to it — not the reverse.
2. **Framework independence.** No persistence, transport or framework types leak into the model.
3. **Definitions, not behaviour.** Nodes, relationships, queries, graphs and builders are
   declared as interfaces/enums/definitions. No traversal, inference or persistence logic.
4. **Single identity.** All identifiers are `UniqueId`-based (branded) and live in `@age/shared`.
   There is no second "Identifier" concept.
5. **Closed vocabulary.** Node and relationship types are enums; adding a concept is a deliberate,
   reviewable ontology change, not an ad-hoc string.

## Package structure

```
packages/business-knowledge-graph/src/
├── ontology/        BusinessOntology.ts (NodeType, RelationshipType, ONTOLOGY_REGISTRY)
├── nodes/           one interface per node type (26)
├── relationships/   RelationshipDefinition + RELATIONSHIP_DEFINITIONS (22)
├── interfaces/      BusinessNode, BusinessRelationship, BusinessGraph, BusinessQuery, GraphBuilder
├── queries/         placeholder query contracts (FindOrganization, FindProducts, …)
├── builders/        placeholder builders (OrganizationBuilder, StrategyBuilder, …)
├── graph/           graph composition surface (placeholder)
├── types/           shared structural types
└── index.ts
```

## Future Expansion Strategy

- **New concepts** are added by extending `NodeType` and (if needed) `RelationshipType`, plus a
  node interface and ontology registry entry — a reviewed ontology change.
- **Queries** graduate from placeholder contracts to concrete read-models without changing nodes.
- **Persistence** (Task 005+) maps the BKG onto PostgreSQL. The mapping lives in infrastructure;
  the BKG itself never imports the database.
- **Graph algorithms / inference** (traversal, path-finding, recommendations) build on top of the
  `BusinessGraph` interface in a separate engine — the model stays pure.
