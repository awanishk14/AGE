# Glossary

> Part of the **AGE Product Bible**. See the [Product Bible README](./README.md).

## Purpose

This document is the **terminological anchor** and the **entry point into the Product Bible knowledge
system** — a **reference index, not a definition system**. It is a single, alphabetical lookup of the
platform's canonical terms, each pointing to the **authoritative source** that defines it. It exists
to provide quick navigation, point to authoritative sources, and ensure consistent vocabulary across
all documents. **It introduces no new definitions, decisions, entities, concepts, classifications, or
naming conventions** — every entry is a one-line **navigation pointer to meaning**, not meaning
itself.

**Source-of-truth precedence.** Each entry defers to the highest authoritative source, in order:
**(1) Product Bible document (02–16) → (2) ADR (where referenced) → (3) frozen architecture
(implementation reality).** The Glossary never overrides these sources; it only points to them. It is
an **index layer for readability and navigation, not part of the system of truth itself.**

> **Status:** Final — approved by the Product Owner. The final Product Bible document.

## Scope

- **In scope:** concise, sourced definitions of canonical terms.
- **Out of scope:** new definitions, decisions, or any term not already established elsewhere.

## Status

Final.

## Related Documents

- [Data Dictionary](./05_DATA_DICTIONARY.md) — **Final**; the structured, source-mapped vocabulary (this glossary is its plain-language index).
- All Final Product Bible documents and [architecture docs](../architecture/) / [ADRs](../adrs/).

---

## Terms

