# Registry Metadata Track Checkpoint (ADR-0026 follow-up 2 → ADR-0027 D3 → ADR-0028)

- Date: 2026-07-25
- Baseline: `main` @ `abff344`
- Scope: documentation only — this note records state, it decides nothing.

This is the checkpoint owed for the registry-metadata track. It is the counterpart to
`ADR0026_CAPABILITY_CONTEXT_CONSUMPTION_CHECKPOINT.md`, `ADR0027_CAPABILITY_CONTEXT_READINESS_CHECKPOINT.md`
and `SCORED_BIF_PERSISTENCE_TRACK_CHECKPOINT.md`, and it closes the last outstanding item on the
context-consumption line of work.

## 1. The question, and where it came from

ADR-0026 accepted that a capability may consume a caller-assembled `ScoredBifContext`. It left two
follow-ups deliberately undecided. Follow-up 2 was:

> Whether `INTELLIGENCE_CAPABILITY_ENTRY.consumes` should advertise `ScoredBifContext`.

ADR-0027 generalised the pattern to any capability and restated the same question as its **Decision 3**,
declining to answer it and naming the evidence bar explicitly: a third adopter. The question survived two
ADRs untouched, on purpose — it is a change to a shared contract in `@age/capability-kit`, and the
project's decision rule is that a missing architectural decision produces a Proposed ADR, not a guess.

## 2. Track ledger

| PR  | What                                                    | Merge SHA | Post-merge CI |
| --- | ------------------------------------------------------- | --------- | ------------- |
| #86 | Intelligence adopts readiness (adopter 1)               | `f697705` | SUCCESS       |
| #90 | Market Discovery adopts readiness (adopter 2)           | `55be969` | SUCCESS       |
| #92 | Revenue adopts readiness (adopter 3 — the evidence bar) | `65a25a4` | SUCCESS       |
| #93 | ADR-0028 `Status: Proposed`                             | `7c14781` | SUCCESS       |
| #94 | ADR-0028 `Status: Accepted` + acceptance note           | `20e5a63` | SUCCESS       |
| #95 | ADR-0028 Option C implemented                           | `29e1d1b` | SUCCESS       |

