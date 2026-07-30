# ADR-0046 D3 — the demo-surface track

Checkpoint record for the three slices ADR-0046 D3 authorized after the capture track was parked.
One section per merged PR. History lives here, not in the untracked handover.

> The capture track's own record is `ADR0043_CAPTURE_CLI_TRACK_CHECKPOINT.md`. This file starts where
> that one stops: ADR-0046 D2 found that ADR-0045 D6's "the authorization set is empty" described a
> _track_, not the product, and named three gaps gated by nothing.

---

## §1 — Slice 1: the demo BIF surface (PR #162)

**Gap closed: G2.** The scored BIF was terminal-only. `DemoService.getCapabilityDemo()` called only
`runAllCapabilities()`, `CapabilityDemoResponse` carried no discovery or BIF field, and the web
`/demo` page therefore showed six capabilities with no sign that a Business Discovery → scored BIF
pipeline existed. `pnpm demo` was the single surface that ran it.

### What was actually wrong — and the trap in the slice as written

ADR-0046 D3 described slice 1 as "surface the Business Discovery / BIF **scoring** summary", and the
handover recorded that `runBusinessDiscoveryIntake` "already returns a ready-made summary". Both were
true, and together they were misleading: **`BusinessDiscoveryIntakeSummary` contained no score.** It
reported section types and profile counters only. Piping that existing shape through the API and the
web page would have satisfied the slice's letter while leaving out the numbers the slice exists for.

The fix was five read-through fields, not a new computation:

| Field                        | Read from           | Means                                                      |
| ---------------------------- | ------------------- | ---------------------------------------------------------- |
| `discoveryCompletenessScore` | `mappingMetadata`   | how completely the **interview** was captured              |
| `discoveryConfidenceScore`   | `mappingMetadata`   | how well-sourced the interview was                         |
| `bifCompletenessScore`       | projected `context` | what proportion of the canonical BIF is populated          |
| `bifConfidenceScore`         | projected `context` | trust in the produced intelligence                         |
| `bifStatus`                  | projected `context` | always `Draft` — surfaced so it can be _seen_, not trusted |

All five were already produced by `produceScoredBifContext` and then discarded. A test asserts the
summary equals the mapper's own values, so the demo can never grow a score of its own.

### The invariant this slice protects

The honesty proof is **97/63 intake vs 12/17 BIF**: a thoroughly captured interview still yields a
sparse Draft BIF, because discovery covers only part of the BIF surface. It is pinned in **three**
places — the runtime spec, the API spec and the HTTP smoke script — and each also asserts the pairs
are _distinct measurements rather than copies of each other_.

⚠️ **Never combine the two pairs into one headline number, and never surface only the intake pair.**
Either move reads as a strong result while the produced BIF is sparse. That is the exact failure mode
§5's "never interchangeable" rule exists to prevent, and before this slice the demo committed the
second half of it by omission.

### Boundaries held

- Discovery stays outside the approval model on all three surfaces: no decision objects, no
  `pendingApproval`, no change to the six-capability accounting.
- Omitted sections render as **neutral limitations of the intake** on the web page — not warnings,
  not evidence about the business (ADR-0026 D4).
- The API projects the runtime summary **field by field, not by spread**: the runtime is free to grow
  fields the read-only endpoint has not decided to expose, and a spread would publish them silently.
- Demo baseline facts unchanged: 6 capabilities, 6 pending approvals, accounting invariant OK, no
  side effects, 7 populated / 5 omitted sections.

### Incidental repairs

- `apps/demo/sample-output.txt` was **stale** — it predated the discovery stage entirely. Regenerated.
  ⚠️ A plain `> sample-output.txt` redirect drops the file's hand-written trailing note about
  `createdAt` being the only non-deterministic field. Re-append it after every regeneration.
- The CLI's closing line claimed discovery does "no scoring". Untrue under canonical Path B, which
  scores everything it maps. Corrected to say the scores are _reported, never acted on_.

### Changed files

