/**
 * How an operator-authored file's JSON parse failure may be described
 * (ADR-0054 D1/D3's refusal rule, applied to the parser's own message).
 *
 * WHY THIS EXISTS. Both operator-file loaders used to splice a failed
 * `JSON.parse` message straight into their refusal. V8 does not merely say that
 * the text is invalid — it embeds A FRAGMENT OF THE SOURCE in the message, for
 * example:
 *
 *     Unexpected token 'b', ..."lientId": broken}" is not valid JSON
 *
 * For a client record file that fragment can carry the client's display name or
 * an advertising account id; for an answer file it can carry the business's own
 * words. Either lands on stderr, and this output is the thing most likely to be
 * pasted into an issue or a chat log. The loaders already state the rule — name
 * the POSITION, never the contents — and this is the one place that keeps it.
 *
 * 🚫 The parser's message is never returned, in whole or in part. Only a
 * position is extracted, and only when it is a bare number: a position cannot
 * carry a client's name.
 *
 * ⚠️ ONE IMPLEMENTATION, for the same reason the path policy has one: two
 * copies of a fail-closed rule drift silently, because the copy that gets
 * relaxed still passes its own tests.
 *
 * Pure: no clock, no I/O, no randomness. It decides about an error object.
 */

/**
 * The offset forms V8 has used across Node versions. Both capture a bare
 * integer and nothing else, so no source text can reach the result.
 */
const POSITION_PATTERNS: readonly RegExp[] = [
  /\bat position (\d+)\b/,
  /\bat line (\d+) column (\d+)\b/,
];

/**
 * Describes where a JSON parse failed, in words that cannot carry the file's
 * contents.
 *
 * Returns a trailing clause for a refusal message — `'at position 142'`, or
 * `'at an unreported position'` when the parser named none. 🚫 It never returns
 * the parser's message and never returns a fragment of the parsed text.
 *
 * ⚠️ It is deliberately NOT a general-purpose error formatter. It answers one
 * question about one kind of failure, so that a future caller cannot reach for
 * it to render an arbitrary error and reintroduce the leak elsewhere.
 */
export function describeJsonParseFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : '';

  for (const pattern of POSITION_PATTERNS) {
    const match = pattern.exec(message);
    if (match === null) {
      continue;
    }

    return match.length > 2 ? `at line ${match[1]} column ${match[2]}` : `at position ${match[1]}`;
  }

  // ⚠️ Fails closed to saying nothing about the text. An unrecognised message
  // shape must not be passed through "just this once": the shapes vary by Node
  // version, and the one that is passed through is the one that leaks.
  return 'at an unreported position';
}
