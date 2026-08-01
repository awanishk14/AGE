# ADR-0052 — The questionnaire nobody can answer

Status: Proposed
Date: 2026-08-01
Relates to: ADR-0026 D4 (missing sections are limitations, never negative evidence), ADR-0046 D7
(no capture writes), ADR-0047 D4 (no ordinal colour scale) and D9 (`clientContext` is not
parameterised), ADR-0048 (the readiness surface, and D4 on `@age/web`'s test gate), ADR-0049 D2
(the profile is a required input), ADR-0050 D1–D8 (`buildProfileFromAnswers`) and its D5/D7
deferral, ADR-0051 D1–D4 (the questionnaire pins the enums) and its dissent 2

---

## 0. How this decision was reached

### 0.1 Standing

This ADR is written under the standing architect grant recorded in ADR-0043 §0.1 and reaffirmed by
the mandate the user gave on 2026-07-30, quoted verbatim:

> _"i told you to act as an architect and take descision that makes the software robust and perform
> for whats it intended. incase of complex issue deploy council to make decision. and also keep
> creating session handover document at important checkpoint so we dont loose track and you
> continusoy work without stopping for asking me question."_

Acceptance under that grant is the architect's. It is **not** a claim that the user reviewed each
decision below.

### 0.2 How the alternatives were weighed

The four standing lenses (architecture · skeptic · sequencing · security-and-invariants) were
applied to the two candidate surfaces by the author rather than by dispatched sub-agents, because
the deciding facts were already on the record — ADR-0050's two named blockers and ADR-0051 §2.1.
**The disagreement this produced is recorded in §4 rather than dissolved**, per finding 8: a
position's evidence and its conclusion are adopted separately.

---

## 1. The defect

`buildProfileFromAnswers` (ADR-0050 D1–D8, #194) and the enum-pinning questionnaire (ADR-0051 D1–D4,
#202) are both shipped, both correct, and **both have no caller**. Every slice on this track has
ended with the function still uncalled, and each time the reason given was that the next layer was
not yet authorized.

🚫 **Constructible is not reachable** — #196 upheld exactly this charge against ADR-0050 §3, and
ADR-0051's dissent 2 stated that #202 was **the last deferral the "still no caller" argument can
carry**, and that a further one "should be treated as evidence the track is avoiding the user rather
than serving them."

The defect is therefore not in any package. It is that **no human being can answer the
questionnaire.** There are 13 routable signals, a validated questionnaire that can express every
enum the profile requires, a transcribing mapper that refuses to infer, and a completeness scorer —
and no surface through which a person can supply a single answer.

⚠️ **This is not a request to build "the product".** It is the smallest slice that turns a
parameterised signature into one a person can actually point at.

---

## 2. Decisions

### D1 — The surface is a client-side `/discovery` page in `apps/web`

The page renders `DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE`, collects answers in React state, and on
submit calls `buildProfileFromAnswers` followed by `calculateBusinessDiscoveryCompleteness`. The
result is rendered on the same page.

**Nothing is sent to a server. Nothing is persisted. The page holds no state across a reload.**

### D2 — `apps/web` gains a dependency on `@age/business-discovery-contracts`

This is the decision the form was blocked on, and it is taken here deliberately rather than
absorbed silently.

⚠️ **The alternative — re-declaring the questions inside `apps/web` — is REJECTED.** That is the
second-fixture hazard #190 named: two copies of the questionnaire is exactly how the enum pins, the
`satisfiedBy` routing and the pinned baseline drift apart without anything failing. The questionnaire
**is** the contract; a surface that renders a copy of it is not rendering the contract.

Accepted cost: `zod` and the contracts package enter the client bundle. See dissent 1.

### D3 — NO BIF is produced. `produceScoredBifContext` is not called.

This is what makes the slice possible at all, and it is a decision, not an omission.

ADR-0050 D5/D7 deferred the HTTP route with **two named blockers**: (a) Path B stamps `changedBy` and
`constructedAt` onto **every `FieldVersion`**, so an unauthenticated caller has no honest value and a
fixed constant is the same fabrication with a shorter blast radius; (b) `buildContextReadinessReport`
carries a hardwired `demoContext` that would stamp a demo scope onto a real business's data.

By stopping at **answers → profile → completeness**, this slice reaches **neither**: there is no
`FieldVersion` to stamp and no readiness report to scope.

⚠️ **The blockers are AVOIDED, not solved. They stand undiminished**, and the next slice that wants a
BIF must still answer them. Do not cite this ADR as evidence that they have been addressed.

### D4 — `id` and `capturedAt` are supplied by the page, and this is not a precedent

ADR-0050 D5 requires the caller to supply both — no wall-clock inside the mapper, no generated id,
never optional-with-a-default. The page supplies:

- `capturedAt` — the browser's clock at submit. This is **honest**: it genuinely is when the answers
  were captured, by the person who captured them.
- `id` — a client-generated identifier that names nothing outside the page and is discarded with it.

⚠️ **This is NOT a precedent for `changedBy`.** There is no authenticated principal here, this slice
claims none, and it writes nothing anyone else will read. ADR-0049 §0.3's _"stores no row → no scope
question"_ is sound for **scope** and does not extend to **authorship** — that remains true, and
nothing here stretches it.

### D5 — What is rendered, and what must never be added

Rendered: the completeness score and its band, the per-section breakdown as published, and counters
for what was transcribed and what was left unanswered.

🚫 **No aggregate beyond the published score, no sort, no grouping, no colour scale** (ADR-0047 D4,
ADR-0048). Sections render in questionnaire order. ⚠️ Do not "finish" this surface with a progress
ring, a red/amber/green treatment, or a "sections still to do" ranking — an ordinal colour scale
reached by component reuse is still an ordinal colour scale.

⚠️ **The state is never rendered through `Notice`**, for the reason ADR-0048 gives: `Notice` is an
emerald/amber pair off a boolean.

### D6 — An incomplete form is a valid SUCCESS, never a blocked submit

Per ADR-0050 D4 and ADR-0026 D4: unanswered questions leave the profile sparse and are reported as a
**limitation**, never as negative evidence and never as a validation error that prevents submission.

The only failure surfaced is the mapper's own throw for **no answer satisfying `businessName`**, and
it is stated as what it is — a missing required answer — not as a conclusion about the business.

### D7 — Guards, each made to fail before being trusted

At minimum: `@age/web` must not import `@age/bif`; `new Date(` must appear in exactly one named
submit path and nowhere else in the page; the rendered output contains no comparator and no sort; the
questionnaire rendered is `DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE` itself, not a local copy.

⚠️ Each guard is evidence only once mutated, confirmed to name the mutation, and restored.
⚠️ `--passWithNoTests` stays **removed** from `@age/web` (ADR-0048 D4); these specs must actually run.

### D8 — Still deferred, and still needing their own ADRs

`POST /discovery/analyze` · any persistence · any authorship · any scope · authentication · anything
that produces or promotes a BIF from real input. **None of these is authorized by this ADR.**

---

## 3. What this deliberately does not claim

- It does **not** make the discovery→BIF pipeline reachable from real input. It makes the
  **profile** reachable. Those are different, and conflating them is the ADR-0050 §3 failure.
- It does **not** resolve the two ADR-0050 blockers (D3).
- It does **not** authorize a `/discovery` surface that saves, shares or transmits anything.

---

## 4. Dissents, recorded not dissolved

**Dissent 1 — the architecture lens.** A client-side-only page ships `zod` and a contracts package
into the browser bundle for a page that throws its output away. That is a real, permanent cost paid
for a surface with no persistence. **Answer:** accepted as a cost, rejected as a blocker — the
alternative is a duplicated questionnaire, which is the failure mode this whole track exists to
prevent. If bundle size later matters, the fix is a code-split route, not a second copy of the
questions.

**Dissent 2 — the skeptic.** "Reachable" is being claimed for a page whose output is discarded on
refresh; a demo with extra steps is still a demo, and the track may simply have found a
lower-ceremony way to defer the same question a fourth time. **Answer:** partially upheld, and worth
stating plainly. What changes is not the ceremony but **who can supply the input**: for the first
time a person can put their own business into the questionnaire and see what the mapper does and does
not transcribe. That the output is discarded is not an accident — it is precisely what keeps
authorship, scope, persistence and auth out of this slice. ⚠️ But the skeptic's ceiling stands: **the
next slice on this line cannot also be one that discards its output.**
