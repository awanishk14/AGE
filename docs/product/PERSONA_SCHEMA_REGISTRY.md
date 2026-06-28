# Persona Schema Registry (v1.1)

> Single source of truth for **all allowed persona document structures** in AGE. This registry
> **describes the implementation** in `01_USER_JOURNEYS.md` — it does not redefine it. Both schemas
> below are **LOCKED**. Scope: all persona documents in `/docs/product/`.

## Principle

The registry exists to describe the implementation. The implementation does not change to satisfy
the registry. If a discrepancy is found, the registry is updated — unless an explicit architectural
migration has been approved. No human-template migration has been approved; the human template is
frozen as implemented.

---

## 1. Human Persona Schema (v1) — FROZEN

**Applies to:** Founder / CEO · COO · Growth Director · Executive Leadership · Strategy Team (human
roles) · Delivery Team · Revenue Team · Client Team · all human personas.

**Structure (STRICT 20 sections, exact order — as implemented):**

1. Persona Overview
2. Responsibilities
3. Decision Authority
4. Daily Workflow
5. Weekly Workflow
6. Monthly Workflow
7. Inputs Required
8. Outputs Produced
9. Dashboards
10. Reports
11. Notifications
12. AI Agents
13. Permissions
14. Integrations Used
15. KPIs
16. Pain Points
17. Success Criteria
18. Automation Opportunities
19. Collaboration Matrix
20. Audit Requirements

**Rules:** exact ordering · no added/removed sections · no renaming · no merging · no AI-pipeline
constructs · human lifecycle framing.

---

## 2. AI Workforce Agent Schema (v1) — FROZEN

**Applies to:** Executive Agent · Research Agent · Intelligence Agent · Strategy Agent · Market
Discovery Agent · SEO Agent · AEO/GEO Agent · Paid Media Agent · Content Agent · Reporting Agent ·
Proposal Agent · Project Coordinator Agent · QA Agent · future execution agents.

**Structure (STRICT 19 sections, exact order):**

1. Persona Overview
2. Responsibilities
3. Decision Authority
4. Processing Workflow
5. Input Layer
6. Processing Layer
7. Output Layer
8. Quality Dimensions
9. Operational Modes (Daily / Weekly / Monthly)
10. Inputs Required
11. Outputs Produced
12. Dashboards
13. Collaboration Matrix
14. Constraints
15. KPIs
16. Pain Points
17. Success Criteria
18. Automation Opportunities
19. Audit Requirements

**Rules:** exact ordering · no added/removed sections · no merging · execution/system-behavior
framing (not role-play) · no human lifecycle structure (Daily/Weekly/Monthly live only inside
Operational Modes). `Notifications` are absorbed into Operational Modes (as Alerts) — never a
separate section.

---

## 3. Hybrid rules (global)

- **No cross-schema mixing** — human schema cannot use AI pipeline structure; AI schema cannot use
  human lifecycle structure.
- **No structural drift** — no renaming headings, no reordering, no per-persona custom sections.
- **No content-invented expansion** — content must fit existing section boundaries; if it does not
  fit, it is reduced, not expanded.
- **Schema authority** — if any instruction conflicts with this registry, the registry wins (absent
  an approved architectural migration).

## 4. Validation rule

Before finalizing any persona document, verify: schema compliance · section count · heading names ·
ordering · AI-vs-Human schema match. If any check fails → **do not write the file**.

## 5. Version control

- Schema Version: **v1.1**
- Status: **LOCKED**
- Scope: all persona documents in `/docs/product/`
- Human Schema v1 = the implemented template in `01_USER_JOURNEYS.md` (frozen).
- AI Agent Schema v1 = the 19-section system template (frozen).
