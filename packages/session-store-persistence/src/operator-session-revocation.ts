import type {
  OperatorSessionScope,
  OperatorSessionScopeRunner,
} from './operator-session-scope-runner';

/**
 * ADR-0074 §7 slice 2 — **ENDING a session, and only ending one.**
 *
 * 🛑 **THIS IS A SEPARATE MODULE AND A SEPARATE DELEGATE, ON PURPOSE.**
 * `operator-session-delegate.ts` carries `findUnique` and nothing else, and its
 * comment argues at length that the ABSENCE of every write verb is what makes
 * *verification is not issuance* true by shape rather than by promise. That
 * argument is still correct, so it is not being edited: the read delegate keeps
 * zero write methods, and the one permitted write is declared here, in its own
 * type, with its own name, so that a reader of either file sees exactly one
 * capability and not a union of two.
 *
 * 🛑 **REVOKING IS NOT ISSUING, AND THE DATABASE IS WHERE THAT IS ENFORCED.**
 * `age_app` holds `GRANT UPDATE ("revoked_at")` — a COLUMN grant — and no INSERT
 * and no DELETE. So even a caller that reached a raw client could not create a
 * session, could not extend one by moving `expires_at`, and could not re-tenant
 * one by rewriting `organization_id`. 🚫 Widening the delegate below to `create`,
 * `upsert` or `delete` is the issuance path ADR-0068 §0.1c refuses by name, and
 * it would need its own ADR **and** its own migration.
 *
 * ⚠️ **IT IS `updateMany`, AND THAT IS NOT LAZINESS.** The `where` carries
 * `revokedAt: null`, so a second revocation of the same session updates ZERO
 * rows and the FIRST revocation instant survives. A plain `update` keyed on the
 * unique id cannot express that condition, and would quietly overwrite the
 * instant at which the session actually ended — the one fact an audit of a
 * stolen token needs.
 *
 * 🚫 **NO CLOCK.** `revokedAt` arrives as a parameter, so this package still
 * reads no time of its own and a test can revoke at an instant it chose.
 */

/**
 * The narrowest possible write view of the `OperatorSession` delegate.
 *
 * ⚠️ Declared STRUCTURALLY rather than imported from `@prisma/client`, the same
 * construction the read delegate uses and for the same reason: this package
 * typechecks with zero generated code and zero database.
 */
export interface OperatorSessionRevocationDelegate {
  /**
   * Marks matching, not-already-revoked rows as revoked.
   *
   * ⚠️ `data` offers `revokedAt` and NOTHING ELSE. A delegate that also accepted
   * `expiresAt` or `tokenHash` would let a caller extend or repoint a session
   * through the revocation path, which is the opposite of what it is for.
   */
  updateMany(args: {
    readonly where: { readonly sessionId: string; readonly revokedAt: null };
    readonly data: { readonly revokedAt: string };
  }): Promise<{ readonly count: number }>;
}

/**
 * What a revocation attempt actually did.
 *
 * ⚠️ **THE TWO OUTCOMES STAY TWO.** `already-ended` covers a session that was
 * revoked earlier, expired, or never existed in this scope — and it is 🚫 NOT an
 * error: a logout pressed twice, or pressed with a stale cookie, has left the
 * operator exactly where they wanted to be. Collapsing it into `revoked` would
 * report an act that did not happen; raising on it would make a harmless second
 * click look like a fault.
 *
 * 🚫 Neither outcome names the session, the account or the organization: a
 * refusal must not carry an identifier into a log (ADR-0054 D3).
 */
export type SessionRevocation = 'revoked' | 'already-ended';

/**
 * Ends one session, inside the scope it belongs to.
 *
 * 🛑 **THE ORGANIZATION IS REQUIRED AND 🚫 IT IS NOT DEFAULTED**, exactly as it is
 * on the lookup. There is no "all organizations" value and no fallback: under
 * `FORCE ROW LEVEL SECURITY` an unscoped UPDATE does not fail loudly, it matches
 * zero rows — and a logout that silently did nothing would report success while
 * leaving the token live.
 *
 * ⚠️ **THE SCOPE IS NARROWING, 🚫 NEVER GRANTING.** A caller that passed some
 * other organization's identifier does not gain the power to end that
 * organization's sessions: the caller only ever holds the scope it was
 * constructed with, and the row it names must ALSO live there. Naming a scope
 * you are not in ends nothing.
 */
export function operatorSessionRevocation(
  runner: OperatorSessionScopeRunner<OperatorSessionRevocationDelegate>,
  scope: OperatorSessionScope,
): (sessionId: string, revokedAt: string) => Promise<SessionRevocation> {
  return async (sessionId: string, revokedAt: string): Promise<SessionRevocation> =>
    runner.runInScope({ organizationId: scope.organizationId }, async (sessions) => {
      const result = await sessions.updateMany({
        where: { sessionId, revokedAt: null },
        data: { revokedAt },
      });

      return result.count > 0 ? 'revoked' : 'already-ended';
    });
}

/**
 * Ends one PLATFORM session — ADR-0083 **D5**.
 *
 * 🛑 **REVOCATION DID 🚫 NOT ACQUIRE A SECOND IMPLEMENTATION, AND §2 OF
 * ADR-0083 IS WHY THAT SENTENCE HAS TO BE CHECKED.** What is duplicated here is
 * the SCOPE a transaction opens with; the decision — *did this update match a
 * live row* — is the same one line, and the two outcomes are still the same two
 * values. ⚠️ `assessSession` in `@age/session-store` remains the only place
 * revocation is READ, for both principals, which is the drift D3 forbids.
 *
 * ⚠️ **THE PRESENTED DIGEST IS THE FIRST ARGUMENT BECAUSE IT IS THE SCOPE.** A
 * logout holds the cookie it is ending, so it holds the digest; 🚫 an operator
 * cannot end a platform session it is not presenting.
 */
export function platformOperatorSessionRevocation(
  runner: OperatorSessionScopeRunner<OperatorSessionRevocationDelegate>,
): (
  presentedTokenHash: string,
  sessionId: string,
  revokedAt: string,
) => Promise<SessionRevocation> {
  return async (
    presentedTokenHash: string,
    sessionId: string,
    revokedAt: string,
  ): Promise<SessionRevocation> =>
    runner.runInScope({ platformSessionTokenHash: presentedTokenHash }, async (sessions) => {
      const result = await sessions.updateMany({
        where: { sessionId, revokedAt: null },
        data: { revokedAt },
      });

      return result.count > 0 ? 'revoked' : 'already-ended';
    });
}
