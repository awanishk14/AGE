# AGE — the shipped refusals (verbatim)

> These blocks were **extracted verbatim** from `CLAUDE.md` §1 when that file passed its ~30k
> character budget. **Nothing was dropped** — each block is reproduced exactly as it stood, heading
> and all, in the order it appeared.
>
> ⚠️ Every entry here describes **shipped code and a decision already taken**. The failure mode this
> doc exists to prevent is _undoing_ one of them by accident — usually while "completing",
> "simplifying" or "aligning" something. **Read the relevant section before touching the code it
> names.**
>
> ⚠️ Several entries are a **pair of halves** (a thing that is true _and_ a thing that is **not**).
> Both halves must survive any future summarizing.
>
> Each section points onward to its own full track checkpoint; this doc is the digest layer between
> `CLAUDE.md` and those. Companion docs: `AGE_ARCHITECTURE_ON_MAIN.md` (§4),
> `AGE_ARCHITECT_FINDINGS.md` (§6), `AGE_STANDING_RESIDUALS.md` (§1b).

---

### ✅ THE FOUR-LENS COUNCIL OF 2026-08-01 — EXTRACTED, three findings CLOSED

> **Full verbatim record: [`COUNCIL_2026_08_01_TRACK_CHECKPOINT.md`](COUNCIL_2026_08_01_TRACK_CHECKPOINT.md)**
> — §1 how it was run + the four-way split, §2 #196, §3 #197, §4 #198, §5 ADR-0051 + what remains.
> **Read it before touching any guard named below.** The six here are only the ones that most often
> prevent an _active_ mistake; they are **not** the record.

- ✅ **#196 — the skeptic's charge against my own ADR-0050 §3, UPHELD.** **Constructible is not
  reachable.** ⚠️ Half the charge was **examined and REJECTED**: `run.spec.ts`'s
  `runBusinessDiscoveryIntake(DEMO_BUSINESS_DISCOVERY_PROFILE, …)` regex is _not_ what makes the
  pipeline unpointable — it pins **one caller** (the demo CLI), which _is_ ADR-0049 D2. **Do not
  loosen it.**
- ✅ **#197 — `@age/bif` ban, was guarded in 3 of 6 capability packages.** Now one guard in
  `@age/capability-kit` walks the **capabilities directory** (not a list). ⚠️ It does **not**
  replace the three per-package blocks — deleting those is not made safe by it.
- ✅ **#198 — append-only had no committed source guard.** ⚠️ **Widening
  `ScoredBifSnapshotDelegate` IS the mutation** (now pinned to exactly `create`/`findUnique`/
  `findMany`). ⚠️ The scan is **receiver-scoped on purpose** — a blanket `.delete(` ban fires on
  every `Map.delete`, and a guard that cries wolf gets deleted. ⚠️ Its fixtures are **assembled
  from parts** so the file stays inside its own scan. **Do not "simplify" either detail.**

⚠️ **None of these three needed an ADR** — §3/§5 had already decided them; only enforcement was
partial. Reusable lesson: _a stated boundary with a half-built guard is not a decision gap._
⚠️ **My own `grep -E` mis-handled `\s` and reported a clean repo for the wrong reason.** The JS scan
found the truth. "I grepped and found nothing" was nearly the evidence #198 was unnecessary.

### ⚠️ #190's ADR-0049 slice — SHIPPED refusals, do not undo them

> Full record: **`ADR0049_INTAKE_INPUT_TRACK_CHECKPOINT.md`** (§1 council + both
> dissents, §2 the seven decisions, §3 the implementation + mutation proof, §4 nothing remains).

- ⚠️ **NO DEFAULT PARAMETER**, on `runBusinessDiscoveryIntake` or `produceDemoScoredBifContext`.
  This is D2 and it is the entire slice. `const profile = SAMPLE_BUSINESS_DISCOVERY_PROFILE;` made
  the whole pipeline — intake, scoring, **and the ADR-0047/0048 readiness surface** — a function of
  one frozen constant, and therefore **unfalsifiable**: with a fixed input, "derived from the
  profile" and "hard-coded" are observationally identical. A default restores exactly that coupling
  behind a signature that _looks_ parameterised — **worse than the original, which was honest**.
