# Execution Model

> Part of the **AGE Product Bible**. See the [Product Bible README](./README.md).

## Purpose

This document defines the **Execution Layer** — the **only** part of AGE permitted to perform side
effects on the world. Every prior document has referenced this boundary; this document specifies it.
It defines what the Execution Layer is, the **side-effect boundary**, how execution engines are
organized, how execution is **gated by approval**, how it reaches external systems, and how it is
**scoped and audited**. Derived from the frozen architecture (Capability Architecture, System Map,
ADR-0004, ADR-0007) and Final Docs 04, 06, 09, 10, 11.

It defines the execution **model**, not its implementation. It does not define execution engines'
internals, action catalogs, autonomy thresholds, retry/rollback mechanics, or schedules.

> **Status:** In Progress — derived from the frozen architecture and Final Docs. Genuine decisions
> not derivable from existing material are surfaced in [§9 Open Decisions](#9-open-decisions).

## Scope

- **In scope:** the Execution Layer definition, the side-effect boundary, execution-engine
  organization, execution inputs, approval gating, integration use, scope/isolation, and execution
  audit/traceability.
- **Out of scope:** engine internals, the action catalog (Doc 09/11), autonomy thresholds (future),
  retry/rollback/idempotency mechanics, scheduling cadences (Doc 09), and UX.

## Status

In Progress.

## Related Documents

- [AI Agent Architecture](./04_AI_AGENT_ARCHITECTURE.md) · [Permission Model](./06_PERMISSION_MODEL.md) · [Automation Model](./09_AUTOMATION_MODEL.md) · [Integration Catalog](./11_INTEGRATION_CATALOG.md) — all **Final**.

**Architecture references (do not modify):**

- [CAPABILITY_ARCHITECTURE](../architecture/CAPABILITY_ARCHITECTURE.md) (execution boundary) · [AGE_SYSTEM_MAP](../architecture/AGE_SYSTEM_MAP.md) · [ADR-0004](../adrs/0004-modular-monolith-before-microservices.md) · [ADR-0007](../adrs/0007-capability-vs-execution-domain.md).

## Table of Contents

- [1. The Execution Layer](#1-the-execution-layer)
- [2. The Side-Effect Boundary](#2-the-side-effect-boundary)
- [3. Execution Engines](#3-execution-engines)
- [4. Execution Inputs](#4-execution-inputs)
- [5. Approvals & Gates](#5-approvals--gates)
- [6. Execution via Integrations](#6-execution-via-integrations)
- [7. Scope & Isolation](#7-scope--isolation)
- [8. Execution Audit & Traceability](#8-execution-audit--traceability)
- [9. Open Decisions](#9-open-decisions)

---

## 1. The Execution Layer

The **Execution Layer is the single layer of AGE that performs side effects** — changes to external
systems and the world. Everything above it (Domain, Knowledge/BKG, Intelligence/BIF, Research/RIE,
Strategy/SIE, Capabilities, the AI Workforce) is **pure**: it reads, reasons, and **proposes**, but
never acts. This is one of AGE's defining architectural guarantees (Capability Architecture; System
Map).

```
… Capabilities (pure: produce plans) ──▶ Execution Layer (SIDE EFFECTS) ──▶ External world
```

## 2. The Side-Effect Boundary

This is the canonical boundary of the platform and **must never be violated.**

| Pure layers MAY                                                       | Execution Layer MAY                                                              |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| read · validate · analyze · score · reason · prioritize · **propose** | **publish · deploy · update · create · delete · modify · send · execute · push** |

- Anything that changes an external system is a **side effect** and may occur **only** in the
  Execution Layer.
- **AI agents never side-effect** — they are pure producers (Doc 04). **Automations never
  independently side-effect** — they route to the Execution Layer (Doc 09).
- No capability, agent, automation, integration, report, or notification may bypass this boundary.

## 3. Execution Engines

The Execution Layer is organized into **execution engines aligned to Execution Domains** (ADR-0007):
`SEO · AEO · GEO · LocalSEO · GoogleAds · MetaAds · LinkedInAds · CRO · Content · Email · PR · CRM ·
Reporting · Automation · SSH · Publishing`.

- An execution engine **carries out approved plans** within its domain by acting on the relevant
  external systems (via integration execution surfaces, §6).
- Execution engines are the platform's **Phase 5 (Autonomous Execution)** layer in the roadmap;
  capabilities (which produce the plans) sit above them and remain pure.
- The specific set of engines that exist, and their internals, are implementation/roadmap (§9).

## 4. Execution Inputs

Execution **never originates work**; it carries out **approved** decisions produced upstream:

- It consumes **approved capability plans / decision packages** (from the Capability Layer, which
  derive from the SIE `DecisionPackage`).
- Each execution is **traceable upstream** to the decision, and through it to the evidence and truth
  that justified it (§8).

## 5. Approvals & Gates

- **Nothing executes without approval.** A side-effecting action requires the appropriate **Approve**
  authority (Doc 06 §6) before the Execution Layer acts.
- **Human-Approved Execution** (Doc 09): automation may prepare and route work to execution, but the
  side effect itself remains gated by human approval.
- **Autonomous Execution is a future capability** and is **out of scope** for the current model — no
  current execution path may assume autonomy (Doc 09). Autonomy thresholds are an open decision (§9).

## 6. Execution via Integrations

- External actions are performed through **integration execution surfaces** (Doc 11: Execution /
  Hybrid integrations).
- **Only the Execution Layer** may reach an execution-surface integration to act; pure layers may only
  _sense_ from source integrations (Doc 11 §4).

## 7. Scope & Isolation

- Every execution runs within a single **Organization / Client / Project** scope and **never crosses
  Client or tenant boundaries** (Doc 02 §15).
- An execution acts only on the external systems connected to its own context.

## 8. Execution Audit & Traceability

- **Every side effect is audited** — what action was taken, on what external system, by/through whom,
  when, under which approval, and with what outcome (persistence AuditLog).
- **Full-chain traceability.** Each external action is traceable back along the canonical chain:
  `Evidence → BIF (truth) → Decision (SIE) → Capability plan → Execution`. No side effect is
  untraceable or unattributable.

## 9. Open Decisions

> Genuine decisions not derivable from the frozen architecture or Final Docs.

1. **Execution-engine roadmap.** Which execution engines (by domain) are delivered, and in what order
   (Phase 5).
2. **Autonomous-execution thresholds (future).** If/when autonomy is introduced, the
   confidence/risk thresholds and which action classes qualify — explicitly out of current scope.
3. **Reversibility & failure handling.** Product expectations for rollback/compensation, idempotency,
   and partial-failure behavior of side-effecting actions (mechanics are implementation).
4. **Execution timing model.** Synchronous vs. asynchronous execution and how outcomes are reported
   back (largely implementation).
5. **Pre-execution validation.** Whether a "dry-run / preview" of an execution is offered before the
   side effect is committed.
