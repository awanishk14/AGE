# Workspace Model

> Part of the **AGE Product Bible**. See the [Product Bible README](./README.md).

## Purpose

This document is the canonical definition of **how data is logically organized inside AGE**. It
defines the business containers that own every other concept — organizations, clients, projects, and
the business intelligence attached to them. Permissions, AI agents, workflows, automations,
reporting, navigation, and execution all **reference** this model; none of them redefine it.

It is a **business-domain model only**. It documents business truth, not the persistence model. It
does not define database schema, APIs, permissions, UX, or automations.

> **Status:** Final — approved by the Product Owner. This document is the authoritative reference for
> all subsequent Product Bible documents. Any future contradiction is treated as a design issue and
> resolved **against** this document, not by altering it casually.

## Scope

- **In scope:** the logical organization of the platform — hierarchy, ownership, isolation,
  lifecycle, naming, multi-tenancy, and the workspace lens.
- **Out of scope:** permissions (Doc 06), workflows (Doc 09), AI behavior (Doc 04), UI (Doc 07),
  automations (Doc 09), implementation/schema/APIs.

## Status

Final.

## Related Documents

- [Client Lifecycle](./03_CLIENT_LIFECYCLE.md)
- [Permission Model](./06_PERMISSION_MODEL.md)
- [Configuration Model](./14_CONFIGURATION_MODEL.md)
- [Data Dictionary](./05_DATA_DICTIONARY.md)

**Architecture references (do not modify):**

- [AGE_SYSTEM_MAP](../architecture/AGE_SYSTEM_MAP.md)
- [PERSISTENCE_ARCHITECTURE](../architecture/PERSISTENCE_ARCHITECTURE.md)
- [BUSINESS_KNOWLEDGE_GRAPH](../architecture/BUSINESS_KNOWLEDGE_GRAPH.md)
- [ADR-0003 BKG canonical](../adrs/0003-bkg-as-canonical-model.md)

## Table of Contents

