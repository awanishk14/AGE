# ADR 0024: Production Operator and Tenant Context Boundary

- Status: Accepted
- Date: 2026-07-18

## Context

ADR-0023 (Accepted) established the Human Approval Workflow Boundary, and its three implementation
slices are complete and merged to `main`:

- **Slice D1** — `@age/execution-approval-workflow`: approval decision model, approval states,
  append-only repository port, in-memory repository, pure status derivation.
- **Slice D2** — approval API (`apps/api/src/modules/execution-approval/**`): approve/reject/status/list
  routes, in-memory repository wiring.
- **Slice D3** — approval Web UI (`apps/web/src/app/execution-approval/**`): status/history display,
  approve-for-dry-run and reject decisions, explicit dry-run/no-op language.

Documented at `docs/05-implementation/PHASE_5_HUMAN_APPROVAL_WORKFLOW_COMPLETE.md`.

Both the API and Web layers currently accept `organizationId`, `clientId`, an optional `projectId`, and
`operatorId` as **explicit request-provided fields** — in the request body for mutations, in query
parameters for reads. This was an intentional, documented test-safe/demo strategy (ADR-0023's API/Web
boundary sections require an explicit, non-inferred, non-anonymous operator and scope, but do not mandate
where that identity originates). It is sufficient to prove the append-only, operator-attributed,
tenant-scoped approval model end-to-end. It is **not** sufficient for production use: any caller can
currently assert any `operatorId` or any tenant scope simply by putting it in the request. There is no
verification that the caller is who they claim to be, or that they are permitted to act within the tenant
scope they assert.

This gap blocks every future step that depends on trustworthy identity and scope:

- Durable approval persistence (a future ADR) needs to know the identity/scope fields it persists are
  trustworthy, not just present.
- A future real-execution ADR (ADR-0022 Slice E) cannot authorize anything against an operator identity
  that is merely self-asserted.
- Future background jobs need a defined way to carry tenant/client/operator-or-system context that
  doesn't reduce to "whatever the caller put in the request."

This ADR closes that gap architecturally — it defines where operator identity and tenant/client/project
scope must come from in production, and what must change (in a later, separate implementation slice) for
the ADR-0023 approval surface — and any future audit or execution surface — to be production-safe. It
does not implement anything.

## Decision

Define the canonical production boundary for operator identity and tenant/client/project scope, to be
consumed by all current and future write- and read-paths that require attribution or scoping (approval
decisions, audit records, execution requests, and background jobs).

### 1. Operator identity

- In production, operator identity **must** come from an authenticated session/token verified by the
  platform's auth mechanism (mechanism unspecified by this ADR — see Non-goals). It is never trusted from
  an arbitrary request body or query field.
- A production request handler must resolve `operatorId` from verified authenticated context (e.g. a
  session, a verified JWT claim, or equivalent) — **not** from a client-supplied `operatorId` field.
- Once resolved, operator identity is attached identically to every attributed record it governs today or
  in the future: approval decisions (ADR-0023), audit records (ADR-0022), and future execution requests
  (ADR-0021/ADR-0022 Slice E). The attribution contract those ADRs already define (explicit,
  non-inferred, immutable once recorded) is unchanged by this ADR — only the _source_ of the identity
  changes.
- If a system actor (not a human) must ever originate a record, it must be an explicit, distinguishable
  actor type (e.g. a system-actor identity, never a spoofable human `operatorId`) — and any such actor
  type requires its own future ADR before use. No such actor type is introduced here.

### 2. Tenant / client / project scope

- Production tenant/client scope is **derived from authenticated context** (the operator's verified
  memberships), **not** accepted verbatim from the request body or query string.
- Where a request must select among multiple scopes the operator is a member of (e.g. a user in two
  organizations), the selection may come from a route parameter or explicit request field, but the
  selected scope **must be validated** against the operator's verified memberships/permissions before
  the request proceeds. An unvalidated selection is equivalent to trusting an anonymous claim and is
  forbidden.
- `projectId`, where applicable, follows the same rule: accepted as an explicit selection only when
  validated against the resolved `organizationId`/`clientId` scope and the operator's permissions within
  it.
- No request may read or write data for a tenant scope the resolved operator identity is not a verified
  member of.

### 3. Request body trust boundary

- **Demo/test-safe scope (current state, unchanged by this ADR):** explicit `organizationId`, `clientId`,
  `projectId`, and `operatorId` fields in the request body/query string remain acceptable, exactly as
  ADR-0023 Slices D2/D3 implement today. This ADR does not require changing that code.
