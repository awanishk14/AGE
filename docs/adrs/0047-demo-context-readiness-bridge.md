# ADR-0047 — The context-readiness bridge, and why the hazard is in the surface rather than the wiring

Status: Accepted
Date: 2026-07-31
Relates to: ADR-0026 (capability context consumption), ADR-0027 (context readiness), ADR-0028
(registry metadata), ADR-0039 (demo scenario metadata), ADR-0046 (D3 — the demo-surface track)
Corrects: the record in the untracked handover §4.4 (two factual errors, §5 below)

---

## 0. How this decision was reached

### 0.1 Standing

ADR-0046 D3 authorized three slices and named this one — gap **G1**, the context-readiness bridge —
as requiring **its own `Status: Proposed` ADR before any code**. This is that ADR. It was merged as
PR #168 with `Status: Proposed`, which decided nothing; **this separate PR flips it to `Accepted`**,
as ADR-0043 §0.1 established.

Acceptance is **self-acceptance under the standing architect grant**. The user's mandate, verbatim:

> _"i told you to act as an architect and take descision that makes the software robust and perform
> for whats it intended. incase of complex issue deploy council to make decision. and also keep
> creating session handover document at important checkpoint so we dont loose track and you
> continusoy work without stopping for asking me question."_

Acceptance here is therefore the architect's under a stated grant. It is **not** a claim that the
user reviewed each decision below. The decisions are mine, and so is responsibility for them.

Nothing in §2 was changed to accept it. In particular D8 still **defers** API, web and smoke, and the
skeptic's dissent in §3 stands recorded rather than resolved.

### 0.2 A three-lens council, and what it changed

Three lenses were convened — security-and-invariants, an adversarial skeptic, and
architecture-and-sequencing. Per the standing council-reliability finding, **every lens was given the
code and the ADRs, and none was given my prose.**

**All three disagreed with my framing in at least one material respect**, and two of the corrections
were to statements the handover recorded as established fact (§5). The lenses **did not converge on a
recommendation**: the skeptic recommended a materially reduced slice on the grounds that the wiring is
self-confirming, while the architecture lens recommended a new module and treated the bridge as a
genuine third pipeline stage. That disagreement is resolved in D1 and D8, and the skeptic's dissent is
recorded rather than dissolved.

---

## 1. Context

Three of six capabilities adopt the ADR-0027 readiness pattern — Intelligence
(`assessBusinessContext`), Market Discovery (`assessMarketContext`) and Revenue
(`assessRevenueContext`). All three share the signature
`(ClientContext, ScoredBifContext, { producedAt: Date })`.

**They have zero non-test callers.** The pattern is written and never read — the same shape as the
standing "nothing READS snapshots" residual (ADR-0044 D10).

Meanwhile `packages/demo-runtime/src/business-discovery.ts:120` **produces a real `ScoredBifContext`
and discards it**, destructuring `{ context, mappingMetadata }` and returning only scalar counters.
The demo therefore builds the exact input the readiness pattern wants, and throws it away.

### 1.1 The hazard, stated precisely

ADR-0027 D1 forbids an assessment to:

> **must not** derive, rank, score, shortlist, name or hint at any plan, opportunity, action or
> recommendation, in items or in summary text

**Three of those six verbs — rank, score, shortlist — are acts of a presentation layer, not of an
assessment function.** The constraint is written on the assessor, and each assessor obeys it. But the
acts it names are precisely what a surface performs when it puts three capabilities' readiness states
in one column.

This is sharpened by a fact about the assessors themselves: their states are **incommensurable by
ADR-0027 D2's own reasoning**, which declined a shared threshold because it "would assert they are the
same, which nothing has established." They differ in _denominator_, not merely in threshold —
Market Discovery requires `icp_personas, products_services, market_competition`; Revenue requires
`icp_personas, products_services, gtm_system`; Intelligence uses no required set at all and judges
every present section. A rendered row reading `partial / insufficient / partial` asserts a shared
scale that three ADRs went out of their way not to create, and on the sample context (root confidence
**17**) it would be a shortlist derived from near-absence.

