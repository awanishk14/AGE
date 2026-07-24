# ADR 0027: Capability Context Readiness Assessment

- Status: Accepted
- Date: 2026-07-24

## Acceptance note

ADR-0027 was accepted after PR #88 documented the missing architectural decision blocking a second
`ScoredBifContext` consumer. The accepted decision ratifies:

- a capability other than Intelligence may read a `ScoredBifContext` **solely** to report whether that
  context is sufficient for its own work;
- such an assessment must use the shared `CapabilityResult` / `CapabilityOutput` envelope with a
  sufficiency state and mandatory reasons, via a separate, explicitly named entry point;
- readiness is **not** a gate — a capability's `run` must never consult, require or be blocked by it;
- no plan, opportunity, action or recommendation may be derived, ranked, named or hinted at;
- the pattern is permitted, not rolled out — each adopting capability is its own slice and its own proof;
- sufficiency thresholds stay per-capability and published in the capability's summary output;
- `CapabilityRegistryEntry.consumes` is not changed, and advertising context consumption needs its own ADR;
- the next implementation slice is exactly one capability adopting the pattern.

This PR only changes the ADR status and records acceptance. No implementation is started.

## Context

ADR-0026 is implemented. A capability can now read scored business context through the neutral
`ScoredBifContext` projection, report a first-class sufficiency state with mandatory reasons, and
state its limits without fabricating anything. It was proven by exactly one consumer — the
Intelligence capability (PR #86) — recorded in
`docs/reviews/ADR0026_CAPABILITY_CONTEXT_CONSUMPTION_CHECKPOINT.md`.

That checkpoint recommended a **second** consumer as the next slice, for a specific reason: with one
consumer, two questions ADR-0026 deliberately left open cannot be answered with evidence. Attempting
the slice stopped before any code was written, because it cannot be built without deciding a
platform-wide question that no ADR covers.

### The blocking question

Intelligence was a safe first consumer because its charter is already _assessing intelligence
quality_. Every remaining capability has a different charter — they derive **plan or opportunity
candidates**:

| Capability       | Charter, per its own source and ADR                     |
| ---------------- | ------------------------------------------------------- |
| Market Discovery | identifies and scores market **opportunity candidates** |
| Growth           | derives **growth plan candidates**                      |
| Authority        | derives **authority plan candidates**                   |
| Operations       | derives **operations plan candidates**                  |
| Revenue          | derives **revenue plan candidates**                     |

Handing any of them a `ScoredBifContext` invites exactly the thing every safeguard built in PRs
#74–#86 exists to prevent: **deriving plan candidates from business context**. On the sample context
— root confidence 17, 10 of 84 fields populated, 5 of 12 sections absent — that would be strategy
generated from near-absence. ADR-0026 Decision 4 forbids treating absence as evidence; generating
plans from it would be worse, because the output would carry no visible trace of how little it rested
on.

There is a narrower, defensible reading: a capability could read `ScoredBifContext` **solely to
report whether it has enough context to do its own work**, producing no candidates at all. That is a
readiness statement, not a plan. But whether capabilities may do this — and whether it is a
one-capability exception or a platform-wide pattern every capability eventually implements — is an
architectural decision. It should not be established as a side effect of the second implementation.

### The two open questions from ADR-0026

1. **Shared vs per-capability sufficiency thresholds.** ADR-0026 Decision 3 permits
   implementation-defined thresholds if they are deterministic and explainable, and leaves the
   shared-vs-local question to follow-up work. PR #86 kept thresholds local to Intelligence
   (`minSectionConfidenceScore: 50`, `minSectionCompletenessScore: 50`,
   `minRootConfidenceScoreForReady: 70`), published in every summary. That is defensible for one
   consumer and not obviously defensible for six.
2. **Capability registry metadata.** Whether `INTELLIGENCE_CAPABILITY_ENTRY.consumes` — and, if this
   ADR is accepted, every other entry — should advertise `ScoredBifContext`. That metadata feeds the
   read-only demo registry, so changing it changes demo output.

Question 1 cannot be answered without deciding the blocking question first: whether thresholds should
be shared depends entirely on whether more than one capability is permitted to have them.

## Decision

### Decision 1 — Capabilities may assess their own context readiness, and may not do more

A capability other than Intelligence **may** read a `ScoredBifContext` for the sole purpose of
reporting whether that context is sufficient for its own work. Such an assessment:

- **must** return the shared `CapabilityResult` / `CapabilityOutput` envelope with a
  `CapabilitySufficiency` state and mandatory reasons (ADR-0026 Decisions 2 and 3);
- **must** be a separate, explicitly named entry point — never a change to the capability's existing
  `run` method, and never a precondition of it;
- **must not** derive, rank, score, shortlist, name or hint at any plan, opportunity, action or
  recommendation, in items or in summary text;
- **must** phrase every limitation as a fact about the _context_, never about the business, and must
  never convert an absent section into a negative signal;
- **must** be pure and deterministic with caller-supplied `producedAt`, and **must not** import
  `@age/bif`.

**Readiness is not a gate.** A capability's `run` must not consult, require or be blocked by a
readiness assessment. The two paths stay independent, so nothing silently starts depending on
business context.

**This is a pattern, not a licence to roll it out.** Accepting this ADR permits the pattern; it does
not authorise implementing it in every capability. Each capability that adopts it is its own slice,
with its own PR and its own proof on the sample context.

### Decision 2 — Sufficiency thresholds stay per-capability, and stay published

Thresholds remain owned by the capability that applies them, and **must** be published in that
capability's summary output so any consumer can see exactly what "supported" meant for a given run.
No shared threshold constant, and no shared threshold policy, is introduced.

The reason is not convenience. "Enough context to assess evidence quality" and "enough context to
know whether a revenue plan could be grounded" are different judgements about different work; a
shared number would assert they are the same, which nothing has established. Two consumers is also
too small a sample to generalise from. If three or more capabilities converge on identical thresholds
and identical justifications, that is the evidence for a future ADR promoting them — and that ADR
should be written then, against the evidence, not now against speculation.

Thresholds **must** be deterministic integers applied by plain comparison, declared in one place per
capability, and explainable in the reasons the assessment returns.

### Decision 3 — Registry metadata is deferred, explicitly

`CapabilityRegistryEntry.consumes` is **not** changed by this ADR or by any slice implementing it.
`ScoredBifContext` consumption stays invisible to the capability registry for now.

That metadata feeds the read-only demo registry, and what a consumer of it is entitled to assume —
"this capability requires this input" versus "this capability can optionally assess this input" — is
an interface question the registry contract does not currently answer. Deciding it as a side effect
of a readiness slice would silently change demo output and assert a meaning the contract has not
defined. It stays open, and needs its own ADR.

### Decision 4 — The next slice

Exactly one capability adopts the Decision 1 pattern, as a pure package-level slice, chosen because
its readiness question is the most clearly separable from its plan generation. It must prove on the
sample context (root confidence 17) that it returns `partial` or `insufficient` with honest reasons,
and that it produces no plan candidates of any kind.

## Consequences

**Easier.** The threshold question from ADR-0026 gets answered with evidence from a second consumer
rather than speculation. Capabilities gain an honest way to say "I do not have enough context to do
my work" — which is a successful outcome, not an error, and is exactly what the platform has been
building toward. The pattern is bounded in writing before the first capability adopts it.

**Harder.** Every adopting capability now has two entry points, and the distinction between "assess
readiness" and "derive candidates" must be maintained by review and tests rather than by structure —
the temptation to let a readiness assessment hint at what it _would_ recommend is real, and is
precisely what Decision 1 forbids. Per-capability thresholds mean duplication, and mean a future
consolidation ADR if they converge. Deferring registry metadata means the demo registry understates
what capabilities can do.

**Deliberately not decided.** Whether every capability should eventually adopt the pattern; whether
thresholds should ever be shared; whether the registry should advertise context consumption; whether
readiness should ever gate execution. Each needs its own ADR, written when there is evidence for it.

**Unchanged.** Every ADR-0026 guarantee holds: no capability imports `@age/bif`; context reaches
capabilities only through `ScoredBifContext`; missing information is a limitation, never negative
evidence; unknown is never converted into good or bad; `ready` is never implied by omission and never
means a BIF may be promoted.
