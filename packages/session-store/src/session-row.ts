import { SessionStoreRefusedError, type SessionRecord } from './session-record';

/**
 * A stored session row, re-validated on the way out of the database.
 *
 * 🛑 **A ROW IS UNTRUSTED INPUT.** The same rule the snapshot store lives under
 * (ADR-0031, `normalizeScoredBifSnapshotRecord`): what a query returns is a
 * shape the database happened to hold, not a fact this process established. A
 * column added, renamed or nulled by a migration nobody re-read arrives here as
 * an object that still type-checks.
 *
 * 🚫 **IT DEFAULTS, GENERATES AND INFERS NOTHING.** Every field is either
 * present and well-formed or the row is refused. A missing expiry does not
 * become "no expiry"; a missing `revokedAt` key does not become "never
 * revoked". ⚠️ Both of those absences would read as permission.
 *
 * 🚫 **IT ANSWERS NOTHING ABOUT USABILITY.** It has no clock and reaches no
 * conclusion — `assessSession` does that, against a caller's instant. This only
 * decides whether there is a row here at all.
 */

const HEX_DIGEST = /^[0-9a-f]{64}$/;

function refuse(field: string, requirement: string): never {
  // ⚠️ The message names a POSITION and a RULE (ADR-0054 D3). 🚫 It never
  // repeats the value: a digest in a log is half of a session in a log, and an
  // organization in a log is a tenant in a log.
  throw new SessionStoreRefusedError(
    `A stored session row is unreadable: \`${field}\` ${requirement}. The row is refused rather ` +
      'than repaired — a row whose fields cannot be read is a row whose session cannot be ' +
      'enforced.',
  );
}

function requiredText(row: Record<string, unknown>, field: string): string {
  const value = row[field];

  if (typeof value !== 'string' || value.trim() === '') {
    refuse(field, 'must be present and non-blank');
  }

  return value;
}

/**
 * @throws {SessionStoreRefusedError} naming the field, 🚫 never its contents.
 */
export function normalizeSessionRecord(row: unknown): SessionRecord {
  if (typeof row !== 'object' || row === null || Array.isArray(row)) {
    throw new SessionStoreRefusedError(
      'A stored session row must be an object with the session columns on it. The row is refused ' +
        'rather than repaired.',
    );
  }

  const source = row as Record<string, unknown>;

  const tokenHash = requiredText(source, 'tokenHash');
  if (!HEX_DIGEST.test(tokenHash)) {
    refuse('tokenHash', 'must be a SHA-256 digest — 64 lower-case hex characters');
  }

  const revokedAt = source['revokedAt'];
  if (revokedAt !== null && (typeof revokedAt !== 'string' || revokedAt.trim() === '')) {
    // ⚠️ `undefined` lands here on purpose. "The column was not read" must never
    // become "the session was never revoked".
    refuse('revokedAt', 'must be a timestamp, or exactly `null` while the session is live');
  }

  return {
    sessionId: requiredText(source, 'sessionId'),
    organizationId: requiredText(source, 'organizationId'),
    accountId: requiredText(source, 'accountId'),
    tokenHash,
    issuedAt: requiredText(source, 'issuedAt'),
    expiresAt: requiredText(source, 'expiresAt'),
    revokedAt,
  };
}