**The wiring is not the dangerous part. The rendering is.**

---

## 2. Decisions

### D1 — The bridge is a new, separate demo-runtime module; it is not folded into either existing stage

A new `packages/demo-runtime/src/context-readiness.ts`, exported from the barrel, representing a third
pipeline stage: **intake → context readiness → capability runs.**

Rejected alternatives, both for contract reasons rather than taste:

- **Inside `runAllCapabilities`** — its return contract is accepted/rejected/duplicate accounting plus
  `accountingHolds`. A readiness assessment has no such disposition, so folding it in would force fake
  zeros into the accounting fields or make `accountingHolds` meaningless for three of six rows — and
  the demo baseline pins "6 capabilities, 6 pending approvals, accounting invariant OK". It also takes
  no arguments today; adding a context parameter makes it a different function.
- **Inside `business-discovery.ts`** — that module is explicitly the _intake_ stage and "NOT a
  capability run". Importing three capability classes there inverts the pipeline direction and puts
  capability thresholds inside the module the demo prints as "discovery".

### D2 — The context is exposed by a separate producer function, NOT by widening the intake summary

`runBusinessDiscoveryIntake` must **not** grow a `context` field. `BusinessDiscoveryIntakeSummary` is
the four-score contract that pins **97/63 intake vs 12/17 BIF** across three surfaces, and it is
projected field-by-field into a published API DTO. Widening it drags this slice into the API layer and
its tests for no benefit.

Instead: extract the production into a function both stages call, so the context is produced **once**.
A second `produceScoredBifContext` call is pure and would be _correct_, but it recreates precisely the
hand-assembled-in-two-places problem `produceScoredBifContext` exists to prevent.

### D3 — `producedAt` is a required parameter supplied at the call site; no clock, no new frozen field

All three assessors refuse to run without a caller-supplied `producedAt` and read no clock. The demo
has no such value: `DEMO_SCENARIO_METADATA` is frozen with `organizationId`, `constructedAt`,
`changedBy` and nothing else, and `apps/demo/sample-output.txt` commits in writing that "the
`createdAt` envelope timestamp is the only non-deterministic field between runs."

Decision: the new function takes `producedAt` as a **required parameter**, and `apps/demo` passes
`DEMO_SCENARIO_METADATA.constructedAt`. This honours ADR-0039 D3 — scenario values are passed
explicitly at the call site rather than reached for from inside — and requires **no fourth field on
the frozen metadata and no ADR-0039 amendment.**

⚠️ `Object.freeze` there is **shallow**, so the `Date` is mutable. Pass a copy.

⚠️ **Never `new Date()`.** A readiness envelope stamped with a live clock would make
`sample-output.txt`'s determinism note false, and the fix would then be to hand-filter output to
protect a golden file — spending a decision on plumbing.

### D4 — The surface must not rank. This is the decision this ADR exists for

Binding on every rendering, now and later:

- **Fixed order**, the existing six-capability registry order. No sort, no grouping, no reordering by
  state.
- Each state is rendered **adjacent to its own `requiredSectionTypes` and its own `thresholds`**, both
  already present in every summary. A state shown without its denominator invites the comparison
  ADR-0027 D2 refused.
- **No aggregate of any kind** — no "overall readiness", no combined score, no "2 of 3 ready", no
  "most ready", no badge or colour scale. Any number that is a function of more than one capability's
  readiness invents the shared scale.
- The incommensurability is **stated on the surface**, not left implicit.
- ⚠️ `ready` gets special care: ADR-0027 closes with `ready` "never means a BIF may be promoted." A
  surface showing `ready` beside a `Draft` BIF invites exactly that read. **Never promote BIF status.**

### D5 — Non-adopters render from declared metadata, never as a deficiency

