/**
 * WHEN the source observed, and over what window.
 *
 * 🛑 **THIS PACKAGE HAS NO CLOCK.** Every instant here is supplied by the
 * caller, as an ISO-8601 string, and is 🚫 never defaulted to "now". A defaulted
 * `observedAt` would make an observation relayed today look like an observation
 * made today, which is exactly the lie an operator-mediated relay is most likely
 * to tell — the relay happens days after the observation, by construction.
 *
 * Pure: no clock, no ids, no randomness, no I/O.
 */

export interface ObservationPeriod {
  /** When the SOURCE observed it. 🚫 Not when AGE received it. */
  readonly observedAt: string;
  /** The window the observation covers — inclusive start, inclusive end. */
  readonly windowStart: string;
  readonly windowEnd: string;
}

/**
 * ⚠️ Validation here is SHAPE only: a parseable instant and a non-inverted
 * window. 🚫 It does not check that the window is recent, plausible, or
 * non-overlapping with another observation. AGE is not the authority on when a
 * peer product looked at its own data, and pretending otherwise would reject
 * true observations to enforce a guess.
 */
export function isParseableInstant(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}([T ].*)?$/.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

export function isWindowOrdered(period: Readonly<ObservationPeriod>): boolean {
  return Date.parse(period.windowStart) <= Date.parse(period.windowEnd);
}
