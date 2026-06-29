# Automation Model

> Part of the **AGE Product Bible**. See the [Product Bible README](./README.md).

## Purpose

This document defines, at the **business level**, how AGE automates work — the anatomy of an
automation (**trigger → condition → action**, plus **schedules**), the **escalation** principle
(deferred here from Doc 08), and the governance that keeps automation within the platform's
guardrails. Derived from the personas (Doc 01), the Workspace Model (Doc 02), the AI Agent
Architecture (Doc 04), the Permission Model (Doc 06), and the frozen `Workflow` concept.

It defines the automation **model**, not its implementation. It does not define an automation engine,
a rule/condition language, an action catalog, or schedule cadences — those are implementation.

> **Status:** Final — approved by the Product Owner. Conforms to Final Docs 01–08.

## Scope

- **In scope:** automation principles and anatomy, automation opportunities (by reference), the
  escalation principle, the human-approved execution boundary, scope, client configuration, and audit.
- **Out of scope:** automation engine, condition syntax/rules, action catalog, schedule cadences,
  escalation timing/paths, retry/queueing, and UX. **Autonomous Execution is out of scope** (§5).

## Status

Final.

## Related Documents

- [User Journeys](./01_USER_JOURNEYS.md) — per-persona _Automation Opportunities_.
- [AI Agent Architecture](./04_AI_AGENT_ARCHITECTURE.md) · [Permission Model](./06_PERMISSION_MODEL.md) · [Notification Model](./08_NOTIFICATION_MODEL.md) — **Final**.
- [Execution Model](./12_EXECUTION_MODEL.md) — where side effects happen.

## Table of Contents

- [1. Principles](#1-principles)
- [2. Automation Anatomy](#2-automation-anatomy)
- [3. Automation Opportunities](#3-automation-opportunities)
- [4. Escalation](#4-escalation)
- [5. Human-Approved Automation & the Execution Boundary](#5-human-approved-automation--the-execution-boundary)
- [6. Scope, Client Configuration & Audit](#6-scope-client-configuration--audit)
- [7. Resolved Decisions](#7-resolved-decisions)

---

## 1. Principles

1. **Automation reduces operational effort — not decision-making responsibility.** AGE automates
   coordination, preparation, routing, and execution-readiness; **humans remain accountable for
   business decisions and approvals.** (Reinforces Docs 04, 06, 08.)
2. **Automation serves business outcomes**, not automation for its own sake.
3. **Automation never bypasses the guardrails** — execution boundary, human approval for impactful
   actions, scope isolation, and audit (Doc 04, Doc 06).
4. **AI agents within automations remain pure producers** — they produce proposals/artifacts; they
   never act or approve (Doc 04).
5. An automation is, conceptually, a **Workflow** (the frozen `Workflow` concept).

## 2. Automation Anatomy

Every automation is composed of four business elements, defined as **principles** (not syntax):

| Element       | Principle                                                                                                                                                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Trigger**   | A business event starts the automation — a persona-relevant event, an AI agent alert, an approval outcome, or a **Schedule**. (Same business-event sources as notifications, Doc 08 §3.)                                                                                                         |
| **Condition** | Automation responds to **business conditions** derived from platform context, business state, and user responsibilities. Condition syntax/authoring is implementation.                                                                                                                           |
| **Action**    | **Automation coordinates business work.** It may prepare, orchestrate, schedule, recommend, and coordinate; it produces proposals/artifacts/notifications, or routes work toward the Execution Layer (§5). The concrete action catalog is implementation and will evolve as capabilities expand. |
| **Schedule**  | Scheduling exists as a business capability. The Product Bible does **not** define intervals, recurrence models, cron-like expressions, or timing — those are implementation.                                                                                                                     |

## 3. Automation Opportunities

The canonical automation opportunities are those each persona declares in Doc 01 (_Automation
Opportunities_) — e.g., Executive/Growth briefs, risk and opportunity detection, monitoring,
forecasting, and reporting. They describe **what should be automated**; this document defines the
**model** they fit into and does not enumerate them.

## 4. Escalation

Doc 08 establishes that an **Escalation** notification exists; this document owns the **principle** of
how escalation occurs:

> **When required business attention is not received within the appropriate business context,
> responsibility may escalate to the next responsible party** (up the responsibility chain, Doc 06).

The Product Bible intentionally does **not** define escalation timing, windows, paths, or notification
frequency — those are implementation concerns.

## 5. Human-Approved Automation & the Execution Boundary

AGE adopts a **Human-Approved Automation** model:

- **Automation may** prepare, orchestrate, schedule, recommend, and coordinate work.
- **Automation does not** independently perform business actions that create external effects.
- **Every external side effect remains subject to the Execution Layer and its approval model**
  (Doc 04, Doc 06). Producing automations (proposals, artifacts, notifications, reports) are pure and
  may run within scope; executing automations route through the Execution Layer and are
  **approval-gated**.
- **Autonomous Execution is out of scope.** Future versions of AGE may introduce Autonomous Execution
  as a distinct product capability, but **no current automation should assume autonomous execution.**

## 6. Scope, Client Configuration & Audit

- **Scoped.** Every automation runs within a single Organization / Client / Project scope and never
  crosses Client or tenant boundaries (Doc 02 §15).
- **Client configuration.** Clients may **configure** automations **within the capabilities made
  available to them**. They do **not** define new automation types or alter platform governance;
  configuration exists within the boundaries the platform establishes.
- **Audited.** Every automation run — trigger, conditions evaluated, actions taken, approvals, and
  outcomes — is **auditable** (persistence AuditLog). No automation action is untraceable.

## 7. Resolved Decisions

The following were resolved by the Product Owner and are now canonical:

1. **Human-Approved Automation.** Automation prepares/orchestrates/schedules/recommends/coordinates;
   it never independently performs external business actions. Every side effect flows through the
   Execution Layer + approval. **Autonomous Execution is explicitly out of scope** (a future,
   distinct capability).
2. **No action catalog.** Principle only — _automation coordinates business work_; the concrete
   executable-action catalog is implementation.
3. **No condition syntax.** Automation responds to business conditions from platform context,
   business state, and user responsibilities; condition authoring is implementation.
4. **Scheduling is a capability**, not a defined cadence — intervals/recurrence/cron/timing are
   implementation.
5. **Escalation follows the business responsibility chain** (principle); timing/windows/paths/frequency
   are implementation.
6. **Client configuration within bounds** — clients configure available automations; they do not add
   types or change governance.

**Canonical principle:** automation exists to reduce **operational effort**, not decision-making
responsibility; humans remain accountable for business decisions and approvals.