The kit already answers this and the answer is copied, not invented: `assessesContext` is "Optional
and additive: `undefined` means the capability assesses no external context — the correct default for
a non-adopter."

- Drive the list from the **six registry entries**, not from a hardcoded list of three. `undefined`
  renders as _"does not assess external context"_ — a declared property, not an absence the demo
  noticed.
- **Never** emit a null, `0`, or `"N/A"` readiness score for them, and **never** a defaulted
  `sufficiency`: omitted stays `undefined`. There is no honest value to put there.
- Non-adoption is never rendered as lower priority or lesser capability.

### D6 — `CapabilityRegistryEntry.consumes` must not change, and this slice is the pressure that would change it

ADR-0027 D3 keeps context consumption out of the registry _because_ that metadata feeds the read-only
demo registry. This slice creates the exact pressure to add `ScoredBifContext` to `consumes` so the
demo can label a readiness column. **It must not be added.** `consumes` means "inputs `run`
requires"; adding it would assert a precondition on `run` that does not exist. Pinned by a test (D7e).

### D7 — The invariant tests, written and FAILING before any wiring exists

Five, none of which counts items:

- **(a) Vocabulary scan over demo-authored strings.** The existing regexes scan the _assessors'_
  return values; nothing today constrains prose the demo layer authors. Walk the new report object
  recursively for every string leaf plus the CLI's rendered stdout, and apply the union of the two
  existing patterns. ⚠️ **Assert the collected set is non-empty first**, or an empty walk reports
  compliance. Exemptions only by full-substring match for the sanctioned notices — never by loosening
  the pattern.
- **(b) Run-independence, by injection rather than inspection.** Feed a context that forces `blocked`
  (`contextVersion: '2.0.0'`) and assert the six capability run reports are **byte-identical** to those
  produced with the sample context. If any run output moves when readiness moves, `run` is gated. A
  source-scan for "does `run` import assess" would **not** catch this, because the gate would live in
  demo-runtime, not in the capability.
- **(c) Ordering invariance.** With a context that flips the three states relative to each other,
  assert emitted order and every label are unchanged and only the state values differ. This is the
  mechanical test for D4.
- **(d) No aggregate.** Assert no key in the readiness report matches
  `/count|total|score|rank|top|best|overall/i` across capabilities, and that each entry carries its own
  `thresholds` and `requiredSectionTypes` **by value identity**, so a shared constant cannot be
  substituted silently.
- **(e) Registry unchanged.** Assert no `CapabilityRegistryEntry.consumes` contains `ScoredBifContext`,
  repo-wide, with a first assertion that the walk found all six entries.

⚠️ **Scan content, never `items.length`** — and for a reason that differs per capability (§5).

### D8 — API, web and smoke are DEFERRED; the slice is demo-runtime plus the CLI

The skeptic lens argued for stopping before any human-visible artifact. It is overruled on the CLI and
**upheld on API/web**, for its own reason: the demo response DTO projects field-by-field precisely so
the runtime can grow fields the endpoint has not decided to expose. So a demo-runtime slice lands with
**zero** API/web changes and zero risk of accidental exposure — there is no forcing function, and
therefore no reason to spend the decision now.

⚠️ A concrete reason to keep it deferred: readiness outputs carry `clientId`/`organizationId` stamped
from the `ClientContext` argument. Publishing those over `GET /demo/capabilities` would put scope
identifiers in a public read-only payload for the first time. **Keep them out of the demo-runtime
report shape entirely**, so the question stays open rather than being decided by omission.

### D9 — The scope divergence is RECORDED, not reconciled

`demoContext` is `client-demo-001` / `org-demo-001`. The produced BIF is authored under
`DEMO_SCENARIO_METADATA.organizationId` = `demo-scenario-organization`. `ScoredBifContext` carries
**no** clientId or organizationId — scope does not survive the projection — and the assessment stamps
scope from the `ClientContext` argument alone.

