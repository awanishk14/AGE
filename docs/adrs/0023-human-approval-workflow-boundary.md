# ADR 0023: Human Approval Workflow Boundary

- Status: Proposed
- Date: 2026-07-17

## Context

ADR-0021 (Accepted) established `@age/execution-contracts` as a pure, in-memory, dependency-free
Execution Foundation: Human-Approved, dry-run/no-op only, no side effects. ADR-0022 (Accepted) extended
this with a durable persistence boundary, and Slices A–C under it are now complete:

- **Slice A** — dry-run execution audit persistence foundation (`@age/execution-audit-persistence`).
- **Slice B** — read-only execution audit history API (`apps/api/src/modules/execution-audit/**`).
- **Slice C** — read-only Web audit history view (`apps/web/src/app/execution-audit/**`).

All three slices are read-only. The system can now persist and display execution audit history, but it
still has **no approval endpoint, no approval UI, and no mutation workflow of any kind**. Every approval
context exercised so far (see `docs/DEMO_RUN_GUIDE.md`) is a `simulatedDemoApproval` stand-in —
explicitly not a security or workflow model — computed in-memory and never recorded as a durable
decision.

ADR-0022's Implementation Plan reserves **Slice D** for exactly this gap: "a separate ADR for the
approval workflow (how an approval decision is actually recorded, by whom, under what authorization)
before any approval UI is built." This ADR is that Slice D decision.

Human approval must be:

- **Explicit** — never inferred from viewing a page, polling a status, or any other passive action.
- **Auditable** — every decision is a durable, attributable fact, consistent with the append-only
  principles ADR-0022 already established for audit records.
- **Scoped** — bound to a specific execution request and a specific Organization/Client/Project tenant.
- **Non-ambiguous** — an approval decision must never be inferable, implicit, or defaultable.

Two scope-framing constraints carry forward unchanged from ADR-0021/ADR-0022 and must not be
reinterpreted here:

- **Approval of dry-run preparation is not real execution authorization.** Recording that a human
  approved a dry-run does not create, imply, or unlock any capability to perform a real side effect.
  Real (side-effecting) execution remains gated on its own future ADR (ADR-0022 Slice E).
- **Autonomous Execution remains out of scope** (Docs 09/12/15, Roadmap §7, ADR-0021, ADR-0022). Nothing
  in this ADR proposes, implies, or moves toward an approval or execution decision made without an
  identified human operator.

This ADR does not implement anything. It exists so that if/when Slice D is implemented, it proceeds
against a recorded architectural decision rather than an implicit one, per repo governance convention
(ADR-0001, and precedent from ADR-0010…0022).

## Decision

Define the architectural boundary for a future Human Approval Workflow, layered strictly around the
existing `@age/execution-contracts` foundation (ADR-0021) and the durable audit persistence boundary
(ADR-0022) — never inside either.

1. **Approval is a distinct state transition**, separate from execution. Recording an approval decision
   and performing a dry-run (or, in the future, a real execution) are different operations that must
   never be collapsed into a single implicit step.

2. **Approval must be explicit and operator-attributed.** An approval decision is only valid if it
   carries the identity of the human operator who made it. There is no default, implicit, or
   system-generated approval. `simulatedDemoApproval` is confirmed as demo-only and must not be reused
   as, or mistaken for, a real approval mechanism.

3. **Approval must be tenant/client scoped.** Every approval decision is bound to the same
   Organization/Client/Project scope as the `ExecutionRequest` it decides on. An approval can never
   apply across tenants.

4. **Approval must be append-only and auditable.** Once recorded, an approval decision is never mutated
   in place. A correction is a new record referencing the original — the same principle ADR-0022 already
   applies to audit history.

5. **Approval is separated from execution.** The approval workflow decides _whether_ an
   `ExecutionRequest` may proceed; it never itself performs a dry-run or a real execution. The existing
   `ExecutionGuard` (ADR-0021) remains the sole deterministic gate that checks approval state before an
   executor runs.

6. **Approval of dry-run preparation does not equal real execution authorization.** An approval decision
   recorded under this boundary authorizes, at most, a dry-run/no-op execution
   (`mode: 'dry_run'`, `sideEffectsPerformed: false`). It carries no authority over real, side-effecting
   execution.

7. **Real execution still requires a separate future ADR** (ADR-0022 Slice E). This ADR does not bring
   real execution any closer to being authorized — it only makes the human decision that already gates
   dry-run execution durable, attributable, and auditable.

8. **Autonomous approval/execution is out of scope.** Every approval decision in scope of this boundary
   requires an identified human operator. No component may generate, infer, or default an approval
   decision on a human's behalf.

## State model

The minimum state model architecturally necessary to represent an approval decision's lifecycle:

- `pending_review` — an `ExecutionRequest` exists and awaits an explicit human decision. This is the
  implicit starting state; no approval record exists yet.
- `approved_for_dry_run` — a human operator explicitly approved the request; only a dry-run/no-op
  execution is authorized as a result.
- `rejected` — a human operator explicitly declined the request. No execution of any kind may follow.
- `superseded` — a later approval decision on the same `ExecutionRequest` (e.g., a correction) replaces
  an earlier one; the earlier record is retained, unmutated, and marked superseded rather than deleted
  or edited.

