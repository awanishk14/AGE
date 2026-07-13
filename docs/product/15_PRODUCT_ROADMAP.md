# Product Roadmap

> Part of the **AGE Product Bible**. See the [Product Bible README](./README.md).

## Purpose

This document is the **product-facing roadmap** — a **directional, value-evolution model** describing
how AGE expands its business impact over time while maintaining a stable underlying architecture.
Aligned to the frozen architecture (System Map, Capability Architecture) and the established
capability epics.

It is **not a planning system and not a system-design model.** It defines the _intended evolution_,
_sequence of capability maturation_, and _conceptual phases of growth_ — **not** timelines, release
dates, sprint plans, delivery schedules, or execution sequencing (those belong to product execution
planning, outside the Product Bible).

> **Status:** Final — approved by the Product Owner. A directional model consolidating the frozen
> architecture's phases, editions, epics, and milestones.

## Scope

- **In scope:** product editions, the canonical delivery phases, the capability EPIC framework,
  completed/upcoming milestones, and release principles.
- **Out of scope:** dates, release dates, time estimates, sprint/iteration plans, delivery schedules,
  capacity, and execution sequencing — all **execution planning**, not the Product Bible.

## Status

Final.

## Related Documents

- [Product Bible README](./README.md) — the documents this roadmap delivers against.

**Architecture references (do not modify):**

- [AGE_SYSTEM_MAP](../architecture/AGE_SYSTEM_MAP.md) (§10) · [CAPABILITY_ARCHITECTURE](../architecture/CAPABILITY_ARCHITECTURE.md) (§10) · [ADR-0004](../adrs/0004-modular-monolith-before-microservices.md).

## Table of Contents