So the assessment's _findings_ are correct regardless of which context is passed; only the envelope
diverges. Decision: **pass `demoContext` unchanged** (it is the declared demo scope, already
authoritative for all six runs) and **pin the divergence in a test as intentional.**

⚠️ Do **not** "align" them by constructing a context from the scenario org: ADR-0039 says that value
"is not a tenant, it is not scope, and it must never be treated as one." Aligning would promote
scenario framing to scope — strictly worse than the divergence. If the divergence is ever judged
unacceptable, that is an ADR question about which value is scope, not a code tweak.

---

## 3. The dissent, recorded

The skeptic lens recommended **not** doing the demo-runtime wiring at all, and its evidence is strong
enough to survive the decision that overrules it:

The three readiness specs already call the assessors with `produceScoredBifContext(
SAMPLE_BUSINESS_DISCOVERY_PROFILE, …).context` — **the same fixture and the same function the demo
calls** — and already pin the outcomes hard (`Partial`, confidence 17, completeness 12, 7 present
sections, supported `['products_services']`) across ~1,700 lines. A demo test asserting the demo prints
"partial" takes its oracle from the same code path. That is self-confirming, and the only genuinely new
fact is that the two packages compose without a type or version mismatch — one assertion, not a slice.

**Why it is overruled, narrowly:** the value is not in proving the assessors work. It is that the
product's honesty surface currently demonstrates four bare numbers and stops. The readiness pattern is
the thing that says _what the product cannot yet conclude and why_, and a pattern with no caller is
indistinguishable from a pattern that does not work. ADR-0046 D3 named G1 a real gap for that reason.

**But the dissent shapes the slice:** the value is concentrated in the CLI-visible artifact, not in the
wiring, which is why D8 defers API/web rather than treating the surface as a natural next step. And the
dissent's determinism objection was decisive — it produced D3.

---

## 4. Consequences

- ADR-0027's pattern gains its first non-test caller. The "written but never read" residual **narrows
  to the snapshot readers only**, and must not be reported as closed generally.
- The demo grows a third stage; `sample-output.txt` must be regenerated, **keeping its trailing
  `createdAt` determinism note** — a plain redirect drops it.
- `run` remains ungated, and D7b is the only test that can prove it.
- The thresholds become visible in a committed golden file for the first time. That is accepted at CLI
  scope and is exactly why D8 keeps them out of the published API shape, where a later threshold change
  would become an API-visible break.

---

## 5. Errata — two facts the record had wrong

Both were recorded as established in the untracked handover §4.4 and are corrected here, because the
invariant test in D7 would have been written wrong from either.

1. **`output.items` is not uniform across the three.** Intelligence **can be non-empty** — it builds
   `BusinessContextSupportItem[]` and returns them. Market Discovery and Revenue are **structurally
   always empty**: `items: []` at both return sites, typed with the base `CapabilityOutputItem` because
   there is no item shape they could legitimately emit. So a length check is _wrong_ for Intelligence
   and _vacuous_ for the other two. "Check content, never length" was the right rule for the wrong
   reason.

2. **Only two of the three have a forbidden-vocabulary scan.** Market Discovery and Revenue have one;
   **Intelligence does not.** Intelligence is therefore simultaneously the only assessor that emits
   items and the only one with no vocabulary guard — the least-defended path in the set, and the one
   D7a must cover most carefully.

⚠️ Adding a vocabulary scan to Intelligence's own spec is a **separate capability-package change** and
is deliberately **not** in this slice. Recorded here as an open follow-up so it is not lost.

---

## 6. Open questions

1. Whether `demoContext` or `DEMO_SCENARIO_METADATA.organizationId` is the demo's real scope (D9
   records the divergence rather than deciding it).
2. Whether Intelligence should gain the vocabulary scan its two peers have (§5).
3. Whether readiness ever reaches the API/web surface, and if so whether the scope identifiers in its
   envelope are stripped (D8).
