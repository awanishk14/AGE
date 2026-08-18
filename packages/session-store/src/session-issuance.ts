import { hashSessionToken, SessionStoreRefusedError, type SessionRecord } from './session-record';
import { sessionExpiryFrom } from './session-lifetime';

/**
 * ADR-0079 §3, slice 2 of §6 — **THE ROW A SESSION IS ISSUED AS.**
 *
 * 🛑 **WHAT ADR-0079 OVERTURNED, AND ONLY THIS.** "AGE mints nothing" became
 * *"AGE may issue a session after verifying an external identity"*. That is one
 * refusal, answered by the Product Owner in ADR-0079 §0.2, and 🚫 it is not a
 * general licence: provisioning an ACCOUNT is still a human act, and the
 * `accounts` and `account_memberships` tables hold `GRANT SELECT` alone.
 *
 * 🚫 **NOTHING HERE MINTS A TOKEN, AND THAT IS THE SPLIT THAT MATTERS.** The
 * token arrives as a PARAMETER, already minted, because randomness is an effect
 * and effects live at one composition root per app (slice 3). This module only
 * decides what the row must LOOK like — which is why a test can issue a session
 * at an instant it chose, with a token it wrote down, and get a byte-identical
 * row every time.
 *
 * 🛑 **THE RAW TOKEN NEVER LEAVES THIS FUNCTION.** It is hashed on the way in,
 * and the returned row carries the digest only. A caller that wants to hand the
 * token to a browser already had it; 🚫 nothing downstream can recover it from
 * what is returned, which is the property that makes a stolen database dump
 * useless.
 *
 * 🚫 **THE ROW CARRIES NO SCOPE, NO BUNDLE AND NO PERMISSION LIST** (ADR-0062
 * D3). A session says WHO is asking. What they may reach is read from
 * `account_memberships` on every request — ADR-0079 §2 — so a membership
 * withdrawn a minute ago takes effect on the next request rather than the next
 * sign-in. Putting it on the session here would undo that in one field.
 *
 * Pure: no clock, no randomness, no I/O. `issuedAt` and `token` are given.
 */

/** What the caller must already know before a session can exist. */
export interface SessionIssuanceRequest {
  readonly sessionId: string;
  readonly organizationId: string;
  readonly accountId: string;
  /**
   * ⚠️ The RAW token, and the only place in AGE one is accepted. It is hashed
   * immediately and 🚫 never returned, logged or echoed in a refusal.
   */
  readonly token: string;
  /** The instant the caller decided the session begins. 🚫 Not a clock read. */
  readonly issuedAt: Date;
  readonly lifetimeSeconds: number;
}

/**
 * Builds the row that issues a session.
 *
 * ⚠️ **`revokedAt` IS `null`, WRITTEN OUT.** Not omitted, not defaulted by the
 * database — "this session has not been ended" is a fact the issuing act
 * asserts, and a column the database filled in is a fact the database invented.
 *
 * 🛑 **THE EXPIRY IS COMPUTED HERE AND 🚫 NEVER SUPPLIED.** A caller that could
 * pass `expiresAt` could pass one in the year 3000, and the ceiling in
 * `session-lifetime.ts` would be advice. Passing a LIFETIME instead means every
 * session that exists went through those bounds.
 *
 * @throws {SessionStoreRefusedError} for a token that was not minted here, a
 *         lifetime outside the fixed bounds, an unreadable issuing instant, or
 *         a blank identifier — naming the POSITION and 🚫 never the value.
 */
export function issuedSessionRecord(request: SessionIssuanceRequest): SessionRecord {
  const sessionId = acceptIdentifier('sessionId', request.sessionId);
  const organizationId = acceptIdentifier('organizationId', request.organizationId);
  const accountId = acceptIdentifier('accountId', request.accountId);

  // ⚠️ Both of these refuse before anything is built. `hashSessionToken` runs
  // the token through `assertSessionTokenShape`, so a value that was not minted
  // as 32 bytes of hex cannot become a session at all.
  const expiresAt = sessionExpiryFrom(request.issuedAt, request.lifetimeSeconds);
  const tokenHash = hashSessionToken(request.token);

  return Object.freeze({
    sessionId,
    organizationId,
    accountId,
    tokenHash,
    issuedAt: request.issuedAt.toISOString(),
    expiresAt,
    revokedAt: null,
  });
}

/**
 * ⚠️ A blank identifier is REFUSED rather than stored. An empty
 * `organizationId` on a session is a session belonging to no tenant, and under
 * a fail-closed policy it would simply never match anything again — a session
 * that exists, cannot be used, and cannot be explained.
 */
function acceptIdentifier(field: string, value: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new SessionStoreRefusedError(
      `A session cannot be issued with a blank ${field}. It names the POSITION and never the ` +
        'value: a refusal that prints an identifier has put one into a log.',
    );
  }

  return value;
}
