import {
  authenticatedOrganizationIdOf,
  type AuthenticatedOrganizationId,
  type VerifiedSession,
} from '@age/entitlement';
import { describe, expect, it } from 'vitest';

import { AuditEntryRefusedError, recordAuditEntry, type AuditEntry } from '../audit-entry';
import { selectTenantAuditEntries } from '../audit-retrieval';

function organization(id: string): AuthenticatedOrganizationId {
  return authenticatedOrganizationIdOf({
    sessionId: 'session-1',
    organizationId: id,
    accountId: 'account-1',
    verifiedAt: '2026-08-09T09:00:00.000Z',
  } as VerifiedSession);
}

const ORG_A = organization('org-alpha');
const ORG_B = organization('org-beta');

function entry(
  entryId: string,
  organizationId: string | null,
  occurredAt: string,
  event: 'authentication-succeeded' | 'record-read' = 'authentication-succeeded',
): AuditEntry {
  return recordAuditEntry({
    entryId,
    event,
    occurredAt,
    actor: {
      organizationId,
      accountId: organizationId === null ? null : 'account-1',
      offeredSubjectKey: 'subject-1',
      sourceKey: '203.0.113.7',
    },
    target: event === 'record-read' ? { recordType: 'scored-bif-snapshot', recordId: 's-1' } : null,
  });
}

const TRAIL: readonly AuditEntry[] = [
  entry('a-2', 'org-alpha', '2026-08-09T11:00:00.000Z', 'record-read'),
  entry('a-1', 'org-alpha', '2026-08-09T10:00:00.000Z'),
  entry('b-1', 'org-beta', '2026-08-09T10:30:00.000Z'),
  entry('u-1', null, '2026-08-09T10:15:00.000Z'),
];

const WHOLE_DAY = {
  from: '2026-08-09T00:00:00.000Z',
  until: '2026-08-10T00:00:00.000Z',
} as const;

describe('an audit read is itself tenant-scoped', () => {
  it("returns only the asking organization's entries", () => {
    const found = selectTenantAuditEntries(TRAIL, { organizationId: ORG_A, ...WHOLE_DAY });

    expect(found.map((found_) => found_.entryId)).toEqual(['a-1', 'a-2']);
  });

  it("does not show beta's entry to alpha, and shows it to beta", () => {
    expect(
      selectTenantAuditEntries(TRAIL, { organizationId: ORG_A, ...WHOLE_DAY }).some(
        (found) => found.entryId === 'b-1',
      ),
    ).toBe(false);
    expect(
      selectTenantAuditEntries(TRAIL, { organizationId: ORG_B, ...WHOLE_DAY }).map(
        (found) => found.entryId,
      ),
    ).toEqual(['b-1']);
  });

  it('shows an unattributed entry to nobody', () => {
    // 🛑 A failed sign-in for a subject nobody recognizes belongs to no tenant.
    // Handing it to one would be evidence about somebody else; attributing it
    // to the asker would be inventing an attribution.
    for (const organizationId of [ORG_A, ORG_B]) {
      expect(
        selectTenantAuditEntries(TRAIL, { organizationId, ...WHOLE_DAY }).some(
          (found) => found.entryId === 'u-1',
        ),
      ).toBe(false);
    }
  });
});

describe('the trail answers a question', () => {
  it('is ordered oldest first, not as stored', () => {
    const found = selectTenantAuditEntries(TRAIL, { organizationId: ORG_A, ...WHOLE_DAY });

    expect(found[0]?.occurredAt).toBe('2026-08-09T10:00:00.000Z');
    expect(found[1]?.occurredAt).toBe('2026-08-09T11:00:00.000Z');
  });

  it('honours the window, upper bound exclusive', () => {
    const found = selectTenantAuditEntries(TRAIL, {
      organizationId: ORG_A,
      from: '2026-08-09T10:00:00.000Z',
      until: '2026-08-09T11:00:00.000Z',
    });

    expect(found.map((found_) => found_.entryId)).toEqual(['a-1']);
  });

  it('narrows by event when asked, and by nothing when not', () => {
    expect(
      selectTenantAuditEntries(TRAIL, {
        organizationId: ORG_A,
        ...WHOLE_DAY,
        event: 'record-read',
      }).map((found) => found.entryId),
    ).toEqual(['a-2']);
    expect(selectTenantAuditEntries(TRAIL, { organizationId: ORG_A, ...WHOLE_DAY })).toHaveLength(
      2,
    );
  });

  it('returns nothing for a tenant with no entries, and does not throw', () => {
    // ⚠️ Empty is an answer. 🚫 It is not an error, and 🚫 not "no audit".
    expect(selectTenantAuditEntries([], { organizationId: ORG_A, ...WHOLE_DAY })).toEqual([]);
  });

  it('does not hand back the caller’s array', () => {
    const found = selectTenantAuditEntries(TRAIL, { organizationId: ORG_A, ...WHOLE_DAY });

    expect(found).not.toBe(TRAIL);
  });
});

describe('a window nobody can state exactly is refused', () => {
  it.each([
    ['a local time', { from: '2026-08-09T00:00:00', until: '2026-08-10T00:00:00.000Z' }],
    ['an offset', { from: '2026-08-09T00:00:00+05:30', until: '2026-08-10T00:00:00.000Z' }],
    ['blank', { from: '', until: '' }],
    ['inverted', { from: '2026-08-10T00:00:00.000Z', until: '2026-08-09T00:00:00.000Z' }],
    ['empty', { from: '2026-08-09T00:00:00.000Z', until: '2026-08-09T00:00:00.000Z' }],
  ])('refuses %s', (_case, window) => {
    expect(() => selectTenantAuditEntries(TRAIL, { organizationId: ORG_A, ...window })).toThrow(
      AuditEntryRefusedError,
    );
  });

  it('refuses a question that names no organization', () => {
    expect(() =>
      selectTenantAuditEntries(TRAIL, {
        organizationId: '  ' as AuthenticatedOrganizationId,
        ...WHOLE_DAY,
      }),
    ).toThrow(AuditEntryRefusedError);
  });
});
