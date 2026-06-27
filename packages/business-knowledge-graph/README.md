# @age/business-knowledge-graph

The canonical **Business Knowledge Graph (BKG)** — how AGE understands an organization.

Pure domain model. Framework-independent. **No** PostgreSQL, Prisma, NestJS or graph algorithms.

```
src/
  ontology/        NodeType + RelationshipType enums, ONTOLOGY_REGISTRY
  nodes/           one interface per node type (26)
  relationships/   RelationshipDefinition + RELATIONSHIP_DEFINITIONS (22)
  interfaces/      BusinessNode, BusinessRelationship, BusinessGraph, BusinessQuery, GraphBuilder
  queries/         placeholder query contracts
  builders/        placeholder builders
  graph/           graph composition surface (placeholder)
  types/           shared structural types
```

See `docs/architecture/BUSINESS_KNOWLEDGE_GRAPH.md` for the full design.
