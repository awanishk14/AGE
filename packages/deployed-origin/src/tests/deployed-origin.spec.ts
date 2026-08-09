import { describe, expect, it } from 'vitest';

import {
  acceptForwardedTransport,
  assertOriginNotPubliclyReachable,
  DeployedOriginRefusedError,
  ORIGIN_BIND_HOSTS,
  publicOriginUrlOf,
} from '../deployed-origin';

describe('the one door the world may knock on', () => {
  it('accepts an https origin and returns scheme and authority only', () => {
    expect(publicOriginUrlOf('https://age.example.com')).toBe('https://age.example.com');
  });

  it('keeps an explicit port', () => {
    expect(publicOriginUrlOf('https://age.example.com:8443')).toBe('https://age.example.com:8443');
  });

  it.each([
    ['plain http', 'http://age.example.com'],
    ['a websocket', 'ws://age.example.com'],
    ['a file', 'file:///etc/passwd'],
  ])('refuses %s', (_case, candidate) => {
    // 🚫 There is no "it redirects anyway" arm: the first request already
    // crossed the network in the clear.
    expect(() => publicOriginUrlOf(candidate)).toThrow(DeployedOriginRefusedError);
  });

  it.each([
    ['blank', '   '],
    ['not a URL', 'age.example.com'],
    ['a credential in the authority', 'https://user:pass@age.example.com'],
    ['a path', 'https://age.example.com/studio'],
    ['a query', 'https://age.example.com/?token=abc'],
    ['a fragment', 'https://age.example.com/#x'],
  ])('refuses %s', (_case, candidate) => {
    expect(() => publicOriginUrlOf(candidate)).toThrow(DeployedOriginRefusedError);
  });

  it('names a position and never the candidate', () => {
    // ⚠️ A URL can carry a token in its query and a credential in its authority.
    try {
      publicOriginUrlOf('https://user:hunter2@age.example.com/?token=super-secret');
      expect.unreachable('that origin must be refused');
    } catch (error) {
      const refusal = error as DeployedOriginRefusedError;

      expect(refusal.subject).toBe('publicOrigin.credentials');
      expect(refusal.message).not.toContain('hunter2');
      expect(refusal.message).not.toContain('super-secret');
      expect(refusal.message).not.toContain('age.example.com');
    }
  });
});

describe('the app itself is never publicly reachable', () => {
  it.each([...ORIGIN_BIND_HOSTS])('accepts %s', (host) => {
    expect(assertOriginNotPubliclyReachable(host)).toBe(host);
  });

  it.each([
    ['every interface', '0.0.0.0'],
    ['every interface, v6', '::'],
    ['a public address of this machine', '203.0.113.7'],
    ['a private address', '10.0.0.4'],
    ['a name the resolver decides', 'localhost'],
    ['a name', 'age.example.com'],
    ['blank', '  '],
  ])('refuses %s', (_case, host) => {
    // ⚠️ An allow-list. 🚫 A deny-list of 0.0.0.0 and :: leaves every specific
    // public address of the machine.
    expect(() => assertOriginNotPubliclyReachable(host)).toThrow(DeployedOriginRefusedError);
  });
});

describe('the forwarded header is believed only because the socket is loopback', () => {
  it('accepts https forwarded to a loopback-bound origin', () => {
    expect(acceptForwardedTransport({ bindHost: '127.0.0.1', forwardedProto: 'https' })).toBe(
      'https',
    );
  });

  it('is case- and whitespace-insensitive about the value', () => {
    expect(acceptForwardedTransport({ bindHost: '::1', forwardedProto: ' HTTPS ' })).toBe('https');
  });

  it('refuses https on a publicly-bound origin', () => {
    // 🛑 The header is a string any client can send. It is worth something only
    // because the request could only have come from the terminator on this host.
    expect(() =>
      acceptForwardedTransport({ bindHost: '0.0.0.0', forwardedProto: 'https' }),
    ).toThrow(DeployedOriginRefusedError);
  });

  it('refuses an absent header', () => {
    // ⚠️ Absent is not https — an unterminated request looks exactly like this.
    expect(() => acceptForwardedTransport({ bindHost: '127.0.0.1', forwardedProto: null })).toThrow(
      DeployedOriginRefusedError,
    );
  });

  it.each([
    ['plain http', 'http'],
    ['a client-prepended chain', 'https, http'],
    ['a chain ending https', 'http, https'],
    ['blank', ''],
    ['something else', 'gopher'],
  ])('refuses %s', (_case, forwardedProto) => {
    expect(() => acceptForwardedTransport({ bindHost: '127.0.0.1', forwardedProto })).toThrow(
      DeployedOriginRefusedError,
    );
  });

  it('names the position, never the header value', () => {
    try {
      acceptForwardedTransport({ bindHost: '127.0.0.1', forwardedProto: 'http' });
      expect.unreachable('a plaintext request must be refused');
    } catch (error) {
      const refusal = error as DeployedOriginRefusedError;

      expect(refusal.subject).toBe('forwardedProto');
    }
  });
});
