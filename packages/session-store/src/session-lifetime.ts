import { SessionStoreRefusedError } from './session-record';

/**
 * ADR-0061 **A2/A6** — how long a session may live, decided in one place.
 *
 * 🛑 **THERE IS NO "STAY SIGNED IN FOREVER".** An absolute ceiling is the only
 * control that still works in the case that matters: nobody has noticed the
 * session was stolen, so nobody is going to revoke it. Revocation handles the
 * incidents someone spots; the ceiling handles the ones nobody does.
 *
 * 🚫 **THE CEILING IS NOT CONFIGURABLE FROM THE ENVIRONMENT.** A number read
 * from a variable is a number somebody raises at 2am to stop being logged out,
 * and it never comes back down. A longer session is a decision, which means an
 * ADR and a code change.
 *
 * Pure: it takes an instant, and 🚫 never reads a clock of its own.
 */

/** Twelve hours. A working day, and then the operator signs in again. */
export const MAXIMUM_SESSION_LIFETIME_SECONDS = 12 * 60 * 60;

/** One minute. Below this a session is a mistake, not a policy. */
export const MINIMUM_SESSION_LIFETIME_SECONDS = 60;

/**
 * The absolute instant a session issued now must not outlive.
 *
 * @throws {SessionStoreRefusedError} for a lifetime outside the fixed bounds, or
 *         an unreadable issuing instant.
 */
export function sessionExpiryFrom(issuedAt: Date, lifetimeSeconds: number): string {
  const issued = issuedAt.getTime();

  if (Number.isNaN(issued)) {
    throw new SessionStoreRefusedError(
      'A session cannot be issued at an unreadable instant: its expiry would be unreadable too, ' +
        'and an expiry that cannot be read cannot be enforced.',
    );
  }

  if (!Number.isInteger(lifetimeSeconds)) {
    throw new SessionStoreRefusedError(
      'A session lifetime must be a whole number of seconds. A fractional or non-numeric ' +
        'lifetime is a configuration mistake, and this refuses it rather than rounding it into ' +
        'something nobody chose.',
    );
  }

  if (
    lifetimeSeconds < MINIMUM_SESSION_LIFETIME_SECONDS ||
    lifetimeSeconds > MAXIMUM_SESSION_LIFETIME_SECONDS
  ) {
    throw new SessionStoreRefusedError(
      `A session lifetime must be between ${MINIMUM_SESSION_LIFETIME_SECONDS} and ` +
        `${MAXIMUM_SESSION_LIFETIME_SECONDS} seconds. There is no override: a session that ` +
        'outlives the ceiling is the one nobody will revoke, because nobody will know it exists.',
    );
  }

  return new Date(issued + lifetimeSeconds * 1000).toISOString();
}