- **Production scope (future, gated on a later implementation slice):** `operatorId` must never be
  accepted from the request body or query string — it must be resolved from authenticated context only.
  `organizationId`/`clientId`/`projectId` may be accepted as an explicit _selection_ (e.g. "which of my
  orgs am I acting as") but must be validated against authenticated membership before use — never trusted
  as an unvalidated assertion.
- Any request field that is authenticated-context-derived in production must be documented as such at the
  point it is introduced; a field that is demo-only trust must say so, consistent with the comments
  already present in `apps/web/src/lib/execution-approval.ts` and `apps/api/src/modules/execution-approval/**`.

### 4. Approval workflow impact (ADR-0023)

- The current ADR-0023 API/Web implementation (explicit body/query fields) remains valid for demo/test-safe
  scope and requires no immediate change as a result of this ADR.
- A future implementation slice, once auth/tenant infrastructure exists, must:
  - Derive `operatorId` for approve/reject decisions from authenticated context, not the request body.
  - Validate `organizationId`/`clientId`/`projectId` against the resolved operator's memberships before
    recording or reading a decision.
  - Preserve every invariant ADR-0023 already established: approval decisions remain operator-attributed,
    tenant/client scoped, append-only, dry-run-only, and never trigger execution.
- This ADR does not change the ADR-0023 state model, API routes, or Web UI. It only defines where the
  identity/scope inputs to that unchanged model must come from in production.

### 5. Audit and execution impact

- Future durable audit persistence (building on ADR-0022) must record operator identity and tenant/client
  scope resolved per this ADR — the same trust boundary, not a separate one.
- A future real-execution ADR (ADR-0022 Slice E) must require a trusted, authenticated-context-derived
  operator identity and validated tenant/client scope before any execution request may be authorized. No
  execution request may be authorized against a self-asserted identity or scope.

### 6. Background job impact

- Any future background job, worker, or scheduler (none exist today — still forbidden per ADR-0021/0022/0023)
  that acts on behalf of a tenant must carry a trusted tenant/client context and an explicit actor
  identity — either a verified human operator's identity, propagated from the request that enqueued the
  work, or a distinguishable system-actor identity (see §1). A background job must never infer or default
  its tenant/client/operator context.

### 7. Permission model boundary

- This ADR defines **only** the context boundary — where trusted operator identity and tenant/client
  scope come from, and how they must be validated before use. It does **not** define a permissions/RBAC
  matrix (e.g. which roles may approve, which roles may read which records). A full permissions model, if
  and when needed, is a separate future ADR that may build on the identity/scope boundary this ADR
  defines.

## Security invariants

- No anonymous production approval — every production approval/rejection decision requires a resolved,
  authenticated operator identity.
- No unscoped production approval — every production approval/rejection decision requires a validated
  tenant/client scope.
- No trusting `operatorId` from the request body in production — operator identity must be resolved from
  authenticated context.
- No cross-tenant approval, read, or write — every request is confined to tenant scope the resolved
  operator is a verified member of.
- No execution (dry-run or real) without trusted tenant/client context — this ADR's boundary applies
  identically to any future execution request, not only to approval decisions.
- System actors, if introduced later, must be explicit and distinguishable from human operators — never a
  human-shaped `operatorId` used to disguise system-originated activity.

## Non-goals

- No implementation of any kind.
- No auth library or provider selection (e.g. no choice of session vs. JWT vs. OAuth provider is made
  here).
- No DB schema implementation.
- No migration.
- No change to the ADR-0023 approval API.
- No change to the ADR-0023 approval Web UI.
- No real execution.
- No Autonomous Execution.
- No full RBAC/permissions matrix — only the identity/scope context boundary is defined; a permissions
  matrix is deferred to its own future ADR unless one is already canonical elsewhere in the docs
  (none currently is).

## Consequences

**Positive:**

- Unblocks safe, incremental hardening of the ADR-0023 approval API/Web surface without requiring a
  rewrite of its state model, routes, or UI.
- Gives a durable approval persistence design (a future ADR) a defined, trustworthy source for the
  identity/scope fields it will persist.
- Gives a future real-execution ADR (ADR-0022 Slice E) a precondition it can depend on rather than
  re-deriving its own identity/scope trust model from scratch.
- Gives future background job design a defined rule for propagating trusted context, preventing an
  implicit or ad hoc convention from emerging later.

**Negative / tradeoff:**

- Introduces a known, currently-unclosed gap between demo/test-safe scope (accepted, documented,
  unchanged) and production-safe scope (defined here, not yet implemented) — callers must not assume the
  current API/Web behavior is production-ready.
- Defers concrete auth/tenant integration work to a future implementation slice, which itself likely
  depends on a platform-level auth decision not yet made.
- Adds one more boundary future implementers must consult (alongside ADR-0021/0022/0023) before extending
  approval, audit, or execution surfaces.

## Status note

Proposed. Acceptance of this ADR records the production operator/tenant context boundary and unblocks
future implementation slices (approval API/Web hardening, durable persistence design, and a future
real-execution ADR) to proceed against a recorded decision. Acceptance itself does not implement
authentication, tenant validation, a permissions matrix, DB persistence, an execute endpoint, real
execution, or Autonomous Execution — each remains separate, future, and out of scope for this ADR.
