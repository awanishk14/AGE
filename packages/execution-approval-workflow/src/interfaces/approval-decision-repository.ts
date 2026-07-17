import type { ExecutionId, ExecutionScope } from '@age/execution-contracts';
import type { ApprovalDecision } from '../types/approval-decision';

/**
 * ApprovalDecisionRepository — the append-only persistence port for human
 * approval decisions (ADR-0023 Slice D1).
 *
 * Deliberately append-only: there is no `update`/`delete`/`softDelete`
 * method. A correction is always a new `ApprovalDecision` (with `supersedes`
 * pointing at the record it replaces) appended via `append` — never a
 * mutation of an existing record. Concrete implementations (e.g. a
 * durable/DB-backed adapter, added in a later, separately-authorized slice)
 * must enforce this by construction, not by convention.
 *
 * `findByExecutionId` and `findByScope` are both tenant-scoped: an
 * implementation must never return a record outside the caller's
 * `ExecutionScope` (organization/client/project).
 *
 * This port only records/derives approval decision state. Implementations
 * must never call an executor, dry-run executor, real executor, external
 * adapter, queue/worker/scheduler, or API mutation handler.
 */
export interface ApprovalDecisionRepository {
  /**
   * Append a new decision record. Implementations must reject (throw/reject)
   * an attempt to append a decision whose `id` already exists — this is the
   * append-only guarantee, not a caller-side convention.
   */
  append(decision: ApprovalDecision): Promise<ApprovalDecision>;

  /**
   * List all decisions recorded for one execution request, scoped to the
   * caller's tenant, in append order (oldest first). The last entry is the
   * current, authoritative decision — see `deriveApprovalStatus`.
   */
  findByExecutionId(
    scope: ExecutionScope,
    executionId: ExecutionId,
  ): Promise<readonly ApprovalDecision[]>;

  /** List all decisions for a tenant scope, in append order. */
  findByScope(scope: ExecutionScope): Promise<readonly ApprovalDecision[]>;
}
