# ADR-0048 — Splitting ADR-0047 D8, and the rendering layer that nothing tests

Status: Proposed
Date: 2026-07-31
Relates to: ADR-0027 (context readiness), ADR-0046 (D2 — the reframe; D3 — the demo-surface track),
ADR-0047 (D1, D4, D8, D9 — the context-readiness bridge)
Corrects: ADR-0047 D8's scope-identifier warning, which was designed out by the slice D8 itself
authorized (D1 below)

---

## 0. How this decision was reached

### 0.1 Standing

ADR-0047 D8 deferred surfacing context readiness over the API, the web `/demo` page and the API
smoke script, and stated that the deferral needed its own decision rather than a guess. This is that
decision. It is merged with `Status: Proposed`, which decides nothing; a separate PR flips it to
`Accepted`, as ADR-0043 §0.1 established and ADR-0047 §0.1 followed.

Acceptance, when it comes, is **self-acceptance under the standing architect grant**. The user's
mandate, verbatim:

> _"i told you to act as an architect and take descision that makes the software robust and perform
> for whats it intended. incase of complex issue deploy council to make decision. and also keep
> creating session handover document at important checkpoint so we dont loose track and you
> continusoy work without stopping for asking me question."_

Acceptance is therefore the architect's under a stated grant. It is **not** a claim that the user
reviewed each decision below. The decisions are mine, and so is responsibility for them.

### 0.2 A four-lens council, and the finding none of them was asked for

Four lenses were convened — security-and-invariants, an adversarial skeptic,
architecture-and-sequencing, and product-and-honesty. Per the standing council-reliability finding,
**every lens was given the code and the ADRs, and none was given my prose.**

The council **did not converge**. The skeptic recommended doing nothing beyond a serialization-only
package test; the product lens argued that withholding readiness is the _less_ honest option; the
security lens agreed with D8's outcome while rejecting part of its reasoning; the
architecture lens recommended lifting the deferral **partially and not first**.

**Two lenses independently surfaced a finding nobody asked about**, and it is the reason this ADR
exists in the shape it does rather than as a simple yes/no on D8: **the web layer has no rendering
test capability at all, and Playwright runs in no CI workflow.** Verified directly rather than taken
on the lenses' word:

- `apps/web` contains exactly one spec, `tests/e2e/home.spec.ts`. There is **no test of `/demo`**.
- `jsdom`, `happy-dom` and `@testing-library` appear in **no `package.json` in the repository**,
  although `apps/web/vitest.config.ts` names `environment: 'jsdom'`.
- `apps/web`'s `test` script is `vitest run --passWithNoTests` over **zero matching files**. It is
  green **by vacuity**, and has never loaded the missing dependency it declares.
- `apps/web` declares `test:e2e: playwright test`, and **`.github/workflows/` references neither
  `playwright` nor `e2e`.** `ci.yml` runs lint, typecheck, `pnpm test`, `pnpm build` and the API
  smoke — and nothing that renders a page.

This is the ADR-0046 D2 lesson repeating exactly. The track reported itself blocked on a
scope-identifier question; the highest-value gap was somewhere else and gated by nothing.

---

## 1. Context

ADR-0047 D8 reads, verbatim:

> ⚠️ A concrete reason to keep it deferred: readiness outputs carry `clientId`/`organizationId`
> stamped from the `ClientContext` argument. Publishing those over `GET /demo/capabilities` would
> put scope identifiers in a public read-only payload for the first time. **Keep them out of the
> demo-runtime report shape entirely**, so the question stays open rather than being decided by
> omission.

Two halves of that sentence pull in opposite directions, and the slice D8 authorized resolved them.
`packages/demo-runtime/src/context-readiness.ts` was written so that `ContextReadinessEntry` has a
pinned key set carrying **no `clientId` and no `organizationId`** — the assessors' stamped scope is
dropped at the module boundary, with the rationale stated in the module itself. D8 asked to keep
scope out of the report shape; #170 did exactly that.

Separately, the "for the first time" premise was checked and **is true**: `toReport()` builds
`CapabilityRunReport.acceptedItems` from `output.items` only, and `CapabilityOutputItem` carries
`id`, `capability` and `createdAt`. Scope is stamped on the `CapabilityOutput` **envelope**, which no
projection reads. Nothing in the public demo payload carries a scope identifier today.

---

## 2. Decisions

### D1 — D8's scope-identifier question is CLOSED BY SHAPE, not deferred. This is errata.

`ContextReadinessReport` and `ContextReadinessEntry` carry no scope fields. There is nothing to
strip, and no new decision is required about publishing scope identifiers in order to publish
readiness. D8's warning described a risk that the slice D8 authorized designed out.

⚠️ **Do not re-open this as though it were live.** Re-asking it invites re-litigating a settled
design and re-deciding it the other way by accident.

### D2 — Scope identifiers may NEVER reach a public read-only payload. Permanent, not deferred.

The demo scope values are static synthetic fixtures in a public repository, so publishing them leaks
nothing today. That is exactly why the rule must be stated now rather than inferred later: the demo
DTO shape is the template a real, authenticated, multi-tenant deployment would inherit, and there is
**no auth on the demo route at all** (a deliberate track-wide property, ADR-0046 D3) to contain the
blast radius. Synthetic-ness defers a risk; it does not remove one.

