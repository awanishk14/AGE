/**
 * The capture CLI's argument parser (ADR-0043 D4/D5/D7, Slice B1).
 *
 * PURE. It takes an `argv` tail and returns either a command description or a
 * list of errors. No clock, no id generation, no randomness, no filesystem, no
 * `process`, no writing to a stream, no `process.exit`. Everything that touches
 * the outside world — reading the profile file, minting `snapshotId`, reading
 * the capture instant, printing, exiting — belongs to the entry point
 * (ADR-0043 D5, Slice B2). This module only decides what was asked for.
 *
 * WHY IT IS THIS STRICT. The table this CLI ultimately writes to is
 * append-only, holds `GRANT SELECT, INSERT` only, and has no `update`, no
 * `delete` and no `upsert` anywhere above it. A well-formed write of the wrong
 * data therefore cannot be corrected or removed through the application at all,
 * and under `FORCE ROW LEVEL SECURITY` it is not readily discoverable
 * afterwards from the scope that should have received it. So every ambiguity
 * here is an error rather than a guess: unknown flags, positionals, repeats and
 * missing values are all refused. A rejected parse costs an operator one retry.
 *
 * D4 is honest about what this does NOT close: the operator is still trusted.
 * A correctly-formatted but wrong `--client-id` yields a correctly-scoped write
 * of the wrong client's data. Format validation plus echo-and-`--confirm`
 * reduce the fat-finger case; only an authenticated caller closes the gap.
 *
 * THE RULES THEMSELVES LIVE IN `cli-argument-tokens.ts`, shared with the D6
 * onboarding command. Two copies of one fail-closed rule drift silently,
 * because the relaxed copy still passes its own tests.
 */

import { isCanonicalUtcTimestamp, readStrictValue, tokenize } from './cli-argument-tokens';

/** What the operator asked for. Every field is exactly what they typed. */
export interface CaptureCommand {
  /**
   * `produceOnly` unless BOTH `--capture` and `--confirm` were given. There is
   * deliberately no default that writes (ADR-0043 D7, ADR-0040 D7).
   */
  readonly mode: 'produceOnly' | 'produceAndCapture';
  /** Path to the discovery profile JSON. Resolved and read by the entry point (D3). */
  readonly profilePath: string;
  /** Authoritative scope, from explicit arguments — never inferred (ADR-0030). */
  readonly clientId: string;
  /** Authoritative scope, from explicit arguments — never inferred (ADR-0030). */
  readonly organizationId: string;
  /** Actor recorded on every `FieldVersion`. Discovery has no actor of its own. */
  readonly changedBy: string;
  /** Left unset when not given, so the mapper applies its own `bif-<profile id>` default. */
  readonly bifId?: string;
  /** Set only when the operator pinned it; otherwise the entry point mints one (D5). */
  readonly snapshotIdOverride?: string;
  /** Set only when the operator pinned it; otherwise the entry point reads the clock (D5). */
  readonly capturedAtOverride?: string;
}

export type ParsedCaptureArguments =
  | { readonly ok: true; readonly command: CaptureCommand }
  | { readonly ok: false; readonly errors: readonly string[] };

const REQUIRED_VALUE_FLAGS = [
  '--profile',
  '--client-id',
  '--organization-id',
  '--changed-by',
] as const;

const OPTIONAL_VALUE_FLAGS = ['--bif-id', '--snapshot-id', '--captured-at'] as const;

const VALUE_FLAGS: ReadonlySet<string> = new Set<string>([
  ...REQUIRED_VALUE_FLAGS,
  ...OPTIONAL_VALUE_FLAGS,
]);

const BOOLEAN_FLAGS: ReadonlySet<string> = new Set<string>(['--capture', '--confirm']);

/** Flags that only mean something once capture has actually been requested. */
const CAPTURE_ONLY_FLAGS = ['--snapshot-id', '--captured-at'] as const;

export function parseCaptureArguments(argv: readonly string[]): ParsedCaptureArguments {
  const { values, booleans, errors: tokenErrors } = tokenize(argv, VALUE_FLAGS, BOOLEAN_FLAGS);
  const errors: string[] = [...tokenErrors];

  // Every missing required flag is reported, not just the first — one retry per
  // invocation, not one per flag.
  for (const flag of REQUIRED_VALUE_FLAGS) {
    if (!values.has(flag)) {
      errors.push(`${flag} is required.`);
    }
  }

  const profilePath = readStrictValue('--profile', values, errors);
  const clientId = readStrictValue('--client-id', values, errors);
  const organizationId = readStrictValue('--organization-id', values, errors);
  const changedBy = readStrictValue('--changed-by', values, errors);
  const bifId = readStrictValue('--bif-id', values, errors);
  const snapshotIdOverride = readStrictValue('--snapshot-id', values, errors);
  const capturedAtOverride = readStrictValue('--captured-at', values, errors);

  const requestedCapture = booleans.has('--capture');
  const confirmed = booleans.has('--confirm');

  // Echo-and-confirm (D4 mitigation 2). The confirmation is a second, separate
  // act; `--capture` alone never writes.
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
      profilePath: profilePath as string,
      clientId: clientId as string,
      organizationId: organizationId as string,
      changedBy: changedBy as string,
      ...(bifId === undefined ? {} : { bifId }),
      ...(snapshotIdOverride === undefined ? {} : { snapshotIdOverride }),
      ...(capturedAtOverride === undefined ? {} : { capturedAtOverride }),
    },
  };
}
