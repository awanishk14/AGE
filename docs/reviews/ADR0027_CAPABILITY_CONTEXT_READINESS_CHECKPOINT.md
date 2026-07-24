# ADR-0027 Capability Context Readiness — Implementation Checkpoint

- Date: 2026-07-24
- Baseline: `main` @ `55be969` (merge of PR #90)
- Scope: documentation only. No code, test, package, dependency, schema, configuration, workflow or
  CI change accompanies this note.

## 1. What this checkpoint records

ADR-0027 was accepted with four decisions. Decision 4 — "exactly one capability adopts the Decision 1
pattern" — is now implemented and merged. This note records what was built, what the **second**
consumer of `ScoredBifContext` proved that the first could not, and what the evidence says about the
question ADR-0026 deliberately left open.

| Decision | What                                                                                    | State                                 |
| -------- | --------------------------------------------------------------------------------------- | ------------------------------------- |
| 1        | A capability may read `ScoredBifContext` **solely** to report its own context readiness | **Proven** by PR #90                  |
| 2        | Sufficiency thresholds stay per-capability and published                                | **Held** — see §4                     |
| 3        | `CapabilityRegistryEntry.consumes` unchanged                                            | **Held** — still open, still deferred |
| 4        | Exactly one capability adopts the pattern                                               | **Done** — PR #90                     |

## 2. What PR #90 delivered

`packages/capabilities/market-discovery` gained a read-only, deterministic readiness assessment:

- `assessMarketContextReadiness(context, scoredBifContext, { producedAt }) → MarketContextReadinessResult`
- `MarketDiscoveryCapability.assessMarketContext(...)` delegates to it
- `MARKET_CONTEXT_READINESS_VERSION = '1.0.0'`
- `REQUIRED_MARKET_CONTEXT_SECTION_TYPES = ['icp_personas', 'products_services', 'market_competition']`
- `MARKET_CONTEXT_READINESS_THRESHOLDS = { minSectionConfidenceScore: 50, minSectionCompletenessScore: 50, minRootConfidenceScoreForReady: 70 }`
- 34 new tests; 93 passing in the package

State machine, over the **required sections only** — sections outside that set count neither for nor
against readiness:

- `blocked` — `sections` is not an array, or `contextVersion` major ≠ 1, or nothing is populated
- `ready` — every required section present, each clearing both thresholds, **and** root confidence ≥ 70
- `partial` — at least one required section supported
- `insufficient` — required sections exist, none supported. A normal `return`, never a throw

### Pinned result on the 17-confidence sample

|                             |                                                            |
| --------------------------- | ---------------------------------------------------------- |
| state                       | **`partial`**                                              |
| supported required sections | 1 — `products_services` (63 confidence / 100 completeness) |
| weak required sections      | 2 — `icp_personas` (45/50), `market_competition` (21/11)   |
| absent required sections    | 0                                                          |
| root scores carried through | confidence 17, completeness 12                             |
| `output.items`              | **empty**                                                  |

## 3. What the second consumer proved that the first could not

Intelligence (PR #86) was a safe first consumer precisely because its charter is already _assessing
intelligence quality_. It proved the projection could be consumed; it could not prove the harder
thing, because for Intelligence "assess the context" and "do my job" are close to the same sentence.

Market Discovery's charter is different: it **derives and scores market opportunity candidates**.
Handing it a `ScoredBifContext` is exactly the situation ADR-0027 was written to bound. Three things
follow that only a plan-deriving capability could demonstrate:

**a. The separation is structural, not a promise.** `MarketContextReadinessResult` is
`CapabilityResult<CapabilityOutputItem, MarketContextReadinessSummary>` — the **base** item type,
with `output.items` permanently empty. There is no item shape an opportunity could occupy. The
summary is deliberately not `OpportunityProcessingSummary`, and a test asserts it carries none of that
type's fields (`derivedCount`, `acceptedCount`, `rejectedReasons`, `duplicates`, …).

**b. The prose is policed, not merely reviewed.** The subtler failure is a readiness assessment that
emits no items but hints in its reasons at what it _would_ recommend. A test scans every emitted
string — reasons, warnings, limitations, improvement hints, per-section text, in every state — against
`opportunit|recommend|plan|action|strateg|next step|should|priorit`. One exception is sanctioned and
explicit: the notice carried in the reasons stating that the assessment derives no market opportunity
and none may be inferred from it.

**c. Readiness did not become a gate.** `run` is unchanged, never calls the assessment, and never
sees a `ScoredBifContext`. Both facts are asserted from source, and `process-market-discovery.ts` is
asserted not to import `@age/business-discovery-contracts` at all. The capability now has two
independent entry points, and the plan-deriving one still has no access to business context.

**d. Absence still did not become evidence.** On the sample, `market_competition` scores 21/11. The
assessment reports that as context that cannot be relied on yet, phrased explicitly as a statement
about the captured context and "not a finding about the business or its market". Nothing infers a
weak competitive position from weak competitive data — which is the specific mistake a market
capability is most likely to make.

## 4. The threshold question, answered with evidence

ADR-0026 follow-up 1 asked whether sufficiency thresholds should be shared or per-capability.
ADR-0027 Decision 2 kept them per-capability and published. Two consumers now exist, and the
evidence is genuinely mixed — which is worth recording plainly rather than resolving prematurely.

**What points toward sharing:** both capabilities independently landed on the same numbers —
50 / 50 / 70. Neither copied the other; the second was chosen because they seemed like the right
defaults for the same reason (one field of nine should not read as solid; root confidence should
gate the strongest claim).

**What points against sharing:** the numbers match, but what they are applied _to_ does not.
Intelligence assesses **all seven present sections** and requires **no omitted section anywhere** for
`ready`. Market Discovery assesses **three named sections** and is indifferent to the other nine.
Identical constants over different section sets are not the same policy, and a shared constant would
assert an equivalence that does not hold. The visible consequence is in the results: Intelligence
reports 6 unsupported sections and 5 missing on the same context where Market Discovery reports
2 weak and 0 absent. Same input, same thresholds, different — and both correct — readiness pictures.

**Recommendation:** hold. Decision 2 stands. What a third consumer should be watched for is not
whether it picks 50/50/70 again, but whether it also needs a **required-section set** — because if it
does, the thing worth sharing is the _shape_ (required set + two section thresholds + a root gate),
not the integers. That is a contract question, and it deserves an ADR written against three data
points rather than two.

## 5. Still intentionally open

1. **Registry metadata** (ADR-0026 follow-up 2, restated as ADR-0027 Decision 3). Whether
   `CapabilityRegistryEntry.consumes` should advertise `ScoredBifContext`. Untouched by PR #90 and
   pinned by test. It feeds the read-only demo registry, and what a consumer may assume from it —
   "requires this input" versus "can optionally assess this input" — is undefined by the contract.
2. **Whether every capability should adopt the pattern.** ADR-0027 permits it; it does not roll it
   out. Four capabilities (Growth, Authority, Operations, Revenue) have not adopted it and need not.
3. **BIF status promotion (`Draft → Active`).** Untouched. A `ready` readiness state says nothing
   about promotability and must never be read as saying so.
4. **Persistence of a scored BIF, and API/Web exposure.** Nothing in this track has left package
   scope, in memory, deterministic.

## 6. Recommended next slice

Three candidates, in order of what they would actually settle:

**Option A — a third readiness consumer** (Revenue or Growth). This is the only path that produces
the third data point §4 says the threshold-shape question needs. It is a well-understood slice now:
the pattern, the test list and the failure modes are all established. Cost: another capability with
two entry points, and no new architectural information beyond the threshold shape.

**Option B — the registry metadata ADR.** Settles the oldest open follow-up, and is the only open
item that touches something user-visible (the demo registry). It is a contract question, so it is an
ADR first, not an implementation. Small, and it unblocks nothing else — which is also an argument for
doing it now, while it is cheap.

**Option C — persistence of a scored BIF.** The largest step, and the first that leaves pure
package scope. It should not be taken while consumption semantics are still accumulating decisions.

**Recommended: Option A**, then B. A third consumer answers a question already framed and already
waiting for evidence; the registry ADR can be written at any time and does not degrade by waiting.
Persistence should follow both.

## 7. What must not be done next

- Do not roll the readiness pattern out across the remaining capabilities in one PR. Each adoption is
  its own slice and its own proof (ADR-0027 Decision 1).
- Do not promote the thresholds to a shared package on the strength of two matching triples. §4
  explains why the match is superficial.
- Do not let readiness gate `run` anywhere, for any capability, for any reason short of a new ADR.
- Do not change `consumes` as a side effect of an implementation slice.
- Do not derive an opportunity, plan, action or recommendation from a readiness assessment, and do
  not let one hint at what it would recommend.

## 8. Hard boundaries (unchanged)

Pure, package-level, in-memory only · no real side effects · no execution engines · no external APIs ·
no AI/LLM calls · no URL fetching · no persistence writes · no queues or events · no API/Web/demo-runtime
changes unless a slice explicitly requires them · no workflow/CI changes unless the slice is about CI ·
capability packages never import `@age/bif` · scored context reaches capabilities only through
`ScoredBifContext` · missing information is a limitation, never negative evidence · unknown is never
converted into good or bad · no fabricated provenance, scores, sections or conclusions · BIF status is
never promoted · insufficient context is a valid **successful** outcome.
