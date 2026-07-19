# AGE PR #41–#61 Revert Plan (Documentation Only)

> Status: Proposed — planning document only. No code, package, lockfile, API, Web, or ADR
> status changes are made by this document. No revert has been performed.

## 1. Decision Summary

- **AGE remains the Strategic Marketing Operating System** — an AI-powered platform for
  business growth, marketing strategy, market intelligence, business discovery, growth
  planning, reporting, and marketing execution.
- **SAGE (Software Architecture & Governance Engine) is a separate, future product**, tracked
  in its own repository (`awanish14/sage`), not a module or phase of AGE.
- **PR #41–#61 drifted from AGE's active product path.** Starting at PR #41, the work shifted
  from marketing-capability product development into generic software-engineering /
  execution-governance infrastructure (execution contracts, dry-run execution, audit
  persistence, human approval workflow, operator/tenant trusted context). This is valuable
  engineering work, but it is not part of AGE's current product surface as a Strategic
  Marketing Operating System.
- **Goal: restore AGE's active implementation focus to the PR #40 baseline** — the last point
  where every merged PR served AGE's actual marketing-capability product path.
- **SAGE may later reuse the concepts** demonstrated in PR #41–#61 (dry-run-before-effect,
  append-only audit, approval-gated mutation, trusted operator/tenant context, ADR-driven
  governance) — reimplemented against SAGE's own software-engineering domain model (specs,
  ADRs, PRs, commits, tests, releases). AGE-coupled code is not intended to be copied into SAGE.

This document only plans the cleanup. It does not perform it.

## 2. Baseline to Keep — PR #1–#40 (KEEP)

Everything merged through PR #40 is the correct AGE active baseline and is **not** in scope
for reversion. This baseline includes:

- **BIF** (Business Intelligence Foundation), **RIE** (Research Intelligence Engine), **SIE**
  (Strategy Intelligence Engine) — core marketing-intelligence engines.
- **Capability Architecture** (`@age/capability-kit` and the capability-module pattern).
- **Product Bible** and the frozen product specification set (`docs/product/*`).
- The six pure marketing capabilities: **Intelligence, Market Discovery, Growth, Authority,
  Operations, Revenue**.
- **Demo runner** (`apps/demo`, `pnpm demo`), **demo API** (`GET /demo/capabilities`), **demo
  Web screen** (`/demo`) — the three-way read-only capability demonstration track.
- **API runtime fix** — the webpack-based Nest build (`apps/api/webpack.config.js`, aligned
  `package.json` scripts and `project.json` nx targets) that makes the compiled API server boot.
- **CI smoke test** — `apps/api/scripts/smoke-demo.mjs` (`pnpm --filter @age/api smoke:demo`),
  run in CI after Build, verifying `GET /demo/capabilities` behavior.

Baseline merge commit: **PR #40** ("demo runtime smoke check + nx build-target alignment",
`967ae8d`). `main` at this commit is the target end-state for AGE's active product path.

## 3. PR #41–#61 Classification

