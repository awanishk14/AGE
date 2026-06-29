# Configuration Model

> Part of the **AGE Product Bible**. See the [Product Bible README](./README.md).

## Purpose

This document defines, at the **business level**, how AGE is **configured** — the **scopes** at which
configuration applies, how **defaults and overrides** cascade under platform governance, what
configuration **governs**, its separation from Permissions and Security, and the **secrets boundary**.
Derived from the Workspace Model (Doc 02), Permission Model (Doc 06), Security Model (Doc 13), and the
configuration touchpoints in Docs 04, 08, 09, 11.

**Configuration is a controlled variability layer, not a control system.** Its purpose is to allow
structured adaptation of AGE across organizations and use cases **while preserving a single unified
platform architecture** — flexibility without fragmentation. It defines the configuration **model**,
not its implementation (schemas, settings catalogs, storage, secret values).

> **Status:** Final — approved by the Product Owner. Completes the system-wide configuration boundary.

## Scope

- **In scope:** configuration scopes, the cascade/override semantics under governance, what
  configuration governs, the Config/Permissions/Security separation, the secrets boundary, isolation,
  and audit.
- **Out of scope:** configuration schemas/settings catalogs, storage, secret values/storage (Doc 13),
  licensing/packaging implementation, and UX.

## Status

Final.

## Related Documents

- [Workspace Model](./02_WORKSPACE_MODEL.md) · [Permission Model](./06_PERMISSION_MODEL.md) · [Security Model](./13_SECURITY_MODEL.md) — **Final**.
- [AI Agent Architecture](./04_AI_AGENT_ARCHITECTURE.md) · [Notification Model](./08_NOTIFICATION_MODEL.md) · [Automation Model](./09_AUTOMATION_MODEL.md) · [Integration Catalog](./11_INTEGRATION_CATALOG.md) — **Final**.

## Table of Contents

- [1. Principles](#1-principles)
- [2. Configuration Scopes](#2-configuration-scopes)
- [3. Defaults & Override Semantics](#3-defaults--override-semantics)
- [4. Platform Governance Constraint](#4-platform-governance-constraint)
- [5. What Configuration Governs](#5-what-configuration-governs)
- [6. Configuration vs Permissions vs Security](#6-configuration-vs-permissions-vs-security)
- [7. Secrets Boundary](#7-secrets-boundary)
- [8. Client Configuration Surface](#8-client-configuration-surface)
- [9. Isolation, Audit & Resolved Decisions](#9-isolation-audit--resolved-decisions)

---

## 1. Principles

1. **Controlled variability, not control.** Configuration adapts behavior; it is **never** a hidden
   control plane and cannot grant access, side-effect, or bypass governance.
2. **Scoped & cascading.** Configuration applies at business scopes; each level **refines or
   constrains** the level above.
3. **Most specific valid configuration wins** — but only where overriding is **explicitly allowed**
   (§3).
4. **Safe defaults.** The platform provides defaults; absence of an override never means absence of a
   safe value.
5. **Secret values are never part of the product model** (§7).

## 2. Configuration Scopes

The canonical hierarchy (Doc 02) defines **where configuration is applied** — not data ownership or
permissions:

```
Platform → Organization → Client → Project → User
```

| Scope            | Configures                                                        |
| ---------------- | ----------------------------------------------------------------- |
| **Platform**     | Global defaults for all tenants.                                  |
| **Organization** | Agency-wide settings and Shared Agency Resources.                 |
| **Client**       | Per-Client settings (within the Client's available capabilities). |
| **Project**      | Per-Project settings.                                             |
| **User**         | Personal preferences (e.g., notification behavior — Doc 08).      |

## 3. Defaults & Override Semantics

A **strict cascade** model:

- Higher-level configuration defines **defaults**.
- Lower-level configuration **may override** — **but only values that higher-level scopes explicitly
  allow to be overridden.**
- The **most specific valid configuration always applies.**

This keeps governance control intact at the Organization and Platform levels.

## 4. Platform Governance Constraint

All configuration is **subject to platform governance**:

- **Platform** configuration may constrain all lower scopes.
- **Organization** configuration may constrain all its Clients and Projects.
- **Client** configuration may constrain all Projects within that Client.

**No configuration level can override governance constraints defined above it.**

## 5. What Configuration Governs

Configuration governs **behavioral enablement — not system logic.** Canonical domains:

- **Capability availability** — which capabilities are enabled in a context.
- **Integration enablement** — which external systems are available in a context.
- **User preferences** — interaction-level preferences (e.g., notification behavior, Doc 08).
- **Client-level operational settings** — within platform constraints.
- **Feature toggles** — within defined capability boundaries.

Configuration **does not define logic or system behavior itself** — only whether and how enabled
behavior is available within allowed boundaries.

## 6. Configuration vs Permissions vs Security

Three distinct systems that must **not overlap**:

| System                     | Role                                                                   |
| -------------------------- | ---------------------------------------------------------------------- |
| **Permissions (Doc 06)**   | Defines **what is allowed**.                                           |
| **Security (Doc 13)**      | **Enforces** protection and isolation.                                 |
| **Configuration (Doc 14)** | Defines **how enabled capabilities behave** within allowed boundaries. |

**Configuration can never grant access that permissions do not allow, and never bypasses security
constraints.**

## 7. Secrets Boundary

- Configuration may **reference** secrets but **must never contain them.** It stores **references
  only.**
- **Secret values exist exclusively in the Security / Infrastructure layer** (Doc 13).
- **No product-layer component may directly access secret values** — AI Agents and pure reasoning
  layers are explicitly excluded from any secret exposure (Doc 11, Doc 13).

## 8. Client Configuration Surface

Clients may configure **only within**: capabilities they have access to · integrations that are
enabled · behavioral options the platform exposes.

Clients **cannot**: create new capabilities · modify platform behavior · alter permission structures ·
bypass security or execution constraints. This preserves the integrity of the platform model.

## 9. Isolation, Audit & Resolved Decisions

- **Scoped & isolated.** Configuration belongs to its scope and never implicitly spans unrelated
  contexts; Client/Project configuration never crosses Client or tenant boundaries (Doc 02 §15).
- **Audited.** Configuration changes are **auditable** (persistence AuditLog) — who changed what, at
  which scope, when.

**Resolved Decisions (canonical):**

1. **Scope hierarchy** Platform → Organization → Client → Project → User — _where_ configuration
   applies, not ownership/permissions; each level refines/constrains the one above.
2. **Override semantics** — strict cascade; lower scopes override only **explicitly allowed** values;
   most specific valid configuration wins.
3. **Behavioral enablement, not logic** — capability availability, integration enablement, user
   preferences, client operational settings, in-bounds feature toggles.
4. **Config vs Permissions vs Security** are distinct; configuration never grants access or bypasses
   security.
5. **Secret references only** — values live solely in Security/Infrastructure; never reachable by
   product/AI/pure layers.
6. **Platform governance constraint** — no level overrides governance defined above it.
7. **Client configuration surface** — only within available capabilities/enabled integrations/exposed
   options; clients cannot create capabilities, change platform behavior, or alter permission/security.

**Deferred to implementation / future:** the per-scope settings catalog (implementation, evolving) and
the licensing/packaging model that determines capability availability (future product decision).
