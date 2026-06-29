import { DomainEvent } from '@age/shared';
import type { ClientId } from '@age/shared';

export class ClientOffboarding extends DomainEvent {
  readonly eventName = 'ClientOffboarding';
  constructor(readonly clientId: ClientId) {
    super();
  }
}
