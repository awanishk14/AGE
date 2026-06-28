# Data Dictionary

> Part of the **AGE Product Bible**. See the [Product Bible README](./README.md).

## Purpose

This document is the canonical glossary of **product-level business vocabulary** in AGE and **how it
maps to the frozen architecture** — the Business Knowledge Graph (BKG), the Business Intelligence
Framework (BIF), the Research and Strategy engines, the shared kernel, and the Workspace Model
(Doc 02).

It exists so every other Product Bible document and every implementation uses **one set of terms with
one meaning**. It defines **business meaning, relationships, ownership, lifecycle, and terminology** —
**not** database schema, APIs, or field-level definitions.

> **Status:** Final — approved by the Product Owner. Conforms to the authoritative Workspace Model
> (Doc 02) and Final Docs 03–04.

## Scope

- **In scope:** canonical names, meanings, ownership, lifecycle, and source mappings of business
  entities, enumerations, and relationships.
- **Out of scope:** database schema, APIs, **field-level definitions** (deferred to implementation),
  permissions, UX, implementation. Field sets are **never** defined here.

## Status

Final.

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
- [7. Resolved Decisions](#7-resolved-decisions)

---

## 1. How to Read This Dictionary

- Each term has a **canonical name**, a **business meaning**, and a **source** (the frozen artifact
  it maps to).
- **Field-level definitions are deferred to implementation** and are never stated here.
- A single business entity may have **multiple representations** (e.g., a Workspace context, a BKG
  node, an Execution context). These are **views of one entity**, not separate concepts.

**Terminology precedence (canonical).** When terminology conflicts arise, resolve in this order —
**business terminology always wins**:

1. **Business meaning** → 2. **Product meaning** → 3. **Architectural meaning** → 4. **Implementation
   naming.**

Where implementation uses historical or technical names that differ from the business language, the
Product Bible **retains the business terminology** and treats implementation names as internal
details. (Source abbreviations below: BKG, BIF, RIE, SIE, Kernel, Persistence, Doc 02/03/04.)

## 2. Business Containers (Workspace Model)

The containers that own all other data (Doc 02, Final).

| Term                        | Meaning                                                                                                                                                                                    | Source             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| **Organization**            | The platform **tenant** — the **agency** operating AGE; owns Clients and Shared Agency Resources.                                                                                          | Doc 02 §4          |
| **Client**                  | A first-class business concept — the **engagement/relationship** with a business the agency grows; the primary owner of intelligence.                                                      | Doc 02 §5          |
| **Business**                | The **client's company** itself — the subject being researched, analyzed, and optimized. A Client's intelligence is _about_ its Business.                                                  | Doc 02; Decision 1 |
| **Project**                 | A unit of **execution** within a Client; owns execution artifacts. **One** business Project may appear as a Workspace context, a BKG node, and an Execution context — all the same entity. | Doc 02 §7          |
| **Workspace**               | A **product lens** (navigation/context), not a business entity; carries no ownership.                                                                                                      | Doc 02 §6          |
| **Shared Agency Resources** | Agency-owned reusable frameworks, templates, playbooks, methodologies.                                                                                                                     | Doc 02 §4, §11     |

> Field sets for these containers are **not** defined in the Product Bible (deferred to
> implementation — see [§7.2](#7-resolved-decisions)).

## 3. Knowledge Entities (BKG)

The BKG defines the **canonical ontology** (ADR-0003): **26 node types** and **22 relationships**,
instanced **per Client** (Doc 02 §9). Every node shares the `BusinessNode` shape
(`id`, `nodeType`, `metadata`, `createdAt`, `updatedAt`).

**Node types (26):** Organization, Person, Brand, Product, Service, Market, ICP, Competitor,
Strategy, Goal, Initiative, Campaign, Content, Research, Evidence, Decision, Project, Workflow,
Asset, Integration, Problem, Opportunity, Metric, Document, Meeting, Technology.

> **Canonical terminology (resolved).** The client's company is, canonically, the **Business**. The
> BKG `Organization` **node** is the implementation representation of that Business; the Product Bible
> uses **Business** for the client's company and reserves **Organization** for the agency tenant.
> Treat the legacy node name as an internal detail (terminology-precedence rule, §1).

## 4. Intelligence Entities (BIF)

The BIF is the client Business's living, versioned truth model (Doc 02 §8). Canonical terms:

| Term                              | Meaning                                                                                                                                           | Source |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **BusinessIntelligenceFramework** | The root truth model for one Client's Business (`version`, `status`, `sections`, scores, timestamps, optional `dependencies`/`conflicts`).        | BIF    |
| **BIFSection**                    | A coherent group of fields (one of 12 canonical sections).                                                                                        | BIF    |
| **BIFField**                      | The atomic, provenance-aware unit: `value` + `source` + `confidence` + `lastVerifiedAt` + `history`.                                              | BIF    |
| **FieldVersion**                  | A historical version of a field value.                                                                                                            | BIF    |
| **FieldDependency**               | Declares a field derived from others.                                                                                                             | BIF    |
| **FieldConflict**                 | Tracks contradictory values for one field (never silently overwritten).                                                                           | BIF    |
| **Buyer Persona**                 | A representation of the client's **market** — used for strategy, positioning, messaging, growth. Lives inside BIF. (The BIF `Persona` sub-model.) | BIF    |
| **ProductItem / ICP / KPIs**      | BIF sub-models.                                                                                                                                   | BIF    |

**The 12 canonical BIF sections:** Organization Identity · Vision & Strategy · Products & Services ·
ICP & Personas · Market & Competition · Brand System · GTM System · Marketing Intelligence ·
Technology Stack · Assets · KPIs · Constraints.

> **Persona disambiguation (canonical).** **Buyer Persona** (above) ≠ **Platform Persona** (a
> participant inside AGE: Human Personas + AI Workforce Personas, Doc 01). **Never use "Persona"
> unqualified** where ambiguity is possible — always say **Buyer Persona** or **Platform Persona**.

## 5. Evidence & Decision Entities (RIE / SIE)

| Term                                                   | Meaning                                                                                                                   | Source |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ------ |
| **Evidence**                                           | The core RIE output; provenance-aware sensed reality, with a lifecycle `state`.                                           | RIE    |
| **ExtractedSignal**                                    | A signal extracted from a normalized document (targets a BIF field).                                                      | RIE    |
| **IntentCluster**                                      | A cluster of evidence pointing at one market/buyer intent.                                                                | RIE    |
| **BIFMapping**                                         | A _proposal_ to change BIF (targets a `BIFFieldRef`); RIE never writes BIF directly.                                      | RIE    |
| **EvidenceConflict**                                   | A detected contradiction across evidence.                                                                                 | RIE    |
| **StrategyOpportunity**                                | An evidence-backed opportunity (`capability`, `executionDomains[]`, `opportunityCategory`, priority, impact, confidence). | SIE    |
| **Recommendation**                                     | A concrete recommendation tied to an opportunity.                                                                         | SIE    |
| **PriorityScore**                                      | Multi-dimensional opportunity score.                                                                                      | SIE    |
| **RoadmapItem / SimulationScenario / DecisionPackage** | Roadmap entry · what-if scenario · the bundled SIE output.                                                                | SIE    |

## 6. Standard Fields, Enumerations & Relationships

### 6.1 Standard persisted fields

The platform's standard record fields (id, tenant ownership, timestamps, audit attribution, soft
delete, version, metadata) are an **implementation** concern (`PersistedBase`). Their **business
meaning** — every record is owned, versioned, audited, and soft-deleted — is canonical; their
field-level definition is deferred.

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

> **OpportunityCategory, Capability, ExecutionDomain are three distinct concepts** (no mapping or
> replacement): **OpportunityCategory** = a strategic business classification produced by Business
> Intelligence; **Capability** = _what_ AGE can do; **ExecutionDomain** = _where_ work happens.

### 6.3 Canonical relationships

- **BKG (22):** e.g., `Business OWNS Brand` (legacy node: `Organization`), `Brand OFFERS Product`,
  `Evidence SUPPORTS Decision`, `Project EXECUTES Strategy`. Full set:
  [BUSINESS_KNOWLEDGE_GRAPH](../architecture/BUSINESS_KNOWLEDGE_GRAPH.md).
- **Ownership (Doc 02):** `Organization → Client`, `Client → Project` — both one-to-many.

## 7. Resolved Decisions

The following were resolved by the Product Owner and are now canonical:

1. **Organization ≠ Business.** **Organization** = the agency tenant. **Business** = the client's
   company (the subject of research/analysis/optimization), represented inside the Client's BKG. The
   Product Bible uses **Business** for the client's company; the BKG `Organization` node is an
   implementation detail.
2. **No field definitions.** The Data Dictionary defines business meaning, relationships, ownership,
   lifecycle, and terminology — **not fields**. Field-level definitions remain deferred to
   implementation.
3. **Two distinct Persona concepts, both retained.** **Buyer Persona** (client's market, in BIF) and
   **Platform Persona** (participants in AGE: Human + AI Workforce, Doc 01). Always qualify "Persona".
4. **OpportunityCategory retained.** It is a strategic business classification from Business
   Intelligence — a different concept from Capability (_what_) and ExecutionDomain (_where_). No
   mapping or replacement.
5. **One Project, multiple representations.** A single business Project appears as a Workspace
   context, a BKG node, and an Execution context — different views of the same entity. No separate
   Project concepts are introduced.

**Canonical principle:** terminology precedence is **Business → Product → Architectural →
Implementation**; business terminology always wins (§1). This guides all remaining Product Bible
documents.
