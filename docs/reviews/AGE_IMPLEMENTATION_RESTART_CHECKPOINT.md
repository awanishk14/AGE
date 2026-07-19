# AGE Implementation Restart Checkpoint (Documentation Only)

> Status: Informational checkpoint. This document makes **no** code, package, API, Web, DB,
> ADR-status, or SAGE changes. It records the canonical post-cleanup state of AGE and recommends
> the next implementation slice. It does not start implementation.

## 1. Current Canonical Repo State

- **`main` HEAD:** `ce7a8165ee34cfc9bde32271ea74d4f0338f27eb`.
- **PR #41–#61 cleanup: COMPLETE.** The execution-governance drift introduced across PR #41–#61
  has been fully reverted through three merged PRs:
  - **PR #62** — documentation-only revert plan (`docs/reviews/AGE_PR41_61_REVERT_PLAN.md`).
  - **PR #63** — reverted **Group A** (platform trusted-context work: PR #61, #60, #59).
  - **PR #64** — reverted the remaining execution-governance drift (PR #57 → #41, **excluding
    PR #58**).
- **AGE restored to the PR #40 active product path.** The last baseline where every merged PR
  served AGE's marketing-capability product path is once again the live state of `main`.
- **Kept intentionally:** PR #1–#40 (baseline), **PR #58** (ADR-0020 branch-flow governance
  follow-up), **PR #62** (this cleanup's revert plan), **PR #63** (Group A revert).
