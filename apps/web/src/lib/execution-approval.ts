/**
 * Client helpers for the Human Approval Workflow UI (ADR-0023 Slice D3).
 *
 * Talks only to the API's approval routes added in Slice D2:
 * `POST /execution-approval/:executionId/approve`,
 * `POST /execution-approval/:executionId/reject`, and
 * `GET /execution-approval/:executionId`. Approve/reject only record an
 * append-only dry-run approval decision — neither call executes anything,
 * and no execute/run route exists anywhere in this module.
 *
 * Scope: this codebase has no finalized auth/tenant mechanism yet. Requests
 * use the same explicit `organizationId`/`clientId`(/`operatorId`) fields the
 * API requires — a test-safe/demo strategy, not a production auth boundary.
 */
import { getApiBaseUrl } from './demo';

export { getApiBaseUrl };

/** One approval decision, as returned by the API. */
export interface ExecutionApprovalDecision {
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

/** Response for `GET /execution-approval/:executionId` — derived status + full history. */
export interface ExecutionApprovalStatusResponse {
  readonly executionId: string;
  readonly scope: {
    readonly organizationId: string;
    readonly clientId: string;
  };
  readonly status: 'pending_review' | 'approved_for_dry_run' | 'rejected' | 'superseded';
  readonly history: readonly ExecutionApprovalDecision[];
}

/** Explicit, required fields for recording an approve/reject decision. No inferred identity. */
export interface RecordApprovalDecisionInput {
  readonly organizationId: string;
  readonly clientId: string;
  readonly projectId?: string;
  readonly operatorId: string;
  readonly reason?: string;
}

/**
 * Fetch the current derived approval status and decision history for a
 * scoped execution id. GET-only — never mutates, never submits a body.
 */
export async function fetchExecutionApprovalStatus(
  executionId: string,
  organizationId: string,
  clientId: string,
  signal?: AbortSignal,
): Promise<ExecutionApprovalStatusResponse> {
  const url = new URL(`${getApiBaseUrl()}/execution-approval/${encodeURIComponent(executionId)}`);
  url.searchParams.set('organizationId', organizationId);
  url.searchParams.set('clientId', clientId);

  const response = await fetch(url, {
    method: 'GET',
    signal,
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`API responded with ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as ExecutionApprovalStatusResponse;
}

/**
 * Record an `approved_for_dry_run` decision. Calls only
 * `POST /execution-approval/:executionId/approve` — this never triggers
 * execution of any kind, it only appends an approval decision record.
 */
export async function submitApprovalDecision(
  executionId: string,
  input: RecordApprovalDecisionInput,
  signal?: AbortSignal,
): Promise<ExecutionApprovalDecision> {
  return postDecision('approve', executionId, input, signal);
}

/**
 * Record a `rejected` decision. Calls only
 * `POST /execution-approval/:executionId/reject` — this never triggers
 * execution of any kind, it only appends an approval decision record.
 */
export async function submitRejectionDecision(
  executionId: string,
  input: RecordApprovalDecisionInput,
  signal?: AbortSignal,
): Promise<ExecutionApprovalDecision> {
  return postDecision('reject', executionId, input, signal);
}

async function postDecision(
  action: 'approve' | 'reject',
  executionId: string,
  input: RecordApprovalDecisionInput,
  signal?: AbortSignal,
): Promise<ExecutionApprovalDecision> {
  const url = `${getApiBaseUrl()}/execution-approval/${encodeURIComponent(executionId)}/${action}`;
  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`API responded with ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as ExecutionApprovalDecision;
}

/** Demo-safe default scope, consistent with docs/DEMO_RUN_GUIDE.md examples. */
export const DEFAULT_APPROVAL_SCOPE = { organizationId: 'org-1', clientId: 'client-1' } as const;
