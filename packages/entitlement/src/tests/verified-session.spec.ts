import { describe, expect, it } from 'vitest';

import { acceptVerifiedSession, SessionRefusedError } from '../verified-session';

const SESSION = {
  sessionId: 'ses-fictional-1',
  organizationId: 'org-fictional-1',
  accountId: 'acct-fictional-1',
};

describe('acceptVerifiedSession (ADR-0061 A2)', () => {
  it('returns a frozen session carrying exactly the three recorded facts', () => {
    const session = acceptVerifiedSession(SESSION);

    expect(Object.isFrozen(session)).toBe(true);
    expect(Object.keys(session).sort()).toEqual(['accountId', 'organizationId', 'sessionId']);
  });

  it.each(['sessionId', 'organizationId', 'accountId'] as const)(
    'refuses a blank %s, naming the field and never the value',
    (field) => {
      expect(() => acceptVerifiedSession({ ...SESSION, [field]: '   ' })).toThrow(
        SessionRefusedError,
      );

      try {
        acceptVerifiedSession({ ...SESSION, [field]: '   ' });
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain(field);
        expect(message).not.toContain('fictional');
      }
    },
  );

  it('carries no role, admin flag or permission list', () => {
    // 🚫 ADR-0062 D3 — admin is never a bypass, and a flag on the session is how
    // one arrives: the check that reads it gets added later, by someone who did
    // not read the ADR.
    const session: Record<string, unknown> = { ...acceptVerifiedSession(SESSION) };

    for (const forbidden of ['role', 'roles', 'isAdmin', 'admin', 'permissions', 'scopes']) {
      expect(session[forbidden]).toBeUndefined();
    }
  });
});
