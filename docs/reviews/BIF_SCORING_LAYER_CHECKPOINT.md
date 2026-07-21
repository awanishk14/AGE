# BIF Scoring Layer — Milestone Checkpoint

> Documentation-only checkpoint. Records the state reached at `main` @
> `52a595adc710cd4736d83d907de6e524865648d8` (PR #79 merged, main CI green).
> **No code, package, ADR-status or configuration change accompanies this document.**

| Field         | Value                                                             |
| ------------- | ----------------------------------------------------------------- |
| Date          | 2026-07-21                                                        |
| Base commit   | `52a595adc710cd4736d83d907de6e524865648d8`                        |
| Branch        | `docs/bif-scoring-layer-checkpoint`                               |
| Scope         | Documentation only                                                |
| PR sequence   | #75 → #79 (mapper, checkpoint, ADR revision, acceptance, scoring) |
| Governing ADR | ADR-0025 — Discovery to BIF Wiring Prerequisites (**Accepted**)   |

---

## 1. Milestone summary

**AGE can now take a `BusinessDiscoveryProfile` and deterministically produce a canonical `Draft`
BIF whose confidence is computed — not borrowed, not fabricated, not left provisional.**

The end-to-end deterministic flow now standing on `main`:

```
BusinessDiscoveryProfile                    (#67 — contracts, Zod-validated)
        │
        ▼
Validate questionnaire / profile            (#68 — answers vs. curated questionnaire)
        │
        ▼
Discovery completeness + discovery          (#72 — intake capture completeness and
input confidence                                   discovery input confidence)
        │
        ▼
Field-level evidence attached               (#74 — provenance on structured fields)
        │
        ▼
Canonical Draft BIF                         (#75 — mapBusinessDiscoveryToBifDraft)
        │
        ▼
BIF root + section confidence computed      (#79 — scoreBusinessIntelligenceFramework)
```

Every step is pure, deterministic and input-derived. No step reads a clock, invents an actor,
fabricates a value, or performs I/O.

The sequence that got here:

| PR      | What it delivered                                                             |
| ------- | ----------------------------------------------------------------------------- |
| **#75** | Discovery → canonical `Draft` BIF mapper                                      |
| **#76** | Business Discovery → BIF milestone checkpoint (documentation)                 |
| **#77** | ADR-0025 Decision 3 revised — two-metric completeness reconciled with the map |
| **#78** | ADR-0025 accepted                                                             |
| **#79** | Deterministic BIF scoring layer                                               |

PR #79 closes the loop the mapper deliberately left open. Slice 2 emitted
`PROVISIONAL_BIF_CONFIDENCE_SCORE` (`0`) with a warning attached, because no honest confidence value
existed at mapping time and borrowing `discoveryConfidenceScore` would have asserted the wrong thing.
Slice 3 computes the real value from the BIF's own content — which is the only source that can
honestly answer "how much should we trust this business intelligence?".

---

## 2. What PR #79 added

**Module:** `packages/business-discovery-contracts/src/bif-confidence-scoring.ts`
(re-exported from the package entrypoint; `@age/bif` is consumed, never modified).

### API

```ts
scoreBusinessIntelligenceFramework(
  bif: BusinessIntelligenceFramework,
  options?: BifConfidenceScoringOptions,   // { sectionDefinitions? } — defaults to BIF_SECTIONS
): BifConfidenceScoringResult              // { bif, metadata }
```

Also exported: `BIF_CONFIDENCE_SCORING_VERSION` (`'1.0.0'`),
`bifSectionConfidenceScoreSchema`, `bifConfidenceScoringMetadataSchema`, and the types
`BifSectionConfidenceScore`, `BifConfidenceScoringMetadata`, `BifConfidenceScoringResult`,
`BifConfidenceScoringOptions`.

### Root `confidenceScore` computation

The field-count-weighted mean of section confidence across **all twelve** canonical BIF sections. A
section that is absent contributes confidence `0` at its full defined-field weight, so omissions
lower the root score directly — without any placeholder section being created. A cap of **40**
applies when no populated field anywhere carries an independent source.

### Section `confidenceScore` computation

Two independent factors, combined by geometric mean:

- **trust** — weighted mean field trust across the fields that _are_ populated;
- **coverage** — populated weight over the weight BIF defines for that section.

`sectionConfidence = round(100 × sqrt(trust × coverage))`. Required fields weigh double in both
terms, because BIF marks a field required precisely when the section is not meaningful without it.

### Field trust

`fieldTrust = CONFIDENCE_TRUST[field.confidence] × SOURCE_MULTIPLIER[field.source]`, using only
existing `@age/bif` enum members:

| `FieldConfidence`   | base | `FieldSource`                                                        | multiplier |
| ------------------- | ---- | -------------------------------------------------------------------- | ---------- |
| `EVIDENCE_VERIFIED` | 1.0  | `DOCUMENT`, `WEBSITE`, `RESEARCH`, `GA4`, `GSC`, ad platforms, `CRM` | 1.0        |
| `USER_CONFIRMED`    | 0.5  | `USER`                                                               | 0.8        |
| `AI_INFERRED`       | 0.2  | `DERIVED` / `AI_INFERRED`                                            | 0.7 / 0.5  |

### Scoring metadata

`scoringVersion`, `bifId`, `rootConfidenceScore`, `sectionScores[]` (per-section confidence, trust,
coverage, populated/defined and required field counts, provenance counts, reasons),
`populatedSectionCount`, `totalSectionCount`, `populatedFieldCount`, `totalFieldCount`,
`evidenceBackedFieldCount`, `userConfirmedFieldCount`, `provisionalOrWeakFieldCount`,
`omittedSections`, `warnings`, `reasons`.

### Reasons and warnings

Every score is explained arithmetically at both levels: how trust and coverage combined, which
required fields are missing, how many sections are absent, whether the no-independent-evidence cap
applied, and an explicit statement that BIF confidence is **not** `discoveryConfidenceScore`. This is
what a future API/Web consumer would need to show _why_ a score was assigned — the metadata exists
now precisely so that consumer never has to re-derive it.

### Tests

`packages/business-discovery-contracts/src/tests/bif-confidence-scoring.spec.ts` — **24 tests**
(package suite: 165 passing). Coverage includes: determinism across repeated runs; a source scan
proving no `new Date(` / `Date.now(` / `Math.random(` / `performance.now(` / `fetch(` / `node:fs` /
`process.env`; input BIF not mutated; discovery scores structurally out of scope; sparse sample
scores conservatively; the provisional constant is replaced; status, completeness, dates and field
values pass through; section confidence computed for emitted sections and no others; a thin
all-user-confirmed section stays low; evidence-backed beats user-confirmed at identical coverage;
user-confirmed still earns credit; confidence level moves the score at fixed source; required fields
weigh more; omitted sections reduce the root without placeholders; the no-evidence cap; an empty BIF
scores 0; all scores are 0–100 integers; metadata satisfies its own schema; invalid input is
rejected explicitly; non-`Draft` input warns without a status change; entrypoint exports work.

---

## 3. Current scoring semantics

- **BIF confidence is computed from BIF content**, never from Discovery metadata. The function's
  signature accepts only a `BusinessIntelligenceFramework`, and the module imports no discovery
  scoring module — so there is no discovery score in scope to copy, by construction rather than by
  discipline.
- **`discoveryConfidenceScore` is not used.** It measures how well-sourced the _intake_ was. BIF
  confidence measures trust in the produced _intelligence_. ADR-0025 forbids the substitution
  directly or as an input term; tests assert the source never reads it.
- **`discoveryCompletenessScore` is not used** as BIF completeness or as BIF confidence. It describes
  the interview; `bif.completenessScore` describes the framework. Both are reported, labelled, and
  never interchanged.
- **Field trust combines `FieldConfidence` and `FieldSource`.** Confidence says how the value was
  established; source says who or what attested it. An `EVIDENCE_VERIFIED` value whose source is
  still the client's own statement earns less than one backed by a document or the website — because
  a citation to oneself is weaker corroboration.
- **Section confidence combines trust with coverage, conservatively.** The geometric mean means
  neither factor can mask the other: a perfectly evidenced 1-of-9 section cannot score high, and a
  fully populated but wholly unevidenced section cannot either. **Presence is not trust, and trust
  alone is not intelligence.** A section that is truthful about its one known field is still weak as
  intelligence when eight fields are missing.
- **Omitted sections reduce root confidence without creating placeholders.** They count as zero at
  full weight. Nothing is invented to fill them — the mapper's omission discipline is preserved
  exactly.
- **The no-independent-evidence cap (40)** prevents a wholly self-reported BIF from scoring high
  however complete it is. If nothing has been checked against the world, confidence has a ceiling.
- **Sparse `Draft` BIFs score conservatively — by design.** A low score here is the model working,
  not the model failing.
- **The sample Draft BIF scores 17.** Alongside `discoveryCompletenessScore` 97,
  `discoveryConfidenceScore` 63 and `bif.completenessScore` 12. Per-section: `products_services` 63,
  `icp_personas` 45, `organization_identity` 43, `gtm_system` 24, `brand_system` 22,
  `vision_strategy` 22, `market_competition` 21. A well-run interview still yields a
  low-confidence sparse Draft BIF, and reporting that honestly is the whole point.

---

## 4. Current guarantees

- **Deterministic** — identical input always yields identical output.
- **Pure arithmetic** over the input BIF.
- **No wall-clock** (`Date.now`, `new Date`, `performance.now`) — asserted by a source scan test.
- **No randomness.** **No I/O.** **No network.** **No AI calls.** **No URL fetching.** **No
  environment reads.**
- **The input BIF is not mutated** — neither the root nor any section object.
- **A new scored BIF is returned**, with new section objects.
- **BIF status remains `Draft`** — status is passed through unchanged; scoring can never promote.
- **`bif.completenessScore` is passed through unchanged** — it remains BIF population completeness
  and is never overwritten by a confidence value.
- **No placeholder sections** are created; omitted sections stay omitted.
- **No BIF schema, type or enum changes**; **no new enum values**; `@age/bif` is consumed, not
  modified.
- **Package-level only** — no API, Web, DB, persistence or demo-runtime changes.
- **No capability consumption yet.** **No SAGE changes.** **`develop` untouched.**

---

## 5. Intentionally partial areas

None of these are defects; each is a deliberate stopping point.

- **The scoring model is `v1.0.0` and conservative.** Weights and caps are hand-set constants chosen
  to avoid overstatement. They are explainable arithmetic, not a calibrated model — no real BIF
  corpus exists to calibrate against yet.
- **Confidence scoring is deterministic but still initial.** The version constant exists so a stored
  score can be traced to the model that produced it when the weights change.
- **No promotion rule from `Draft` exists.** A high confidence score does not by itself imply a
  promotable BIF, and nothing decides `Draft → Active`. That is an undecided governance question.
- **No persistence of a scored BIF exists.** Scoring is a pure function; nothing stores its output.
- **No API or Web exposure exists.** Nothing outside the package can request or read a score.
- **No capability consumes a scored BIF yet.** This is the largest open question — see §6.
- **No real client workspace or input source exists.** The only profile in the repo is the sample
  fixture.
- **Scoring metadata is available but displayed nowhere.** The reasons and warnings are produced for
  a consumer that does not yet exist.
- **No external evidence fetching or verification happens inside scoring.** Evidence locators are
  read as strings and counted; they are never dereferenced. Scoring trusts the provenance the mapper
  recorded — it does not re-verify it.

---

## 6. Recommended next slice

| Option                                              | Assessment                                                                                                                                                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Capability consumption of a scored Draft BIF** | **Recommended.** The only option that tests an unproven semantic rather than building on top of one. Small, pure, reversible.                                                                                 |
| B. Persistence of a scored BIF                      | Premature. Storing a shape before anything consumes it freezes that shape against zero real usage, and the first consumer is exactly what would reveal the shape is wrong.                                    |
| C. API / Web exposure                               | Premature for the same reason, and worse: an endpoint is a public contract. Exposing scores before we know how a consumer must read them risks publishing a shape we then have to break.                      |
| D. Promotion / status rules                         | Blocked on evidence we do not have. Deciding when a BIF becomes `Active` requires knowing what consuming a BIF actually demands of it. ADR-0025 already flags that a high score does not imply promotability. |
| E. Expand mapping coverage                          | Useful later, and it would raise coverage scores — but it improves a pipeline whose output nothing reads yet. Worth doing once a consumer tells us _which_ gaps actually hurt.                                |
| F. Real Discovery input / workspace                 | Much larger, and it pulls in UI, auth and tenancy concerns that this track has deliberately kept out. It also assumes the pipeline's output is worth capturing real data for — which A is what proves.        |

### Recommendation: **Option A — capability consumption of a scored `Draft` BIF**, as a tiny, pure, package-level slice.

A BIF can now be constructed and scored honestly. The next meaningful architectural proof is whether
a capability can **consume** that scored BIF **without inventing the intelligence that is missing**,
without mutating state, and without creating execution behaviour. That question is not answered
anywhere in the current codebase, and every other option on the list quietly assumes the answer.

It matters most because the sample BIF scores **17**. A capability handed a 17-confidence, 12%-populated
BIF must degrade honestly — say what it cannot conclude, and why — rather than produce a
confident-sounding output built on ten fields. If capabilities cannot do that, the entire honesty
discipline of the last five PRs stops at the BIF boundary and is lost at the point of use. Better to
discover that against one pure capability now than after an API, a storage schema and a UI have been
built on the assumption.

**Do not recommend API, Web or persistence yet.** Those freeze interfaces and storage before
capability consumption semantics are proven.

---

## 7. Proposed next slice scope (Option A)

Narrow by intent. **The goal is not to build a feature — it is to prove that AGE capabilities can
read scored BIF context safely.**

- Select **one** existing pure capability only.
- Consume a scored `Draft` BIF as input.
- Produce a **read-only** capability insight/report/result that states plainly what the BIF supports
  and what it does not — low confidence and missing sections must be visible in the output, not
  smoothed over.
- **No persistence. No API. No Web. No execution. No AI. No external calls.**
- **No status promotion.** **No strategy generation beyond the existing capability boundary.**
  **No SAGE.**

Success is a capability that, given a 17-confidence BIF, produces something a human would recognise
as appropriately hedged — and a test proving it does not invent what the BIF does not contain.

If the slice reveals a missing architectural decision (for example: what a capability must do when
confidence falls below some threshold, or whether "insufficient context" is a first-class capability
outcome), **stop and draft an ADR** rather than deciding it inside the implementation.

---

## 8. What must not be done next

- **Do not expose a scored BIF through API or Web yet.**
- **Do not persist a scored BIF yet.**
- **Do not create client workspace screens.**
- **Do not add execution-governance.**
- **Do not generate strategy documents from a BIF yet.**
- **Do not add AI calls.**
- **Do not fetch external evidence.**
- **Do not promote BIF status out of `Draft`.**
- **Do not touch SAGE.** **Do not touch `develop`.**

---

## 9. Hard boundaries for this checkpoint PR

This PR is **documentation-only**:

- One file added: `docs/reviews/BIF_SCORING_LAYER_CHECKPOINT.md`.
- **No code changes. No package changes.** No `package.json`, no lockfile, no source file.
- **No API, Web, DB or persistence changes.** **No demo-runtime changes.**
- **No ADR changes.** ADR-0025 stands at `Status: Accepted` exactly as merged in PR #78 — this
  document _describes_ that status, it does not set, amend or supersede it. No other ADR is touched.
- **No SAGE changes. `develop` untouched.**
- **No implementation started.** §6 and §7 are a recommendation and a proposed scope awaiting
  approval — not a commitment, and not work in progress.
