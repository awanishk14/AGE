import { describe, expect, it } from 'vitest';
import { Capability, ExecutionDomain } from '../enums';
import { CapabilityOutput } from '../outputs/capability-output';
import type { CapabilityOutputItem } from '../outputs/capability-output-item';
import { CapabilityError } from '../errors/capability.error';
import { ClientContext } from '../context/client-context';

interface TestItem extends CapabilityOutputItem {
  title: string;
}

describe('CapabilityOutput', () => {
  it('holds items with the correct shape', () => {
    const item: TestItem = {
      id: 'item-1',
      capability: Capability.Intelligence,
      createdAt: new Date(),
      title: 'Test opportunity',
    };
    const output = new CapabilityOutput<TestItem>({
      clientId: 'client-1',
      organizationId: 'org-1',
      capability: Capability.Intelligence,
      executionDomains: [ExecutionDomain.SEO],
      items: [item],
    });
    expect(output.items).toHaveLength(1);
    expect(output.items[0]!.title).toBe('Test opportunity');
    expect(output.capability).toBe(Capability.Intelligence);
  });
});

describe('CapabilityError', () => {
  it('carries the capability that produced the error', () => {
    const err = new CapabilityError('Something failed', Capability.Intelligence);
    expect(err.capability).toBe(Capability.Intelligence);
    expect(err.message).toBe('Something failed');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('ClientContext', () => {
  it('exposes clientId and organizationId', () => {
    const ctx = new ClientContext('client-1', 'org-1');
    expect(ctx.clientId).toBe('client-1');
    expect(ctx.organizationId).toBe('org-1');
  });
});
