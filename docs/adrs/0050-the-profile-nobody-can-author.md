# ADR-0050 — The profile nobody can author

Status: Accepted
Date: 2026-08-01
Relates to: ADR-0026 D4 (missing sections are limitations, never negative evidence), ADR-0038/0039
(canonical Path B), ADR-0046 D7 (the capture prohibition), ADR-0047 D3 (caller-supplied
`producedAt`, never a wall-clock read), ADR-0049 D1/D2 (the profile is a required input) and
ADR-0049 D5 (the HTTP route, deferred)

---

## 0. How this decision was reached

### 0.1 Standing

This ADR is written under the standing architect grant recorded in ADR-0043 §0.1 and reaffirmed by
the mandate quoted in ADR-0048 §0.1 and ADR-0049 §0.1. The user's instruction on 2026-08-01 was
`"go ahead then"`, authorizing the drafting of an ADR for ADR-0049's deferred D5 — the discovery
HTTP route.

**This ADR does not authorize that route.** The investigation the authorization funded found that
D5's premise does not hold yet, and says so below. Authorizing the drafting of an ADR is not
authorizing a predetermined conclusion; recording that the recommended next step was wrong is the
ADR doing its job.

The governing delegation, verbatim, is the mandate the user gave on 2026-07-30:

> _"i told you to act as an architect and take descision that makes the software robust and perform
> for whats it intended. incase of complex issue deploy council to make decision. and also keep
> creating session handover document at important checkpoint so we dont loose track and you
> continusoy work without stopping for asking me question."_

It was merged as PR #192 with `Status: Proposed`, which decided nothing; **this separate PR flips it
to `Accepted`**, as every ADR since 0043 has done.

Acceptance is **self-acceptance under a stated grant** — the architect's, and mine to answer for. It
is **not** a claim that the user reviewed each decision below. Nothing in §2 was changed in order to
accept it: D7 still withholds the HTTP route, §2.2 still withholds four recorded-but-unauthorized
items, and both dissents in §4 stand **recorded rather than resolved**.

⚠️ One decision here is **not** the architect's and was not taken: authentication (ADR-0046 §4).
D7 is written so that this slice pre-commits it in no direction.

### 0.2 The four-lens council

Four lenses were convened — architecture, an adversarial skeptic, sequencing, and
security-and-invariants. Per finding 13, **every lens was given the code and none was given my
prose.** The council **split**, which is the useful outcome:

- **Architecture** and **security-and-invariants** both recommended building `POST
/discovery/analyze` with specific hardening (body size limits, `safeParse` at the boundary, an
  explicit `ValidationPipe`, a CORS origin list).
- **The skeptic** classified two properties of that route as **fatal** and argued the premise is
  false: no human can author a valid `BusinessDiscoveryProfile` request body, and **there is no
  questionnaire-answers → profile function anywhere in the repository.**

Per **finding 8** — _adopt a council's evidence and its conclusion separately_ — the skeptic's
central factual claim was checked against the code rather than taken on report. It holds. The
findings below are mine, verified directly; §4 records what each lens contributed and where I
overrode it.

### 0.3 What the code actually says

Four checks, all against `packages/business-discovery-contracts/src`:

1. **No inverse mapper exists.** No function in `packages/` or `apps/` returns a
   `BusinessDiscoveryProfile`. `sample-profile.ts` declares one as a literal; nothing computes one.
2. **The correspondence is already declared, in one direction only.**
   `questionnaire.ts` defines `PROFILE_SIGNALS` — a closed 13-element set naming exactly the
   structured profile fields a question can be answered by — and each question may carry
   `satisfiedBy: ProfileSignal`. `questionnaire-validation.ts` turns that into
   `PROFILE_SIGNAL_PREDICATES`, a fixed `Record<ProfileSignal, (profile) => boolean>`. Its docblock
   is explicit that validation _"never **infers** satisfaction, it checks a fixed, curated
   predicate."_ **There is a checking direction and no producing direction.**