No `expired` state is introduced by this ADR — retention/expiry policy for stale pending requests is
deferred; a future slice may add it if operational need is demonstrated. No `approved_for_execution` (or
equivalent real-execution-authorizing) state is introduced by this ADR — that remains gated on the
future real-execution ADR (ADR-0022 Slice E).

## Allowed future surfaces

Once this ADR is Accepted, a later implementation slice may add:

- An approval decision API endpoint (mutation), scoped per the API boundary below.
- An approval decision service/application-layer component.
- Approval decision request/response DTOs.
- An approval audit persistence record or event, following the same append-only conventions as
  `@age/execution-audit-persistence` (ADR-0022).
- A read-only display of approval decision status, layered onto the existing read-only audit history
  API/Web views (ADR-0022 Slices B/C).
- Tests that enforce no execute behavior is reachable from the approval surface.

## Forbidden surfaces

Explicitly forbidden, in this ADR and in any slice implemented under it, unless a distinct future ADR
accepts it:

- Real execution.
- Side-effecting adapters.
- External integrations.
- Autonomous approval.
- Autonomous execution.
- An execute button.
- An execute endpoint.
- Scheduler- or worker-driven execution.
- Approval decisions recorded without an identified operator.
- Approval decisions recorded without an explicit tenant/client scope.
- Mutation of historical approval records (correction is a new record, never an edit or delete).
- Silent approval (any approval inferred rather than explicitly submitted).
- Approval mutation via `GET`.
- Implicit approval by viewing a page, opening a record, or any other passive/read action.

## API boundary

High-level future API semantics only — exact routes are an implementation-slice decision, not mandated
here:

- Approval mutation must use a state-changing HTTP method (e.g. `POST`/`PATCH`) — **never `GET`.**
- Approval mutation must require an authenticated operator identity; there is no anonymous or system
  caller for this endpoint.
- Approval mutation must require an explicit tenant/client scope, matching the scope of the
  `ExecutionRequest` being decided.
- Approval mutation must be recorded as an auditable event/record before it is considered effective.
- Approval mutation must not trigger real execution, directly or indirectly.
- Approval mutation must not call any external system or integration.
- The existing read-only audit history endpoint (ADR-0022 Slice B) may be extended to surface approval
  status, but reading approval status must never itself constitute or trigger an approval decision.

## Web boundary

Future Web rules, extending the read-only pattern already established for audit history (ADR-0022
Slice C):

- Any approval UI must clearly and visibly state that its scope is dry-run/no-op only.
- Approval UI must not include, link to, or imply real execution.
- Approval UI must not offer an "approve and execute" combined action — approve/reject and execute are
  always distinct, separately gated actions.
- Approval UI must visually and functionally distinguish approve/reject decisions from any (future,
  out-of-scope) execute action.
- Approval UI must show the audit trail/provenance for a decision (who approved, when, on what scope),
  consistent with the existing traceability chain (Evidence → BIF → Decision → Capability Output →
  Execution).

## Persistence boundary

Approval persistence principles (principles only — no schema/migration in this ADR):

- Approval decisions are **append-only** records/events, following ADR-0022's existing audit persistence
  conventions.
- **Operator identity is immutable** once recorded on an approval decision.
- **Tenant/client scope is immutable** once recorded on an approval decision.
- **Decision timestamp is immutable** once recorded.
- **Decision reason/comment, if provided, is immutable** once recorded.
- The **latest approval status** for a given `ExecutionRequest` must be derivable by reading from the
  history/projection of approval records — never by mutating a single row in place.
- **No mutation of historical approval records.** A correction is always a new, superseding record.

## Consequences

**Positive:**

- A human approval workflow can be implemented safely after this ADR is accepted, against a recorded
  boundary rather than an ad hoc decision made mid-implementation.
- Execution remains separately gated: approving a dry-run never implies or unlocks real execution.
- Real execution remains blocked pending its own future ADR (ADR-0022 Slice E).
- Auditability improves: every future approval decision is attributable, tenant-scoped, and append-only,
  matching the existing execution audit trail.

**Negative / tradeoff:**

- Delays approval-workflow implementation until the security/permission questions ADR-0022 already
  flagged (who can approve, operator identity model, tenant scoping for writes) are resolved.
- Future DB persistence for approval records may still need its own implementation slice(s) even after
  this ADR is accepted, mirroring ADR-0022 Slice A's schema/repository work.
- Adds one more state machine (approval) alongside the existing `ExecutionStatus` lifecycle (ADR-0021),
  which future implementers must keep clearly separated.

## Out of scope

Explicitly out of scope for this ADR and for any slice implemented under it, unless a distinct future
ADR accepts it:

- Implementation of any kind.
- API endpoint creation.
- Web UI creation.
- DB/Prisma/schema/migration changes.
- Real execution.
- Side-effecting adapters.
- External integrations.
- Autonomous Execution.
- Scheduler- or worker-driven execution.
- Approval-to-execution automation (any mechanism that would perform execution as a consequence of
  approval without a separate, explicit, human-gated execution step authorized by a future ADR).

## Status note

**Proposed.** This ADR records the architectural boundary for a future Human Approval Workflow
(ADR-0022 Slice D). It does not implement an approval endpoint, approval UI, approval persistence, or
any mutation surface. Acceptance would enable a future implementation slice to proceed against this
recorded boundary; real (side-effecting) execution remains gated on a separate future ADR (ADR-0022
Slice E) regardless of this ADR's disposition.
