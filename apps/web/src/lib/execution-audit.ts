/**
 * Client helpers for the read-only dry-run execution audit history view
 * (ADR-0022 Slice C).
 *
 * Talks only to the API's read-only `GET /execution-audit` and
 * `GET /execution-audit/:executionId` routes (ADR-0022 Slice B). No writes,
 * no approval/execution behaviour — this only reads audit data for display.
 *
 * Scope: this codebase has no finalized auth/tenant mechanism yet. Reads use
 * the same explicit `organizationId`/`clientId` query-parameter scoping the
 * API requires — a test-safe/demo strategy, not a production auth boundary.
 */
import { getApiBaseUrl } from './demo';

export { getApiBaseUrl };

/** One dry-run execution audit record, as returned by the read-only API. */
export interface ExecutionAuditRecord {
  readonly executionId: string;
  readonly scope: {
    readonly organizationId: string;
    readonly clientId: string;
    readonly projectId?: string;
  };
  readonly status: string;
  readonly mode: 'dry_run';
  readonly sideEffectsPerformed: false;
  readonly traceability: string;
  readonly dryRunResultSnapshot: unknown;
  readonly createdAt: string;
  readonly decidedAt: string;
  readonly executedAt?: string;
}

/** Response envelope for `GET /execution-audit`. */
export interface ExecutionAuditListResponse {
  readonly scope: {
    readonly organizationId: string;
    readonly clientId: string;
  };
  readonly records: readonly ExecutionAuditRecord[];
}

/**
 * Fetch dry-run execution audit history for a scope. GET-only — never
 * mutates, never submits a body. Throws on network or non-2xx responses.
 */
export async function fetchExecutionAuditHistory(
  organizationId: string,
  clientId: string,
  signal?: AbortSignal,
): Promise<ExecutionAuditListResponse> {
  const url = new URL(`${getApiBaseUrl()}/execution-audit`);
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
  return (await response.json()) as ExecutionAuditListResponse;
}

/**
 * Fetch a single dry-run execution audit record by id, within scope.
 * GET-only. Throws on network or non-2xx responses (including 404).
 */
export async function fetchExecutionAuditRecord(
  executionId: string,
  organizationId: string,
  clientId: string,
  signal?: AbortSignal,
): Promise<ExecutionAuditRecord> {
  const url = new URL(`${getApiBaseUrl()}/execution-audit/${encodeURIComponent(executionId)}`);
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
  return (await response.json()) as ExecutionAuditRecord;
}

/** Demo-safe default scope, consistent with docs/DEMO_RUN_GUIDE.md examples. */
export const DEFAULT_AUDIT_SCOPE = { organizationId: 'org-1', clientId: 'client-1' } as const;

/** Compact one-line JSON for a dry-run result snapshot, safe for list rendering. */
export function formatResultSnapshot(snapshot: unknown): string {
  try {
    return JSON.stringify(snapshot);
  } catch {
    return String(snapshot);
  }
}
