# ADR 0022: Durable Human-Approved Execution Audit / Approval Persistence Boundary

- Status: Proposed
- Date: 2026-07-16

## Context

ADR-0021 (Accepted) established `@age/execution-contracts` as a **pure, in-memory, dependency-free**
Execution Foundation: Human-Approved, dry-run/no-op only, no side effects, no persistence. Phase 5
Slice 2 bridged that foundation into `@age/demo-runtime` and the demo CLI to produce a read-only
execution preview; Slice 3 exposed the same preview, read-only, through the existing
`GET /demo/capabilities` API route and the `/demo` Web page. A subsequent safety audit confirmed no
accidental execution surface, no mutation route, and no forbidden infra dependency exists anywhere in
this path.

Every `ExecutionResult`, `ExecutionAuditRecord`, and approval context produced so far is **transient**:
computed per-request, in-memory, and discarded once the response is sent. Nothing is written to a
database. Nothing survives a process restart. Nothing can be queried as history.

The next meaningful step toward real Human-Approved Execution is **durability**: persisting execution
requests, approval decisions, dry-run plans, dry-run results, and their audit/provenance trail so that
they can be queried, replayed, and relied upon as a record — before any side-effecting executor exists.
Persistence is a genuine architectural decision, not an implementation detail, because it introduces:

- **Auditability guarantees** (append-only? immutable? who can amend a record, and how?)
- **Approval semantics as durable state** (an approval decision becomes a fact that outlives the
  request that produced it)
- **Tenancy** (execution records must be scoped to an Organization/Client/Project boundary and must
  never leak across tenants)
- **Replay/history** (can a past dry-run be inspected later, and by whom?)
- **A first real database write** in the execution path — the first slice in Phase 5 where "pure,
  in-memory, no persistence" (ADR-0021's explicit boundary) is deliberately extended, not violated.

This ADR does **not** implement any of the above. It exists so that if/when Slice 4 is implemented, it
proceeds against a recorded decision rather than an implicit one, per repo governance convention
(ADR-0001, and precedent from ADR-0010…0021).

**Autonomous Execution remains out of scope** (Docs 09/12/15, Roadmap §7, ADR-0021). Nothing in this
ADR proposes, implies, or moves toward autonomous or real side-effecting execution.

## Decision

Propose (not yet implement) a durable persistence boundary for **Human-Approved, dry-run-only**
execution audit and approval records, layered strictly _around_ the existing pure `@age/execution-contracts`
foundation — never inside it.

### What would be persisted

If this ADR is accepted, a future slice would persist:

- `ExecutionRequest` records (intent + target + approval context, as submitted)
- `ApprovalContext` / approval decision records (who approved, when, and the decision outcome)
- `ExecutionPlan` (dry-run plan) records
- `ExecutionAuditRecord` records (the full traceability chain: Evidence → BIF → Decision → Capability
  Output → Execution)
- `ExecutionResult` records — **dry-run only** at first; `mode: 'dry_run'` and
  `sideEffectsPerformed: false` remain the only persisted outcome shape until a future ADR accepts a
  real (side-effecting) executor
- Operator identity and tenant context (who initiated/approved, within which Organization/Client/Project)
- Timestamps for every state transition
- `ExecutionStatus` transitions (`PENDING_APPROVAL → APPROVED → DRY_RUN_COMPLETED` / `REJECTED` /
  `BLOCKED`), as a durable history, not just a final state

This remains **Human-Approved Execution only**. Persisting a dry-run's audit trail does not grant,
enable, or imply any real execution capability — it only makes the existing dry-run boundary durable
and inspectable.

## Data model principles (principles only — no schema/migration in this ADR)

- **Append-only** audit records where the record represents a historical fact (a decision, a state
  transition, a dry-run outcome). History is never rewritten.
- **Immutable approval records.** Once an approval decision is recorded, it is not edited in place; a
  correction would be a new record referencing the original, never a mutation of it.
- **Tenant-scoped.** Every execution/approval/audit record carries an explicit Organization/Client/
  Project scope; no record is tenant-ambiguous.
- **Provenance chain preserved.** The traceability chain (Evidence → BIF → Decision → Capability
  Output → Execution) established by ADR-0021 must be persisted end-to-end, not summarized or dropped.
- **No silent mutation of audit history.** Any correction, redaction, or retention action must itself
  be an auditable, explicit operation — never a bare `UPDATE`/`DELETE` on a history row.
- **Real side-effect adapters remain a future, separate ADR.** This ADR does not authorize, design, or
  schedule real (side-effecting) execution.
- **Dry-run records may be persisted before real execution exists.** Durability of the dry-run boundary
  does not require or imply a real executor exists yet.
