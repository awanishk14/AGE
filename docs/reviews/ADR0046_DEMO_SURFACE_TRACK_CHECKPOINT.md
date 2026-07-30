# ADR-0046 D3 — the demo-surface track

Checkpoint record for the three slices ADR-0046 D3 authorized after the capture track was parked.
One section per merged PR. History lives here, not in the untracked handover.

> The capture track's own record is `ADR0043_CAPTURE_CLI_TRACK_CHECKPOINT.md`. This file starts where
> that one stops: ADR-0046 D2 found that ADR-0045 D6's "the authorization set is empty" described a
> _track_, not the product, and named three gaps gated by nothing.

---

## §1 — Slice 1: the demo BIF surface (PR #162)

**Gap closed: G2.** The scored BIF was terminal-only. `DemoService.getCapabilityDemo()` called only
`runAllCapabilities()`, `CapabilityDemoResponse` carried no discovery or BIF field, and the web
`/demo` page therefore showed six capabilities with no sign that a Business Discovery → scored BIF
pipeline existed. `pnpm demo` was the single surface that ran it.

### What was actually wrong — and the trap in the slice as written

ADR-0046 D3 described slice 1 as "surface the Business Discovery / BIF **scoring** summary", and the
handover recorded that `runBusinessDiscoveryIntake` "already returns a ready-made summary". Both were
true, and together they were misleading: **`BusinessDiscoveryIntakeSummary` contained no score.** It
reported section types and profile counters only. Piping that existing shape through the API and the
web page would have satisfied the slice's letter while leaving out the numbers the slice exists for.

The fix was five read-through fields, not a new computation:

| Field                        | Read from           | Means                                                      |
| ---------------------------- | ------------------- | ---------------------------------------------------------- |
| `discoveryCompletenessScore` | `mappingMetadata`   | how completely the **interview** was captured              |
| `discoveryConfidenceScore`   | `mappingMetadata`   | how well-sourced the interview was                         |
| `bifCompletenessScore`       | projected `context` | what proportion of the canonical BIF is populated          |
| `bifConfidenceScore`         | projected `context` | trust in the produced intelligence                         |
| `bifStatus`                  | projected `context` | always `Draft` — surfaced so it can be _seen_, not trusted |

All five were already produced by `produceScoredBifContext` and then discarded. A test asserts the
summary equals the mapper's own values, so the demo can never grow a score of its own.

### The invariant this slice protects

The honesty proof is **97/63 intake vs 12/17 BIF**: a thoroughly captured interview still yields a
sparse Draft BIF, because discovery covers only part of the BIF surface. It is pinned in **three**
places — the runtime spec, the API spec and the HTTP smoke script — and each also asserts the pairs
are _distinct measurements rather than copies of each other_.

⚠️ **Never combine the two pairs into one headline number, and never surface only the intake pair.**
Either move reads as a strong result while the produced BIF is sparse. That is the exact failure mode
§5's "never interchangeable" rule exists to prevent, and before this slice the demo committed the
second half of it by omission.

### Boundaries held

- Discovery stays outside the approval model on all three surfaces: no decision objects, no
  `pendingApproval`, no change to the six-capability accounting.
- Omitted sections render as **neutral limitations of the intake** on the web page — not warnings,
  not evidence about the business (ADR-0026 D4).
- The API projects the runtime summary **field by field, not by spread**: the runtime is free to grow
  fields the read-only endpoint has not decided to expose, and a spread would publish them silently.
- Demo baseline facts unchanged: 6 capabilities, 6 pending approvals, accounting invariant OK, no
  side effects, 7 populated / 5 omitted sections.

### Incidental repairs

- `apps/demo/sample-output.txt` was **stale** — it predated the discovery stage entirely. Regenerated.
  ⚠️ A plain `> sample-output.txt` redirect drops the file's hand-written trailing note about
  `createdAt` being the only non-deterministic field. Re-append it after every regeneration.
- The CLI's closing line claimed discovery does "no scoring". Untrue under canonical Path B, which
  scores everything it maps. Corrected to say the scores are _reported, never acted on_.

### Changed files

`packages/demo-runtime` (`business-discovery.ts` + spec) · `apps/demo` (`run.ts`, spec,
`sample-output.txt`) · `apps/api` (demo DTO, service, spec, README, `scripts/smoke-demo.mjs`) ·
`apps/web` (`lib/demo.ts`, `app/demo/page.tsx`) · `docs/DEMO_RUN_GUIDE.md`.

---

## §2 — Remaining slices

| #   | Slice                                                                                                               | Gated by                                 |
| --- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 2   | Make `age-capture --mode produceOnly` invokable (G3); close ADR-0046 D4's connection defect at the composition root | nothing                                  |
| 3   | Wire the context-readiness bridge (G1)                                                                              | **its own `Status: Proposed` ADR first** |

⚠️ Slice 3 is the highest-value **and** highest-hazard work in the repo: it hands a
`ScoredBifContext` toward the capability runner for the first time — the coupling ADR-0026/0027 built
a separate entry point to prevent. Preconditions are mandatory: own ADR · an invariant test written
and **failing before** the wiring exists · the test scans emitted string **content**, never
`items.length` · `run` is never gated on context.

⚠️ Slice 2 carries ADR-0046 **D7**: never run `--mode produceAndCapture` against any durable database
until an authenticated principal exists. `produceOnly` opens no connection and constructs no
`PrismaClient`, which is precisely why it is not gated by ADR-0043 open question 2.
