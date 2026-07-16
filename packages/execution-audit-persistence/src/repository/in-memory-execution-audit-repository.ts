import type { ExecutionId, ExecutionScope } from '@age/execution-contracts';
import type { ExecutionAuditPersistenceRepository } from '../interfaces/execution-audit-persistence-repository';
import type { ExecutionAuditPersistedRecord } from '../types/execution-audit-persisted-record';

function scopeKey(scope: ExecutionScope): string {
  return `${scope.organizationId}::${scope.clientId}`;
}

function assertScoped(scope: ExecutionScope): void {
  if (scope.organizationId.trim().length === 0 || scope.clientId.trim().length === 0) {
    throw new Error(
      'ExecutionAuditPersistedRecord requires a non-empty organizationId and clientId',
    );
  }
}

/**
 * InMemoryExecutionAuditRepository — a reference, in-memory implementation of
 * `ExecutionAuditPersistenceRepository` (ADR-0022 Slice A).
 *
 * This is NOT a production persistence adapter: it holds no connection, does
 * no I/O, and is process-local. It exists to (a) prove the port's
 * append-only/immutable/tenant-scoped contract is enforceable, and (b) act
 * as a drop-in fake for tests of any future caller (e.g. a Slice B read API)
 * without requiring a real database. A durable (e.g. Prisma-backed) adapter
 * is a later, separate slice.
 */
export class InMemoryExecutionAuditRepository implements ExecutionAuditPersistenceRepository {
  private readonly recordsById = new Map<ExecutionId, ExecutionAuditPersistedRecord>();
  private readonly idsByScope = new Map<string, ExecutionId[]>();

  async append(record: ExecutionAuditPersistedRecord): Promise<ExecutionAuditPersistedRecord> {
    assertScoped(record.scope);

    if (record.sideEffectsPerformed !== false) {
      throw new Error('Only dry-run records (sideEffectsPerformed: false) may be persisted');
    }
    if (this.recordsById.has(record.id)) {
      throw new Error(
        `ExecutionAuditPersistedRecord ${record.id} already exists — records are append-only and cannot be overwritten`,
      );
    }

    const frozen = Object.freeze({ ...record });
    this.recordsById.set(record.id, frozen);

    const key = scopeKey(record.scope);
    const existing = this.idsByScope.get(key) ?? [];
    this.idsByScope.set(key, [...existing, record.id]);

    return frozen;
  }

  async findByExecutionId(
    scope: ExecutionScope,
    executionId: ExecutionId,
  ): Promise<ExecutionAuditPersistedRecord | null> {
    assertScoped(scope);
    const record = this.recordsById.get(executionId);
    if (!record) return null;
    if (scopeKey(record.scope) !== scopeKey(scope)) return null;
    return record;
  }

  async findByScope(scope: ExecutionScope): Promise<readonly ExecutionAuditPersistedRecord[]> {
    assertScoped(scope);
    const ids = this.idsByScope.get(scopeKey(scope)) ?? [];
    return ids
      .map((id) => this.recordsById.get(id))
      .filter((r): r is ExecutionAuditPersistedRecord => r !== undefined);
  }
}
