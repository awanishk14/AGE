import { DomainEvent } from '@age/shared';
import type { ClientId } from '@age/shared';

export class ClientArchived extends DomainEvent {
  readonly eventName = 'ClientArchived';
  constructor(readonly clientId: ClientId) {
    super();
  }
}
