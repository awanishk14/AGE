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

### 2.1 Three Categories of System

§2 classifies an integration by **what AGE does with it**. That is orthogonal to a prior question:
**who owns the thing, and could it exist without AGE?** Three categories answer it, and every system
AGE touches falls into exactly one.

| Category                 | What it is                                        | Owned by                 | Exists without AGE             | AGE reaches it via                    |
| ------------------------ | ------------------------------------------------- | ------------------------ | ------------------------------ | ------------------------------------- |
| **External Integration** | Someone else's product                            | A third-party vendor     | Yes — AGE is irrelevant to it  | A connection in a business context    |
| **Peer Product**         | An independent product the same organization owns | The product organization | Yes — it has its own customers | Its **public contract only** (§2.1.1) |
| **AGE-native**           | Exists **only because AGE exists**                | AGE                      | No — it is AGE's core value    | Not applicable — it _is_ AGE          |

- **External Integration** — Google Ads, Search Console, GA4, HubSpot, Salesforce, Shopify. AGE has
  **no influence over their roadmap** and must assume none. Governed entirely by §2–§7.
- **Peer Product** — see §2.1.1. Independently viable and independently sellable.
- **AGE-native** — the Intent Engine, the Strategy Engine, BIF generation, orchestration, planning,
  and the approval workflow. 🚫 **These must never be extracted into standalone products.** They are
  the reason AGE is worth having; a peer product that reproduced them would be a competitor built
  from AGE's own substance.
  ⚠️ "AGE-native" is an **ownership** category, not the frozen **Capability** concept. It spans both
  the registered Capabilities and the platform machinery beneath them (Capability Architecture).

⚠️ **The categories are about ownership; §2's Source/Execution/Hybrid classes are about use.** A peer
product is still classified Source, Execution or Hybrid according to what AGE does with it. The two
axes are independent and neither overrides the other.

### 2.1.1 Peer Products Are Not Integrations

Some external systems AGE composes with are **not integrations at all**. A **peer product** is a
system that is **independently viable** — it has its own users, its own value proposition, and can be
sold and operated with AGE absent — and which AGE nonetheless consumes.

Because AGE integrates with a peer product **only through its public contract**, each product remains
**independently deployable, independently sellable, and independently evolvable.** An organization
may use the peer product without AGE, AGE without the peer product, or both together. **No product
acquires AGE-specific behaviour.** This is the whole commercial point of the category: it is what
keeps one codebase from becoming two — a standalone edition and an AGE-flavoured edition.

|                      | Integration                                       | Peer product                                                               |
| -------------------- | ------------------------------------------------- | -------------------------------------------------------------------------- |
| Exists without AGE   | Not meaningfully — it is a channel                | Yes, as a product in its own right                                         |
| Who owns its roadmap | The vendor                                        | The same product organization as AGE                                       |
| How AGE reaches it   | A connection configured within a business context | Its **public product boundary** — the same surface any other consumer uses |
| If AGE is removed    | The channel has no remaining purpose              | Nothing changes for its own users                                          |

Four rules govern peer products, and they are the point of this section:

1. **The dependency arrow points from AGE outward and never back.** AGE may depend on a peer
   product. A peer product must never grow an AGE-shaped dependency — no AGE-only endpoint, no AGE
   concept in its domain model, no coupling that makes it unsellable alone.

   ⚠️ **This forbids features that _only_ benefit AGE — not features AGE happened to motivate.**
   Composition legitimately reveals gaps, and a peer product may evolve because AGE exposed a useful
   capability. The test is **not** where the idea came from; it is: **would this enhancement make
   sense for the peer product's own users and roadmap if AGE did not exist?** If yes, build it — it
   is ordinary product evolution. If it is justifiable only by AGE's needs, it is the coupling this
   rule exists to prevent.

2. **AGE consumes a peer product across its public product boundary only** — never a private table,
   never a shared database, never an internal module. A shared datastore would silently merge two
   products into one and destroy the independence this section exists to protect.

   ⚠️ **A peer product may itself expose capabilities internally, but AGE never depends on those
   capabilities directly. AGE depends only on the peer product's published contract.** An internal
   service is not a contract: it carries no compatibility promise, so the moment AGE calls one, the
   peer product can no longer refactor its own internals without breaking AGE — which is rule 1's
   dependency arrow reversed by accident rather than by decision.
   ⚠️ **"Capability" here means the peer product's own internal notion**, not AGE's frozen Capability
   concept (§2.1). The two are unrelated.

3. **A peer product is classified for §2 purposes by what AGE does with it**, exactly as any other
   external system: read-only consumption is **sensing**, and anything that writes or acts is
   **execution** and passes through the Execution Layer (§4, Doc 12 §6.1).

4. **Hub and spoke — a peer product never interacts with another peer product.** Cross-product
   insight is produced **only** by AGE reasoning over a shared BIF (Doc 02 §8), never by wiring two
   peer products together. Direct wiring would (a) grow to N² bespoke connections, (b) let two
   products take an independent decision — the exact failure AGE exists to prevent — and (c) place
   the conclusion in a product that cannot see the whole client. Each peer product contributes what
   it observes as Evidence and **reads nothing about the others.**

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

### 6.1 Credential Locality (canonical principle)

> **Credentials are owned only by execution surfaces. AGE stores references, never secrets.**

The **execution surface** that talks to a service owns that service's credentials. AGE stores only the
**references** required to route a request to the correct execution surface within the correct client
scope.

⚠️ **"Execution surface" means an Execution Integration or a peer product — never a Capability.**
Capabilities are pure and may never invoke an external system or see a credential (§4, Doc 12 §1–§2).
The frozen architecture forbids the reading in which a Capability holds a secret.

This is a **principle, not a deployment detail**, and it holds for every service AGE will ever reach —
Google Ads, Meta, LinkedIn, Search Console, GA4, Shopify, WooCommerce, HubSpot, Slack. Three
consequences:

- **A compromise of AGE does not expose a single third-party account.** There is nothing to take.
- **Revocation stays with the owner of the connection**, not with AGE.
- **Multi-tenant SaaS needs no new credential model.** Each customer's account stays connected to the
  execution surface they already authorized; AGE's stored reference is scoped per §5 and names a
  route, never a secret.

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

7. **Peer products** (§2.1.1). An independently viable system that AGE composes with is not an
   integration. AGE consumes it across its public product boundary only; the dependency arrow points
   from AGE outward and never back; and the execution boundary, scope isolation and approval apply to
   it unchanged.
8. **Three ownership categories** (§2.1): **External Integration** (a third party's product),
   **Peer Product** (an independent product the same organization owns), **AGE-native** (exists only
   because AGE exists, and is never extracted into a standalone product). Orthogonal to the
   Source/Execution/Hybrid classification of §2.
9. **Peer-product evolution.** Rule 1 forbids features that **only** benefit AGE, not features AGE
   motivated. The test is whether the enhancement stands on the peer product's own roadmap with AGE
   absent (§2.1.1 rule 1).
10. **Hub and spoke.** A peer product never interacts with another peer product; cross-product
    insight is produced only by AGE reasoning over a shared BIF (§2.1.1 rule 4).
11. **Credential locality.** **Credentials are owned only by execution surfaces; AGE stores
    references, never secrets** (§6.1). Capabilities are pure and never see a credential.
12. **Public contract only.** A peer product may expose capabilities internally, but AGE depends only
    on its published contract — never on an internal service (§2.1.1 rule 2).

**Canonical principle:** integrations are **contextual perception and action channels** — sensing to
enrich understanding, execution to extend reach — always interpreted through Client and Project
context, never as independent system modules.
