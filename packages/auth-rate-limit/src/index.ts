/**
 * `@age/auth-rate-limit` — ADR-0061 **A6 item 4**, rate limiting **on the
 * authentication path specifically**.
 *
 * 🛑 **TWO COUNTERS, AND NEITHER IS REDUNDANT.** Per subject stops guessing one
 * credential; per source stops spraying one guess across many accounts. Removing
 * either because "the other covers it" re-opens the attack it covered.
 *
 * ⚠️ **THE REFUSAL IS IDENTICAL WHETHER THE SUBJECT EXISTS OR NOT** — otherwise
 * the limiter is an account-enumeration oracle.
 *
 * 🚫 **NO ALLOW-LIST, NO TRUSTED SOURCE, NO BYPASS.** 🚫 It counts failures, not
 * requests: signing in correctly costs nothing.
 *
 * Pure: attempts and `now` arrive as parameters. 🚫 It stores nothing and has no
 * caller — the store and the wiring are the deployment composition's slice.
 */

export {
  ATTEMPT_WINDOW_SECONDS,
  judgeAuthenticationAttempt,
  MAXIMUM_FAILURES_PER_SOURCE,
  MAXIMUM_FAILURES_PER_SUBJECT,
  type AttemptSubjectKey,
  type AuthenticationRateVerdict,
  type FailedAttempt,
} from './auth-rate-limit';
