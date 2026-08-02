/**
 * The onboarding command's argument parser (ADR-0054 D6).
 *
 * WHAT THIS COMMAND IS FOR, AND HOW IT DIFFERS FROM `age-capture`. The capture
 * CLI takes an already-built discovery PROFILE and an explicitly typed
 * `--client-id` / `--organization-id` pair. This command takes the two files an
 * operator actually has — an ANSWER file (ADR-0054 D1/D2) and a CLIENT RECORD
 * file (D3) — and derives everything else. That difference is the whole point
 * of D6 condition 1: _"The scope comes from a `ClientRecord` loaded per D3 —
 * never fabricated, never defaulted."_
 *
 * 🚫 THERE IS THEREFORE NO `--organization-id` FLAG. Accepting one would let an
 * operator type a scope that disagrees with the loaded record, which is the
 * fabricated scope ADR-0046 D7 was written about. The organization is read off
 * the record or the run refuses.
 *
 * 🚫 AND NO DEFAULT ANYWHERE. Not for the answer path, not for the record path,
 * not for the repository root, not for the profile id, and above all not for
 * the mode: `produceOnly` is what you get when you ask for nothing, and it opens
 * no connection at all (D6 condition 4).
 *
 * PURE. It takes an `argv` tail and returns a command description or a list of
 * errors. No clock, no id generation, no filesystem, no `process`. The shared
 * rules it applies live in `cli-argument-tokens.ts` so that this command and
 * `age-capture` cannot drift apart.
 */

import { isCanonicalUtcTimestamp, readStrictValue, tokenize } from './cli-argument-tokens';

/** What the operator asked for. Every field is exactly what they typed. */
export interface OnboardingCommand {
  /**
   * `produceOnly` unless BOTH `--capture` and `--confirm` were given. There is
   * deliberately no default that writes (ADR-0054 D6 condition 4).
   */
  readonly mode: 'produceOnly' | 'produceAndCapture';
  /** Absolute path to the operator-authored answer file (D1/D2). */
  readonly answersPath: string;
  /** Absolute path to the operator-authored client record file (D3). */
  readonly recordsPath: string;
  /**
   * Absolute path to the repository working tree both files must live OUTSIDE.
   *
   * ⚠️ A required flag rather than something derived from the process. Deriving
   * it would mean reading `cwd`, and "search the working directory" is exactly
   * what D2 forbids — the rule would then depend on where the operator happened
   * to stand when they ran the command.
   */
  readonly repositoryRoot: string;
  /** Which record in the file to use. An unknown id refuses (D3). */
  readonly clientId: string;
  /** Actor recorded on every `FieldVersion`, as an ADR-0053 D4 operator principal. */
  readonly changedBy: string;
  /** Profile identifier. The caller owns identity; the mapper invents none (ADR-0050). */
  readonly profileId: string;
  /** Left unset when not given, so the mapper applies its own `bif-<profile id>` default. */
  readonly bifId?: string;
  /** Set only when the operator pinned it; otherwise the entry point mints one. */
  readonly snapshotIdOverride?: string;
  /** Set only when the operator pinned it; otherwise the entry point reads the clock. */
  readonly capturedAtOverride?: string;
}

export type ParsedOnboardingArguments =
  | { readonly ok: true; readonly command: OnboardingCommand }
  | { readonly ok: false; readonly errors: readonly string[] };

const REQUIRED_VALUE_FLAGS = [
  '--answers',
  '--records',
  '--repository-root',
  '--client-id',
  '--changed-by',
  '--profile-id',
] as const;

const OPTIONAL_VALUE_FLAGS = ['--bif-id', '--snapshot-id', '--captured-at'] as const;

const VALUE_FLAGS: ReadonlySet<string> = new Set<string>([
  ...REQUIRED_VALUE_FLAGS,
  ...OPTIONAL_VALUE_FLAGS,
]);

const BOOLEAN_FLAGS: ReadonlySet<string> = new Set<string>(['--capture', '--confirm']);

/** Flags that only mean something once capture has actually been requested. */
const CAPTURE_ONLY_FLAGS = ['--snapshot-id', '--captured-at'] as const;

/**
 * 🚫 Refused outright rather than ignored. An operator who types
 * `--organization-id` believes they are choosing the scope; silently dropping
 * the flag would leave them believing it. The error says where the scope really
 * comes from.
 */
const DERIVED_FLAGS: ReadonlyMap<string, string> = new Map([
  [
    '--organization-id',
    'the organization is read from the client record named by --client-id, never typed',
  ],
  ['--profile', 'this command builds the profile from --answers; it does not take a built one'],
]);

export function parseOnboardingArguments(argv: readonly string[]): ParsedOnboardingArguments {
  const derived = argv.filter((token) => DERIVED_FLAGS.has(token));
  const { values, booleans, errors: tokenErrors } = tokenize(argv, VALUE_FLAGS, BOOLEAN_FLAGS);

  const errors: string[] = [
    // Reported first and by name: `tokenize` would otherwise call these
    // "Unknown flag", which reads as a typo rather than as a refusal.
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

  const answersPath = readStrictValue('--answers', values, errors);
  const recordsPath = readStrictValue('--records', values, errors);
  const repositoryRoot = readStrictValue('--repository-root', values, errors);
  const clientId = readStrictValue('--client-id', values, errors);
  const changedBy = readStrictValue('--changed-by', values, errors);
  const profileId = readStrictValue('--profile-id', values, errors);
  const bifId = readStrictValue('--bif-id', values, errors);
  const snapshotIdOverride = readStrictValue('--snapshot-id', values, errors);
  const capturedAtOverride = readStrictValue('--captured-at', values, errors);

  const requestedCapture = booleans.has('--capture');
  const confirmed = booleans.has('--confirm');

  // Echo-and-confirm, carried over from ADR-0043 D4 unchanged. The confirmation
  // is a second, separate act; `--capture` alone never writes.
  if (requestedCapture && !confirmed) {
    errors.push(
      '--capture requires --confirm, which acknowledges the echoed scope before writing.',
    );
  }
  if (confirmed && !requestedCapture) {
    errors.push('--confirm was given without --capture, so it confirms nothing.');
  }

  const capturing = requestedCapture && confirmed;

  if (!capturing) {
    for (const flag of CAPTURE_ONLY_FLAGS) {
      if (values.has(flag)) {
        errors.push(
          `${flag} is only meaningful when capture is requested with --capture --confirm.`,
        );
      }
    }
  }

  if (capturedAtOverride !== undefined && !isCanonicalUtcTimestamp(capturedAtOverride)) {
    errors.push(
      `--captured-at must be a canonical ISO-8601 UTC instant with milliseconds, e.g. 2026-07-30T12:34:56.789Z. Received: ${capturedAtOverride}`,
    );
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    command: {
      mode: capturing ? 'produceAndCapture' : 'produceOnly',
      answersPath: answersPath as string,
      recordsPath: recordsPath as string,
      repositoryRoot: repositoryRoot as string,
      clientId: clientId as string,
      changedBy: changedBy as string,
      profileId: profileId as string,
      ...(bifId === undefined ? {} : { bifId }),
      ...(snapshotIdOverride === undefined ? {} : { snapshotIdOverride }),
      ...(capturedAtOverride === undefined ? {} : { capturedAtOverride }),
    },
  };
}
