import { createHash, timingSafeEqual } from 'node:crypto';

import {
  acceptVerifiedPlatformSession,
  acceptVerifiedSession,
  SessionRefusedError,
  type VerifiedPlatformSession,
  type VerifiedSession,
} from '@age/entitlement';

/**
 * ADR-0061 **A2** — the session store's rules, and nothing that performs them.
 *
 * 🛑 **WHAT A2 ACTUALLY REQUIRES, AND WHY EACH HALF MATTERS.** Sessions live as
 * rows the server can revoke — 🚫 **never a bearer token the client holds and
 * replays past revocation**. A self-contained token (a JWT with claims inside)
 * stays valid until it expires no matter what the server decides afterwards, so
 * "log this person out" becomes a wish. The session here is an **opaque
 * reference**: the client holds a random string that means nothing, and every
 * fact about the session is read from the row on each use.
 *
 * 🚫 **THE RAW TOKEN IS NEVER STORED.** Only its digest is. A stolen database
 * dump then yields no usable session, which is the one property that survives
 * the operator no longer physically holding the machine (A5).
 *
 * ⚠️ **SHA-256 HERE, 🚫 NOT argon2id, AND THE REASON IS NOT COST.** A2 names
 * argon2id *"if a credential provider is used at all"* — that is for a **password**,
 * which is low-entropy and must be made slow to guess. A session token is
 * 🚫 not a password: it is minted by the server with 256 bits of randomness, so
 * there is nothing to brute-force and a slow hash would only make every request
 * slow. ⚠️ Using argon2id here and a fast hash on a password is the mistake this
 * paragraph exists to prevent; the token's ENTROPY is what makes the fast digest
 * correct, which is why `assertSessionTokenShape` refuses a short one.
 *
 * 🚫 **AGE'S OWN CODE NEVER COMPARES A PASSWORD** (A2). Nothing here verifies a
 * credential; verification belongs to the authentication layer, and this package
 * only recognises a session that layer already minted.
 *
 * 🚫 **NO ROLE, NO `isAdmin`, NO PERMISSION LIST** on a session record — ADR-0062
 * D3, admin is never a bypass, and a flag on the session is exactly how a bypass
 * arrives: the check that reads it is added later, by someone who did not read
 * the ADR.
 *
 * 🚫 **THIS PACKAGE PERFORMS NO EFFECT.** It has no clock — `now` is a parameter,
 * because a session that decides its own expiry from an ambient clock cannot be
 * tested against the minute it matters. It has no randomness: minting a token is
 * an effect and belongs to a composition root. It opens no database. Its one
 * `node:crypto` import is a pure digest, and a guard pins it to that.
 */

/** Raised when a token or a stored row cannot be used as a session. */
export class SessionStoreRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionStoreRefusedError';
  }
}

/**
 * 32 bytes, hex-encoded. ⚠️ The floor is the whole basis for the fast digest
 * above: 🚫 lower it and SHA-256 stops being the right choice.
 */
export const SESSION_TOKEN_HEX_LENGTH = 64;

const HEX_TOKEN = /^[0-9a-f]{64}$/;

/**
 * Refuses anything that is not a full-entropy session token.
 *
 * @throws {SessionStoreRefusedError} 🚫 naming neither the token nor any prefix
 *         of it — a token in a log is a live session in a log.
 */
export function assertSessionTokenShape(token: string): string {
  if (!HEX_TOKEN.test(token)) {
    throw new SessionStoreRefusedError(
      `A session token must be ${SESSION_TOKEN_HEX_LENGTH} lower-case hex characters — 32 bytes ` +
        'of randomness from the server. An allow-list, not a length check: a value that is not ' +
        'this shape was not minted here, and its entropy is what makes a fast digest correct.',
    );
  }

  return token;
}

/**
 * The digest stored in the row.
 *
 * ⚠️ One-way, deterministic, and 🚫 never reversible into the token. The shape is
 * asserted FIRST, so a guessable value cannot acquire the appearance of a
 * session by being hashed.
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(assertSessionTokenShape(token), 'utf8').digest('hex');
}

/**
 * ⚠️ Constant-time. Two digests differing in their first byte must take the same
 * time to reject as two differing in their last, or the comparison itself leaks
 * the answer one byte at a time.
 */
export function sessionTokenHashesMatch(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');

  // 🚫 `timingSafeEqual` throws on a length mismatch, and the lengths here are
  // not secret — both are SHA-256 hex. Comparing lengths first is safe and is
  // not the leak the function exists to prevent.
  return a.length === b.length && timingSafeEqual(a, b);
}

