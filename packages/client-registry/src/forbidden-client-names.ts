import { createHash } from 'node:crypto';

/**
 * The operator's live client names, as DIGESTS — so the guard that keeps them
 * out of the repository does not itself spell them out (ADR-0053 D3).
 *
 * WHY THIS EXISTS. The guard used to hold the names as plain strings. That made
 * the rule's own statement the leak it was written to prevent: a committed file
 * naming the operator's live clients, findable by `git grep`, by GitHub code
 * search and by anything that indexes the repository.
 *
 * ⚠️ WHAT THIS DOES AND DOES NOT BUY. It removes the names from the readable
 * surface of the repository — search, review, casual reading. It is 🚫 NOT
 * secrecy: a company name is low-entropy, so anyone holding both this file and
 * a candidate name can confirm the match by hashing it, exactly as the guard
 * does. Treat it as removing an advertisement, never as encryption.
 *
 * 🚫 IT DOES NOT REWRITE HISTORY. The names remain in earlier commits. Removing
 * them going forward is worth doing on its own terms; claiming they are gone
 * would be false.
 *
 * ⚠️ Normalisation is deliberately aggressive — lowercase, then every character
 * that is not a letter or a digit removed — so ONE digest covers spaced,
 * hyphenated and run-together spellings without listing the variants. The scan
 * applies the SAME normalisation to the text it examines, which is why a
 * spelling nobody anticipated is still caught.
 *
 * ⚠️ This paragraph used to illustrate that with the real spellings, and the
 * guard below failed on this very file. Left as a note because it is the proof
 * the guard is not vacuous: an explanation of the rule is 🚫 not an exemption
 * from it.
 */

/** Lowercase, then strip everything that is not a letter or a digit. */
export function normalizeForForbiddenScan(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function digestOf(normalized: string): string {
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * One entry per live client. `length` is the normalised length, which the scan
 * needs to know how wide a window to hash — 🚫 it is not a hint about spelling
 * and must never be accompanied by one.
 */
export interface ForbiddenNameDigest {
  readonly length: number;
  readonly sha256: string;
}

/**
 * Build an entry from a name.
 *
 * ⚠️ THE ONE WAY ENTRIES ARE MADE, so the list and the scan can never disagree
 * about normalisation. 🚫 Never call this with a real client name anywhere the
 * call itself would be committed — run it once, paste the result.
 */
export function forbiddenNameDigestOf(name: string): ForbiddenNameDigest {
  const normalized = normalizeForForbiddenScan(name);
  return Object.freeze({ length: normalized.length, sha256: digestOf(normalized) });
}

/**
 * 🚫 DO NOT ADD A COMMENT NAMING WHICH CLIENT AN ENTRY IS FOR. The whole point
 * of the digest is that this file does not carry the name.
 *
 * ⚠️ To add a client, run the two lines the test `derives a digest the same way
 * the list was built` demonstrates, and paste the result.
 */
export const FORBIDDEN_CLIENT_NAME_DIGESTS: readonly ForbiddenNameDigest[] = Object.freeze([
  Object.freeze({
    length: 5,
    sha256: '63b2dfca747f921594a6c95fe1c4925a76bf1e678fd5c343c1585818cc381c26',
  }),
  Object.freeze({
    length: 12,
    sha256: 'e9a9bccc0e4c7ac542fa8568300a8b1e39f1e86219230847d1415b0ad3a4dd19',
  }),
]);

/**
 * Whether `text` contains any forbidden client name, in any spelling that
 * normalises to the same thing.
 *
 * ⚠️ A SLIDING WINDOW, not an equality check. The name has to be caught inside
 * a larger document — a fixture file, a serialized record — so every substring
 * of the right length is hashed. The inputs here are source files of a few
 * kilobytes, so the cost is irrelevant and the alternative (holding the name to
 * call `.includes()`) is the thing being removed.
 *
 * 🚫 It returns a boolean and never the matched text: returning the match would
 * put the name into a test failure message, and a failing CI log is public.
 */
export function containsForbiddenClientName(text: string): boolean {
  return containsAnyNameDigest(text, FORBIDDEN_CLIENT_NAME_DIGESTS);
}

/**
 * The scan itself, over a digest list the CALLER supplies.
 *
 * ⚠️ Separated from `containsForbiddenClientName` for one reason: the mechanism
 * has to be provable. A test that fed a real forbidden name to the real list
 * would reintroduce exactly the leak this module removes, so the mechanism is
 * proved against digests the test builds from an obviously fictional name, and
 * the real list is checked only for shape.
 */
export function containsAnyNameDigest(
  text: string,
  digests: readonly ForbiddenNameDigest[],
): boolean {
  const normalized = normalizeForForbiddenScan(text);

  for (const { length, sha256 } of digests) {
    if (normalized.length < length) {
      continue;
    }
    for (let start = 0; start + length <= normalized.length; start += 1) {
      if (digestOf(normalized.slice(start, start + length)) === sha256) {
        return true;
      }
    }
  }

  return false;
}
