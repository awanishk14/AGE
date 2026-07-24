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

  it('uses a caller-supplied producedAt exactly', () => {
    const producedAt = new Date('2026-07-15T09:30:00.000Z');
    const output = new CapabilityOutput<TestItem>({
      clientId: 'client-1',
      organizationId: 'org-1',
      capability: Capability.Intelligence,
      executionDomains: [ExecutionDomain.SEO],
      items: [],
      producedAt,
    });
    // Exact same instant; not overwritten by the wall clock.
    expect(output.producedAt).toBe(producedAt);
    expect(output.producedAt.toISOString()).toBe('2026-07-15T09:30:00.000Z');
  });

  it('produces a stable, deterministic envelope when producedAt is supplied', () => {
    const producedAt = new Date('2026-07-15T09:30:00.000Z');
    const build = () =>
      new CapabilityOutput<TestItem>({
        clientId: 'client-1',
        organizationId: 'org-1',
        capability: Capability.Intelligence,
        executionDomains: [ExecutionDomain.SEO],
        items: [],
        producedAt,
      });
    // Two constructions with the same inputs serialize identically — the
    // property determinism depends on is the timestamp no longer being read
    // from the wall clock.
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
  });

  it('falls back to the wall clock when producedAt is omitted (backward compatible)', () => {
    const before = Date.now();
    const output = new CapabilityOutput<TestItem>({
      clientId: 'client-1',
      organizationId: 'org-1',
      capability: Capability.Intelligence,
      executionDomains: [ExecutionDomain.SEO],
      items: [],
    });
    const after = Date.now();
    // Existing constructor usage (no producedAt) still works and stamps "now".
    expect(output.producedAt).toBeInstanceOf(Date);
    expect(output.producedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(output.producedAt.getTime()).toBeLessThanOrEqual(after);
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