/** A stored session row, as it comes back out of the database. */
export interface SessionRecord {
  readonly sessionId: string;
  /**
   * The tenant this session speaks for, or 🛑 **exactly `null` for a PLATFORM
   * session** — ADR-0083 D1, option B.
   *
   * 🚫 **`null` IS A PRINCIPAL, 🚫 NOT A MISSING VALUE.** `normalizeSessionRecord`
   * accepts `null` and refuses `undefined`, because "the column was not read"
   * becoming "this session belongs to no tenant" would silently promote a
   * tenant operator to the widest scope AGE has.
   */
  readonly organizationId: string | null;
  readonly accountId: string;
  /** 🚫 The digest, never the token. */
  readonly tokenHash: string;
  /** ISO-8601. Recorded for audit (A6 item 6); it decides nothing. */
  readonly issuedAt: string;
  /**
   * ISO-8601, and 🛑 **REQUIRED**. There is no "never expires": an absolute
   * expiry is the one control that still works when nobody notices a session
   * was stolen.
   */
  readonly expiresAt: string;
  /** ISO-8601 once revoked. `null` while live. 🚫 Never removed from the row. */
  readonly revokedAt: string | null;
}

/**
 * Why a session may not be used. ⚠️ Each arm is a DIFFERENT fact, kept apart on
 * purpose: "revoked" is a decision someone made and "expired" is time passing,
 * and an audit trail that cannot tell them apart cannot answer the question it
 * exists for.
 */
export type SessionAssessment =
  | { readonly usable: true; readonly principal: SessionPrincipal }
  | { readonly usable: false; readonly reason: 'revoked' | 'expired' | 'unreadable' };

/**
 * Who a usable row speaks for — ADR-0083 **D1, option B**.
 *
 * 🛑 **A DISCRIMINATED UNION SO NO CONSUMER CAN FORGET TO ASK.** A caller that
 * reached for `.session.organizationId` on a platform principal would not
 * silently read `undefined`; it does not type-check, because
 * `VerifiedPlatformSession` has 🚫 no such field. That is the whole of why
 * option A was refused: an absent organization must be UNREPRESENTABLE, 🚫 not
 * defended against at every comparison.
 *
 * ⚠️ **THE SHARING IS ABOVE THIS.** Expiry and revocation are decided BEFORE a
 * principal is constructed, so both arms are governed by exactly one
 * implementation of each (D3) — 🚫 not by two that agree today.
 */
export type SessionPrincipal =
  | { readonly scope: 'tenant'; readonly session: VerifiedSession }
  | { readonly scope: 'platform'; readonly session: VerifiedPlatformSession };

const isoInstant = (value: string): number | undefined => {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

/**
 * Decides whether a stored row may still speak for its organization.
 *
 * 🛑 **THE ONLY WAY A `SessionRecord` BECOMES A `VerifiedSession`.** A row is
 * untrusted input — it is re-validated on read, exactly as a stored snapshot is
 * (ADR-0031). 🚫 There is no other constructor, so no code path can hold a
 * session that was never checked against the clock.
 *
 * ⚠️ **REVOCATION IS CHECKED BEFORE EXPIRY**, and the order is load-bearing: a
 * revoked session that has also expired must report `revoked`, because "we shut
 * this down" is the fact an operator asked about.
 *
 * @param now the caller's instant. 🚫 Never read here — see the module note.
 */
export function assessSession(record: SessionRecord, now: Date): SessionAssessment {
  const revokedAt = record.revokedAt === null ? undefined : isoInstant(record.revokedAt);
  const expiresAt = isoInstant(record.expiresAt);
  const at = now.getTime();

  // 🚫 An unreadable timestamp is never "probably fine". A row whose expiry
  // cannot be read is a row whose expiry cannot be enforced.
  if (expiresAt === undefined || (record.revokedAt !== null && revokedAt === undefined)) {
    return { usable: false, reason: 'unreadable' };
  }

  if (revokedAt !== undefined && revokedAt <= at) {
    return { usable: false, reason: 'revoked' };
  }

  if (expiresAt <= at) {
    return { usable: false, reason: 'expired' };
  }

  // 🛑 EVERYTHING ABOVE THIS LINE IS SHARED BY BOTH PRINCIPALS, and everything
  // below it is only the construction of an identity. ⚠️ A platform session is
  // 🚫 NOT exempt from expiry or revocation, and the way that is guaranteed is
  // that it never had its own copy of either check to drift from.
  try {
    return {
      usable: true,
      principal:
        record.organizationId === null
          ? {
              scope: 'platform',
              session: acceptVerifiedPlatformSession({
                sessionId: record.sessionId,
                accountId: record.accountId,
              }),
            }
          : {
              scope: 'tenant',
              session: acceptVerifiedSession({
                sessionId: record.sessionId,
                organizationId: record.organizationId,
                accountId: record.accountId,
              }),
            },
    };
  } catch (error) {
    // ⚠️ A blank identifier is refused by `acceptVerifiedSession` for a reason
    // that survives here: two absences would compare equal and be read as an
    // authorization. 🚫 It is reported as unreadable, never as usable.
    if (error instanceof SessionRefusedError) {
      return { usable: false, reason: 'unreadable' };
    }

    throw error;
  }
}

export { SessionRefusedError };
export type { VerifiedPlatformSession, VerifiedSession };
