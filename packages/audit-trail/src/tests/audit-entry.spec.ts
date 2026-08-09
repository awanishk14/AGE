import { describe, expect, it } from 'vitest';

import {
  AUDIT_EVENTS,
  AuditEntryRefusedError,
  recordAuditEntry,
  type AuditActor,
} from '../audit-entry';

const SOURCE = '203.0.113.7';

function actor(overrides: Partial<AuditActor> = {}): AuditActor {
  return {
    organizationId: 'org-alpha',
    accountId: 'account-1',
    offeredSubjectKey: 'subject-1',
    sourceKey: SOURCE,
    ...overrides,
  };
}

describe('who logged in', () => {
  it('records a success', () => {
    const entry = recordAuditEntry({
      entryId: 'audit-1',
      event: 'authentication-succeeded',
      occurredAt: '2026-08-09T10:00:00.000Z',
      actor: actor(),
    });

    expect(entry.event).toBe('authentication-succeeded');
    expect(entry.actor.accountId).toBe('account-1');
    expect(entry.target).toBeNull();
  });

  it('records a failure just as fully', () => {
    // 🛑 The thousand refusals before the one success ARE the attack. An audit
    // that keeps only successes cannot see it.
    const entry = recordAuditEntry({
      entryId: 'audit-2',
      event: 'authentication-failed',
      occurredAt: '2026-08-09T10:00:01.000Z',
      actor: actor({ organizationId: null, accountId: null }),
    });

    expect(entry.event).toBe('authentication-failed');
    expect(entry.actor.offeredSubjectKey).toBe('subject-1');
    expect(entry.actor.sourceKey).toBe(SOURCE);
  });

  it('refuses to name an account on a failure', () => {
    // 🚫 Nothing was proven about who was at the other end.
    expect(() =>
      recordAuditEntry({
        entryId: 'audit-3',
        event: 'authentication-failed',
        occurredAt: '2026-08-09T10:00:02.000Z',
        actor: actor({ organizationId: null }),
      }),
    ).toThrow(AuditEntryRefusedError);
  });

  it('always records where it came from', () => {
    expect(() =>
      recordAuditEntry({
        entryId: 'audit-4',
        event: 'authentication-succeeded',
        occurredAt: '2026-08-09T10:00:03.000Z',
        actor: actor({ sourceKey: '  ' }),
      }),
    ).toThrow(AuditEntryRefusedError);
  });
});

describe('what was read', () => {
  const read = {
    entryId: 'audit-5',
    event: 'record-read',
    occurredAt: '2026-08-09T11:00:00.000Z',
    actor: actor(),
    target: { recordType: 'scored-bif-snapshot', recordId: 'snap-1' },
  } as const;

  it('names the record by identifier', () => {
    const entry = recordAuditEntry(read);

    expect(entry.target).toEqual({ recordType: 'scored-bif-snapshot', recordId: 'snap-1' });
  });

  it('refuses a read that names nothing', () => {
    // 🚫 "Something was read" is not an audit trail.
    expect(() => recordAuditEntry({ ...read, target: null })).toThrow(AuditEntryRefusedError);
  });

  it('refuses a target with a blank identifier', () => {
    expect(() =>
      recordAuditEntry({ ...read, target: { recordType: 'scored-bif-snapshot', recordId: '' } }),
    ).toThrow(AuditEntryRefusedError);
  });

  it('refuses a sign-in that names a record', () => {
    expect(() => recordAuditEntry({ ...read, event: 'authentication-succeeded' })).toThrow(
      AuditEntryRefusedError,
    );
  });
});

describe('an entry carries no secret and no copy of the data', () => {
  it.each([
    ['a password', 'password'],
    ['a token', 'token'],
    ['a token hash', 'tokenHash'],
    ['a session cookie', 'cookie'],
    ['a credential', 'credential'],
  ])('refuses an actor carrying %s', (_case, field) => {
    expect(() =>
      recordAuditEntry({
        entryId: 'audit-6',
        event: 'authentication-succeeded',
        occurredAt: '2026-08-09T10:00:00.000Z',
        actor: { ...actor(), [field]: 'value' } as AuditActor,
      }),
    ).toThrow(AuditEntryRefusedError);
  });

  it.each([
    ['the snapshot itself', 'snapshot'],
    ['a payload', 'payload'],
    ['the answers', 'answers'],
  ])('refuses a target carrying %s', (_case, field) => {
    expect(() =>
      recordAuditEntry({
        entryId: 'audit-7',
        event: 'record-read',
        occurredAt: '2026-08-09T10:00:00.000Z',
        actor: actor(),
        target: { recordType: 'x', recordId: 'y', [field]: 'value' } as never,
      }),
    ).toThrow(AuditEntryRefusedError);
  });

  it('names the field but never its value', () => {
    try {
      recordAuditEntry({
        entryId: 'audit-8',
        event: 'authentication-succeeded',
        occurredAt: '2026-08-09T10:00:00.000Z',
        actor: { ...actor(), token: 'hunter2-the-actual-secret' } as AuditActor,
      });
      expect.unreachable('a secret-bearing actor must be refused');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('token');
      expect(message).not.toContain('hunter2');
    }
  });
});

describe('an entry is a fact, not a draft', () => {
  const entry = recordAuditEntry({
    entryId: 'audit-9',
    event: 'record-read',
    occurredAt: '2026-08-09T12:00:00.000Z',
    actor: actor(),
    target: { recordType: 'scored-bif-snapshot', recordId: 'snap-1' },
  });

  it('is frozen, along with its actor and target', () => {
    // 🚫 An entry that can be rewritten proves nothing about what happened.
    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.actor)).toBe(true);
    expect(Object.isFrozen(entry.target)).toBe(true);
  });

  it('copies the actor rather than holding the caller’s object', () => {
    const held = actor();
    const recorded = recordAuditEntry({
      entryId: 'audit-10',
      event: 'authentication-succeeded',
      occurredAt: '2026-08-09T12:00:00.000Z',
      actor: held,
    });

    expect(recorded.actor).not.toBe(held);
  });
});

describe('the event set is closed and the instant is canonical', () => {
  it('lists exactly the four events', () => {
    expect([...AUDIT_EVENTS]).toEqual([
      'authentication-succeeded',
      'authentication-failed',
      'session-revoked',
      'record-read',
    ]);
  });

  it('refuses an event nobody declared', () => {
    expect(() =>
      recordAuditEntry({
        entryId: 'audit-11',
        event: 'something-happened' as never,
        occurredAt: '2026-08-09T10:00:00.000Z',
        actor: actor(),
      }),
    ).toThrow(AuditEntryRefusedError);
  });

  it.each([
    ['a local time', '2026-08-09T10:00:00'],
    ['an offset', '2026-08-09T10:00:00+05:30'],
    ['no milliseconds', '2026-08-09T10:00:00Z'],
    ['a date', '2026-08-09'],
    ['blank', ''],
  ])('refuses %s as an instant', (_case, occurredAt) => {
    expect(() =>
      recordAuditEntry({
        entryId: 'audit-12',
        event: 'authentication-succeeded',
        occurredAt,
        actor: actor(),
      }),
    ).toThrow(AuditEntryRefusedError);
  });

  it('refuses a blank entry identifier', () => {
    expect(() =>
      recordAuditEntry({
        entryId: '   ',
        event: 'authentication-succeeded',
        occurredAt: '2026-08-09T10:00:00.000Z',
        actor: actor(),
      }),
    ).toThrow(AuditEntryRefusedError);
  });
});
