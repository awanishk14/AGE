# Integration Catalog

> Part of the **AGE Product Bible**. See the [Product Bible README](./README.md).

## Purpose

This document defines, at the **business level**, what integrations **represent**, how they relate to
business context, and how they are **governed** — the conceptual model for AGE's connections to the
external business ecosystem. Derived from the integration provider contracts (`@age/integrations`),
the personas (Doc 01), the Research engine sources (RIE), and the Execution Domains (ADR-0007).

It defines the integration **model**, not a fixed list. It does not enumerate a catalog, nor define
API specifics, authentication/credential mechanics (Doc 13), secret storage (Doc 14), or sync engines.

> **Status:** Final — approved by the Product Owner. Conforms to Final Docs 01–10 and the frozen
> integration contracts.

## Scope

- **In scope:** what integrations represent, their classification, the execution boundary, connection
  scope/isolation, credential boundary, capability-enablement, and audit.
- **Out of scope:** the supported-integration list (implementation, evolving), API specifics,
  authentication/credentials (Doc 13), secret storage (Doc 14), sync engines, and field mappings.

## Status

Final.

## Related Documents

- [User Journeys](./01_USER_JOURNEYS.md) — per-persona _Integrations Used_.
- [Workspace Model](./02_WORKSPACE_MODEL.md) · [Permission Model](./06_PERMISSION_MODEL.md) · [Automation Model](./09_AUTOMATION_MODEL.md) — **Final**.
- [Execution Model](./12_EXECUTION_MODEL.md) — the side-effect layer.
- [Security Model](./13_SECURITY_MODEL.md) · [Configuration Model](./14_CONFIGURATION_MODEL.md) — credentials & secrets.

## Table of Contents

