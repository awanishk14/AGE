# Data Dictionary

> Part of the **AGE Product Bible**. See the [Product Bible README](./README.md).

## Purpose

This document is the canonical glossary of **product-level data terms** in AGE and **how they map to
the frozen architecture** — the Business Knowledge Graph (BKG), the Business Intelligence Framework
(BIF), the Research and Strategy engines, the shared kernel, and the Workspace Model (Doc 02).

It exists so every other Product Bible document and every implementation uses **one set of terms with
one meaning**. It is a **terminology map only** — it does not define database schema, APIs, field
formats, or implementation.

> **Status:** In Progress — derived from the frozen architecture and Final Docs 02–04. Terms whose
> canonical fields are not yet defined are referenced (not invented); genuine decisions are surfaced
> in [§7 Open Decisions](#7-open-decisions).

## Scope

- **In scope:** the canonical names, meanings, and source mappings of business entities, standard
  fields, enumerations, and relationships.
- **Out of scope:** database schema, APIs, field-level formats/validation, permissions, UX,
  implementation. Detailed field sets that the architecture has not defined are **not invented here**.

## Status

In Progress.

## Related Documents

- [Workspace Model](./02_WORKSPACE_MODEL.md) · [Client Lifecycle](./03_CLIENT_LIFECYCLE.md) · [AI Agent Architecture](./04_AI_AGENT_ARCHITECTURE.md) — all **Final**.
- [Glossary](./16_GLOSSARY.md) — plain-language terms (this document is the structured/source-mapped view).

**Architecture references (do not modify):**

- [BUSINESS_KNOWLEDGE_GRAPH](../architecture/BUSINESS_KNOWLEDGE_GRAPH.md) · [AGE_SYSTEM_MAP](../architecture/AGE_SYSTEM_MAP.md)

## Table of Contents

- [1. How to Read This Dictionary](#1-how-to-read-this-dictionary)
- [2. Business Containers (Workspace Model)](#2-business-containers-workspace-model)
- [3. Knowledge Entities (BKG)](#3-knowledge-entities-bkg)
- [4. Intelligence Entities (BIF)](#4-intelligence-entities-bif)
- [5. Evidence & Decision Entities (RIE / SIE)](#5-evidence--decision-entities-rie--sie)
- [6. Standard Fields, Enumerations & Relationships](#6-standard-fields-enumerations--relationships)
- [7. Open Decisions](#7-open-decisions)

---

## 1. How to Read This Dictionary

- Each term has a **canonical name**, a **meaning**, and a **source** (the frozen artifact that
  defines it).
- Where the architecture defines a term's fields, this dictionary points to that source rather than
  restating it. Where it does **not**, the term is listed with its meaning and its fields are marked
  deferred — never invented.
- "Source" abbreviations: **BKG** (`@age/business-knowledge-graph`), **BIF** (`@age/bif`), **RIE**
  (`@age/research-intelligence-engine`), **SIE** (`@age/strategy-intelligence-engine`), **Kernel**
  (`@age/shared`), **Persistence** (`@age/persistence`), **Doc 02/03/04** (Product Bible, Final).

## 2. Business Containers (Workspace Model)

The containers that own all other data (Doc 02, Final).

| Term                        | Meaning                                                                                              | Source                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **Organization**            | The platform **tenant** (the agency operating AGE); owns Clients and Shared Agency Resources.        | Doc 02 §4; `organization` domain module |
| **Client**                  | A first-class **business concept** — a business the agency grows; the primary owner of intelligence. | Doc 02 §5                               |
| **Project**                 | A unit of **execution** within a Client; owns execution artifacts.                                   | Doc 02 §7; `project` domain module      |
| **Workspace**               | A **product lens** (navigation/context), not a business entity; carries no ownership.                | Doc 02 §6                               |
| **Shared Agency Resources** | Agency-owned reusable frameworks, templates, playbooks, methodologies.                               | Doc 02 §4, §11                          |

> Detailed field sets for Organization / Client / Project are **not** defined by the frozen
> architecture and are **not invented here** (see [§7](#7-open-decisions)).

## 3. Knowledge Entities (BKG)

The BKG defines the **canonical ontology** (ADR-0003): **26 node types** and **22 relationships**,
instanced **per Client** (Doc 02 §9). Every node shares the `BusinessNode` shape
(`id`, `nodeType`, `metadata`, `createdAt`, `updatedAt`).

**Node types (26):** Organization, Person, Brand, Product, Service, Market, ICP, Competitor,
Strategy, Goal, Initiative, Campaign, Content, Research, Evidence, Decision, Project, Workflow,
Asset, Integration, Problem, Opportunity, Metric, Document, Meeting, Technology.

> **Terminology note (surfaced in §7):** within a Client's graph, the BKG **`Organization`** node
> represents **that client's business**, while the Workspace **Organization** is the agency tenant.
> Same word, two referents — reconciliation is an Open Decision.

## 4. Intelligence Entities (BIF)

The BIF is the client business's living, versioned truth model (Doc 02 §8). Canonical terms:

| Term                                   | Meaning                                                                                                                                                 | Source |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **BusinessIntelligenceFramework**      | The root truth model for one Client (`id`, `organizationId`, `version`, `status`, `sections`, scores, timestamps, optional `dependencies`/`conflicts`). | BIF    |
| **BIFSection**                         | A coherent group of fields (one of 12 canonical sections).                                                                                              | BIF    |
| **BIFField**                           | The atomic, provenance-aware unit: `value` + `source` + `confidence` + `lastVerifiedAt` + `history`.                                                    | BIF    |
| **FieldVersion**                       | A historical version of a field value.                                                                                                                  | BIF    |
| **FieldDependency**                    | Declares a field derived from others (`sourceField`, `derivedField`, `transformationType`, `confidencePropagationRule`).                                | BIF    |
| **FieldConflict**                      | Tracks contradictory values for one field (never silently overwritten).                                                                                 | BIF    |
| **ProductItem / ICP / Persona / KPIs** | BIF sub-models. **Note:** BIF **`Persona`** = a _buyer persona_, distinct from Doc 01 user/agent "personas".                                            | BIF    |

**The 12 canonical BIF sections:** Organization Identity · Vision & Strategy · Products & Services ·
ICP & Personas · Market & Competition · Brand System · GTM System · Marketing Intelligence ·
Technology Stack · Assets · KPIs · Constraints.

## 5. Evidence & Decision Entities (RIE / SIE)

| Term                                                   | Meaning                                                                                            | Source         |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | -------------- |
| **Evidence**                                           | The core RIE output; provenance-aware sensed reality, with a lifecycle `state`.                    | RIE            |
| **ExtractedSignal**                                    | A signal extracted from a normalized document (targets a BIF field).                               | RIE            |
| **IntentCluster**                                      | A cluster of evidence pointing at one market/buyer intent.                                         | RIE            |
| **BIFMapping**                                         | A _proposal_ to change BIF (targets a `BIFFieldRef`); RIE never writes BIF directly.               | RIE            |
| **EvidenceConflict**                                   | A detected contradiction across evidence.                                                          | RIE            |
| **StrategyOpportunity**                                | An evidence-backed opportunity (`capability`, `executionDomains[]`, priority, impact, confidence). | SIE / ADR-0007 |
| **Recommendation**                                     | A concrete recommendation tied to an opportunity.                                                  | SIE            |
| **PriorityScore**                                      | Multi-dimensional opportunity score.                                                               | SIE            |
| **RoadmapItem / SimulationScenario / DecisionPackage** | Roadmap entry · what-if scenario · the bundled SIE output.                                         | SIE            |

## 6. Standard Fields, Enumerations & Relationships

### 6.1 Standard persisted fields (`PersistedBase`)

Every persisted record carries: `id`, `organizationId`, `createdAt`, `updatedAt`, `createdBy`,
`updatedBy`, `deletedAt`, `version`, `metadata`. (Source: Persistence.)

### 6.2 Canonical enumerations

| Enumeration                                        | Values (summary)                                                                                                                                    | Source   |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **BIFStatus**                                      | Draft · Active · NeedsReview                                                                                                                        | BIF      |
| **FieldType**                                      | string · number · boolean · array · object · enum                                                                                                   | BIF      |
| **FieldSource**                                    | USER · WEBSITE · GA4 · GSC · GOOGLE_ADS · META_ADS · LINKEDIN · CRM · DOCUMENT · RESEARCH · AI_INFERRED · **DERIVED**                               | BIF      |
| **FieldConfidence**                                | USER_CONFIRMED · EVIDENCE_VERIFIED · AI_INFERRED                                                                                                    | BIF      |
| **EvidenceSource**                                 | REDDIT · G2 · CAPTERRA · TRUSTPILOT · YOUTUBE · GOOGLE_SEARCH · COMPETITOR_SITE · ADS · SOCIAL · JOB_POSTING · GITHUB · FORUM                       | RIE      |
| **SignalType**                                     | PAIN_POINT · FEATURE_REQUEST · INTENT · COMPLAINT · PRAISE · PRICING_SIGNAL · COMPETITOR_MENTION · MARKET_TREND · BUYING_SIGNAL · TECH_STACK_SIGNAL | RIE      |
| **EvidenceState**                                  | NEW · PROCESSED · MAPPED · APPLIED_TO_BIF · REJECTED · CONFLICTED                                                                                   | RIE      |
| **Polarity / ConflictSeverity / BIFMappingAction** | POSITIVE·NEGATIVE·NEUTRAL / LOW·MEDIUM·HIGH / PROPOSE_UPDATE·INCREASE_CONFIDENCE·FLAG_CONFLICT·ADD_DERIVED_VALUE                                    | RIE      |
| **OpportunityCategory**                            | SEO · AEO · GEO · CONTENT · GOOGLE_ADS · META_ADS · LINKEDIN_ADS · LOCAL_SEO · CONVERSION · EMAIL · AUTOMATION · TECHNICAL · BUSINESS               | SIE      |
| **Priority / RoadmapPhase**                        | LOW·MEDIUM·HIGH·CRITICAL / NOW·NEXT·LATER·BLOCKED                                                                                                   | SIE      |
| **Capability**                                     | MarketDiscovery · Intelligence · Strategy · Growth · Authority · Operations · Revenue                                                               | ADR-0007 |
| **ExecutionDomain**                                | SEO · AEO · GEO · LocalSEO · GoogleAds · MetaAds · LinkedInAds · CRO · Content · Email · PR · CRM · Reporting · Automation · SSH · Publishing       | ADR-0007 |
| **Client Lifecycle States**                        | Created · Onboarding · Active · Paused · Offboarding · Archived                                                                                     | Doc 03   |

### 6.3 Canonical relationships (BKG)

The 22 canonical BKG relationships (e.g., `Organization OWNS Brand`, `Brand OFFERS Product`,
`Evidence SUPPORTS Decision`, `Project EXECUTES Strategy`). Full set: see
[BUSINESS_KNOWLEDGE_GRAPH](../architecture/BUSINESS_KNOWLEDGE_GRAPH.md). **Ownership relationships**
(Workspace Model, Doc 02): `Organization → Client`, `Client → Project`, both one-to-many.

## 7. Open Decisions

> Genuine decisions not derivable from the frozen architecture. Surfaced, not assumed.

1. **BKG `Organization` node vs Workspace `Organization`.** The same word names two things: the BKG
   node (the _client's business_, since BKG is per-Client) and the Workspace tenant (the _agency_).
   A naming reconciliation is needed (e.g., rename the per-client business node, or formally scope the
   word by layer). This is the §3 terminology note.
2. **Detailed fields for Organization / Client / Project.** The architecture defines these as business
   containers but not their field sets. Their canonical fields require a decision (or are deferred to
   persistence/implementation).
3. **`Persona` overload.** BIF `Persona` (buyer persona) vs Doc 01 "personas" (users/AI agents) share
   a word. Confirm whether to rename one for clarity in the Product Bible.
4. **`OpportunityCategory` vs `Capability`/`ExecutionDomain`.** Per ADR-0007 the latter two are the
   go-forward axes; whether `OpportunityCategory` is retained, mapped, or retired is an open product
   decision (noted in ADR-0007).
5. **`Project` as BKG node vs Workspace container.** "Project" exists both as a BKG node type and as a
   Workspace container (Doc 02). Confirm these are the same concept viewed from two layers, or
   distinct.
