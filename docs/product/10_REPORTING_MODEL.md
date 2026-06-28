# Reporting Model

> Part of the **AGE Product Bible**. See the [Product Bible README](./README.md).

## Purpose

This document defines, at the **business level**, how AGE reports — the kinds of **reports**, the
**metrics** they convey, how reports relate to **dashboards**, and the **generation, delivery, scope,
and audit** principles. Derived from the personas (Doc 01), the Reporting Agent (Doc 01), the
Workspace Model (Doc 02), the Permission Model (Doc 06), and the UI & Navigation model (Doc 07).

It defines the reporting **model**, not its implementation. It does not define report templates,
metric/KPI formulas, export formats, schedule cadences, or a delivery engine — those are
implementation.

> **Status:** In Progress — derived from Final Docs 01–09. Genuine decisions not derivable from
> existing material are surfaced in [§8 Open Decisions](#8-open-decisions).

## Scope

- **In scope:** report kinds, the metrics/KPI principle, the report↔dashboard boundary, generation
  (traceability), delivery/export principles, scope, and audit.
- **Out of scope:** report templates/layouts, metric formulas, export formats, schedule cadences
  (Doc 09), delivery engine, and UX.

## Status

In Progress.

## Related Documents

- [User Journeys](./01_USER_JOURNEYS.md) — per-persona _Reports_ and _KPIs_; the Reporting Agent.
- [UI & Navigation](./07_UI_NAVIGATION.md) — **Final**; dashboards as entry points (§2 boundary).
- [Permission Model](./06_PERMISSION_MODEL.md) · [Automation Model](./09_AUTOMATION_MODEL.md) — **Final**.
- [Data Dictionary](./05_DATA_DICTIONARY.md) — **Final**; metric terminology (definitions deferred).

## Table of Contents

- [1. Principles](#1-principles)
- [2. Reports vs Dashboards](#2-reports-vs-dashboards)
- [3. Report Kinds](#3-report-kinds)
- [4. Metrics & KPIs](#4-metrics--kpis)
- [5. Generation & Traceability](#5-generation--traceability)
- [6. Delivery & Export](#6-delivery--export)
- [7. Scope & Audit](#7-scope--audit)
- [8. Open Decisions](#8-open-decisions)

---

## 1. Principles

1. **Reports are evidence-grounded and traceable.** Per the Reporting Agent (Doc 01): _no report may
   be non-traceable or partially sourced._ Every report can be traced to its sources.
2. **Reports support business decisions** — they orient toward awareness, review, and action, not
   reporting for its own sake (echoing Doc 08's business-attention principle).
3. **Scoped & permission-aware.** A report only contains data the recipient has access to, within a
   single context (Doc 06, Doc 02 §15).

## 2. Reports vs Dashboards

These are distinct and must not be conflated:

|         | **Dashboard** (Doc 07)                                    | **Report** (this document)                           |
| ------- | --------------------------------------------------------- | ---------------------------------------------------- |
| Nature  | A **live orientation** view — an entry point toward work. | A **structured, point-in-time or periodic** output.  |
| Purpose | "What needs attention, why, what next" in the moment.     | A communicated summary/record for review or sharing. |
| Owner   | Doc 07 (UI/Navigation)                                    | Doc 10 (Reporting)                                   |

Dashboards orient; reports communicate. A report may be generated _from_ the same underlying business
data a dashboard surfaces.

## 3. Report Kinds

Canonical report kinds are derived from the personas (Doc 01 _Reports_):

- **Received vs Created** — reports a persona _receives_ (e.g., Daily Executive Brief, Weekly
  Leadership/Performance Reports, Monthly Business/Growth Reviews, Quarterly Strategic/Growth Reviews)
  vs. reports a persona _creates_.
- **Periodic vs On-demand** — recurring summaries vs. ad-hoc reports generated when needed.
- **Internal vs Client-facing** — for agency teams vs. for the Client.

The authoritative per-persona report set lives in Doc 01; this document defines the model, not the
catalog (see §8).

## 4. Metrics & KPIs

- Reports convey **metrics and KPIs**. The canonical KPI structure (Doc 01 personas) distinguishes
  **Primary**, **Secondary**, **Leading indicators**, and **Lagging indicators**.
- A metric is, in the knowledge model, the BKG **Metric** node; metrics are produced by execution and
  accumulate at the Client (Doc 02 §7).
- **Metric/KPI definitions and formulas are deferred** (Doc 05: the Product Bible does not define
  fields/formulas). This document establishes only the KPI structure and that reports convey them.

## 5. Generation & Traceability

- Reports are **produced** (not "executed") — the **Reporting Agent** is a **pure producer** (Doc 04):
  it aggregates and structures, it does not perform side effects.
- **Traceability (canonical).** Every report records its **sources, aggregation basis, timestamp,
  KPI definitions used, coverage completeness, and confidence** (Reporting Agent _Audit Requirements_,
  Doc 01). A report is never non-traceable or partially sourced.
- Report generation may be **automated/scheduled** (Doc 09); cadence is implementation (Doc 09).

## 6. Delivery & Export

- **Viewing** a report in-platform is a Read action (Doc 06).
- **Export** (taking a report out of the platform) is the **Export** action (Doc 06) and is permission-
  and scope-bound.
- **Delivering** a report to an external destination (email/collaboration platform — Doc 08
  destinations) is an **Execution Layer side effect** and is gated accordingly.
- Export **formats** and delivery mechanics are implementation (§8).

## 7. Scope & Audit

- **Scoped.** A report belongs to a single Organization / Client / Project scope and never blends or
  leaks data across Clients or tenants (Doc 02 §15).
- **Client members** follow the same reporting governance as Agency members (responsibility, scope,
  context) — no special reporting model, consistent with Doc 08.
- **Audited.** Report generation, access, export, and delivery are **auditable** (persistence
  AuditLog).

## 8. Open Decisions

> Genuine decisions not derivable from the frozen architecture or Final Docs.

1. **Authoritative report catalog.** The consolidated set of reports (beyond Doc 01's per-persona
   lists) and their canonical definitions.
2. **KPI definitions & targets.** Concrete metric/KPI definitions, formulas, and target/benchmark
   handling (largely implementation per Doc 05).
3. **Export formats & delivery.** Which export formats and external delivery destinations are
   supported, and their rules.
4. **Client-facing reporting specifics.** Which reports are exposed to Client members and any
   presentation differences (governance is identical; surface/selection may differ).
5. **Report retention & versioning.** How long reports are retained and whether they are versioned as
   historical records.