3. **The profile is already an answers container.** `BusinessDiscoveryProfile.sections[].answers[]`
   holds `DiscoveryAnswer { questionId, value: string | string[], evidenceSourceIds? }`, and
   `collectAnsweredQuestionIds` reads exactly that. Answers do not need a new home.
4. **A sparse profile is valid by construction.** Only `id`, `businessName` and `capturedAt` are
   required; every other field is optional or a possibly-empty array. The schema docblock says so:
   _"a partial early-stage profile is still valid and its missing information can be represented as
   `gaps`."_

### 0.4 The defect

ADR-0049 made the discovery profile a **required parameter** and proved, by mutation, that the
pipeline genuinely reads it. That was correct and it is not being revisited.

But it left the parameter **unreachable**. A `BusinessDiscoveryProfile` is a nested aggregate of 13
structured collections; the only instance in the repository is a hand-authored literal. The
questionnaire — the artifact actually designed for a human to answer — cannot be turned into one,
because the function that would do it has never been written.

So the signature is parameterised and, in practice, has exactly one possible argument.

⚠️ **This is the same defect ADR-0049 closed, one layer up.** ADR-0049's finding was that a
pipeline reading a frozen constant from module scope is unfalsifiable. Making the constant a
parameter fixes the pipeline. It does not fix the product if the only value any caller can
construct is still that same constant. **The literal moved to the call site, exactly as the
ADR-0049 skeptic warned it would** (ADR-0049 §1, dissent 1) — that dissent was rejected on its
_conclusion_ (authentication), and it was right to reject it, but this part of its _evidence_ was
sound and is now discharged rather than re-refused.

### 0.5 Why not the HTTP route, then

D5 is deferred again, and this time with named content rather than a general caution. Two problems,
both raised by the skeptic, neither addressed by the two lenses recommending the route:

1. **Authorship cannot be honestly supplied.** Path B requires `organizationId`, `constructedAt`
   and `changedBy`, and `mapBusinessDiscoveryToBifDraft` stamps `changedBy`/`constructedAt` onto
   **every `FieldVersion`** in the Draft BIF it produces. An unauthenticated caller has no honest
   value for any of the three. Taking them from the request body is **fabricating provenance**,
   which the standing boundaries prohibit outright — and a fixed constant is not an escape, it is
   the same fabrication with a shorter blast radius.
   ⚠️ ADR-0049 §0.3's _"stores no row, so there is no scope question"_ argument is **sound and
   remains sound — for scope.** It does not cover **authorship**. A stateless assessment still
   stamps an author onto the artefact it returns. Do not extend that argument past scope.
2. **The scope stamp lands on a third party's data.** `buildContextReadinessReport` passes a
   hardwired `demoContext` to all three assessors (ADR-0047 D9, which recorded that divergence and
   said **do not reconcile it**). That is unobjectionable while the input is the demo fixture. It
   becomes a real defect the moment the input is a real business, and it is reached without any
   decision being taken — by the input changing underneath it.

Neither is a reason the route can never exist. Both are reasons it is not the next slice.

---

## 1. Context

`buildProfileFromAnswers` is the missing link between the artifact a human can complete (the
questionnaire) and the artifact the pipeline requires (the profile). It is pure, package-level and
in-memory; it crosses no standing boundary, needs no authenticated principal, opens no untrusted
input surface, and stamps no provenance — the profile carries no `changedBy`, which enters only
downstream in Path B.

The whole hazard is in one place: an answer is prose, and the structured fields are typed. Turning
the first into the second can be **transcription** or it can be **inference**, and only one of them
is allowed here.

## 2. Decisions

