# AGE — Working conventions, non-negotiable semantics and repo facts

> **Extracted VERBATIM from `CLAUDE.md` §4/§5/§7/§8 on 2026-08-17**, when `CLAUDE.md` was rewritten
> into a compact operating constitution. Nothing here was summarised on the way out.
>
> ⚠️ **This is the TRACKED home for the engineering detail every session needs but does not need to
> hold in context at all times.** `CLAUDE.md` points here; read it before touching a package, before
> committing, and before running gates.
>
> 🚫 **This file carries NO client names, NO credentials and NO local operator paths** — that is why
> it can be committed, and it must stay that way. Anything that would carry one belongs in the
> untracked `docs/AGE_STANDING_CONTEXT.md` or `docs/PROJECT_STATUS_HANDOFF.md` instead.

---

## 1. Architecture on `main` — the six facts most often needed to avoid an active mistake

> **The full architecture is [`AGE_ARCHITECTURE_ON_MAIN.md`](AGE_ARCHITECTURE_ON_MAIN.md)
> (§4.1–§4.5).** Sub-numbering is load-bearing (§4.2 = capture orchestration, §4.3 = persistence &
> RLS) — keep the numbers, and keep the doc in step with `main`. **Read it before touching any
> package.** The six below are _not_ a summary of the architecture.

- **`produceScoredBifContext(profile, options)` is the ONLY Discovery→BIF mapping in the repo.**
  `@age/bif` is **consumed, never modified**; capability packages must **never** import it.
- **The D6 capture chain order is load-bearing** — 🚫 do not reorder or collapse it.
- **`apps/capture` is three modules with three responsibilities — 🚫 do not merge them.** Decisions
  (`capture-runner.ts`, pure over `argv` + an injected runtime) · the chain and **the only production
  `new PrismaClient(`** (`capture-composition.ts`, behind the separate export path
  `@age/capture/composition`) · every **effect** (`main.ts`).
- **Snapshots are immutable append-only.** 🚫 No `update`, `delete` or `upsert` anywhere; no
  `updatedAt`/`version`/`deletedAt`/`current`; `GRANT SELECT, INSERT` only. Stored rows are
  **untrusted input**, re-validated on read via `normalizeScoredBifSnapshotRecord`.
- **RLS `FORCE`s and fails closed** — ⚠️ but it is a **coherence** constraint, **NOT** an
  authorization boundary (ADR-0046 D5). 🚫 Never describe it as one.
- **The codec round-trips the `ScoredBifContext` projection, NOT the live BIF**, and there is
  deliberately **no context → BIF direction** — restoring one would mean **inventing history**.
- **Six pure capabilities**; three expose ADR-0027 readiness as a **separate named entry point** —
  🚫 never a gate on `run`. ⚠️ `output.items` is **NOT** permanently empty: **check content, never
  length**, and render "ran, produced nothing" differently from "did not run".

---

## 2. Non-negotiable semantics

- `discoveryCompletenessScore` = intake capture completeness · `bif.completenessScore` = BIF
  population completeness. **Never interchangeable.**
- `discoveryConfidenceScore` is **not** BIF confidence and must never be copied into it.
- Partial `Draft` BIFs **omit** sections; **never placeholder-fill**. Absence is never a conclusion.
- Missing sections are **limitations, never negative evidence** (ADR-0026 D4).
- `sufficiency` omitted stays `undefined` — **never default it to `ready`.**
- Scope comes from `ClientContext`, **never inferred from the BIF payload**.
- Snapshots are **immutable append-only**: no `update`, no `delete`, no `upsert`, anywhere.
- Stored rows are **untrusted input** — re-validated on read via `normalizeScoredBifSnapshotRecord`.

---

## 3. Working conventions

- **Branch from latest `origin/main`**; merge via `gh pr merge <n> --merge --delete-branch`.
- **Report and stop each step.** Merge only after the gates are verified. **Never bypass the
  green-CI gate.** Green = a job that **executed its steps**, not merely a non-failure. A
  path-gated workflow that correctly did not trigger is expected, **not** a skipped gate.
- **Stage explicitly — never `git add -A`.** Never commit `CLAUDE.md`,
  `docs/PROJECT_STATUS_HANDOFF.md`, `docs/superpowers/`, `docs/AGE_STANDING_CONTEXT.md`.
- A husky/lint-staged hook reformats staged files on commit — **re-run package tests/typecheck after
  committing.**
- Commit messages via `git commit -F <file>` (Bash tool is Git Bash; PowerShell here-strings corrupt
  subjects). PR bodies via `--body-file` — inline heredocs in the Bash tool fail.
- Per-touched-file `prettier --write` then `--check`.
- **Gates before committing code:** package test/typecheck/lint, then `pnpm lint`, `pnpm typecheck`,
  `pnpm test`, `pnpm build`, `pnpm demo`, `pnpm --filter @age/api test`,
  `pnpm --filter @age/api smoke:demo`.
