# Execution Model

> Part of the **AGE Product Bible**. See the [Product Bible README](./README.md).

## Purpose

This document defines the **Execution Layer** — the **only boundary between intent and reality** in
AGE, and the sole authority for all side effects. Every prior document references this boundary; this
document locks it. It specifies the Execution Layer's authority, the **pure-vs-execution semantic
contract**, the **origin constraint**, **approval requirement**, **integration access**,
**traceability chain**, and **scope/audit**. Derived from the frozen architecture (Capability
Architecture, System Map, ADR-0004, ADR-0007) and Final Docs 04–11.

It defines the execution **model**, not its implementation. It does not define engine internals,
action catalogs, autonomy thresholds, timing/concurrency, or failure/rollback mechanics.

> **Status:** Final — approved by the Product Owner. This is the governing invariant for all
> remaining documents.

## Scope

- **In scope:** Execution Layer authority, the pure/execution boundary, the origin constraint,
  approval requirement, integration access, domain alignment, the traceability chain, scope, and
  audit/observability.
- **Out of scope:** engine internals, action catalogs (Doc 09/11), enumerated execution domains
  (ADR-0007), autonomy thresholds (future), timing/concurrency, and failure/rollback mechanics.

## Status

Final.

## Related Documents

- [AI Agent Architecture](./04_AI_AGENT_ARCHITECTURE.md) · [Permission Model](./06_PERMISSION_MODEL.md) · [Automation Model](./09_AUTOMATION_MODEL.md) · [Integration Catalog](./11_INTEGRATION_CATALOG.md) — all **Final**.

**Architecture references (do not modify):**

- [CAPABILITY_ARCHITECTURE](../architecture/CAPABILITY_ARCHITECTURE.md) · [AGE_SYSTEM_MAP](../architecture/AGE_SYSTEM_MAP.md) · [ADR-0004](../adrs/0004-modular-monolith-before-microservices.md) · [ADR-0007](../adrs/0007-capability-vs-execution-domain.md).

## Table of Contents

