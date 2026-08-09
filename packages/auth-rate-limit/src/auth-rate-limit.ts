/**
 * ADR-0061 **A6 item 4** — rate limiting **on the authentication path
 * specifically**, as a decision.
 *
 * ⚠️ **THE ADR SAYS "SPECIFICALLY" FOR A REASON.** A general limit sized for
 * ordinary browsing — a few hundred requests a minute — is no limit at all on a
 * sign-in form, where a hundred guesses a minute is a successful attack. The
 * authentication path needs its own budget, in its own units, and this is it.
 *
 * 🛑 **TWO COUNTERS, BECAUSE EITHER ALONE IS BYPASSABLE.**
 *
 * - **Per subject.** Stops guessing one account's credential many times. On its
 *   own it is bypassed by *spraying*: one guess against each of a thousand
 *   accounts trips no per-account counter anywhere.
 * - **Per source.** Stops one origin making many attempts across many accounts.
 *   On its own it is bypassed by distributing the attempts across many origins.
 *
 * Neither counter is redundant, and 🚫 removing one because "the other covers
 * it" is the mistake this comment exists to prevent.
 *
 * ⚠️ **THE REFUSAL IS IDENTICAL WHETHER THE SUBJECT EXISTS OR NOT**, and the
 * subject arrives as an opaque key that this module never interprets. A limiter
 * that answers faster, or differently, for an unknown account has turned itself
 * into an account-enumeration oracle — the attacker stops guessing credentials
 * and starts harvesting the list of who has one.
 *
 * 🚫 **THERE IS NO ALLOW-LIST, NO BYPASS AND NO TRUSTED SOURCE.** "Except from
 * the office IP" is a rule that outlives the office, and an address is claimed
 * by whoever sends the packet.
 *
 * ⚠️ **IT COUNTS FAILURES, NOT REQUESTS.** A successful sign-in clears nothing
 * and costs nothing: an operator who signs in correctly ten times in a morning
 * is not an attack, and a limiter that punishes them is a limiter that gets
 * raised until it stops working.
 *
 * Pure: attempts and `now` both arrive as parameters. 🚫 It stores nothing,
 * reads no clock and evicts nothing — the store is a caller's problem.
 */

/** 🚫 Opaque. This module never parses, resolves or reveals it. */
export type AttemptSubjectKey = string;

/** One failed authentication attempt, as recorded. */
export interface FailedAttempt {
  /** ⚠️ Opaque — an account key, never an address, a name or an email. */
  readonly subjectKey: AttemptSubjectKey;
  /** The origin the attempt arrived from, as the deployment observed it. */
  readonly sourceKey: string;
  /** When it failed, ISO-8601. */
  readonly failedAt: string;
}

export type AuthenticationRateVerdict =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly reason: 'too-many-attempts';
      readonly retryAfterSeconds: number;
    };

/** Fifteen minutes. Long enough to make guessing pointless, short enough to survive. */
export const ATTEMPT_WINDOW_SECONDS = 15 * 60;

/** 🚫 Not configurable. Five wrong passwords in a quarter of an hour is not a typo. */
export const MAXIMUM_FAILURES_PER_SUBJECT = 5;

/**
 * 🚫 Not configurable. Deliberately looser than the per-subject limit — a whole
 * office behind one address is ordinary, a hundred failures from it is not.
 */
export const MAXIMUM_FAILURES_PER_SOURCE = 30;

interface JudgeAuthenticationAttemptInput {
  /** ⚠️ Recent failures. The caller may pass more than the window; this filters. */
  readonly recentFailures: readonly FailedAttempt[];
  readonly subjectKey: AttemptSubjectKey;
  readonly sourceKey: string;
  readonly now: Date;
}

function withinWindow(failures: readonly FailedAttempt[], now: Date): readonly FailedAttempt[] {
  const floor = now.getTime() - ATTEMPT_WINDOW_SECONDS * 1000;

  return failures.filter((failure) => {
    const at = new Date(failure.failedAt).getTime();

    // ⚠️ An unreadable timestamp COUNTS. Discarding it would make a corrupt row
    // a way to buy attempts, and the safe reading of "I cannot tell when this
    // happened" is "recently".
    return Number.isNaN(at) ? true : at > floor;
  });
}

/**
 * The seconds until the oldest counted failure leaves the window.
 *
 * ⚠️ Rounded UP, and never below one: a `Retry-After: 0` invites an immediate
 * retry, which is the loop being refused.
 */
function retryAfterFor(counted: readonly FailedAttempt[], now: Date): number {
  const instants = counted
    .map((failure) => new Date(failure.failedAt).getTime())
    .filter((at) => !Number.isNaN(at));

  if (instants.length === 0) return ATTEMPT_WINDOW_SECONDS;

  const oldest = Math.min(...instants);
  const remaining = (oldest + ATTEMPT_WINDOW_SECONDS * 1000 - now.getTime()) / 1000;

  return Math.max(1, Math.min(ATTEMPT_WINDOW_SECONDS, Math.ceil(remaining)));
}

/**
 * Whether this authentication attempt may proceed.
 *
 * ⚠️ Says nothing about whether the credential is right, whether the subject
 * exists, or whether anything is authorized. 🚫 It is not a login.
 */
export function judgeAuthenticationAttempt(
  input: JudgeAuthenticationAttemptInput,
): AuthenticationRateVerdict {
  const counted = withinWindow(input.recentFailures, input.now);

  const forSubject = counted.filter((failure) => failure.subjectKey === input.subjectKey);
  if (forSubject.length >= MAXIMUM_FAILURES_PER_SUBJECT) {
    return {
      allowed: false,
      reason: 'too-many-attempts',
      retryAfterSeconds: retryAfterFor(forSubject, input.now),
    };
  }

  const forSource = counted.filter((failure) => failure.sourceKey === input.sourceKey);
  if (forSource.length >= MAXIMUM_FAILURES_PER_SOURCE) {
    return {
      allowed: false,
      reason: 'too-many-attempts',
      retryAfterSeconds: retryAfterFor(forSource, input.now),
    };
  }

  return { allowed: true };
}