Governance shape is the same one used for ADR-0027 (#88 → #89) and ADR-0029/0030: the Proposed ADR is
merged to record it, the **user** accepts, a separate PR flips the status with an acceptance note, and
implementation is a third, separate slice. No ADR in this track was self-accepted.

## 3. What ADR-0028 settled

Option C, in three parts:

1. **`consumes` means "the input contracts a capability's `run` requires"** — a clarification of existing
   meaning, not a change. No entry's `consumes` value moved.
2. **`CapabilityRegistryEntry` gains an additive optional `assessesContext?: ReadonlyArray<string>`** —
   contracts read **only** through a non-gating readiness assessment (ADR-0027), never through `run`.
   `undefined` means the capability assesses no external context: the correct default for a non-adopter,
   mirroring how ADR-0026 leaves `sufficiency` `undefined` rather than defaulting it to `ready`.
3. **Adopters populate it per-slice** (`assessesContext: ['ScoredBifContext']`), not as a blanket rollout.

**Option B — flattening `ScoredBifContext` into `consumes` — was rejected as semantically wrong.** It
would assert that `run` requires the context, which is false and is precisely the conclusion ADR-0027
Decision 1 forbids anyone from drawing. The one-line change was the tempting one; it also happened to be
the one that encodes a lie in the platform's canonical metadata surface.

**Option A — advertise nothing — was declined** because it leaves the registry understating three
capabilities, forcing any future "which capabilities can assess context readiness?" consumer to hardcode
the list. That is the exact anti-pattern ADR-0008 built the registry to prevent.

### 3.1 A factual correction ADR-0028 had to make first

ADR-0027 Decision 3 asserted that `consumes` "feeds the read-only demo registry, and changing it changes
demo output." Verified against the code, that is **not true**:

- the six `*_CAPABILITY_ENTRY` constants are imported only by their own barrels and their own unit tests;
- nothing under `apps/` (`api`, `demo`, `web`) reads `.consumes`, resolves an entry, or renders registry
  metadata;
- `CapabilityRegistry.register/resolve/list` has no runtime caller outside `capability-kit`'s own tests.

The metadata is **latent/advisory today**. The correction lowers the blast radius — a change here moves
test expectations, not demo output — but it does not answer the question, which is semantic and stands
regardless of who reads the field. Recorded here because a wrong premise inherited from an Accepted ADR
is the kind of thing that quietly justifies a bad decision two slices later.

## 4. What PR #95 shipped

13 files, +91/−4. Metadata only: no behaviour change, `run` untouched, no capability imports `@age/bif`.

`packages/capability-kit/src/contracts/capability-registry-entry.ts`:

```ts
export interface CapabilityRegistryEntry {
  readonly name: Capability;
  /** The input contracts this capability's `run` method requires (ADR-0008). ... */
  readonly consumes: ReadonlyArray<string>;
  /** Contracts read ONLY through a non-gating readiness assessment (ADR-0027), never through `run`. */
  readonly assessesContext?: ReadonlyArray<string>;
  readonly produces: ReadonlyArray<string>;
  readonly executionDomains: ReadonlyArray<ExecutionDomain>;
  readonly dependencies: ReadonlyArray<Capability>;
}
```

Both fields carry doc comments, so the distinction survives without a reader consulting the ADR.

| Capability       | `consumes` (unchanged)     | `assessesContext`      |
| ---------------- | -------------------------- | ---------------------- |
| Intelligence     | `['RIEEvidencePackage']`   | `['ScoredBifContext']` |
| Market Discovery | `['MarketDiscoveryInput']` | `['ScoredBifContext']` |
| Revenue          | `['RevenueInput']`         | `['ScoredBifContext']` |
| Growth           | unchanged                  | `undefined`            |
| Authority        | unchanged                  | `undefined`            |
| Operations       | unchanged                  | `undefined`            |

### 4.1 What the tests hold down

- **Every one of the six entry specs asserts `consumes` never gains `ScoredBifContext`.** Adopters assert
  the new field's exact value; the three non-adopters assert its **absence**, so silent drift toward a
  blanket rollout fails a test rather than passing review.
- `capability-kit`'s `registry.spec.ts` (43 passing) asserts the field is genuinely optional — an entry
  without it registers and resolves with `assessesContext` still `undefined` — and that a round-trip
  through `register`/`resolve` returns `['ScoredBifContext']` **without the value leaking into
  `consumes`**.
- Gates green pre-push: `pnpm lint`/`typecheck`/`test`/`build`, demo (6 capabilities, 6 approvals,
  accounting invariant OK, no side effects), `@age/api` test (36), `smoke:demo` (6/6).

## 5. Status of the two ADR-0026 follow-ups

| #   | Follow-up                                         | State                                                                                                             |
| --- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | Shared vs per-capability sufficiency thresholds   | **Recorded with evidence, deliberately not closed.** ADR-0027 Decision 2 keeps them per-capability and published. |
| 2   | Should the registry advertise context consumption | **Closed** by ADR-0028 + PR #95.                                                                                  |

Follow-up 1 now has its third data point, and it is worth stating plainly because the surface reading is
misleading. All three adopters independently chose the **same integers** — `minSectionConfidenceScore: 50`,
`minSectionCompletenessScore: 50`, `minRootConfidenceScoreForReady: 70` — but they apply them to three
different section **shapes**:

| Capability       | What the thresholds are applied to                                                     |
| ---------------- | -------------------------------------------------------------------------------------- |
| Intelligence     | every present section; **no omitted section tolerated** for `ready`                    |
| Market Discovery | `icp_personas`, `products_services`, `market_competition` — indifferent to the rest    |
| Revenue          | `products_services`, `icp_personas`, `gtm_system` — a deliberately different third set |

Three identical numbers over three different domains is a weak signal, not a shared rule: the numbers
recur, the meaning does not. Promoting the integers to a shared constant would export the appearance of
agreement while hiding that each capability is asking a different question of the same input. Decision 2
stands. If this is ever revisited, the thing to consider sharing is the required-section **shape** — a
declared set plus a root-confidence floor — not the three numbers.

## 6. What remains deliberately open

- **The field name.** ADR-0028 settled the principle (required and optional inputs are distinct facts and
  must not share one array) and recorded that `assessesContext` vs `optionallyConsumes` vs a structured
  `{ contract, required }[]` could be reconsidered in review. `assessesContext` shipped; renaming it later
  is a contract change and needs its own decision.
- **Whether the registry is ever wired into runtime output.** It is latent today (§3.1). Making it live
  changes observable behaviour and is its own slice with its own ADR.
- **Whether every capability eventually adopts the readiness pattern.** Unchanged from ADR-0027: a
  permitted pattern, not a rollout; each adopter is its own slice and proof.

## 7. Standing guarantees, re-confirmed at this baseline

`run` never consults `ScoredBifContext` and is never gated by readiness · readiness output carries
permanently empty `items` and derives no plan, opportunity, action or recommendation · no capability
package imports `@age/bif` · `consumes` is not repurposed · missing sections are limitations, never
negative evidence · BIF status is never promoted · nothing under `apps/` changed in this track.

## 8. Where the outstanding work now sits

With this note, **every checkpoint owed by the context-consumption and persistence tracks is written.**
The open items are all gated decisions, not undone work:

- **ADR-0029 stage 3** (durable adapter, schema, migration) — gated behind its own Accepted ADR. Not
  started. See `SCORED_BIF_PERSISTENCE_TRACK_CHECKPOINT.md` §6 for the seven questions it must answer.
- **BIF status promotion (`Draft → Active`)** — undecided. A high score does not imply promotable.
- **API/Web exposure, expanded mapping coverage, a real client workspace/input source** — each deferred
  until the semantics they would expose are proven.
