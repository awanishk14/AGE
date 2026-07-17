import type { ExecutionId, ExecutionScope } from '@age/execution-contracts';
import type { ApprovalDecisionId } from './approval-decision-id';
import type { ApprovalOutcome } from './approval-status';

/**
 * ApprovalDecision — one explicit, operator-attributed, tenant-scoped record
 * of a human approval decision on an execution request (ADR-0023 Slice D1).
 *
 * Explicit by construction: `operatorId`, `scope`, `outcome`, and `decidedAt`
 * are all mandatory — there is no default, implicit, anonymous, or
 * system-generated decision shape. `decidedAt` is caller-supplied (input-
 * derived), never wall-clock, mirroring the determinism guarantee already
 * established in `@age/execution-contracts` and `@age/execution-audit-persistence`.
 *
 * Append-only: a correction is a new `ApprovalDecision` whose `supersedes`
 * points at the `ApprovalDecisionId` it replaces. The original record is
 * never mutated or deleted (see `ApprovalDecisionRepository`).
 *
 * This record only ever authorizes a dry-run/no-op execution
 * (`ApprovalOutcome`'s closed set has no execution-authorizing member) and
 * never itself performs, calls, or triggers execution of any kind.
 */
export interface ApprovalDecision {
  readonly id: ApprovalDecisionId;
  readonly executionId: ExecutionId;
  readonly scope: ExecutionScope;
  readonly outcome: ApprovalOutcome;
  readonly operatorId: string;
  readonly decidedAt: Date;
  readonly reason?: string;
  readonly supersedes?: ApprovalDecisionId;
}
