/**
 * @age/execution-approval-workflow — Human Approval Workflow foundation
 * (ADR-0023 Slice D1).
 *
 * This package is the approval workflow model/persistence layer ADR-0023
 * places outside `@age/execution-contracts`: it consumes that package's
 * frozen types (`ExecutionId`, `ExecutionScope`) and defines how an explicit,
 * operator-attributed, tenant-scoped, append-only approval decision is
 * recorded and how the current `ApprovalStatus` is derived from that history.
 *
 * Hard invariants carried over from ADR-0021/ADR-0022/ADR-0023:
 * - Approval only ever authorizes a dry-run/no-op execution
 *   (`ApprovalOutcome` has no execution-authorizing member).
 * - No API route, Web UI, approval button, or execute endpoint is added here.
 * - No executor, adapter, queue/worker/scheduler, or external integration is
 *   called or imported here — this package only records/derives approval
 *   decision state.
 * - No DB/Prisma/ORM wiring is added here — only the model shape
 *   (`ApprovalDecision`), the repository port (`ApprovalDecisionRepository`),
 *   and an in-memory reference implementation used to prove the port's
 *   contract.
 */
export type {
  ApprovalDecisionId,
  ApprovalStatus,
  ApprovalOutcome,
  ApprovalDecision,
} from './types';
export { approvalDecisionId } from './types';
export {
  createApprovalDecision,
  deriveApprovalDecisionId,
  type CreateApprovalDecisionInput,
} from './factory';
export { deriveApprovalStatus, deriveDecisionStatus } from './status';
export type { ApprovalDecisionRepository } from './interfaces';
export { InMemoryApprovalDecisionRepository } from './repository';
