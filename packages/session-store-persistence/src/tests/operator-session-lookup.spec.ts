import { verifyPresentedSessionToken } from '@age/session-store';
import { describe, expect, it, vi } from 'vitest';

import { operatorSessionLookup } from '../operator-session-lookup';
import {
  PrismaOperatorSessionScopeRunner,
  type OperatorSessionScopeRunner,
} from '../operator-session-scope-runner';
import type { OperatorSessionDelegate } from '../operator-session-delegate';

/**
 * ⚠️ WHAT THESE PROVE: that the lookup is a READ inside a scope it cannot omit,
 * that it never sees the presented token, that it reaches no conclusion of its
 * own, and that the SCOPE IS APPLIED BEFORE THE ROW IS READ — asserted by the
 * ORDER of recorded calls, 🚫 not by a comment.
 *
 * 🚫 Every fixture is obviously fictional (ADR-0053 D3, ADR-0065 D1).
 */

const ORG = 'org-fictional-1';
/** ⚠️ 64 lower-case hex, the shape `normalizeSessionRecord` requires. */
const DIGEST = 'a'.repeat(64);

function fakeRunner(delegate: OperatorSessionDelegate, log: string[]): OperatorSessionScopeRunner {
  return {
    async runInScope(scope, operation) {
      log.push(`scope:${scope.organizationId}`);
      return operation(delegate);
    },
  };
}

describe('operatorSessionLookup', () => {
  it('🛑 reads inside the scope — the scope is applied FIRST, by recorded order', async () => {
    const log: string[] = [];
    const delegate: OperatorSessionDelegate = {
      findUnique: async (args) => {
        log.push(`findUnique:${args.where.tokenHash}`);
        return null;
      },
    };

    const lookup = operatorSessionLookup(fakeRunner(delegate, log), { organizationId: ORG });
    await lookup(DIGEST);

    // 🛑 THE ORDER IS THE ARGUMENT. A read that reached the table before the
    // scope was set would be an unscoped read that happened to return nothing.
    expect(log).toEqual([`scope:${ORG}`, `findUnique:${DIGEST}`]);
  });

  it('🚫 never receives the presented token — only its digest reaches the store', async () => {
    const seen: string[] = [];
    const delegate: OperatorSessionDelegate = {
      findUnique: async (args) => {
        seen.push(args.where.tokenHash);
        return null;
      },
    };

    const presentedToken = 'f'.repeat(64);
    await verifyPresentedSessionToken({
      presentedToken,
      findRowByTokenHash: operatorSessionLookup(fakeRunner(delegate, []), {
        organizationId: ORG,
      }),
      now: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(seen).toHaveLength(1);
    // 🛑 The credential itself must never appear at this layer. A digest is
    // half a secret only if it is also the secret.
    expect(seen[0]).not.toBe(presentedToken);
    expect(seen[0]).toMatch(/^[0-9a-f]{64}$/);
  });

  it('🚫 reaches no conclusion — a missing row travels back as `null`, untouched', async () => {
    const delegate: OperatorSessionDelegate = { findUnique: async () => null };
    const lookup = operatorSessionLookup(fakeRunner(delegate, []), { organizationId: ORG });

    // ⚠️ 🚫 Not a refusal, 🚫 not an error, 🚫 not an empty object. The verifier
    // is the only thing that turns absence into `no-such-session`.
    await expect(lookup(DIGEST)).resolves.toBeNull();
  });

  it('⚠️ hands the row back RAW, so it is re-validated as untrusted input', async () => {
    // ⚠️ Deliberately malformed: a row this layer "helpfully" shaped would reach
    // the verifier looking already-checked.
    const stored = { sessionId: 'session-fictional', tokenHash: 'not-a-digest' };
    const delegate: OperatorSessionDelegate = { findUnique: async () => stored };
    const lookup = operatorSessionLookup(fakeRunner(delegate, []), { organizationId: ORG });

    await expect(lookup(DIGEST)).resolves.toBe(stored);

    // 🛑 And the verifier — 🚫 not this package — is what refuses it.
    const verification = await verifyPresentedSessionToken({
      presentedToken: 'f'.repeat(64),
      findRowByTokenHash: lookup,
      now: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(verification).toEqual({ outcome: 'unverified', reason: 'unreadable' });
  });

  it('🛑 a caller naming another tenant reaches no row — the claim NARROWS', async () => {
    const scopes: string[] = [];
    const delegate: OperatorSessionDelegate = { findUnique: async () => null };
    const runner: OperatorSessionScopeRunner = {
      async runInScope(scope, operation) {
        scopes.push(scope.organizationId);
        return operation(delegate);
      },
    };

    await operatorSessionLookup(runner, { organizationId: 'org-fictional-2' })(DIGEST);

    // ⚠️ The scope that reaches the policy is the one the CALLER named. It can
    // only ever remove rows from view — 🚫 there is no value that adds any.
    expect(scopes).toEqual(['org-fictional-2']);
  });
});

describe('PrismaOperatorSessionScopeRunner', () => {
  it('🛑 sets the transaction-local scope BEFORE handing over the delegate', async () => {
    const log: string[] = [];
    const operatorSession: OperatorSessionDelegate = {
      findUnique: async () => {
        log.push('findUnique');
        return null;
      },
    };

    const bound: unknown[] = [];
    const runner = new PrismaOperatorSessionScopeRunner({
      $transaction: async (operation) =>
        operation({
          $executeRaw: async (query, ...values) => {
            log.push('set_config');
            bound.push(...values);
            // ⚠️ The organization must be a BOUND PARAMETER, never spliced into
            // the SQL text.
            expect(query.join('?')).toContain('age.organization_id');
            return 1;
          },
          operatorSession,
        }),
    });

    await runner.runInScope({ organizationId: ORG }, async (sessions) =>
      sessions.findUnique({ where: { tokenHash: DIGEST } }),
    );

    expect(log).toEqual(['set_config', 'findUnique']);
    expect(bound).toEqual([ORG]);
  });

  it('🚫 propagates a rejected transaction unchanged — 🚫 no invented taxonomy', async () => {
    const failure = new Error('the transaction was rejected');
    const runner = new PrismaOperatorSessionScopeRunner({
      $transaction: async () => {
        throw failure;
      },
    });

    await expect(
      runner.runInScope({ organizationId: ORG }, async () => 'unreachable'),
    ).rejects.toBe(failure);
  });

  it('🛑 the delegate comes off the TRANSACTION, never off the source', async () => {
    const fromTransaction: OperatorSessionDelegate = { findUnique: vi.fn(async () => null) };
    const runner = new PrismaOperatorSessionScopeRunner({
      $transaction: async (operation) =>
        operation({
          $executeRaw: async () => 1,
          operatorSession: fromTransaction,
        }),
    });

    const handed = await runner.runInScope({ organizationId: ORG }, async (sessions) => sessions);

    // ⚠️ One from another connection would run outside this transaction, where
    // the setting does not apply, and fail closed — correct, but an
    // exceptionally confusing way to discover the bug.
    expect(handed).toBe(fromTransaction);
  });
});