- **Demo baseline that must stay byte-identical:** 6 capabilities, 6 pending approvals, accounting
  invariant OK, no side effects, **7 populated + 5 omitted** canonical sections. Since #162 also
  **98/63 intake vs 12/17 BIF** — four scores, never combined (⚠️ 97 until #202). ⚠️ These are the
  five/six _facts_; the printed text around them may change (#162 added a discovery block and
  regenerated `apps/demo/sample-output.txt`, which was stale). Regenerate that file whenever the CLI
  print changes, and **keep its trailing `createdAt` determinism note** — a plain redirect drops it.
  ⚠️ Regenerate **bounded by the CLI's first and last `####` banner lines**: `pnpm demo > file`
  also captures pnpm's and Nx's wrapper output, which is not the CLI's.
- CI jobs: `Lint, Typecheck, Test, Build` (+ `API demo runtime smoke`) in `ci.yml`;
  `Migration and live PostgreSQL tests` in the path-gated `ci-db.yml`.
  API port 4000, web 3000, smoke 4010.
- **Do not manually rerun CI.** Rely on the automatic PR run and the post-merge `main` run.
- ⚠️ **ALWAYS match a post-merge run to its `head_sha`, never to "the newest success"**, with the
  **FULL** SHA — a short SHA returns `total_count: 0`, which looks exactly like an outage.
  🚫 **0 steps is not a gate.** A billing block looks EXACTLY like a test failure but executes
  0 steps in <~10s: `gh api .../jobs -q '[.steps[]?]|length'`.
- ⚠️ Any slice touching **import topology** runs `npx nx run-many -t test --skip-nx-cache`
  (🚫 `pnpm test --skip-nx-cache` is rejected by pnpm — the flag never reaches Nx).
  🛑 **A CACHED GATE IS NOT A GATE.**
- ⚠️ In this environment `vitest` must be run with **`--maxWorkers=2`**.

---

## 4. Repo quick facts

- Monorepo: **Nx + pnpm workspaces** (`apps/*`, `packages/*`, `packages/capabilities/*`), Node 22, TS.
  Canonical path **`awanishk14/AGE`** (`awanish14/AGE` redirects — 🚫 not used). Windows dev shell.
  ⚠️ This CLI is **`awanish14`, a collaborator, NOT owner `awanishk14`** — push + merge yes, admin no.
- Default branch **`main`**; `develop` is stale — 🚫 do not use or touch. 🚫 **Never touch SAGE.**
  🚫 **PR #26 is OPEN and OUT OF SCOPE** — do not touch, close, merge, rebase or inspect it.
- **`@age/*` packages are TS-source ESM** (`main → src/index.ts`, `type: module`, extensionless
  imports) — for bundler/vitest consumption, **not raw Node**. `tsx` is **not** installed; to run
  ad-hoc TS use a temporary vitest spec and delete it (never commit it).
- Demo track (`pnpm demo`, `GET /demo/capabilities`, web `/demo`) is **read-only**.
  `packages/demo-runtime/src/demo-scenario-metadata.ts` holds `DEMO_SCENARIO_METADATA` (frozen, fixed
  `constructedAt` 2026-01-01 — **never `new Date()`**).
- ⚠️ **`jsdom` IS installed and web/studio component tests DO run** (ADR-0048 D4 fixed it; the old
  "wants `jsdom`, not installed" note was stale). `apps/web` also has Playwright e2e.
  🚫 `--passWithNoTests` is deliberately NOT restored in either app.
- **Purity guard pattern** — read the module source and assert it contains no `new Date(` /
  `Date.now(` / `Math.random(` / `performance.now(` / `fetch(` / `node:fs` / `process.env` /
  `@prisma/client` / `@age/persistence` / `localStorage`. Copy it for any new deterministic module.
  ⚠️ **Absence-of-effects alone is not enough** — assert effects live in **exactly one** named
  module, or a second module quietly grows its own clock and the guard still passes.
- **Guard-test pattern** — any walk-the-repo guard must **first assert the walk finds files**, so an
  empty scan can never report compliance. ⚠️ Same rule for **string** scans: count what was examined
  and assert the count (**after** the loop when the per-case count is not uniform). ⚠️ And **strip
  comments before scanning source for a banned token**, or a file's own explanation of the rule
  matches it. ⚠️ A guard is only evidence once you have **made it fail**.
- ⚠️ `pnpm --filter <pkg> test` occasionally fails with "The system cannot execute the specified
  program" (environment glitch). Workaround: `cd` into the package and run `npx vitest run`.
  Repo-level `pnpm test` is unaffected.
- ⚠️ **Compose validates EVERY service in a file, not only the one being run.** ⚠️ `docker compose
run` **consumes stdin** — inside an ssh heredoc it swallows the rest of the script; use
  `run --rm -T … < /dev/null`. ⚠️ Shell scripts are **LF** (`.gitattributes`): dash treats a
  trailing `\r` as part of the token.
- ⚠️ `--changed-by` must look like **`operator:<handle>`** (ADR-0053 D4) — a bare label is refused.

---

## 5. Where the rest lives

| Material                                                           | Document                                                                               |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Full architecture on `main` (§4.1–§4.5)                            | [`AGE_ARCHITECTURE_ON_MAIN.md`](AGE_ARCHITECTURE_ON_MAIN.md)                           |
| The shipped refusals — twelve blocks, read before undoing anything | [`AGE_SHIPPED_REFUSALS.md`](AGE_SHIPPED_REFUSALS.md)                                   |
| Architect findings (append only, never renumber)                   | [`AGE_ARCHITECT_FINDINGS.md`](AGE_ARCHITECT_FINDINGS.md)                               |
| Standing residuals + the gate table                                | [`AGE_STANDING_RESIDUALS.md`](AGE_STANDING_RESIDUALS.md)                               |
| Per-track checkpoints (ADR-0055/0068/0069/0070/0071/0074/0078)     | `docs/reviews/ADR00*_CHECKPOINT.md`                                                    |
| Public-exposure security baseline (§6 is APPEND-ONLY)              | [`AGE_PUBLIC_EXPOSURE_SECURITY_BASELINE.md`](AGE_PUBLIC_EXPOSURE_SECURITY_BASELINE.md) |
| Older milestones / the reverted Phase 5 track                      | [`MILESTONE_HISTORY.md`](MILESTONE_HISTORY.md), `AGE_PR41_61_REVERT_PLAN.md`           |
