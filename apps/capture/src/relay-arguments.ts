/**
 * The relay command's argument parser (ADR-0069 D3/D7).
 *
 * WHAT THIS COMMAND IS FOR. `relaySourceObservation` deliberately records
 * nothing — a relay carries, it does not keep — and `apps/mcp` opens no
 * database at all (ADR-0055 D6). So until this command existed there was no way
 * for an observation to reach the store, which means ADR-0069 D7 — *two
 * producers or the demonstration does not count* — had no implementation. This
 * is the operator's own act, performed out of band, exactly as the first
 * capture write was required to be.
 *
 * 🚫 THERE IS NO `--organization-id` FLAG, and typing one is refused BY NAME.
 * The scope comes from the client record named by `--client-id` and from
 * nowhere else. An observation whose provenance asserts a different scope is
 * refused by the runner rather than written under the typed one.
 *
 * 🚫 AND NOTHING ABOUT THE OBSERVATION IS TYPED. Not the source system, not the
 * subject, not the period, not the identity AGE will give it, and not the
 * instant AGE recorded it. Every one of those is either in the operator's
 * observation file, or minted by the entry point. A flag that let an operator
 * type any of them would let a relay say something the source never said.
 *
 * 🚫 ONE OBSERVATION PER INVOCATION, AND THERE IS NO BULK ARM. `--all` and
 * `--directory` are refused by name for the same reason `relaySourceObservation`
 * has no second parameter: a bulk arm is how fifty thousand rows arrive, and
 * this signature is most of what stands between AGE and a data warehouse.
 *
 * PURE. It takes an `argv` tail and returns a command description or a list of
 * errors. No clock, no id generation, no filesystem, no `process`. The shared
 * token rules live in `cli-argument-tokens.ts`.
 */

import { readStrictValue, tokenize } from './cli-argument-tokens';

/** What the operator asked for. Every field is exactly what they typed. */
export interface RelayCommand {
  /**
   * `assessOnly` unless BOTH `--append` and `--confirm` were given. There is
   * deliberately no default that writes — the same echo-and-confirm the
   * onboarding command carries (ADR-0043 D4, ADR-0054 D6 condition 4).
   */
  readonly mode: 'assessOnly' | 'appendConfirmed';
  /** Absolute path to the operator-authored client record file (ADR-0054 D3). */
  readonly recordsPath: string;
  /**
   * Absolute path to the repository working tree the operator's files must live
   * OUTSIDE. Required rather than derived, because deriving it means reading
   * `cwd` and the rule would then depend on where the operator stood.
   */
  readonly repositoryRoot: string;
  /** Which record in the file to use. An unknown id refuses (ADR-0054 D3). */
  readonly clientId: string;
  /**
   * Which BIF the observation is assessed against. ⚠️ Admissibility is BY
   * SUBJECT (ADR-0069 D4), and the subjects AGE models come from the stored
   * context — so the series has to be named.
   */
  readonly bifId: string;
  /** Absolute path to the operator's file holding ONE observation envelope. */
  readonly observationPath: string;
}

export type ParsedRelayArguments =
  | { readonly ok: true; readonly command: RelayCommand }
  | { readonly ok: false; readonly errors: readonly string[] };

const REQUIRED_VALUE_FLAGS = [
  '--records',
  '--repository-root',
  '--client-id',
  '--bif-id',
  '--observation',
] as const;

const VALUE_FLAGS: ReadonlySet<string> = new Set<string>(REQUIRED_VALUE_FLAGS);

/**
 * ⚠️ `--append` is this command's `--capture`. A DIFFERENT WORD ON PURPOSE:
 * `--capture` writes a snapshot of what the business said, and this writes what
 * a source claimed. An operator who has typed one should not be able to reach
 * for it here out of muscle memory and get the other.
 */
const BOOLEAN_FLAGS: ReadonlySet<string> = new Set<string>(['--append', '--confirm']);

/**
 * 🚫 Refused outright rather than ignored. An operator who types one of these
 * believes they are supplying it; silently dropping the flag would leave them
 * believing it. Each message says where the thing really comes from, or why it
 * cannot be asked for here.
 */
const DERIVED_FLAGS: ReadonlyMap<string, string> = new Map([
  [
    '--organization-id',
    'the organization is read from the client record named by --client-id, never typed',
  ],
  [
    '--source-system',
    'the source system is read from the observation’s own provenance; a typed one could attribute a claim to a product that never made it',
  ],
  [
    '--observation-id',
    'AGE mints its own identity for an observation; the source’s own id travels in the observation as provenance.sourceRecordId',
  ],
  [
    '--recorded-at',
    'the recorded instant is the clock at the moment AGE recorded it, never typed — a typed one could hide how long an observation sat before it arrived',
  ],
  [
    '--subject',
    'the subject is read from the observation; supplying one here would let a relay name a subject the source never named',
  ],
  ['--all', 'this command relays ONE observation per invocation; there is no bulk arm'],
  [
    '--directory',
    'this command relays ONE observation per invocation; a directory input is a bulk arm by another name',
  ],
]);

export function parseRelayArguments(argv: readonly string[]): ParsedRelayArguments {
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

  const recordsPath = readStrictValue('--records', values, errors);
  const repositoryRoot = readStrictValue('--repository-root', values, errors);
  const clientId = readStrictValue('--client-id', values, errors);
  const bifId = readStrictValue('--bif-id', values, errors);
  const observationPath = readStrictValue('--observation', values, errors);

  const requestedAppend = booleans.has('--append');
  const confirmed = booleans.has('--confirm');

  // Echo-and-confirm. The confirmation is a SECOND, SEPARATE act: `--append`
  // alone never writes, and `--confirm` alone confirms nothing.
  if (requestedAppend && !confirmed) {
    errors.push(
      '--append requires --confirm, which acknowledges the echoed scope and the assessed observation before writing.',
    );
  }
  if (confirmed && !requestedAppend) {
    errors.push('--confirm was given without --append, so it confirms nothing.');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    command: {
      mode: requestedAppend && confirmed ? 'appendConfirmed' : 'assessOnly',
      recordsPath: recordsPath as string,
      repositoryRoot: repositoryRoot as string,
      clientId: clientId as string,
      bifId: bifId as string,
      observationPath: observationPath as string,
    },
  };
}