| PR     | Title                                                                  | Purpose                                                                                                                                                     | Files / packages                                                                                                                                          | Depends on                                                                         | Revert?                      | Order                                      | Risk                                                                                                                                                                                                               | SAGE park note                                                                                                                         |
| ------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| **41** | Feat: add human-approved dry-run execution foundation                  | Introduces `@age/execution-contracts` (execution request/plan/result types, `ExecutionGuard`, `DryRunExecutor`, capability-output→intent mapper). ADR-0021. | New package `packages/execution-contracts/**`; `docs/adrs/0021-*`; `pnpm-lock.yaml`                                                                       | Depended on by #42, #44, #47, #52 (transitively)                                   | Yes                          | 5th (Group E)                              | Medium — foundational package, but pure/in-memory, no consumers outside this chain                                                                                                                                 | Park — dry-run-before-effect pattern is reusable, rebuild for SAGE's alignment-check semantics                                         |
| **42** | Feat: add dry-run execution preview to demo                            | Adds `packages/demo-runtime` execution-preview support consumed by `apps/demo` CLI runner                                                                   | `apps/demo/src/run.ts`; `packages/demo-runtime/**`; `pnpm-lock.yaml`                                                                                      | Depends on #41; feeds #44's API preview exposure                                   | Yes                          | 4th (Group E)                              | Medium — touches the demo runner CLI output, which #40's baseline behavior did not include                                                                                                                         | Discard — demo-runtime preview wiring is AGE-specific, not concept-worthy beyond #41                                                   |
| **43** | Docs: consolidate Phase 5 implementation status                        | Docs-only consolidation of Phase 5 status in `DEMO_RUN_GUIDE.md` and ADR-0021                                                                               | `docs/DEMO_RUN_GUIDE.md`; `docs/adrs/0021-*`                                                                                                              | Depends on #41/#42 narrative                                                       | Yes                          | 3rd (Group E)                              | Low — docs only                                                                                                                                                                                                    | Discard — status narrative, not a concept                                                                                              |
| **44** | Feat: expose dry-run execution preview read-only                       | Exposes preview via API demo service/DTO and Web `/demo` page; extends smoke script                                                                         | `apps/api/src/modules/demo/**`; `apps/api/scripts/smoke-demo.mjs`; `apps/web/src/app/demo/page.tsx`; `apps/web/src/lib/demo.ts`; `docs/DEMO_RUN_GUIDE.md` | Depends on #41/#42                                                                 | Yes                          | 2nd (Group E)                              | **High** — modifies the same `demo.service.ts`, smoke script, and `/demo` page that the PR #40 baseline depends on; reverting requires restoring pre-#44 versions of these exact files, not just deleting new ones | Park — read-only preview-exposure pattern is reusable for SAGE's "preview alignment impact" feature                                    |
| **45** | ADR: define execution audit persistence boundary                       | Proposes ADR-0022                                                                                                                                           | `docs/adrs/0022-*`                                                                                                                                        | None (docs)                                                                        | Yes                          | 1st (Group E, oldest doc pairing with #46) | Low — docs only                                                                                                                                                                                                    | Park — audit-persistence boundary concept, rebuild for SAGE's evidence/decision audit schema                                           |
| **46** | Docs: accept ADR-0022                                                  | Accepts ADR-0022                                                                                                                                            | `docs/adrs/0022-*`                                                                                                                                        | Depends on #45                                                                     | Yes                          | with #45                                   | Low — docs only                                                                                                                                                                                                    | Same as #45                                                                                                                            |
| **47** | Feat: add dry-run execution audit persistence foundation               | New package `packages/execution-audit-persistence` (in-memory repository, persisted-record types, factory)                                                  | `packages/execution-audit-persistence/**`; `pnpm-lock.yaml`                                                                                               | Depends on #41 (execution types); depended on by #48                               | Yes                          | 4th (Group D)                              | Medium — pure/in-memory package, no consumers outside #48/#49                                                                                                                                                      | Park — append-only audit-persistence pattern, rebuild for SAGE's Evidence Traceability capability                                      |
| **48** | Feat: add read-only execution audit history API                        | New API module `apps/api/src/modules/execution-audit/**`, registered in `apps/api/src/modules/index.ts`                                                     | `apps/api/src/modules/execution-audit/**`; `apps/api/src/modules/index.ts`; `apps/api/package.json`; `pnpm-lock.yaml`                                     | Depends on #47; depended on by #49                                                 | Yes                          | 3rd (Group D)                              | Medium — new route surface (`/execution-audit`), isolated module, but module registration in shared `modules/index.ts` must be cleanly removed                                                                     | Park — same as #47                                                                                                                     |
| **49** | Feat: add read-only execution audit history web view                   | New Web page `apps/web/src/app/execution-audit/**` and lib, `apps/web/vitest.config.ts`                                                                     | `apps/web/src/app/execution-audit/**`; `apps/web/src/lib/execution-audit.ts`; `apps/web/vitest.config.ts`; `docs/DEMO_RUN_GUIDE.md`                       | Depends on #48                                                                     | Yes                          | 2nd (Group D)                              | Low — additive Web route, no shared-file coupling beyond docs                                                                                                                                                      | Park — same as #47/#48                                                                                                                 |
| **50** | Docs: propose human approval workflow boundary                         | Proposes ADR-0023                                                                                                                                           | `docs/adrs/0023-*`                                                                                                                                        | None (docs)                                                                        | Yes                          | 1st (Group C, with #51)                    | Low — docs only                                                                                                                                                                                                    | Park — approval-gated mutation boundary concept                                                                                        |
| **51** | Docs: accept ADR-0023                                                  | Accepts ADR-0023                                                                                                                                            | `docs/adrs/0023-*`                                                                                                                                        | Depends on #50                                                                     | Yes                          | with #50                                   | Low — docs only                                                                                                                                                                                                    | Same as #50                                                                                                                            |
| **52** | feat(execution): add approval workflow foundation (ADR-0023 Slice D1)  | New package `packages/execution-approval-workflow` (approval decision factory, repository, status derivation)                                               | `packages/execution-approval-workflow/**`; `pnpm-lock.yaml`                                                                                               | Depends on #41 (execution types); depended on by #53                               | Yes                          | 5th (Group C)                              | Medium — pure/in-memory package                                                                                                                                                                                    | Park — decision/approval lifecycle pattern, rebuild for SAGE's spec/ADR approval gating                                                |
| **53** | feat(api): add approval workflow endpoints (ADR-0023 Slice D2)         | New API module `apps/api/src/modules/execution-approval/**`, registered in `modules/index.ts`                                                               | `apps/api/src/modules/execution-approval/**`; `apps/api/src/modules/index.ts`; `apps/api/package.json`; `pnpm-lock.yaml`                                  | Depends on #52; depended on by #54, #61                                            | Yes                          | 4th (Group C)                              | Medium — new route surface (`/execution-approval`), shared `modules/index.ts` edit to undo                                                                                                                         | Park — same as #52                                                                                                                     |
| **54** | feat(web): add approval workflow UI (ADR-0023 Slice D3)                | New Web page `apps/web/src/app/execution-approval/**` and lib                                                                                               | `apps/web/src/app/execution-approval/**`; `apps/web/src/lib/execution-approval.ts`                                                                        | Depends on #53                                                                     | Yes                          | 3rd (Group C)                              | Low — additive Web route, no shared-file coupling                                                                                                                                                                  | Park — same as #52/#53                                                                                                                 |
| **55** | docs: summarize Phase 5 human approval workflow completion             | Docs-only completion summary                                                                                                                                | `docs/05-implementation/PHASE_5_HUMAN_APPROVAL_WORKFLOW_COMPLETE.md`                                                                                      | Narrates #50–#54                                                                   | Yes                          | 2nd (Group C)                              | Low — docs only                                                                                                                                                                                                    | Discard — status narrative, not a concept                                                                                              |
| **56** | docs: propose ADR-0024 production operator and tenant context boundary | Proposes ADR-0024                                                                                                                                           | `docs/adrs/0024-*`                                                                                                                                        | None (docs)                                                                        | Yes                          | 1st (Group B, with #57)                    | Low — docs only                                                                                                                                                                                                    | Park — operator/tenant trusted-context boundary concept                                                                                |
| **57** | docs: accept ADR-0024                                                  | Accepts ADR-0024                                                                                                                                            | `docs/adrs/0024-*`                                                                                                                                        | Depends on #56                                                                     | Yes                          | with #56                                   | Low — docs only                                                                                                                                                                                                    | Same as #56                                                                                                                            |
| **58** | docs: record ADR-0020 default branch follow-up                         | Docs-only branch-governance follow-up note on the already-accepted ADR-0020                                                                                 | `docs/adrs/0020-*`                                                                                                                                        | None (docs); **ADR-0020 itself predates PR #41 and governs branch flow generally** | **No — evaluate separately** | n/a                                        | Low — docs only                                                                                                                                                                                                    | Not a SAGE-parking concept; branch-flow governance is process, not code. See note below.                                               |
| **59** | feat(platform): add operator tenant context foundation                 | New package `packages/platform-context` (operator/tenant/scope types and factories)                                                                         | `packages/platform-context/**`; `pnpm-lock.yaml`                                                                                                          | Depends on ADR-0024 (docs only); depended on by #60                                | Yes                          | 4th (Group A)                              | Medium — pure/in-memory package                                                                                                                                                                                    | Park — branded-ID / trusted-context bridging pattern, rebuild for SAGE's operator/reviewer identity model                              |
| **60** | feat(api): add trusted context request adapter                         | New API module glue `apps/api/src/modules/platform-context/**`                                                                                              | `apps/api/src/modules/platform-context/**`; `apps/api/package.json`; `pnpm-lock.yaml`                                                                     | Depends on #59; depended on by #61                                                 | Yes                          | 3rd (Group A)                              | Medium — no route surface (adapter only, unused until #61), but package dependency to unwind                                                                                                                       | Park — same as #59                                                                                                                     |
| **61** | feat(api): wire trusted context into approval workflow                 | Wires #60's adapter into `execution-approval.service.ts` (from #53)                                                                                         | `apps/api/src/modules/execution-approval/application/execution-approval.service.ts`; same test file                                                       | Depends on #59, #60, #53                                                           | Yes                          | 2nd (Group A)                              | Low — smallest, most recent change, cleanly isolated to one service file + its test                                                                                                                                | Park — trusted-context-into-approval wiring is the clearest end-to-end reference example for SAGE's future spec/decision-approval flow |

**Note on PR #58 / ADR-0020:** ADR-0020 ("branch flow governance") was originally accepted
_before_ PR #41 and governs AGE's branching/merge conventions in general — it is not
execution-governance infrastructure and is not part of the PR #41–#61 drift. PR #58 only adds a
follow-up note to that pre-existing, still-relevant ADR. **Recommendation: keep PR #58** (do not
revert) — evaluate its content on its own merits as ordinary branch-process documentation, separate
from this cleanup. It is listed here only because its PR number falls inside the #41–#61 range.

## 4. Revert Strategy

**Direction:** newest → oldest, grouped into small, independently reviewable PRs — never one
giant revert. Each group should be revertable and testable in isolation, and the groups
themselves should land newest-first so that later work (which depends on earlier work) is
removed before its dependencies, avoiding transient breakage within `main`.

| Group | PRs       | Concept                                                                           | Revert now, or inspect first?                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----- | --------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | #61 → #59 | Trusted context / platform-context / approval wiring                              | **Revert now.** Smallest, most self-contained, most recently merged, single-service-file blast radius for #61; #59/#60 are additive packages/modules with no consumers outside this chain once #61 is gone.                                                                                                                                                                                                                                                      |
| **B** | #58 → #56 | Branch-governance follow-up (#58, **keep — see note above**) + ADR-0024 (#56/#57) | **Inspect first, then partial revert.** #58 should be excluded from the revert (kept). #56/#57 (ADR-0024 propose/accept) are docs-only and safe to revert once Group A is gone, since Group A is the only code that implements ADR-0024.                                                                                                                                                                                                                         |
| **C** | #55 → #50 | Approval workflow docs/package/API/Web (ADR-0023)                                 | **Inspect first.** Must be reverted only after Group A, since Group A's #61 modifies a file introduced in this group (#53). Confirm no other consumer of `execution-approval-workflow` package exists before removing #52.                                                                                                                                                                                                                                       |
| **D** | #49 → #45 | Execution audit persistence docs/package/API/Web (ADR-0022)                       | **Inspect first.** Independent of Groups A–C (no cross-dependency found), but shares the same `apps/api/src/modules/index.ts` registration file as Group C — coordinate the two edits to that shared file to avoid a spurious merge conflict or accidental re-addition.                                                                                                                                                                                          |
| **E** | #44 → #41 | Dry-run execution foundation and preview                                          | **Inspect first — highest care needed.** #44 modifies `demo.service.ts`, `smoke-demo.mjs`, and `apps/web/src/app/demo/page.tsx`, which are shared with the PR #40 baseline. Reverting must restore these files to their **exact pre-#44 (PR #40 baseline) content**, not merely delete #44's additions, since the baseline demo/smoke behavior depends on them. This is the group most likely to require manual reconciliation rather than a clean `git revert`. |

**Recommended overall order:** Group A, then Group B (excluding #58), then Group C, then Group D,
then Group E — i.e., revert PR #61 first and PR #41 last, consistent with dependency direction.

## 5. Dependency Risks

- **Imports:** `execution-approval.service.ts` (Group C) imports from `@age/platform-context`
  via the Group A adapter — Group A must be fully reverted before Group C, or the import will
  dangle.
- **Package dependencies:** `apps/api/package.json` was edited in PR #48, #53, and #60 to add
  workspace dependencies (`@age/execution-audit-persistence`, `@age/execution-approval-workflow`,
  `@age/platform-context`). Each revert group must remove the corresponding dependency entry,
  not just the consuming code, or `pnpm install` will retain an orphaned workspace reference.
- **pnpm-lock.yaml:** every package-introducing PR (#41, #42, #47, #52, #59, #60) touched
  `pnpm-lock.yaml`. Per hard rules, **no lockfile changes happen in this planning task**, but the
  actual revert PRs will need a regenerated lockfile per group — this should be called out
  explicitly in each future revert PR's own plan.
- **Demo output expectations:** PR #40's baseline `pnpm demo` / `GET /demo/capabilities` output
  does not include execution-preview fields. PR #42/#44 added preview fields to that same output.
  Reverting Group E must restore the PR #40-shaped response, and any test/smoke assertions added
  after PR #40 that check for preview fields must be removed, not just left failing.
- **Smoke test expectations:** the current `smoke-demo.mjs` (`pnpm --filter @age/api smoke:demo`)
  asserts on 6 dry-run execution preview entries (introduced in #44). Reverting Group E requires
  restoring the PR #40-era smoke assertions (6 reports, 6 pending, accounting invariant, no
  `executionResult`) — the smoke script itself must be reverted to its #40 form, not merely
  patched.
- **Docs referencing Phase 5:** `docs/DEMO_RUN_GUIDE.md` was edited across #43/#44/#48/#49; the
  Phase 5 completion doc (#55) and the ADR files (#45/#46/#50/#51/#56/#57) all reference this
  drifted work. These should be either removed alongside their code or explicitly marked as
  historical/superseded (decision deferred to the future revert PRs, not this plan).
- **API/Web routes:** `/execution-audit` (API + Web, Groups D) and `/execution-approval` (API +
  Web, Groups C) are routes that do not exist in the PR #40 baseline. Removing them changes the
  API's route surface and the Web app's page set — this is an intentional, in-scope consequence
  of restoring the PR #40 baseline, not an accidental regression, but should be called out
  explicitly to anyone consuming these routes today.
- **Tests relying on execution preview or approval workflow:** `demo.spec.ts` (API), the demo-
  runtime preview spec, `execution-audit.spec.ts`, `execution-approval.spec.ts`, and
  `trusted-context-request-adapter.spec.ts` all test functionality introduced after PR #40 and
  must be removed (not merely left failing) as part of their corresponding revert group.

## 6. SAGE Parking Note

- **No SAGE implementation now.** No SAGE repository scaffolding, no SAGE code, no SAGE
  documents are created by this plan or its eventual revert PRs.
- **No SAGE repo changes of any kind** result from this AGE cleanup — SAGE's repository is not
  touched, referenced commits are not pushed there, and no cross-repo automation is set up.
- SAGE should **later** rebuild the concepts identified above (Section 3, "SAGE park note"
  column) **cleanly, using software-engineering semantics** — specs, ADRs, PRs, commits, tests,
  releases, architecture drift — rather than AGE's marketing-execution domain vocabulary
  (capability outputs, execution intents, dry-run marketing execution).
- **AGE code must not be copy-pasted blindly into SAGE.** Every "Park" entry in Section 3
  identifies a _pattern_ (dry-run-before-effect, append-only audit, approval-gated mutation,
  trusted operator/tenant context, ADR-driven governance) to be reimplemented against SAGE's own
  entity model, not a package to fork.

## 7. Final Recommendation

**Exact revert PR sequence recommended** (newest to oldest, by group):

1. Revert PR #61 (trusted context wired into approval service)
2. Revert PR #60 (API trusted-context request adapter)
3. Revert PR #59 (`@age/platform-context` package)
4. Revert PR #57 + #56 (ADR-0024 accept + propose docs) — **excluding #58, which is kept**
5. Revert PR #55 (Phase 5 approval completion doc)
6. Revert PR #54 (approval workflow Web UI)
7. Revert PR #53 (approval workflow API endpoints)
8. Revert PR #52 (`@age/execution-approval-workflow` package)
9. Revert PR #51 + #50 (ADR-0023 accept + propose docs)
10. Revert PR #49 (execution audit Web view)
11. Revert PR #48 (execution audit API)
12. Revert PR #47 (`@age/execution-audit-persistence` package)
13. Revert PR #46 + #45 (ADR-0022 accept + propose docs)
14. Revert PR #44 (read-only execution preview exposure — **highest care, shared-file
    reconciliation required**)
15. Revert PR #43 (Phase 5 status consolidation docs)
16. Revert PR #42 (dry-run execution preview in demo runner)
17. Revert PR #41 (`@age/execution-contracts` package and ADR-0021)

**First revert PR to create after this plan is approved:** the Group A revert covering PR
#61 → #59 (steps 1–3 above), since it is the smallest, most self-contained, and carries the
lowest risk of shared-file reconciliation.

**Files/packages expected to be touched in that first revert PR:**

- `apps/api/src/modules/execution-approval/application/execution-approval.service.ts` (restore
  to its pre-#61 form)
- `apps/api/src/modules/execution-approval/tests/execution-approval.spec.ts` (restore to its
  pre-#61 form)
- `apps/api/src/modules/platform-context/**` (remove entirely — introduced in #60)
- `apps/api/package.json` (remove `@age/platform-context` dependency, added in #60)
- `packages/platform-context/**` (remove entirely — introduced in #59)
- `pnpm-lock.yaml` (regenerate after the above package/dependency removals)

**Tests to run after each revert PR:**

- `nx run api:test`, `nx run api:typecheck`, `nx run api:lint` (and equivalent targets for any
  package removed in that group, until the package itself is deleted)
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` (root, all projects)
- `pnpm --filter @age/api smoke:demo`
- For Group E specifically: `pnpm demo` (CLI), manual verification that `GET
/demo/capabilities` and `/demo` match the pre-#41 (PR #40 baseline) shape exactly

No code, package, lockfile, API, Web, or ADR-status changes are made by this document. This is a
plan only, pending approval before any revert PR is created.
