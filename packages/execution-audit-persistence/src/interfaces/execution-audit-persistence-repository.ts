import type { ExecutionId, ExecutionScope } from '@age/execution-contracts';
import type { ExecutionAuditPersistedRecord } from '../types/execution-audit-persisted-record';

/**
 * ExecutionAuditPersistenceRepository — the durable persistence port for
 * dry-run Execution Foundation audit records (ADR-0022 Slice A).
 *
 * Deliberately append-only: there is no `update`/`delete`/`softDelete`
 * method. History of a decision is never mutated — a correction is a new,
 * separately-executed request producing its own record, per ADR-0022's
 * "no silent mutation of audit history" principle. Concrete implementations
 * (e.g. a Prisma-backed adapter, added in a later slice) must enforce this by
 * construction, not by convention.
 *
 * `findByScope` and `findByExecutionId` are both tenant-scoped: an
 * implementation must never return a record outside the caller's
 * `ExecutionScope` (organization/client/project), matching the tenant
 * isolation already required of `ExecutionTarget`/`ExecutionScope` in
 * `@age/execution-contracts`.
 */
export interface ExecutionAuditPersistenceRepository {
  /**
   * Append a new record. Implementations must reject (throw/reject) an
   * attempt to append a record whose `executionId` already exists — this is
   * the append-only guarantee, not a caller-side convention.
   */
  append(record: ExecutionAuditPersistedRecord): Promise<ExecutionAuditPersistedRecord>;

  /** Look up one record by execution id, scoped to the caller's tenant. */
  findByExecutionId(
    scope: ExecutionScope,
    executionId: ExecutionId,
  ): Promise<ExecutionAuditPersistedRecord | null>;

  /** List all records for a tenant scope, in append order. */
  findByScope(scope: ExecutionScope): Promise<readonly ExecutionAuditPersistedRecord[]>;
}
