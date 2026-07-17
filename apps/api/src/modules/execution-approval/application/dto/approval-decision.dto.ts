/**
 * ExecutionApprovalDecisionDto — API projection of an `ApprovalDecision`
 * (ADR-0023 Slice D2).
 *
 * `outcome` is pinned to the dry-run-only literal union at the type level —
 * this shape can never carry an execution-authorizing value.
 */
export interface ExecutionApprovalDecisionDto {
  readonly id: string;
  readonly executionId: string;
  readonly scope: {
    readonly organizationId: string;
    readonly clientId: string;
    readonly projectId?: string;
  };
  readonly outcome: 'approved_for_dry_run' | 'rejected';
  readonly operatorId: string;
  readonly decidedAt: string;
  readonly reason?: string;
  readonly supersedes?: string;
}

/** Request body for POST /execution-approval/:executionId/approve and /reject. */
export interface RecordApprovalDecisionRequestDto {
  readonly organizationId: string;
  readonly clientId: string;
  readonly projectId?: string;
  readonly operatorId: string;
  readonly reason?: string;
}

/** GET /execution-approval/:executionId response — current status + full decision history. */
export interface ExecutionApprovalStatusResponseDto {
  readonly executionId: string;
  readonly scope: {
    readonly organizationId: string;
    readonly clientId: string;
  };
  readonly status: 'pending_review' | 'approved_for_dry_run' | 'rejected' | 'superseded';
  readonly history: readonly ExecutionApprovalDecisionDto[];
}

/** GET /execution-approval — list response, scoped to one tenant. */
export interface ExecutionApprovalListResponseDto {
  readonly scope: {
    readonly organizationId: string;
    readonly clientId: string;
  };
  readonly decisions: readonly ExecutionApprovalDecisionDto[];
}