- **`produceDemoScoredBifContext` keeps its `Demo` prefix** (D3) — two guards were deliberately
  repointed at that symbol (ADR-0047 D2). Do not repoint them again.
- **`DEMO_BUSINESS_DISCOVERY_PROFILE` re-exports the shared sample; it is NOT a second fixture** —
  a second fixture is how the pinned 98/63 vs 12/17 baseline silently drifts. It exists only because
  `apps/demo` and `apps/api` do not depend on `@age/business-discovery-contracts`.
- **A sparse profile is VALID INPUT**, not an error: reported through the counters and the omitted
  section types (a limitation, never negative evidence — ADR-0026 D4).
- ⚠️ **D5 and D7 are NOT "the rest of ADR-0049."** No HTTP route (`POST /discovery/analyze` is an
  untrusted-input boundary needing body limits and partial-answer handling that returns a **result,
  never a 400**), and capability inputs are still not derived from context. **Each needs its own
  `Status: Proposed` ADR.** D6: this slice persists nothing and **pre-commits auth in no direction**.
- ⚠️ Three D4 tests were **made to fail** before being trusted: with the producer mutated to ignore
  `profile`, exactly those three failed and named the mutation (3 failed | 37 passed); restored → 40.
  **Nothing else in the 40 could tell the difference** — the defect, demonstrated not asserted.

### ✅ ADR-0048 D3 — track COMPLETE. API-side facts (the refusals are in their own section below)

- ⚠️ **`thresholds` keeps the runtime UNION type** on the API, deliberately not flattened to
  `Record<string, number>` — a flattened shape suggests the three are one shared scale. It surfaced
  **only at `tsc`** (`TS2322`); **vitest does not typecheck**. ⚠️ `apps/web`'s `src/lib/demo.ts`
  widens it **there and only there** (values are displayed, never compared) — do not "align" them.
