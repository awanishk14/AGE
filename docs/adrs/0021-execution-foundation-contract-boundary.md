# ADR 0021: Execution Foundation Contract Boundary (Human-Approved, Dry-Run Only)

- Status: Accepted
- Date: 2026-07-14

## Context

We are entering the Execution Layer of AGE (colloquially "Phase 5"). The Execution Model
(`docs/product/12_EXECUTION_MODEL.md`, **Final**) is the governing invariant for side effects, but it
deliberately defines the **model, not the implementation** — it explicitly excludes "engine
internals, action catalogs, autonomy thresholds, timing/concurrency, and failure/rollback mechanics."
No ADR or code yet locks the **implementation contract boundary** for an execution foundation
(concrete domain types, their names, where they live, the approval gate as code, or the executor
boundary). No `@age/execution*` package exists.

Two forces make a decision necessary before any execution code is written:

1. **Repo governance convention.** Every capability domain was preceded by a contract-boundary ADR
   before implementation (ADR-0010…0015, 0017…0019), plus the shared disposition contract (ADR-0016)
   and the two-axis capability/execution model (ADR-0006, ADR-0007). ADR-0001 mandates recording
   architectural decisions. A brand-new **Execution** domain — the sole authority for side effects —
   is exactly such a decision.

2. **A scope-framing conflict that must not be resolved silently.** "Phase 5" is often shorthand for
   **Autonomous Execution**, but the frozen specs are unambiguous that this is **out of current
   scope**:
   - Execution Model §5 / §9.4: "No execution is autonomous within the current Product Bible scope…
     **Autonomous Execution remains explicitly out of scope.**"
   - Automation Model §5 / §7.1: "**Autonomous Execution is out of scope.**"
   - Product Roadmap §7 (The Phase 5 Boundary): "Autonomous Execution is a future-state capability
     boundary only. It **must not influence** current execution rules (Doc 12)… **All current system
     behavior remains strictly within Human-Approved Execution**… a boundary to plan _toward_, never
     an active design assumption."
   - Glossary: "Autonomous Execution — … **out of current scope.**"

   Therefore the execution foundation must be built as **Human-Approved Execution** — and, for the
   first slice, **dry-run / no-op only, with no real side effects** — not as autonomous execution.
   Recording this framing is itself an architectural decision.

The governing constraints from the Execution Model that this boundary must encode:

- **Sole authority / side-effect boundary** (§1, §2): only the Execution Layer may side-effect; pure
  layers `propose`, execution layers `create/update/…/execute`.
- **Origin constraint** (§4): execution never originates intent; it only fulfills **approved
  capability outputs**, validated decision packages, or human-approved workflows.
- **Approval requirement** (§5): every execution needs an explicit approval context or a pre-approved
  workflow state.
- **Integration access** (§6): only the Execution Layer may invoke external systems (not in this
  slice — nothing is invoked at all).
- **Traceability chain** (§8): Evidence → BIF → Decision → Capability Output → Execution.
- **Domain alignment** (§3, ADR-0007): execution aligns to the `ExecutionDomain` axis; this ADR does
  not redefine or enumerate it.

## Decision

Establish a **pure, in-memory, dependency-free Execution Foundation** as a new contract boundary,
consumed later by higher layers. It is **Human-Approved and dry-run-only**; it performs **no side
effects, no integration calls, and no autonomy**.

1. **Package.** Introduce `@age/execution-contracts` (`packages/execution-contracts`) for the pure
   domain types and the dry-run executor + guard, mirroring the existing `*-contracts` / `capability-kit`
   conventions. It may depend only on `@age/capability-kit` and the capability/contract packages it
   needs to reference accepted outputs and the `ExecutionDomain` axis. It **must not** depend on
   apps, NestJS, Prisma, Redis, integrations, HTTP clients, queues, or event buses.

