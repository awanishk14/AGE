# Permission Model

> Part of the **AGE Product Bible**. See the [Product Bible README](./README.md).

## Purpose

This document defines, at the **business level**, **who** may access **what**, and **where** in AGE.
It establishes the permission _model_ — subjects, scopes, actions, isolation, approval, administration,
and audit — derived from the Workspace Model (Doc 02), the personas (Doc 01), and the AI Agent
Architecture (Doc 04).

It answers **"should this person be allowed?"**. It does **not** define how that decision is enforced
or protected (authentication, identity, encryption, threat protection) — those belong to the
**Security Model (Doc 13)**. It also does not define the concrete role→permission matrix — that is
implementation documentation.

> **Status:** Final — approved by the Product Owner. Conforms to Final Docs 01–05.

## Scope

- **In scope:** permission concepts, scopes, principles; isolation, approval, administration, and
  audit at the business level.
- **Out of scope:** the concrete role→permission matrix (implementation), the authorization
  implementation, authentication/identity/security controls (Doc 13), UX, and enforcement.

## Status

Final.

## Related Documents

- [User Journeys](./01_USER_JOURNEYS.md) — per-persona Permissions & Decision Authority (intent).
- [Workspace Model](./02_WORKSPACE_MODEL.md) — **Final**; membership, scopes, isolation.
- [AI Agent Architecture](./04_AI_AGENT_ARCHITECTURE.md) — **Final**; agents as pure producers.
- [Data Dictionary](./05_DATA_DICTIONARY.md) — **Final**; canonical terms.
- [Security Model](./13_SECURITY_MODEL.md) — enforcement & protection (independent; see §9.6).

## Table of Contents