- [1. Execution Layer Authority](#1-execution-layer-authority)
- [2. Pure vs Execution Operations](#2-pure-vs-execution-operations)
- [3. Execution Domains](#3-execution-domains)
- [4. Execution Origin Constraint](#4-execution-origin-constraint)
- [5. Approval Requirement](#5-approval-requirement)
- [6. Integration Access](#6-integration-access)
- [7. Scope & Isolation](#7-scope--isolation)
- [8. Traceability & Observability](#8-traceability--observability)
- [9. Resolved Decisions](#9-resolved-decisions)

---

## 1. Execution Layer Authority

The **Execution Layer is the sole authority for all side effects** in AGE — the **only boundary
between intent and reality.** Everything above it reasons, prepares, or decides; everything within it
acts. This separation is the foundation of the platform's safety, scalability, and governance
integrity.

Side effects under its sole authority include: external system interactions, data mutations,
communication actions, integration calls, and any state change outside the reasoning system. **No
other layer — including AI Agents, Capabilities, or orchestration logic — may directly perform side
effects.** This is **absolute and non-negotiable.**

## 2. Pure vs Execution Operations

This is the platform's **semantic contract boundary.** No operation may cross categories without
entering the Execution Layer.

| Pure Operations (non-side-effect)                                                  | Execution Operations (side-effect)                                           |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| read · analyze · reason · validate · prioritize · score · synthesize · **propose** | create · update · delete · modify · publish · send · deploy · execute · push |

- **AI agents never side-effect** — they are pure producers (Doc 04). **Automations never
  independently side-effect** — they route to the Execution Layer (Doc 09).
- No capability, agent, automation, integration, report, or notification may bypass this boundary.

## 3. Execution Domains

Execution is organized around **business-aligned Execution Domains** (ADR-0007) — **not** technical
systems. The Product Bible does **not** redefine or enumerate these domains; it establishes only that
execution capabilities align to them. Capabilities (pure) produce the plans; the Execution Layer
fulfills them within the relevant domain.

## 4. Execution Origin Constraint

**Execution never originates intent.** The Execution Layer is **not a planner** — it is strictly a
**fulfillment system.** All execution must originate from:

- **approved capability outputs**,
- **validated decision packages**, or
- **human-approved workflows**.

Planning remains within the AI Workforce + Capability layer.

## 5. Approval Requirement

**No execution is autonomous within the current Product Bible scope.** Every execution action requires
either:

- an **explicit approval context**, or
- a **pre-approved workflow state**.

**Autonomous Execution remains explicitly out of scope** and must not be assumed in any downstream
model (consistent with Doc 09).

## 6. Integration Access

**Only the Execution Layer may interact with** external APIs, third-party systems, external
platforms, and data-mutation surfaces. Other layers may **reference integrations conceptually but
cannot invoke them** (enforcing Doc 11). Pure layers may only _sense_ from source integrations
(Doc 11 §4).

### 6.1 Delegated Execution to a Peer Product

A **peer product** (Doc 11 §2.1) may own execution for its own domain — it may hold the credentials
and perform the outward action that AGE never performs itself.

This **does not create an exception to §1.** The boundary is preserved because **the handover is
itself the execution operation**: AGE produces an approved plan (a pure act — `propose`, §2), and
handing that plan to the peer product is a side effect performed **by the Execution Layer, gated by
approval (§5), scoped per §7, and traced per §8.** What happens beyond the handover is the peer
product's own governance, under its own approval model.

Three constraints follow, and none is optional:

1. **AGE does not hold the peer product's credentials** (Doc 11 §6, Doc 13). Delegating execution
   means delegating the credential too.
2. **No layer above the Execution Layer may hand anything over.** A capability or agent that called a
   peer product directly would breach §1 exactly as it would with any integration.
3. **AGE never claims the outcome as its own act.** The record says AGE handed over an approved plan
   and what the peer product reported back — never that AGE performed the external action.

⚠️ Delegation is **not** a reason to loosen approval. A plan AGE would not be allowed to execute is a
plan AGE is not allowed to hand over.

## 7. Scope & Isolation

- Every execution runs within a single **Organization / Client / Project** scope and **never crosses
  Client or tenant boundaries** (Doc 02 §15).
- An execution acts only on the external systems connected to its own context.

## 8. Traceability & Observability

- **Canonical traceability chain.** Every execution remains fully traceable through:

  > **Evidence → Business Intelligence (BIF) → Decision → Capability Output → Execution**

  ensuring every execution has a reasoning origin, every action is explainable, and every outcome can
  be traced back to business context.

- **Observability.** Execution outcomes **must be observable and traceable** (auditable via
  persistence AuditLog).
- The **mechanics** of how traceability/observability are stored or implemented are outside Product
  Bible scope; the **chain itself is canonical.**

## 9. Resolved Decisions

The following were resolved by the Product Owner and are now canonical:

1. **Sole authority.** The Execution Layer is the sole authority for all side effects; no other layer
   (agents, capabilities, orchestration) may side-effect. Absolute and non-negotiable.
2. **Semantic boundary.** Pure: read · analyze · reason · validate · prioritize · score · synthesize ·
   propose. Execution: create · update · delete · modify · publish · send · deploy · execute · push.
   No operation crosses without entering the Execution Layer.
3. **Origin constraint.** Execution never originates intent; it fulfills approved capability outputs,
   validated decision packages, or human-approved workflows. Not a planner.
4. **Approval required.** No autonomous execution in current scope; every action needs an explicit
   approval context or a pre-approved workflow state. Autonomous Execution is out of scope.
5. **Integration access.** Only the Execution Layer invokes external systems/APIs/mutation surfaces;
   other layers reference them conceptually only.
6. **Traceability chain (canonical).** Evidence → BIF → Decision → Capability Output → Execution;
   mechanics are implementation, the chain is canonical.
7. **Domain alignment.** Execution aligns to business-aligned Execution Domains (ADR-0007); the
   Product Bible does not redefine or enumerate them.
8. **Timing.** Sync/async, concurrency, and scheduling are implementation; the only principle is that
   **execution may be triggered by approved business workflows at any time required by business
   context.**
9. **Failure & reversibility.** Recovery, rollback, compensation, and retry are implementation; the
   Product Bible requires only that **execution outcomes are observable and traceable.**

**Canonical principle:** the Execution Layer is the **only boundary between intent and reality** —
everything above reasons, prepares, or decides; everything within acts. This is the governing
invariant for all remaining documents.
