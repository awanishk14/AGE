import { AggregateRoot, DomainError } from '@age/shared';
import type { ClientId, OrganizationId } from '@age/shared';
import {
  ClientActivated,
  ClientArchived,
  ClientCreated,
  ClientOffboarding,
  ClientPaused,
} from '../events';
import { ClientLifecycleState } from '../types/client.types';
import type { CreateClientProps } from '../types/client.types';

export class InvalidTransitionError extends DomainError {
  readonly code = 'CLIENT_INVALID_TRANSITION';
  constructor(message: string) {
    super(message);
  }
}

export class ClientAggregate extends AggregateRoot<ClientId> {
  private readonly _organizationId: OrganizationId;
  private _lifecycle: ClientLifecycleState;
  private readonly _name: string;
  private readonly _slug: string;

  private constructor(
    id: ClientId,
    organizationId: OrganizationId,
    lifecycle: ClientLifecycleState,
    name: string,
    slug: string,
  ) {
    super(id);
    this._organizationId = organizationId;
    this._lifecycle = lifecycle;
    this._name = name;
    this._slug = slug;
  }

  get organizationId(): OrganizationId {
    return this._organizationId;
  }

  get lifecycle(): ClientLifecycleState {
    return this._lifecycle;
  }

  get name(): string {
    return this._name;
  }

  get slug(): string {
    return this._slug;
  }

  static create(props: CreateClientProps): ClientAggregate {
    const client = new ClientAggregate(
      props.id,
      props.organizationId,
      ClientLifecycleState.Created,
      props.name,
      props.slug,
    );
    client.addDomainEvent(new ClientCreated(props.id));
    return client;
  }

  activate(): void {
    if (
      this._lifecycle !== ClientLifecycleState.Created &&
      this._lifecycle !== ClientLifecycleState.Onboarding &&
      this._lifecycle !== ClientLifecycleState.Paused
    ) {
      throw new InvalidTransitionError(`Cannot activate a Client in state ${this._lifecycle}`);
    }
    this._lifecycle = ClientLifecycleState.Active;
    this.addDomainEvent(new ClientActivated(this.id));
  }

  pause(): void {
    if (this._lifecycle !== ClientLifecycleState.Active) {
      throw new InvalidTransitionError(`Cannot pause a Client in state ${this._lifecycle}`);
    }
    this._lifecycle = ClientLifecycleState.Paused;
    this.addDomainEvent(new ClientPaused(this.id));
  }

  beginOffboarding(): void {
    if (
      this._lifecycle !== ClientLifecycleState.Active &&
      this._lifecycle !== ClientLifecycleState.Paused
    ) {
      throw new InvalidTransitionError(
        `Cannot begin offboarding a Client in state ${this._lifecycle}`,
      );
    }
    this._lifecycle = ClientLifecycleState.Offboarding;
    this.addDomainEvent(new ClientOffboarding(this.id));
  }

  archive(): void {
    if (this._lifecycle !== ClientLifecycleState.Offboarding) {
      throw new InvalidTransitionError(
        `Cannot archive a Client in state ${this._lifecycle}. Client must be in Offboarding state first.`,
      );
    }
    this._lifecycle = ClientLifecycleState.Archived;
    this.addDomainEvent(new ClientArchived(this.id));
  }
}