- [1. Core Principles](#1-core-principles)
- [2. Subjects (Who)](#2-subjects-who)
- [3. Scopes (Where)](#3-scopes-where)
- [4. Actions & Administration (What)](#4-actions--administration-what)
- [5. Access & Isolation Rules](#5-access--isolation-rules)
- [6. Approval & the Execution Boundary](#6-approval--the-execution-boundary)
- [7. AI Workforce & Permissions](#7-ai-workforce--permissions)
- [8. Sharing, Delegation & Audit](#8-sharing-delegation--audit)
- [9. Resolved Decisions](#9-resolved-decisions)

---

## 1. Core Principles

1. **Access is scoped, isolated, and audited.** There is no unscoped global access to business data.
2. **Hybrid model — role + context.**

   > **Access is determined by both the user's role and the business context in which they operate.**

   Roles set a user's baseline responsibilities; context (Organization / Client / Project) determines
   _where_ those responsibilities apply. The Product Bible states this principle only; implementation
   may realize it with any suitable authorization model.

3. **Access follows responsibility.** Subjects receive access according to their assigned
   responsibilities — never broad, implicit, or unrestricted access.
4. **AI Agents are never permission subjects** (see §7).

## 2. Subjects (Who)

Access subjects are **human Platform Personas** (Doc 05):

- **Agency members** — users belonging to the Organization (Doc 01 agency teams). They receive access
  to Clients/Projects **according to their responsibilities** — they are **not** automatically
  entitled to every Client.
- **Client members** — external users belonging to a single Client (Doc 01 Client Team). They receive
  access only to the **Clients and Projects in which they participate**, with no implied access
  outside those contexts.

A user belongs to exactly one Organization (Doc 02 §12). **AI Workforce Personas are not permission
subjects** — see §7.

## 3. Scopes (Where)

Every permission is **scoped** to a container from the Workspace Model (Doc 02):

| Scope                       | Holds                                                                             |
| --------------------------- | --------------------------------------------------------------------------------- |
| **Organization**            | The agency tenant; Shared Agency Resources; the set of Clients.                   |
| **Client**                  | One Business's intelligence (BIF, BKG, Research, Strategy), Assets, and Projects. |
| **Project**                 | Execution artifacts within a Client.                                              |
| **Shared Agency Resources** | Agency-owned frameworks/templates/playbooks (referenceable by clients).           |

## 4. Actions & Administration (What)

The canonical action vocabulary (concepts, derived from Doc 01 persona _Permissions_):

**Read · Create · Update · Delete · Approve · Export · Admin.**

- **Delete** is **soft delete** (Doc 02 §2; retained and auditable, never hard-erased).
- **Approve** authorizes a decision or gates execution (§6).
- Actions causing **external side effects** (publish, deploy, send) are **not** general permissions —
  they occur only in the Execution Layer, gated by approval (§6).

**Administration is scoped, never implicitly global.** Canonical administrative scopes:

- **Organization Administration**, **Client Administration**, **Project Administration.**

Administrative authority applies only within its scope.

> The concrete role→permission matrix (which subject holds which actions in which scope) is
> **implementation documentation** and is intentionally **not** defined here (§9.1).

## 5. Access & Isolation Rules

Derived from Doc 02 §15 (canonical isolation):

1. Access is **scoped** — a subject acts only within scopes it is granted by responsibility.
2. **Agency may read across the Clients it is responsible for** (portfolio/aggregation); a **Client
   never** reads another Client.
3. **No cross-Organization (cross-tenant) access**, ever.
4. **No automatic cross-client knowledge sharing** (Doc 02 §15) — client-derived knowledge stays
   isolated; only Shared Agency Resources may be shared.
5. Soft-deleted records remain isolated and auditable; excluded from normal reads, retained for
   history.

## 6. Approval & the Execution Boundary

- **Humans approve; agents propose** (Doc 04). Each persona's _Decision Authority_ (Doc 01) states
  what it may decide independently vs. what requires approval.
- **Approval gates the Execution Layer.** Only the Execution Layer performs external side effects;
  such actions require the appropriate **Approve** authority first.
- **Humans are the only supervisory authority** (Doc 04); no agent approves any action.

## 7. AI Workforce & Permissions

**AI Agents are never permission subjects.** This reinforces a core platform governance boundary:

1. Agents **neither own permissions nor receive roles.**
2. Every action performed through the AI Workforce **executes within the permissions of the
   initiating human context** and remains constrained by the **Execution Layer** (only that layer
   side-effects).
3. Agents are **pure producers**, **scoped** to a single Client/Project per operation, **never cross
   client boundaries**, and **cannot bypass** human approval, audit, or evidence requirements (Doc 04;
   Doc 01 Constraints).
4. **Clients are not assigned agents** (Doc 04) — capability availability, not agent assignment,
   determines what runs for a Client.

## 8. Sharing, Delegation & Audit

- **Delegation.** Access is granted by **responsibility**: agency members to the specific
  Clients/Projects they are responsible for; client members to the Clients/Projects in which they
  participate. No implied access exists outside assigned contexts.
- **Sharing.** Only **Shared Agency Resources** may be shared across Clients; **client-derived
  knowledge is never shared** between Clients (Doc 02 §15).
- **Audit (always-on).** Every access and action is **audited**, and **no permission bypasses audit**
  (Doc 01; persistence AuditLog). Approvals and their evidence are recorded. (Audit _implementation_
  is Doc 13.)

## 9. Resolved Decisions

The following were resolved by the Product Owner and are now canonical:

1. **No role→permission matrix in the Product Bible.** This document defines permission concepts,
   scopes, and principles; the concrete role-permission mapping is **implementation documentation**
   and may evolve. (Doc 01 provides each Human Persona's intent.)
2. **Hybrid model.** _Access is determined by both the user's role and the business context in which
   they operate._ The Product Bible avoids implementation terminology (no RBAC/ABAC/policy-engine);
   implementation is free to realize this with any suitable model.
3. **Client-member granularity.** Client members receive access only to the Clients and Projects in
   which they participate; no implied access outside those contexts. Specific in-context capabilities
   are implementation detail.
4. **Agency access follows responsibility.** Agency members are **not** automatically entitled to
   every Client; access is granted per assigned responsibility (least privilege; supports
   confidentiality, enterprise, and multi-team agencies).
5. **Scoped administration.** Administration exists at **Organization**, **Client**, and **Project**
   scopes; administrative authority is never implicitly global.
6. **Boundary with the Security Model.** Doc 06 answers _"should this person be allowed?"_ (who may
   access what, ownership, scopes, approval, administration). **Doc 13** answers _"how is that decision
   enforced and protected?"_ (authentication, identity, security controls, encryption, audit
   implementation, threat protection, compliance, security architecture). The two are independent.

**Canonical principle:** **AI Agents are never permission subjects** — actions through the AI
Workforce run within the initiating human's permissions and the Execution Layer's constraints (§7).
