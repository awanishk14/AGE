# ADR-0049 — The intake that accepts no input

Status: Accepted
Date: 2026-08-01
Relates to: ADR-0038/0039 (canonical Path B), ADR-0044 D1 (no snapshot consumer), ADR-0046 D1/D2/D7
(the product reframe; the authentication trigger; the capture prohibition), ADR-0047 D2/D6/D7b (the
demo's single production point; `run` is never gated on context), ADR-0048 (the readiness surface)

---

## 0. How this decision was reached

### 0.1 Standing

The user's instruction, verbatim, on 2026-08-01:

> _"act as an architect and decide, i am looking for the finished product."_

This ADR is written under the standing architect grant recorded in ADR-0043 §0.1 and reaffirmed by
the mandate quoted in ADR-0048 §0.1. It was merged as PR #188 with `Status: Proposed`, which decided
nothing; **this separate PR flips it to `Accepted`**, as every ADR since 0043 has done.

Acceptance is **self-acceptance under a stated grant** — the architect's, and mine to answer for. It
is **not** a claim that the user reviewed each decision below. Nothing in §2 was changed to accept
it: D5 still withholds the HTTP route, D7 still withholds context-driven capability inputs, and both
dissents in §4 stand **recorded rather than resolved**.

⚠️ One decision here is **not** the architect's and was not taken: authentication (ADR-0046 §4).
D6 is written so that this slice does not pre-commit it in any direction.

The phrase _"the finished product"_ is the operative one. It reframes the question from _"what is
the next slice on the current track?"_ to _"what stands between this repository and something a
person can use?"_ Those have different answers, and the second one is the subject here.

### 0.2 A four-lens council, and what it found

Four lenses were convened — product-gap, an adversarial skeptic, architecture-and-sequencing, and
security-and-invariants. Per the standing council-reliability finding (§6.7 / finding 13), **every
lens was given the code, and none was given my prose.**

They converged on the facts and **split on the conclusion**. The facts, verified directly rather than
taken on the lenses' word:

- **The entire system has exactly one input, and it is a module constant.**
  `packages/demo-runtime/src/business-discovery.ts:113` opens with
  `const profile = SAMPLE_BUSINESS_DISCOVERY_PROFILE;` — not a parameter.
  `packages/demo-runtime/src/scored-bif-context.ts:31` passes the same constant to
  `produceScoredBifContext`. `runAllCapabilities()` takes no arguments at all. **There is no function
  in this repository that accepts a business's data and returns an analysis of it.** That is not a
  missing feature; it is a missing _signature_.
- The HTTP surface is two `@Get` routes — `/health` and `/demo/capabilities`. A repo-wide search for
  `@Post|@Put|@Patch|@Delete|@Body` under `apps/api/src` returns nothing. There is no write path.
- `apps/api/src/modules/` holds 23 module directories, of which 21 contain the literal string
  `scaffold only` and declare controllers with **no HTTP method decorator**, so they are not
  routable. Directory count reads as a product; route count reads as a demo.
- `apps/web/src/app/page.tsx` still says _"scaffold ready. No features yet."_ The only functional
  page is the read-only `/demo`.
- `packages/business-discovery-contracts/src/default-questionnaire.ts` is a hand-authored 12-topic /
  9-section questionnaire with `required`, `critical` and `satisfiedBy` semantics — **a product
  onboarding form expressed as data, which nothing serves and nothing collects answers into.** It is
  the strongest statement of intent in the repository.

**Two findings nobody asked for**, both recorded in §5 rather than acted on here:

1. `apps/api/src/modules/demo/application/demo.service.ts:169` publishes
   `humanApprovedExecution: true` as a **hardcoded literal**, and `pendingApproval` is
   `acceptedItems.map(...)`. A search for `approval` under `packages/capability-kit/src` returns no
   files. The pinned "6 pending approvals" baseline fact is real; **the concept behind it is not
   implemented** — there is no approval state, no approver and no transition.
2. `--passWithNoTests` survives in **31** `package.json` files, and **10 packages have zero spec
   files**, among them `packages/bif` (29 source files) — the canonical model the whole mapper
   produces. CLAUDE.md records the flag as _"REMOVED from `@age/web` and must stay removed"_, which
   is true and also reads as though the class of defect were closed. It was closed in one package
   out of thirty-one.

### 0.3 The disagreement, and how it was resolved

**The skeptic's conclusion:** authentication is the foundation, and everything else is downstream of
it — without an authenticated principal the API cannot expose a non-demo route, persistence cannot
accept a row, the web app cannot have a form, and `produceScoredBifContext` cannot be given anything
but a constant. On that reading, the last five merged PRs polished a pipeline that runs on one frozen
literal, and this ADR would be more of the same.

**This is adopted as evidence and rejected as a conclusion** (finding 8 — the lens with the strongest
facts has twice recommended the action the resulting ADR declines).

Two reasons, and the second is the decisive one:

1. **It is not available.** ADR-0046 §4's revisit trigger is explicit that authentication fires _"by
   a product decision from the user about authentication, and by nothing else,"_ and that a test
   fixture, a hand-populated table, a CLI flag, an environment variable and a mock resolver **all
   fail that trigger by construction**. Naming auth as the unblocker produces zero motion. That is
   the exact loop ADR-0043 → 0044 → 0045 got stuck in and that ADR-0046 D2 corrected.
2. **The premise is false.** Scope exists to answer _"whose row is this?"_ **If nothing is stored,
   there is no row and no question.** A stateless assessment — profile in, scores and readiness out,
   nothing persisted — needs no tenant, no principal and no scope. The skeptic's claim that
   `produceScoredBifContext` "cannot be given anything but a constant" without auth is contradicted
   by `apps/capture`, which already feeds it an arbitrary operator-supplied profile JSON in
   `produceOnly` mode, today, with no identity anywhere in the chain.

The security lens independently confirms the boundary from the other side: its minimum-viable design
requires an authenticated principal **only at the point where `ClientContext` is constructed**, and
this slice constructs none.

**The sequencing lens's conclusion is adopted:** the one dependency that unblocks the most downstream
work is the single-parameter change, because a stateless API route, a web intake form, context-driven
capability inputs, and sessions are each impossible or untestable over a constant.

**A second, narrower disagreement:** the product lens recommended shipping the parameter change _and_
`POST /discovery/analyze` as one slice. The sequencing lens split them. **The split wins** — see D5.

---

## 1. Context

AGE's pipeline is complete and, as far as it goes, correct: discovery profile → `Draft` BIF → four
scores → per-capability context readiness → capability decision objects. It is well tested and its
invariants are pinned in several places.

It is also, end to end, a function of one 140-line literal.

This has a consequence that no amount of further work on the current track can reach: **the central
claim of the system is currently unfalsifiable.** ADR-0047 and ADR-0048 built a readiness stage that
reports how well a business's context supports each capability. Every one of its outputs is a
constant. No test in the repository can distinguish _"this readiness state was derived from the
context"_ from _"this readiness state is hard-coded,"_ because with a fixed input the two are
observationally identical.

That is the gap this ADR closes, and it is why it is worth doing before anything more decorative.

## 2. Decision

**D1 — The intake stage takes the discovery profile as a required parameter.**
`runBusinessDiscoveryIntake(profile, scenario)` and
`produceDemoScoredBifContext(profile, scenario)`. The demo call sites pass
`SAMPLE_BUSINESS_DISCOVERY_PROFILE` explicitly.

**D2 — Required, not optional-with-a-default.** A defaulted parameter would preserve the exact
coupling being removed, and would leave "which business is this?" invisible at the call site. This
follows ADR-0039 D3's precedent, where the scenario metadata was made a required argument for the
same reason: the values Path B needs must be **visible where the call is made**, never invented
downstream.

**D3 — `produceDemoScoredBifContext` keeps its name.** Its scope widens from _"the sample profile
plus demo scenario metadata"_ to _"a caller-supplied profile plus demo scenario metadata"_; it
remains the demo's single `ScoredBifContext` production point (ADR-0047 D2). A rename was considered
and **rejected**: two guards in `business-discovery.spec.ts` were deliberately repointed at this
symbol and the standing record forbids repointing them again. The honesty cost of the `Demo` prefix
is smaller than the risk of moving a pinned guard.

**D4 — The pinned demo baseline stays byte-identical, and a second profile proves the pipeline
responds to its input.** 97/63 intake vs 12/17 BIF, 7 populated + 5 omitted sections, 6 capabilities,
6 pending approvals, accounting invariant OK. In addition, a test must feed a **materially different
profile** and assert the four scores and the section split **differ** from the baseline.
⚠️ This test is the point of the ADR. Without it, D1 is a refactor; with it, the pipeline's central
claim becomes falsifiable for the first time. The existing constant is retained as the pinned
regression baseline and is **not** deleted.

**D5 — No HTTP route in this slice.** `POST /discovery/analyze` is the obvious next step and is
deliberately **not** authorized here. It is the first route in the repository that would accept
attacker-controlled input, and it needs its own decision covering the untrusted-input boundary: body
size limits, whether a partially-answered questionnaire returns a result or a 400, and whether errors
may echo payload content. Bundling it here would smuggle a security boundary through on the strength
of a signature change.
⚠️ When that ADR is written it must decide the partial-answer question **in favour of returning a
result** — §5 of the standing semantics holds that insufficient context is a valid _successful_
outcome, so incompleteness must never be a 400.

**D6 — This slice persists nothing, authenticates nothing and constructs no `ClientContext`.** It
opens no `PrismaClient`, touches no schema, and crosses none of the ADR-0044 D1, ADR-0046 D1/D7 or
§3 stop conditions. It does not pre-commit the eventual authentication decision in any direction.

**D7 — Capability inputs are still not derived from context, and this ADR does not change that.**
The six capability fixtures remain unrelated to the discovery profile. Connecting them is real and
valuable work (the sequencing lens's Phase B) and needs its own ADR, because it is the first time
context would reach a capability's _inputs_ — at which point ADR-0047 D6 (`consumes` must never gain
`ScoredBifContext`) and D7b (`run` is never gated on context) come under direct pressure and must be
restated in force. ⚠️ It is also the work that D1 makes **testable**: derivation from a single frozen
profile could not be proven to be derivation at all.

## 3. Consequences

- The repository gains, for the first time, a pipeline that answers a question about **a** business
  rather than **the** business. Every subsequent product slice — an HTTP route, a web form, session
  state, approvals, context-driven capability inputs — becomes possible, and more importantly
  becomes _testable_.
- The authentication decision (ADR-0046 §4) becomes a concrete question about **retention and
  multi-tenancy** rather than an abstract blocker on existence. That is a better question to put to
  the user, and this slice is what makes it askable.
- The capture track stops being parked at zero value: it is currently cheap to park because there is
  nothing worth writing. This is the first change that creates data worth persisting.
- ⚠️ A near-term hazard: with a parameterized intake, "just persist the result" looks like a small
  step. It is not — it requires a scope, and a scope requires the principal that does not exist.
  D6 is the standing answer.

## 4. Dissent, recorded rather than resolved

**The skeptic dissents from this ADR's premise.** Its position stands on the record: the last five
PRs and this one all move data that originates in a frozen literal through pure functions to a
read-only display, the surface reads as "nearly done" because the tests and ADRs are good, and the
route count (2), input count (1) and write count (0) say otherwise. It holds that the honest move is
to put the authentication question to the user and stop building around it.

The answer is D6 plus §0.3: this slice is precisely the one that is **not** built around the auth
wall — it is built on the correct side of it, and it is what turns the auth question from abstract
into concrete. But the dissent is not dissolved, and if the next three slices also end at a read-only
display, the skeptic was right and this ADR was wrong.

**The product lens dissents on D5**, holding that a parameter nobody can reach from outside the
process is not yet product, and that the route belongs in the same slice. This is answered by
sequencing, not by disagreement on the merits: the route is next, and it is separated only so that a
security boundary gets its own decision instead of riding along with a refactor.

## 5. Recorded, not authorized

- **`humanApprovedExecution: true` is a hardcoded literal** (`demo.service.ts:169`) and
  "6 pending approvals" is a relabeling of accepted items. No approval concept exists in the code —
  the Phase 5 approval track was reverted. This must not be copied into any new surface, and closing
  it needs both an ADR and an actor identity.
- **`--passWithNoTests` in 31 packages, 10 with zero specs**, including `packages/bif`. A scope and
  test-debt decision, not part of this slice.
- **21 route-less scaffold modules** under `apps/api/src/modules/` and the placeholder
  `integrations` / `knowledge` / `sdk` / `business-knowledge-graph` packages. They make the repo look
  four-fifths finished to every future reader — including, demonstrably, three of four council
  lenses. Worth an explicit keep-or-delete decision before a 22nd real module lands beside them.
- **The blocked path carries no ADR-0027 notice in any of the three adopters** — carried forward from
  the ADR-0048 track, still a pattern-wide question.
