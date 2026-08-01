# ADR-0049 — "The intake that accepts no input" track checkpoint

> Verbatim per-PR record for the ADR-0049 track. `CLAUDE.md` holds state and rules only and
> points here; **this doc is the history — do not re-summarize it back into `CLAUDE.md`.**
> Append only. Section numbering is load-bearing (`CLAUDE.md` cites "§2", "§3").

---

## §1 — The council, and both dissents

The track opened under the `CLAUDE.md` §2 architect mandate, from the instruction
_"act as an architect and decide, i am looking for the finished product."_ Four lenses
(architect / skeptic / sequencing / security-and-invariants) were given **the code, never
prose** (§6 findings 7, 13).

The handover said "nothing is authorized." Per **finding 11** — _"nothing is authorized" is
usually about a TRACK, not the product_ — the frame was widened past the ADR-0048
readiness-surface track. The authorization set at product level was not empty.

**The finding all four lenses converged on:** one line,
`packages/demo-runtime/src/business-discovery.ts:113`,
`const profile = SAMPLE_BUSINESS_DISCOVERY_PROFILE;`. Every stage downstream of it —
intake, the scoring layer, and the whole ADR-0047/0048 readiness surface — was a function of
one frozen constant. The pipeline was therefore **unfalsifiable**: with a single fixed input,
"derived from the profile" and "hard-coded" are observationally identical, and no test in the
repo could distinguish them. Two ADRs' worth of readiness work could not be proven to do
anything.

### Dissent 1 — the skeptic (recorded, NOT dissolved)

> Authentication is the foundation. Everything else is polish on a frozen literal; a profile
> parameter with no authenticated principal behind it just moves the literal to the call site.

**Evidence adopted, conclusion rejected** — per **finding 8** (adopt a council's evidence and
its conclusion separately; the lenses with the strongest facts have twice recommended the one
action the resulting ADR rejects). Two reasons:

1. **Auth is unavailable to the architect by construction.** ADR-0046 §4's revisit trigger
   requires a real authenticated principal; a fixture, a flag, an env var and a mock each fail
   it _by construction_. Naming auth as the next step therefore produces **zero motion** — it
   is exactly the loop ADR-0043 → 0044 → 0045 got stuck in.
2. **The premise is false for this slice.** A stateless assessment stores no row, so there is
   no scope question to answer. Evidenced in the repo: `apps/capture` already feeds an
   arbitrary operator-supplied profile through `produceScoredBifContext` in `produceOnly` with
   no identity whatsoever, and that is sanctioned.

### Dissent 2 — the product lens, on D5

> Without an HTTP route, this is still not something a user can point at a different business.

Recorded and **not** dissolved. D5 holds: `POST /discovery/analyze` is an untrusted-input
boundary and needs its own ADR (body size limits; partial-answer handling that must return a
**result**, never a 400 — insufficient context is a valid _successful_ outcome, §3).

---

## §2 — ADR-0049 (Proposed #188 → Accepted #189)

Self-accepted under the `CLAUDE.md` §2 grant, with a §0.1 quoting the delegation verbatim and
stating plainly that acceptance is the architect's under a stated grant and **not** a claim the
user reviewed each decision (ADR-0043 §0.1 precedent).

| D      | Decision                                                                                                                                                                                                                |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | `runBusinessDiscoveryIntake(profile, scenario)` and `produceDemoScoredBifContext(profile, scenario)`. Demo call sites pass the sample explicitly.                                                                       |
| **D2** | **Required, not optional-with-a-default.** A default reinstates the removed coupling and hides it behind a signature that _looks_ parameterised. Follows the ADR-0039 D3 precedent for the scenario metadata.           |
| **D3** | `produceDemoScoredBifContext` **keeps its name.** Renaming would repoint two guards that were deliberately repointed at that symbol (ADR-0047 D2). What is demo-specific here is the scenario framing, not the profile. |
| **D4** | Baseline stays byte-identical **plus** a test that a materially different profile yields materially different output. ⚠️ **This test is the point of the ADR.**                                                         |
| **D5** | **No HTTP route in this slice** — see the product lens's dissent, §1.                                                                                                                                                   |
| **D6** | Persists nothing, authenticates nothing, constructs no `ClientContext`. **Pre-commits the auth decision in no direction.**                                                                                              |
| **D7** | Capability inputs are still not derived from context; needs its own ADR.                                                                                                                                                |

### §2.1 — Recorded, not authorized (ADR-0049 §5)

Surfaced by the council, deliberately **not** acted on in this slice:

- The hardcoded `humanApprovedExecution: true`.
- `--passWithNoTests` in **31** packages, **10** of which have zero specs. (⚠️ ADR-0048 D4
  removed it from `@age/web` only, and it must stay removed there.)
- **21** route-less scaffold modules.
- The blocked-path ADR-0027 notice gap — a pattern-wide question, not an Intelligence gap.

---

