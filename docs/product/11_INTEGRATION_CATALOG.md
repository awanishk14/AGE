# Integration Catalog

> Part of the **AGE Product Bible**. See the [Product Bible README](./README.md).

## Purpose

This document defines, at the **business level**, how AGE connects to external systems — the
**roles** integrations play, the **catalog** of integrations referenced across the platform, and the
principles for **data scope, sync, ownership, and audit**. Derived from the integration provider
contracts (`@age/integrations`), the personas (Doc 01), the Research engine sources (RIE), and the
Execution Domains (ADR-0007).

It defines the integration **model and catalog**, not implementation. It does not define API details,
authentication/credential mechanics (Doc 13), secret storage (Doc 14), or sync engines.

> **Status:** In Progress — derived from Final Docs 01–10 and the frozen integration contracts.
> Genuine decisions not derivable from existing material are surfaced in [§8 Open Decisions](#8-open-decisions).

## Scope

- **In scope:** integration roles, the catalog (by reference to frozen contracts), data-scope
  principles, sync behavior at the business level, connection ownership, and audit.
- **Out of scope:** API specifics, authentication/credential mechanics (Doc 13), secret storage
  (Doc 14), sync engines, rate limits, and field-level mappings.

## Status

In Progress.

## Related Documents

- [User Journeys](./01_USER_JOURNEYS.md) — per-persona _Integrations Used_.
- [Workspace Model](./02_WORKSPACE_MODEL.md) · [Permission Model](./06_PERMISSION_MODEL.md) · [Execution Model](./12_EXECUTION_MODEL.md) — **Final**/forthcoming.
- [Security Model](./13_SECURITY_MODEL.md) · [Configuration Model](./14_CONFIGURATION_MODEL.md) — credentials & secrets.

**Architecture references (do not modify):** [AGE_SYSTEM_MAP](../architecture/AGE_SYSTEM_MAP.md) · [ADR-0007](../adrs/0007-capability-vs-execution-domain.md).

## Table of Contents

- [1. Principles](#1-principles)
- [2. Integration Roles](#2-integration-roles)
- [3. Integration Catalog](#3-integration-catalog)
- [4. Authentication & Credentials](#4-authentication--credentials)
- [5. Data Scope](#5-data-scope)
- [6. Sync Behavior](#6-sync-behavior)
- [7. Connection Ownership & Audit](#7-connection-ownership--audit)
- [8. Open Decisions](#8-open-decisions)

---

## 1. Principles

1. **Integrations connect AGE to external systems** for two purposes: **sensing** (bringing data in)
   and **execution** (acting out). Nothing else.
2. **Integrations respect the execution boundary.** Reading from an external source is **sensing**;
   writing to / acting on an external system is an **Execution Layer side effect** (Doc 04), gated by
   approval (Doc 06).
3. **Scoped & isolated.** Integration data belongs to the connecting context and never crosses Client
   or tenant boundaries (Doc 02 §15).
4. **Extensible by contract.** Every integration implements a **common provider contract**
   (`@age/integrations`); new integrations are added without changing the model.

## 2. Integration Roles

| Role                  | Meaning                                          | Where it lands            |
| --------------------- | ------------------------------------------------ | ------------------------- |
| **Input / Source**    | Brings external data **in** as evidence/signals. | Research → Evidence (RIE) |
| **Execution Surface** | The external system AGE **acts on**.             | Execution Layer (Doc 12)  |

Some integrations serve **both** roles (e.g., an ads platform is a _source_ of performance data and
an _execution surface_ for campaign actions).

## 3. Integration Catalog

The catalog is **derived from the frozen integration provider contracts** (`@age/integrations`), the
personas' _Integrations Used_ (Doc 01), and the Research sources (RIE `EvidenceSource`). It is the
**current set** and is **extensible** via the common contract (§1.4) — not a closed list.

| Integration                                                         | Typical role(s)                             |
| ------------------------------------------------------------------- | ------------------------------------------- |
| **Google Analytics / GA4**                                          | Input (analytics)                           |
| **Google Search Console**                                           | Input (search performance)                  |
| **Google Ads**                                                      | Input + Execution (ads)                     |
| **Meta Ads**                                                        | Input + Execution (ads)                     |
| **LinkedIn Ads**                                                    | Input + Execution (ads)                     |
| **GitHub**                                                          | Input + Execution (engineering/SSH context) |
| **SSH**                                                             | Execution (technical execution surface)     |
| **Reddit · G2 · Capterra · Trustpilot · YouTube**                   | Input (research/review/social signals)      |
| **Google Search / Competitor sites / Forums**                       | Input (research signals)                    |
| **CRM**                                                             | Input + Execution (pipeline/customer data)  |
| **Email · Calendar · Collaboration platform · Accounting platform** | Input + Execution (per Doc 01 personas)     |

> The authoritative, prioritized list of **supported** integrations (MVP and roadmap) is a product
> decision (§8); this catalog reflects what the frozen contracts and personas reference.

## 4. Authentication & Credentials

- An integration requires an **authorized connection** to the external system.
- **Credential and authentication mechanics are not defined here** — they belong to the **Security
  Model (Doc 13)**; **secret storage** belongs to the **Configuration Model (Doc 14)**.
- This document establishes only that connections are **authorized, owned, and revocable**.

## 5. Data Scope

- Each integration moves a **defined scope of data** for a specific business purpose; AGE requests
  **only the data needed** for the sensing/execution purpose.
- Integration data is **owned by the connecting context** (typically a Client) and isolated to it
  (Doc 02 §15).
- The concrete per-integration data scopes are implementation (§8).

## 6. Sync Behavior

- **Inbound (sensing).** Source integrations bring data in as Evidence (RIE); this is reading, not a
  side effect.
- **Outbound (execution).** Execution-surface integrations act on external systems **only via the
  Execution Layer**, after the required approval (Doc 06, Doc 12).
- **Frequency & mechanics** (polling vs. push, schedules, rate limits, retries) are implementation;
  the Product Bible does not define cadences (consistent with Doc 09).

## 7. Connection Ownership & Audit

- **Ownership.** A connection is owned by the context that establishes it. Whether connections are
  established at **Organization** or **Client** scope (or both) is an open decision (§8); in all cases
  data remains isolated per Client.
- **Audited.** Connecting, syncing, and acting through an integration are **auditable** (persistence
  AuditLog) — including what data moved and what external action was taken.

## 8. Open Decisions

> Genuine decisions not derivable from the frozen architecture or Final Docs.

1. **Authoritative supported-integration list & roadmap.** Which integrations are MVP vs. later, and
   their prioritization (the frozen contracts scaffold a set; product selection is a decision).
2. **Connection scope.** Are integrations connected at **Organization** level, **Client** level, or
   both? (Data stays Client-isolated regardless.)
3. **Per-integration data scopes.** The specific data each integration reads/writes.
4. **Sync model per integration.** Inbound cadence and outbound action sets per integration
   (implementation, but product may set defaults).
5. **Credential model boundary.** Confirm the split: connection _concept_ here, credential/auth
   mechanics in Doc 13, secret storage in Doc 14.