- [1. Principles](#1-principles)
- [2. Integration Classification](#2-integration-classification)
- [3. What Integrations Represent](#3-what-integrations-represent)
- [4. Execution Boundary](#4-execution-boundary)
- [5. Connection Scope & Isolation](#5-connection-scope--isolation)
- [6. Credentials](#6-credentials)
- [7. Capability-Enablement & Audit](#7-capability-enablement--audit)
- [8. Resolved Decisions](#8-resolved-decisions)

---

## 1. Principles

1. **Integrations are contextual perception and action channels** between AGE and the external
   business ecosystem. They exist to **enrich business understanding** (sensing), **extend operational
   reach** (execution), and **support automation and intelligence workflows.**
2. **Not independent modules.** Integrations are **always interpreted through the lens of Client and
   Project context** — never as standalone systems.
3. **Respect the execution boundary** (§4): reading is sensing; writing/acting is a side effect that
   passes through the Execution Layer.
4. **Scoped & isolated** to a business boundary (§5).
5. **Capability-enabled** (§7), not user-managed primitives.

## 2. Integration Classification

The canonical conceptual classification (no further subtyping required):

| Class                     | Role                                                               |
| ------------------------- | ------------------------------------------------------------------ |
| **Source Integration**    | Provides business signals — read-only ingestion context (sensing). |
| **Execution Integration** | Performs external actions — write / side-effect surface.           |
| **Hybrid Integration**    | May serve **both** roles depending on the capability using it.     |

### 2.1 Peer Products Are Not Integrations

Some external systems AGE composes with are **not integrations at all**. A **peer product** is a
system that is **independently viable** — it has its own users, its own value proposition, and can be
sold and operated with AGE absent — and which AGE nonetheless consumes.

|                      | Integration                                       | Peer product                                                               |
| -------------------- | ------------------------------------------------- | -------------------------------------------------------------------------- |
| Exists without AGE   | Not meaningfully — it is a channel                | Yes, as a product in its own right                                         |
| Who owns its roadmap | The vendor                                        | The same product organization as AGE                                       |
| How AGE reaches it   | A connection configured within a business context | Its **public product boundary** — the same surface any other consumer uses |
| If AGE is removed    | The channel has no remaining purpose              | Nothing changes for its own users                                          |

Three rules govern peer products, and they are the point of this section:

1. **The dependency arrow points from AGE outward and never back.** AGE may depend on a peer
   product. A peer product must never grow an AGE-shaped dependency — no AGE-only endpoint, no AGE
   concept in its domain model, no coupling that makes it unsellable alone.
2. **AGE consumes a peer product across its public product boundary only** — never a private table,
   never a shared database, never an internal module. A shared datastore would silently merge two
   products into one and destroy the independence this section exists to protect.
3. **A peer product is classified for §2 purposes by what AGE does with it**, exactly as any other
   external system: read-only consumption is **sensing**, and anything that writes or acts is
   **execution** and passes through the Execution Layer (§4, Doc 12 §6.1).

⚠️ **This does not weaken §1.2.** Data arriving from a peer product is still interpreted only through
Client and Project context, and is still never treated as a standalone system _inside AGE's
reasoning_. §1.2 governs **how AGE interprets what arrives**; it says nothing about whether the
system on the other end can exist without AGE.

⚠️ **"Peer product" is not a licence to bypass anything.** It changes ownership and commercial
independence, not the execution boundary, not scope isolation, and not approval.

## 3. What Integrations Represent

Integrations are **external data sources, external execution surfaces, and evolving ecosystem
dependencies.** The Product Bible defines **what they represent**, **how they relate to business
context**, and **how they are governed** — **not a fixed or exhaustive catalog.**

The **actual list of supported integrations is an implementation-level concern and evolves
continuously.** The frozen integration contracts and the personas' _Integrations Used_ (Doc 01)
provide current _examples_ — analytics, search, ads, CRM, engineering/SSH, and research/review/social
sources — but these are **illustrative, not a canonical catalog.**

## 4. Execution Boundary

External systems are strictly separated by function:

- **Reading external data is a sensing operation** (inbound; becomes Evidence via RIE).
- **Writing to / modifying external systems is a side-effect operation** (outbound).
- **All side effects must pass through the Execution Layer** (Doc 04, Doc 12), gated by approval
  (Doc 06).
- **No integration may bypass this boundary** (aligns with Docs 04, 09, 10).

## 5. Connection Scope & Isolation

> **Connections belong to a defined business boundary (Organization, Client, or Project context) and
> must not implicitly span unrelated contexts.**

- Integration data is owned by the connecting context and isolated to it (Doc 02 §15).
- **Cross-context data sharing is not automatic** — preserving the platform isolation model.

## 6. Credentials

Credentials and authentication material are **not part of the product model.** The Product Bible
defines only that connections:

- **exist**, are **authorized**, are **revocable**, and are **scoped to a business context**.

**How credentials are stored, rotated, or secured belongs to security and infrastructure design**
(Doc 13 Security; Doc 14 Configuration) — reinforcing the boundary with Doc 13.

## 7. Capability-Enablement & Audit

- **Capability-enabled, not user-managed.** Integrations are **not** configured by users as standalone
  systems. They **become available through the capabilities exposed within a given business context**,
  aligning integrations with AGE's capability-driven architecture.
- **Audited.** Connecting, sensing, and acting through an integration are **auditable** (persistence
  AuditLog) — including what data moved and what external action was taken.

## 8. Resolved Decisions

The following were resolved by the Product Owner and are now canonical:

1. **No fixed catalog.** The Product Bible defines what integrations represent and how they are
   governed; the supported-integration list is implementation and evolves continuously.
2. **Classification.** Source / Execution / Hybrid integrations — sufficient at the Product Bible
   level; no further subtyping.
3. **Execution boundary.** Reading = sensing; writing = side effect; all side effects pass through the
   Execution Layer; no integration bypasses it.
4. **Connection scope.** Connections belong to a defined business boundary (Organization, Client, or
   Project) and never implicitly span unrelated contexts; cross-context sharing is not automatic.
5. **Credential ownership** is out of the product model — security/infrastructure concern (Doc 13/14);
   the product defines only that connections exist, are authorized, revocable, and scoped.
6. **Capability-enabled.** Integrations are exposed through capabilities within a business context,
   not configured as standalone user primitives.

7. **Peer products** (§2.1). An independently viable system that AGE composes with is not an
   integration. AGE consumes it across its public product boundary only; the dependency arrow points
   from AGE outward and never back; and the execution boundary, scope isolation and approval apply to
   it unchanged.

**Canonical principle:** integrations are **contextual perception and action channels** — sensing to
enrich understanding, execution to extend reach — always interpreted through Client and Project
context, never as independent system modules.
