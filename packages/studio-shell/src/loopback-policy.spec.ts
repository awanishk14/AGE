import { describe, expect, it } from 'vitest';

import {
  assertLoopbackBindHost,
  DEFAULT_STUDIO_BIND_HOST,
  loopbackHosts,
  StudioBindRefusedError,
} from './loopback-policy';

describe('assertLoopbackBindHost', () => {
  it('accepts the two loopback addresses and returns them unchanged', () => {
    expect(assertLoopbackBindHost('127.0.0.1')).toBe('127.0.0.1');
    expect(assertLoopbackBindHost('::1')).toBe('::1');
  });

  it('accepts the default bind host', () => {
    expect(assertLoopbackBindHost(DEFAULT_STUDIO_BIND_HOST)).toBe('127.0.0.1');
  });

  it('trims surrounding whitespace before deciding', () => {
    expect(assertLoopbackBindHost('  127.0.0.1  ')).toBe('127.0.0.1');
  });

  /**
   * ⚠️ The case OX-INV-1 exists for. `0.0.0.0` is what a developer types to
   * "just make it reachable from my phone", and it is the exact configuration
   * that turns a single-operator surface into a network service.
   */
  it('refuses 0.0.0.0 and names it in the refusal', () => {
    expect(() => assertLoopbackBindHost('0.0.0.0')).toThrow(StudioBindRefusedError);
    expect(() => assertLoopbackBindHost('0.0.0.0')).toThrow(/"0\.0\.0\.0"/);
  });

  it('refuses the IPv6 unspecified address', () => {
    expect(() => assertLoopbackBindHost('::')).toThrow(StudioBindRefusedError);
  });

  it('refuses a LAN address', () => {
    expect(() => assertLoopbackBindHost('192.168.1.20')).toThrow(StudioBindRefusedError);
  });

  /**
   * 🚫 `localhost` is a NAME. What it resolves to is decided by the host's
   * resolver and `/etc/hosts`, which this function cannot see. Accepting it
   * would mean reporting a fact about an address that was never inspected.
   * ⚠️ This test is not pedantry — it is the whole reason the list is exact.
   */
  it('refuses localhost, because a name is not an address', () => {
    expect(() => assertLoopbackBindHost('localhost')).toThrow(StudioBindRefusedError);
  });

  /**
   * ⚠️ 127.0.0.0/8 is loopback on Linux but is deliberately not accepted:
   * a range match invites a later widening of the pattern itself.
   */
  it('refuses other addresses in the 127 range', () => {
    expect(() => assertLoopbackBindHost('127.0.0.2')).toThrow(StudioBindRefusedError);
  });

  it('refuses an empty or blank host rather than defaulting', () => {
    expect(() => assertLoopbackBindHost('')).toThrow(StudioBindRefusedError);
    expect(() => assertLoopbackBindHost('   ')).toThrow(StudioBindRefusedError);
  });

  /**
   * 🚫 A refusal must not become a silent substitution. If this function ever
   * returns a safe host for an unsafe input, the operator believes their
   * configuration took effect when it did not.
   */
  it('never returns a loopback host for a non-loopback input', () => {
    for (const host of ['0.0.0.0', '::', 'localhost', '10.0.0.5', 'age.example.com']) {
      let returned: string | undefined;
      try {
        returned = assertLoopbackBindHost(host);
      } catch {
        returned = undefined;
      }
      expect(returned).toBeUndefined();
    }
  });

  /**
   * The refusal states the bound of its own claim. 🚫 Never describe this guard
   * as proving the console is unreachable — a proxy, tunnel or published
   * container port defeats it entirely.
   */
  it('states that loopback is necessary but not sufficient', () => {
    let message = '';
    try {
      assertLoopbackBindHost('0.0.0.0');
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/necessary, not sufficient/);
    expect(message).toMatch(/proxy, tunnel or published/);
    expect(message).toMatch(/no override/i);
  });

  /**
   * 🚫 The refusal carries the offending host and nothing else — no environment
   * dump, no resolved paths, no other configuration. Same rule as the operator
   * file refusals: a message names a position, never contents.
   */
  it('leaks nothing beyond the offending host', () => {
    let message = '';
    try {
      assertLoopbackBindHost('0.0.0.0');
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toMatch(/[A-Za-z]:\\|\/home\/|\/Users\//);
    expect(message).not.toMatch(/process\.env|DATABASE_URL/);
  });
});

describe('loopbackHosts', () => {
  it('reports exactly the hosts the guard accepts', () => {
    const hosts = loopbackHosts();
    expect([...hosts]).toEqual(['127.0.0.1', '::1']);
    for (const host of hosts) {
      expect(assertLoopbackBindHost(host)).toBe(host);
    }
  });

  it('does not include a name or a wildcard', () => {
    expect(loopbackHosts()).not.toContain('localhost');
    expect(loopbackHosts()).not.toContain('0.0.0.0');
  });
});
