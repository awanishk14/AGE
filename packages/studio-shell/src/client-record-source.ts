/**
 * Where the console's client records come from — decided here, read elsewhere.
 *
 * The CLI takes the operator's record-file path as an explicit argument
 * (ADR-0054 D3). The console has no argv, so its equivalent is an environment
 * variable the operator sets when they start it. That is still the operator
 * supplying the path in their own words; it is NOT a default.
 *
 * 🚫 There is no fallback path, no search of the working directory, and no
 * "conventional location". ADR-0054 D2 refuses relative paths precisely because
 * resolving one reads `cwd`, and a console started from a different directory
 * would then read a different operator's file without saying so.
 *
 * ⚠️ Unset is NOT empty. A console with no configured path has not looked at
 * anything, and the screen must say that — rendering an empty list would be the
 * unlooked-at-absence-as-measured-zero failure this product exists to refuse.
 */

/** The variable the operator sets to point the console at their record file. */
export const CLIENT_RECORD_FILE_VARIABLE = 'AGE_CLIENT_RECORD_FILE';

export type ClientRecordSource =
  /**
   * The operator has not told the console where their records are. ⚠️ This is
   * "not assessed", never "no businesses".
   */
  | { readonly kind: 'not-configured'; readonly variable: string }
  /** The operator supplied a path. It is still validated before it is opened. */
  | { readonly kind: 'configured'; readonly path: string };

/**
 * Decide the record source from the operator's environment.
 *
 * Pure: the environment is passed in, never read here, so this stays testable
 * and `apps/studio` keeps every effect in one named module.
 *
 * ⚠️ A blank or whitespace-only value is treated as NOT CONFIGURED rather than
 * as a path. An empty string would otherwise reach the path policy and be
 * refused with a message about path shape, hiding the real cause: the operator
 * never set it.
 */
export function resolveClientRecordSource(
  environment: Readonly<Record<string, string | undefined>>,
): ClientRecordSource {
  const raw = environment[CLIENT_RECORD_FILE_VARIABLE];

  if (raw === undefined || raw.trim() === '') {
    return Object.freeze({ kind: 'not-configured', variable: CLIENT_RECORD_FILE_VARIABLE });
  }

  // ⚠️ Not trimmed into a path. A path with surrounding whitespace is the
  // operator's typo, and silently repairing it means opening a file they did
  // not name. The value is passed through exactly as given.
  return Object.freeze({ kind: 'configured', path: raw });
}
