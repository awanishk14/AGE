# AGE — Start Here

> **Primary onboarding guide for engineers, AI assistants, contributors, and maintainers.**
> Read this document before opening any other file in this repository.

---

## 1. What is AGE?

AGE (Adaptive Growth Engine) is an AI-powered growth intelligence platform for growth agencies.

It replaces fragmented marketing tools with a unified operating system that combines a structured
business knowledge model, layered intelligence engines, and a capability-based execution architecture.
Agencies use AGE to research client markets, generate evidence-backed growth strategies, and
coordinate delivery — with AI agents acting as reasoning support throughout.

AGE is not a general-purpose AI tool. It is a structured platform with defined personas, explicit
capability boundaries, a governed execution layer, and a frozen specification that precedes all
implementation.

---

## 2. Project Status

| Milestone                  | Status      | Tag                         |
| -------------------------- | ----------- | --------------------------- |
| Phase 1 — Cognitive Core   | ✅ Complete | `foundation-v0.1`           |
| Architecture Freeze        | ✅ Frozen   | `architecture-freeze-v1.0`  |
| Product Bible (Docs 01–16) | ✅ Final    | `product-bible-v1.0`        |
| Specification Freeze v1.0  | ✅ Frozen   | `specification-freeze-v1.0` |
| Phase 2 — Intelligence     | Not started | —                           |

**Implementation has not yet begun.**

The repository currently contains: the full frozen architecture, all Product Bible documents,
the monorepo scaffold, the Phase 1 Cognitive Core implementation (`@age/bif`,
`@age/research-intelligence-engine`, `@age/strategy-intelligence-engine`, `@age/persistence`, etc.),
and all supporting documents. No production capability code exists yet.

---

## 3. Repository Reading Order

Read in this order. Do not skip ahead.

| Step | Document                                                                 | Purpose                                          |
| ---- | ------------------------------------------------------------------------ | ------------------------------------------------ |
| 1    | `START_HERE.md` ← _you are here_                                         | Orientation                                      |
| 2    | `docs/architecture/AGE_SYSTEM_MAP.md`                                    | How the system is structured (layers, packages)  |
| 3    | `docs/architecture/CAPABILITY_ARCHITECTURE.md`                           | What capabilities exist and how they are bounded |
| 4    | `docs/architecture/DOMAIN_ARCHITECTURE.md`                               | The 20 bounded contexts                          |
| 5    | `docs/architecture/BUSINESS_KNOWLEDGE_GRAPH.md`                          | The canonical business model (26 nodes)          |
| 6    | `docs/adrs/` (0001 → 0009)                                               | Why every major decision was made                |
| 7    | `docs/product/05_DATA_DICTIONARY.md`                                     | Canonical terminology — read before other docs   |
| 8    | `docs/product/01_USER_JOURNEYS.md` through `docs/product/16_GLOSSARY.md` | The complete Product Bible                       |
| 9    | `docs/reviews/SPECIFICATION_VALIDATION_REPORT.md`                        | What was audited and what was found              |
| 10   | `docs/engineering/SPECIFICATION_FIRST_DEVELOPMENT.md`                    | The engineering rule that governs all work       |

---

## 4. Source of Truth

When any two documents appear to conflict, this precedence order resolves it:

```
Architecture documents (docs/architecture/)
          ↓
Product Bible (docs/product/01 – 16)
          ↓
ADRs (docs/adrs/)
          ↓
Implementation (code)
```

**If implementation conflicts with the specification, the implementation is wrong.**

The specification is the contract. Code is reviewed against it. If a gap in the specification is
discovered during implementation, it is resolved by writing an ADR — not by making an
undocumented implementation decision.

---

## 5. Frozen Artifacts

The following artifacts are frozen. They cannot change implicitly. Every change requires an
explicit, approved process (see § 4 above).

