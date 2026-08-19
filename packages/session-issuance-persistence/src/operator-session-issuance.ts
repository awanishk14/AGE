import { issuedSessionRecord, type SessionIssuanceRequest } from '@age/session-store';
import type {
  OperatorSessionScope,
  OperatorSessionScopeRunner,
} from '@age/session-store-persistence';

/**
 * ADR-0079 §3, slice 2 of §6 — **THE ONE MODULE IN AGE THAT ISSUES A SESSION.**
 *
 * 🛑 **WHY THIS IS A PACKAGE OF ITS OWN AND NOT A FILE NEXT DOOR.**
 * `@age/session-store-persistence` is guarded, densely, by tests that ban
 * `create`, `upsert` and `delete` in EVERY file of that package including the
 * revocation module, and that ban is the shape of *"AGE can end a session it
 * never issued, and it still cannot issue one"*. ADR-0079 overturned that
 * refusal for ONE act. Amending those guards to admit `create` would relax them
 * for eight files to authorize one — and 🚫 the copy that gets relaxed still
 * passes its own tests. So the read package keeps every ban it has, unweakened,
 * and the single authorized write lives here, alone, in a package whose entire
 * surface is that write.
 *
 * 🛑 **THE GUARD IS PRODUCT-WIDE, 🚫 NOT PACKAGE-WIDE.** "Issuance exists at
 * exactly one named module" is a property of the PRODUCT, so it is asserted by
 * the walk over `packages` and `apps` together that closed PRs #377/#378. ⚠️ A
 * narrow scan is not a narrow rule.
 *
 * 🚫 **IT MINTS NOTHING AND READS NO CLOCK.** The token and the issuing instant
 * both arrive as parameters, so this package has no randomness and no time of
 * its own; `@age/session-store` hashes the token and computes the expiry, and
 * this module never sees either decision. Minting the token is an effect and
 * belongs to the composition root — slice 3.
 *
 * 🚫 **IT PROVISIONS NOTHING.** `accounts` and `account_memberships` hold
 * `GRANT SELECT` and nothing else. This module can start a session for an
 * account that already exists; 🚫 it cannot bring one into existence, and the
 * database would refuse it if it tried.
 */

/**
 * The narrowest possible write view of the `OperatorSession` delegate.
 *
 * ⚠️ Declared STRUCTURALLY rather than imported from `@prisma/client`, the same
 * construction every other persistence package here uses and for the same
 * reason: this package typechecks with zero generated code and zero database.
 *
 * 🛑 **`create` AND NOTHING ELSE.** No `update`, no `upsert`, no `delete`, no
 * `createMany`, no `findUnique`. Reading a session is
 * `@age/session-store-persistence`; ending one is its revocation module; and
 * `upsert` in particular is refused BY NAME here, because "create it, or
 * overwrite it if it exists" is an issuance path and a re-pointing path wearing
 * one verb.
 */
export interface OperatorSessionIssuanceDelegate {
  create(args: {
    readonly data: {
      readonly sessionId: string;
      readonly organizationId: string;
      readonly accountId: string;
      readonly tokenHash: string;
      readonly issuedAt: string;
      readonly expiresAt: string;
      readonly revokedAt: null;
    };
  }): Promise<unknown>;
}

/**
 * What issuing produced.
 *
 * 🚫 **IT DOES NOT CARRY THE TOKEN BACK.** The caller minted it and already has
 * it; returning it here would put a live credential into every intermediate
 * value between this module and the browser. 🚫 It does not carry the digest
 * either — nothing downstream has a use for it that is not a lookup, and a
 * lookup takes the token.
 */
export interface IssuedSession {
  readonly sessionId: string;
  readonly expiresAt: string;
}

/**
 * Issues one session, inside the scope it will belong to.
 *
 * 🛑 **THE ORGANIZATION IS REQUIRED AND 🚫 NOT DEFAULTED**, exactly as on the
 * lookup and the revocation. The `FOR INSERT … WITH CHECK` policy compares the
 * row against `age.organization_id`, so an unscoped transaction does not write
 * an unscoped session — the insert is REFUSED. ⚠️ That refusal is loud, unlike
 * the unscoped UPDATE which merely matches zero rows, and it is why the policy
 * is written with `WITH CHECK` rather than left to the grant alone.
 *
 * ⚠️ **THE SCOPE NARROWS, 🚫 NEVER GRANTS.** A caller cannot issue a session
 * into another organization by naming it: the row must satisfy the scope the
 * transaction was already opened with.
 */
export function operatorSessionIssuance(
  runner: OperatorSessionScopeRunner<OperatorSessionIssuanceDelegate>,
  scope: OperatorSessionScope,
): (request: SessionIssuanceRequest) => Promise<IssuedSession> {
  return async (request: SessionIssuanceRequest): Promise<IssuedSession> => {
    // ⚠️ Built BEFORE the transaction opens, so a token that was not minted here
    // or a lifetime past the ceiling refuses without ever reaching a connection.
    const record = issuedSessionRecord(request);

    // 🛑 **THIS PATH ISSUES A TENANT SESSION, AND ADR-0083 MADE THAT WORTH
    // SAYING OUT LOUD.** A record's organization may now be `null` — a PLATFORM
    // principal (D1). This runner opens its transaction with
    // `age.organization_id`, so a `null` row could only be written by pretending
    // it belonged to the scope that was already open, which is exactly the
    // substitution ADR-0082 D4 forbids. ⚠️ It is REFUSED here rather than
    // re-scoped; the platform issuance path is its own slice, with its own
    // digest fence (D5) — 🚫 it is not this one relaxed.
    if (record.organizationId === null) {
      throw new SessionIssuanceRefusedError(
        'Refused: a session that belongs to no organization cannot be issued through the ' +
          'tenant-scoped path. It is refused rather than filed under the scope this ' +
          'transaction happens to hold, because that would record a tenant nobody named.',
      );
    }

    // ⚠️ Bound to a local because a property narrowing does not survive into the
    // callback below — and a `!` there would be the assertion, 🚫 not the check.
    const organizationId: string = record.organizationId;

    if (organizationId !== scope.organizationId) {
      throw new SessionIssuanceRefusedError(
        'Refused: a session cannot be issued into an organization this caller is not scoped ' +
          'to. It is refused rather than re-scoped to the caller, because silently moving the ' +
          'row would issue a session nobody asked for to a tenant nobody named.',
      );
    }

    await runner.runInScope({ organizationId: scope.organizationId }, async (sessions) => {
      await sessions.create({
        data: {
          sessionId: record.sessionId,
          organizationId,
          accountId: record.accountId,
          tokenHash: record.tokenHash,
          issuedAt: record.issuedAt,
          expiresAt: record.expiresAt,
          revokedAt: null,
        },
      });
    });

    return Object.freeze({ sessionId: record.sessionId, expiresAt: record.expiresAt });
  };
}

/** Raised when a session may not be issued as asked. */
export class SessionIssuanceRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionIssuanceRefusedError';
  }
}