- [1. Purpose](#1-purpose)
- [2. Design Principles](#2-design-principles)
- [3. Workspace Hierarchy](#3-workspace-hierarchy)
- [4. Organization Model](#4-organization-model)
- [5. Client Model](#5-client-model)
- [6. Workspace Types](#6-workspace-types)
- [7. Project Model](#7-project-model)
- [8. Business Intelligence Framework (BIF) Ownership](#8-business-intelligence-framework-bif-ownership)
- [9. Business Knowledge Graph Ownership](#9-business-knowledge-graph-ownership)
- [10. Research Ownership](#10-research-ownership)
- [11. Asset Ownership](#11-asset-ownership)
- [12. User Membership Model](#12-user-membership-model)
- [13. AI Agent Ownership Model](#13-ai-agent-ownership-model)
- [14. Cross-Workspace Relationships](#14-cross-workspace-relationships)
- [15. Data Isolation Rules](#15-data-isolation-rules)
- [16. Multi-Tenant Architecture](#16-multi-tenant-architecture)
- [17. Workspace Lifecycle](#17-workspace-lifecycle)
- [18. Naming Conventions](#18-naming-conventions)
- [19. Future Scalability Considerations](#19-future-scalability-considerations)
- [20. Resolved Decisions](#20-resolved-decisions)

---

## 1. Purpose

AGE is the operating system for a growth agency. A single agency runs AGE and uses it to grow many
client businesses. The workspace model defines the business containers that hold and isolate the
data for each of those businesses, and how the agency's own resources relate to them.

Every piece of platform data — business truth (BIF), knowledge (BKG), evidence/research (RIE),
strategy (SIE), capability plans, assets, projects — belongs to exactly one owning business
container defined here.

Three sentences capture the model:

- **Projects execute work.**
- **Clients accumulate knowledge.**
- **Organizations manage clients.**

## 2. Design Principles

1. **One owner per record.** Every record belongs to exactly one owning business scope.
2. **Isolation by default.** A client's intelligence is isolated; one client's data never enriches
   another's automatically.
3. **The BKG is canonical** (ADR-0003) — the workspace model conforms to the ontology, never the
   reverse.
4. **Soft, versioned, audited.** Containers and contents are soft-deleted (`deletedAt`), versioned
   (`version`), and audited (`createdBy`/`updatedBy`, AuditLog) — never hard-erased.
5. **Document business truth, not persistence.** Business concepts (Client) are first-class here even
   where the persistence model represents them differently; mapping is an implementation concern.
6. **Tenant boundary unchanged.** Organization remains the platform tenant (frozen architecture);
   this document is a domain clarification, not a tenancy change.

## 3. Workspace Hierarchy

The canonical business hierarchy:

```
Organization (Agency)            ← platform tenant
├── Clients                      ← first-class business concept
│   ├── Projects                 ← execute work
│   ├── Business Intelligence    ← BIF
│   ├── Research                 ← evidence / RIE outputs
│   ├── Strategy                 ← SIE outputs
│   ├── Knowledge                ← BKG instance
│   └── Assets
└── Shared Agency Resources      ← frameworks, templates, playbooks, methodologies
```

- **Organization** manages Clients.
- **Clients** accumulate long-term business knowledge (BIF, BKG, Research, Strategy, Assets).
- **Projects** execute work inside a Client.

## 4. Organization Model

The **Organization** is the **platform tenant** — the top-level account that operates AGE (frozen
architecture: "tenant boundary and top-level account that owns all other domain data"). It:

- Holds agency identity and configuration.
- Manages the set of Clients the agency serves.
- Owns **Shared Agency Resources** — reusable frameworks, templates, playbooks, and methodologies
  available across clients.
- Is the home of the agency's human personas (Doc 01) and the AI Workforce.

The Organization is the unit of SaaS isolation between agencies.

## 5. Client Model

A **Client** is a **first-class business concept**: a single business the agency grows. It is where
the platform's intelligence is **primarily accumulated**, because that intelligence describes the
_client's_ business, not the agency's. A Client belongs to exactly one Organization and owns:

- Its **Business Intelligence** (BIF), **Knowledge** (BKG), **Research**, **Strategy**, and
  **Assets**.
- Its **Projects**.

The "Client Team" personas (Business Owner, Marketing Head, Product Manager) are associated with a
Client.

**Agency-as-a-Client.** The agency may create **itself as a Client**, so AGE runs the agency using
the exact same model and workflows it provides to external clients. No separate product mode exists.

> Documenting Client as first-class is a **domain clarification**, not an architecture change. The
> Organization tenant boundary is unchanged and no ADR is required. If implementation later proves
> the domain model cannot represent Client cleanly, a dedicated Client aggregate can be introduced
> via an **implementation ADR** at that time.

## 6. Workspace Types

A **Workspace is not a business entity.** It is a **product lens** through which a user views and
interacts with a specific context. It carries **no ownership** — ownership is determined entirely by
the business hierarchy in §3. Workspaces describe **navigation and context**, nothing more.

| Workspace (lens)           | Context viewed                                                       |
| -------------------------- | -------------------------------------------------------------------- |
| **Organization Workspace** | The agency: its clients, shared resources, portfolio views.          |
| **Client Workspace**       | One client's intelligence, research, strategy, assets, and projects. |
| **Project Workspace**      | One project's execution within a client.                             |

## 7. Project Model

A **Project** belongs to exactly one Client and is where **execution happens** (grounded in the
`project` domain module — "units of execution that group work toward a strategic outcome"). A
Project **owns its execution artifacts** (tasks, drafts, capability plan instances, run outputs) and
**references** — but does not own — the Client's BIF, BKG, Research, and Strategy.

**Promotion to the Client.** Execution outputs that become durable business knowledge are **promoted
to the Client**, keeping long-term intelligence independent of any single project.

## 8. Business Intelligence Framework (BIF) Ownership

The **BIF is owned by the Client.** It is the client business's living, versioned truth model, and is
isolated to that Client. Agency-level views (e.g., portfolio health) are **read-only aggregations**
across the agency's client BIFs — never a separate BIF and never a channel for sharing one client's
truth into another.

## 9. Business Knowledge Graph Ownership

The **BKG instance is owned by the Client.** The ontology _definition_ (26 node types, 22
relationships) is shared platform-wide and immutable (ADR-0003); the _graph instance_ — nodes and
relationships populated with a client's data — belongs to and is isolated to the Client.

## 10. Research Ownership

**Research and Evidence are owned by the Client** they were gathered for. RIE outputs (Evidence,
signals, BIF-mapping proposals, conflicts) are scoped to a single Client and feed only that client's
BIF. Client-derived research never automatically enriches another client (see §15).

## 11. Asset Ownership

- **Client assets** (websites, landing pages, content, documents, ad accounts, social profiles — per
  the BKG `Asset` node) are owned by the **Client**.
- **Shared Agency Resources** (frameworks, templates, playbooks, methodologies) are owned by the
  **Organization** and may be referenced by any client without transferring ownership.

The distinction is deliberate: agency-built _methodology_ is shareable; client-derived _knowledge_ is
not (see §15).

## 12. User Membership Model

This section defines _membership_, not _permissions_ (see Doc 06).

- **Agency members** — users belonging to the Organization (agency personas). They may be granted
  access to one or more Clients.
- **Client members** — external users belonging to a single Client (the Client Team personas); they
  see only their own Client.

A user belongs to exactly one Organization. Visibility into specific Clients/Projects is an access
concern resolved by the Permission Model.

## 13. AI Agent Ownership Model

The **AI Workforce is owned by the Organization** (the agency operates one workforce of agents — Doc
01 AI Workforce). **Capabilities belong to the platform.** Agents and capabilities **execute within a
Project / Client scope**: an agent reads and writes only within the Client it is invoked for and
never crosses client boundaries in a single operation. Knowledge produced through execution
accumulates at the **Client** level (see §7 promotion). Agent identity and configuration are
Organization-level; agent activity and outputs are Client-scoped.

## 14. Cross-Workspace Relationships

Allowed:

- **Organization → Client** (ownership, one-to-many).
- **Client → Project** (ownership, one-to-many).
- **Organization → portfolio aggregation** — read-only roll-ups across the agency's own clients.
- **Shared Agency Resources → Client** (reference, non-transferring).

Disallowed:

- **Client ↔ Client** — no direct data relationships or automatic knowledge flow between clients.
- **Cross-organization (cross-tenant)** — never, under any condition.

## 15. Data Isolation Rules

1. Each client's intelligence is **isolated by default**. There is **no automatic cross-client
   knowledge sharing.**
2. Agency-wide reusable **frameworks, templates, playbooks, and methodologies** may be shared across
   clients; **client-derived knowledge** (BIF, BKG, Research, Strategy) may **not** automatically
   enrich another client's intelligence.
3. The Organization may read across its **own** clients (aggregations); a Client never reads another
   Client.
4. No organization may ever access another organization's data.
5. Soft-deleted records (`deletedAt`) remain isolated and auditable; excluded from normal reads but
   retained for audit/version history.

This protects client confidentiality and keeps future enterprise deployments predictable.
(Enforcement mechanism — e.g., row-level security — is an implementation concern, deferred.)

## 16. Multi-Tenant Architecture

AGE is multi-tenant at the **Organization** level — this is the **frozen** tenant boundary and is
unchanged by this document. Additional tenants are additional Organizations; clients scale within a
tenant. The model supports the SaaS progression (Founder → Agency → Commercial SaaS → Enterprise)
without restructuring. Row-Level Security (RLS) remains an implementation concern, not defined here.

### 16.1 What Is Tenant-Specific and What Is Shared

Multi-tenancy is **not uniform**. Conflating the two columns below is the most common way a
multi-tenant system either leaks between customers or duplicates its own engine per customer.

| Tenant-specific (isolated per Organization / Client) | Shared (one implementation, all tenants) |
| ---------------------------------------------------- | ---------------------------------------- |
| Business Discovery                                   | AI Engine                                |
| BIF                                                  | Planning Engine                          |
| Plans                                                | Execution Engine                         |
| Knowledge (BKG)                                      | Scoring models                           |
| Reports                                              | Prompt library                           |
| Projects                                             | Capability Framework                     |
| Credential **references** (§6.1 of Doc 11)           | Capability Registry                      |
| Users & membership                                   |                                          |

The rule behind the table:

> **Business meaning is tenant-specific. Reasoning machinery is shared.**

- 🚫 **Nothing in the left column may ever be read across a tenant boundary** (§15). This is the
  isolation guarantee customers are buying.
- 🚫 **Nothing in the right column may hold tenant state.** A shared engine that remembered one
  tenant's data would silently become a cross-tenant channel. Engines receive scope **as input** and
  retain nothing — which is also why capabilities are pure (Doc 12 §2).
- ⚠️ **Shared does not mean uniform in behaviour.** The same scoring model applied to two tenants'
  BIFs yields different results because the **input** differs, not because the model was customized.
- ⚠️ **A shared engine is not a shared conclusion.** Two tenants never see each other's outputs, and
  one tenant's data never trains or tunes what another tenant receives.

## 17. Workspace Lifecycle

High-level states (detailed client states live in Doc 03):

- **Organization:** Provisioned → Active → Suspended → Closed.
- **Client:** Created → Onboarding → Active → Paused → Offboarding → Archived.
- **Project:** Draft → Active → Completed → Archived.

All transitions are audited and reversible via soft delete and version history; archival retains data
(no hard delete) for traceability. Because the agency can be a Client (§5), the agency's own
"client" follows the Client lifecycle.

## 18. Naming Conventions

- Business containers use singular nouns: `Organization`, `Client`, `Project`.
- `Workspace` names a **lens**, qualified by its context: Organization Workspace, Client Workspace,
  Project Workspace.
- Display names are human-editable; identity is immutable.
- A Client name is unique within its Organization; a Project name is unique within its Client.

(How these business concepts map to persistence identifiers is an implementation concern and is not
specified here.)

## 19. Future Scalability Considerations

- **Sub-clients / brands.** A client may later own multiple brands or business units; a level between
  Client and Project may be added. Not introduced now.
- **Agency networks.** Holding companies operating multiple agencies are handled by the Organization
  tenant boundary; no model change anticipated.
- **Shared methodology library.** The set of Shared Agency Resources may grow into a governed library
  of frameworks/playbooks; still never a path for client-derived knowledge to cross clients.
- **Capability scaling.** New capabilities (Sales, Customer Success, Finance) register without
  changing the workspace model (Capability Registry).
- **Data residency.** Enterprise tenants may require region-pinned storage — an Organization-level
  attribute to add later.

## 20. Resolved Decisions

The following were resolved by the Product Owner and are now canonical for the Product Bible:

1. **Organization vs Client.** Organization remains the **platform tenant** (frozen). **Client** is a
   **first-class business concept**. This is a domain clarification, **not** a tenancy change; no ADR
   required.
2. **Ownership.** Organization owns Clients; **Clients own business knowledge** (BIF, BKG, Research,
   Strategy, Assets); **Projects own execution artifacts**; execution outputs that become long-term
   knowledge are **promoted to the Client**.
3. **Cross-client intelligence.** **No** automatic cross-client knowledge sharing. Agency frameworks,
   templates, playbooks, and methodologies may be shared; client-derived knowledge may not.
4. **Agency-as-a-Client.** Supported. The agency can create itself as a Client and use the same
   workflows. No separate product mode.
5. **Workspace.** Not a business entity — a **product lens** for navigation/context. Ownership is
   defined by the business hierarchy.
6. **Capability scope.** Capabilities belong to the platform; execution occurs within Projects;
   knowledge accumulates at the Client level.
7. **Tenant-specific vs shared** (§16.1). Business meaning (Discovery, BIF, Plans, Knowledge,
   Reports, Projects, credential references, Users) is **isolated per tenant**; reasoning machinery
   (AI Engine, Planning Engine, Execution Engine, scoring models, prompt library, Capability
   Framework and Registry) is **shared and holds no tenant state**.

**Deferred to implementation (no decision needed now):** whether persistence requires a dedicated
`Client` aggregate — handled later as an implementation ADR only if proven necessary.
