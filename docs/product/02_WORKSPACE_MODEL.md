# Workspace Model

> Part of the **AGE Product Bible**. See the [Product Bible README](./README.md).

## Purpose

This document is the canonical definition of **how data is logically organized inside AGE**. It
defines the containers that own every other concept — organizations, clients, workspaces, projects,
and the business intelligence attached to them. Permissions, AI agents, workflows, automations,
reporting, navigation, and execution all **reference** this model; none of them redefine it.

It is a **business-domain model only**. It does not define database schema, APIs, permissions, UX,
or automations.

> **Status:** 🟡 In Progress — drafted from the frozen architecture for Product Owner review.
> Sections marked **[PROPOSED]** are recommendations pending sign-off; genuine product choices are
> collected in [§20 Open Decisions](#20-open-decisions).

## Scope

- **In scope:** the logical organization of the platform — hierarchy, ownership, isolation,
  lifecycle, naming, multi-tenancy.
- **Out of scope:** permissions (Doc 06), workflows (Doc 09), AI behavior (Doc 04), UI (Doc 07),
  automations (Doc 09), implementation/schema/APIs.

## Status

🟡 In Progress.

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
- [20. Open Decisions](#20-open-decisions)

---

## 1. Purpose

AGE is the operating system for a growth agency. A single agency runs AGE and uses it to grow many
client businesses. The workspace model defines the containers that hold and isolate the data for
each of those businesses, and how the agency's own data relates to them.

Every piece of platform data — business truth (BIF), knowledge (BKG), evidence (RIE), decisions
(SIE), capability plans, assets, projects — lives inside exactly one owning container defined here.

## 2. Design Principles

1. **One owner per record.** Every persisted record belongs to exactly one owning scope (grounded
   in the persistence base field `organizationId`, present on every record).
2. **Isolation by default.** Data from one client is never visible to another client. The agency
   can see across its own clients; clients cannot see across the agency.
3. **The BKG is canonical** (ADR-0003) — the workspace model conforms to the ontology, never the
   reverse.
4. **Soft, versioned, audited.** Containers and their contents are soft-deleted (`deletedAt`),
   versioned (`version`), and audited (`createdBy`/`updatedBy`, AuditLog) — never hard-erased.
5. **Multi-tenant ready, RLS later.** The tenant boundary is modeled now; row-level security is an
   implementation concern deferred to a later epic.
6. **Capability/engine alignment.** Ownership scopes line up with where BIF/RIE/SIE and the
   capability layer operate, so engines read from a single, unambiguous container.

## 3. Workspace Hierarchy

**[PROPOSED]** A three-level hierarchy:

```
Tenant (Agency Organization)
 └── Client (a client business AGE grows)
      └── Project (a unit of execution toward an outcome)
```

- **Tenant / Agency Organization** — the top-level account that operates AGE (the SaaS tenant).
- **Client** — a distinct business the agency serves; the primary unit of business intelligence.
- **Project** — scoped work inside a client, toward a strategic outcome.

> This introduces **Client** as a first-class container between the existing `organization` (tenant)
> and `project` domain modules. Whether business intelligence attaches to the Tenant or the Client
> is the central open decision — see [§20](#20-open-decisions).

## 4. Organization Model

**[PROPOSED]** The **Organization** is the **agency tenant** — the top-level account that owns all
other data (consistent with the `organization` domain module: "tenant boundary and top-level
account that owns all other domain data"). It holds:

- Agency identity and configuration.
- The set of Clients the agency manages.
- Agency-level users (the human personas in Doc 01: Executive Leadership, Strategy, Delivery,
  Revenue teams) and the AI Workforce.
- Agency-owned assets and templates reused across clients.

Every record in AGE carries the owning `organizationId` (the tenant), enabling SaaS isolation
between agencies.

## 5. Client Model

**[PROPOSED]** A **Client** represents a single business the agency grows. It is the primary unit of
**business intelligence**: each client has its own truth model, knowledge graph, research, assets,
and projects. A Client belongs to exactly one Organization (tenant). A Client is the container the
"Client Team" personas (Business Owner, Marketing Head, Product Manager) are associated with.

> The `BIF` defined in the architecture "represents an organization" — under this proposal, the
> business it represents is the **Client**, while the tenant `organizationId` provides agency-level
> isolation. Reconciling the two senses of "organization" is the headline open decision.

## 6. Workspace Types

**[PROPOSED]** A **Workspace** is the working container a user operates within. Proposed types:

| Workspace Type        | Owner   | Purpose                                                               |
| --------------------- | ------- | --------------------------------------------------------------------- |
| **Agency Workspace**  | Tenant  | The agency's own operations, cross-client portfolio views, templates. |
| **Client Workspace**  | Client  | All intelligence, research, assets, and projects for one client.      |
| **Project Workspace** | Project | A focused view of one project's work within a client.                 |

Workspace types are organizational lenses over the hierarchy in §3; they do not introduce new
ownership beyond Tenant / Client / Project.

## 7. Project Model

A **Project** (grounded in the `project` domain module — "units of execution that group work toward
a strategic outcome") belongs to exactly one Client. It groups capability plans, content, campaigns,
tasks, and decisions toward a defined outcome. Projects reference — but never own — the Client's BIF,
BKG, and research.

## 8. Business Intelligence Framework (BIF) Ownership

**[PROPOSED]** **One BIF per Client.** The BIF is the client business's living, versioned truth
model. It is owned by the Client and isolated to it. Agency-level roll-ups (e.g., portfolio health)
are _read-only aggregations_ across client BIFs, not a separate BIF.

> The frozen `BusinessIntelligenceFramework` type carries `organizationId`. If Organization = tenant,
> a `clientId` scope is required to attach BIF to a Client. See [§20](#20-open-decisions).

## 9. Business Knowledge Graph Ownership

**[PROPOSED]** **One BKG per Client.** Each client has its own instance of the canonical ontology
(26 node types, 22 relationships). The ontology _definition_ is shared platform-wide and immutable
(ADR-0003); the _graph instance_ (nodes + relationships populated with a client's data) is owned by
the Client and isolated to it.

## 10. Research Ownership

**[PROPOSED]** **Research and Evidence are owned by the Client** they were gathered for. RIE outputs
(Evidence, signals, BIF mapping proposals, conflicts) are scoped to a single Client and feed only
that client's BIF. Evidence entity-links (`organizationId`, `productId`, `competitorId`,
`marketId`) resolve within the owning Client's scope.

> Exception to confirm: competitor/market evidence may be reusable across clients in the same market.
> Treated as an open decision (cross-client knowledge reuse) — see [§20](#20-open-decisions).

## 11. Asset Ownership

**[PROPOSED]** Assets (websites, landing pages, content, documents, ad accounts, social profiles —
per the BKG `Asset` node and Doc 01 asset references) are owned by the **Client** they belong to.
**Agency-owned templates and reusable assets** are owned by the Tenant and may be referenced by any
client workspace without transferring ownership.

## 12. User Membership Model

**[PROPOSED]** Membership is modeled at two levels (this section defines _membership_, not
_permissions_ — see Doc 06):

- **Agency members** — users belonging to the Tenant (agency staff personas). They may be granted
  access to one or more Client Workspaces.
- **Client members** — external users belonging to a single Client (the Client Team personas). They
  see only their own Client Workspace.

A user belongs to exactly one Tenant. A user's _visibility_ into Clients/Projects is an access
concern resolved by the Permission Model, not redefined here.

## 13. AI Agent Ownership Model

**[PROPOSED]** The **AI Workforce is owned by the Tenant** (the agency operates a single workforce
of agents — Doc 01 AI Workforce). Agents **operate within a Client scope** when acting on a client's
data: a Research/SEO/Content/Strategy/Reporting agent reads and writes only within the Client
Workspace it is invoked for. Agents never cross client boundaries in a single operation. Agent
identity and configuration are Tenant-level; agent _activity and outputs_ are Client-scoped.

## 14. Cross-Workspace Relationships

**[PROPOSED]** Allowed relationships:

- **Tenant → Client** (ownership, one-to-many).
- **Client → Project** (ownership, one-to-many).
- **Tenant → portfolio aggregation** — read-only roll-ups across the tenant's clients (e.g.,
  Growth Director's portfolio view).

Disallowed by default:

- **Client ↔ Client** — no direct data relationships between two clients.
- **Cross-tenant** — never, under any condition.

Any cross-client knowledge reuse (e.g., shared market/competitor intelligence) must be an explicit,
audited, opt-in mechanism — flagged as an open decision.

## 15. Data Isolation Rules

**[PROPOSED]**

1. Every record resolves to exactly one Tenant and (where applicable) one Client.
2. A query in a Client scope returns only that Client's records.
3. The agency (Tenant) may read across its own Clients; a Client may never read another Client.
4. No tenant may ever access another tenant's data.
5. Soft-deleted records (`deletedAt`) remain isolated and auditable; they are excluded from normal
   reads but retained for audit/version history.
6. Aggregations across Clients are read-only and never leak record-level data between Clients.

(Enforcement mechanism — e.g., row-level security — is an implementation concern, deferred.)

## 16. Multi-Tenant Architecture

**[PROPOSED]** AGE is multi-tenant at the **Tenant (Agency)** level. The persistence layer already
mandates `organizationId` on every record as the tenant key, with soft delete, versioning, and audit
fields. The model supports the SaaS progression (Founder → Agency → Commercial SaaS → Enterprise)
without restructuring: additional tenants are additional Organizations; clients scale within a
tenant. **Row-Level Security (RLS) is intentionally not defined here** — only the requirement that a
tenant key exists on every record.

## 17. Workspace Lifecycle

**[PROPOSED]** High-level states (detailed client states live in Doc 03):

- **Tenant:** Provisioned → Active → Suspended → Closed.
- **Client:** Created → Onboarding → Active → Paused → Offboarding → Archived.
- **Project:** Draft → Active → Completed → Archived.

All lifecycle transitions are audited and reversible via soft delete and version history; archival
retains data (no hard delete) for traceability.

## 18. Naming Conventions

**[PROPOSED]**

- Containers use singular nouns: `Organization` (Tenant), `Client`, `Project`, `Workspace`.
- Identifiers follow the shared kernel's typed-id convention (`OrganizationId`, `ClientId`,
  `ProjectId`) — a `ClientId` would be added to the shared identifiers if §20 confirms Client as a
  first-class container.
- Display names are human-editable; identity is immutable.
- Workspace display names are unique within their parent scope (a client name is unique within a
  tenant; a project name unique within a client).

## 19. Future Scalability Considerations

- **Sub-clients / brands.** A client may later own multiple brands or business units; the hierarchy
  may need a level between Client and Project. Not introduced now.
- **Agency networks.** Holding companies operating multiple agencies (multiple tenants) — handled by
  the tenant boundary; no model change anticipated.
- **Shared market intelligence.** A controlled, opt-in mechanism for reusing non-client-specific
  market/competitor knowledge across clients (see §10, §14).
- **Capability scaling.** New capabilities (Sales, Customer Success, Finance) register without
  changing the workspace model (per the Capability Registry).
- **Data residency.** Enterprise tenants may require region-pinned storage — a tenant-level attribute
  to add later.

## 20. Open Decisions

> These are genuine product decisions surfaced for the Product Owner. None are invented as final.

1. **Meaning of "Organization" (headline).** Does `organizationId` (the architecture's tenant key)
   represent the **agency tenant** (this draft's assumption) or the **client business**? If the
   former, a **`ClientId`** scope must be introduced for BIF/BKG/Research/Assets. If the latter, the
   "agency" becomes a higher construct above Organization. **All of §4–§13 depend on this.**
2. **Is `Client` a first-class domain entity?** The frozen domain has `organization` and `project`
   modules but **no `client` module**. Adding Client may warrant a domain module + `ClientId` (a
   change to the frozen domain — would require an ADR).
3. **BIF/BKG ownership granularity.** Per-Client (proposed) vs per-Tenant vs per-Project.
4. **Cross-client knowledge reuse.** May shared market/competitor evidence be reused across a
   tenant's clients, and if so, under what isolation/audit rules?
5. **Agency-as-a-client.** Does the agency maintain its own BIF/BKG (treating itself as a client of
   AGE) in addition to managing client BIFs?
6. **Workspace vs container.** Is "Workspace" a distinct first-class entity, or only a UI/access lens
   over Tenant/Client/Project (this draft treats it as a lens)?
7. **Project ↔ Capability scope.** Do capability plans attach to a Project, directly to a Client, or
   both?