- **CI: green.** The post-merge `main` run of `Lint, Typecheck, Test, Build` (plus the API demo
  runtime smoke check) is passing on `ce7a816`. Local verification at cleanup time: `pnpm lint`,
  `pnpm typecheck`, `pnpm test`, `pnpm build` all green across 28 projects; `pnpm --filter @age/api
smoke:demo` reports 6 capabilities, 6 pending approvals, accounting invariant true, and **no side
  effects** (the PR #40 baseline shape — no dry-run execution preview entries).

## 2. Product Identity

**AGE is an AI-powered Strategic Marketing Operating System.**

AGE focuses on:

- **Business understanding** — modeling the client's business, offer, and positioning.
- **Evidence-based research** — grounding every insight in captured, traceable evidence.
- **Market intelligence** — understanding the market, its segments, and its dynamics.
- **Customer intelligence** — understanding the ideal customer and buyer behavior.
- **Competitor intelligence** — understanding the competitive landscape.
- **Growth strategy** — turning intelligence into a prioritized growth plan.
- **Capability planning** — mapping strategy onto AGE's marketing capabilities.
- **Reporting** — communicating findings and recommendations clearly.
- **Marketing execution later** — only **after** core intelligence is stable, and only within
  AGE's established human-in-the-loop, no-real-side-effects safety boundary.

AGE is **not** SAGE. SAGE (Software Architecture & Governance Engine) is a separate, future,
**parked** product idea and must not be touched from AGE work.

## 3. Explicit Non-Scope Right Now

Do **not** build any of the following as part of AGE implementation now. These were removed by the
PR #41–#61 cleanup and are explicitly out of scope:

- Execution **approval workflow** (package / API / Web).
- Execution **audit persistence** (package / API / Web).
- **Operator / tenant trusted context** (`platform-context` and adapters).
- **Autonomous execution** — remains out of scope per Docs 09/12/15 and the roadmap.
- **Dry-run execution preview** (execution-contracts foundation, demo/API/Web/smoke exposure).
- **Software-engineering governance** semantics (specs/ADRs/PRs/commits-as-product-domain).
- Any **SAGE-related infrastructure**, scaffolding, docs, or repo interaction.

Do not restart execution-governance work, do not recreate any of the above, and do not create new
Phase 5 execution work.

## 4. Valid Current Baseline (Keep and Continue From)

The following are the correct AGE baseline and are present and green on `main`. New work should
build **on** these, not replace them:

- **BIF** — Business Intelligence Foundation (`packages/bif`).
- **RIE** — Research Intelligence Engine (`packages/research-intelligence-engine`).
- **SIE** — Strategy Intelligence Engine (`packages/strategy-intelligence-engine`).
- **Capability Architecture** — `@age/capability-kit` and the capability-module pattern.
- **Product Bible** and the frozen product specification set (`docs/product/*`).
- **Six pure marketing capabilities** (`packages/capabilities/*`):
  - **Intelligence Capability**
  - **Market Discovery Capability**
  - **Growth Capability**
  - **Authority Capability**
  - **Operations Capability**
  - **Revenue Capability**
- **Demo runner** (`apps/demo`, `pnpm demo`).
- **Demo API** (`GET /demo/capabilities`).
- **Demo Web screen** (`/demo`).
- **API runtime fix** — the webpack-based Nest build that makes the compiled API server boot.
- **CI smoke test** — `apps/api/scripts/smoke-demo.mjs` (`pnpm --filter @age/api smoke:demo`), run
  in CI after Build.

Safety boundary still holds: read-only demo, no real side effects, no external APIs, no DB/Redis
writes, no queues/events, human-in-the-loop, autonomous execution out of scope.

## 5. Recommended Next AGE Implementation Direction

> This section **recommends** a next slice. It does **not** implement it. Any chosen slice must
> follow AGE's existing conventions: pure/in-memory first, spec-driven, capability-kit-based,
> read-only demo surface, no real side effects.

### Option evaluation

| Option                                     | Why it fits AGE                                                                                                                                                                                                                                                                 | Depends on existing capabilities?                                                                                                      | Fast product value?                                                                                                                 | Implementation risk                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Business Discovery / Client Onboarding** | It is the natural **front door** of a Strategic Marketing Operating System — it captures the business understanding that every downstream capability (Intelligence, Market Discovery, Growth) consumes. Directly serves "business understanding" and "evidence-based research." | Feeds and is consumed by BIF and the Intelligence Capability; builds on `capability-kit`. Does not require any removed execution work. | **High** — produces a tangible, demoable client-intake → structured-business-profile flow that makes the rest of the demo concrete. | **Low** — pure, in-memory, input-derived; mirrors existing capability patterns; no new infra, no side effects. |
| **Market Opportunity Intelligence**        | Deepens the Market Discovery Capability with segment/opportunity scoring — squarely "market intelligence."                                                                                                                                                                      | Depends on Market Discovery + BIF evidence; weaker without a solid business profile to anchor segments.                                | Medium — valuable but abstract without onboarding-captured business context.                                                        | Medium — scoring/prioritization logic invites scope creep and modeling debates.                                |
| **Website Intelligence**                   | Adds competitor/authority signal from a site — supports "competitor intelligence."                                                                                                                                                                                              | Would naturally want real fetching/scraping to be useful; only a fixture-based version is in-boundary.                                 | Low–Medium — a fixtures-only version demos weakly; the valuable version needs external I/O.                                         | **High** — strong pull toward external APIs / side effects, which are out of boundary.                         |
| **Reporting Intelligence**                 | Packages existing capability outputs into client-ready reporting — supports "reporting."                                                                                                                                                                                        | Depends on having richer upstream outputs to report on; thin until onboarding + intelligence deepen.                                   | Medium — nice demo polish, but reports what already exists rather than adding new intelligence.                                     | Low–Medium — presentation layer; low technical risk but low marginal insight now.                              |
| **Growth Planning**                        | Turns intelligence into a prioritized plan — serves "growth strategy" and "capability planning."                                                                                                                                                                                | Depends heavily on strong Intelligence + Market Discovery + business profile; premature before onboarding stabilizes inputs.           | Medium — high-value eventually, but its quality is bounded by the quality of its inputs.                                            | Medium–High — planning heuristics are opinion-heavy and hard to validate deterministically now.                |
| **Client Workspace / Agency Workflow**     | Multi-client/agency workflow surface — supports operational use.                                                                                                                                                                                                                | Implies persistence, multi-tenant state, and workflow orchestration.                                                                   | Low right now — infrastructure-heavy, little immediate intelligence value.                                                          | **High** — pulls toward DB/tenant/state work that resembles the just-removed drift; boundary risk.             |

### Recommendation — exactly one next slice

**Recommended next slice: Business Discovery / Client Onboarding.**

Rationale:

- It is the **upstream input** every other AGE capability depends on, so it multiplies the value of
  the existing baseline rather than competing with it.
- It fits cleanly inside the current safety boundary: **pure, in-memory, input-derived,
  deterministic**, read-only demo surface — the same pattern as the six shipped capabilities.
- It delivers **fast, visible product value**: a client-intake → structured-business-profile flow
  makes the existing demo end-to-end and concrete.
- It carries the **lowest implementation risk** and, critically, **no pull toward the removed
  execution-governance work** (no approval, no audit persistence, no trusted context, no execution
  preview, no autonomy).

Deprioritize Website Intelligence and Client Workspace / Agency Workflow for now — both pull toward
external I/O, persistence, or multi-tenant state, which sit outside the current boundary and risk
re-introducing drift.

**Do not implement this slice from this document.** When implementation is authorized, follow the
spec-driven workflow: read the frozen specs first, and if an architectural decision is missing,
stop and draft an ADR (`Status: Proposed`) rather than silently reinterpreting.

## 6. Hard Rules (Observed by This Document)

- **Documentation-only.** No code, package, API, Web, DB, ADR-status, or SAGE changes are made
  here.
- No new architecture and no implementation is added.
- `develop` is not touched.
- SAGE is not touched.
- Implementation is not started — this checkpoint only records state and recommends direction,
  pending explicit authorization.
