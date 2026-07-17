/**
 * ApprovalDecisionId — a stable, opaque identity for one approval decision
 * record (ADR-0023 Slice D1).
 *
 * Branded so a raw string cannot be passed where an ApprovalDecisionId is
 * expected. Distinct from `ExecutionId`: one `ExecutionId` may accumulate
 * many approval decisions over time (a rejection, then a superseding
 * approval), each with its own `ApprovalDecisionId`.
 */
export type ApprovalDecisionId = string & { readonly __brand: 'ApprovalDecisionId' };

/** Wrap a non-empty string as an ApprovalDecisionId. */
export function approvalDecisionId(value: string): ApprovalDecisionId {
  if (value.trim().length === 0) {
    throw new Error('ApprovalDecisionId must be a non-empty string');
  }
  return value as ApprovalDecisionId;
}
