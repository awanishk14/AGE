import type { UniqueId } from '@age/shared';

/** The kinds of change an AuditLog can record. */
export enum AuditAction {
  Create = 'CREATE',
  Update = 'UPDATE',
  Delete = 'DELETE',
  Restore = 'RESTORE',
}

/**
 * AuditLog — append-only record of a change to a persisted entity.
 * Architecture only; no implementation.
 */
export interface AuditLog {
  readonly entity: string;
  readonly entityId: UniqueId;
  readonly action: AuditAction;
  readonly before: Readonly<Record<string, unknown>> | null;
  readonly after: Readonly<Record<string, unknown>> | null;
  readonly timestamp: Date;
  readonly actor: UniqueId;
  readonly reason?: string;
}
