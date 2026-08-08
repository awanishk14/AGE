/**
 * The inspect command's argument parser (ADR-0055 D1).
 *
 * WHAT THIS COMMAND IS FOR. `onboard` writes a snapshot; nothing in AGE has
 * ever read one back. ADR-0054 D7 states the falsification test as a stored row
 * the operator can *look at*, and until this command existed the second half of
 * that sentence had no implementation. The row written on 2026-08-08 is the
 * first thing it is run against — ADR-0055 D7 forbids building it any earlier,
 * and 🚫 forbids seeding a row to get there sooner.
 *
 * 🚫 THERE IS NO `--organization-id` FLAG, and typing one is refused BY NAME
 * rather than as "Unknown flag", which reads as a typo instead of as a refusal.
 * The scope comes from `toClientContext(record)` and from nowhere else (D1). A
 * reader that accepted a typed scope would let an operator ask for rows in a
 * scope no record of theirs describes — and RLS would happily agree, because it
 * checks a row against the scope it was *asked* for, never against an
 * entitlement (D9).
 *
 * 🚫 AND NO DEFAULT ANYWHERE — not for the record path, not for the repository
 * root, not for the client, not for the BIF. `--snapshot-id` is the one
 * optional flag: without it the command asks for the latest member of the
 * series, which is a different question, not a defaulted one.
 *
 * PURE. It takes an `argv` tail and returns a command description or a list of
 * errors. No clock, no id generation, no filesystem, no `process`. The shared
 * token rules live in `cli-argument-tokens.ts` so this command and the two
 * writing ones cannot drift apart.
 */

import { readStrictValue, tokenize } from './cli-argument-tokens';

/** What the operator asked for. Every field is exactly what they typed. */
export interface InspectCommand {
  /** Absolute path to the operator-authored client record file (ADR-0054 D3). */
  readonly recordsPath: string;
  /**
   * Absolute path to the repository working tree the record must live OUTSIDE.
   *
   * ⚠️ A required flag rather than something derived from the process, for the
   * same reason as `onboard`: deriving it would mean reading `cwd`, and
   * "search the working directory" is exactly what ADR-0054 D2 forbids.
   */
  readonly repositoryRoot: string;
  /** Which record in the file to use. An unknown id refuses (ADR-0054 D3). */
  readonly clientId: string;
  /** Which series to read. The BIF whose snapshots are being asked about. */
  readonly bifId: string;
  /**
   * Set only when the operator pinned one member of the series. Left unset
   * means "the latest in this series" — 🚫 not a default snapshot, a different
   * question.
   */
  readonly snapshotId?: string;
}

export type ParsedInspectArguments =
  | { readonly ok: true; readonly command: InspectCommand }
  | { readonly ok: false; readonly errors: readonly string[] };

const REQUIRED_VALUE_FLAGS = ['--records', '--repository-root', '--client-id', '--bif-id'] as const;

const OPTIONAL_VALUE_FLAGS = ['--snapshot-id'] as const;

const VALUE_FLAGS: ReadonlySet<string> = new Set<string>([
  ...REQUIRED_VALUE_FLAGS,
  ...OPTIONAL_VALUE_FLAGS,
]);

/**
 * 🚫 EMPTY ON PURPOSE. A reader has no mode, nothing to confirm and nothing to
 * request: `--capture` and `--confirm` are not merely unsupported here, they
 * have no meaning, and `tokenize` refusing them as unknown is the correct
 * reading. Declaring them so they could be rejected "properly" would put the
 * two tokens that authorize a write into the parser of the command that must
 * never perform one (D3).
 */
const BOOLEAN_FLAGS: ReadonlySet<string> = new Set<string>();

/**
 * 🚫 Refused outright rather than ignored. An operator who types
 * `--organization-id` believes they are choosing the scope; silently dropping
 * the flag would leave them believing it. Each message says where the thing
 * really comes from, or why it cannot be asked for here.
 */
const DERIVED_FLAGS: ReadonlyMap<string, string> = new Map([
  [
    '--organization-id',
    'the organization is read from the client record named by --client-id, never typed',
  ],
  ['--capture', 'this command only reads; it has no write path to request'],
  ['--confirm', 'this command only reads, so there is nothing to confirm'],
]);

export function parseInspectArguments(argv: readonly string[]): ParsedInspectArguments {
  const derived = argv.filter((token) => DERIVED_FLAGS.has(token));
  const { values, errors: tokenErrors } = tokenize(argv, VALUE_FLAGS, BOOLEAN_FLAGS);

  const errors: string[] = [
    ...derived.map(
      (flag) => `${flag} is not accepted here — ${DERIVED_FLAGS.get(flag) as string}.`,
    ),
    ...tokenErrors.filter((error) => !derived.some((flag) => error === `Unknown flag: ${flag}.`)),
  ];

  // Every missing required flag is reported, not just the first — one retry per
  // invocation, not one per flag.
  for (const flag of REQUIRED_VALUE_FLAGS) {
    if (!values.has(flag)) {
      errors.push(`${flag} is required.`);
    }
  }

  const recordsPath = readStrictValue('--records', values, errors);
  const repositoryRoot = readStrictValue('--repository-root', values, errors);
  const clientId = readStrictValue('--client-id', values, errors);
  const bifId = readStrictValue('--bif-id', values, errors);
  const snapshotId = readStrictValue('--snapshot-id', values, errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    command: {
      recordsPath: recordsPath as string,
      repositoryRoot: repositoryRoot as string,
      clientId: clientId as string,
      bifId: bifId as string,
      ...(snapshotId === undefined ? {} : { snapshotId }),
    },
  };
}