- **`sideEffectsPerformed` remains `false`** on every persisted record until a future ADR explicitly
  accepts real adapters and a real executor. This invariant must hold at the persistence layer exactly
  as it holds today at the in-memory layer.

## API boundary

Decision for the next implementation slice, **if** this ADR is accepted: expose, at most, a
**read-only audit history endpoint** — nothing else. Two more conservative alternatives (no API until
persistence exists; internal repository only first) remain available and may be chosen instead when
Slice 4 is scoped; this ADR does not mandate which of the three, only that none of them is an execute
or approval-decision endpoint.

**No execute endpoint is proposed by this ADR.** An execute endpoint (one that could ever trigger a
real, side-effecting execution) is explicitly **future and out of scope**, gated on its own ADR that
accepts a real executor.

**No approval-decision endpoint** (an endpoint that lets a caller _record_ an approval) is proposed by
this ADR either — recording approvals via API is deferred to the future approval-workflow ADR called
out in Out of scope / Implementation plan below. If a read-only audit endpoint is built first, it may
read persisted approval records but must not accept an approval decision as input.

## Web boundary

If persistence exists, Web **may** show persisted dry-run audit history in a read-only view (list of
past execution requests, their approval context, their dry-run result, their status transitions) —
consistent with the existing read-only `/demo` pattern.

**Hard rule: no approve/execute UI** (no button, form, or client-side action that submits an approval
decision or triggers execution) **is in scope, unless and until a future ADR explicitly scopes it.**
This mirrors the hard rule already enforced in Slice 3 and confirmed by the safety audit.

## Security / permissions

Before any implementation, the following must be decided (each is a genuine open question, not
resolved by this ADR):

- **Who can view execution audit history** — role/permission model for read access.
- **Who can approve** — identity and authorization model for recording an approval decision.
- **Whether approval requires explicit operator identity** — i.e., approvals must be attributable to a
  real, authenticated operator, not a simulated or anonymous context (the current demo's
  `simulatedDemoApproval` is explicitly a demo-only stand-in and must not be treated as a security
  model).
- **Tenant/client scoping** for both read and (eventual) approval-write access.
- **Audit retention expectations** — how long records are kept, and whether/how retention actions are
  themselves audited.
- **No cross-tenant visibility** — an operator in one Organization/Client/Project must never be able to
  read another's execution audit history.

## Out of scope

Explicitly out of scope for this ADR and for any slice implemented under it, unless a distinct future
ADR accepts it:

- Autonomous Execution
- Real, side-effecting execution adapters
- External integrations
- An execute endpoint
- An approval-decision endpoint
- Approve/execute buttons or any client-side mutation trigger
- Background workers, queues, or job schedulers
- Automatic retries
- Scheduler-driven execution
- Any mutation of production workflow state

## Consequences

**Positive:**

- Creates an explicit, auditable path toward real Human-Approved Execution, decided in advance rather
  than backed into.
- Keeps execution governance explicit: every future persistence/API/Web change in this area can be
  checked against a recorded boundary.
- Reduces the risk of an accidental real-execution surface being introduced alongside "just persisting
  the audit trail" — the two are explicitly decoupled here.

**Negative / tradeoff:**

- Delays real (side-effecting) execution further — persistence, and the security/permission questions
  above, must be resolved first.
- Requires schema, repository, and API-shape decisions before any implementation, adding process
  overhead before the next visible feature ships.
- Adds genuine persistence complexity (tenancy, immutability, retention) that the pure in-memory
  foundation has not had to address until now.

## Implementation plan if accepted (future slices only — no code in this ADR)

- **Slice A** — schema/repository for durable dry-run execution audit records (persistence-layer only;
  no API/Web surface).
- **Slice B** — API read-only audit history endpoint, consuming Slice A.
- **Slice C** — Web read-only audit history view, consuming Slice B.
- **Slice D** — a separate ADR for the approval workflow (how an approval decision is actually
  recorded, by whom, under what authorization) before any approval UI is built.
- **Slice E** — a separate ADR for real (side-effecting) adapters before any real execution exists.

## Compatibility with ADR-0021

- ADR-0021 **remains valid and unchanged.** This ADR does not modify, relax, or reinterpret its
  dry-run/no-op contract behavior.
- This ADR does not change what `@age/execution-contracts` computes — only proposes how the records it
  already produces might, in a future slice, be made durable _around_ it.
- `@age/execution-contracts` **must remain pure and persistence-free.** Any repository/persistence
  layer introduced under this ADR lives outside that package (e.g., at the app or a new
  persistence-adapter package level) and consumes its types — it does not add a database dependency,
  an ORM, or any I/O into `@age/execution-contracts` itself.