`packages/demo-runtime` (`business-discovery.ts` + spec) · `apps/demo` (`run.ts`, spec,
`sample-output.txt`) · `apps/api` (demo DTO, service, spec, README, `scripts/smoke-demo.mjs`) ·
`apps/web` (`lib/demo.ts`, `app/demo/page.tsx`) · `docs/DEMO_RUN_GUIDE.md`.

---

## §2 — Slice 2a: the capture connection identity (PR #164)

**ADR-0046 D4, discharged.** `openPrismaCaptureConnection` constructed a bare `PrismaClient`, which
resolves `DATABASE_URL` through the schema's `datasource` block. Repo-wide that is the **owner**
connection — `ci-db.yml` creates the non-owner application role under a separate `DATABASE_URL_APP`
— and `DATABASE_URL_APP` was named nowhere in `apps/capture`. The one production chain that exists
to write correctly-scoped rows asserted nothing about the role it would write them as.

### Why it matters exactly as much as it does — and no more

Connecting as the owner does not merely weaken the row-level policies: **they stop applying**, and
the single mechanism that makes a mis-scoped `INSERT` impossible is gone.

⚠️ Stated precisely against the stronger phrasing, because both halves must survive summarizing:
RLS here is a **coherence** constraint, not an authorization boundary (ADR-0046 D5). Even as
`age_app` it buys **zero** isolation between two tenants on the same role against a caller that
simply declares the other's id. Neither half is a reason to have left the defect in place, and the
fix must never be described as having closed the tenancy gap.

⚠️ Also carried forward: the superuser property was **CI's service container**, not a proven
deployment fact. The old defect must never be restated as "capture ran as superuser".

### The shape of the fix

- `capture-connection-target.ts` is **pure** — `resolveCaptureDatasourceUrl(environment)` takes an
  environment and reads none, so every branch is testable without mutating `process.env`.
- **Fails closed.** A missing `DATABASE_URL_APP` is an error, never a fallback: a CLI that quietly
  downgrades to the owner connection when its application credentials are missing loses the guard on
  precisely the run that had lost it. A `DATABASE_URL_APP` that merely _equals_ `DATABASE_URL` is
  refused too — that satisfies the variable while discarding the guarantee.
- The refusal happens **above `new PrismaClient(`**, so a misconfigured environment opens no
  connection at all.
- **No credential ever reaches an error message.** Errors name the variables, never their values.
  Pinned by a test.
- Two new purity clauses: `process.env` has **exactly one owner** (the composition root), and the
  root may not contain a `DATABASE_URL` literal — it wires, it does not choose.
- `datasourceUrl` still overrides everything, so `capture-cli.db.spec.ts` keeps pointing this same
  root at `age_app` (ADR-0043 D8). `CI (live database)` triggered and passed, which is the real proof.

⚠️ ADR-0043's text says "the CLI reads `DATABASE_URL`" (§307, D8). That is now **historical**;
ADR-0046 D4 authorized the change. Do not "restore" it, and do not add a default for convenience.

---

## §3 — Slice 2b: `age-capture` is not merely uninvoked, it is not executable (PR #166)

Split out of slice 2 once the cause was understood, because it is a different risk surface.

`bin` points at `dist/main.js`, and **`node dist/main.js` fails with `ERR_MODULE_NOT_FOUND`**: `tsc`
emits the repo's extensionless imports verbatim, and every `@age/*` dependency is bundler-targeted
TypeScript **source**. No arrangement of `tsc` fixes this — the CLI has never been runnable by
anyone, which sharpens (and does not contradict) the standing "capture has never executed" residual.

**The repo already answers this.** `apps/api` bundles with webpack + `ts-loader` +
`webpack-node-externals` (allowlist `/^@age\//`), and `apps/api/webpack.config.js` states this exact
reasoning in its header. Slice 2b copies that precedent rather than introducing a second toolchain;
`tsx` and `esbuild` are not installed and should not be added for this.

Requirements: `@prisma/client` stays **external** · the `await import('./capture-composition')` must
remain a genuine lazy chunk, so `produceOnly` still constructs no client and needs no
`prisma generate` · the bundle must not collide with the existing `tsc` `dist/*.js` · the slice ships
a committed example profile generated from `SAMPLE_BUSINESS_DISCOVERY_PROFILE` with a spec pinning it
to that constant, since `--profile` takes a path and the repo contained no such document.

