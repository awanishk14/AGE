/**
 * How a failure from the DATABASE DRIVER is described on stderr.
 *
 * WHY THIS EXISTS. A driver's message is not a sentence about the driver — it
 * is frequently a rendering of the arguments it was given. Prisma's validation
 * class prints the whole `data` argument, which on the capture path is the
 * serialized `ScoredBifContext`: a real business's facts in its own words. The
 * CLI's output is the thing most likely to be pasted into an issue or a chat
 * log, so the message is never printed. The driver's NAME says what went wrong
 * without saying what was being written; its `code`, when there is one, is the
 * part an operator can actually look up.
 *
 * ⚠️ ONE IMPLEMENTATION, shared by `runCapture` and `runOnboarding`, for the
 * same reason the operator-file path and JSON rules have one each: two copies
 * of a fail-closed rule drift silently, because the copy that gets relaxed
 * still passes its own tests. This module exists precisely because the second
 * caller appeared.
 *
 * 🚫 It is deliberately NOT a general-purpose error formatter, and 🚫 a stack is
 * never rendered — its frames hold the connection string.
 *
 * Pure: no clock, no I/O, no randomness. It decides about an error object.
 */

/**
 * Names a driver failure without quoting it.
 *
 * Returns `'PrismaClientValidationError (P2002)'` when the driver supplied a
 * non-empty string `code`, the error's `name` alone otherwise, and a fixed
 * phrase for a thrown non-`Error` — which could be any value at all, including
 * the payload.
 */
export const driverFailureLabelOf = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return 'the driver reported a non-Error failure';
  }

  const code = (error as { code?: unknown }).code;

  return typeof code === 'string' && code.length > 0 ? `${error.name} (${code})` : error.name;
};
