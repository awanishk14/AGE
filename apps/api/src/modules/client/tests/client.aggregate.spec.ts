import { describe, expect, it } from 'vitest';
import { ClientAggregate } from '../domain/aggregates/client.aggregate';
import { ClientLifecycleState } from '../domain/types/client.types';

describe('ClientAggregate', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockClientId = { value: 'client-123', equals: () => false } as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockOrgId = { value: 'org-456', equals: () => false } as any;

  it('create() produces a Client in Created state', () => {
    const client = ClientAggregate.create({
      id: mockClientId,
      organizationId: mockOrgId,
      name: 'Acme Corp',
      slug: 'acme-corp',
    });
    expect(client.lifecycle).toBe(ClientLifecycleState.Created);
  });

  it('create() raises a ClientCreated domain event', () => {
    const client = ClientAggregate.create({
      id: mockClientId,
      organizationId: mockOrgId,
      name: 'Acme Corp',
      slug: 'acme-corp',
    });
    expect(client.domainEvents).toHaveLength(1);
    expect(client.domainEvents[0]!.eventName).toBe('ClientCreated');
  });

  it('activate() transitions Created → Active', () => {
    const client = ClientAggregate.create({
      id: mockClientId,
      organizationId: mockOrgId,
      name: 'Acme Corp',
      slug: 'acme-corp',
    });
    client.clearDomainEvents();
    client.activate();
    expect(client.lifecycle).toBe(ClientLifecycleState.Active);
    expect(client.domainEvents[0]!.eventName).toBe('ClientActivated');
  });

  it('activate() from Active throws a DomainError', () => {
    const client = ClientAggregate.create({
      id: mockClientId,
      organizationId: mockOrgId,
      name: 'Acme Corp',
      slug: 'acme-corp',
    });
    client.activate();
    expect(() => client.activate()).toThrow();
  });

  it('pause() transitions Active → Paused', () => {
    const client = ClientAggregate.create({
      id: mockClientId,
      organizationId: mockOrgId,
      name: 'Acme Corp',
      slug: 'acme-corp',
    });
    client.activate();
    client.clearDomainEvents();
    client.pause();
    expect(client.lifecycle).toBe(ClientLifecycleState.Paused);
    expect(client.domainEvents[0]!.eventName).toBe('ClientPaused');
  });

  it('archive() from Offboarding transitions to Archived', () => {
    const client = ClientAggregate.create({
      id: mockClientId,
      organizationId: mockOrgId,
      name: 'Acme Corp',
      slug: 'acme-corp',
    });
    client.activate();
    client.beginOffboarding();
    client.clearDomainEvents();
    client.archive();
    expect(client.lifecycle).toBe(ClientLifecycleState.Archived);
    expect(client.domainEvents[0]!.eventName).toBe('ClientArchived');
  });

  it('archive() from Active throws a DomainError (must go through Offboarding)', () => {
    const client = ClientAggregate.create({
      id: mockClientId,
      organizationId: mockOrgId,
      name: 'Acme Corp',
      slug: 'acme-corp',
    });
    client.activate();
    expect(() => client.archive()).toThrow();
  });
});
