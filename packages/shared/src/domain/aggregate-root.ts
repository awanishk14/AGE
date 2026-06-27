import { Entity } from './entity';
import type { DomainEvent } from './domain-event';
import type { UniqueId } from './unique-id';

/**
 * AggregateRoot — base class for aggregate roots (consistency boundaries).
 *
 * Base abstraction only. Provides domain-event collection plumbing; no behaviour.
 */
export abstract class AggregateRoot<TId extends UniqueId = UniqueId> extends Entity<TId> {
  private readonly _domainEvents: DomainEvent[] = [];

  get domainEvents(): readonly DomainEvent[] {
    return this._domainEvents;
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  clearDomainEvents(): void {
    this._domainEvents.length = 0;
  }
}
