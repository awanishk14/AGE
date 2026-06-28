# Persona Schema Registry (v2.0)

> Single source of truth for **all allowed persona document structures** in AGE. This registry
> **describes the implementation** in `01_USER_JOURNEYS.md`. Scope: all persona documents in
> `/docs/product/`.

## Principle

The registry describes the implementation; the implementation does not change to satisfy the
registry. When a discrepancy is found, the registry is updated to reflect reality.

**As of v2.0**, the canonical, go-forward structure for **every** persona — human or AI — is the
**Unified Persona Registry Schema** (§1). Two **legacy** schemas (§2, §3) remain in the document for
personas completed before v2.0 and **coexist**, frozen, until a Product-Owner-approved migration says
otherwise.

---

## 1. Unified Persona Registry Schema (v2) — CANONICAL (go-forward)

**Applies to:** every persona — human and AI. The **Role Type** field (§1, item 2) distinguishes
`Human Persona (<Team>)` from `AI Persona (AI Workforce)`. No separate human/AI structures going
forward.

**Structure (STRICT 19 sections, exact order):**

1. Identity
2. Role Type
3. Scope of Responsibility
4. Core Objective
5. System Interaction Scope
6. Decision Authority
7. Constraints
8. Key Inputs
9. Outputs
10. Success Metrics
11. Collaboration Model
12. AI Augmentation
13. Lifecycle Position
14. Security Context
15. Configuration Dependencies
16. Failure Mode
17. Auditability
18. External Interaction
19. Notes

**Currently implemented for:** Delivery Team (Account Manager, Project Manager, QA Lead, Developer,
Designer) · Revenue Team (Sales Executive, Proposal Specialist, Customer Success Manager) · Client
Team (Business Owner, Marketing Head, Product Manager) · AI Workforce (Executive, Intelligence,
Market Discovery, AEO/GEO, Paid Media, Proposal, Project Coordinator, QA Agents).

**Rules:** exact ordering · no added/removed/renamed/merged sections · `Role Type` declares
human-vs-AI · AI personas remain pure producers (no side-effects).

---

## 2. Legacy: Human Persona Schema (v1) — FROZEN (coexisting)

**Still applies to (completed pre-v2.0, not restructured):** Founder / CEO · COO · Growth Director ·
SEO Strategist · Paid Media Strategist · Content Strategist · Brand Strategist.

**Structure (20 sections):** Persona Overview · Responsibilities · Decision Authority · Daily Workflow
· Weekly Workflow · Monthly Workflow · Inputs Required · Outputs Produced · Dashboards · Reports ·
Notifications · AI Agents · Permissions · Integrations Used · KPIs · Pain Points · Success Criteria ·
Automation Opportunities · Collaboration Matrix · Audit Requirements.

---

## 3. Legacy: AI Workforce Agent Schema (v1) — FROZEN (coexisting)

**Still applies to (completed pre-v2.0, not restructured):** Strategy Agent · Content Agent · SEO
Agent · Research Agent · Reporting Agent.

**Structure (19 sections):** Persona Overview · Responsibilities · Decision Authority · Processing
Workflow · Input Layer · Processing Layer · Output Layer · Quality Dimensions · Operational Modes ·
Inputs Required · Outputs Produced · Dashboards · Collaboration Matrix · Constraints · KPIs · Pain
Points · Success Criteria · Automation Opportunities · Audit Requirements.

---

## 4. Coexistence & Migration

- **Three formats currently coexist** in `01_USER_JOURNEYS.md`: 19 personas on the Unified Schema
  (§1), 7 human personas on legacy Human v1 (§2), and 5 AI agents on legacy AI v1 (§3).
- **Pending decision:** whether to **migrate** the 12 legacy personas to the Unified Schema (§1) for
  full consistency, or leave them frozen and coexisting. No migration is performed without explicit
  Product-Owner approval (the legacy personas were previously frozen).

## 5. Hybrid rules (global)

- **No structural drift** — within a schema: no renaming, reordering, or per-persona custom sections.
- **No content-invented expansion** — content fits existing section boundaries; if it does not fit, it
  is reduced, not expanded.
- **Schema authority** — the registry describes reality; conflicts are resolved by updating the
  registry to match an approved implementation, not by silent drift.

## 6. Validation rule

Before finalizing any persona, verify: correct schema for its era (Unified for new; legacy frozen for
the listed completed personas) · section count · heading names · ordering. If any check fails →
**do not write the file**.

## 7. Version control

- Schema Version: **v2.0**
- Canonical schema: **Unified Persona Registry Schema (19 sections)** — all new personas.
- Legacy schemas: **Human v1 (20)** and **AI Agent v1 (19)** — frozen, coexisting for completed
  personas pending a migration decision.
- Scope: all persona documents in `/docs/product/`.