| Artifact                        | Location                                          | Frozen since                |
| ------------------------------- | ------------------------------------------------- | --------------------------- |
| Domain Architecture             | `docs/architecture/DOMAIN_ARCHITECTURE.md`        | `architecture-freeze-v1.0`  |
| System Map                      | `docs/architecture/AGE_SYSTEM_MAP.md`             | `architecture-freeze-v1.0`  |
| Capability Architecture         | `docs/architecture/CAPABILITY_ARCHITECTURE.md`    | `architecture-freeze-v1.0`  |
| Business Knowledge Graph        | `docs/architecture/BUSINESS_KNOWLEDGE_GRAPH.md`   | `architecture-freeze-v1.0`  |
| Business Intelligence Framework | `packages/bif/`                                   | `architecture-freeze-v1.0`  |
| Research Intelligence Engine    | `packages/research-intelligence-engine/`          | `architecture-freeze-v1.0`  |
| Strategy Intelligence Engine    | `packages/strategy-intelligence-engine/`          | `architecture-freeze-v1.0`  |
| ADR-0001 through ADR-0008       | `docs/adrs/`                                      | `architecture-freeze-v1.0`  |
| Product Bible — Documents 01–16 | `docs/product/`                                   | `product-bible-v1.0`        |
| Persona Schema Registry v3.0    | `docs/product/PERSONA_SCHEMA_REGISTRY.md`         | `product-bible-v1.0`        |
| Specification Validation Report | `docs/reviews/SPECIFICATION_VALIDATION_REPORT.md` | `specification-freeze-v1.0` |

**To change a frozen artifact:**

- Architectural change → write and approve an ADR, then update the architecture document.
- Product behavior change → Product Owner approval, then update the Product Bible document.
- New capability → new ADR before any code is written.
- Implementation detail → code only; no specification change required.

ADR-0009 (Client Aggregate) is currently **reserved** — its decision is not yet made. It is
the first required document before Phase 2 begins.

---

## 6. Architectural Invariants

These invariants hold without exception across every document in this repository. Any code,
design, or document that violates them is incorrect.

| Invariant                                   | Statement                                                                                                                                                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Execution boundary**                      | The Execution Layer (`docs/product/12_EXECUTION_MODEL.md`) is the **only** layer permitted to perform side effects. No other layer — agents, capabilities, automations, integrations, reporting — may cause side effects. |
| **AI agents are pure producers**            | All 13 AI agents produce outputs only. They never execute actions, never modify external systems, and never cause side effects. This is enforced in five independent documents.                                           |
| **Workspace hierarchy**                     | `Organization → Client → Project` is the universal scope hierarchy. Every permission, every data boundary, every execution context, and every configuration scope is bounded by this hierarchy.                           |
| **BKG is canonical**                        | The Business Knowledge Graph (`docs/architecture/BUSINESS_KNOWLEDGE_GRAPH.md`) is the authoritative model for all business concepts and their relationships. Implementations derive from it; they do not redefine it.     |
| **Capabilities are business logic**         | Capabilities (Market Discovery, Intelligence, Growth, Authority, Operations, Revenue) define _what_ work is done. They consume the SIE `DecisionPackage` read-only and produce plan objects. They never execute.          |
| **Product Bible defines behavior**          | `docs/product/` is the authoritative definition of what AGE does. Architecture defines how it is built. These are separate concerns.                                                                                      |
| **No undocumented architectural decisions** | Every structural decision that cannot be derived from the frozen specification must be captured in an ADR before implementation proceeds.                                                                                 |

---

## 7. Specification First Development (SFD)

All implementation work in AGE follows the SFD engineering rule. Full document:
`docs/engineering/SPECIFICATION_FIRST_DEVELOPMENT.md`.

### Mandatory EPIC sequence

```
ADR (if needed)
      ↓
Implementation Plan
      ↓
Feature Branch
      ↓
Implementation
      ↓
Tests
      ↓
Architecture Review
      ↓
Merge
```

No step may be skipped. No step may be reordered.

### The stop rule

> If implementation uncovers a question that the frozen specification does not answer:
>
> 1. **Stop implementation.**
> 2. **Write or update an ADR.**
> 3. **Obtain approval.**
> 4. **Continue implementation.**

Do not resolve architectural questions informally in code. Undocumented decisions create
hidden coupling that cannot be reviewed, reversed, or explained.

### PR review contract

Every pull request is reviewed against exactly two questions:

1. Does it conform to the frozen specification?
2. Does it require a new ADR?

If the answer to (2) is yes — the ADR comes first.

---

## 8. Repository Navigation

