import { normalizeSessionRecord } from './session-row';
import {
  SessionStoreRefusedError,
  assessSession,
  hashSessionToken,
  type VerifiedSession,
} from './session-record';

/**
 * Verification of a **presented** token — ADR-0068 §0.1b, the last thing slice 7
 * owed.
 *
 * 🛑 **VERIFICATION IS NOT ISSUANCE, AND HERE THAT HOLDS BY SHAPE.** This module
 * mints nothing, writes nothing and provisions nobody. It takes a token someone
 * already holds, hashes it, and asks the store whether a row matches — the store
 * itself grants AGE `SELECT` and nothing else, so there is no INSERT for a
 * future "just for the first one" helper to reach for. Provisioning the second
 * operator remains an ACT performed out of band (§0.1c refuses every
 * provisioning surface by name).
 *
 * ⚠️ **THE SHAPE IS CHECKED BEFORE THE STORE IS TOUCHED**, and that ordering is
 * testable rather than asserted: a caller can pass a lookup that throws if
 * called, exactly as `@age/entitled-read` proves a denial precedes its query. A
 * value that was never minted here must not become a database round trip.
 *
 * 🚫 **THE FOUR FAILURES STAY FOUR** — `malformed-token`, `no-such-session`,
 * `revoked`, `expired` — plus `unreadable` for a row that cannot be read at all.
 * Collapsing them into one "invalid" would destroy the only facts an operator
 * asks for afterwards: *was this token never ours*, or *did we shut it down*, or
 * *did it simply run out*. ⚠️ 🚫 The distinction is for AGE's own record; what a
 * caller is told is the transport's decision, not this module's.
 *
 * 🚫 **NOTHING HERE IS AN AUTHORIZATION.** A verified session says WHO is
 * asking. What they may do is `askEntitlement`, always, afterwards.
 *
 * Pure: no clock (the instant is a parameter), no ids, no randomness, no I/O —
 * the lookup is injected, so this module never learns what a database is.
 */

export type SessionVerification =
  | { readonly outcome: 'verified'; readonly session: VerifiedSession }
  | {
      readonly outcome: 'unverified';
      readonly reason: 'malformed-token' | 'no-such-session' | 'revoked' | 'expired' | 'unreadable';
    };

export interface PresentedTokenVerification {
  /** The token as presented. 🚫 Never logged, never echoed, never defaulted. */
  readonly presentedToken: string;
  /**
   * Reads at most one stored row by its digest.
   *
   * ⚠️ **IT IS A PARAMETER SO THAT IT CAN BE PROVEN NOT TO HAVE RUN.** It
   * receives the DIGEST and never the token, so an adapter cannot log the
   * credential even by accident.
   */
  readonly findRowByTokenHash: (tokenHash: string) => Promise<unknown>;
  /** The caller's instant. 🚫 This module has no clock of its own. */
  readonly now: Date;
}

const unverified = (reason: Extract<SessionVerification, { outcome: 'unverified' }>['reason']) =>
  Object.freeze({ outcome: 'unverified' as const, reason });

/**
 * Verifies a presented token against the session store.
 *
 * 🚫 It never throws for an ordinary failure: an unverified token is an ANSWER,
 * and an exception would tempt a caller into a catch-all that treats every
 * failure as the same thing.
 */
export async function verifyPresentedSessionToken(
  input: PresentedTokenVerification,
): Promise<SessionVerification> {
  let tokenHash: string;

  try {
    // 🛑 NOTHING BELOW HAS RUN YET. A token that was not minted here never
    // reaches the store.
    tokenHash = hashSessionToken(input.presentedToken);
  } catch (error) {
    if (error instanceof SessionStoreRefusedError) return unverified('malformed-token');
    throw error;
  }

  const row = await input.findRowByTokenHash(tokenHash);

  if (row === null || row === undefined) {
    // ⚠️ 🚫 NOT "expired" and 🚫 NOT "revoked". AGE has no row, which is a
    // different fact from having one it has decided against.
    return unverified('no-such-session');
  }

  let record;
  try {
    // ⚠️ The stored row is UNTRUSTED INPUT, re-validated on read, exactly as
    // every other store in this repository treats one.
    record = normalizeSessionRecord(row);
  } catch (error) {
    if (error instanceof SessionStoreRefusedError) return unverified('unreadable');
    throw error;
  }

  const assessment = assessSession(record, input.now);

  // 🚫 `assessSession` is the ONLY way a record becomes a `VerifiedSession`, and
  // this module does not add a second. Revocation is checked before expiry
  // there, and that order is preserved by not re-deciding it here.
  return assessment.usable
    ? Object.freeze({ outcome: 'verified' as const, session: assessment.session })
    : unverified(assessment.reason);
}
