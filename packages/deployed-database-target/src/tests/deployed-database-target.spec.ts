import { describe, expect, it } from 'vitest';

import {
  assertDeployedDatabaseTarget,
  DEPLOYED_DATABASE_COMPOSITION_NAME,
  deployedDatabaseTargetHost,
  DeployedDatabaseTargetRefusedError,
  REMOTE_ACKNOWLEDGEMENT,
  selectDeployedDatabaseComposition,
} from '../deployed-database-target';

const url = (host: string) => `postgres://age_app:s3cret-p4ssword@${host}:5432/age`;

describe('what A5 permits', () => {
  it.each([
    ['localhost', 'vps-loopback'],
    ['127.0.0.1', 'vps-loopback'],
    ['127.10.0.1', 'vps-loopback'],
    ['[::1]', 'vps-loopback'],
    ['10.0.0.7', 'private-interface'],
    ['172.16.0.1', 'private-interface'],
    ['172.31.255.254', 'private-interface'],
    ['192.168.1.20', 'private-interface'],
    ['[fd00::1]', 'private-interface'],
  ])('accepts %s as %s', (host, reachability) => {
    const composition = selectDeployedDatabaseComposition({
      url: url(host),
      acknowledgedRemote: REMOTE_ACKNOWLEDGEMENT,
    });

    expect(composition.reachability).toBe(reachability);
    expect(composition.compositionName).toBe(DEPLOYED_DATABASE_COMPOSITION_NAME);
    expect(composition.url).toBe(url(host));
  });

  it('accepts the postgresql: scheme as well as postgres:', () => {
    expect(() =>
      assertDeployedDatabaseTarget('postgresql://age_app@10.0.0.7:5432/age'),
    ).not.toThrow();
  });
});

describe('what A5 refuses', () => {
  it.each([
    // A publicly routable address is the whole point of the rule.
    '203.0.113.9',
    '8.8.8.8',
    '172.15.0.1',
    '172.32.0.1',
    '192.169.1.1',
    '11.0.0.1',
    // Link-local and carrier-grade NAT are not a deliberately configured
    // private interface, and one of them is the cloud metadata range.
    '169.254.169.254',
    '100.64.0.1',
    '[fe80::1]',
    // A name would have to be resolved to judge, and resolving is an effect.
    'db.internal',
    'db',
    'postgres.example.com',
    // A public-looking IPv6 address.
    '[2001:db8::1]',
  ])('refuses %s', (host) => {
    expect(() => assertDeployedDatabaseTarget(url(host))).toThrow(
      DeployedDatabaseTargetRefusedError,
    );
  });

  it.each([
    ['not a url at all', 'age.db'],
    ['a non-postgres scheme', 'mysql://root@127.0.0.1:3306/age'],
    ['an http url', 'https://127.0.0.1/age'],
    ['an empty host', 'postgres:///age?host=/var/run/postgresql'],
  ])('refuses %s rather than assuming it is fine', (_case, candidate) => {
    expect(() => assertDeployedDatabaseTarget(candidate)).toThrow(
      DeployedDatabaseTargetRefusedError,
    );
  });

  it('names an octet above 255 as unreadable rather than accepting it', () => {
    // `999.0.0.1` is not an address; it must not fall through to "some name".
    expect(() => assertDeployedDatabaseTarget(url('999.0.0.1'))).toThrow(
      DeployedDatabaseTargetRefusedError,
    );
  });
});

describe('a refusal never carries a credential', () => {
  it('names the host and nothing else', () => {
    try {
      assertDeployedDatabaseTarget(url('203.0.113.9'));
      expect.unreachable('the public host should have been refused');
    } catch (error) {
      expect(error).toBeInstanceOf(DeployedDatabaseTargetRefusedError);
      const refusal = error as DeployedDatabaseTargetRefusedError;
      expect(refusal.host).toBe('203.0.113.9');
      expect(refusal.message).toContain('203.0.113.9');
      expect(refusal.message).not.toContain('s3cret-p4ssword');
      expect(refusal.message).not.toContain('age_app');
    }
  });

  it('says so when the string could not be read, without quoting it', () => {
    try {
      assertDeployedDatabaseTarget('postgres://age_app:s3cret-p4ssword@');
      expect.unreachable('an unreadable target should have been refused');
    } catch (error) {
      const refusal = error as DeployedDatabaseTargetRefusedError;
      expect(refusal.host).toBe('(unreadable)');
      expect(refusal.message).not.toContain('s3cret-p4ssword');
    }
  });
});

describe('the deployed composition cannot be selected by configuration alone', () => {
  it('refuses when the acknowledgement is absent at runtime', () => {
    // The type stops a `string` read from an environment. This is the route a
    // compile-time-only rule does not cover: a cast, `any`, or plain JS.
    const selectUnchecked = selectDeployedDatabaseComposition as (options: {
      url: string;
      acknowledgedRemote: string;
    }) => unknown;

    expect(() => selectUnchecked({ url: url('10.0.0.7'), acknowledgedRemote: 'true' })).toThrow(
      DeployedDatabaseTargetRefusedError,
    );
  });

  it('refuses an acknowledgement that is merely truthy', () => {
    const selectUnchecked = selectDeployedDatabaseComposition as (options: {
      url: string;
      acknowledgedRemote: unknown;
    }) => unknown;

    for (const value of [
      undefined,
      null,
      true,
      1,
      '',
      'yes',
      'THIS-DATABASE-IS-NOT-ON-THE-OPERATORS-MACHINE',
    ]) {
      expect(() => selectUnchecked({ url: url('10.0.0.7'), acknowledgedRemote: value })).toThrow(
        DeployedDatabaseTargetRefusedError,
      );
    }
  });

  it('judges the target even when the acknowledgement is present', () => {
    // 🚫 Acknowledging the trade does not widen it: a public host is still
    // refused, so the sentence is not a bypass with extra steps.
    expect(() =>
      selectDeployedDatabaseComposition({
        url: url('203.0.113.9'),
        acknowledgedRemote: REMOTE_ACKNOWLEDGEMENT,
      }),
    ).toThrow(DeployedDatabaseTargetRefusedError);
  });
});

describe('the host reader', () => {
  it('returns undefined rather than a guess for anything it cannot read', () => {
    expect(deployedDatabaseTargetHost('nonsense')).toBeUndefined();
    expect(deployedDatabaseTargetHost('postgres://10.0.0.7/age')).toBe('10.0.0.7');
  });
});