2. **Core domain types (names locked here, since the specs defer naming).** No frozen spec name is
   overridden; these map onto Execution Model concepts:

   | Type                   | Meaning (spec anchor)                                                                                                                                |
   | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `ExecutionId`          | Stable identity for one execution.                                                                                                                   |
   | `ExecutionIntent`      | The pure, approved thing to be fulfilled — derived from an accepted capability output (origin constraint §4). Never authored by the execution layer. |
   | `ExecutionTarget`      | Where it would act: an `ExecutionDomain` (ADR-0007) within an Organization/Client/Project scope (§7).                                                |
   | `ExecutionRequest`     | An `ExecutionIntent` + `ExecutionTarget` + approval context; the unit submitted for execution.                                                       |
   | `ExecutionPlan`        | The validated, ordered fulfillment derived from a request (fulfillment only; never planning intent).                                                 |
   | `ExecutionStatus`      | Lifecycle: `PENDING_APPROVAL → APPROVED → DRY_RUN_COMPLETED` / `REJECTED` / `BLOCKED`.                                                               |
   | `ExecutionResult`      | Outcome carrying `mode: 'dry_run'`, `sideEffectsPerformed: false`, status, and metadata.                                                             |
   | `ExecutionGuard`       | Deterministic gate enforcing the invariants below (approval, valid target, origin).                                                                  |
   | `ExecutionAuditRecord` | Pure, in-memory provenance record linking result back through the traceability chain (§8).                                                           |

3. **Human-approval gate (mandatory, deterministic).** The `ExecutionGuard` blocks any request that
   is not explicitly approved and any request whose target/origin is invalid. Unapproved execution is
   **blocked deterministically** and can never reach the executor. Approval is an explicit input, not
   inferred.

4. **Dry-run / no-op executor only.** The only executor in scope simulates fulfillment and returns an
   `ExecutionResult` with `mode: 'dry_run'` and `sideEffectsPerformed: false`. It must not call
   external APIs, write to any store, send messages, publish content, mutate business state, or
   trigger queues/workers. Real side-effecting adapters are a **future slice, gated on a separate
   ADR** (integration access §6, and lifting the Human-Approved constraint is a **future, distinct
   product capability** per Docs 09/12/15 — not this ADR).

5. **Origin constraint in code.** Execution candidates may only be produced by a **pure mapper** from
   an already-accepted capability output to an `ExecutionIntent`. The mapper lives at package/domain
   level, changes no capability logic, and adds no fixtures beyond test-only ones.

6. **Auditability.** Every result yields an `ExecutionAuditRecord`. In-memory / pure-domain records
   are sufficient for the foundation; durable `AuditLog` persistence (Doc 12 §8, Doc 13 §8) is a
   later, separately-decided slice.

7. **No surface exposure.** No API or Web execution surface is added by the foundation; higher layers
   integrate later, each within this boundary.

## Consequences

- **Safety is structural, not incidental.** Human approval and the dry-run/no-op boundary are encoded
  in the guard and executor, so the foundation cannot perform a side effect even by mistake — matching
  the Execution Model's "absolute and non-negotiable" boundary.
- **Spec fidelity.** The build proceeds as Human-Approved Execution; Autonomous Execution stays out of
  scope and un-assumed, honoring Roadmap §7. Real side effects, integrations, persistence, and any
  autonomy each require their own future ADR.
- **Consistency.** Execution follows the same contract-first, pure-package pattern as the six
  capabilities, and reuses the `ExecutionDomain` axis rather than inventing a parallel taxonomy.
- **Cost.** A new package and ~9 domain types are introduced before behavior; this is the lowest-cost
  moment to lock the boundary, before any higher layer depends on it.
- **Open (deferred to later ADRs):** durable audit persistence; real integration adapters;
  idempotency/dedup semantics beyond the deterministic guard; concurrency/timing; failure/rollback;
  and any move toward autonomy.

## Status note

**Accepted** by the Product Owner (2026-07-14). Phase 5 Slice 1 implements this boundary in
`@age/execution-contracts`: the dry-run/no-op, Human-Approved execution foundation. Real
integrations, persistence, and any move toward autonomy remain out of scope and each require their
own future ADR.
