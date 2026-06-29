# Persona Schema Registry (v3.0)

> Single source of truth for the persona document structure in AGE. This registry **describes the
> implementation** in `01_USER_JOURNEYS.md`. Scope: all persona documents in `/docs/product/`.

## Principle

The registry describes the implementation. As of **v3.0**, `01_USER_JOURNEYS.md` contains **one
canonical persona schema** for **every** persona — human and AI. The two earlier schemas (legacy
Human v1, legacy AI v1) have been **migrated** into this single schema; no other persona structure
exists.

---

## 1. Unified Persona Registry Schema — CANONICAL

**Applies to:** every persona. The **Role Type** field distinguishes
`Human Persona (<Team>)` from `AI Persona (AI Workforce)`. There is no separate human/AI structure.

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

**Coverage (all 31 personas):**

- **Executive Leadership (3):** Founder / CEO · COO · Growth Director
- **Strategy Team (4):** SEO · Paid Media · Content · Brand Strategist
- **Delivery Team (5):** Account Manager · Project Manager · QA Lead · Developer · Designer
- **Revenue Team (3):** Sales Executive · Proposal Specialist · Customer Success Manager
- **Client Team (3):** Business Owner · Marketing Head · Product Manager
- **AI Workforce (13):** Executive · Research · Intelligence · Strategy · Market Discovery · SEO ·
  AEO/GEO · Paid Media · Content · Reporting · Proposal · Project Coordinator · QA Agents

**Rules:** exact ordering · no added/removed/renamed/merged sections · `Role Type` declares
human-vs-AI · **all AI personas are pure producers (no side effects)** · no persona bypasses the
Execution Layer.

## 2. Migration record

The legacy **Human Persona Schema v1 (20-section)** and **AI Workforce Agent Schema v1 (19-section
pipeline)** were retired and their 12 personas (7 human + 5 AI) **mechanically migrated** into the
Unified Schema — a structural reshape only, with no change to responsibilities or business behavior.

## 3. Rules (global)

- **No structural drift** — no renaming, reordering, or per-persona custom sections.
- **No content-invented expansion** — content fits the section boundaries; if it does not fit, it is
  reduced, not expanded.
- **Schema authority** — the registry describes reality; conflicts are resolved by updating the
  registry to match an approved implementation, not by silent drift.

## 4. Validation rule

Before finalizing any persona, verify: Unified Schema · 19 sections · exact heading names · exact
ordering · correct `Role Type`. If any check fails → **do not write the file**.

## 5. Version control

- Schema Version: **v3.0**
- Canonical schema: **Unified Persona Registry Schema (19 sections)** — the only schema.
- Scope: all persona documents in `/docs/product/`.
