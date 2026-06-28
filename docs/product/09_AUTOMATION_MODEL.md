# Automation Model

> Part of the **AGE Product Bible**. See the [Product Bible README](./README.md).

## Purpose

This document defines, at the **business level**, how AGE automates work — the anatomy of an
automation (**trigger → condition → action**, plus **schedules**), the **escalation workflows**
(deferred here from Doc 08), and the governance that keeps automation within the platform's
guardrails. Derived from the personas (Doc 01), the Workspace Model (Doc 02), the AI Agent
Architecture (Doc 04), the Permission Model (Doc 06), and the frozen `Workflow` concept.

It defines the automation **model**, not its implementation. It does not define an automation engine,
a rule/condition language, specific automations, or schedule cadences — those are implementation.

> **Status:** In Progress — derived from Final Docs 01–08. Genuine decisions not derivable from
> existing material are surfaced in [§7 Open Decisions](#7-open-decisions).

## Scope

- **In scope:** automation anatomy, automation opportunities (by reference), escalation workflows,
  the execution/approval boundary for automation, scope, and audit.
- **Out of scope:** automation engine, rule/condition language, specific automation definitions,
  schedule cadences, retry/queueing, and UX.

## Status

In Progress.

## Related Documents

- [User Journeys](./01_USER_JOURNEYS.md) — per-persona _Automation Opportunities_.
- [AI Agent Architecture](./04_AI_AGENT_ARCHITECTURE.md) · [Permission Model](./06_PERMISSION_MODEL.md) · [Notification Model](./08_NOTIFICATION_MODEL.md) — **Final**.
- [Execution Model](./12_EXECUTION_MODEL.md) — where side effects happen.

## Table of Contents

- [1. Principles](#1-principles)
- [2. Automation Anatomy](#2-automation-anatomy)
- [3. Automation Opportunities](#3-automation-opportunities)
- [4. Escalation Workflows](#4-escalation-workflows)
- [5. Execution Boundary & Approval](#5-execution-boundary--approval)
- [6. Scope & Audit](#6-scope--audit)
- [7. Open Decisions](#7-open-decisions)

---

## 1. Principles

1. **Automation serves business outcomes.** Automations exist to reduce toil and surface/act on
   business signals — not to automate for its own sake.
2. **Automation never bypasses the guardrails.** It respects the execution boundary (only the
   Execution Layer side-effects), human approval for impactful actions, scope isolation, and audit
   (Doc 04, Doc 06).
3. **AI agents within automations remain pure producers.** Automations may orchestrate agents, but
   agents only produce proposals/artifacts; they never act or approve (Doc 04).
4. An automation is, conceptually, a **Workflow** (the frozen `Workflow` concept; BKG relationships
   `Decision CREATES Workflow`, `Workflow EXECUTES Project`, `Technology ENABLES Workflow`).

## 2. Automation Anatomy

Every automation is composed of four business elements:

| Element       | Meaning                                                                                                                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Trigger**   | The business event that starts the automation — a persona-relevant event, an AI agent alert, an approval outcome, or a **Schedule**. (Same business-event sources as notifications, Doc 08 §3.) |
| **Condition** | A business rule that determines whether the action proceeds. (The rule _language_ is implementation.)                                                                                           |
| **Action**    | What the automation does — either **produce** (a proposal, artifact, or notification) or **execute** (a side effect, only via the Execution Layer and subject to approval — §5).                |
| **Schedule**  | A time-based trigger. The Product Bible establishes that schedules exist; **cadences are not defined** (implementation).                                                                        |

## 3. Automation Opportunities

The canonical automation opportunities are those each persona declares in Doc 01 (_Automation
Opportunities_) — e.g., Executive/Growth briefs, risk detection, opportunity detection, budget and
client-risk monitoring, competitive monitoring, forecasting, and reporting. These describe **what
should be automated**; this document defines the **model** they fit into and does not enumerate them.

## 4. Escalation Workflows

Doc 08 establishes that an **Escalation** notification exists; **this document owns how and why
escalation occurs.** As an automation:

- **Trigger** — a notification (typically Critical) is **not acknowledged or acted upon** within an
  expected window.
- **Condition** — the item remains unaddressed and still warrants attention.
- **Action** — raise an **Escalation** notification and route it **up the responsibility chain**
  (Doc 06), scoped and audited.

Concrete acknowledgement windows, escalation paths, and conditions are open (§7).

## 5. Execution Boundary & Approval

- **Producing vs executing.** Automations that **produce** (proposals, artifacts, notifications,
  reports) are pure and may run freely within scope. Automations that **execute** external side
  effects (publish, deploy, send, push) do so **only via the Execution Layer**.
- **Approval gates execution.** Side-effecting automated actions are subject to the appropriate
  **Approve** authority (Doc 06 §6); automation **cannot bypass** approval or audit.
- **Autonomy is a future phase.** Fully autonomous execution (acting without human approval) is the
  platform's later "Autonomous Execution" phase; until then, impactful automated actions remain gated.
  The autonomy policy is an open decision (§7).

## 6. Scope & Audit

- **Scoped.** Every automation runs within a single Organization / Client / Project scope and never
  crosses Client or tenant boundaries (Doc 02 §15).
- **Audited.** Every automation run — its trigger, conditions evaluated, actions taken, approvals,
  and outcomes — is **auditable** (persistence AuditLog). No automation action is untraceable.

## 7. Open Decisions

> Genuine decisions not derivable from the frozen architecture or Final Docs.

1. **Autonomous-execution policy.** Which side-effecting automated actions (if any) may run without
   human approval, and under what confidence/risk thresholds — the boundary toward the future
   Autonomous Execution phase.
2. **Action catalog.** The authoritative set of automated action types (produce vs execute) the
   platform supports.
3. **Condition model.** How business conditions/rules are expressed (a design/implementation choice).
4. **Schedule cadences.** What scheduling options exist (implementation).
5. **Escalation policy.** Acknowledgement windows, escalation paths, and conditions (§4).
6. **Client-configurable automation.** Whether Client members may define/enable automations, and
   within what limits.
