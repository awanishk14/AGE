import type { UniqueId } from './unique-id';

/**
 * Entity — base class for domain entities with identity.
 *
 * Base abstraction only. No domain behaviour is implemented here.
 */
export abstract class Entity<TId extends UniqueId = UniqueId> {
  protected constructor(public readonly id: TId) {}

  equals(other?: Entity<TId>): boolean {
    return other !== undefined && this.id.equals(other.id);
  }
}
