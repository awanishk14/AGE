# Reporting Model

> Part of the **AGE Product Bible**. See the [Product Bible README](./README.md).

## Purpose

This document defines, at the **business level**, what a report **is**, how it relates to business
entities, and the **principles** governing its creation, delivery, scope, and audit. Derived from the
personas (Doc 01), the Reporting Agent (Doc 01), the Workspace Model (Doc 02), the Permission Model
(Doc 06), and the UI & Navigation model (Doc 07).

It defines the reporting **model**, not its implementation. It does not define a report catalog,
metric/KPI formulas, export formats, schedule cadences, retention/versioning, or a delivery engine —
those are implementation.

> **Status:** Final — approved by the Product Owner. Conforms to Final Docs 01–09.

## Scope

- **In scope:** what a report represents, the report↔dashboard boundary, the KPI principle,
  generation/traceability principles, delivery/export principle, scope, client-facing governance, and
  audit.
- **Out of scope:** the report catalog, metric formulas/schemas, export formats/protocols, schedule
  cadences (Doc 09), retention/versioning mechanics, delivery engine, and UX.

## Status

Final.

## Related Documents

- [User Journeys](./01_USER_JOURNEYS.md) — per-persona _Reports_ and _KPIs_; the Reporting Agent.
- [UI & Navigation](./07_UI_NAVIGATION.md) — **Final**; dashboards as entry points (§2 boundary).
- [Permission Model](./06_PERMISSION_MODEL.md) · [Automation Model](./09_AUTOMATION_MODEL.md) · [AI Agent Architecture](./04_AI_AGENT_ARCHITECTURE.md) — **Final**.
- [Data Dictionary](./05_DATA_DICTIONARY.md) — **Final**; metric terminology (definitions deferred).

## Table of Contents

- [1. Principles](#1-principles)
- [2. Reports vs Dashboards](#2-reports-vs-dashboards)
- [3. Reports as Derivative Artifacts](#3-reports-as-derivative-artifacts)
- [4. Metrics & KPIs](#4-metrics--kpis)
- [5. Generation & Traceability](#5-generation--traceability)
- [6. Delivery & Export](#6-delivery--export)
- [7. Scope, Client-Facing Reporting & Audit](#7-scope-client-facing-reporting--audit)
- [8. Resolved Decisions](#8-resolved-decisions)

---

## 1. Principles

1. **Reports are interpretive outputs, not raw data.** A report is a **structured interpretation** of
   Client performance, Project execution, business-intelligence signals, and AI-generated insights —
   not a data dump.
2. **Always traceable to source context.** A report must always be traceable back to its source
   context (Client, Project, BKG, or capability output). The _mechanics_ of traceability are
   implementation; _that_ a report is traceable is canonical (consistent with Docs 04, 09; Reporting
   Agent: _no report may be non-traceable or partially sourced_).
3. **Reports support business decisions** — they orient toward awareness, review, and action.
4. **Scoped & permission-aware.** A report only contains data the recipient has access to, within a
   single context (Doc 06, Doc 02 §15).

## 2. Reports vs Dashboards

Distinct, and never conflated:

|         | **Dashboard** (Doc 07)                                    | **Report** (this document)                           |
| ------- | --------------------------------------------------------- | ---------------------------------------------------- |
| Nature  | A **live orientation** view — an entry point toward work. | A **structured, point-in-time** interpretation.      |
| Purpose | "What needs attention, why, what next" in the moment.     | A communicated summary/record for review or sharing. |
| Owner   | Doc 07 (UI/Navigation)                                    | Doc 10 (Reporting)                                   |

Dashboards orient; reports communicate.

## 3. Reports as Derivative Artifacts

Reports are **derivative business artifacts, not primary platform constructs.** The Product Bible
defines **what a report represents**, **how it relates to business entities** (Client, Project, BKG,
capability output), and the **principles governing its creation** — **not** a fixed catalog.

Descriptive kinds (from Doc 01 _Reports_, illustrative, not a catalog): reports a persona _receives_
vs. _creates_; _periodic_ vs. _on-demand_; _internal_ vs. _client-facing_. **The specific catalog of
reports is dynamic and evolves with business needs** and is not enumerated here.

## 4. Metrics & KPIs

- **KPIs are standardized business signals used to evaluate performance, progress, and outcomes
  across Clients and Projects.** The persona KPI structure (Doc 01) distinguishes **Primary**,
  **Secondary**, **Leading**, and **Lagging** indicators.
- A metric maps to the BKG **Metric** node; metrics are produced by execution and accumulate at the
  Client (Doc 02 §7).
- **KPI calculations, formulas, and metric schemas are not defined here** — they belong to the
  Business Intelligence layer (conceptually) and implementation (measurement logic) (Doc 05).

## 5. Generation & Traceability

- Reports are **produced** — the **Reporting Agent** is a **pure producer** (Doc 04): it aggregates
  and structures; it does not perform side effects.
- Reports are **always traceable to their source context** (§1.2). The recorded basis (sources,
  coverage, confidence, etc.) is canonical intent; its mechanics are implementation.
- Report generation may be **automated/scheduled** (Doc 09); cadence is implementation.

## 6. Delivery & Export

- **Viewing** a report in-platform is a Read action (Doc 06); **Export** is the Export action
  (Doc 06), permission- and scope-bound.
- **Business principle:** _reports may be exported or shared outside the platform when required for
  business communication._ Delivering a report to an external destination is an **Execution Layer
  side effect** and is gated accordingly.
- **Export formats, file types, external representations, and delivery protocols are not defined
  here** — they belong to implementation and integration layers.

## 7. Scope, Client-Facing Reporting & Audit

- **Scoped.** A report belongs to a single Organization / Client / Project scope and never blends or
  leaks data across Clients or tenants (Doc 02 §15).
- **Client-facing reporting uses the same model, same generation principles** as internal reporting —
  there is **no separate reporting model for external stakeholders.** The **only** distinction is
  **access scope**, governed by Doc 06.
- **Point-in-time & history.** Reports represent **point-in-time interpretations** of business state
  and **may be regenerated or referenced historically.** Retention duration and version management are
  implementation concerns.
- **Audited.** Report generation, access, export, and delivery are **auditable** (persistence
  AuditLog).

## 8. Resolved Decisions

The following were resolved by the Product Owner and are now canonical:

1. **No fixed report catalog.** Reports are derivative artifacts; the Product Bible defines what a
   report represents and the principles governing it, not an exhaustive catalog (which is dynamic).
2. **No KPI definitions.** KPIs are _standardized business signals used to evaluate performance,
   progress, and outcomes across Clients and Projects_; calculations/formulas/schemas belong to the
   BI and implementation layers.
3. **No export formats.** Principle only: _reports may be exported or shared outside the platform when
   required for business communication_; formats/protocols are implementation.
4. **Client-facing = internal model.** Same report model and generation principles; the only
   difference is **access scope** (Doc 06).
5. **No retention/versioning mechanics.** Reports are point-in-time interpretations that may be
   regenerated or referenced historically; storage/versioning is implementation.

**Canonical principle:** reports are **interpretive outputs**, not raw data — always traceable to
their source context (Client, Project, BKG, or capability output), with traceability mechanics at the
implementation level.
