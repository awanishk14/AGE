# Configuration Model

> Part of the **AGE Product Bible**. See the [Product Bible README](./README.md).

## Purpose

This document defines, at the **business level**, how AGE is **configured** — the **scopes** at which
configuration exists, how **defaults and overrides** cascade, what configuration **governs**, and the
**boundary with secrets** (whose values belong to security/infrastructure, Doc 13). Derived from the
Workspace Model (Doc 02), Security Model (Doc 13), and the configuration touchpoints in Docs 04, 08,
09, 11.

It defines the configuration **model**, not its implementation. It does not define configuration
schemas, settings catalogs, storage, or secret values.

> **Status:** In Progress — derived from Final Docs and the frozen architecture. Genuine decisions
> not derivable from existing material are surfaced in [§7 Open Decisions](#7-open-decisions).

## Scope

- **In scope:** configuration scopes, the defaults/overrides cascade, what configuration governs, the
  secrets boundary, isolation, and audit.
- **Out of scope:** configuration schemas/settings catalogs, storage, secret values/storage (Doc 13),
  licensing/packaging implementation, and UX.

## Status

In Progress.

## Related Documents

- [Workspace Model](./02_WORKSPACE_MODEL.md) — **Final**; the scope hierarchy.
- [Security Model](./13_SECURITY_MODEL.md) — **Final**; secret storage/protection.
- [AI Agent Architecture](./04_AI_AGENT_ARCHITECTURE.md) · [Notification Model](./08_NOTIFICATION_MODEL.md) · [Automation Model](./09_AUTOMATION_MODEL.md) · [Integration Catalog](./11_INTEGRATION_CATALOG.md) — **Final**.

## Table of Contents

- [1. Principles](#1-principles)
- [2. Configuration Scopes](#2-configuration-scopes)
- [3. Defaults & Overrides](#3-defaults--overrides)
- [4. What Configuration Governs](#4-what-configuration-governs)
- [5. Secrets Boundary](#5-secrets-boundary)
- [6. Isolation & Audit](#6-isolation--audit)
- [7. Open Decisions](#7-open-decisions)

---

## 1. Principles

1. **Configuration is scoped and cascading.** It exists at multiple business scopes; more specific
   scopes refine more general ones.
2. **Most-specific wins.** When the same setting is defined at multiple scopes, the most specific
   scope governs.
3. **Safe defaults.** The platform provides defaults; absence of an override never means absence of a
   safe value.
4. **Configuration never bypasses governance.** It operates within the Permission, Security,
   Execution, and Automation models — it cannot grant access, side-effect, or escape isolation.
5. **Secret values are never part of the product model** (§5).

## 2. Configuration Scopes

Configuration scopes mirror the business hierarchy (Doc 02), bracketed by platform defaults and user
preferences:

| Scope            | Configures                                                             |
| ---------------- | ---------------------------------------------------------------------- |
| **Platform**     | Global defaults for all tenants.                                       |
| **Organization** | Agency-wide settings and Shared Agency Resources.                      |
| **Client**       | Per-Client settings (within the capabilities available to the Client). |
| **Project**      | Per-Project settings.                                                  |
| **User**         | Personal preferences (e.g., notification preferences — Doc 08).        |

## 3. Defaults & Overrides

Configuration resolves by **cascade**, from general to specific:

```
Platform defaults → Organization → Client → Project → User
                         (more specific overrides less specific)
```

- The platform establishes **defaults**; each more specific scope may **override** within what
  governance and capability availability permit.
- **Most-specific wins** for any given setting (§1.2).

## 4. What Configuration Governs

Configuration governs, within established boundaries:

- **Capability availability / enablement.** Which capabilities (and therefore which agents and
  integrations) are available in a context — driven by capability availability and future
  licensing/packaging (Doc 04 §2, Doc 11 §7), **not** by assigning agents.
- **User preferences.** E.g., notification preferences (Doc 08), within what required business
  communication allows.
- **Client configuration.** Clients configure available automations and settings **within the
  capabilities made available to them** (Doc 09) — they do not add types or change governance.
- **Integration connections.** A connection's existence/authorization/scope is configuration (Doc 11);
  its **credentials** are not (§5).
- **Behavior toggles** that stay within the governance models (never granting access or bypassing the
  execution boundary).

## 5. Secrets Boundary

- Configuration may **reference** secrets/credentials (e.g., "this connection uses a credential"), but
  **secret values are never part of the product model.**
- **Secret storage, protection, and rotation are owned by Security + Infrastructure** (Doc 13);
  secrets are **never accessible to AI Agents or pure reasoning layers** (Doc 11, Doc 12).
- The Configuration Model carries **references and scope**, not sensitive material.

## 6. Isolation & Audit

- **Scoped & isolated.** Configuration belongs to its scope and never implicitly spans unrelated
  contexts; Client/Project configuration never crosses Client or tenant boundaries (Doc 02 §15).
- **Audited.** Configuration changes are **auditable** (persistence AuditLog) — who changed what, at
  which scope, and when.

## 7. Open Decisions

> Genuine decisions not derivable from the frozen architecture or Final Docs.

1. **Per-scope settings catalog.** The authoritative set of settings available at each scope
   (implementation, evolving).
2. **Override constraints.** Which settings a more specific scope may or may not override (e.g.,
   settings an Organization locks for its Clients).
3. **Licensing / packaging model.** How capability availability is determined (subscription/packaging)
   — a future product decision.
4. **Client-configurable surface.** Exactly what Client members may configure within their available
   capabilities.
5. **Secret reference model.** How configuration references a secret without holding it (coordinate
   with Doc 13).
