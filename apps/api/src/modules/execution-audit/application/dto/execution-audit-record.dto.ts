/**
 * ExecutionAuditRecordDto — read-only API projection of an
 * `ExecutionAuditPersistedRecord` (ADR-0022 Slice B).
 *
 * Named `dryRunResultSnapshot` (not `executionResult`) so the shape can never
 * be mistaken for a real command execution result — this is a dry-run audit
 * history entry only. `mode` and `sideEffectsPerformed` are pinned to the
 * dry-run/no-op literals at the type level.
 */
export interface ExecutionAuditRecordDto {
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

/** GET /execution-audit — read-only list response, scoped to one tenant. */
export interface ExecutionAuditListResponseDto {
  readonly scope: {
    readonly organizationId: string;
    readonly clientId: string;
  };
  readonly records: readonly ExecutionAuditRecordDto[];
}
