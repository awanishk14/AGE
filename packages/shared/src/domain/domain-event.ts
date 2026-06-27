/**
 * DomainEvent — base class for events raised by aggregates.
 *
 * Base abstraction only. Concrete events live in `domain/events`.
 */
export abstract class DomainEvent {
  abstract readonly eventName: string;
  readonly occurredAt: Date;

  protected constructor() {
    this.occurredAt = new Date();
  }
}