| D      | Decision                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | Add `buildProfileFromAnswers(answers, questionnaire, options)` to `@age/business-discovery-contracts`, returning a `BusinessDiscoveryProfile`. Pure, deterministic, total.                                                                                                                                                                                                                                           |
| **D2** | **It transcribes; it never infers.** A structured field is populated only where the answer's value maps to it **verbatim**. Every optional field it has no answer for is **omitted, never placeholder-filled**. Synthetic `id`s are derived deterministically from the question id — an identifier is not content.                                                                                                   |
| **D3** | **`satisfiedBy` is the only routing table.** A question populates a structured signal if and only if it declares `satisfiedBy`, and the target is that signal. No name matching, no heuristics, no per-question special cases. The producing direction is the declared inverse of `PROFILE_SIGNAL_PREDICATES`, and a test pins the two to the same closed `PROFILE_SIGNALS` set so neither can drift from the other. |
| **D4** | **An unmapped or unanswered question is not an error.** It contributes nothing and the profile stays sparse. Incompleteness is already first-class — reported by the counters, the omitted section types and `validateProfileAgainstQuestionnaire`'s own gap output (ADR-0026 D4: a limitation, never negative evidence). The function **throws for no answer set**.                                                 |
| **D5** | **`id` and `capturedAt` are required caller-supplied options.** No wall-clock read, no generated identifier. Follows ADR-0047 D3 and ADR-0049 D2: required, **never optional-with-a-default**.                                                                                                                                                                                                                       |
| **D6** | Every answer is copied into `profile.sections[].answers[]` regardless of whether it also feeds a structured signal, so the two representations cannot disagree and `validateProfileAgainstQuestionnaire` sees what the operator actually submitted.                                                                                                                                                                  |
| **D7** | **No HTTP route, no persistence, no authentication, no `ClientContext`** — see §0.5. Unchanged from ADR-0049 D5/D6; this slice pre-commits the authentication decision in no direction.                                                                                                                                                                                                                              |
| **D8** | **The round trip is the proof.** `buildProfileFromAnswers` → `validateProfileAgainstQuestionnaire` must report the answered questions as answered. A mapper that silently dropped answers would otherwise be indistinguishable from a correct one — and per the standing discipline, the test is trusted only once it has been **made to fail** by mutating the mapper.                                              |

### 2.1 What D2 forbids, concretely

`Offering`, `CustomerSegment`, `CompetitorReference` and `BusinessGoal` are each
`{ id, name|statement, …all other fields optional }`. A `list` answer therefore becomes one entry
per value with the text verbatim as `name`/`statement` and **every optional field absent** —
`description`, `valueProposition`, `industry`, `companySize`, `geography`, `note` and `horizon` are
never populated by this function. Splitting one prose answer into several entries, or deriving a
`horizon` from words like "next year", is inference and is prohibited.

#### ⚠️ Erratum to §2.1 — `Offering` is NOT all-else-optional (corrected during implementation)

The paragraph above lists `Offering` among the `{ id, name, …all other fields optional }` shapes.
**That is factually wrong.** `Offering.type` is a **required** `OfferingKind` (`'product' |
'service'`), and `EvidenceSourceRef.kind` is a **required** `EvidenceSourceKind`
(`'client-statement' | 'document' | 'url'`). Neither value is present in an answer's text.

**D2 is unchanged and is what forces the correction.** Applying "transcribe, never infer" correctly
means those two signals cannot be transcribed at all, because populating either target requires
_choosing_ an enum value. So the mapper routes **11 of the 13 signals** and refuses `offerings` and
`evidenceSources` outright, carrying a stated reason for each.

⚠️ Do **not** "complete" the mapper by defaulting `Offering.type` to `'service'` or
`EvidenceSourceRef.kind` to `'client-statement'`. Product-versus-service is a real fact about
someone's business, not a formatting choice, and a wrong one is a fabricated conclusion —
exactly what the standing boundaries prohibit. The operator's words are **not** lost: D6 still
records every such answer in `sections[].answers[]`, so only the structured collection this
function may not fabricate is left empty.

The remaining shapes in §2.1 are correct as written: `CustomerSegment`, `CompetitorReference` and
`BusinessGoal` are each `{ id, name|statement, …all else optional }` and are transcribed.