- [1. How to Read This Roadmap](#1-how-to-read-this-roadmap)
- [2. Product Editions](#2-product-editions)
- [3. Delivery Phases](#3-delivery-phases)
- [4. Capability EPICs](#4-capability-epics)
- [5. Milestones](#5-milestones)
- [6. Release Principles](#6-release-principles)
- [7. The Phase 5 Boundary](#7-the-phase-5-boundary)
- [8. Resolved Decisions & Out of Scope](#8-resolved-decisions--out-of-scope)

---

## 1. How to Read This Roadmap

The roadmap is a **value evolution model**: **architecture is frozen, capabilities evolve, and value
scales upward through controlled layering.** It communicates _what_ matures and _in what conceptual
order_, never _when_. Phases and editions are canonical (frozen architecture); timing and execution
sequencing are execution-planning concerns (§8).

## 2. Product Editions

AGE matures along a single product line (ADR-0004; Capability Architecture):

```
Founder Edition → Agency Edition → Commercial SaaS Edition → Enterprise Edition
```

These are **scaling tiers of the same platform, not separate products.** All editions **share the
same underlying architecture** and differ only in **scale, governance, and capability enablement**.
**No edition introduces a different system model.**

## 3. Delivery Phases

The canonical five phases (System Map §10):

| Phase | Name                           | Contents                                                    | Status                          |
| ----- | ------------------------------ | ----------------------------------------------------------- | ------------------------------- |
| **1** | **Cognitive Core**             | Domain · BKG · BIF · RIE · SIE                              | ✅ Complete (`foundation-v0.1`) |
| **2** | **Intelligence Layer**         | Capability Kit · Intelligence Capability · Market Discovery | Next                            |
| **3** | **Growth Layer**               | Growth Capability · Authority Capability                    | —                               |
| **4** | **Agency Operations Layer**    | Operations Capability · Revenue Capability                  | —                               |
| **5** | **Autonomous Execution Layer** | Side-effecting execution engines (per Execution Domain)     | Future                          |

Phase 5 is a **future capability boundary** and is **explicitly out of scope for current system
behavior** (§7).

## 4. Capability EPICs

EPICs are a **capability organization framework — not an implementation roadmap.** They define
conceptual **domains of capability**, the logical grouping of business value, and platform-level
functional areas. **EPICs do not define delivery order or technical sequencing** (that is execution
planning).

| EPIC        | Capability domain                                     | Phase association |
| ----------- | ----------------------------------------------------- | ----------------- |
| **EPIC-00** | Product Bible (functional specification)              | Foundation        |
| **EPIC-01** | Intelligence Platform (Capability Kit · Intelligence) | 2                 |
| **EPIC-02** | Market Discovery                                      | 2                 |
| **EPIC-03** | Growth Platform                                       | 3                 |
| **EPIC-04** | Authority Platform                                    | 3                 |
| **EPIC-05** | Agency Operations                                     | 4                 |
| **EPIC-06** | Revenue Platform                                      | 4                 |
| _(later)_   | Execution Engines                                     | 5                 |

(Phase association indicates conceptual grouping, not a delivery schedule.)

## 5. Milestones

Status markers (not dates):

| Milestone                      | Meaning                                                            | Status      |
| ------------------------------ | ------------------------------------------------------------------ | ----------- |
| **`foundation-v0.1`**          | Cognitive Core complete                                            | ✅ Tagged   |
| **`architecture-freeze-v1.0`** | Architecture frozen; Capability Architecture + System Map approved | ✅ Tagged   |
| **Product Bible complete**     | All 16 Product Bible documents Final                               | In progress |
| _(per phase)_                  | Each phase's capabilities matured                                  | —           |

## 6. Release Principles

Canonical:

- **Capability-by-capability progression** — each capability matures as a coherent increment of
  business value.
- **Architecture remains frozen** — no structural drift during expansion.
- **Branch flow** (per ADR-0020) — for the current pre-Phase-5 stage the canonical flow is
  `feature/<epic-or-task> → main`; `main` is the **stable integration branch**. Every merge to `main`
  requires: a feature branch, task-scoped commits, a reviewed PR into `main`, green PR CI, ChatGPT
  review, founder approval, explicit merge approval, green post-merge `main` CI, and feature-branch
  cleanup. **Phase 5 reconsideration trigger:** revisit `develop`, release branches, environment
  branches, or staged-promotion branches before Phase 5 Autonomous Execution, multi-team parallel
  release trains, or an external production release cadence begins. See ADR-0020.
- **ADR governs architectural change** only when explicitly required (Security / Scalability /
  Performance / Extensibility / Correctness).
- **No autonomous side effects prior to Phase 5** (Docs 09, 12).

## 7. The Phase 5 Boundary

**Autonomous Execution is a future-state capability boundary only.** It **must not influence**:

- current automation design (Doc 09),
- current execution rules (Doc 12),
- the current permission model (Doc 06), or
- the current security model (Doc 13).

**All current system behavior remains strictly within Human-Approved Execution** (Docs 09 + 12).
Phase 5 is a boundary to plan _toward_, never an active design assumption.

## 8. Resolved Decisions & Out of Scope

**Resolved (canonical):**

1. **Directional model.** The roadmap is a value-evolution model — intended evolution, capability
   maturation sequence, conceptual phases — not a planning system.
2. **Editions** are scaling tiers of one platform (same architecture; differ only in scale,
   governance, capability enablement).
3. **Five-phase model** is canonical; Phase 5 is a future boundary (§7).
4. **EPICs** are a capability organization framework, not a delivery/technical roadmap.
5. **Release principles** (§6) are canonical.
6. **Phase 5 boundary** (§7) — does not influence any current model; Human-Approved Execution only.

**Out of scope (execution planning — not Product Bible):** timelines, release dates, sprint/iteration
plans, delivery schedules, release cadence/GA criteria, and intra-phase sequencing.

**Deferred (future product decisions):** edition feature-gating/packaging (with Doc 14 licensing) and
capabilities beyond Phase 5 (e.g., Sales, Customer Success, Finance) registerable via the Capability
Registry.

**Canonical principle:** the roadmap is a **value evolution model, not a system design model** —
architecture is frozen, capabilities evolve, and value scales upward through controlled layering.