```
AGE/
├── START_HERE.md              ← you are here
├── README.md                  ← brief project overview
│
├── apps/
│   ├── api/                   NestJS API — modular monolith (20 domain modules in src/modules/)
│   └── web/                   Frontend application
│
├── packages/                  Shared platform packages (@age/* namespace)
│   ├── shared/                Domain kernel (Entity, AggregateRoot, ValueObject, Repository)
│   ├── types/                 Shared TypeScript types
│   ├── config/                Configuration utilities
│   ├── persistence/           Base persistence abstractions (PersistedBase, AuditLog, RLS intent)
│   ├── bif/                   Business Intelligence Framework — Phase 1 ✅
│   ├── business-knowledge-graph/  BKG implementation — Phase 1 ✅
│   ├── research-intelligence-engine/  RIE — Phase 1 ✅
│   ├── strategy-intelligence-engine/  SIE — Phase 1 ✅
│   ├── knowledge/             Knowledge layer utilities
│   ├── integrations/          Integration provider contracts
│   ├── ui/                    Shared UI components
│   └── sdk/                   Public SDK
│
├── docs/
│   ├── architecture/          Frozen architecture documents (System Map, BKG, Capabilities, Domain)
│   ├── adrs/                  Architecture Decision Records (0001–0009)
│   ├── product/               Product Bible — Documents 01–16 (all Final)
│   ├── engineering/           Engineering rules (SFD)
│   ├── reviews/               Validation report, milestone history, completion report
│   ├── blueprints/            Feature blueprints (implementation planning)
│   ├── prds/                  Product requirements documents
│   ├── templates/             Document templates
│   ├── research/              Research and discovery documents
│   └── white-papers/          Long-form conceptual documents
│
├── infrastructure/            Infrastructure configuration
├── scripts/                   Utility scripts
└── tests/                     Top-level test configuration
```

**The `packages/` directory contains all Phase 1 implementation.** No `capability-kit/` or
`packages/capabilities/` directories exist yet — they are Phase 2.

---

## 9. Milestones

### Completed

| Tag                         | Date       | What it represents                             |
| --------------------------- | ---------- | ---------------------------------------------- |
| `foundation-v0.1`           | 2026-06-28 | Phase 1 Cognitive Core complete                |
| `architecture-freeze-v1.0`  | 2026-06-28 | Architecture frozen — no implicit changes      |
| `product-bible-v1.0`        | 2026-06-28 | All 16 Product Bible documents Final           |
| `specification-freeze-v1.0` | 2026-06-29 | Specification validated, frozen — Phase 2 gate |

### Planned

| Tag                            | Phase   | Completion condition                            |
| ------------------------------ | ------- | ----------------------------------------------- |
| `implementation-v0.1`          | Phase 2 | Capability Kit built; ADR-0009 resolved         |
| `intelligence-capability-v1.0` | Phase 2 | Intelligence Capability complete and tested     |
| `market-discovery-v1.0`        | Phase 2 | Market Discovery Capability complete and tested |
| `growth-capability-v1.0`       | Phase 3 | Growth Capability complete and tested           |
| `authority-capability-v1.0`    | Phase 3 | Authority Capability complete and tested        |
| `operations-capability-v1.0`   | Phase 4 | Operations Capability complete and tested       |
| `revenue-capability-v1.0`      | Phase 4 | Revenue Capability complete and tested          |
| `execution-layer-v1.0`         | Phase 5 | Human-approved execution operational            |
| `beta-v1.0`                    | Beta    | First external clients onboarded                |
| `ga-v1.0`                      | GA      | General availability; all editions operational  |

Tags are created when milestones are **complete and verified** — not when work begins.

Full milestone record: `docs/reviews/MILESTONE_HISTORY.md`

---

## 10. Beginning Phase 2

Phase 2 does not begin with code. It begins with a document.

### Step 1 — Author ADR-0009 (Client Aggregate)

`docs/adrs/0009-client-aggregate.md` is currently **reserved** (identifier exists; decision not
yet made). ADR-0009 must define how the `Client` business concept — a first-class entity in the
Product Bible (`docs/product/02_WORKSPACE_MODEL.md §5`) — maps to the implementation domain
model.

**No Phase 2 implementation begins before ADR-0009 is completed and approved.**

Context: the current 20 domain modules do not include a `client` module. The BKG uses an
`Organization` node as the implementation-level representation of the client's company. ADR-0009
resolves how these two models meet in code.

Reference: `docs/reviews/SPECIFICATION_VALIDATION_REPORT.md` → AR-02.

### Step 2 — Begin EPIC-01 using SFD

After ADR-0009 is approved, proceed to EPIC-01: **Intelligence Platform**.

EPIC-01 scope (from `docs/product/15_PRODUCT_ROADMAP.md`):

- Capability Kit (`packages/capability-kit/`) — shared contracts and the Capability Registry
  (ADR-0008)