- **`producedAt` comes from `DEMO_SCENARIO_METADATA.constructedAt`** (copied — `Object.freeze` is
  shallow), never `new Date()`. Projection is **field-by-field, never a spread** (D5's rule).
- ⚠️ The smoke check re-proves the absent non-adopter fields **after a JSON round trip**, which is
  where `undefined` would become `null`.
- ⚠️ CI reading: a `queued` job is neither green nor a skipped gate — **watch to completion**, and
  verify in the job log, not the tick. A path-gated workflow that correctly did not trigger
  (`ci-db.yml`, last real run #198) is an **expected non-trigger**, not a skipped gate.

### ✅ THE ADR-0046 D3 DEMO-SURFACE TRACK IS COMPLETE

Slices 1 (#162), 2a (#164), 2b (#166) and **3 (#170)** are all **DONE — do not rebuild any of them.**
Full record: **`ADR0046_DEMO_SURFACE_TRACK_CHECKPOINT.md`** (§1–§4; §5 = nothing left on the track; **§6 = #173, §7 = #175**).
**ADR-0047 is `Status: Accepted`** — do not rewrite it, do not convene another council on it.

The demo pipeline is now **intake → context readiness → capability runs**, and the ADR-0027 readiness
pattern has a **non-test caller** for the first time.

### ✅ ADR-0050 D1–D8 — **SHIPPED (#194 @ `c9887ef`). Do not rebuild it.**

> Full record: **`ADR0050_ANSWERS_TO_PROFILE_TRACK_CHECKPOINT.md`** (§1 the split
> council + the two named blockers, §2 the eight decisions, §3 the implementation, mutation proof
> and the erratum, §4 nothing remains).

`buildProfileFromAnswers(answers, questionnaire, options)` exists in
`@age/business-discovery-contracts`. **The whole hazard is transcription vs inference (D2).**

- ⚠️ **`offerings` and `evidenceSources` are REFUSED OUTRIGHT — 11 of 13 signals route.**
  `Offering.type` is a **required** `OfferingKind` and `EvidenceSourceRef.kind` a **required**
  `EvidenceSourceKind`; **no answer supplies either.** Do **not** "complete" the mapper by
  defaulting `type` to `'service'` — that is inference wearing a plausible default.
  ⚠️ ADR-0050 §2.1 wrongly listed `Offering` as all-else-optional; **corrected by an erratum in the
  ADR, not by relaxing D2.** Do not "fix" the erratum.
  ⚠️ **Superseded in part by ADR-0051 D1–D4 (#202):** the two signals now route via `kindedList`
  because the **questionnaire** pins the enum. The refusal to infer it **from the answer** stands.
- **`assumptions`/`gaps`/`offerings`/`evidenceSources` return `[]` by DECISION, not oversight**;
  `fieldEvidence` is **omitted entirely**, never set to `undefined`.
- **Output order follows the QUESTIONNAIRE, not the caller's answer order** (pinned by a shuffle
  test). The mapper does not mutate its inputs.
- **Throws only for:** non-array answers · a questionnaire with no sections · blank/missing
  `id` or `capturedAt` · no answer satisfying `businessName`. **A sparse profile is a valid
  SUCCESS.**
- ⚠️ D8's round trip **strips `sections`** before re-validating — otherwise D6's answer copy would
  satisfy every question on its own and the structured transcription would be untested.
- ⚠️ 25 tests passed while `pnpm typecheck` **failed** (5 `noUncheckedIndexedAccess` sites).
  **vitest does not typecheck** — run `tsc` separately.
- ⚠️ **A malformed QUESTIONNAIRE now THROWS** (`a68f5a7`, from the review): two questions claiming
  the same `satisfiedBy` signal, or a `list`-kind question routed to a single-valued signal. Both
  silently discarded a transcribed value while D6 still recorded the answer — so the profile looked
  complete. **This is NOT a softening of D4**: an unanswered/unmapped **question** is still never an
  error. A **questionnaire** that would make the mapper drop a value it was given is a caller defect.
  Reachable because the questionnaire is an **arbitrary parameter**, not always the default one.

### ✅ ADR-0051 D1–D4 — **SHIPPED (#202 @ `911289b`). Do not rebuild it.**

> Full record: **`ADR0051_QUESTIONNAIRE_ENUMS_TRACK_CHECKPOINT.md`** (§2 the four
> decisions as shipped, §3 the D7 erratum, §4 the mutation proof, §6 what it does NOT do).
> The five below are only the ones that most often prevent an _active_ mistake.

- **`entryKind` on `BusinessDiscoveryQuestionnaireQuestion` — THE ENUM IS ON THE QUESTION, NEVER
  DERIVED FROM THE ANSWER.** `off-list` → `off-products`/`off-services`; `ev-sources` →
  `ev-documents`/`ev-urls`/`ev-statements`. **ADR-0050 D2 is intact, not weakened.**
- ⚠️ **Do NOT collapse the offerings pair back into one "products or services?" question** — it
  applies a whole-business answer to every entry, and a business selling both has no honest answer.
- ⚠️ **`'url'` is a plain reference string that is NEVER fetched.** Nothing authorizes retrieval.
- ⚠️ **The `untranscribable` variant is KEPT with NO members, on purpose** — it is the vocabulary for
  the next refusal; deleting it makes that refusal look like an oversight.
- ⚠️ **The duplicate-`satisfiedBy` check was NARROWED (key = `signal:entryKind`), never removed.** A
  second question pinning the **same** enum still throws. Both new guards were **made to fail**
  (deriving the kind from wording → 1 named failure; widening the key → 2) before being trusted.
- ⚠️ **`buildProfileFromAnswers` STILL has no caller** — §3 and the checkpoint §6 both say so. Do not
  report this track as "reachable". D5's `/discovery` form is **NOT authorized** by this and needs
  its own ADR.

### ⚠️ ADR-0051 (Accepted — Proposed #199, accepted #201) — the verified defect, do not soften it

> The defect is **CLOSED by #202** — kept here only for the two rules that outlive it. Full record:
> the track checkpoint §1 and ADR-0051 §1.

- 🚫 **It was NOT a scoring bug, and the fix was NOT in the scoring layer.** The scores were correct
  — the profile really was empty — and ADR-0026 D4 holds. The 35 cap was lifted **by making the
  evidence real, never by relaxing the cap**. Do not "help" a future low score by touching a cap.
- ⚠️ **D5 — the `/discovery` form is still NOT authorized.** It was blocked behind D1–D4, and needs
  its own ADR now that they have landed.

The obvious caller — `POST /discovery/analyze` — remains **deferred with named content**, not merely
unbuilt; the two blockers are stated once in the ADR-0050 block immediately below. It needs its own
`Status: Proposed` ADR.

⚠️ Do **not** treat ADR-0049 §5's four recorded items, ADR-0050 §2.2's four, **ADR-0051 §2.1's
five**, or D5/D7 as a to-do list. Each is **recorded, not authorized**, and needs a fresh
`Status: Proposed` ADR. **Read the ADR's own §2.1 — do not work from a summary of it.**
Do not "finish" any surface with an aggregate, a sort or a colour scale.

### ⚠️ ADR-0050 (Accepted, #192 Proposed → #193 Accepted) — the decisions, do not soften them

> ADR-0049 made the profile a required parameter and left it **unreachable**: no function in
> `packages/` or `apps/` returns a `BusinessDiscoveryProfile`, so the signature is parameterised and
> in practice has exactly one possible argument. **The same defect ADR-0049 closed, one layer up.**

- ⚠️ **The mapper TRANSCRIBES and never INFERS (D2).** `Offering`/`CustomerSegment`/
  `CompetitorReference`/`BusinessGoal` are each `{id, name|statement, …all else optional}` — a
  `list` answer becomes one entry per value, text **verbatim**, and `description`,
  `valueProposition`, `industry`, `companySize`, `geography`, `note`, `horizon` are **never
  populated**. Splitting one prose answer into several entries, or deriving `horizon` from "next
  year", is inference and is prohibited.
- **`satisfiedBy` is the ONLY routing table (D3)** — no name matching, no heuristics. It is the
  declared inverse of `PROFILE_SIGNAL_PREDICATES`; a test pins both to the same closed
  `PROFILE_SIGNALS` set (13) so neither can drift.
- **An unanswered/unmapped question is NOT an error (D4)** — the profile stays sparse. It throws for
  no answer set. **`id` and `capturedAt` are required caller-supplied options (D5)** — no wall-clock,
  no generated id, **never optional-with-a-default**.
- **Every answer is copied into `profile.sections[].answers[]` too (D6)**, so the structured and
  answer representations cannot disagree.
- ⚠️ **D5/D7 (the HTTP route) is DEFERRED AGAIN, now with named content — do not "just add it":**
  (a) Path B stamps `changedBy`/`constructedAt` onto **every `FieldVersion`**, so an unauthenticated
  caller has no honest value and **a fixed constant is the same fabrication with a shorter blast
  radius**; (b) `buildContextReadinessReport`'s hardwired `demoContext` would stamp a demo scope onto
  a real business's data — reached **by the input changing underneath it, with no decision taken**.
  ⚠️ ADR-0049 §0.3's _"stores no row → no scope question"_ is **sound for SCOPE and does not extend
  to AUTHORSHIP.** Do not stretch it.
- ⚠️ The architecture + security lenses' route **hardening** analysis (`safeParse` at the boundary,
  body size limit, explicit `ValidationPipe`, CORS origin list) is **adopted in full** for whenever
  the route is written — their _conclusion_ (build it now) was rejected, their evidence was not.
- ⚠️ Parameterising `clientContext` on `buildContextReadinessReport` was **rejected outright, not
  recorded** — ADR-0047 D9 settled it. Re-opening it is the ADR-0048 D1 failure mode.

### ⚠️ ADR-0048's SHIPPED refusals (#179 D5 · #181 D4 · #184 · #186) — do not undo any of them

> Full verbatim record: **[`ADR0048_READINESS_SURFACE_TRACK_CHECKPOINT.md`](ADR0048_READINESS_SURFACE_TRACK_CHECKPOINT.md)**
> — §1 the council + both dissents, §2 (D5), §3 (D4), §5 (#184), §6 (#186), §4 nothing remains.
> **ADR-0048 is `Status: Accepted`** (Proposed #177, accepted #178 under the §2 grant); it **split
> ADR-0047 D8**, which is no longer a single blocker. Read `docs/adrs/0048-*.md` — do not re-derive
> it. ⚠️ Its §4 dissents were **answered in the PRs, not dissolved.** The eight below are only the
> ones that most often prevent an _active_ mistake; they are **not** the record.

- Readiness renders **between** the discovery card and the run cards — never as a **gate** above
  them (D7b). `run` is never gated on context.
- **No aggregate, no sort, no grouping**; entries render in supplied order. The test asserts adopters
  stay **non-contiguous** — grouping _is_ what sorting by state looks like once labels are stripped.
  ⚠️ **Do not "complete" any of these surfaces with an aggregate, a sort or a colour scale.**
- **The state is never rendered through `Notice`.** `Notice` is an emerald/amber pair off a boolean;
  pointing it at a readiness state paints three incommensurable measurements onto one good/bad axis —
  the ordinal colour scale ADR-0047 D4 forbids, reached **by component reuse, not by a decision**.
  ⚠️ The pre-existing `GRADED_VALUE` **source scan did not catch this**; the new rendering test did.
- **A non-adopter carries nothing** — no dash, no `"N/A"`, no empty chip, no greyed row. `ReasonList`
  returns `null` rather than "(none)".
- ⚠️ **`--passWithNoTests` is REMOVED from `@age/web` and must stay removed** (#181). It was green
  **by vacuity** over zero specs while declaring a `jsdom` that was in no `package.json`. Restoring
  it re-opens exactly what D4 closed. ⚠️ **Do not add a workflow step "to make it run"** —
  `pnpm test` → `nx run-many -t test` reaches it.
- ⚠️ `page.tsx`'s ADR-0046 slice-1 invariants are **no longer only comments**. The `Notice` source
  scan is **case-SENSITIVE on purpose** — case-insensitive `count` matches `accountingHolds`, a
  legitimate boolean, and a scan that cried wolf would be deleted.
- **#179 pins the exact published key set** per capability for all three item arrays (18 arrays, 6×3)
  and scans for **five** scope spellings (ADR-0048 D2, permanent).
  ⚠️ **A projection was considered and REJECTED** — six capabilities emit six _different_ shapes
  (7–17 keys) and web renders every item, so projecting would publish `id`/`capability`/`createdAt`
  and discard the demo's entire content. **The hole closed is SILENCE, not breadth.**
  ⚠️ Never loosen `toEqual` to `toContain`; never delete a capability's entry.
- ⚠️ **ADR-0048 D1 is ERRATA, not a deferral** — `ContextReadinessEntry` never carried scope; #170
  already did what D8 asked. **Do not re-open it**; re-asking a settled question invites re-deciding
  it the other way by accident.
- ⚠️ Guard defect worth carrying: `/…ready/i` **silently passed** on a real rendered `1 of 6
ready`, because `textContent` concatenates siblings with **no separator**
  (`…6 readyIntelligence…`). Found only by mutation. **A guard is evidence only once made to fail.**

**Still open, and recorded — NOT authorized:** the **blocked path carries no notice, in all three
capabilities** (a **pattern-wide** ADR-0027 question, not an Intelligence gap) · anything touching
**capture writes** (the ADR-0046 D7 prohibition — needs an authenticated principal).

### ✅ The vitest memory exposure is CLOSED (#172 @ `61c1ebe`) — do not "fix" it again

Shared **`vitest.base.config.ts`** at the repo root, merged by **all 23** `vitest*.config.ts` via
`mergeConfig`, with `pool: 'forks'` + `poolOptions.forks.maxForks: 2`. Guarded repo-wide by
`packages/business-discovery-contracts/src/tests/vitest-worker-cap.spec.ts` (asserts the walk found

> 20 configs **first**, that the cap exists and is ≤4, that the pool is named explicitly, and that no
> config re-raises it). Proven non-vacuous by un-merging one config and confirming it is named.
> Measured: **93 → 30 processes, ~8,900 → 3,357 MB, 2,298 → 1,399 MB peak worker, 29.7 s → 23.3 s**
> (faster — there was no speed tradeoff).

⚠️ **The cap is on WORKER COUNT, deliberately NOT on heap size.** Do not add
`--max-old-space-size` / `execArgv`: the real peak single worker is **2,298 MB**, so any
reasonable-looking ceiling aborts the run having executed **zero** tests — a broken build, not a
bounded suite. A test pins this decision.
⚠️ `maxForks: 2` **composes with Nx's own `parallel`** in `nx.json`; the product is what the machine
sees. Do not raise it "to use the machine".
⚠️ AGE has **no jest and no ts-jest**, so the RankOps `diagnostics: false` finding never transferred.

### ⚠️ SLICE 3 + #173'S RULES — these now describe SHIPPED CODE, do not undo them

> Full verbatim record: **`ADR0046_DEMO_SURFACE_TRACK_CHECKPOINT.md` §4 (slice 3) and
> §6 (#173).** The six below are the ones that most often prevent an _active_ mistake.

- **The hazard is in the RENDERING, not the wiring.** Rank/score/shortlist are acts of a
  _presentation_ layer. Shipped: fixed registry order, each state adjacent to its **own**
  `requiredSectionTypes` + `thresholds`, **no aggregate of any kind** (D4). The three states are
  incommensurable in **DENOMINATOR, not threshold**.
- Vocabulary scans check emitted string **content, never `items.length`** — `output.items` is **not
  uniform**, so count items **across** contexts and assert **after** the loop.
  ⚠️ The **D7a stdout scan is SCOPED to the readiness stage**: the capability runs legitimately name
  opportunities, and D1 binds the **assessment**, not the runs.
  ⚠️ `'Vision & Strategy'` is a canonical section name (the only such collision), neutralized as a
  **token** in **three** specs now — the regex was **never loosened**. In #173 the neutralizer is
  driven off the context's own `sections` + `omittedSections`, never a hard-coded string.
  ⚠️ **"Rank" and "shortlist" are invisible to a vocabulary scan** — an items array ordered by score
  _is_ a shortlist. Assert projection order and the absence of a comparator too.
- `run` is **never** gated on context (D7b is the only test that can prove it), and
  `CapabilityRegistryEntry.consumes` did **not** gain `ScoredBifContext` (D6).
- **Never `new Date()`** — `producedAt` is a required parameter that **throws** if omitted (D3); the
  producer's single `new Date(` is a defensive copy, pinned by test to that exact shape.
- **API/web/smoke are DEFERRED** (D8) — scope identifiers are kept out of the shape entirely.
  Readiness **items** carry none either: their pinned key set has no `clientId`/`organizationId`.
  ⚠️ Superseded by ADR-0048, which split D8; the API/web surfaces shipped in #184/#186. The rule
  that **scope identifiers stay out of the shape** is unaffected and still holds.
- ⚠️ `ContextReadinessThresholds` is a **UNION** of the three published types, not a flattened
  `Record`. ⚠️ It surfaced **only at `tsc`** — **vitest does not typecheck**, so green package tests
  are not evidence of a compiling repo.
- ⚠️ `produceDemoScoredBifContext` is the demo's **single** production point (D2); two guards in
  `business-discovery.spec.ts` were **repointed** at it — never repoint them back.
- **All three ADR-0027 adopters state a sanctioned non-derivation notice, emitted LAST** (#175).
  Intelligence's object is a business **conclusion**, not an opportunity or plan — it assesses
  context support and produces no domain artefact. ⚠️ Each notice **passes** the vocabulary scan
  rather than being **exempted** from it. ⚠️ A passing scan and a stated notice defend **opposite**
  failures — a scan proves silence; only the capability can state the thing. Do not conflate them.

### The capture residual after #166 — EXTRACTED, state it precisely

> Full verbatim record: **`ADR0043_CAPTURE_CLI_TRACK_CHECKPOINT.md` §7.**

- `age-capture` is **executable** and **has been executed, in `produceOnly` only.** Still true: no
  workflow, no package script and no other package invokes it; `main.ts` has zero importers;
  **`produceAndCapture` has never run and must not.** Do not restate this as "no caller", and do
  not restate it as "capture runs" either.
- ⚠️ **`scripts/bundle.mjs`'s two-sided lazy-chunk assertion must not be removed** — it fails if the
  bundle contains `new PrismaClient(` **and equally if no lazy chunk does**. Not a size optimisation:
  it is the only thing between a refactor and a `produceOnly` that opens a database connection.
- ⚠️ **There is no `--mode` flag.** `produceOnly` is the default; `--capture` opts into
  `produceAndCapture`.