### D3 — D8 is THREE deferrals, not one. API and smoke lift; web does not.

Lifting them as a unit is the error. Smoke and API are server-side, projected field-by-field, and
testable today. The web page is the only one of the three that carries the hazard ADR-0047 was
written for — and it is the only one with no way to test that the hazard was avoided.

### D4 — Web rendering stays deferred until a rendering test runs IN CI.

Not until a harness is installed — until it **executes in `ci.yml`**. A `test:e2e` script that no
workflow invokes is indistinguishable from no test, and a `--passWithNoTests` run over zero specs
reports success for a package whose invariants nothing checked.

This is not a general "add tests" wish. `apps/web/src/app/demo/page.tsx` states binding ADR-0046
slice-1 presentation invariants — _never summed, averaged or shown as one headline number_, _omitted
sections as neutral limitations, never warnings_ — **as comments.** Nothing enforces them. ADR-0047's
central finding is that **the hazard is in the rendering, not the wiring**; the repository's only
rendering layer is the one layer that cannot test rendering. Adding a fourth set of presentation
rules there first is backwards.

⚠️ A concrete mechanism, not a hypothetical: `CapabilityCard` already renders
`Notice ok={report.accountingHolds}` with a green/amber class pair. Reusing that component for a
readiness state is one prop away, and would violate ADR-0047 D4's ban on a colour scale **by
component reuse rather than by anyone deciding to.**

### D5 — The unprojected item passthrough is fixed BEFORE readiness reaches the API.

`toDemoReport` passes `acceptedItems`, `rejectedReasons` and `duplicateReferences` through verbatim,
typed `readonly unknown[]` in the DTO — thirty lines below `toBusinessDiscoverySummary`, whose
docstring states the opposite discipline as deliberate: _"the runtime summary is free to grow fields
that the read-only endpoint has not decided to expose, and a spread would publish them silently."_

D8 rested its confidence on that discipline. The discipline is real for the discovery block and
absent one function below it. Repairing the premise comes before adding a block that relies on it.

⚠️ Narrowing a published payload is an **API-visible change**, taken knowingly. It is the correct
direction: an endpoint that publishes whatever a capability happens to emit has no shape.

### D6 — Publishing `thresholds` makes a threshold change an API-visible break. Accepted knowingly.

ADR-0047 D4 forbids showing a state without its own adjacent `requiredSectionTypes` and
`thresholds`, so a readiness surface that omits thresholds to protect the API contract would violate
the rule it exists to satisfy. Thresholds ship. The break is stated here rather than discovered
later.

### D7 — No aggregate, on any surface, ever. Carried forward unchanged.

ADR-0047 D4 binds every surface, not just the CLI: fixed registry order, each state adjacent to its
own denominator, no count spanning capabilities, no ordinal colour scale. The three states are
incommensurable in **denominator**, not threshold.

### D8 — What this ADR does NOT authorize

Capture writes (ADR-0046 D7 prohibition stands) · auth · a client registry (ADR-0046 D1) · snapshot
readers · any change to the three assessors · reordering or aggregating readiness states · removing
the scope-stripping at the `context-readiness.ts` boundary.

---

## 3. Sequence

1. **This ADR**, `Proposed` then `Accepted`.
2. **`toDemoReport` item projection** (D5) — server-side, provable by the existing API spec and the
   smoke script.
3. **A web rendering test that runs in `ci.yml`** (D4), pinning the ADR-0046 slice-1 invariants that
   are comments today.
4. **API + smoke readiness block** (D3), field-by-field, no aggregate. `DEMO_SCENARIO_METADATA`
   already supplies `constructedAt`, so ADR-0047 D3's "never `new Date()`" needs no new decision.
5. **Web rendering last**, on a harness that can prove D4.

Steps 2 and 3 are blocked by nothing.

---

## 4. Recorded dissent

**The skeptic lens recommended doing none of this.** Its argument, kept because it is not answered
by the decisions above: an API test exercises the same three assessors against the same fixture the
demo-runtime spec already pins, so the only genuinely new fact is serialization — one assertion, not
a slice. A web test would assert that JSX prop-drilling works, which is a fact about React rather
than about this system. It held that "the CLI already renders it, so two more surfaces is
incremental" mistakes surface-count for the variable that matters.

**This is only partly resolved.** D3 and D5 accept the force of it — which is why the API step is
scoped to a projection repair rather than a feature, and why web is gated rather than sequenced. It
is **not** resolved for step 4: the skeptic is probably right that the readiness block on
`GET /demo/capabilities` is low-value on its own, and it is authorized here mainly so that step 5
has something to render.

**The product lens dissented in the other direction**, and its point is unresolved too: all six
capabilities currently render as identical cards with per-item confidence scores in the 66–70 range,
while the underlying BIF confidence is 17. It argued that withholding readiness does not avoid
making a trust claim — it lets the existing display make an implicit one that the codebase itself
contradicts. D4 accepts this as real and still gates it, on the grounds that shipping an untestable
rendering of it is not a repair.

Both dissents point at step 5. Neither is dissolved by deferring it.