| Term                                      | Definition (summary)                                                                                                         | Authoritative source              |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **Agency**                                | The business that operates AGE; the platform tenant. Synonym for **Organization**.                                           | Doc 02 §4                         |
| **AI Workforce**                          | The platform's set of AI agents; a shared reasoning layer, owned at the Organization level.                                  | Doc 01; Doc 04                    |
| **AI Agent**                              | A pure-producer reasoning component (never side-effects, never a permission subject).                                        | Doc 04; Doc 01                    |
| **Approval**                              | Human authorization that gates a decision or execution.                                                                      | Doc 06 §6                         |
| **Audit / AuditLog**                      | The system-wide, non-bypassable record of access, actions, and side effects.                                                 | Doc 13 §8; persistence            |
| **Authority Capability**                  | Capability for content, PR, backlinks, reviews, thought leadership.                                                          | Capability Architecture           |
| **Autonomous Execution**                  | Future-state side-effecting execution without per-action human approval; **out of current scope**.                           | Doc 12 §5; Doc 15 §7              |
| **BIF (Business Intelligence Framework)** | A Client Business's living, versioned, provenance-aware truth model.                                                         | Doc 05 §4; `@age/bif`             |
| **BIFField**                              | The atomic BIF unit: value + source + confidence + lastVerifiedAt + history.                                                 | Doc 05 §4                         |
| **BIFFieldRef**                           | The canonical, unambiguous address of a BIF field.                                                                           | `@age/bif` (007.1)                |
| **BKG (Business Knowledge Graph)**        | The canonical per-Client ontology (26 nodes, 22 relationships).                                                              | Doc 05 §3; ADR-0003               |
| **Business**                              | The client's company — the subject AGE researches/analyzes/optimizes.                                                        | Doc 05 §2 (Decision 1)            |
| **Buyer Persona**                         | A representation of a Client's market (in BIF). Distinct from Platform Persona.                                              | Doc 05 §4                         |
| **Capability**                            | A business capability (_why_ work is done): MarketDiscovery, Intelligence, Strategy, Growth, Authority, Operations, Revenue. | ADR-0007; Capability Architecture |
| **Capability Kit / Registry**             | Shared capability contracts; the canonical registry of capability metadata.                                                  | Capability Architecture; ADR-0008 |
| **Client**                                | A first-class business concept — the engagement with a Business the agency grows.                                            | Doc 02 §5                         |
| **Client Lifecycle**                      | The canonical Client states: Created → Onboarding → Active ⇄ Paused → Offboarding → Archived.                                | Doc 03                            |
| **Configuration**                         | The controlled variability layer (behavioral enablement within governance).                                                  | Doc 14                            |
| **Dashboard**                             | A live orientation **entry point** (not a destination; not a Report).                                                        | Doc 07 §5; Doc 10 §2              |
| **DecisionPackage**                       | The SIE's bundled output (opportunities, recommendations, roadmap, simulations).                                             | SIE; Doc 05 §5                    |
| **Edition**                               | A scaling tier of the same platform: Founder → Agency → Commercial SaaS → Enterprise.                                        | Doc 15 §2                         |
| **Evidence**                              | RIE's core output: provenance-aware sensed reality with a lifecycle state.                                                   | Doc 05 §5; RIE                    |
| **ExecutionDomain**                       | _Where_ work is executed (SEO, GoogleAds, Content, CRM, …).                                                                  | ADR-0007                          |
| **Execution Layer**                       | The **only** layer permitted side effects — the boundary between intent and reality.                                         | Doc 12                            |
| **Growth Capability**                     | Capability for paid media, CRO, funnels.                                                                                     | Capability Architecture           |
| **Human-Approved Automation/Execution**   | The model in which side effects always require human approval (no current autonomy).                                         | Doc 09 §5; Doc 12 §5              |
| **Integration**                           | A contextual perception/action channel to an external system (Source / Execution / Hybrid).                                  | Doc 11                            |
| **Intelligence Capability**               | Capability for truth quality (between RIE and BIF).                                                                          | Capability Architecture           |
| **KPI**                                   | A standardized business signal for evaluating performance/progress/outcomes.                                                 | Doc 10 §4                         |
| **LangGraph**                             | The graph-shaped agent orchestration engine used for stateful, resumable AI agent runs.                                      | ADR-0005; Doc 04 §5               |
| **Market Discovery Capability**           | Capability that finds opportunities (SEO/AEO/GEO/local/competitor/keyword).                                                  | Capability Architecture           |
| **Metric**                                | A measured value (BKG `Metric` node), produced by execution, accumulating at the Client.                                     | Doc 05; Doc 10 §4                 |
| **Notification**                          | A business-attention signal in five categories: Critical, Important, Informational, Digest, Escalation.                      | Doc 08 §2                         |
| **Operations Capability**                 | Capability for project management, reporting, delivery tracking.                                                             | Capability Architecture           |
| **Opportunity (StrategyOpportunity)**     | An evidence-backed business opportunity carrying capability + execution domains.                                             | Doc 05 §5; SIE                    |
| **OpportunityCategory**                   | A strategic business classification from Business Intelligence (distinct from Capability/ExecutionDomain).                   | Doc 05 §6 (Decision 4)            |
| **Organization**                          | The agency tenant — the top-level account that owns Clients and Shared Agency Resources.                                     | Doc 02 §4                         |
| **Permission**                            | An access grant determined by **role + business context**.                                                                   | Doc 06                            |
| **Platform Persona**                      | A participant in AGE: Human Personas + AI Workforce Personas.                                                                | Doc 05 §4 (Decision 3)            |
| **Project**                               | A unit of execution within a Client (one entity, multiple representations).                                                  | Doc 02 §7; Doc 05                 |
| **Report**                                | An interpretive, traceable, derivative artifact (not raw data; not a Dashboard).                                             | Doc 10                            |
| **RIE (Research Intelligence Engine)**    | The sensing layer converting external data into evidence/proposals.                                                          | Doc 05; architecture              |
| **Revenue Capability**                    | Capability for proposals, lead scoring, CRM, pipeline, account growth.                                                       | Capability Architecture           |
| **Scope**                                 | A business boundary access/config/execution is bound to: Organization / Client / Project.                                    | Doc 02 §15; Doc 06 §3             |
| **Security**                              | A constraint system applied across all layers (enforces; never redefines permissions).                                       | Doc 13                            |
| **Shared Agency Resources**               | Agency-owned reusable frameworks/templates/playbooks/methodologies.                                                          | Doc 02 §4, §11                    |
| **Side-Effect Boundary**                  | The canonical pure-vs-execution operation boundary.                                                                          | Doc 12 §2                         |
| **SIE (Strategy Intelligence Engine)**    | The decision layer producing structured decision objects from BIF/RIE/BKG.                                                   | Doc 05; architecture              |
| **Traceability Chain**                    | Evidence → BIF → Decision → Capability Output → Execution.                                                                   | Doc 12 §8                         |
| **Workspace**                             | A product **lens** (navigation/context) — not a business entity; carries no ownership.                                       | Doc 02 §6; Doc 07                 |

## Resolved Decisions

The following were resolved by the Product Owner and are now canonical:

1. **Reference index, not a definition system.** The Glossary navigates and points to authoritative
   sources; it must not introduce independent definitions.
2. **Source-of-truth precedence.** Product Bible document (02–16) → ADR → frozen architecture. The
   Glossary never overrides these.
3. **Atomic granularity.** Terms are atomic, non-overlapping, and non-explanatory beyond a one-line
   summary — a navigation pointer to meaning, not meaning itself.
4. **Distinct from the Data Dictionary.** Doc 05 defines business meaning and relationships; Doc 16
   provides terminological indexing/lookup. The Glossary must not duplicate or expand Doc 05.
5. **No new canonical concepts.** No new entities, business concepts, classification systems, or
   alternative naming. Any such need is resolved back into the relevant source document (02–15).

**Canonical principle:** the Glossary is the **entry point into the Product Bible knowledge system**
but **not part of the system of truth** — an index layer for readability and navigation, preserving
the separation between authoritative definitions (Docs 02–15) and navigational references (Doc 16).

## Maintenance

- Entries are summaries; the **cited source is authoritative**. When a source document changes, update
  the summary here — never the reverse.
- Add a term here only after it is defined in a Final document, ADR, or the frozen architecture.
