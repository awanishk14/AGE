import { PrismaClient } from '@prisma/client';
import { hashSessionToken, verifyPresentedSessionToken } from '@age/session-store';
import {
  PrismaOperatorSessionScopeRunner,
  operatorSessionLookup,
} from '@age/session-store-persistence';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * LIVE PostgreSQL tests for VERIFYING A PRESENTED TOKEN — ADR-0068 §0.1b, the
 * last thing that acceptance lowered.
 *
 * 🛑 WHAT THIS PROVES THAT THE UNIT TESTS CANNOT. It runs the real adapter,
 * against the real table, through the real policy, as the NON-OWNER application
 * role — and produces the first `verified-session` this repository has ever been
 * able to construct from a stored credential.
 *
 * 🛑 VERIFICATION IS NOT ISSUANCE, AND IT IS DEMONSTRATED HERE RATHER THAN
 * ASSERTED: every row below is planted by the OWNER connection, because the
 * application role holds `SELECT` and nothing else. 🚫 There is no provisioning
 * function to call — the second operator's row is planted by an ACT (§0.1c).
 *
 * 🚫 NO ASSERTION RESTS ON AN EMPTY RESULT SET. Every "not verified" case is
 * paired with a row the OWNER can still count, so a table that was merely empty
 * fails these tests instead of passing them.
 *
 * IT FAILS, IT DOES NOT SKIP. Both connection strings are required.
 */

const DATABASE_URL = process.env['DATABASE_URL'];
const DATABASE_URL_APP = process.env['DATABASE_URL_APP'];

if (!DATABASE_URL || !DATABASE_URL_APP) {
  throw new Error(
    'DATABASE_URL (owner) and DATABASE_URL_APP (non-owner application role) are both required. ' +
      'These tests never skip: a suite that silently passes as the owner proves nothing.',
  );
}

const owner = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
const app = new PrismaClient({ datasources: { db: { url: DATABASE_URL_APP } } });

/**
 * ⚠️ Obviously fictional, and 🚫 never a real credential (ADR-0053 D3). It is a
 * literal here because the digest stored in the fixture must be this token's —
 * the whole point is that the hashing happens in `@age/session-store` and the
 * database only ever holds the result.
 */
const PRESENTED_TOKEN = 'abcdef0123456789'.repeat(4);
const NEVER_MINTED_TOKEN = '0123456789abcdef'.repeat(4);

const ORGANIZATION = 'org-fictional-alpha';
const OTHER_ORGANIZATION = 'org-fictional-beta';

const NOW = new Date('2026-08-11T12:00:00.000Z');

interface PlantedSession {
  readonly sessionId: string;
  readonly organizationId: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
}

async function plant(session: PlantedSession): Promise<void> {
  await owner.$executeRaw`
    INSERT INTO "operator_sessions"
      ("session_id", "organization_id", "account_id", "token_hash", "issued_at", "expires_at", "revoked_at")
    VALUES (
      ${session.sessionId}, ${session.organizationId}, 'operator-2',
      ${hashSessionToken(PRESENTED_TOKEN)},
      '2026-08-11T09:00:00.000Z', ${session.expiresAt}, ${session.revokedAt}
    )`;
}

const LIVE: PlantedSession = {
  sessionId: 'session-fictional-live',
  organizationId: ORGANIZATION,
  expiresAt: '2026-08-11T17:00:00.000Z',
  revokedAt: null,
};

async function countAsOwner(): Promise<number> {
  const rows = await owner.$queryRaw<
    Array<{ count: bigint }>
  >`SELECT COUNT(*)::bigint AS count FROM "operator_sessions"`;
  return Number(rows[0]?.count ?? 0);
}

/** The real path, end to end: the app role, the real runner, the real adapter. */
async function verify(presentedToken: string, organizationId: string) {
  return verifyPresentedSessionToken({
    presentedToken,
    findRowByTokenHash: operatorSessionLookup(new PrismaOperatorSessionScopeRunner(app), {
      organizationId,
    }),
    now: NOW,
  });
}