### 2.2 Recorded, not authorized

Surfaced while investigating and deliberately not acted on: the `demoContext` scope stamp (§0.5.2 —
ADR-0047 D9 says record, do not reconcile); the API's absent `ValidationPipe`, body limit and CORS
origin list (real, but only load-bearing once a route exists); and `profileSchemaValid: false` being
unreachable in any returned intake summary, because `mapBusinessDiscoveryToBifDraft` throws on
schema failure before the summary is built. Each needs its own `Status: Proposed` ADR.

## 3. Consequences

A questionnaire answer set becomes a profile, so ADR-0049's parameter has a second **constructible**
argument. The route, when it comes, has something to accept that a person could plausibly have
produced.

#### ⚠️ Erratum to §3 — "reachable" and "can be pointed at a real business" were overclaims

The sentence above originally read: _"ADR-0049's parameter has a second **reachable** argument and
the pipeline **can be pointed at a real business by a human**."_ Both halves are false as shipped,
and the second is the same class of overclaim ADR-0049 D2 exists to prevent — committed in the ADR
that closed it. Corrected in place rather than softened, because the decisions are unaffected:

- `buildProfileFromAnswers` has **zero non-test callers**. Nothing in `apps/` or `packages/`
  invokes it, so no execution path reaches the profile parameter with an argument it produced.
  **Constructible is not reachable**, and this ADR should have said so.
- **No human can point anything at a real business.** There is no form, no route and no CLI flag
  that accepts an answer set. The mapper is a library function callable only from code.

What D1–D8 actually delivered stands unchanged: a total, testable, transcription-only function from
answers to a profile, and the proof (D8) that its output survives
`validateProfileAgainstQuestionnaire`. **Authoring the answers remains unbuilt** — which is exactly
why ADR-0051 exists, and why the honest ordering is to fix what the questionnaire cannot express
_before_ building a surface that would render the result.

⚠️ A related charge was **examined and rejected**: that `apps/demo/src/tests/run.spec.ts`'s
`runBusinessDiscoveryIntake(DEMO_BUSINESS_DISCOVERY_PROFILE, …)` regex is what prevents the pipeline
being pointed elsewhere. It is not. That guard pins **one caller** — the demo CLI — to naming its
subject at the call site, which _is_ ADR-0049 D2. It constrains the demo, not the function. **Do not
loosen it** on the strength of this erratum.

The cost is that a transcribed profile is **sparse by design** — thin `Offering`s, no
`valueProposition`, no `fieldEvidence`. That is correct and must not be "improved" by enriching the
mapper. The scoring and readiness layers exist to report exactly that sparsity, and ADR-0049 already
established that a sparse profile is valid input rather than an error.

## 4. Dissents

**Dissent 1 — architecture and security-and-invariants (recorded, NOT dissolved).**

> Build the route. The hardening is well understood: `safeParse` at the boundary, an explicit body
> size limit, a `ValidationPipe`, a CORS origin list.

Their hardening analysis is adopted in full and will be the starting point when the route is
written. Their **conclusion** is rejected: neither lens addressed authorship (§0.5.1) or the scope
stamp (§0.5.2), and a hardened route accepting a body no human can author is a security boundary
around an unusable feature.

**Dissent 2 — the skeptic, on the wider claim.**

> Authentication is the foundation; everything before it is polish.

Recorded and **not** dissolved — but not adopted, for the reason ADR-0049 §1 already gave and which
still holds: auth requires a real authenticated principal that is unavailable to the architect by
construction, so naming it as the next step produces zero motion. Its narrower claim — that no one
can author a profile — is adopted and is the subject of this ADR.

⚠️ One lens proposal was rejected outright rather than recorded: parameterising `clientContext` on
`buildContextReadinessReport`. ADR-0047 D9 settled that and said do not reconcile it. Re-opening a
settled question is the ADR-0048 D1 failure mode — it risks re-deciding it the other way by
accident.
