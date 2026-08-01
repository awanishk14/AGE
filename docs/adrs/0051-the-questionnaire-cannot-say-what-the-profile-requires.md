# ADR-0051 — The questionnaire cannot say what the profile requires

Status: Proposed
Date: 2026-08-01
Relates to: ADR-0026 D4 (missing sections are limitations, never negative evidence), ADR-0027
(context readiness), ADR-0047 D4 (no ordinal colour scale), ADR-0049 D1/D2 (the profile is a
required input), ADR-0050 D1–D8 (`buildProfileFromAnswers`) and ADR-0050 §3 erratum

---

## 0. How this decision was reached

### 0.1 Standing

This ADR is written under the standing architect grant recorded in ADR-0043 §0.1 and reaffirmed by
the mandate the user gave on 2026-07-30, quoted verbatim:

> _"i told you to act as an architect and take descision that makes the software robust and perform
> for whats it intended. incase of complex issue deploy council to make decision. and also keep
> creating session handover document at important checkpoint so we dont loose track and you
> continusoy work without stopping for asking me question."_

It is `Status: Proposed` and **decides nothing yet**. Per the established process (#88→#89 through
#192→#193) it is merged to record the decision request; a separate PR flips it to `Accepted`.

### 0.2 The four-lens council

Four lenses were convened to widen the frame per **finding 11** — _"nothing is authorized" is
usually about a TRACK, not the product_ — rather than to pick from any recorded list. Per
**finding 13**, every lens was given the code and none was given my prose. Two of the four findings
have already been acted on and are **not** part of this ADR:

- **The skeptic** charged that ADR-0050 §3 claimed a reachability the code does not support.
  **Verified and correct** — fixed by the §3 erratum in PR #196. One half of its charge was
  **examined and rejected**: `run.spec.ts`'s pinning regex constrains the demo CLI, not the
  function, and the erratum says so to stop it being loosened later.
- **The security-and-invariants lens** found that the `@age/bif` capability ban was guarded in three
  of six packages, and that append-only had no committed source guard outside the path-gated DB
  workflow. **Both verified and closed** — PR #197 and PR #198. Neither needed an ADR: the
  decisions were already made and written down, and only their enforcement was partial.

This ADR is about the remaining two lenses, which **disagree about what comes next**.

### 0.3 The disagreement

- **The architecture lens** picked the questionnaire's expressive gap (§1 below).
- **The sequencing lens** picked rendering `DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE` as a
  client-side form at `/discovery` in `apps/web`, reporting validation and completeness only, with
  no BIF production and no HTTP route. Its structural insight is sound and is adopted as evidence:
  **the constraint boundary runs between validation/completeness — which are free of authorship and
  scope — and BIF production/readiness, which are not.**

Per **finding 8**, the sequencing lens's evidence is adopted and its **conclusion is deferred**,
because the two picks collide (§2, D5).

---

## 1. Context — the defect, verified against the code

ADR-0050 shipped `buildProfileFromAnswers`. Two of the thirteen `PROFILE_SIGNALS` are declared
`untranscribable` in `PROFILE_SIGNAL_TARGETS`, and the stated reason is correct in both cases:

- `Offering.type` is a required `OfferingKind` (`'product' | 'service'`) that no answer supplies.
- `EvidenceSourceRef.kind` is a required `EvidenceSourceKind`
  (`'client-statement' | 'document' | 'url'`) that no answer supplies.

That was the right call for ADR-0050 — inventing either value would be inference, which D2 forbids.
But it has consequences that were not visible until the mapper existed. All four checked directly:

1. **Every answers-built profile has `evidenceSources: []`.** `completeness-scoring.ts` applies
   `noEvidenceCap: 35` on exactly that condition, so **confidence is hard-capped at 35** no matter
   how completely and honestly the questionnaire is answered.
2. **The band follows.** `CONFIDENCE_BAND_CAPS` is `[[60,'strong'],[40,'usable'],[0,'partial']]`, so
   a 35 is **always `'partial'`** — the lowest band, unreachably far from the sample profile's
   pinned 63.
3. **`products_services` is always omitted.** `business-discovery-to-bif.ts` maps
   `SectionType.ProductsServices` from `offerings`, which is always empty.
4. **Two capabilities are therefore structurally not-ready.** `assess-market-context-readiness.ts`
   and `assess-revenue-context-readiness.ts` both require `'products_services'`.

⚠️ **This is not a scoring bug and must not be "fixed" in the scoring layer.** The scores are
correct: the profile really does contain no evidence and no offerings. ADR-0026 D4 holds — this is a
**limitation**, reported honestly. The defect is upstream: **the questionnaire has no way to ask.**

⚠️ Nor is it a reason to relax ADR-0050 D2. Populating `type` or `kind` by inspecting prose is
exactly the inference D2 prohibits, and remains prohibited.

### 1.1 The mechanism already exists and is unused

`DISCOVERY_QUESTION_KINDS` is `['text', 'longText', 'list', 'choice']` and
`BusinessDiscoveryQuestionnaireQuestion` already carries an optional `choices?: readonly string[]`.
**Zero of the 14 questions in `DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE` use `kind: 'choice'`.** The
contract for asking a closed question was built and never used.

---

## 2. Decisions (proposed)

**D1 — The gap is a questionnaire defect, fixed in the questionnaire.** Not in the mapper, not in
scoring, not in the readiness assessors. The profile shape and the caps stay exactly as they are.

**D2 — The enum is declared on the QUESTION, never derived from the ANSWER.** A question that
collects offerings pins the `OfferingKind` it collects; "List the products you sell" carries
`satisfiedBy: 'offerings'` **and** the fixed kind `'product'`, and a second question collects
services. The operator's answer supplies only the names.

This is the load-bearing choice, and it is what keeps ADR-0050 D2 intact:

- the **questionnaire author** makes the classification, once, at design time, visibly in data;
- the **operator** transcribes names verbatim, exactly as today;
- the **mapper** still never inspects prose and still never infers.

⚠️ The rejected alternative is asking the operator "do you sell products or services?" and applying
the answer to every offering. That reads like transcription and is not: it manufactures per-entry
precision from a whole-business statement, and an operator who sells both has no honest answer.

**D3 — Same treatment for evidence sources.** A question collecting document references pins
`kind: 'document'`; a URL question pins `'url'`; a question capturing what the client said pins
`'client-statement'`. This is what lifts `evidenceSources` off empty, and therefore what lifts the
35 cap — **by making the evidence real, not by relaxing the cap.**

⚠️ `'url'` remains **a plain reference string, never fetched** (the enum's own docblock, and §3's
no-URL-fetching boundary). Nothing here authorizes retrieval.

**D4 — `PROFILE_SIGNAL_TARGETS` loses `untranscribable` for these two, and for nothing else.** The
remaining prohibitions — `description`, `valueProposition`, `industry`, `companySize`, `geography`,
`note`, `horizon` — stay never-populated. A test must pin that the untranscribable set shrank by
exactly these two.

**D5 — The `/discovery` form is BLOCKED behind D1–D4, and this is the ordering ruling.** The
sequencing lens's slice is well-scoped and its constraint analysis is right. But it renders
`calculateBusinessDiscoveryCompleteness` output — which is precisely where the 35 cap lives. Shipped
first, it would tell **every honest user "confidence 35, partial"** however completely they answer,
and the obvious-looking fix at that point is to soften the cap. Fixing what the questionnaire can
express first means the form reports a number that can actually move.

⚠️ Do **not** read this as authorizing the form once D1–D4 land. It needs its own ADR: `apps/web`
does not depend on `@age/business-discovery-contracts` today, and that dependency is itself a
decision.

**D6 — Nothing here touches authorship, scope, persistence or the HTTP route.** ADR-0050 D5/D7's
two named blockers are untouched and still binding: Path B stamps `changedBy`/`constructedAt` onto
every `FieldVersion`, and `buildContextReadinessReport`'s hardwired `demoContext` would stamp a demo
scope onto a real business's data. This slice is pure, package-level and in-memory.

**D7 — The demo baseline must not move.** The sample profile's pinned 97/63 vs 12/17 and the 7
populated + 5 omitted canonical sections are unchanged: `SAMPLE_BUSINESS_DISCOVERY_PROFILE` is a
literal and is not built from answers. If a change here moves those numbers, it has reached
something it should not have.

### 2.1 Recorded, NOT authorized

Surfaced and deliberately not acted on. **Each needs its own `Status: Proposed` ADR** — this list is
not a to-do list:

- **The API hardening** (CORS origin list, `ValidationPipe`, body size limit) that ADR-0050 §2.2
  adopted "for whenever the route is written". The security lens argues it should land **before**
  the route rather than with it — `apps/api` currently calls a bare `app.enableCors()`. That
  argument is credible and the blast radius today is near zero (every controller is `@Get`-only,
  zero `@Post`/`@Body` in the app). It is an `apps/api` behaviour change and is not this slice.
- **A guard forbidding synthesised `FieldVersion` authorship.** Prohibited only by prose today.
- **`--passWithNoTests` in 30 of 31 packages**, with nine packages holding zero specs. Every guard
  in this repo lives in a file whose deletion would leave its package green. Only `@age/web` had it
  removed (ADR-0048 D4).
- **`String(sufficiency?.state)` in `context-readiness.ts`**, which renders the literal `"undefined"`
  rather than defaulting to `ready`. Safe today; nothing pins that it stays safe.
- **The Prisma read path's re-validation**, asserted for the in-memory repository and not for
  `fromScoredBifSnapshotRow`.

---

## 3. Consequences

A questionnaire answered completely can produce a profile that carries evidence and offerings, so
the confidence score becomes a measurement that responds to the answers rather than a constant. Two
capabilities become reachable-ready instead of structurally not-ready.

⚠️ **What this does NOT do**, stated plainly so §3 is not overclaimed a second time (see ADR-0050
§3's erratum): it does not give `buildProfileFromAnswers` a caller. After D1–D4 the function still
has none. It makes the questionnaire capable of expressing what the profile requires — a
precondition for a surface, not a surface.

The cost is that `DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE` grows questions, and the
question-to-signal relation stops being one-to-one: two questions may legitimately target
`offerings`. **ADR-0050's implementation currently throws on exactly that** — the duplicate
`satisfiedBy` check added in PR #194 exists to stop a second claim silently overwriting the first.
That check must be narrowed rather than removed: two questions may share a signal **only** when each
pins a distinct enum value and the target is a list, and the mapper must append rather than
overwrite. Removing the check outright restores the silent-overwrite defect it was written to close.

## 4. Dissents

**Dissent 1 — the sequencing lens (recorded, NOT dissolved).** It argues the user-visible surface
should come first: the questionnaire's expressive gap is invisible to anyone until something renders
it, and a repo that keeps deepening its contracts without ever showing a user a screen is optimising
the wrong thing. This is a fair charge and D5 does not refute it — it only sequences it. If D1–D4
grow beyond one slice, that dissent gets stronger, not weaker.

**Dissent 2 — the skeptic's standing objection.** Every slice on this track has ended with the
function still uncalled, and each one has been justified by the next one. D5 defers the form again.
The honest answer is that this ADR is the **last** deferral that this argument can carry: after
D1–D4 there is no remaining contract-level reason not to build a surface, and if one is produced,
it should be treated as evidence the track is avoiding the user rather than serving them.
