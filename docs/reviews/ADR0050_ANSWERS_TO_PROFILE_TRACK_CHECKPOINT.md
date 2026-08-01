# ADR-0050 — "The profile nobody can author" track checkpoint

> Verbatim per-PR record for the ADR-0050 track. `CLAUDE.md` holds state and rules only and
> points here; **this doc is the history — do not re-summarize it back into `CLAUDE.md`.**
> Append only. Section numbering is load-bearing (`CLAUDE.md` cites "§2", "§3", "§4").

---

## §1 — The council, and the split

The track opened under the `CLAUDE.md` §2 architect mandate. Four lenses (architect / skeptic /
sequencing / security-and-invariants) were given **the code, never prose** (§6 findings 7, 13).

**The council split.** The architecture and security lenses recommended building the HTTP route
(`POST /discovery/analyze`) now, with hardening. The skeptic and sequencing lenses said the route
was the wrong next step because the thing it would accept — a `BusinessDiscoveryProfile` — has no
producer anywhere in the repo.

**The skeptic's claim, verified against the code before it was adopted:**

- No function in `packages/` or `apps/` returns a `BusinessDiscoveryProfile`.
- `satisfiedBy` → `PROFILE_SIGNAL_PREDICATES` is a **checking** direction with no producing
  counterpart: the repo can say whether a profile answers a question, and cannot build one.
- `SAMPLE_BUSINESS_DISCOVERY_PROFILE` is a hand-written literal. Every caller passes it.

ADR-0049 therefore made the profile a **required parameter** and left it **unreachable**: the
signature is parameterised and in practice has exactly one possible argument. **The same defect
ADR-0049 closed, one layer up.**

### Evidence adopted, conclusion rejected (finding 8)

The architecture and security lenses' route **hardening** analysis — `safeParse` at the boundary, a
body size limit, an explicit `ValidationPipe`, a CORS origin list — is **adopted in full** for
whenever the route is written. Their **conclusion** (build it now) was rejected. This is the third
time on this repo that the lenses with the strongest facts recommended the one action the resulting
ADR refused.

### The two named blockers behind the deferral (ADR-0050 D7)

Recorded so the deferral is a decision with content rather than a shrug:

1. **Authorship.** Path B stamps `changedBy` / `constructedAt` onto **every `FieldVersion`**. An
   unauthenticated caller has no honest value for either, and **a fixed constant is the same
   fabrication with a shorter blast radius**.
   ⚠️ ADR-0049 §0.3's _"stores no row → no scope question"_ is **sound for SCOPE and does not extend
   to AUTHORSHIP.** Do not stretch it.
2. **Scope.** `buildContextReadinessReport`'s hardwired `demoContext` would stamp a demo scope onto a
   real business's data — reached **by the input changing underneath it, with no decision taken.**

⚠️ **Parameterising `clientContext` on `buildContextReadinessReport` was rejected outright, not
recorded.** ADR-0047 D9 settled it; re-opening it is the ADR-0048 D1 failure mode.

---

## §2 — ADR-0050 (Proposed #192 @ `e7ded21` → Accepted #193 @ `5b0e9c3`)

Self-accepted under the `CLAUDE.md` §2 grant, with a §0.1 quoting the 2026-07-30 delegation verbatim
and stating plainly that acceptance is the architect's under a stated grant and **not** a claim the
user reviewed each decision (ADR-0043 §0.1 precedent). Post-merge `CI` runs `30687394022` and
`30687547647` both **success**.

| D      | Decision                                                                                                                                          |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | `buildProfileFromAnswers(answers, questionnaire, options)` in `@age/business-discovery-contracts`. Pure — no clock, no id, no randomness, no I/O. |
| **D2** | **Transcribes, never infers.** ⚠️ This is the whole hazard of the ADR.                                                                            |
| **D3** | **`satisfiedBy` is the ONLY routing table** — no name matching, no heuristics. It is the declared inverse of `PROFILE_SIGNAL_PREDICATES`.         |
| **D4** | An unanswered or unmapped question is **NOT an error** — the profile stays sparse.                                                                |
| **D5** | `id` and `capturedAt` are **required caller-supplied options** — no wall clock, no generated id, **never optional-with-a-default**.               |
| **D6** | Every answer is copied into `profile.sections[].answers[]` too, so the structured and answer representations cannot disagree.                     |
| **D7** | **No HTTP route, no persistence, no authentication, no `ClientContext`** — see §1's two named blockers.                                           |
| **D8** | The round trip through `validateProfileAgainstQuestionnaire` is the proof, and is **trusted only once made to fail** by mutating the mapper.      |

### §2.1 — What D2 forbids, named

