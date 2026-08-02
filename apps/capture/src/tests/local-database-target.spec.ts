import { describe, expect, it } from 'vitest';

import {
  NonLocalDatabaseTargetError,
  assertLocalDatabaseTarget,
  databaseTargetHost,
} from '../local-database-target';

/**
 * ADR-0054 D6 condition 2 — _"The target is a local development database the
 * operator controls."_
 *
 * ⚠️ What these tests establish is that a NON-LOCAL target is refused. They do
 * NOT establish that a loopback target is the operator's own database: a tunnel
 * from `localhost:5432` to a shared server is loopback and is exactly what D6
 * forbids. Loopback is necessary, not sufficient, and this file must never be
 * cited as proving more than it does.
 */

const LOCAL = 'postgresql://age_app:pw@localhost:5432/age';

describe('assertLocalDatabaseTarget', () => {
  it('accepts a loopback host', () => {
    expect(() => assertLocalDatabaseTarget(LOCAL)).not.toThrow();
    expect(() => assertLocalDatabaseTarget('postgres://u:p@127.0.0.1:5432/age')).not.toThrow();
    expect(() => assertLocalDatabaseTarget('postgresql://u:p@[::1]:5432/age')).not.toThrow();
  });

  it('accepts LOCALHOST in any case, because a host name is case-insensitive', () => {
    expect(() => assertLocalDatabaseTarget('postgresql://u:p@LocalHost:5432/age')).not.toThrow();
  });

  it('refuses a remote host', () => {
    expect(() => assertLocalDatabaseTarget('postgresql://u:p@db.example.com:5432/age')).toThrow(
      NonLocalDatabaseTargetError,
    );
  });

  it('refuses a host that merely contains "localhost"', () => {
    // A naive substring check would accept this, and it is a remote server.
    expect(() =>
      assertLocalDatabaseTarget('postgresql://u:p@localhost.attacker.example:5432/age'),
    ).toThrow(NonLocalDatabaseTargetError);
  });

  it('refuses a private-network address, which is another machine', () => {
    expect(() => assertLocalDatabaseTarget('postgresql://u:p@10.0.0.5:5432/age')).toThrow(
      NonLocalDatabaseTargetError,
    );
  });

  it('refuses what it cannot read, rather than assuming it is fine', () => {
    // Fail-closed: every path that cannot establish the host refuses.
    for (const unreadable of ['', 'not a url', 'age.db', 'mysql://u:p@localhost/age']) {
      expect(() => assertLocalDatabaseTarget(unreadable), unreadable).toThrow(
        NonLocalDatabaseTargetError,
      );
    }
  });

  it('never puts the connection string in the error, because it carries a password', () => {
    let message = '';
    try {
      assertLocalDatabaseTarget('postgresql://age_app:sup3rsecret@db.example.com:5432/age');
    } catch (error) {
      message = (error as Error).message;
      expect((error as NonLocalDatabaseTargetError).host).toBe('db.example.com');
    }

    expect(message).toContain('db.example.com');
    expect(message).not.toContain('sup3rsecret');
    expect(message).not.toContain('age_app');
  });

  it('names ADR-0054 D6 and offers the safe alternative, not a workaround', () => {
    let message = '';
    try {
      assertLocalDatabaseTarget('postgresql://u:p@db.example.com:5432/age');
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain('ADR-0054 D6');
    // 🚫 The remedy offered is to stop writing, never to bypass the check.
    expect(message).toContain('--capture');
  });
});

describe('databaseTargetHost', () => {
  it('returns the host for a PostgreSQL URL', () => {
    expect(databaseTargetHost(LOCAL)).toBe('localhost');
  });

  it('returns undefined for anything it will not reason about', () => {
    expect(databaseTargetHost('http://localhost/age')).toBeUndefined();
    expect(databaseTargetHost('postgresql:///age?host=/var/run/postgresql')).toBeUndefined();
  });
});
