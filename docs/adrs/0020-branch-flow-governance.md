# ADR 0020: Branch Flow Governance

- Status: Accepted
- Date: 2026-07-13

## Context

`docs/product/15_PRODUCT_ROADMAP.md` §6 (Release Principles) currently states the canonical branch
flow is **`feature → develop → main`**, with `main` holding stable releases.

Actual accepted execution, however, has not used `develop`. **Execution EPIC-02 through EPIC-08** all
shipped via **`feature/<epic-or-task> → main`** directly (integration branch = `main`), merging feature
branches into `main` through reviewed PRs (e.g. PR #31 Authority, PR #32 Operations, PR #33 Revenue).
The `develop` branch is **stale** — it has not been part of the accepted implementation workflow and
does not even contain EPIC-01.

**ADR-0018 and ADR-0019 recorded this discrepancy but deliberately did not resolve it.** Both flagged
it as a governance item to reconcile before further integration. This ADR resolves it.

Despite diverging from the documented rule, the actual workflow has remained safe because every merge
to `main` passed strict gates:

- task-scoped commits on a feature branch,
- a reviewed PR into `main`,
- ChatGPT architecture/code review,
- founder approval,
- green PR CI (`Lint, Typecheck, Test, Build`),
- green post-merge `main` CI,
- feature-branch cleanup after merge.

The safety of the process comes from these gates, not from branch topology. For a frozen architecture
delivered capability-by-capability on a single track, a long-lived `develop` integration line adds
operational cost (promotion overhead, back-merges, and stale-branch drift) without adding a safety
guarantee the gates do not already provide.

## Decision

For the current **pre-Phase-5 implementation stage**, AGE uses:

```
feature/<epic-or-task> → main
```

as the **canonical branch flow**. `main` is the **stable integration branch**.

Every merge to `main` MUST require all of:

- a feature branch,
- task-scoped commits,
- a reviewed PR into `main`,
- green PR CI,
- ChatGPT architecture/code review,
- founder approval,
- explicit merge approval,
- green post-merge `main` CI,
- feature-branch cleanup after merge.

These gates are mandatory; direct commits to `main` are reserved only for docs-only governance
changes, such as ADR status changes or roadmap-governance alignment, consistent with prior practice.
Such direct commits still require explicit founder approval and green `main` CI.

## Phase 5 Reconsideration Trigger

The team MUST revisit branch flow **before** any of the following begins:

- **Phase 5 Autonomous Execution** (side-effecting execution engines),
- **multi-team parallel release trains**, or
- an **external production release cadence** that requires staged promotion.

At that point the team MAY reintroduce any of:

- a `develop` integration branch,
- release branches,
- environment branches,
- staged promotion branches.

**None of those are active now**, and this ADR does not introduce them; it only records the trigger
that requires re-evaluating this decision.

## Consequences

Positive:

- Documentation matches proven, audited practice.
- Stale `develop` drift is eliminated.
- The workflow stays simple and auditable.
- The current repo size and single-track cadence remain well supported.
- CI and review gates remain the actual safety mechanism, explicitly enumerated.

Tradeoffs:

- `main` carries the latest stable _integrated_ work rather than curated release-only snapshots.
- Staged release promotion is deferred (release control is via tags/milestones, not a branch).
- Phase 5 (or multi-team / external-release scale) will require re-evaluation per the trigger above.

## Non-goals

This ADR explicitly does **not**:

- start Phase 5,
- create execution engines,
- change capability boundaries,
- modify any package code,
- decide the production deployment strategy, or
- remove the need for founder approval.

## Follow-up roadmap amendment

After this ADR is **Accepted**, `docs/product/15_PRODUCT_ROADMAP.md` §6 should be amended so the
release principle matches this ADR (and cross-references ADR-0020). **The roadmap is not amended in
this task** — the amendment is a separate, follow-up change gated on acceptance.

## Alternatives considered

1. **Keep `feature → develop → main` (roadmap as written).** Rejected for the current stage:
   reintroducing and maintaining a long-lived `develop` line adds promotion overhead and stale-branch
   drift (already observed) without a safety gain over the existing gates, for a single-track,
   single-founder, capability-by-capability cadence.
2. **Officially adopt `feature → main` with no Phase 5 trigger.** Rejected: correct for today but
   silently discards the staged-integration option exactly when it becomes valuable (Phase 5's side
   effects, multi-team parallelism, or external release cadence). Omitting the trigger risks locking
   in a flow that no longer fits at that scale.
3. **Defer the decision.** Rejected: leaves the roadmap contradicting practice and carries the
   ambiguity into Phase-5 planning, which ADR-0018/0019 already flagged as needing resolution.

**Preferred: the hybrid (Option C)** — adopt `feature → main` now with the explicit Phase-5
reconsideration trigger. It matches proven practice, removes the doc/practice contradiction and
stale-branch risk, and preserves staged integration as a deliberate future decision rather than an
unused mandate or a discarded option.
