# Notification Model

> Part of the **AGE Product Bible**. See the [Product Bible README](./README.md).

## Purpose

This document defines, at the **business level**, how AGE notifies people — the **categories** of
notification, **what triggers** them, **how they are routed**, and the **preference and escalation**
principles. Derived from the personas (Doc 01), the Workspace Model (Doc 02), and the Permission
Model (Doc 06).

It defines the notification **model**, not its implementation. It does not define delivery mechanics,
templates, copy, message formatting, or channel integrations — those are implementation, and delivery
itself is an **Execution Layer** concern (§8).

> **Status:** In Progress — derived from Final Docs 01–07. Genuine decisions not derivable from
> existing material are surfaced in [§9 Open Decisions](#9-open-decisions).

## Scope

- **In scope:** notification categories, trigger principles, routing/scoping, channel concepts,
  preference & quiet-hours principles, escalation, and audit.
- **Out of scope:** delivery mechanics, message templates/copy/formatting, channel integration
  details, retry/queueing, and UX (surfacing visuals are Doc 07 / future UX work).

## Status

In Progress.

## Related Documents

- [User Journeys](./01_USER_JOURNEYS.md) — per-persona _Notifications_ tiers and examples.
- [Workspace Model](./02_WORKSPACE_MODEL.md) · [Permission Model](./06_PERMISSION_MODEL.md) — **Final**; scope & access.
- [Automation Model](./09_AUTOMATION_MODEL.md) · [UI & Navigation](./07_UI_NAVIGATION.md) — **Final**.

## Table of Contents

- [1. Principles](#1-principles)
- [2. Notification Categories](#2-notification-categories)
- [3. Triggers](#3-triggers)
- [4. Channels](#4-channels)
- [5. Routing & Scope](#5-routing--scope)
- [6. Preferences & Quiet Hours](#6-preferences--quiet-hours)
- [7. Escalation](#7-escalation)
- [8. Delivery, Execution Boundary & Audit](#8-delivery-execution-boundary--audit)
- [9. Open Decisions](#9-open-decisions)

---

## 1. Principles

1. **High-signal only.** AGE notifies people about what matters — opportunities, risks, and required
   actions — not noise. Doc 01 personas consistently specify "only high-value / -critical / -strategic
   notifications."
2. **Proactive orientation.** A notification exists to direct a user toward work, echoing the
   navigation principle (Doc 07): it should convey _what needs attention, why it matters, and what to
   do next._
3. **Scoped & permission-aware.** A user is only notified about contexts (Organization / Client /
   Project) and data they have access to (Doc 06).

## 2. Notification Categories

The canonical categories are those defined in every human persona's _Notifications_ section (Doc 01):

| Category          | Meaning                                                               |
| ----------------- | --------------------------------------------------------------------- |
| **Critical**      | Demands immediate attention; a material risk or failure.              |
| **Important**     | Significant and time-sensitive, but not an emergency.                 |
| **Informational** | Awareness; no action necessarily required.                            |
| **Digest**        | Periodic roll-up of lower-priority items.                             |
| **Escalation**    | A notification raised because a prior one was not addressed (see §7). |

These five are the canonical set; new categories require explicit review.

## 3. Triggers

Notifications are triggered by **business events**, not system events. The canonical trigger sources:

- **Persona-relevant events** — each Doc 01 persona's _Notifications_ examples (e.g., revenue
  anomaly, critical client risk, SLA breach, ranking drop, budget overspend, security incident,
  approval required).
- **AI Workforce alerts** — each AI agent's _Operational Modes → Alerts_ (Doc 01 AI schema) surface
  as notifications to the relevant human context. Agents **raise** notifications; they never approve
  or act on them (Doc 04).
- **Approval requests** — items awaiting a human's _Approve_ authority (Doc 06 §6).

The authoritative trigger-to-persona mapping lives in Doc 01 (per-persona examples). This document
does not enumerate every trigger.

## 4. Channels

- **In-app** is the canonical primary channel (notifications surface within the user's current
  context — Doc 07).
- **External channels** referenced by Doc 01 personas/integrations include **Email** and
  **Slack / Teams**.

The concrete channel set, per-channel behavior, and integration details are implementation; **sending
to an external channel is an Execution Layer side effect** (§8).

## 5. Routing & Scope

- Notifications route to subjects **by responsibility and access** (Doc 06): a person is notified only
  about the Organizations / Clients / Projects they are responsible for.
- Notifications are **scoped** to a context; they never leak data across Clients or tenants
  (Doc 02 §15 isolation).
- The same event may notify different subjects differently according to their persona and scope.

## 6. Preferences & Quiet Hours

- **User-controlled.** Users can tune which categories and channels they receive, consistent with
  each persona's intent (e.g., executives receive "only high-value" notifications — Doc 01).
- **Quiet hours.** Users may define periods during which non-Critical notifications are suppressed or
  deferred to a Digest.
- **Critical overrides.** Critical notifications are not suppressed by preferences/quiet hours.

The exact preference granularity and quiet-hours behavior are open (§9).

## 7. Escalation

- An **Escalation** is raised when a notification (typically Critical) is **not acknowledged or
  acted upon** within an expected window.
- Escalation follows **responsibility** (Doc 06) — e.g., toward the persona's reporting line — and is
  itself scoped and audited.
- The concrete escalation timings, paths, and conditions are open (§9) and coordinate with the
  Automation Model (Doc 09).

## 8. Delivery, Execution Boundary & Audit

- **Delivery is an Execution Layer concern.** Composing the notification model (categories, triggers,
  routing) is product; **sending** a notification externally (email/Slack/push) is a side effect and
  occurs only in the Execution Layer (Doc 04 / frozen execution boundary).
- **Audit.** Notifications — especially approval requests and escalations — are **auditable**
  (persistence AuditLog); the audit trail records what was raised, to whom, and its outcome.

## 9. Open Decisions

> Genuine decisions not derivable from the frozen architecture or Final Docs.

1. **Authoritative channel set & per-channel rules.** Which channels are supported (in-app, email,
   Slack/Teams, push, SMS?), and how each category maps to channels.
2. **Preference granularity.** Per-category, per-channel, per-context controls and their defaults.
3. **Quiet-hours behavior.** Suppress vs. defer-to-Digest; Critical override specifics.
4. **Digest cadence & composition.** Frequency, grouping, and what qualifies for Digest vs. immediate.
5. **Escalation policy.** Acknowledgement windows, escalation paths, and conditions (coordinate with
   Doc 09 Automation).
6. **Client-member notifications.** Whether and how external Client members are notified (which
   categories/triggers apply to them).
