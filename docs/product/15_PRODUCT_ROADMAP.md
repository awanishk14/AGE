# Product Roadmap

> Part of the **AGE Product Bible**. See the [Product Bible README](./README.md).

## Purpose

This document is the **product-facing roadmap** — the **phases, editions, epics, and milestones** by
which AGE is delivered — aligned to the frozen architecture (System Map, Capability Architecture) and
the established implementation epics. It exists so product and engineering share one view of _what is
delivered when, in what order, and why._

It is a **direction model**, not a schedule. It does **not** set dates, estimates, sprint plans, or
commitments — sequencing within a phase is a planning concern.

> **Status:** In Progress — consolidated from the frozen architecture and milestones. Genuine
> planning decisions are surfaced in [§7 Open Decisions](#7-open-decisions).

## Scope

- **In scope:** product editions, the canonical delivery phases, the implementation epics, completed
  and upcoming milestones, and release principles.
- **Out of scope:** dates, time estimates, sprint/iteration plans, capacity, and detailed feature
  backlogs.

## Status

In Progress.

## Related Documents

- [Product Bible README](./README.md) — the documents this roadmap delivers against.

**Architecture references (do not modify):**

- [AGE_SYSTEM_MAP](../architecture/AGE_SYSTEM_MAP.md) (roadmap §10) · [CAPABILITY_ARCHITECTURE](../architecture/CAPABILITY_ARCHITECTURE.md) (§10) · [ADR-0004](../adrs/0004-modular-monolith-before-microservices.md).

## Table of Contents

- [1. How to Read This Roadmap](#1-how-to-read-this-roadmap)
- [2. Product Editions](#2-product-editions)
- [3. Delivery Phases](#3-delivery-phases)
- [4. Implementation Epics](#4-implementation-epics)
- [5. Milestones](#5-milestones)
- [6. Release Principles](#6-release-principles)
- [7. Open Decisions](#7-open-decisions)

---

## 1. How to Read This Roadmap

- The roadmap is organized by **phase** (the architecture's delivery sequence) and **epic** (the unit
  of implementation). It carries **no dates** — the Product Bible documents _direction_, not timing.
- Phases and editions are **canonical** (frozen architecture); their internal sequencing and timing
  are planning decisions (§7).

## 2. Product Editions

AGE matures along a single product line (ADR-0004; Capability Architecture):

```
Founder Edition → Agency Edition → Commercial SaaS → Enterprise
```

Each edition is the **same platform** at increasing scale and breadth, not a fork — consistent with
the modular-monolith-to-microservice-ready architecture.

## 3. Delivery Phases

The canonical five phases (System Map §10):

| Phase | Name                     | Contents                                                                              | Status                          |
| ----- | ------------------------ | ------------------------------------------------------------------------------------- | ------------------------------- |
| **1** | **Cognitive Core**       | Domain · BKG · BIF · RIE · SIE                                                        | ✅ Complete (`foundation-v0.1`) |
| **2** | **Intelligence**         | Capability Kit · Intelligence Capability · Market Discovery                           | Next                            |
| **3** | **Growth**               | Growth Capability · Authority Capability                                              | —                               |
| **4** | **Agency Operations**    | Operations Capability · Revenue Capability                                            | —                               |
| **5** | **Autonomous Execution** | SEO · Ads · Content · Reporting · Proposal · CRM · Automation · PM · SSH · Publishing | —                               |

> Autonomous Execution (Phase 5) is the **only** phase that introduces side-effecting execution
> engines; it remains out of scope for the current models (Docs 09, 12) until reached.

## 4. Implementation Epics

Work is organized into **epics** (`EPIC-XX / TASK-YYY`), aligned to capabilities and phases:

| Epic        | Title                 | Phase          | Delivers                                    |
| ----------- | --------------------- | -------------- | ------------------------------------------- |
| **EPIC-00** | Product Bible         | — (foundation) | The functional specification (this Bible)   |
| **EPIC-01** | Intelligence Platform | 2              | Capability Kit · Intelligence Capability    |
| **EPIC-02** | Market Discovery      | 2              | Market Discovery Capability                 |
| **EPIC-03** | Growth Platform       | 3              | Growth Capability                           |
| **EPIC-04** | Authority Platform    | 3              | Authority Capability                        |
| **EPIC-05** | Agency Operations     | 4              | Operations Capability                       |
| **EPIC-06** | Revenue Platform      | 4              | Revenue Capability                          |
| _(later)_   | Execution Engines     | 5              | Autonomous Execution (per Execution Domain) |

## 5. Milestones

| Milestone                      | Meaning                                                            | Status      |
| ------------------------------ | ------------------------------------------------------------------ | ----------- |
| **`foundation-v0.1`**          | Cognitive Core complete (Domain · BKG · BIF · RIE · SIE)           | ✅ Tagged   |
| **`architecture-freeze-v1.0`** | Architecture frozen; Capability Architecture + System Map approved | ✅ Tagged   |
| **Product Bible complete**     | All 16 Product Bible documents Final                               | In progress |
| **Phase 2 delivered**          | Intelligence + Market Discovery capabilities                       | —           |
| _(per phase)_                  | Each subsequent phase's capabilities delivered                     | —           |

## 6. Release Principles

- **Capability-by-capability delivery.** Each capability is delivered as a coherent increment that
  adds standalone business value (Capability Architecture).
- **Phase-ordered.** Phases build on one another (Intelligence → Growth → Operations/Revenue →
  Execution); earlier layers are stable before later layers consume them.
- **Branch flow.** Work flows `feature/* → develop → main`; `main` holds stable releases (per the
  established git strategy).
- **Architecture stays frozen.** Releases deliver _within_ the frozen architecture; changes to it
  require an ADR and one of the five sanctioned reasons (Security / Scalability / Performance /
  Extensibility / Correctness).
- **No autonomous side effects before Phase 5** (Docs 09, 12).

## 7. Open Decisions

> Genuine planning decisions — not derivable from the frozen architecture.

1. **Intra-phase sequencing & timing.** The order and timing of epics/tasks within a phase
   (planning, not Product Bible).
2. **Edition feature-gating.** Which capabilities/features belong to which edition (Founder → Agency →
   SaaS → Enterprise), and packaging (coordinate with Doc 14 licensing).
3. **Release cadence & GA criteria.** What constitutes "released"/GA for a capability, and cadence.
4. **Phase 5 trigger.** The criteria for introducing Autonomous Execution (coordinate with Docs 09,
   12 autonomy decisions).
5. **Beyond Phase 5.** Additional capabilities (e.g., Sales, Customer Success, Finance) registerable
   via the Capability Registry — prioritization is a future product decision.
