# Permission Model

> Part of the **AGE Product Bible**. See the [Product Bible README](./README.md).

## Purpose

This document defines, at the **business level**, **who** can see and do **what**, **where** in AGE.
It establishes the permission _model_ — subjects, scopes, actions, isolation, approval, and audit —
derived from the Workspace Model (Doc 02), the personas (Doc 01), and the AI Agent Architecture
(Doc 04).

It defines the **shape** of access control, not its implementation. It does not define the concrete
role→permission matrix, the policy engine, authentication, or enforcement mechanics — those are
implementation and/or Security Model (Doc 13) concerns.

> **Status:** In Progress — derived from Final Docs 01–05. Genuine product/security decisions not
> derivable from existing material are surfaced in [§9 Open Decisions](#9-open-decisions).

## Scope

- **In scope:** the permission model's subjects, scopes, action vocabulary, isolation rules,
  approval relationship, AI-agent governance, sharing/delegation, and audit guarantees.
- **Out of scope:** the concrete role→permission matrix, policy model (RBAC/ABAC/…), authentication,
  enforcement, UX, and implementation. (Security mechanics live in Doc 13.)

## Status

In Progress.

## Related Documents

- [User Journeys](./01_USER_JOURNEYS.md) — per-persona Permissions & Decision Authority.
- [Workspace Model](./02_WORKSPACE_MODEL.md) — **Final**; membership, scopes, isolation.
- [AI Agent Architecture](./04_AI_AGENT_ARCHITECTURE.md) — **Final**; agents as pure producers.
- [Data Dictionary](./05_DATA_DICTIONARY.md) — **Final**; canonical terms.
- [Security Model](./13_SECURITY_MODEL.md) — authentication/authorization mechanics (separate).

## Table of Contents

- [1. Purpose](#1-purpose)
- [2. Subjects (Who)](#2-subjects-who)
- [3. Scopes (Where)](#3-scopes-where)
- [4. Actions (What)](#4-actions-what)
- [5. Access & Isolation Rules](#5-access--isolation-rules)
- [6. Approval & the Execution Boundary](#6-approval--the-execution-boundary)
- [7. AI Workforce & Permissions](#7-ai-workforce--permissions)
- [8. Sharing, Delegation & Audit](#8-sharing-delegation--audit)
- [9. Open Decisions](#9-open-decisions)

---

## 1. Purpose

Access in AGE is **scoped, membership-based, isolated, and audited.** This document defines those
properties so every feature applies access consistently. Concrete grants per persona are listed in
Doc 01 (each persona's _Permissions_ and _Decision Authority_); this document defines the model they
fit into.

## 2. Subjects (Who)

Access subjects are **Platform Personas** (Doc 05 terminology):

- **Human Personas.**
  - **Agency members** — users belonging to the Organization (the agency teams in Doc 01:
    Executive Leadership, Strategy, Delivery, Revenue). May be granted access to one or more Clients.
  - **Client members** — external users belonging to a single Client (Doc 01 Client Team); they see
    only their own Client.
- **AI Workforce Personas** — **not permission subjects in the human sense.** Agents act under their
  contract's _Decision Authority_ and _Constraints_ (Doc 04), never hold approval authority, and are
  governed in [§7](#7-ai-workforce--permissions).

A user belongs to exactly one Organization (Doc 02 §12).

## 3. Scopes (Where)

Every permission is **scoped** to a container from the Workspace Model (Doc 02). There is no
unscoped, global permission over business data.

| Scope                       | Holds                                                                             |
| --------------------------- | --------------------------------------------------------------------------------- |
| **Organization**            | The agency tenant; Shared Agency Resources; the set of Clients.                   |
| **Client**                  | One Business's intelligence (BIF, BKG, Research, Strategy), Assets, and Projects. |
| **Project**                 | Execution artifacts within a Client.                                              |
| **Shared Agency Resources** | Agency-owned frameworks/templates/playbooks (referenceable by clients).           |

## 4. Actions (What)

The canonical action vocabulary (derived from the per-persona _Permissions_ in Doc 01):

**Read · Create · Update · Delete · Approve · Export · Admin.**

- **Delete** is **soft delete** (Doc 02 §2; records are retained and auditable, never hard-erased).
- **Approve** authorizes a decision or gates execution (see §6).
- **Admin** governs configuration/membership within a scope.
- Actions that cause **external side effects** (publish, deploy, send) are **not** general
  permissions — they occur only in the Execution Layer and are gated by approval (§6).

The concrete mapping of _which subject holds which actions in which scope_ (the role→permission
matrix) is **deferred** — see [§9](#9-open-decisions).

## 5. Access & Isolation Rules

Derived from Doc 02 §15 (canonical isolation):

1. Access is **scoped** — a subject acts only within scopes it is a member of or granted.
2. **Agency may read across its own Clients** (portfolio/aggregation); a **Client never** reads
   another Client.
3. **No cross-Organization (cross-tenant) access**, ever.
4. **No automatic cross-client knowledge sharing** (Doc 02 §15); client-derived knowledge stays
   isolated. Shared Agency Resources may be shared; client knowledge may not.
5. Soft-deleted records remain isolated and auditable; excluded from normal reads, retained for
   history.

## 6. Approval & the Execution Boundary

- **Humans approve; agents propose** (Doc 04). Each persona's _Decision Authority_ (Doc 01) states
  what it may decide independently vs. what requires approval.
- **Approval gates the Execution Layer.** Only the Execution Layer performs external side effects
  (publish/deploy/send/push); such actions require the appropriate **Approve** authority first.
- **Humans are the only supervisory authority** (Doc 04); no agent approves another agent's or a
  human's action.

## 7. AI Workforce & Permissions

Governed by Doc 04 and restated here as access rules:

1. **Agents are pure producers** — they never perform side effects; they produce proposals/artifacts.
2. **Agents are scoped** to a single Client/Project per operation and **never cross client
   boundaries**.
3. **Agents hold no approval authority** and **cannot bypass** human approval, audit, or evidence
   requirements (Doc 01 Constraints).
4. **Clients are not assigned agents** (Doc 04) — the AI Workforce is a platform reasoning layer;
   capability availability, not agent assignment, determines what runs for a Client.

## 8. Sharing, Delegation & Audit

- **Delegation.** Agency members may be **granted** access to specific Clients (and, where relevant,
  Projects). Client members are confined to their own Client.
- **Sharing.** Only **Shared Agency Resources** may be shared across Clients; **client-derived
  knowledge is never shared** between Clients (Doc 02 §15).
- **Audit (always-on).** Every access and action is **audited** and **no permission bypasses audit**
  (Doc 01: "cannot bypass audit logging"; persistence AuditLog). Approvals and their evidence are
  recorded.

## 9. Open Decisions

> Genuine product/security decisions not derivable from the frozen architecture or Final Docs.
> Several overlap with the Security Model (Doc 13).

1. **Authoritative role → permission matrix.** Doc 01 lists per-persona _Permissions_ as starting
   points; a consolidated, canonical role→action→scope matrix is a product/security decision.
2. **Policy model.** Whether access control is role-based (RBAC), attribute-based (ABAC),
   capability-based, or a hybrid — a design decision (likely Doc 13 / implementation).
3. **Client-member granularity.** Are client members read-only by default? Per-Project access? Which
   actions (Export?) are available to client members?
4. **Agency access default.** Do agency members get access to **all** Clients by default, or only by
   explicit grant?
5. **Admin scope boundaries.** What exactly does **Admin** govern at Organization vs. Client vs.
   Project scope, and who holds it?
6. **Boundary with Doc 13 (Security Model).** Which concerns (authentication, session, enforcement)
   belong to Doc 13 vs. this document's business-level model.
