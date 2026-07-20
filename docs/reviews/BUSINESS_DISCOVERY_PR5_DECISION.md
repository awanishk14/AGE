# Business Discovery — PR #5 Scope Decision (Documentation Only)

> Status: Proposed — decision note only. No code, package, API, Web, DB, ADR-status, or SAGE
> changes are made by this document, and no implementation is started.
>
> Base: `main` @ `5e45eea65bedd934ec507728e1904e88b429882b` (post PR #70).

## 1. Current Business Discovery Status

Four slices are merged. Business Discovery is complete as a **pure, in-memory, deterministic
intake domain**, with a demo surface but no product surface.

| PR  | Delivered                                                                                               | Surface       |
| --- | ------------------------------------------------------------------------------------------------------- | ------------- |
| #67 | `@age/business-discovery-contracts` — domain model, Zod schemas, exports, unit tests                    | package only  |
| #68 | Questionnaire schema, `DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE`, pure validation utility, tests        | package only  |
| #69 | `SAMPLE_BUSINESS_DISCOVERY_PROFILE`, BIF-**compatible** projection shape, pure mapper, tests            | package only  |
| #70 | Demo runner integration — `runBusinessDiscoveryIntake()` in `@age/demo-runtime`, printed by `apps/demo` | CLI demo only |

Current behavior after PR #70:

- Business Discovery appears in the CLI demo as an **upstream intake stage**, not a seventh
  capability. It produces no decision objects and never enters the capability approval model.
- `runAllCapabilities()` is untouched; the `GET /demo/capabilities` response shape is unchanged;
  `apps/api` and `apps/web` were not modified; `smoke-demo.mjs` needed no update.
- Everything is deterministic and side-effect-free: one hard-coded sample profile, no I/O, no
  persistence, no AI, no network. Evidence-source URLs are counted, never fetched.

**What is deliberately NOT done yet** (the load-bearing gap for this decision):

- The projection produced by `mapBusinessDiscoveryToBifContext` is a **local BIF-compatible shape**
  (`packages/business-discovery-contracts/src/bif-compatible-context.ts`), intentionally not the
  canonical `@age/bif` root. Its boundary note states why: the canonical root demands wall-clock
  `Date`s, per-field source/confidence metadata, and 0–100 scores that intake data cannot honestly
  produce yet.
- **Nothing downstream consumes Business Discovery.** No capability, API module, or Web screen
  reads the intake output. It is currently a leaf.

## 2. The Original PR #5 Idea

`docs/reviews/BUSINESS_DISCOVERY_SLICE_PLAN.md` §10 defines it as explicitly optional:

> **PR 5 (optional) — Read-only API/demo exposure.** A read-only endpoint/screen surfacing the
> sample normalized context, mirroring the existing `/demo` read-only pattern. Only if wanted.

The same plan's §9 non-scope table already frames UI/API exposure as a risk to be sequenced last:

> Creating **UI before the domain model is clear** — No Web in the first PRs; UI/API exposure is
> optional and last (PR 5), read-only only, after the model stabilizes.

So PR #5 was never a committed deliverable. It was a conditional "if there is a reason to present
this." This note tests whether that reason exists today.

## 3. Options

- **Option A — Stop Business Discovery here for now.** Keep it visible only in CLI /
  `demo-runtime`. Move next to another core AGE slice.
- **Option B — Read-only API endpoint** for the Business Discovery intake summary. No Web UI.
- **Option C — Read-only API endpoint plus a Web demo surface.**

### Implementation cost, measured against the actual repo

- **Option B** would extend the one real API module (`apps/api/src/modules/demo/`) — service, DTO,
  controller route, spec: roughly 3–5 files. Low cost, but note it changes an API surface that PRs
  #67–#70 were careful to leave byte-identical, and it would require updating
  `apps/api/scripts/smoke-demo.mjs` expectations for the first time in this track.
- **Option C** adds real work: `apps/web/src/app/demo/page.tsx` is **not** schema-driven. It renders
  a locally declared `CapabilityDemoReport` interface field by field (the existing
  `extra?: Record<string, number>` field is fetched and never rendered — proof that new data does
  not surface itself). A new intake block needs new types, new service mapping, and new JSX.

## 4. Evaluation Criteria

| Criterion                                     | Option A — Stop here                                                                                            | Option B — API only                                                                                                                                                           | Option C — API + Web                                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Product value**                             | High — frees the next slice to add real intelligence.                                                           | **Very low.** The endpoint would serve a constant. One hard-coded sample profile, deterministic output — the same JSON every call, forever, until a real input source exists. | **Very low, at higher cost.** A screen rendering a constant. Demo polish, not product progress.       |
| **Implementation risk**                       | None — no code changes.                                                                                         | Low-moderate. Small diff, but it perturbs the API contract and smoke expectations deliberately held stable across four PRs.                                                   | Moderate. Two apps, hand-written types duplicated in the Web layer, more surface to keep in sync.     |
| **Architectural cleanliness**                 | Clean. Intake stays a pure domain with one consumer (the demo runner).                                          | Mildly negative — publishes an HTTP contract for a shape that will change as soon as BIF wiring or scoring lands.                                                             | Negative — freezes an immature shape into two layers, then forces a coordinated migration later.      |
| **Risk of premature product surface**         | None.                                                                                                           | **Real.** An endpoint implies a consumer and a stable contract; neither exists.                                                                                               | **High.** A visible screen reads as a shipped feature to any stakeholder who sees it.                 |
| **Risk of drifting into client workspace/UI** | None.                                                                                                           | Low but nonzero — "show the profile" invites "show _a_ profile", then profile selection, then persistence.                                                                    | **Elevated.** A discovery screen is one obvious request away from client records and workspace state. |
| **Roadmap alignment**                         | Aligned. `AGE_IMPLEMENTATION_RESTART_CHECKPOINT.md` frames the path as Business Discovery → BIF → Intelligence. | Not aligned — presentation, not path progress.                                                                                                                                | Not aligned, and closest in shape to the just-reverted drift.                                         |
| **Helps the next core slice?**                | **Yes** — the next slice needs domain work, not transport.                                                      | **No.** BIF wiring and scoring are package-level, pure-domain work. An HTTP route contributes nothing to either.                                                              | **No**, and it adds surface that the next slice would then have to update.                            |

### The decisive consideration

`docs/reviews/AGE_PR41_61_REVERT_PLAN.md` records that PRs #41–#61 were reverted because the work
"shifted from marketing-capability product development into generic software-engineering /
execution-governance infrastructure." That revert removed API modules and Web screens built ahead of
product need.

Options B and C are a smaller instance of the same pattern: building transport and presentation for
data that has no consumer and no variability. The cost is not the diff size — it is publishing a
contract for a shape we already know is provisional, then owning its migration.

`AGE_IMPLEMENTATION_RESTART_CHECKPOINT.md` §5 ranks the candidate slices and deprioritizes exactly
the options that "pull toward external I/O, persistence, or multi-tenant state." Nothing in it, or
in `15_PRODUCT_ROADMAP.md`, treats read-only exposure as path progress.

## 5. Recommendation

**Option A — stop Business Discovery here for now.** Do **not** proceed with PR #5.

There is no clear immediate value: the endpoint would return a constant, no consumer exists, and the
shape it would publish is known to be provisional. The strict test set for this decision — _do not
recommend API/Web exposure unless there is clear immediate value_ — is not met. Business Discovery
stays visible in the CLI demo, which is sufficient to demonstrate it.

PR #5 remains available and cheap to revisit **later**, and its value rises sharply once the intake
output is no longer a constant — that is, once discovery feeds the BIF or carries a computed score.
Revisit it then, not now.

## 6. If PR #5 Should Proceed

Not recommended now. Recorded for the later revisit so the scope is not renegotiated from scratch:
read-only only · deterministic · sample profile only · no DB · no persistence · no auth · no client
workspace · no Web (API only unless separately justified) · no AI · no external integrations · no
execution-governance · no SAGE. Preconditions for revisiting: a real consumer exists, and the intake
output is no longer a constant.

## 7. Recommended Next Slice Instead

**Business Discovery completeness scoring** — a pure, deterministic scoring function over the
existing profile + questionnaire validation result.

Why this one, over the other candidates:

- **It is a genuine blocker, not a detour.** The canonical `@age/bif`
  `BusinessIntelligenceFramework` root requires `confidenceScore` and `completenessScore` as
  numbers 0–100 (`packages/bif/src/core/framework.ts`). Today
  `validateProfileAgainstQuestionnaire` produces only booleans and lists — `valid`,
  `missingRequiredQuestionIds`, `criticalGaps`. **No numeric scoring logic exists anywhere in the
  repo**; the 0–100 fields are declared in Zod and never computed. Discovery → BIF wiring cannot
  produce an honest BIF root until this exists, and PR #69's boundary note already named "fabricated
  scoring" as the thing to avoid.
- **It fits the boundary exactly** — pure, in-memory, input-derived, deterministic, no new package,
  no API/Web/DB, testable to the existing standard.
- **It adds real intelligence**, not transport: "how complete is this business profile, and what is
  most valuable to ask next" is a product-meaningful answer that the CLI demo can show immediately.

**Sequenced after it: Discovery → BIF wiring.** This should be next-but-one, not next, and it needs
an **ADR first** (`Status: Proposed`, for the Product Owner to accept) covering two decisions the
current conventions do not settle:

1. **Timestamps.** The canonical BIF root requires `createdAt` / `updatedAt` / `lastSyncedAt` as
   `Date`s, which conflicts with the repo-wide input-derived, no-wall-clock determinism convention.
   Injected clock or caller-supplied timestamps must be decided explicitly.
2. **Score and source provenance.** Per-field `FieldSource` / `FieldConfidence` must be derived from
   intake honestly, or the BIF must be explicitly marked partial. This is exactly the fabrication
   risk PR #69 deferred.

Briefly, on the other candidates: **Market Opportunity Intelligence** is stronger once discovery
context actually reaches it, which is what the two slices above enable — the checkpoint doc already
calls it "weaker without a solid business profile to anchor segments." **Website Intelligence** is
rated high-risk there because the useful version wants external fetching, which is out of boundary.
**Reporting Intelligence** is rated thin until upstream outputs deepen.

## 8. Hard Rules Observed by This Document

Documentation-only. No code, package, API, Web, DB, ADR-status, or SAGE changes. `develop` untouched.
No implementation started. The single file added is this document. The ADR proposed in §7 is
described, not authored — drafting it is a separate, explicitly authorized step.
