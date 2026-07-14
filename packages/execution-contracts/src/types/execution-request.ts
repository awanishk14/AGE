import type { ExecutionId } from './execution-id';
import type { ExecutionIntent } from './execution-intent';
import type { ExecutionTarget } from './execution-target';

/**
 * ApprovalContext — explicit human approval (Doc 12 §5). Approval is an input,
 * never inferred. When approved, the approver and approval time are mandatory,
 * so an "approved" request cannot exist without a human on record.
 */
export type ApprovalContext =
  | { readonly approved: true; readonly approvedBy: string; readonly approvedAt: Date }
  | { readonly approved: false };

/**
 * ExecutionRequest — an ExecutionIntent + ExecutionTarget + explicit approval
 * context; the unit submitted to the guard (ADR-0021 §2).
 */
export interface ExecutionRequest {
  readonly id: ExecutionId;
  readonly intent: ExecutionIntent;
  readonly target: ExecutionTarget;
  readonly approval: ApprovalContext;
}