`Offering` / `CustomerSegment` / `CompetitorReference` / `BusinessGoal` are each
`{id, name|statement, …}`. A `list` answer becomes **one entry per value, text verbatim**, and
`description`, `valueProposition`, `industry`, `companySize`, `geography`, `note` and `horizon` are
**never populated**. Splitting one prose answer into several entries, or deriving `horizon` from
"next year", is inference and is prohibited.

### §2.2 — Recorded, not authorized

Four items surfaced by the council and deliberately not acted on. ⚠️ Together with D5/D7 these are
**recorded, not authorized** — each needs a fresh `Status: Proposed` ADR. Do not treat the list as a
to-do list, and do not "finish" any surface with an aggregate, a sort or a colour scale.

---

## §3 — #194: the implementation (D1–D8)

Branch `feat/adr0050-answers-to-profile` from `main` @ `5b0e9c3`. Commits **`c9887ef`** (the slice)
and **`a68f5a7`** (the review follow-up, §3.1). Merge **`6b2d76e`**. Four files, 912 insertions.

PR CI: run `30690547182` **success** on `c9887ef`, run `30690754216` **success** on `a68f5a7`, **15
steps executed** each. ⚠️ `API demo runtime smoke` is a **step inside the single `ci.yml` job**, not
a separate job — `gh pr checks` shows one check, which is correct and **not** a missing gate.
`ci-db.yml` correctly did not trigger (no persistence paths touched) — an expected non-trigger,
**not** a skipped gate.

### What shipped

- **`packages/business-discovery-contracts/src/build-profile-from-answers.ts` (new)** —
  `buildProfileFromAnswers`, plus two exported constants that are themselves the guarded contract:
  - **`PROFILE_SIGNAL_TARGETS`** — `Readonly<Record<ProfileSignal, SignalTarget>>`, where
    `SignalTarget` is a discriminated union of `scalar` / `stringList` / `namedList` /
    **`untranscribable`**. The `untranscribable` arm carries a `because` string.
  - **`TRANSCRIBED_PROFILE_SIGNALS`** — the **11** signals actually routed.
- **`…/src/tests/build-profile-from-answers.spec.ts` (new)** — 25 tests in `describe` blocks named
  D3 / D2 / D4 / D5 / D6 / D8.
- **`…/src/index.ts`** — exports added above the questionnaire-validation exports, with a comment
  stating the producing/checking relationship in the file itself.
- **`docs/adrs/0050-*.md`** — the §2.1 erratum below.

### ⚠️ SHIPPED REFUSALS — do not undo them

- ⚠️ **Two of the 13 signals are refused outright: `offerings` and `evidenceSources`.**
  `Offering.type` is a **required** `OfferingKind` (`'product' | 'service'`) and
  `EvidenceSourceRef.kind` is a **required** `EvidenceSourceKind` (`'client-statement' | 'document'
| 'url'`). **Neither value is present in an answer's text.** The mapper routes **11 of 13** and each
  refusal carries a stated `because`.
  ⚠️ Do **not** "complete" the mapper by defaulting `Offering.type` to `'service'` — that is
  inference wearing a plausible default, and it is exactly what D2 forbids.
- **`offerings`, `evidenceSources`, `assumptions` and `gaps` are returned as `[]`** with a comment
  block stating that each is empty **by decision, not oversight**. `fieldEvidence` is **omitted
  entirely**, not set to `undefined`.
- **Output order follows the questionnaire, not the caller's answer order** — pinned by a
  determinism test that shuffles the input.
- **`id` / `capturedAt` throw when blank or missing.** So does a non-array `answers`, a questionnaire
  with no sections, and an answer set that satisfies no `businessName`. **Nothing else throws** — a
  sparse profile is a valid success (§3, ADR-0026 D4).
- The mapper **does not mutate its inputs** — pinned by test.

### ⚠️ An erratum to the ADR, not a quiet divergence

ADR-0050 §2.1 listed `Offering` among the "all else optional" shapes. **That was an error in the
merged ADR** — `Offering.type` is required. The implementation carries the correct D2 reading and the
ADR gained a §2.1 erratum recording the mistake. **D2 is unchanged and is what forces the
correction.** ⚠️ Do not "fix" the erratum by relaxing D2.

### ⚠️ The guards were made to fail before they were trusted

Per `CLAUDE.md` §8 — _a guard is only evidence once you have made it fail._ Three mutations, each
naming its own guard; restored to **25 passed** each time:

| Mutation                                                    | Result                                      |
| ----------------------------------------------------------- | ------------------------------------------- |
| Drop the recorded `sections[].answers[]`                    | **6 failed** — D6 ×3 and the D8 round trip  |
| Make `offerings` transcribable with an inferred `'service'` | **2 failed** — both refusal tests           |
| Placeholder-fill omitted fields with `?? 'N/A'`             | **2 failed** — D2 omission, D4 blank-answer |

