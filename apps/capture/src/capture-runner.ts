import type { BusinessDiscoveryCaptureResult } from '@age/business-discovery-capture';
import { BusinessDiscoveryScoredBifCaptureOrchestrator } from '@age/business-discovery-capture';
import { ClientContext } from '@age/capability-kit';
import type { ScoredBifSnapshotCaptureOrchestrator } from '@age/scored-bif-snapshot-persistence';

import { parseCaptureArguments, type CaptureCommand } from './capture-arguments';
import { parseBusinessDiscoveryProfileDocument } from './capture-profile-input';
import { driverFailureLabelOf } from './driver-failure-label';

/**
 * The capture CLI's run logic (ADR-0043 D2/D3/D4/D5, Slice B2).
 *
 * PURE, BY INJECTION. This module reads no clock, mints no id, opens no file,
 * touches no `process`, constructs no `PrismaClient` and prints nothing. It
 * takes an `argv` tail and a `CaptureRuntime` of effects, and it returns the
 * exit code and the lines that should be written. `main.ts` — and only
 * `main.ts` — supplies the real effects (ADR-0043 D5: the clock and the id
 * source live in the entry point and nowhere else).
 *
 * WHY THE SEAM IS HERE. The alternative is an entry point that reads a file,
 * reads a clock, mints an id, builds a five-layer chain, decides an exit code
 * and writes to two streams, all in one function that no test can drive. The
 * whole of the decision-making is above the effects, so all of it is testable
 * without a database and without a filesystem; what is left below is a
 * transcription so short that reading it is a sufficient review.
 *
 * ONE INSTANT, NOT TWO. `constructedAt` (which the mapper stamps on every
 * `FieldVersion`) and `capturedAt` (which IS the series chronology, ADR-0029)
 * are both taken from a single `runtime.now()` call. Calling a clock twice would
 * let one invocation's BIF claim to predate its own snapshot.
 */

/** The effects the run needs, none of which it performs itself. */
export interface CaptureRuntime {
  /**
   * Reads the profile document as text. THROWS when the path cannot be read —
   * that is a real failure with an external cause and is reported as one, never
   * defaulted into an empty document.
   */
  readonly readProfileText: (path: string) => string;
  /** The single instant of this invocation. Called exactly once per run. */
  readonly now: () => Date;
  /** Mints a `snapshotId` when the operator did not pin one (ADR-0030 D4). */
  readonly newSnapshotId: () => string;
  /**
   * Builds the ADR-0043 D6 chain, on demand.
   *
   * A function, not a value, because `produceOnly` must not construct a
   * `PrismaClient` at all: producing a context is pure work that has no business
   * opening a database connection, and a CLI that connects in order to decline
   * to write is a CLI whose safe mode still needs credentials.
   */
  readonly openCaptureOrchestrator: () => Promise<CaptureConnection>;
}

/** A live capture chain and the means to shut it down again. */
export interface CaptureConnection {
  readonly orchestrator: ScoredBifSnapshotCaptureOrchestrator;
  readonly close: () => Promise<void>;
}

export interface CaptureRunResult {
  readonly exitCode: number;
  readonly stdout: readonly string[];
  readonly stderr: readonly string[];
}

/**
 * Distinct codes, so a wrapper script can tell an operator mistake from a
 * database problem without parsing English.
 */
export const CAPTURE_EXIT_CODES = {
  ok: 0,
  invalidArguments: 2,
  profileUnreadable: 3,
  invalidProfile: 4,
  captureFailed: 5,
} as const;

const failure = (exitCode: number, stdout: readonly string[], errors: readonly string[]) => ({
  exitCode,
  stdout,
  stderr: errors,
});

/**
 * The echo half of D4's echo-and-`--confirm` mitigation.
 *
 * Printed on every run, including `produceOnly`, because the value of an echo
 * is that the operator has already seen the same shape before the run that
 * writes. It names what a wrong id would cost: the destination table is
 * append-only and holds `GRANT SELECT, INSERT` only, so a well-formed write of
 * the wrong client's data cannot be corrected or removed through the
 * application at all.
 */
