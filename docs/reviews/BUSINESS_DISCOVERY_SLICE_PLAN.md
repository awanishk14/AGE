# Business Discovery / Client Onboarding — First Slice Plan (Documentation Only)

> Status: Proposed — planning document only. This document makes **no** code, package, API, Web,
> DB, or ADR-status changes, and starts no implementation. It defines the first Business Discovery
> slice clearly enough for review.
>
> Baseline: `main` @ `c49045d3f73e9e005fff49510d94f08457dfa627` (AGE restored to the PR #40 active
> product path; PR #41–#61 execution-governance drift reverted via PR #62/#63/#64; restart
> checkpoint in PR #65). Approved direction: **Business Discovery / Client Onboarding**
> (`docs/reviews/AGE_IMPLEMENTATION_RESTART_CHECKPOINT.md`, §5).

## 1. Product Purpose

**Business Discovery / Client Onboarding is the front door of AGE** — the structured intake that
turns an unstructured description of a client's business into a validated, machine-usable
**business context** that every downstream AGE capability can consume.

It captures structured business context, including:

- **Business name** — legal/trading identity.
- **Industry** — sector / vertical the business operates in.
- **Business model** — how the business creates and captures value (B2B/B2C, SaaS, services,
  marketplace, etc.).
- **Target customers / ICP** — who the business sells to (ideal customer profile, segments).
- **Offerings** — products/services sold.
- **Value proposition** — the core promise and differentiation.
- **Geography / markets served** — regions, languages, market focus.
- **Current marketing channels** — how the business currently reaches customers.
- **Competitors** — named or categorical competitive references.
- **Business goals** — what success looks like (revenue, growth, positioning).
- **Growth constraints** — budget, capacity, regulatory, brand, or timing limits.
- **Available assets** — existing content, audiences, data, brand materials.
- **Brand positioning** — tone, promise, and perception the business wants to own.
- **Evidence sources** — where each captured fact comes from (client statement, document, URL as a
  plain reference string — **not** fetched).
- **Known assumptions** — things treated as true but not yet verified.
- **Unknowns / gaps** — critical information missing from the profile.

The output is a **normalized business context object**, not a form for its own sake. Discovery
exists to feed intelligence, not to be an end product.

## 2. Why This Slice Comes Next

AGE is a Strategic Marketing Operating System: it produces **growth intelligence**. Intelligence
is only as reliable as its inputs. Without a structured, validated understanding of the business,
every downstream capability is guessing:

- **BIF** has no organization to represent.
- **Intelligence / Market Discovery / Growth / Authority / Operations / Revenue** capabilities have
  no grounded business context to reason over — their outputs would be generic, not client-specific.
- **Reporting** would report on assumptions rather than evidence.
- **Marketing execution** (out of scope now, and only ever after core intelligence is stable) would
  act without a validated basis.

Business Discovery must therefore come **before** deeper intelligence, strategy, reporting, or
execution. It establishes the single, validated source of business truth (feeding BIF) that makes
all later intelligence trustworthy and specific. It is also the **lowest-risk, highest-leverage**
slice: pure, in-memory, deterministic, and squarely inside AGE's existing safety boundary.

## 3. Relationship to Existing AGE Packages (Conceptual Mapping Only)

> No code is added here. This is a conceptual mapping of how Business Discovery should connect to
> the current baseline.

| Existing baseline                                                   | Relationship to Business Discovery                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BIF** (`@age/bif`)                                                | **Primary downstream consumer.** BIF is the canonical, versioned business model — pure types/interfaces/Zod, no logic/API/DB. Discovery captures raw client answers and **maps** them into BIF-compatible context. Discovery sections align conceptually with BIF sections (organization-identity, icp-personas, products-services, market-competition, brand-system, constraints, assets, gtm-system, kpis, vision-strategy) and submodels (ICP, persona, product-item, kpis). Discovery is the **input funnel**; BIF is the **structured model**. |
| **RIE** (Research Intelligence Engine)                              | Discovery records **evidence sources** and **assumptions/gaps** as plain references. RIE later verifies/enriches those gaps. Discovery flags _what is unknown_; RIE is _how it gets researched_ (future slice). No coupling now.                                                                                                                                                                                                                                                                                                                    |
| **SIE** (Strategy Intelligence Engine)                              | Strictly downstream. SIE turns a stable business model into strategy. Discovery must **not** generate strategy — it only supplies the grounded context SIE later consumes.                                                                                                                                                                                                                                                                                                                                                                          |
| **BKG** (Business Knowledge Graph, `@age/business-knowledge-graph`) | Discovery output can later become nodes/edges in the knowledge graph. Conceptual, not built now.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Capability Architecture** (`@age/capability-kit`)                 | Provides `ClientContext`, `Capability`, `CapabilityOutput`, and the registry pattern. Discovery should follow the same pure-package conventions; a discovery→BIF/`ClientContext` mapping is the bridge to the capability world.                                                                                                                                                                                                                                                                                                                     |
| **Intelligence Capability**                                         | Consumes the normalized business context to produce grounded intelligence rather than generic output.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Market Discovery Capability**                                     | Uses ICP, offerings, geography, and competitors from Discovery to anchor market segments/opportunities.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Growth Capability**                                               | Uses goals + constraints from Discovery to shape realistic growth recommendations.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

**Direction of flow:** `Business Discovery answers → validated BusinessDiscoveryProfile →
mapped BIF-compatible business context → capabilities (Intelligence / Market Discovery / Growth …)`.
Discovery sits **upstream of BIF**; it never reaches into strategy, reporting, or execution.

## 4. Proposed First Implementation Scope

A small, safe first build slice — **pure, in-memory, read-only, no side effects**, mirroring the
existing `@age/*-contracts` package conventions:

- **`BusinessDiscoveryProfile`** domain type (the aggregate).
- **Onboarding questionnaire schema** — a static definition of discovery sections and questions.
- **Structured discovery sections** — grouping questions by BIF-aligned theme.
- **Validation rules** — Zod schemas + a pure validator that reports required-section completeness
  and missing critical fields (deterministic; input-derived).
- **Sample seeded profile** — one realistic in-memory fixture (no I/O).
- **Discovery → BIF-compatible context mapping** — a pure function producing a normalized business
  context object aligned to BIF concepts (no BIF mutation, no persistence).
- **Demo runner output** — the demo prints the captured/normalized business context from the sample
  profile, staying no-side-effect.

Refinement based on repo structure: BIF already models the business richly, so Discovery should
**not** duplicate BIF — it should own the _intake + validation + gap-analysis_ layer and a _thin
mapping_ to BIF, reusing BIF/`capability-kit` types where practical (e.g. ICP shape).

## 5. Explicit Non-Scope

Do **not** include in this slice (or its immediate follow-ups):

- Persistence / database of any kind.
- Login / auth.
- Client workspace.
- Multi-tenant system.
- Approval workflow.
- Execution workflow (dry-run or otherwise) / execution audit / platform-context.
- External integrations.
- AI/LLM calls.
- Scraping / URL fetching (evidence sources are plain reference strings only).
- Autonomous execution.
- SAGE concepts or infrastructure.
- Production onboarding UI.
- Payments.
- CRM / project-management features.

## 6. Suggested Package / Location

**Recommendation: a new pure package `@age/business-discovery-contracts`** under `packages/`,
following the established `@age/*-contracts` convention.

Options considered:

| Option                                                            | Assessment                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **New package `@age/business-discovery-contracts`** (recommended) | Matches existing convention exactly (`market-discovery-contracts`, `growth-contracts`, etc.): `type: module`, `main → ./src/index.ts`, Zod dependency, `@age/capability-kit`/`@age/bif` as workspace deps, `src/tests/*.spec.ts`. Keeps Discovery cohesive and independently testable; no coupling into apps. |
| Fold into an existing capability package                          | Wrong altitude — Discovery is upstream of _all_ capabilities, not one of them; embedding it in e.g. Market Discovery would misrepresent ownership.                                                                                                                                                            |
| `demo-runtime` extension                                          | `demo-runtime` is a demo harness/fixtures layer, not a domain home. Fine as a **consumer** (later slice) but not the owner of the domain model.                                                                                                                                                               |
| Shared `@age/types`                                               | Too generic; Discovery has real domain shape, validators, and mapping logic that deserve a dedicated package.                                                                                                                                                                                                 |

Justification: a dedicated contracts-style package is the smallest, most idiomatic home, keeps the
model pure and reusable, and lets `@age/bif` and the demo consume it without inverting dependencies.
**Do not create the package yet** — this is a recommendation for the first implementation PR.

## 7. Data Model Proposal (Pseudocode / Interfaces Only)

> Illustrative shapes for review — not committed code. Practical, not over-engineered. Readonly to
> match the codebase's immutability convention; Zod validators would accompany each in the real PR.

```ts
type DiscoverySectionId =
  | 'business-identity'
  | 'offerings'
  | 'customers-icp'
  | 'market-competition'
  | 'positioning-brand'
  | 'channels'
  | 'goals-constraints'
  | 'assets'
  | 'evidence-assumptions';

interface DiscoveryQuestion {
  readonly id: string;
  readonly sectionId: DiscoverySectionId;
  readonly prompt: string;
  readonly required: boolean;
  readonly kind: 'text' | 'longText' | 'list' | 'choice';
  readonly choices?: readonly string[]; // when kind === 'choice'
}

interface DiscoveryAnswer {
  readonly questionId: string;
  readonly value: string | readonly string[]; // shape matches the question kind
  readonly evidenceSourceIds?: readonly string[]; // references into evidence sources
}

interface DiscoverySection {
  readonly id: DiscoverySectionId;
  readonly name: string;
  readonly questions: readonly DiscoveryQuestion[];
  readonly answers: readonly DiscoveryAnswer[];
}

interface EvidenceSourceRef {
  readonly id: string;
  readonly label: string;
  readonly kind: 'client-statement' | 'document' | 'url'; // url is a plain string, never fetched
  readonly locator?: string;
}

interface CustomerSegment {
  // an ICP / target segment (aligns conceptually with @age/bif ICP)
  readonly id: string;
  readonly name: string;
  readonly industry?: string;
  readonly companySize?: string;
  readonly geography?: string;
  readonly description?: string;
}

interface Offering {
  readonly id: string;
  readonly name: string;
  readonly type: 'product' | 'service';
  readonly description?: string;
  readonly valueProposition?: string;
}

interface CompetitorReference {
  readonly id: string;
  readonly name: string;
  readonly note?: string; // categorical or named; no external lookup
}

interface BusinessGoal {
  readonly id: string;
  readonly statement: string;
  readonly horizon?: 'short' | 'medium' | 'long';
}

interface BusinessAssumption {
  readonly id: string;
  readonly statement: string;
  readonly confidence: 'low' | 'medium' | 'high';
}

interface DiscoveryGap {
  readonly id: string;
  readonly sectionId: DiscoverySectionId;
  readonly missing: string; // what critical information is absent
  readonly severity: 'info' | 'important' | 'critical';
}

interface BusinessDiscoveryProfile {
  readonly id: string;
  readonly businessName: string;
  readonly industry?: string;
  readonly businessModel?: string;
  readonly geographies: readonly string[];
  readonly marketingChannels: readonly string[];
  readonly brandPositioning?: string;

  readonly sections: readonly DiscoverySection[];
  readonly segments: readonly CustomerSegment[];
  readonly offerings: readonly Offering[];
  readonly competitors: readonly CompetitorReference[];
  readonly goals: readonly BusinessGoal[];
  readonly constraints: readonly string[];
  readonly assets: readonly string[];

  readonly evidenceSources: readonly EvidenceSourceRef[];
  readonly assumptions: readonly BusinessAssumption[];
  readonly gaps: readonly DiscoveryGap[];

  // input-derived timestamp (no wall-clock), matching existing deterministic conventions
  readonly capturedAt: string;
}
```

## 8. Demo Acceptance Criteria

The first real implementation PR should prove that it can:

- **Create a sample `BusinessDiscoveryProfile`** in memory from a seeded fixture.
- **Validate required sections** — deterministically report which required sections/questions are
  complete.
- **Identify missing critical information** — produce `DiscoveryGap[]` for absent critical fields.
- **Output a normalized business context object** — a pure transform of the profile.
- **Feed or map to existing BIF concepts** — the normalized context aligns to BIF sections/submodels
  (no BIF mutation, no persistence).
- **Remain no-side-effect** — no I/O, no network, no DB, no wall-clock nondeterminism.
- **Keep CI green** — `Lint, Typecheck, Test, Build` (+ demo smoke) all pass; new unit tests cover
  validation, gap analysis, and mapping.

## 9. Risks and Guardrails

| Risk                                                    | Guardrail                                                                                                                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Becoming a **generic form builder**                     | Anchor every section/question to a BIF-aligned business concept; the questionnaire schema is a fixed, curated set, not a runtime form-definition engine.                 |
| Overbuilding a **CRM / client workspace**               | Explicit non-scope (§5); no multi-record management, no lists of clients, no workspace state — a single in-memory profile per run.                                       |
| Adding **persistence too early**                        | Pure/in-memory only; no DB/repository/store in this slice. Persistence needs its own accepted ADR later.                                                                 |
| Mixing **discovery with strategy generation** too early | Discovery only captures, validates, and maps to BIF context. It must not produce strategy, recommendations, or intelligence — those stay in SIE/capabilities downstream. |
| Creating **UI before the domain model is clear**        | No Web in the first PRs; UI/API exposure is optional and last (PR 5), read-only only, after the model stabilizes.                                                        |
| **Reintroducing execution-governance drift**            | Hard non-scope: no approval workflow, execution audit, platform-context, dry-run preview, or Phase 5 execution. Reviews should reject any such addition.                 |
| Model **over-engineering**                              | Keep interfaces practical (§7); prefer plain readonly types + Zod over elaborate generics or frameworks.                                                                 |

## 10. Recommended Implementation Sequence (Small PRs)

> Each PR is small, pure, and independently reviewable; each keeps CI green and the demo
> no-side-effect. Each needs explicit authorization before it starts.

- **PR 1 — Business Discovery domain model.** New package `@age/business-discovery-contracts` with
  the §7 types + Zod schemas and unit tests. No API/Web/DB.
- **PR 2 — Questionnaire schema + validation.** Static discovery sections/questions + a pure
  validator (required-section completeness, gap detection) with tests.
- **PR 3 — Sample profile + BIF mapping.** One seeded fixture + a pure discovery→BIF-compatible
  context mapping function, with tests asserting the normalized output.
- **PR 4 — Demo runner integration.** `demo-runtime`/`apps/demo` prints the captured/normalized
  business context from the sample profile; smoke stays no-side-effect.
- **PR 5 (optional) — Read-only API/demo exposure.** A read-only endpoint/screen surfacing the
  sample normalized context, mirroring the existing `/demo` read-only pattern. Only if wanted.

## 11. Final Recommendation

**Exact first implementation PR to create after this plan is approved:**
**PR 1 — Business Discovery domain model** (new pure package `@age/business-discovery-contracts`).

**Expected files/packages to touch (PR 1 only):**

- `packages/business-discovery-contracts/package.json` (new; copy `@age/market-discovery-contracts`
  conventions — `type: module`, `main → ./src/index.ts`, Zod dep, `@age/capability-kit` and
  `@age/bif` as workspace deps as needed).
- `packages/business-discovery-contracts/tsconfig.json`, `vitest.config.ts` (new; copy conventions).
- `packages/business-discovery-contracts/src/index.ts` and per-type source files for the §7 model
  (types + Zod schemas), organized as many small files.
- `packages/business-discovery-contracts/src/tests/*.spec.ts` (new unit tests).
- `pnpm-lock.yaml` (regenerated by `pnpm install` for the new workspace package).

**Commands / tests to run (PR 1):**

- `pnpm install` (new package)
- `pnpm --filter @age/business-discovery-contracts test`
- `pnpm --filter @age/business-discovery-contracts typecheck`
- `pnpm --filter @age/business-discovery-contracts lint`
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`
- `pnpm --filter @age/api smoke:demo` (must remain green and no-side-effect)

**What must remain untouched:**

- The removed execution-governance work must **not** return (no approval workflow, execution audit
  persistence, platform-context, dry-run execution preview, Phase 5 execution).
- No persistence/DB, auth, client workspace, multi-tenant, external integrations, AI calls,
  scraping, autonomous execution, payments, or CRM/PM features.
- **SAGE** — untouched. **`develop`** — untouched.
- BIF is **consumed, not modified**; the demo stays read-only and no-side-effect.

---

**This document is planning-only.** No code, package, API, Web, DB, or ADR-status changes are made
here, and no implementation is started — pending approval of this plan before PR 1 is created.