⚠️ The purity scan **strips comments before scanning**, or the module's own explanation of the rule
matches the banned token (the `vitest-worker-cap.spec.ts` lesson).

⚠️ D8's round trip **strips `sections` from the profile** and confirms the `segments` question is
_still_ satisfied via `PROFILE_SIGNAL_PREDICATES` — otherwise D6's answer copy would satisfy every
question on its own and the structured transcription would be untested.

### ⚠️ `vitest` does not typecheck — again

All 25 tests passed while `pnpm typecheck` **failed**. `npx tsc --noEmit` named **5** sites under
`noUncheckedIndexedAccess`. The load-bearing fix is in the source, not the tests:

```ts
const [first] = values;
// `values` is non-empty by construction (blank answers never enter
// the index), but a scalar field must never be written `undefined` —
// that would be a present key with no value, which is neither an
// answer nor an honest omission.
if (first !== undefined) { … }
```

⚠️ Green package tests are **not** evidence of a compiling repo. Run `tsc` separately.

### Gates

`tsc --noEmit` exit 0 · package **318 passed** (13 files) · `pnpm lint` 32 · `pnpm typecheck` 32 ·
`pnpm test` 32 · `pnpm build` ok · `@age/api test` **48 passed** · `@age/api smoke:demo` →
_"OK: 6 capabilities, 6 pending approvals, accounting invariant true, 6 readiness rows with no
aggregate, no side effects."_ · `pnpm demo` → **97/63**, **12/17**, **7 populated + 5 omitted** ·
`git diff --stat apps/demo/sample-output.txt` **empty — golden file byte-identical.**

⚠️ A husky/lint-staged hook reformatted the staged files on commit; `tsc` and the package suite were
**re-run after committing** and both stayed clean.

---

## §3.1 — The review follow-up (`a68f5a7`) — a malformed QUESTIONNAIRE now throws

An independent `code-reviewer` pass returned **0 CRITICAL / 0 HIGH / 2 MEDIUM / 2 LOW**. Both MEDIUMs
were the same class and both were **acted on**, because the reviewer was right about the thing that
made them reachable: **`buildProfileFromAnswers` takes an ARBITRARY questionnaire**, not necessarily
`DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE`.

| Defect                                                          | Was                                                                       | Now    |
| --------------------------------------------------------------- | ------------------------------------------------------------------------- | ------ |
| Two questions declaring the **same `satisfiedBy`** signal       | For a `scalar` target the second answer **overwrote** the first, silently | Throws |
| A **`list`-kind** question routed to a **single-valued** signal | Every value after `values[0]` was **dropped**, silently                   | Throws |

⚠️ Both were worse than an ordinary bug: the answer is **still recorded in `sections[].answers[]`
under D6**, so the profile would look complete while the structured field held only part of what was
supplied. That is precisely the silent-loss failure this repo refuses.

⚠️ **This is NOT the D4 rule and must not be read as softening it.** An unanswered or unmapped
**QUESTION** is still never an error and still leaves the profile sparse. A **QUESTIONNAIRE** that
would make the mapper discard a value it was given is a **caller defect**, in the same class as
passing no sections at all.

**The two new guards were made to fail before being trusted.** With the duplicate check neutralised
and the kind check replaced by `false`: **2 failed | 26 passed** — exactly the two new tests, and
nothing else in the suite could tell the difference. A third test asserts the **default questionnaire
is still accepted**, so the other two cannot pass by the mapper simply throwing for everything.

The two LOWs were noted and not acted on: the `as DiscoverySectionId` assertion (the profile schema
validates section ids downstream, and the default questionnaire validates its own at definition), and
"the two MEDIUM scenarios are untested" — which the three new tests now close.

Re-verified after the commit hook: `tsc --noEmit` exit 0 · **321 passed** (13 files) · repo lint /
typecheck / test / build · `@age/api` 48 passed · smoke OK · `pnpm demo` 97/63, 12/17, 7+5 ·
`sample-output.txt` diff **empty**.

---

## §4 — What remains on this track

**Nothing.** D1–D8 are shipped.

The mapper is reachable from `@age/business-discovery-contracts` and takes real answers. What it
still lacks is a **caller** — and the caller ADR-0050 §2.2 and D7 point at is the HTTP route, which
is **deferred with named content** (§1's two blockers: authorship and scope). It is **not** "the rest
of ADR-0050" and must not be implemented under it.

⚠️ Per finding 11, do not read "nothing remains on this track" as "nothing is authorized in the
product." The next slice starts by widening the frame again, not by picking from §2.2 on sight.