- Intelligence Capability — the first capability build, consuming SIE / BIF / BKG read-only

Follow the SFD workflow for every task within EPIC-01. The first EPIC should also establish the
**agent↔capability orchestration contract pattern** — the governing pattern for all subsequent EPICs
(`docs/reviews/SPECIFICATION_VALIDATION_REPORT.md` → AR-03).

---

## Reference index

| Question                                  | Go to                                                 |
| ----------------------------------------- | ----------------------------------------------------- |
| What does AGE do?                         | `docs/product/05_DATA_DICTIONARY.md`, then Doc 02–16  |
| How is the system structured?             | `docs/architecture/AGE_SYSTEM_MAP.md`                 |
| What capabilities exist?                  | `docs/architecture/CAPABILITY_ARCHITECTURE.md`        |
| What are the business concepts?           | `docs/architecture/BUSINESS_KNOWLEDGE_GRAPH.md`       |
| Why was X decided this way?               | `docs/adrs/` — find the relevant ADR                  |
| Who are the personas?                     | `docs/product/01_USER_JOURNEYS.md`                    |
| What does term X mean?                    | `docs/product/16_GLOSSARY.md`                         |
| What permissions model does AGE use?      | `docs/product/06_PERMISSION_MODEL.md`                 |
| How does execution work?                  | `docs/product/12_EXECUTION_MODEL.md`                  |
| What was validated before implementation? | `docs/reviews/SPECIFICATION_VALIDATION_REPORT.md`     |
| What is the engineering workflow?         | `docs/engineering/SPECIFICATION_FIRST_DEVELOPMENT.md` |
| What are the milestones?                  | `docs/reviews/MILESTONE_HISTORY.md`                   |

---

## 11. Engineering Principles

These principles communicate the engineering philosophy of AGE to every contributor before they
write their first line of code. They are not guidelines — they are the reasoning behind every
structural decision in the frozen specification.

---

### Specification First

The specification is the contract. Implementation must conform to the specification.
Implementation never redefines the specification.

When code and spec conflict, the code is wrong.

---

### Architecture Before Code

Major architectural decisions are made before implementation begins. If implementation
discovers a missing architectural decision:

1. Stop.
2. Create or update the appropriate ADR.
3. Obtain approval.
4. Continue implementation.

See `docs/engineering/SPECIFICATION_FIRST_DEVELOPMENT.md`.

---

### Single Source of Truth

There is only one authoritative definition for every concept. Business rules are not duplicated
across documents. When conflicts exist, follow the Source of Truth hierarchy:

```
Architecture → Product Bible → ADRs → Implementation
```

See § 4 of this document.

---

### Capabilities Before Features

AGE is organized around business capabilities (Market Discovery, Intelligence, Growth,
Authority, Operations, Revenue). Features exist to support capabilities. Features are never
the architectural organizing principle.

See `docs/architecture/CAPABILITY_ARCHITECTURE.md`.

---

### Business Before Technology

Business concepts define the architecture. Technology exists to realize those business
concepts. Never reshape a business concept to fit implementation convenience. If a technology
cannot model the business concept cleanly, the technology decision is revisited — not the
business model.

The Business Knowledge Graph is the canonical business model. It is not adjusted to
accommodate an ORM or a database schema.

---

### Pure Intelligence, Controlled Execution

Reasoning and execution are intentionally separated at every layer of the system.

- **AI agents reason.** They are pure producers — they never cause side effects.
- **The Execution Layer acts.** It is the only layer permitted to perform side effects.

This separation is an architectural invariant. It must never be violated. See
`docs/product/12_EXECUTION_MODEL.md` and `docs/product/04_AI_AGENT_ARCHITECTURE.md`.

---

### Evolution Through ADRs

Architecture evolves through explicit, approved Architecture Decision Records. It never
evolves accidentally through implementation. An undocumented architectural decision made in
code is a defect — not a shortcut.

All ADRs live in `docs/adrs/`. The next reserved identifier is ADR-0009.

---

### Preserve the Freeze

`specification-freeze-v1.0` is the architectural baseline. Future changes extend the
system — they do not rewrite it. Every significant architectural change must be deliberate,
documented, reviewed, and approved before implementation begins.

The four completed freeze tags are permanent:

```
foundation-v0.1           →  architecture-freeze-v1.0
architecture-freeze-v1.0  →  product-bible-v1.0
product-bible-v1.0        →  specification-freeze-v1.0
```

They are not moved, re-tagged, or deleted.
