# Business Discovery → BIF — Milestone Checkpoint

> Documentation-only checkpoint. Records the state reached at `main` @
> `c0586a707cff53bbe6b23d5a9c83f7242089e276` (PR #75 merged, main CI green).
> **No code, package, ADR-status or configuration change accompanies this document.**

| Field         | Value                                                       |
| ------------- | ----------------------------------------------------------- |
| Date          | 2026-07-20                                                  |
| Base commit   | `c0586a707cff53bbe6b23d5a9c83f7242089e276`                  |
| Branch        | `docs/business-discovery-bif-checkpoint`                    |
| Scope         | Documentation only                                          |
| PR sequence   | #67 → #75 (nine PRs, all merged to `main`)                  |
| Governing ADR | ADR-0025 — Discovery to BIF Wiring Prerequisites (Accepted) |

---

## 1. Milestone summary

**AGE can now take a `BusinessDiscoveryProfile` and deterministically produce a canonical
`BusinessIntelligenceFramework` in `Draft` status — without fabricating anything.**

This is the point at which Business Discovery stops being an isolated intake format and starts
producing the canonical business model that the rest of AGE is defined against. Everything before
PR #75 described, validated or scored discovery data. PR #75 is the first slice where discovery
output _becomes a real BIF_.

The word carrying the weight in that sentence is **without fabricating**. A mapper that filled gaps
with plausible values would have produced a fuller, more impressive BIF and destroyed the property
that makes a BIF worth having — that every value in it can be traced to something a human actually
said or a document actually evidenced. Concretely, nothing in the following list is invented:

| Never fabricated | How it is obtained instead                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| **Timestamps**   | Every `Date` is `options.constructedAt`, supplied by the caller. The mapper reads no clock.                 |
| **IDs**          | `bifId` defaults to `bif-<profileId>`; section ids are `<bifId>-<sectionType>`. Derived, never random.      |
| **Sections**     | A section is emitted only when at least one field has a real value. Absent sections are omitted.            |
| **Provenance**   | `EVIDENCE_VERIFIED` only where a citation resolves; otherwise `USER`/`USER_CONFIRMED`. Never `AI_INFERRED`. |
| **Completeness** | Computed from fields actually emitted against BIF's own definitions.                                        |
| **Confidence**   | Held at a provisional, warning-backed `0` rather than substituting a number that means something else.      |

The last two deserve emphasis, because they are where the temptation to fabricate is subtlest.
Discovery produces two scores that _look_ like they could fill BIF's two score fields, and neither
one honestly can:

- `discoveryCompletenessScore` (97 on the sample) measures how completely the **intake** was
  captured. It is not how populated the **BIF** is (12 on the same sample). Mapping it directly —
  which ADR-0025 Decision 3 originally called for — would have published a near-complete-looking BIF
  built from 10 of 84 fields. PR #75 was refined before merge to compute BIF completeness from
  actual field population instead, and to keep both numbers, distinctly labelled.
- `discoveryConfidenceScore` measures how well-sourced the intake is. BIF confidence means trust in
  the **intelligence**. Discovery produces no intelligence, so there is no honest value to write, and
  a provisional `0` that asserts nothing is preferable to a borrowed number that asserts the wrong
  thing.

Both cases resolved the same way: **report both metrics, label them, and never substitute one for
the other.** That principle is the real milestone here, more than the mapper itself.

---

## 2. Current deterministic flow

```
BusinessDiscoveryProfile              (#67 — contracts, Zod-validated)
        │
        ▼
Questionnaire Validation              (#68 — answers vs. curated questionnaire)
        │
        ▼
Completeness + Discovery              (#72 — capture completeness, discovery input
Confidence Scoring                           confidence, readiness band)
        │
        ▼
Field-Level Evidence References       (#74 — field/answer citations, dangling detection)
        │
        ▼
Canonical Draft BIF                   (#75 — mapBusinessDiscoveryToBifDraft)
   { bif, metadata }
```

Every stage is a pure function in `packages/business-discovery-contracts`. The whole chain is
deterministic: identical input plus identical caller options always yields an identical result, with
no clock read, no randomness, no I/O, no network and no mutation of inputs.

**Two distinct outputs exist, and they must not be confused:**

| Output                             | Added | What it is                                                                                                            | Who consumes it                        |
| ---------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `mapBusinessDiscoveryToBifContext` | #69   | A **BIF-_compatible_ projection** — a read-only, display-shaped context. Not a BIF.                                   | `@age/demo-runtime` → CLI demo         |
| `mapBusinessDiscoveryToBifDraft`   | #75   | A **real canonical `BusinessIntelligenceFramework`** in `Draft` status, with fields, provenance, versions and scores. | **Nothing yet** — package + tests only |

This distinction matters when reading the guarantees below. The CLI demo does consume discovery, but
it consumes the #69 projection. **Nothing anywhere in the repository consumes the real Draft BIF** —
verified by searching for `mapBusinessDiscoveryToBifDraft` across `apps/` and `packages/`, which
returns only the mapper's own source, its own barrel export, and its own tests.

---

## 3. Completed PR history (#67 → #75)

| PR      | Title                                                          | What it added                                                                                                                                                                                                      |
| ------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **#67** | `feat: add Business Discovery contracts package`               | The `@age/business-discovery-contracts` package. Core types — profile, sections, questions, answers, offerings, segments, competitors, goals, assumptions, gaps — with Zod schemas as the validation boundary.     |
| **#68** | `feat: add Business Discovery questionnaire validation`        | The curated default questionnaire and validation of a profile against it: which questions are answered, which required ones are missing, which answers have no matching question.                                  |
| **#69** | `feat: add Business Discovery sample profile and BIF mapping`  | The canonical sample profile used as a fixture throughout, plus `mapBusinessDiscoveryToBifContext` — a **BIF-compatible projection**, deliberately not a BIF.                                                      |
| **#70** | `feat: integrate Business Discovery into demo runner`          | `@age/demo-runtime` gains a discovery module; the CLI demo (`pnpm demo`) reports discovery using the #69 projection. Read-only; no API or Web surface.                                                             |
| **#71** | `docs: decide Business Discovery PR5 scope`                    | Decision record: **skip** the originally planned API/Web PR #5. Exposure was judged premature while the discovery→BIF semantics were unsettled — a decision this checkpoint reaffirms.                             |
| **#72** | `feat: add Business Discovery completeness scoring`            | Deterministic capture completeness with a per-section breakdown, `discoveryConfidenceScore` (confidence in the **input**, explicitly not strategic confidence) and a readiness band.                               |
| **#73** | `docs: propose Discovery to BIF wiring ADR`                    | **ADR-0025**, establishing the prerequisites for wiring discovery into BIF: date determinism, field-level provenance, score mapping, partial-draft rules. Accepted.                                                |
| **#74** | `feat: add Business Discovery field-level evidence references` | Field-level evidence citations, the `EvidenceableFieldPath` vocabulary, and validation that detects **dangling** references (citations naming no declared source). The provenance PR #75 consumes.                 |
| **#75** | `feat: map Business Discovery to BIF draft`                    | **`mapBusinessDiscoveryToBifDraft`** — the first real canonical BIF. Draft status, caller-supplied context, canonical field keys, honest provenance, and BIF population completeness computed from emitted fields. |

**Refinement inside #75, worth recording.** The mapper first followed ADR-0025 Decision 3 literally
and set root `completenessScore` from discovery capture completeness. That published `97` on a BIF
populating 10 of 84 fields. The PR was refined before merge to compute completeness from BIF field
population (`12`), keep `discoveryCompletenessScore` (`97`) in metadata, apply the same population
metric to sections, and emit warnings stating the two are separate. **ADR-0025 was deliberately not
amended in that PR** — the implementation now differs from the letter of Decision 3, and reconciling
the ADR text is outstanding work (see §7).

---

## 4. Current guarantees

Each item below is enforced by a test in `packages/business-discovery-contracts`, or verified
directly against the tree at `c0586a7`.

**Purity and determinism**

- **Pure package-level logic.** All discovery→BIF logic lives in
  `packages/business-discovery-contracts`. No service, controller, repository or runtime wiring.
- **Deterministic.** Identical inputs and options always produce an identical result. Asserted by
  running the mapper twice and deep-comparing.
- **No wall-clock `Date` usage inside the mapper.** Guarded two ways: a runtime test proving
  `Date.now` is never called, and a **static source guard** asserting the module text contains no
  `new Date(`, `Date.now(`, `Math.random(` or `performance.now(` — because stubbing `Date.now`
  alone would not catch a bare `new Date()`.
- **Inputs are never mutated.**

**Caller-supplied context — required, never defaulted**

- **`constructedAt`** — every emitted `Date` (root, section, field, version) comes from it. An
  invalid `Date` throws.
- **`changedBy`** — recorded on every `FieldVersion`. Blank throws.
- **`organizationId`** — blank throws, and it is **never invented**: a discovery profile id
  identifies an _intake record_, not an organization, and deriving one from the other would fabricate
  an identity.

**BIF construction honesty**

- **Canonical BIF field keys only.** Keys and `required` flags are read from BIF's own static
  `BIFSectionDefinition`s via `BIF_SECTIONS`, so no key is invented or locally restated.
- **Absent sections are omitted**, never emitted empty.
- **No placeholder-filled sections or fields.** A section appears only if at least one field has a
  real value; asserted by checking every emitted field holds a non-blank, non-empty value.
- **Unmapped discovery fields are reported with substantive reasons**, not silently dropped.
- **BIF status is `Draft`.**

**Provenance**

- **Field-level and answer-level provenance are both supported** — field citations from #74, and
  answer citations resolved through the question's `satisfiedBy` signal.
- **Dangling evidence is ignored and detected.** Citations naming no declared source do not confer
  `EVIDENCE_VERIFIED`; the field falls back to user-confirmed.
- **Uncited fields fall back to `USER` / `USER_CONFIRMED`** — accurate for client-stated intake, not
  a placeholder.
- **`AI_INFERRED` is never emitted** — asserted across field `source`, field `confidence` and every
  `FieldVersion`.

**Score separation**

- **Discovery confidence is not used as BIF confidence.** `discoveryConfidenceScore` travels in
  metadata only; a test asserts the root and every section differ from it.
- **BIF confidence remains provisional** — the constant `PROVISIONAL_BIF_CONFIDENCE_SCORE = 0`,
  **warning-backed** so no consumer mistakes it for a computed score.
- **BIF completeness is population completeness**, computed from emitted fields over all twelve
  canonical sections, and is separate from `discoveryCompletenessScore`.

**Integration boundary**

- **No API, Web, DB or persistence integration.** No `apps/` change in #74 or #75; no repository,
  migration or schema exists for discovery or BIF.
- **No demo-runtime consumption of the real BIF.** The CLI demo consumes the #69 _projection_ only;
  `mapBusinessDiscoveryToBifDraft` has no consumer outside its own package and tests.
- **No AI calls, external integrations or URL fetching.** Evidence locators are read as strings and
  never dereferenced.
- **No strategy generation, execution planning or execution-governance work.**
- **SAGE untouched. `develop` untouched** — `develop` remains at unrelated commit `7245dcc`.

---

## 5. Current intentionally partial areas

None of these are defects. Each is a place where the honest thing was to stop rather than guess, and
each is recorded so it is not mistaken for an oversight.

**Scores**

- **`bif.confidenceScore` is a provisional `0`** at root and every section. BIF confidence means
  trust in the intelligence; discovery produces none. `0` asserts nothing, which is the point — it is
  a placeholder that cannot be misread as a measurement, and it is warning-backed. **This is the gap
  Option A below exists to close.**
- **BIF population completeness is separate from discovery capture completeness.** On the sample:
  `bif.completenessScore` **12** (10 of 84 fields) vs. `discoveryCompletenessScore` **97**. Both are
  reported. Population counts omitted sections as zero, so it is bounded by the whole canonical BIF
  surface rather than only the mapped part, and it measures **field presence, not field quality or
  depth**.

**Coverage — 7 of 12 BIF sections populated**

| Section                  | Status  | Sample population |
| ------------------------ | ------- | ----------------- |
| `organization_identity`  | Mapped  | 4 / 14 (29%)      |
| `vision_strategy`        | Mapped  | 1 / 8 (13%)       |
| `products_services`      | Mapped  | 1 / 1 (100%)      |
| `icp_personas`           | Mapped  | 1 / 2 (50%)       |
| `market_competition`     | Mapped  | 1 / 9 (11%)       |
| `brand_system`           | Mapped  | 1 / 8 (13%)       |
| `gtm_system`             | Mapped  | 1 / 7 (14%)       |
| `assets`                 | Omitted | 0 / 8             |
| `constraints`            | Omitted | 0 / 6             |
| `marketing_intelligence` | Omitted | 0 / 8             |
| `technology_stack`       | Omitted | 0 / 9             |
| `kpis`                   | Omitted | 0 / 4             |

- **`assets` and `constraints` remain unmapped because mapping them would require inference.** BIF's
  keys are specific and typed — assets are `websites`/`blogs`/`videos`/`socialProfiles`/`adAccounts`/
  `documents`; constraints are `budget`/`teamCapacity`/`compliance`/`legalConstraints`/
  `technicalConstraints`. Discovery captures unclassified free text such as _"Newsletter list of
  12,000 subscribers"_ or _"Small marketing team (three people)"_. Sorting those into typed buckets
  is inference, and discovery never infers. **Note this is a discovery-questionnaire shape problem,
  not a mapper problem** — it is fixed upstream by capturing classified input, not downstream by
  guessing.
- **`marketing_intelligence`, `technology_stack` and `kpis` have no discovery source yet.** The
  questionnaire captures nothing that belongs in them.
- **Short/medium goals are unmapped because BIF's time boxes do not align.** BIF exposes
  `longTermGoals`, `annualObjectives` and `quarterlyObjectives`; discovery's coarse short/medium
  horizons do not correspond to annual/quarterly time boxes, so only long-horizon goals map and the
  rest are reported as unmapped.
- **Mapped values are discovery-shaped.** `idealCustomerProfiles` and `products` are not yet
  conformed to BIF's ICP and ProductItem submodels, which require fields discovery does not capture.
  A warning states this.

**Integration**

- **No capability consumes the real BIF yet.** The six capabilities remain on their own fixtures.
- **No API or Web surface exposes the BIF.** Reaffirms the PR #71 decision.
- **No persistence exists.** Every BIF is constructed in memory, per call, and discarded.
- **No real client workspace exists.** There is no tenant-scoped place a BIF belongs to, and
  `organizationId` is a caller-supplied string that nothing yet validates against a real organization.

**Governance**

- **ADR-0025 Decision 3 no longer matches the implementation.** The ADR says map completeness
  directly; the merged mapper computes BIF population completeness instead, for the reasons in §1.
  The deviation is deliberate, documented in code and in the PR, and **not yet reconciled in the ADR
  text.** Whoever takes the next slice should expect to amend ADR-0025 or supersede Decision 3.

---

## 6. What must not be done next

- **Do not jump to API/Web exposure.** Exposing a BIF whose `confidenceScore` is a provisional `0`
  would publish a number consumers will read as a measurement. PR #71 already declined this once.
- **Do not persist the BIF yet.** Persisting a shape whose scoring semantics are about to change
  creates stored records that mean something different from newly generated ones, and a migration
  before the first real read.
- **Do not build client workspace screens.** No tenant model, no persistence, nothing to show.
- **Do not have capabilities consume the BIF until confidence/scoring semantics are decided.** A
  capability that reads `confidenceScore: 0` will either ignore confidence entirely — hard-coding the
  assumption that it is meaningless — or gate on it and produce nothing. Both bake in the wrong
  contract.
- **Do not create execution-governance work.** Out of scope; governed separately by ADR-0021 and the
  Execution Model.
- **Do not move anything to SAGE.**
- **Do not touch `develop`.** It is stale; `main` is canonical.
- **Do not amend ADR-0025 as a side effect** of an implementation slice. If Decision 3 needs
  reconciling, that is its own reviewed change.

---

## 7. Recommended next slice

Five options were considered.

| Option                                   | Summary                                                            | Verdict                                                                                                                                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. BIF scoring layer**                 | Compute BIF intelligence confidence honestly, at section and root. | **Recommended.** Unblocks every other option; nothing downstream is safe to build on a provisional `0`.                                                                                                              |
| **B. Capability consumes Draft BIF**     | Let one capability read the real BIF.                              | Blocked by A. A capability must decide how to treat confidence, and that contract is not yet defined.                                                                                                                |
| **C. BIF persistence**                   | Store generated BIFs.                                              | Blocked by A. Persisting a shape whose score semantics are about to change means storing records that need migrating before their first meaningful read.                                                             |
| **D. API/Web exposure**                  | Expose generated BIFs.                                             | Blocked by A and C, and already declined in PR #71. Publishing a provisional `0` to consumers is the specific harm to avoid.                                                                                         |
| **E. Expand discovery mapping coverage** | Map assets, constraints, KPIs, tech stack, marketing intelligence. | Valid and independent, but **not** a mapper slice — the blocker is that discovery captures unclassified free text. It is questionnaire work, and it widens coverage without making existing output more trustworthy. |

### Recommendation: **Option A — BIF scoring layer**

PR #75 deliberately left `bif.confidenceScore` as a provisional `0` at root and every section,
because no honest value existed and `discoveryConfidenceScore` measures a different thing (how
well-sourced the _intake_ is, not how trustworthy the _intelligence_ is). That was the right call for
a mapper slice, but it leaves the BIF carrying a field that asserts nothing.

Before any capability consumes a BIF, AGE needs a deterministic scoring layer that **defines what BIF
intelligence confidence means**, separately from discovery input confidence. Until that definition
exists, every downstream consumer would have to invent its own interpretation of `0` — and those
interpretations would diverge, silently, across capabilities.

Option A is also the cheapest to get wrong-and-fix: it is package-level and pure, consumes a BIF and
returns scores, and touches no runtime surface. B, C and D each bake the current provisional
semantics into a consumer, a stored record, or a public response — all far more expensive to unwind.

Option E is worth doing eventually and is genuinely independent, but it should not go first: it makes
the BIF _wider_ without making it _more trustworthy_, and its real blocker is upstream in the
questionnaire, not in the mapper.

---

## 8. Proposed next slice scope — BIF scoring layer

**Hard boundaries.** Package-level only · deterministic · no API · no Web · no DB · no persistence ·
no demo-runtime changes · no AI · no external integrations · no URL fetching · no strategy generation
· no execution planning · no execution-governance · no SAGE · no `develop`.

**Shape.** A pure function consuming a `Draft` BIF (and optionally the mapper metadata) and returning
computed confidence alongside its reasoning — mirroring the `{ result, metadata }` shape the mapper
already established.

**Should:**

- Consume a Draft BIF, and optionally `BusinessDiscoveryBifMetadata` when available.
- Compute **section `confidenceScore`** from evidence actually present in that section.
- Compute **root `confidenceScore`** from section scores, by a documented and explicit rule.
- Draw on **field provenance** (`EVIDENCE_VERIFIED` vs. `USER_CONFIRMED`), **field confidence**,
  **section completeness**, **missing/required fields**, and unmapped metadata where available.
- **Explain itself** — carry per-section reasons and warnings in the result or metadata, so a `0.4`
  is legible rather than oracular. This is the property that makes the layer reviewable.
- Be **fully deterministic**, with no clock, randomness or I/O, and take any timestamp from the
  caller — the same discipline the mapper follows.

**Must not:**

- **Use `discoveryConfidenceScore` directly as BIF confidence.** It may inform a computation only if
  the relationship is explicitly defined and documented; it may never be assigned through.
- **Change BIF status.** Status stays `Draft` unless an explicit promotion rule is defined in its own
  accepted ADR. A high confidence score does not imply an Active BIF.
- **Modify `@age/bif`.** Consume its types; do not extend them.
- **Modify the mapper's output contract.** The scoring layer sits downstream.
- **Fabricate precision.** If a section has no evidentiary basis for a score, saying so beats
  emitting a number.

**Open question to settle first — needs a decision, not an implementation.** Does a section populated
by 1 of 9 fields, all user-confirmed, score _low confidence_ (little corroboration) or _high
confidence_ (everything present is directly client-stated)? These give opposite answers, and the
choice determines the whole layer. Confidence and completeness are orthogonal — a small,
well-evidenced section can be highly trustworthy — and conflating them would recreate exactly the
category error §1 records. **Resolve this before writing code**, and expect it to require amending or
superseding ADR-0025 Decision 3, which is separately out of step with the merged implementation.

---

## 9. Hard boundaries for this checkpoint PR

This PR is **documentation-only**:

- One file added: `docs/reviews/BUSINESS_DISCOVERY_TO_BIF_CHECKPOINT.md`.
- **No code changes. No package changes.** No `package.json`, no lockfile, no source file.
- **No API, Web, DB or persistence changes.**
- **No ADR status changes.** ADR-0025 remains `Accepted` and unedited; the §5 note that its Decision
  3 is out of step with the implementation is an observation recorded here, **not** an amendment.
- **No SAGE changes. `develop` untouched.**
- **No implementation started.** §7 and §8 are a recommendation and a proposed scope awaiting
  approval — not a commitment, and not work in progress.
