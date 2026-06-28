# Notification Model

> Part of the **AGE Product Bible**. See the [Product Bible README](./README.md).

## Purpose

This document defines, at the **business level**, how AGE notifies people — the **categories** of
notification, **what triggers** them, **how they are routed**, and the **preference and escalation**
principles. Derived from the personas (Doc 01), the Workspace Model (Doc 02), and the Permission
Model (Doc 06).

It defines the notification **model**, not its implementation. It does not define delivery mechanics,
message templates/copy, preference matrices, schedules, or channel integrations — those are
implementation, and delivery itself is an **Execution Layer** concern (§8).

> **Status:** Final — approved by the Product Owner. Conforms to Final Docs 01–07.

## Scope

- **In scope:** notification categories, trigger principles, destinations, routing/scoping,
  preference & quiet-hours **principles**, escalation existence, and audit.
- **Out of scope:** delivery mechanics, templates/copy, preference toggles/matrices, scheduling,
  channel integrations, digest cadence, and escalation workflow (Doc 09).

## Status

Final.

## Related Documents

- [User Journeys](./01_USER_JOURNEYS.md) — per-persona _Notifications_ tiers and examples.
- [Workspace Model](./02_WORKSPACE_MODEL.md) · [Permission Model](./06_PERMISSION_MODEL.md) — **Final**; scope & access.
- [Automation Model](./09_AUTOMATION_MODEL.md) — escalation **workflows** live here.

## Table of Contents

- [1. Principles](#1-principles)
- [2. Notification Categories](#2-notification-categories)
- [3. Triggers](#3-triggers)
- [4. Destinations](#4-destinations)
- [5. Routing & Scope](#5-routing--scope)
- [6. Preferences & Quiet Hours](#6-preferences--quiet-hours)
- [7. Escalation](#7-escalation)
- [8. Delivery, Execution Boundary & Audit](#8-delivery-execution-boundary--audit)
- [9. Resolved Decisions](#9-resolved-decisions)

---

## 1. Principles

1. **Notifications support business attention, not system activity.** A user is notified because
   something requires **awareness, review, approval, or action** — never simply because an internal
   event occurred. This reinforces AGE's proactive philosophy and prevents notification fatigue.
2. **High-signal only.** AGE notifies about what matters — opportunities, risks, and required actions.
   Doc 01 personas consistently specify "only high-value / -critical / -strategic notifications."
3. **Proactive orientation.** A notification directs a user toward work (Doc 07): _what needs
   attention, why it matters, what to do next._
4. **Scoped & permission-aware.** A user is only notified about contexts (Organization / Client /
   Project) and data they have access to (Doc 06).

## 2. Notification Categories

The canonical categories are those defined in every human persona's _Notifications_ section (Doc 01):

| Category          | Meaning                                                               |
| ----------------- | --------------------------------------------------------------------- |
| **Critical**      | Demands immediate attention; a material risk or failure.              |
| **Important**     | Significant and time-sensitive, but not an emergency.                 |
| **Informational** | Awareness; no action necessarily required.                            |
| **Digest**        | Aggregates lower-priority information into periodic summaries.        |
| **Escalation**    | A notification raised because a prior one was not addressed (see §7). |

These five are the canonical set; new categories require explicit review.

## 3. Triggers

Notifications are triggered by **business events**, not system events. Canonical trigger sources:

- **Persona-relevant events** — each Doc 01 persona's _Notifications_ examples (e.g., revenue
  anomaly, critical client risk, SLA breach, ranking drop, budget overspend, security incident,
  approval required).
- **AI Workforce alerts** — each AI agent's _Operational Modes → Alerts_ (Doc 01 AI schema) surface
  as notifications to the relevant human context. Agents **raise** notifications; they never approve
  or act on them (Doc 04).
- **Approval requests** — items awaiting a human's _Approve_ authority (Doc 06 §6).

The authoritative trigger-to-persona mapping lives in Doc 01. This document does not enumerate triggers.

## 4. Destinations

The Product Bible defines notification **destinations** (not integrations or specific products):

| Destination                         | Meaning                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| **In-Platform Notification Center** | The canonical in-product destination, surfaced within the user's current context (Doc 07). |
| **Email**                           | Delivery to the user's email.                                                              |
| **External Collaboration Platform** | The user's team collaboration tool.                                                        |

> **Delivery appropriateness (principle).** Notification delivery should be **appropriate to the
> urgency and business importance** of the event. The Product Bible does **not** prescribe which
> categories use which destinations — implementation decides how this principle is realized.

Specific products and integrations are implementation choices; **sending to any external destination
is an Execution Layer side effect** (§8).

## 5. Routing & Scope

- Notifications route to subjects **by business responsibility, permission scope, and current
  context** (Doc 06): a person is notified only about the Organizations / Clients / Projects they are
  responsible for.
- Notifications are **scoped**; they never leak data across Clients or tenants (Doc 02 §15).
- **Client members follow the same notification principles as Agency members.** There is **no special
  notification model** for Client members — governance is identical (responsibility, scope, context).

## 6. Preferences & Quiet Hours

- **Preferences (principle).** User notification preferences exist as a product capability:
  **users may control notification preferences where doing so does not compromise required business
  communication.** The Product Bible does **not** define toggles, matrices, per-channel settings, or
  scheduling — those are implementation.
- **Quiet Hours** are a **user preference**, not a notification category. **Critical notifications may
  override Quiet Hours when delaying them would create unacceptable business risk.** All other
  quiet-hours behavior belongs to implementation.

## 7. Escalation

This document establishes that an **Escalation** notification **exists** (a notification raised
because a prior one was not addressed). **How and why escalation occurs — the escalation workflow,
timings, and paths — is defined by the Automation Model (Doc 09), not here.** The two responsibilities
are kept separate.

## 8. Delivery, Execution Boundary & Audit

- **Delivery is an Execution Layer concern.** Composing the notification model (categories, triggers,
  routing) is product; **sending** a notification externally is a side effect and occurs only in the
  Execution Layer (frozen execution boundary, Doc 04).
- **Audit.** Notifications — especially approval requests and escalations — are **auditable**
  (persistence AuditLog); the trail records what was raised, to whom, and its outcome.

## 9. Resolved Decisions

The following were resolved by the Product Owner and are now canonical:

1. **Destinations, not integrations.** Canonical destinations are the **In-Platform Notification
   Center**, **Email**, and an **External Collaboration Platform**. Specific products (Slack, Teams,
   etc.) are implementation choices, not canonical channels.
2. **No category→destination mapping.** The principle is that delivery is **appropriate to the urgency
   and business importance** of the event; implementation realizes it.
3. **Preferences as principle.** Users may control preferences where it does not compromise required
   business communication; specific toggles/matrices/schedules are implementation.
4. **Quiet Hours** is a user preference (not a category); Critical may override it when delay creates
   unacceptable business risk.
5. **Digest** aggregates lower-priority information into periodic summaries; **cadence is not defined**
   (implementation).
6. **Escalation existence here; escalation workflow in Doc 09.**
7. **Client members = Agency members** for notification governance; no special model.

**Canonical principle:** notifications exist to support **business attention**, not system activity.
