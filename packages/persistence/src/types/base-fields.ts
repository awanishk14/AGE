import type { OrganizationId, UniqueId } from '@age/shared';

/**
 * PersistedBase — the standard fields every persisted AGE record carries.
 *
 * Architecture only; no implementation. Supports multi-tenancy (organizationId),
 * soft delete (deletedAt), optimistic versioning (version) and auditing
 * (createdBy / updatedBy).
 */
export interface PersistedBase {
  readonly id: UniqueId;
  readonly organizationId: OrganizationId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: UniqueId;
  readonly updatedBy: UniqueId;
  readonly deletedAt: Date | null;
  readonly version: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}