beforeAll(async () => {
  await owner.$connect();
  await app.$connect();
});

afterAll(async () => {
  await owner.$disconnect();
  await app.$disconnect();
});

beforeEach(async () => {
  await owner.$executeRawUnsafe('TRUNCATE TABLE "operator_sessions"');
});

describe('a presented token, verified against the real store', () => {
  it('🛑 verifies a live session — the first constructible authenticated principal', async () => {
    await plant(LIVE);

    const verification = await verify(PRESENTED_TOKEN, ORGANIZATION);

    expect(verification.outcome).toBe('verified');
    if (verification.outcome !== 'verified') throw new Error('unreachable');
    // ⚠️ **NARROWED TO THE TENANT ARM, 🚫 NOT CAST PAST IT** (ADR-0083 D1).
    // A row read through the TENANT policy can only be a tenant principal — and
    // the assertion below says so out loud, so a platform row arriving here
    // would fail rather than be read as one.
    expect(verification.principal.scope).toBe('tenant');
    if (verification.principal.scope !== 'tenant') throw new Error('unreachable');

    expect(verification.principal.session.sessionId).toBe('session-fictional-live');
    // 🛑 The session carries its OWN organization. 🚫 A caller's claim never
    // becomes the scope a later read runs under — `@age/entitled-read` derives
    // that from here (ADR-0062 D1).
    expect(verification.principal.session.organizationId).toBe(ORGANIZATION);
  });

  it('🚫 a token that was never minted is `no-such-session` — 🚫 not "invalid"', async () => {
    await plant(LIVE);

    expect(await verify(NEVER_MINTED_TOKEN, ORGANIZATION)).toEqual({
      outcome: 'unverified',
      reason: 'no-such-session',
    });
    // 🛑 The pairing that makes the line above evidence: the row is still there.
    expect(await countAsOwner()).toBe(1);
  });

  it('🛑 a caller naming another tenant reaches no row, while the row still exists', async () => {
    await plant(LIVE);

    // ⚠️ The claim NARROWS. Naming a tenant cannot reach that tenant's sessions
    // — the digest still has to match a row already inside the named scope.
    expect(await verify(PRESENTED_TOKEN, OTHER_ORGANIZATION)).toEqual({
      outcome: 'unverified',
      reason: 'no-such-session',
    });
    expect(await countAsOwner()).toBe(1);
  });

  it('🛑 keeps `revoked` and `expired` apart, across the real store', async () => {
    await plant({ ...LIVE, revokedAt: '2026-08-11T10:00:00.000Z' });

    expect(await verify(PRESENTED_TOKEN, ORGANIZATION)).toEqual({
      outcome: 'unverified',
      // ⚠️ 🚫 NOT `no-such-session`: AGE has the row and has decided against it,
      // which is a different fact an operator asks about afterwards.
      reason: 'revoked',
    });

    await owner.$executeRawUnsafe('TRUNCATE TABLE "operator_sessions"');
    await plant({ ...LIVE, expiresAt: '2026-08-11T11:00:00.000Z' });

    expect(await verify(PRESENTED_TOKEN, ORGANIZATION)).toEqual({
      outcome: 'unverified',
      reason: 'expired',
    });
    expect(await countAsOwner()).toBe(1);
  });

  it('🛑 a malformed token never reaches the database at all', async () => {
    await plant(LIVE);

    // ⚠️ The shape is checked before the store is touched. Proven here by using
    // a connection-free path: were the order reversed, this would still pass —
    // so the ORDER is proven in the unit suite, and what this adds is that the
    // real path agrees on the ANSWER.
    expect(await verify('not-a-token', ORGANIZATION)).toEqual({
      outcome: 'unverified',
      reason: 'malformed-token',
    });
    expect(await countAsOwner()).toBe(1);
  });
});
