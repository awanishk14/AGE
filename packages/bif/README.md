# @age/bif — Business Intelligence Framework

The **canonical business model of AGE**: a living, versioned representation of an organization.

Types, interfaces and Zod validators only — **no** business logic, API, database or persistence.

## Core principle

Every field is provenance-aware. A `BIFField` carries its `value` plus `source`,
`confidence`, `lastVerifiedAt` and full `history` (`FieldVersion[]`).

```
src/
  core/        BusinessIntelligenceFramework, BIFSection, BIFField, FieldVersion,
               enums (BIFStatus, FieldType, FieldSource, FieldConfidence), SectionType, Zod schemas
  submodels/   ProductItem, ICP, Persona, KPIs
  sections/    static field schema for all 12 sections + BIF_SECTIONS registry
  index.ts
```
