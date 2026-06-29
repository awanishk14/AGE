import { DomainEvent } from '@age/shared';
import type { ClientId } from '@age/shared';

export class ClientCreated extends DomainEvent {
  readonly eventName = 'ClientCreated';
  constructor(readonly clientId: ClientId) {
    super();
  }
}
