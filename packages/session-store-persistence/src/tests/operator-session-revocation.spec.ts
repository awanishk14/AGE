import { describe, expect, it } from 'vitest';

import {
  operatorSessionRevocation,
  type OperatorSessionRevocationDelegate,
} from '../operator-session-revocation';
import type { OperatorSessionScopeRunner } from '../operator-session-scope-runner';

/**
 * ⚠️ WHAT THESE PROVE: that ending a session happens inside a scope it cannot
 * omit, that the SCOPE IS APPLIED BEFORE THE ROW IS TOUCHED (asserted by the
 * ORDER of recorded calls, 🚫 not by a comment), that the package holds no clock,
 * and that a SECOND revocation is a no-op which preserves the FIRST instant.
 *
 * 🛑 What they deliberately do NOT prove: that `age_app` cannot write any other
 * column. That is a GRANT, and it is proven where grants are — against a live
 * PostgreSQL, in the migration track. A fake delegate can only show that this
 * code does not ASK for more.
 *
 * 🚫 Every fixture is obviously fictional (ADR-0053 D3, ADR-0065 D1).
 */

const ORG = 'org-fictional-1';
const SESSION = 'session-fictional-1';
const INSTANT = '2026-08-15T09:00:00.000Z';

function fakeRunner(
  delegate: OperatorSessionRevocationDelegate,
  log: string[],
): OperatorSessionScopeRunner<OperatorSessionRevocationDelegate> {
  return {
    async runInScope(scope, operation) {
      // ⚠️ Narrowed because the scope is a UNION since ADR-0083 D5. 🚫 A
      // cast here would let a platform scope reach this path unnoticed.
      log.push(
        'platformSessionTokenHash' in scope
          ? `platform-scope:${scope.platformSessionTokenHash}`
          : `scope:${scope.organizationId}`,
      );
      return operation(delegate);
    },
  };
}

describe('operatorSessionRevocation', () => {
  it('🛑 writes inside the scope — the scope is applied FIRST, by recorded order', async () => {
    const log: string[] = [];
    const delegate: OperatorSessionRevocationDelegate = {
      updateMany: async (args) => {
        log.push(`updateMany:${args.where.sessionId}`);
        return { count: 1 };
      },
    };

    await operatorSessionRevocation(fakeRunner(delegate, log), { organizationId: ORG })(
      SESSION,
      INSTANT,
    );

    // 🛑 THE ORDER IS THE ARGUMENT. Under `FORCE ROW LEVEL SECURITY` an unscoped
    // UPDATE touches ZERO rows and raises nothing — which would look exactly
    // like a successful logout of an already-ended session.
    expect(log).toEqual([`scope:${ORG}`, `updateMany:${SESSION}`]);
  });

  it('🚫 asks for exactly one column, and never for an INSERT or a DELETE', async () => {
    const seen: unknown[] = [];
    const delegate: OperatorSessionRevocationDelegate = {
      updateMany: async (args) => {
        seen.push(args);
        return { count: 1 };
      },
    };

    await operatorSessionRevocation(fakeRunner(delegate, []), { organizationId: ORG })(
      SESSION,
      INSTANT,
    );

    // 🛑 `revokedAt` alone. 🚫 Not `expiresAt` (extending a session), 🚫 not
    // `tokenHash` (repointing one), 🚫 not `organizationId` (re-tenanting one).
    expect(seen).toEqual([
      { where: { sessionId: SESSION, revokedAt: null }, data: { revokedAt: INSTANT } },
    ]);
  });

  it('🛑 revoking twice preserves the FIRST instant — the second is `already-ended`', async () => {
    // The `revokedAt: null` condition is what does this: the second update
    // matches no row, so the stored instant is the moment the session actually
    // ended. ⚠️ A plain `update` would overwrite it, and AGE would then be
    // unable to say WHEN a session stopped being usable.
    let stored: string | null = null;

    const delegate: OperatorSessionRevocationDelegate = {
      updateMany: async (args) => {
        if (stored !== null) return { count: 0 };
        stored = args.data.revokedAt;
        return { count: 1 };
      },
    };

    const revoke = operatorSessionRevocation(fakeRunner(delegate, []), { organizationId: ORG });

    expect(await revoke(SESSION, INSTANT)).toBe('revoked');
    expect(await revoke(SESSION, '2026-08-15T11:00:00.000Z')).toBe('already-ended');
    expect(stored).toBe(INSTANT);
  });

  it('⚠️ takes the instant as a PARAMETER — this package holds no clock', async () => {
    const source = new URL('../operator-session-revocation.ts', import.meta.url);
    const code = (await import('node:fs')).readFileSync(source, 'utf8');

    // ⚠️ Comments stripped first: the module's own prose names the token.
    const stripped = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    expect(stripped.length).toBeGreaterThan(0);
    expect(stripped).not.toContain('new Date(');
    expect(stripped).not.toContain('Date.now(');
  });
});
