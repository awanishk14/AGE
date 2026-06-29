import { DomainEvent } from '@age/shared';
import type { ClientId } from '@age/shared';

export class ClientPaused extends DomainEvent {
  readonly eventName = 'ClientPaused';
  constructor(readonly clientId: ClientId) {
    super();
  }
}
