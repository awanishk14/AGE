# UI & Navigation

> Part of the **AGE Product Bible**. See the [Product Bible README](./README.md).

## Purpose

This document defines the **information architecture and navigation model** of AGE at the product
level — how users orient themselves, what business context they operate in, and how they move between
contexts. Derived from the Workspace Model (Doc 02) and the personas (Doc 01).

It is **not** interface design. Visual design, layouts, wireframes, components, interaction patterns,
responsive behavior, and styling are **future UX/UI design work**, outside the Product Bible (see
[§8](#8-out-of-scope--future-uxui-design-work)).

> **Status:** Final — approved by the Product Owner. Conforms to Final Docs 01–06.

## Scope

- **In scope (defines):** Information Architecture · Navigation Model · Workspace Context · Business
  Navigation Principles · Context Switching · User Orientation.
- **Out of scope (does not define):** screen layouts · wireframes · visual hierarchy · component
  library · design system · interaction patterns · responsive behavior · styling. These are future
  UX/UI design work, not unresolved product questions.

## Status

Final.

## Related Documents

- [User Journeys](./01_USER_JOURNEYS.md) — personas, their dashboards, and journeys.
- [Workspace Model](./02_WORKSPACE_MODEL.md) — **Final**; Workspace is a navigation/context lens (§6).
- [Client Lifecycle](./03_CLIENT_LIFECYCLE.md) · [Notification Model](./08_NOTIFICATION_MODEL.md) · [Reporting Model](./10_REPORTING_MODEL.md).
- [Permission Model](./06_PERMISSION_MODEL.md) — **Final**; scopes determine what is navigable.

## Table of Contents

- [1. Navigation Principles](#1-navigation-principles)
- [2. Navigation Structure (Business Context)](#2-navigation-structure-business-context)
- [3. Information Architecture](#3-information-architecture)
- [4. Context Persistence](#4-context-persistence)
- [5. Dashboards as Entry Points](#5-dashboards-as-entry-points)
- [6. Navigation, Access & AI Visibility](#6-navigation-access--ai-visibility)
- [7. UI States (Conceptual)](#7-ui-states-conceptual)
- [8. Out of Scope — Future UX/UI Design Work](#8-out-of-scope--future-uxui-design-work)

---

## 1. Navigation Principles

1. **Navigation exposes business relationships, not system architecture.** Users should naturally
   understand _where they are_, _what business context they are in_, _what work is available_, and
   _how that work relates to the surrounding business hierarchy_. Internal architectural boundaries
   (BIF, BKG, RIE, SIE, repositories, orchestration, …) **never** define the navigation model.
2. **Business context, not feature modules.** Users work within business contexts rather than
   navigating disconnected feature modules.
3. **Proactive, not search-first** (Doc 01). AGE surfaces opportunities, risks, recommendations,
   evidence, and next actions; users should not have to hunt for information.
4. **Permission-aware visibility.** Users only **discover** the contexts, Clients, Projects, and
   business areas they have access to (derived from Doc 06, stated here as a navigation principle).
5. **AI is embedded, not a destination** (see §6).

## 2. Navigation Structure (Business Context)

Navigation follows **business context** (Doc 02 §6: a Workspace is a navigation/context lens). The
primary navigation hierarchy is:

```
Organization → Client → Project
```

| Context          | What the user is operating within                                                             |
| ---------------- | --------------------------------------------------------------------------------------------- |
| **Organization** | The agency: its Clients, Shared Agency Resources, portfolio-level orientation.                |
| **Client**       | One Client's Business: its intelligence, research, strategy, knowledge, assets, and projects. |
| **Project**      | One Project's execution within a Client.                                                      |

**Capabilities become available within the current context** — a user does not navigate to
"capabilities"; capabilities surface as the work available where the user is.

## 3. Information Architecture

Within each context, information is organized by **business meaning** (Doc 05 vocabulary), not by
internal systems:

- **Organization** → Clients · Shared Agency Resources · portfolio orientation.
- **Client** → the Business's **intelligence**, **research**, **strategy**, **knowledge**, **assets**,
  **projects**, and current **lifecycle state** (Doc 03).
- **Project** → the Project's work and execution.

The underlying engines (BIF/BKG/RIE/SIE) power these business areas but are **never** surfaced as the
navigation structure. The visual organization (grouping, labels, depth) is future UX/UI work (§8).

## 4. Context Persistence

**Context is persistent.** Once a user enters a Workspace context, navigation **preserves that
context** until the user intentionally changes it. A user working within a Client continues operating
within that Client until they explicitly switch to another context. This is a business principle, not
an implementation requirement.

## 5. Dashboards as Entry Points

**Dashboards are entry points, not destinations.** A dashboard exists to **orient users toward
work**, not to be the place where work is performed. Every dashboard answers three questions
(Doc 01):

- **What requires attention?**
- **Why does it matter?**
- **What should happen next?**

The personas in Doc 01 define the canonical, named dashboards (their _Dashboards_ sections — e.g.,
Executive / Growth / Operations Command Centers and the per-strategist command centers). Their
**contents** are owned by Doc 01; their **visual design** is future UX/UI work (§8).

## 6. Navigation, Access & AI Visibility

- **Permission-aware.** A user navigates only the Organizations / Clients / Projects their
  responsibilities grant (Doc 06); out-of-scope contexts are not discoverable.
- **AI is not a top-level navigation area.** Users interact with the AI Workforce through **business
  workflows, capabilities, and work contexts** — never by navigating to an "AI" section. AI is a
  platform capability **embedded throughout** the experience, keeping the mental model centered on
  business outcomes rather than technology. (AI agents are not navigators/subjects — Doc 06 §7.)

## 7. UI States (Conceptual)

States a primary view can represent — described conceptually, not visually:

- **Empty / early** — a Client in `Created`/`Onboarding` (Doc 03), intelligence not yet populated.
- **Populated** — an `Active` Client with intelligence, evidence, and recommendations to surface.
- **Restricted** — content the user has no access to is not shown (Doc 06).
- **Historical / read-only** — an `Archived` Client (Doc 03), shown as a historical record.

The visual representation of these states is future UX/UI work (§8).

## 8. Out of Scope — Future UX/UI Design Work

The following are **outside the scope of the Product Bible** and belong to future UX/UI design
documentation. They are **not** unresolved product questions, and **no decisions are required at this
stage**:

- Visual design language / design system
- Navigation components (sidebar, top navigation, command palette, etc.)
- Screen composition and screen inventory
- Responsive / multi-device layouts
- Interaction patterns
- Widget placement and dashboard layouts