⚠️ **A green build is not evidence the bin runs.** The slice is done when `produceOnly` has
actually been executed and its output recorded.

### What shipped

`webpack.config.cjs` + `scripts/bundle.mjs` (webpack's Node API, so no `webpack-cli` dependency);
output `dist/bin/age-capture.cjs`; `build` = `tsc && bundle`, so a normal build produces the bin and
CI enforces the assertion below on every PR. `tsc`'s `dist/*.js` is still emitted for type consumers
and does not collide.

### The split point is ASSERTED, not trusted — the part most at risk of being undone

`produceOnly` constructs no `PrismaClient` and needs no generated client **only while `main.ts`'s
`await import('./capture-composition')` stays a genuine lazy chunk**, and _nothing about that is
visible in a passing build_: a static import still compiles, still runs, and quietly loads Prisma on
every invocation. So `scripts/bundle.mjs` fails the build if the entry bundle contains
`new PrismaClient(`, **and equally if no lazy chunk does** — absence alone would also be satisfied by
a build that dropped the capture path entirely.

⚠️ Verified in **both** directions before merge: converting the dynamic import to a static one leaves
webpack reporting `compiled successfully` while the assertion fails and the build exits 1. **Do not
"simplify" this to the one-sided check**, and do not remove it as a build-speed optimisation — it is
the only thing standing between a refactor and a `produceOnly` that opens a database connection.

### Proof the bin runs

Executed against the committed example under a `Module._load` tripwire that exits non-zero if
`'@prisma/client'` is ever requested. Run **from the repo**, so `zod` and the other legitimate
externals still resolved and the tripwire tested only what it claims to. Exit 0, tripwire silent,
`bifStatus Draft`, completeness **12**, confidence **17**, **7 present / 5 omitted** — matching the
demo baseline exactly.

⚠️ An earlier attempt — copying the bundle somewhere with no `node_modules` — was **unsound**: it made
_every_ external unresolvable, so it died on `zod` and could not distinguish lazy from eager. Do not
repeat it.

### Corrections this slice forced

⚠️ **There is no `--mode` flag.** Earlier text here and in the handover said "make
`--mode produceOnly` invokable". The real surface is: required `--profile`, `--client-id`,
`--organization-id`, `--changed-by`; optional `--bif-id`, `--snapshot-id`, `--captured-at`; boolean
`--capture`, `--confirm`. **`produceOnly` is the default; `--capture` opts into `produceAndCapture`.**

`eslint.config.mjs`'s CommonJS build-tool override gained `webpack.config.cjs` — the same case as
`webpack.config.js` in a package declaring `type: module`.

### Boundaries held

No source behaviour changed: `main.ts`, `capture-runner.ts` and `capture-composition.ts` are
untouched. No database was contacted; ADR-0046 **D7 is untouched**, and `produceOnly` remains the
mode that opens no connection at all.

⚠️ The standing residual is now **sharper, not closed**: `age-capture` is executable and has been
executed **in `produceOnly` only**. It is still invoked by no workflow, no package script and no other
package, and **`produceAndCapture` has still never run** and must not (D7).

---

## §4 — Remaining slices

| #   | Slice                                  | Gated by                                 |
| --- | -------------------------------------- | ---------------------------------------- |
| 3   | Wire the context-readiness bridge (G1) | **its own `Status: Proposed` ADR first** |

⚠️ Slice 3 is the highest-value **and** highest-hazard work in the repo: it hands a
`ScoredBifContext` toward the capability runner for the first time — the coupling ADR-0026/0027 built
a separate entry point to prevent. Preconditions are mandatory: own ADR · an invariant test written
and **failing before** the wiring exists · the test scans emitted string **content**, never
`items.length` · `run` is never gated on context.

⚠️ Slice 2b carries ADR-0046 **D7**: never run `--mode produceAndCapture` against any durable database
until an authenticated principal exists. `produceOnly` opens no connection and constructs no
`PrismaClient`, which is precisely why it is not gated by ADR-0043 open question 2.
