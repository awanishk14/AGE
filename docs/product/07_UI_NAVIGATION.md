# UI & Navigation

> Part of the **AGE Product Bible**. See the [Product Bible README](./README.md).

## Purpose

This document defines the **navigation model and information architecture** of AGE at the product
level — how users move through the platform and how information is organized — derived from the
Workspace Model (Doc 02) and the personas (Doc 01).

It deliberately does **not** design the visual interface: no layouts, components, visual system,
interaction patterns, or screen mockups. Those are genuine product-design decisions and are surfaced
in [§7 Open Decisions](#7-open-decisions) rather than invented here.

> **Status:** In Progress — navigation/IA derived from Final Docs 01–06; visual/UX design surfaced as
> Open Decisions, not assumed.

## Scope

- **In scope:** navigation principles, the navigation structure (Workspace lenses), information
  architecture, the canonical screen/dashboard anchors that already exist in Doc 01, and the
  conceptual UI states.
- **Out of scope:** visual design, layout, components, interaction/visual patterns, responsive
  behavior, copy, and any screen mockups (all product-design decisions).

## Status

In Progress.

## Related Documents

- [User Journeys](./01_USER_JOURNEYS.md) — personas, their dashboards, and journeys.
- [Workspace Model](./02_WORKSPACE_MODEL.md) — **Final**; Workspace is a navigation/context lens (§6).
- [Notification Model](./08_NOTIFICATION_MODEL.md) · [Reporting Model](./10_REPORTING_MODEL.md).
- [Permission Model](./06_PERMISSION_MODEL.md) — **Final**; scopes determine what is navigable.

## Table of Contents

- [1. Navigation Principles](#1-navigation-principles)
- [2. Navigation Structure (Workspace Lenses)](#2-navigation-structure-workspace-lenses)
- [3. Information Architecture](#3-information-architecture)
- [4. Screen & Dashboard Anchors](#4-screen--dashboard-anchors)
- [5. Navigation & Access](#5-navigation--access)
- [6. UI States (Conceptual)](#6-ui-states-conceptual)
- [7. Open Decisions](#7-open-decisions)

---

## 1. Navigation Principles

Derived from Doc 01 (Core Design Principles):

1. **Proactive, not search-first.** AGE surfaces opportunities, risks, recommendations, evidence,
   and next actions — users should not have to hunt for information.
2. **Every primary view answers three questions immediately:** _What needs my attention? Why does it
   matter? What should I do next?_
3. **Context-first.** Navigation is organized around the business context a user is operating in
   (Organization / Client / Project), not around features or channels.

## 2. Navigation Structure (Workspace Lenses)

Per Doc 02 §6, a **Workspace is a product lens** — it describes **navigation and context**, not
ownership. The canonical navigation contexts are the three Workspace lenses:

| Lens                       | Navigation context                                                             |
| -------------------------- | ------------------------------------------------------------------------------ |
| **Organization Workspace** | The agency: its Clients, Shared Agency Resources, and portfolio-level views.   |
| **Client Workspace**       | One Client's Business: intelligence, research, strategy, assets, and projects. |
| **Project Workspace**      | One Project's execution within a Client.                                       |

**Context switching** (moving between Organization → Client → Project) is the primary navigation
movement. What is navigable in each lens is bounded by the user's access (Doc 06, §5 below).

## 3. Information Architecture

Information is organized by the business hierarchy (Doc 02) and the canonical vocabulary (Doc 05):

- **Organization Workspace** → Clients · Shared Agency Resources · portfolio/aggregate views.
- **Client Workspace** → the Business's **BIF** (12 sections) · **Research/Evidence** · **Strategy** ·
  **Knowledge (BKG)** · **Assets** · the Client's **Projects** · client lifecycle state (Doc 03).
- **Project Workspace** → the Project's execution artifacts and capability work.

This IA is a **map of where information lives**, derived from the frozen model. The visual
organization (menus, grouping, hierarchy depth, labels) is a design decision (§7).

## 4. Screen & Dashboard Anchors

The personas in Doc 01 already define **canonical dashboard anchors** (their _Dashboards_ sections).
These are the named primary views the product must provide; their **contents** are owned by Doc 01,
their **visual design** is deferred (§7). Examples (non-exhaustive, from Doc 01):

- **Executive Command Center** (Founder/CEO) · **Growth Command Center** (Growth Director) ·
  **Operations Command Center** (COO).
- **Organic Growth / SEO Intelligence Command Center** (SEO Strategist) · **Paid Media Command
  Center** (Paid Media Strategist) · **Content Intelligence Command Center** (Content Strategist) ·
  **Brand Intelligence Command Center** (Brand Strategist).
- AI agent operational dashboards (e.g., **Strategy/Research/SEO/Content/Reporting** command centers).

> The full, authoritative list of dashboards is whatever Doc 01 defines per persona. This document
> does not invent dashboards beyond Doc 01.

## 5. Navigation & Access

Navigation is bounded by permissions (Doc 06):

- A user navigates only the **Organizations / Clients / Projects** their responsibilities grant
  (Doc 06 §2, §5). Out-of-scope contexts are not navigable.
- The same lens shows different content to different subjects according to scope and access.
- AI agents are not navigators/subjects (Doc 06 §7); navigation is a human concern.

## 6. UI States (Conceptual)

States a primary view can represent — described conceptually, not visually:

- **Empty / early** — a Client in `Created`/`Onboarding` (Doc 03) whose intelligence is not yet
  populated.
- **Populated** — an `Active` Client with intelligence, evidence, and recommendations to surface.
- **Restricted** — content the current user has no access to is not shown (Doc 06).
- **Historical / read-only** — an `Archived` Client (Doc 03), shown as historical record.

The visual representation of these states (loading, empty, error, skeletons, etc.) is a design
decision (§7).

## 7. Open Decisions

> UI/UX is largely a **product-design** concern that is **not derivable** from the frozen
> architecture. These are surfaced, not invented.

1. **Visual design system.** Layout, components, typography, color, spacing, theming — the entire
   visual language. (Implementation note: a `@age/ui` package and shadcn/ui exist, but the design
   system itself is undecided.)
2. **Concrete screen designs & inventory.** The full set of screens beyond the Doc 01 dashboard
   anchors, and each screen's composition.
3. **Navigation pattern.** Sidebar vs top-nav vs command palette; how context switching
   (Org/Client/Project) is presented; breadcrumbs; global search.
4. **Information density & grouping.** How BIF sections, capabilities, research, and projects are
   grouped and labeled within the Client Workspace.
5. **Interaction & state visuals.** Empty/loading/error states, real-time updates, approvals UX,
   notification surfacing (coordinate with Doc 08).
6. **Responsive / multi-device.** Whether and how the product adapts across devices.
7. **Dashboard composition standard.** A consistent pattern for "answer the three questions" across
   every command center (Doc 01 principle) — a design decision.
