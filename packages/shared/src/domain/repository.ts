import type { AggregateRoot } from './aggregate-root';
import type { UniqueId } from './unique-id';

/**
 * Repository — base persistence port for an aggregate root.
 *
 * Base abstraction only. Concrete repositories are defined per domain and
 * implemented in infrastructure layers later.
 */
export interface Repository<TAggregate extends AggregateRoot> {
  findById(id: UniqueId): Promise<TAggregate | null>;
  save(aggregate: TAggregate): Promise<void>;
}
