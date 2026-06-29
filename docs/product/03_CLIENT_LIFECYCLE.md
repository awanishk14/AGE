# Client Lifecycle

> Part of the **AGE Product Bible**. See the [Product Bible README](./README.md).

## Purpose

This document defines **what business states a Client can be in**, **what each state represents**,
and **how those states relate conceptually**. It describes the evolution of a client relationship
from a **business perspective** only.

It does **not** define how transitions are implemented, nor onboarding checklists, approval gates,
automations, notifications, user actions, AI behavior, permissions, or operational processes — those
belong to other documents or require explicit design decisions.

> **Status:** Final — approved by the Product Owner. Conforms to the authoritative Workspace Model
> (Doc 02). No additional lifecycle states may be introduced without explicit architectural review.

## Scope

- **In scope:** the canonical business states of a Client, what each represents, and their
  conceptual relationships.
- **Out of scope:** transition mechanics/implementation, checklists, gates, automations,
  notifications, user actions, AI behavior, permissions, reporting, and operational processes.

## Status

Final.

## Related Documents

- [Workspace Model](./02_WORKSPACE_MODEL.md) — **Final / authoritative**; the Client concept and its
  high-level lifecycle originate there (§5, §17). This document elaborates them.
- [User Journeys](./01_USER_JOURNEYS.md) — Client Team personas.
- [Reporting Model](./10_REPORTING_MODEL.md) — client health views (separate concern).

> The **Revenue Domain** (Prospect → Lead → Opportunity) is a separate concern and precedes the
> Client Lifecycle; see [§3](#3-canonical-client-states) and [§6.1](#6-resolved-decisions).

## Table of Contents

- [1. Purpose](#1-purpose)
- [2. Relationship to the Workspace Model](#2-relationship-to-the-workspace-model)
- [3. Canonical Client States](#3-canonical-client-states)
- [4. State Relationships](#4-state-relationships)
- [5. Agency-as-a-Client](#5-agency-as-a-client)
- [6. Resolved Decisions](#6-resolved-decisions)

---

## 1. Purpose

A **Client** (Doc 02, §5) is a first-class business concept: a business the agency grows, and the
primary container where the platform's intelligence accumulates. Over time a client relationship
evolves through a sequence of **business states**. This document names those states and explains
what each means — not how the platform moves between them.

The Client Lifecycle **begins only after a business becomes a Client.** Everything before that
(Prospect → Lead → Opportunity) belongs to the **Revenue Domain**, not this document.

## 2. Relationship to the Workspace Model

Document 02 is authoritative. It establishes (Doc 02 §17) the canonical **high-level Client
lifecycle** and explicitly defers the detail to this document:

```
Created → Onboarding → Active → Paused → Offboarding → Archived
```

This document elaborates **what each state represents** and **how they relate conceptually**. It
does not add or rename states beyond what Doc 02 establishes. The canonical set is **closed**: no
additional lifecycle states may be introduced without explicit architectural review.

## 3. Canonical Client States

The six canonical Client states. Each entry describes **what the state represents** in business
terms.

| State           | What it represents                                                                                                                                                                                                                                                                                                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Created**     | The Client exists in AGE as a business container, but engagement has not begun. The relationship is established; the client's intelligence (BIF, BKG, Research, Strategy, Assets) is not yet meaningfully populated.                                                                                                                                                                     |
| **Onboarding**  | The relationship is being set up — the period in which the client's business context begins to be captured and its intelligence containers start to be populated. **Discovery** is performed as a business _activity_ during Onboarding (and may recur later, including for new projects); it is an activity, not a state.                                                               |
| **Active**      | The client relationship is ongoing. Work executes within Projects and long-term knowledge accumulates at the Client (Doc 02 §7). This is the steady state of an engaged client. **Growth** — expansion, new projects, additional capabilities, strategic reviews — is a business _outcome_ that occurs while a client is Active; it is a characteristic of Active, not a separate state. |
| **Paused**      | Engagement is temporarily suspended. The relationship still exists, work is temporarily inactive, and the client may become Active again. The client's data and intelligence are retained intact.                                                                                                                                                                                        |
| **Offboarding** | The relationship is winding down. The engagement is ending while the client's accumulated intelligence is preserved for handover and traceability.                                                                                                                                                                                                                                       |
| **Archived**    | The relationship has ended. The client's data is retained (no hard delete) for audit and historical reference, treated as read-only/historical. **Archived is terminal.**                                                                                                                                                                                                                |

These states describe the **client relationship**, independent of any single Project (Doc 02 §7:
Projects execute work; Clients accumulate knowledge).

## 4. State Relationships

The canonical conceptual flow (Doc 02 §17) is linear, with one reversible relationship:

```
Created ──▶ Onboarding ──▶ Active ──▶ Offboarding ──▶ Archived  (terminal)
                              ▲  │
                              │  ▼
                            Paused        (Active ⇄ Paused — temporary suspension)
```

- **Forward progression:** Created → Onboarding → Active is the normal path into engagement.
- **Active ⇄ Paused:** suspension is temporary and reversible back to Active. A Paused client **may
  return to Active** or **may move to Offboarding**.
- **Wind-down:** Active (or Paused) → Offboarding → Archived ends the relationship while preserving
  data.
- **Archived is terminal.** Archived clients are historical records and the lifecycle does **not**
  resume. If the agency begins working with the same company again, that is a **new engagement** (a
  new Client lifecycle), not a reactivation of the archived one. Historical intelligence remains
  accessible according to future retention rules, but the lifecycle itself does not restart.

This document deliberately does not define transition triggers, conditions, gates, or mechanics —
those are out of scope.

## 5. Agency-as-a-Client

Per Doc 02 §5, the agency may create **itself as a Client**. The agency-as-a-Client follows the
**identical** lifecycle — there is **no special-case lifecycle**. A single, uniform lifecycle reduces
future complexity and keeps the platform self-hosting.

## 6. Resolved Decisions

The following were resolved by the Product Owner and are now canonical:

1. **Prospect is not part of the Client Lifecycle.** A Prospect is not yet a Client. Prospect → Lead
   → Opportunity belong to the **Revenue Domain**; the Client Lifecycle begins only once a business
   becomes a Client.
2. **Discovery is not a state.** It is a business activity performed during Onboarding (and may
   recur, including for new projects, at any later time). Documented within Onboarding (§3).
3. **Growth is not a state.** It is a business outcome that occurs while a client is Active
   (expansion, new projects, additional capabilities, strategic reviews) — a characteristic of
   Active (§3).
4. **Dormant is removed.** Only **Paused** exists. "Dormant" introduced semantic overlap with Paused
   and must not appear anywhere in the Product Bible unless a future document demonstrates a genuine
   business distinction.
5. **Re-engagement.** Paused may return to Active or move to Offboarding. **Archived is terminal** —
   re-engaging the same company creates a **new engagement**, not a resumption of the archived
   lifecycle.
6. **Agency-as-a-Client** follows the identical lifecycle; no special case exists.

> The canonical set of states is now **closed**. No additional lifecycle states may be introduced
> without explicit architectural review.
