import { describe, expect, it, vi } from 'vitest';

import { hashSessionToken } from '../session-record';
import { verifyPresentedSessionToken } from '../session-verification';

const TOKEN = 'a'.repeat(64);
const NOW = new Date('2026-08-13T12:00:00.000Z');

/** ⚠️ Obviously fictional (ADR-0053 D3). */
const ROW = Object.freeze({
  sessionId: 'session-fictional-1',
  organizationId: 'org-fictional-1',
  accountId: 'operator-2',
  tokenHash: hashSessionToken(TOKEN),
  issuedAt: '2026-08-13T09:00:00.000Z',
  expiresAt: '2026-08-13T17:00:00.000Z',
  revokedAt: null,
});

const lookupReturning = (row: unknown) =>
  vi.fn(async (_tokenHash: string): Promise<unknown> => row);

/** 🛑 The lookup that proves an order rather than asserting it. */
const lookupThatMustNotRun = vi.fn(async () => {
  throw new Error('the store was touched');
});

describe('a token that was never minted here never reaches the store', () => {
  it.each(['', '   ', 'not-a-token', 'A'.repeat(64), 'a'.repeat(63), 'a'.repeat(65)])(
    'refuses %s as malformed, 🚫 without a lookup',
    async (token) => {
      const findRowByTokenHash = vi.fn(lookupThatMustNotRun);

      const verification = await verifyPresentedSessionToken({
        presentedToken: token,
        findRowByTokenHash,
        now: NOW,
      });

      expect(verification).toEqual({ outcome: 'unverified', reason: 'malformed-token' });
      expect(findRowByTokenHash).not.toHaveBeenCalled();
    },
  );
});

describe('the store is asked with the DIGEST, never the token', () => {
  it('passes the hash and 🚫 never the credential', async () => {
    const findRowByTokenHash = lookupReturning(ROW);

    await verifyPresentedSessionToken({ presentedToken: TOKEN, findRowByTokenHash, now: NOW });

    expect(findRowByTokenHash).toHaveBeenCalledWith(hashSessionToken(TOKEN));
    expect(findRowByTokenHash.mock.calls[0]?.[0]).not.toBe(TOKEN);
  });
});

describe('a live session verifies', () => {
  it('returns the verified session — 🚫 and nothing more than who is asking', async () => {
    const verification = await verifyPresentedSessionToken({
      presentedToken: TOKEN,
      findRowByTokenHash: lookupReturning(ROW),
      now: NOW,
    });

    expect(verification).toEqual({
      outcome: 'verified',
      principal: {
        scope: 'tenant',
        session: {
          sessionId: 'session-fictional-1',
          organizationId: 'org-fictional-1',
          accountId: 'operator-2',
        },
      },
    });
  });

  it('🚫 carries no role, no isAdmin and no permission list', async () => {
    const verification = await verifyPresentedSessionToken({
      presentedToken: TOKEN,
      findRowByTokenHash: lookupReturning(ROW),
      now: NOW,
    });

    const session =
      verification.outcome === 'verified' ? verification.principal.session : undefined;
    expect(Object.keys(session ?? {}).sort()).toEqual(['accountId', 'organizationId', 'sessionId']);
  });
});

describe('🛑 the failures stay apart — 🚫 they never collapse into "invalid"', () => {
  it('reports `no-such-session` when the store holds no row', async () => {
    for (const empty of [null, undefined]) {
      const verification = await verifyPresentedSessionToken({
        presentedToken: TOKEN,
        findRowByTokenHash: lookupReturning(empty),
        now: NOW,
      });

      expect(verification).toEqual({ outcome: 'unverified', reason: 'no-such-session' });
    }
  });

  it('reports `expired` when the absolute expiry has passed', async () => {
    const verification = await verifyPresentedSessionToken({
      presentedToken: TOKEN,
      findRowByTokenHash: lookupReturning(ROW),
      now: new Date('2026-08-13T17:00:00.001Z'),
    });

    expect(verification).toEqual({ outcome: 'unverified', reason: 'expired' });
  });

  it('reports `revoked`, 🚫 not `expired`, when both are true', async () => {
    // ⚠️ "We shut this down" is the fact an operator asked about.
    const verification = await verifyPresentedSessionToken({
      presentedToken: TOKEN,
      findRowByTokenHash: lookupReturning({ ...ROW, revokedAt: '2026-08-13T10:00:00.000Z' }),
      now: new Date('2026-08-13T18:00:00.000Z'),
    });

    expect(verification).toEqual({ outcome: 'unverified', reason: 'revoked' });
  });

  it('reports `unreadable` for a row the normalizer refuses', async () => {
    const verification = await verifyPresentedSessionToken({
      presentedToken: TOKEN,
      findRowByTokenHash: lookupReturning({ ...ROW, expiresAt: '' }),
      now: NOW,
    });

    expect(verification).toEqual({ outcome: 'unverified', reason: 'unreadable' });
  });

  it('🛑 a missing `revokedAt` key is unreadable, 🚫 never "never revoked"', async () => {
    const { revokedAt: _dropped, ...withoutRevocation } = ROW;

    const verification = await verifyPresentedSessionToken({
      presentedToken: TOKEN,
      findRowByTokenHash: lookupReturning(withoutRevocation),
      now: NOW,
    });

    expect(verification).toEqual({ outcome: 'unverified', reason: 'unreadable' });
  });
});

describe('🚫 nothing here leaks the credential', () => {
  it('returns no field containing the token or its digest', async () => {
    const verification = await verifyPresentedSessionToken({
      presentedToken: TOKEN,
      findRowByTokenHash: lookupReturning(ROW),
      now: NOW,
    });

    const serialised = JSON.stringify(verification);
    expect(serialised).not.toContain(TOKEN);
    expect(serialised).not.toContain(hashSessionToken(TOKEN));
  });
});