const echoScope = (command: CaptureCommand): readonly string[] => [
  `mode:            ${command.mode}`,
  `clientId:        ${command.clientId}`,
  `organizationId:  ${command.organizationId}`,
  `changedBy:       ${command.changedBy}`,
  `profile:         ${command.profilePath}`,
  ...(command.bifId === undefined ? [] : [`bifId:           ${command.bifId}`]),
];

const summarize = (result: BusinessDiscoveryCaptureResult): readonly string[] => [
  `bifId:           ${result.context.bifId}`,
  `bifStatus:       ${result.context.bifStatus}`,
  `confidenceScore: ${result.context.bifConfidenceScore}`,
  `completeness:    ${result.context.bifCompletenessScore}`,
  `sections:        ${result.context.metadata.presentSectionCount} present, ${result.context.metadata.omittedSectionCount} omitted`,
];

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export async function runCapture(
  argv: readonly string[],
  runtime: CaptureRuntime,
): Promise<CaptureRunResult> {
  const parsed = parseCaptureArguments(argv);

  if (!parsed.ok) {
    return failure(CAPTURE_EXIT_CODES.invalidArguments, [], parsed.errors);
  }

  const command = parsed.command;
  const echoed = echoScope(command);

  let text: string;
  try {
    text = runtime.readProfileText(command.profilePath);
  } catch (error: unknown) {
    return failure(CAPTURE_EXIT_CODES.profileUnreadable, echoed, [
      `Could not read ${command.profilePath}: ${messageOf(error)}`,
    ]);
  }

  const document = parseBusinessDiscoveryProfileDocument(text, command.profilePath);

  if (!document.ok) {
    return failure(CAPTURE_EXIT_CODES.invalidProfile, echoed, document.errors);
  }

  const instant = runtime.now();
  const clientContext = new ClientContext(command.clientId, command.organizationId);
  const mapping = {
    constructedAt: instant,
    changedBy: command.changedBy,
    ...(command.bifId === undefined ? {} : { bifId: command.bifId }),
  };

  if (command.mode === 'produceOnly') {
    // No connection is opened, so no `PrismaClient` is constructed. The pure
    // half of this CLI runs with no database at all.
    const orchestrator = new BusinessDiscoveryScoredBifCaptureOrchestrator();
    const result = await orchestrator.execute({
      mode: 'produceOnly',
      clientContext,
      profile: document.profile,
      mapping,
    });

    return {
      exitCode: CAPTURE_EXIT_CODES.ok,
      stdout: [...echoed, ...summarize(result), 'capture:         not requested'],
      stderr: [],
    };
  }

  const connection = await runtime.openCaptureOrchestrator();

  let result: BusinessDiscoveryCaptureResult;
  try {
    result = await new BusinessDiscoveryScoredBifCaptureOrchestrator(
      connection.orchestrator,
    ).execute({
      mode: 'produceAndCapture',
      clientContext,
      profile: document.profile,
      mapping,
      snapshotId: command.snapshotIdOverride ?? runtime.newSnapshotId(),
      capturedAt: command.capturedAtOverride ?? instant.toISOString(),
    });
  } finally {
    // Always released, including when `execute` throws — an unreleased pool
    // keeps the process alive after the run has already ended.
    await connection.close();
  }

  if (result.capture.kind !== 'captured') {
    const detail =
      result.capture.kind === 'failed'
        ? driverFailureLabelOf(result.capture.error)
        : 'capture was not attempted';

    return failure(
      CAPTURE_EXIT_CODES.captureFailed,
      [...echoed, ...summarize(result)],
      [`Capture failed: ${detail}`],
    );
  }

  const receipt = result.capture.receipt;

  return {
    exitCode: CAPTURE_EXIT_CODES.ok,
    stdout: [
      ...echoed,
      ...summarize(result),
      'capture:         captured',
      `snapshotId:      ${receipt.snapshotId}`,
      `capturedAt:      ${receipt.capturedAt}`,
    ],
    stderr: [],
  };
}
