# Client Lifecycle

> Part of the **AGE Product Bible**. See the [Product Bible README](./README.md).

## Purpose

This document defines **what business states a Client can be in**, **what each state represents**,
and **how those states relate conceptually**. It describes the evolution of a client relationship
from a **business perspective** only.

It does **not** define how transitions are implemented, nor onboarding checklists, approval gates,
automations, notifications, user actions, AI behavior, permissions, or operational processes — those
belong to other documents or require explicit design decisions.

> **Status:** In Progress — derived from the frozen architecture and the canonical Workspace Model
> (Doc 02). Genuine business decisions not derivable from existing material are surfaced in
> [§6 Open Decisions](#6-open-decisions) rather than invented.

## Scope

- **In scope:** the canonical business states of a Client, what each represents, and their
  conceptual relationships.
- **Out of scope:** transition mechanics/implementation, checklists, gates, automations,
  notifications, user actions, AI behavior, permissions, reporting, and operational processes.

## Status

In Progress.

## Related Documents

- [Workspace Model](./02_WORKSPACE_MODEL.md) — **Final / authoritative**; the Client concept and its
  high-level lifecycle originate there (§5, §17). This document elaborates them.
- [User Journeys](./01_USER_JOURNEYS.md) — Client Team personas.
- [Reporting Model](./10_REPORTING_MODEL.md) — client health views (separate concern).

## Table of Contents

- [1. Purpose](#1-purpose)
- [2. Relationship to the Workspace Model](#2-relationship-to-the-workspace-model)
- [3. Canonical Client States](#3-canonical-client-states)
- [4. State Relationships](#4-state-relationships)
- [5. Agency-as-a-Client](#5-agency-as-a-client)
- [6. Open Decisions](#6-open-decisions)

---

## 1. Purpose

A **Client** (Doc 02, §5) is a first-class business concept: a business the agency grows, and the
primary container where the platform's intelligence accumulates. Over time a client relationship
evolves through a sequence of **business states**. This document names those states and explains
what each means — not how the platform moves between them.

## 2. Relationship to the Workspace Model

Document 02 is authoritative. It establishes (Doc 02 §17) the canonical **high-level Client
lifecycle** and explicitly defers the detail to this document:

```
Created → Onboarding → Active → Paused → Offboarding → Archived
```

This document elaborates **what each state represents** and **how they relate conceptually**. It
does not add or rename states beyond what Doc 02 establishes; any candidate additional stage is
raised in [§6 Open Decisions](#6-open-decisions), not defined here.

## 3. Canonical Client States

The six canonical Client states, derived from Doc 02 §17. Each entry describes **what the state
represents** in business terms.

| State           | What it represents                                                                                                                                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Created**     | The Client exists in AGE as a business container, but engagement has not begun. The relationship is established; the client's intelligence (BIF, BKG, Research, Strategy, Assets) is not yet meaningfully populated. |
| **Onboarding**  | The relationship is being set up. The period in which the client's business context begins to be captured and its intelligence containers start to be populated.                                                     |
| **Active**      | The client relationship is ongoing. Work executes within Projects and long-term knowledge accumulates at the Client (Doc 02 §7). This is the steady state of an engaged client.                                      |
| **Paused**      | Engagement is temporarily suspended. The client's data and intelligence are retained intact; no active execution is taking place.                                                                                    |
| **Offboarding** | The relationship is winding down. The engagement is ending while the client's accumulated intelligence is preserved for handover and traceability.                                                                   |
| **Archived**    | The relationship has ended. The client's data is retained (no hard delete) for audit and historical reference, and is treated as read-only/historical.                                                               |

These states describe the **client relationship**, independent of any single Project (Doc 02 §7:
Projects execute work; Clients accumulate knowledge).

## 4. State Relationships

The canonical conceptual flow (Doc 02 §17) is broadly linear, with one reversible relationship that
follows directly from the state meanings above:

```
Created ──▶ Onboarding ──▶ Active ──▶ Offboarding ──▶ Archived
                              ▲  │
                              │  ▼
                            Paused        (Active ⇄ Paused — temporary suspension)
```

- **Forward progression:** Created → Onboarding → Active is the normal path into engagement.
- **Active ⇄ Paused:** suspension is, by definition (a _temporary_ state), reversible back to Active.
- **Wind-down:** Active (or Paused) → Offboarding → Archived ends the relationship while preserving
  data.

Any transition **beyond** these directly-implied relationships (for example, re-engaging an Archived
client, or moving Paused straight to Archived) is a **business decision not yet made** and is raised
in [§6 Open Decisions](#6-open-decisions). This document deliberately does not define transition
triggers, conditions, gates, or mechanics — those are out of scope.

## 5. Agency-as-a-Client

Per Doc 02 §5, the agency may create **itself as a Client**. Conceptually, the agency-as-a-client is
a Client and therefore inhabits the same canonical states. Whether some states are trivially skipped
for the agency's own client (e.g., Onboarding or Offboarding) is a business decision — see
[§6 Open Decisions](#6-open-decisions).

## 6. Open Decisions

> Genuine business decisions that are **not** derivable from the frozen architecture or Doc 02. They
> are surfaced here rather than assumed. The example stages mentioned during review (Prospect,
> Discovery, Growth, Dormant) are **candidates**, not decisions.

1. **Pre-client "Prospect" stage.** Is a not-yet-signed prospect represented as a Client state, or
   does it live outside the Client lifecycle (e.g., in the Revenue/CRM domain) until it becomes a
   Client? Doc 02 treats a Client as an engaged business, which suggests Prospect is _pre-Client_ —
   but this needs an explicit decision.
2. **"Discovery" as a state vs an activity.** Is Discovery a distinct lifecycle state, or an activity
   that occurs _within_ Onboarding (or early Active)? Not present in the canonical set.
3. **"Growth" as a state vs a mode of Active.** Is Growth a separate state, or a characterization of
   an Active client that is expanding? Not present in the canonical set.
4. **"Dormant" vs "Paused".** Is "Dormant" the same concept as the canonical "Paused", or a distinct
   state (e.g., inactive-but-not-formally-suspended)? Naming and semantics need a decision.
5. **Re-engagement / reactivation paths.** Can an **Archived** client be re-engaged (Archived →
   Active/Onboarding), and can **Paused** move directly to **Offboarding/Archived**? These transitions
   are not implied by the canonical flow.
6. **Agency-as-a-Client variations.** Does the agency's own client traverse the identical lifecycle,
   or skip states such as Onboarding/Offboarding?
7. **Sub-phases within states.** Whether states such as Onboarding have named, canonical sub-phases
   (depends on decisions 2–3) or remain single states.
