import type { UniqueId } from '@age/shared';
import type { PersistedBase } from '../types/base-fields';

/**
 * PersistenceRepository — base persistence port. Tenant-aware and soft-delete
 * aware. Interface only; no SQL, no implementation.
 */
export interface PersistenceRepository<TEntity, TId extends UniqueId = UniqueId> {
  findById(id: TId): Promise<(TEntity & PersistedBase) | null>;
  findAll(): Promise<ReadonlyArray<TEntity & PersistedBase>>;
  save(entity: TEntity & PersistedBase): Promise<void>;
  softDelete(id: TId): Promise<void>;
}
