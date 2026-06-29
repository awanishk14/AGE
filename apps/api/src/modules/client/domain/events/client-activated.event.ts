import { DomainEvent } from '@age/shared';
import type { ClientId } from '@age/shared';

export class ClientActivated extends DomainEvent {
  readonly eventName = 'ClientActivated';
  constructor(readonly clientId: ClientId) {
    super();
  }
}
