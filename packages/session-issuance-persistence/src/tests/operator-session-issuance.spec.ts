import { describe, expect, it } from 'vitest';

import type { OperatorSessionScopeRunner } from '@age/session-store-persistence';

import {
  operatorSessionIssuance,
  SessionIssuanceRefusedError,
  type OperatorSessionIssuanceDelegate,
} from '../operator-session-issuance';

/**
 * ⚠️ WHAT THESE PROVE: that a session is created inside a scope it cannot omit,
 * that the SCOPE IS APPLIED BEFORE THE ROW IS WRITTEN (asserted by the ORDER of
 * recorded calls, 🚫 not by a comment), that the raw token never reaches this
 * layer, and that issuing into another organization is REFUSED rather than
 * quietly re-scoped.
 *
 * 🛑 What they deliberately do NOT prove: that `age_app` holds INSERT and not
 * DELETE, or that the `WITH CHECK` policy rejects an out-of-scope row. Those are
 * GRANTS and POLICIES, and they are proven where grants are — against a live
 * PostgreSQL, in `packages/persistence`. A fake delegate can only show that this
 * code does not ASK for more.
 *
 * 🚫 Every fixture is obviously fictional (ADR-0053 D3, ADR-0065 D1).
 */

const ORG = 'org-fictional-1';
const TOKEN = 'ab'.repeat(32);

const request = () => ({
  sessionId: 'session-fictional-1',
  organizationId: ORG,
  accountId: 'account-fictional-1',
  token: TOKEN,
  issuedAt: new Date('2026-08-18T09:00:00.000Z'),
  lifetimeSeconds: 3600,
});

function fakeRunner(
  delegate: OperatorSessionIssuanceDelegate,
  log: string[],
): OperatorSessionScopeRunner<OperatorSessionIssuanceDelegate> {
  return {
    async runInScope(scope, operation) {
      log.push(`scope:${scope.organizationId}`);
      return operation(delegate);
    },
  };
}

describe('operatorSessionIssuance', () => {
  it('🛑 writes inside the scope — the scope is applied FIRST, by recorded order', async () => {
    const log: string[] = [];
    const delegate: OperatorSessionIssuanceDelegate = {
      create: async (args) => {
        log.push(`create:${args.data.sessionId}`);
        return {};
      },
    };

    const issued = await operatorSessionIssuance(fakeRunner(delegate, log), {
      organizationId: ORG,
    })(request());

    expect(log).toEqual([`scope:${ORG}`, 'create:session-fictional-1']);
    expect(issued).toEqual({
      sessionId: 'session-fictional-1',
      expiresAt: '2026-08-18T10:00:00.000Z',
    });
  });

  it('🚫 never sends the raw token — only the digest reaches the database', async () => {
    let written = '';
    const delegate: OperatorSessionIssuanceDelegate = {
      create: async (args) => {
        written = JSON.stringify(args.data);
        return {};
      },
    };

    await operatorSessionIssuance(fakeRunner(delegate, []), { organizationId: ORG })(request());

    expect(written).not.toContain(TOKEN);
    expect(written).toContain('tokenHash');
    // ⚠️ And the digest is really there, so "does not contain the token" cannot
    // be satisfied by sending nothing at all.
    expect(JSON.parse(written).tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('🚫 does not return the token or the digest to its caller', async () => {
    const issued = await operatorSessionIssuance(fakeRunner({ create: async () => ({}) }, []), {
      organizationId: ORG,
    })(request());

    expect(Object.keys(issued).sort()).toEqual(['expiresAt', 'sessionId']);
  });

  it('🛑 refuses to issue into another organization — and writes NOTHING first', async () => {
    let calls = 0;
    const delegate: OperatorSessionIssuanceDelegate = {
      create: async () => {
        calls += 1;
        return {};
      },
    };

    await expect(
      operatorSessionIssuance(fakeRunner(delegate, []), {
        organizationId: 'org-fictional-2',
      })(request()),
    ).rejects.toThrow(SessionIssuanceRefusedError);

    // 🛑 The refusal is not a rollback. Nothing was attempted.
    expect(calls).toBe(0);
  });

  it('🚫 refuses without naming the organization it refused about', async () => {
    // ⚠️ **THE ERROR IS CAPTURED, 🚫 NOT ASSERTED INSIDE A `catch`.** A
    // `try`/`catch` that puts `expect.unreachable()` in the `try` catches its own
    // failure and then asserts against it — and the assertions below pass on that
    // error too, so the case would go green with the refusal DELETED. Proven by
    // mutation, 🚫 not by reading.
    const error = await operatorSessionIssuance(fakeRunner({ create: async () => ({}) }, []), {
      organizationId: 'org-fictional-2',
    })(request()).then(
      () => null,
      (thrown: unknown) => thrown,
    );

    expect(error).toBeInstanceOf(SessionIssuanceRefusedError);
    expect((error as Error).message).not.toContain(ORG);
    expect((error as Error).message).not.toContain('org-fictional-2');
  });

  it('🚫 refuses a bad token before a connection is ever opened', async () => {
    const log: string[] = [];

    await expect(
      operatorSessionIssuance(fakeRunner({ create: async () => ({}) }, log), {
        organizationId: ORG,
      })({ ...request(), token: 'not-a-token' }),
    ).rejects.toThrow();

    // ⚠️ The runner was never entered, so a value that was not minted here does
    // not reach a transaction, a query log or a slow-query trace.
    expect(log).toEqual([]);
  });
});
