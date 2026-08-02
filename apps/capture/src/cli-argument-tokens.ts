/**
 * The argument-reading rules both of this CLI's commands obey, in ONE place.
 *
 * ⚠️ WHY THIS MODULE EXISTS AT ALL. ADR-0054 D6 adds a second command that
 * reaches the same append-only table as the first. The obvious way to build it
 * is to copy `capture-arguments.ts` and edit the flag list — and two copies of
 * one fail-closed rule drift silently, because the relaxed copy still passes its
 * own tests. (The same reasoning moved the D2 path policy into
 * `@age/operator-file-policy`; this is that lesson applied a second time.)
 *
 * PURE. No clock, no id generation, no randomness, no filesystem, no `process`.
 * Every rule below is a decision about strings.
 *
 * THE RULES, AND WHY EACH ONE REFUSES RATHER THAN GUESSES. The table these
 * commands write to is append-only, holds `GRANT SELECT, INSERT` only, and has
 * no `update`, no `delete` and no `upsert` anywhere above it, so a well-formed
 * write of the wrong data cannot be corrected through the application at all.
 * A rejected parse costs an operator one retry; an accepted guess costs a row
 * that cannot be withdrawn.
 */

export interface Tokens {
  readonly values: ReadonlyMap<string, string>;
  readonly booleans: ReadonlySet<string>;
  readonly errors: readonly string[];
}

/**
 * Splits an `argv` tail into named values and named booleans.
 *
 * Unknown flags, positionals, repeats and missing values are all errors.
 */
export function tokenize(
  argv: readonly string[],
  valueFlags: ReadonlySet<string>,
  booleanFlags: ReadonlySet<string>,
): Tokens {
  const values = new Map<string, string>();
  const booleans = new Set<string>();
  const errors: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] as string;

    if (!token.startsWith('--')) {
      errors.push(`Unexpected positional argument: ${token}. Every input is a named flag.`);
      continue;
    }

    if (booleanFlags.has(token)) {
      if (booleans.has(token)) {
        errors.push(`${token} was given more than once.`);
        continue;
      }
      booleans.add(token);
      continue;
    }

    if (!valueFlags.has(token)) {
      errors.push(`Unknown flag: ${token}.`);
      continue;
    }

    const next = argv[index + 1];
    // A flag is never another flag's value. Silently swallowing `--client-id`
    // as the value of a preceding `--profile` is how a scope argument goes
    // missing without anyone noticing.
    if (next === undefined || next.startsWith('--')) {
      errors.push(`${token} requires a value.`);
      continue;
    }

    index += 1;

    if (values.has(token)) {
      errors.push(`${token} was given more than once. Refusing to guess which value was meant.`);
      continue;
    }

    values.set(token, next);
  }

  return { values, booleans, errors };
}

/**
 * Rejects blanks, and rejects padding rather than trimming it.
 *
 * `scoredBifSnapshotScopeSchema` uses `z.string().trim()`, which would silently
 * rewrite `' client-1 '` into `client-1`. For a value that becomes part of an
 * append-only primary key that is the wrong behaviour: the operator's shell
 * history and the stored row would disagree. This CLI is not entitled to decide
 * which id was meant.
 */
export function readStrictValue(
  flag: string,
  values: ReadonlyMap<string, string>,
  errors: string[],
): string | undefined {
  const raw = values.get(flag);
  if (raw === undefined) {
    return undefined;
  }

  if (raw.trim().length === 0) {
    errors.push(`${flag} must not be blank.`);
    return undefined;
  }

  if (raw.trim() !== raw) {
    errors.push(
      `${flag} must not have leading or trailing whitespace. Refusing to trim it into a different value.`,
    );
    return undefined;
  }

  return raw;
}

/**
 * Exactly what `Date.prototype.toISOString` emits: UTC, `Z`, milliseconds
 * always present. Anything else — an offset, a bare date, second precision — is
 * refused rather than normalised, because `capturedAt` is stored as text and
 * its lexicographic order IS the series chronology (ADR-0029). Two encodings of
 * the same instant would sort against each other.
 */
const CANONICAL_UTC_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.\d{3}Z$/;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/**
 * Calendar-validates without constructing a `Date`. Not pedantry: this module
 * must stay clock-free and copy-safe under the repo's purity-guard pattern,
 * which scans module source for `new Date(`. Validation needs no clock.
 */
export function isCanonicalUtcTimestamp(value: string): boolean {
  const match = CANONICAL_UTC_TIMESTAMP.exec(value);
  if (match === null) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  if (month < 1 || month > 12) {
    return false;
  }
  if (hour > 23 || minute > 59 || second > 59) {
    return false;
  }

  const daysInMonth = month === 2 && isLeapYear(year) ? 29 : (DAYS_IN_MONTH[month - 1] as number);

  return day >= 1 && day <= daysInMonth;
}