## §3 — #190: the implementation (D1–D4)

Branch `feat/adr0049-intake-profile-parameter` from `main` @ `7786662`. Commit **`888892b`**,
merge **`275f451`**. Nine files.

### What shipped

- **`packages/demo-runtime/src/demo-profile.ts` (new)** — `DEMO_BUSINESS_DISCOVERY_PROFILE`.
  ⚠️ It exists because `apps/demo` and `apps/api` **do not depend on
  `@age/business-discovery-contracts`**; it mirrors the `DEMO_SCENARIO_METADATA` pattern.
  ⚠️ It **re-exports the shared sample rather than declaring a second fixture** — a second
  fixture is how the pinned 97/63 vs 12/17 baseline silently drifts.
- **`business-discovery.ts`** — `const profile = SAMPLE_BUSINESS_DISCOVERY_PROFILE;` deleted;
  `profile` is the required first parameter.
- **`scored-bif-context.ts`** — same. The single `new Date(scenario.constructedAt.getTime())`
  remains a **defensive copy**, pinned by an existing test to exactly that shape.
- Call sites updated in `apps/demo/src/run.ts`,
  `apps/api/src/modules/demo/application/demo.service.ts`, and the specs.
- **`apps/demo/src/tests/run.spec.ts`** — the call-site guard regex now requires **both**
  arguments named at the CLI call site:
  `/runBusinessDiscoveryIntake\(\s*DEMO_BUSINESS_DISCOVERY_PROFILE,\s*DEMO_SCENARIO_METADATA,?\s*\)/`.

### ⚠️ SHIPPED REFUSALS — do not undo them

- **No default parameter, in either function.** This is D2 and it is the whole slice. A
  default would restore the exact coupling removed here while making the signature _look_
  parameterised — strictly worse than the original, which was at least honest.
- **A sparse or partially-answered profile is a valid input** and produces a valid summary.
  Incompleteness is reported through the counters and the omitted section types. It is a
  **limitation, never an error and never negative evidence** (ADR-0026 D4). The function
  throws for no profile shape the schema accepts.
- **No HTTP route, no persistence, no authentication, no `ClientContext`** (D5/D6).
- `produceDemoScoredBifContext` **keeps its `Demo` prefix** (D3).

### ⚠️ The guard was made to fail before it was trusted

Per `CLAUDE.md` §8 — _a guard is only evidence once you have made it fail._ With
`produceDemoScoredBifContext` mutated to ignore its `profile` argument and read the sample
directly:

```
3 failed | 37 passed
  ✗ a different profile produces different scores
        → expected 63 not to be 63
  ✗ a different profile changes which canonical BIF sections can be populated
        → to not deeply equal
  ✗ the intake stage reads no profile from module scope
        → not to match /SAMPLE_BUSINESS_DISCOVERY_PROFILE/
```

**Exactly** the three new D4 tests failed, and each named the mutation. Restored → **40
passed**. Nothing else in the 40 could tell the difference — which is precisely the defect
the ADR describes, demonstrated rather than asserted.

⚠️ The third test **strips comments before scanning**, or the file's own explanation of the
rule matches the banned token (the `vitest-worker-cap.spec.ts` lesson).

### Gates

`packages/demo-runtime` 40 passed · `pnpm typecheck` 32 projects · `pnpm lint` 32 ·
`pnpm test` 32 · `pnpm build` ok · `@age/api test` 48 passed ·
`@age/api smoke:demo` → _"OK: 6 capabilities, 6 pending approvals, accounting invariant true,
6 readiness rows with no aggregate, no side effects."_ · `pnpm demo` → 97/63, 12/17, 7+5 ·
`git diff --stat apps/demo/sample-output.txt` **empty — golden file byte-identical.**

CI: PR run `30685043885` **success**, 15 steps executed. ⚠️ `API demo runtime smoke` is a
**step inside the single `ci.yml` job**, not a separate job — `gh pr checks` shows one check,
which is correct and not a missing gate. `ci-db.yml` correctly did not trigger (no persistence
paths touched) — an expected non-trigger, **not** a skipped gate.

Independent `code-reviewer` pass: 0 CRITICAL / 0 HIGH / 0 MEDIUM, one LOW cosmetic note
(`SPARSE_PROFILE`'s `fieldEvidence: undefined` is a spread-override rather than an absent key;
Zod `.optional()` treats the two identically, so it is not a behaviour difference — left as is,
deliberately).

---

## §4 — What remains on this track

**Nothing.** D1–D4 are shipped. D5 and D7 are each a **fresh decision** requiring their own
`Status: Proposed` ADR — they are not "the rest of ADR-0049" and must not be implemented
under it.

⚠️ Per finding 11, do not read "nothing remains on this track" as "nothing is authorized in
the product." §2.1 lists four things recorded but not authorized, and D5/D7 are two more.
The next slice starts by widening the frame again, not by picking from this list on sight.
