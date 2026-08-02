import type { BusinessDiscoveryCaptureResult } from '@age/business-discovery-capture';
import { BusinessDiscoveryScoredBifCaptureOrchestrator } from '@age/business-discovery-capture';
import type { DiscoveryAnswer } from '@age/business-discovery-contracts';
import {
  DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  buildProfileFromAnswers,
} from '@age/business-discovery-contracts';
import type { ClientContext } from '@age/capability-kit';
import type { OperatorPrincipal } from '@age/client-registry';
import {
  loadClientRecordFile,
  parseOperatorPrincipal,
  requireClientRecord,
  toClientContext,
} from '@age/client-registry';
import { loadDiscoveryAnswerFile } from '@age/discovery-answer-file';

import type { CaptureConnection } from './capture-runner';
import { driverFailureLabelOf } from './driver-failure-label';
import { parseOnboardingArguments, type OnboardingCommand } from './onboarding-arguments';

/**
 * The onboarding run — a real client's answers, end to end (ADR-0054 D6).
 *
 * THIS IS THE FIRST PLACE IN AGE WHERE THE FOUR PIECES MEET: an operator's
 * answer file (D1/D2), an operator's client record file (D3), the
 * transcribing answers→profile mapper (ADR-0050) and the ADR-0043 D6 capture
 * chain. Everything below already existed and was already tested; what did not
 * exist was a path along which a real business's own words could reach a stored
 * row. D7 states the falsification test in advance: the slice succeeds if and
 * only if a real client's answers, in a file outside the repository, produce a
 * stored scored-BIF snapshot under a scope derived from a real `ClientRecord`.
 *
 * PURE, BY INJECTION — the same seam as `capture-runner.ts`. This module reads
 * no clock, mints no id, opens no file, touches no `process`, constructs no
 * `PrismaClient` and prints nothing. It takes an `argv` tail and an
 * `OnboardingRuntime` of effects and returns an exit code and lines.
 *
 * ⚠️ D6'S FIVE CONDITIONS, AND WHERE EACH ONE ACTUALLY LIVES — because a
 * condition that lives only in the ADR holds only until the first tired evening:
 *
 *   1. Scope from a loaded `ClientRecord`. Here: the only source of
 *      `ClientContext` below is `toClientContext(record)`, and there is no
 *      `--organization-id` flag to fabricate one with.
 *   2. A local database the operator controls. In `local-database-target.ts`,
 *      asserted above `new PrismaClient(` — a non-loopback host refuses.
 *   3. Explicitly requested with the target named. `--capture --confirm`, after
 *      the scope has been echoed.
 *   4. `produceOnly` remains the default and opens no connection at all. Here:
 *      the `produceOnly` branch never calls `openCaptureOrchestrator`.
 *   5. No background execution, no scheduling, no automation. Here: this
 *      function runs once, in the foreground, and returns.
 *
 * 🚫 ADR-0046 D7 IS NOT REPEALED. Outside these five conditions it is still the
 * rule, unchanged; D6 is a conditional permission, not a general authorization
 * for persistence.
 *
 * ONE INSTANT, NOT TWO — as in `capture-runner.ts`. The profile's `capturedAt`,
 * the mapper's `constructedAt` and the snapshot's `capturedAt` all come from a
 * single `runtime.now()` call, so no artefact of one invocation can claim to
 * predate another.
 */

/** The effects the run needs, none of which it performs itself. */
export interface OnboardingRuntime {
  /**
   * Reads an operator-authored file as text. THROWS when the path cannot be
   * read — a real failure with an external cause, reported as one and never
   * defaulted into an empty document.
   */
  readonly readOperatorFileText: (path: string) => string;
  /** The single instant of this invocation. Called exactly once per run. */
  readonly now: () => Date;
  /** Mints a `snapshotId` when the operator did not pin one (ADR-0030 D4). */
  readonly newSnapshotId: () => string;
  /**
   * Builds the ADR-0043 D6 chain against a LOCAL database, on demand.
   *
   * A function, not a value, because `produceOnly` must not construct a
   * `PrismaClient` at all (D6 condition 4): a CLI that connects in order to
   * decline to write is a CLI whose safe mode still needs credentials.
   */
  readonly openLocalCaptureOrchestrator: () => Promise<CaptureConnection>;
}

export interface OnboardingRunResult {
  readonly exitCode: number;
  readonly stdout: readonly string[];
  readonly stderr: readonly string[];
}

/**
 * Distinct codes, so a wrapper script can tell which of the operator's two
 * files was wrong without parsing English.
 */
export const ONBOARDING_EXIT_CODES = {
  ok: 0,
  invalidArguments: 2,
  clientRecordRefused: 3,
  answerFileRefused: 4,
  captureFailed: 5,
} as const;

const failure = (exitCode: number, stdout: readonly string[], errors: readonly string[]) => ({
  exitCode,
  stdout,
  stderr: errors,
});

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * ⚠️ `driverFailureLabelOf` is re-exported, NOT re-implemented. It moved to its
 * own module when `runCapture` needed the same rule — as opposed to `messageOf`
 * above, which renders refusals this repository wrote and whose wording is
 * already governed.
 */
export { driverFailureLabelOf } from './driver-failure-label';

/**
 * The echo half of ADR-0043 D4's echo-and-`--confirm` mitigation, printed on
 * every run including `produceOnly`.
 *
 * ⚠️ The organization is shown as derived, not as given. An operator reading
 * this must be able to see that AGE did not take their word for the scope —
 * that is the difference D6 condition 1 turns on.
 *
 * 🚫 The client's display name is NOT echoed. This CLI's output is the thing
 * most likely to end up pasted into an issue or a chat log, and the record file
 * holds a real business's name.
 */
const echoScope = (command: OnboardingCommand, organizationId: string): readonly string[] => [
  `mode:            ${command.mode}`,
  `clientId:        ${command.clientId}`,
  `organizationId:  ${organizationId} (from client record, not typed)`,
  `changedBy:       ${command.changedBy}`,
  `answers:         ${command.answersPath}`,
  `records:         ${command.recordsPath}`,
  ...(command.bifId === undefined ? [] : [`bifId:           ${command.bifId}`]),
];

const summarize = (result: BusinessDiscoveryCaptureResult): readonly string[] => [
  `bifId:           ${result.context.bifId}`,
  `bifStatus:       ${result.context.bifStatus}`,
  `confidenceScore: ${result.context.bifConfidenceScore}`,
  `completeness:    ${result.context.bifCompletenessScore}`,
  `sections:        ${result.context.metadata.presentSectionCount} present, ${result.context.metadata.omittedSectionCount} omitted`,
];

export async function runOnboarding(
  argv: readonly string[],
  runtime: OnboardingRuntime,
): Promise<OnboardingRunResult> {
  const parsed = parseOnboardingArguments(argv);

  if (!parsed.ok) {
    return failure(ONBOARDING_EXIT_CODES.invalidArguments, [], parsed.errors);
  }

  const command = parsed.command;

  // ⚠️ Order is load-bearing: the RECORD is resolved before the answers are
  // read. An unknown client id means this run has no scope at all, and a run
  // with no scope has no business opening the operator's answer file.
  let organizationId: string;
  let clientContext: ClientContext;
  let changedBy: OperatorPrincipal;
  try {
    const records = loadClientRecordFile({
      path: command.recordsPath,
      repositoryRoot: command.repositoryRoot,
      readFileText: runtime.readOperatorFileText,
    });
    const record = requireClientRecord(records, command.clientId);

    organizationId = record.organizationId;
    clientContext = toClientContext(record);
    // ADR-0053 D4: never defaulted, never generated, never inferred — and never
    // an authorization decision. It is who to record, not who may act.
    changedBy = parseOperatorPrincipal(command.changedBy);
  } catch (error: unknown) {
    return failure(ONBOARDING_EXIT_CODES.clientRecordRefused, [], [messageOf(error)]);
  }

  const echoed = echoScope(command, organizationId);

  let answers: readonly DiscoveryAnswer[];
  try {
    answers = loadDiscoveryAnswerFile({
      path: command.answersPath,
      repositoryRoot: command.repositoryRoot,
      questionnaire: DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
      readFileText: runtime.readOperatorFileText,
    });
  } catch (error: unknown) {
    return failure(ONBOARDING_EXIT_CODES.answerFileRefused, echoed, [messageOf(error)]);
  }

  const instant = runtime.now();
  const capturedAt = instant.toISOString();

  // 🚫 TRANSCRIPTION ONLY. The mapper copies answer text verbatim, omits every
  // field it has no answer for and infers nothing (ADR-0050 D2). A low score
  // for the first real client is a CORRECT result (ADR-0054 D7) — nothing here
  // may reach for a cap, a weight or a predicate to improve it.
  const profile = buildProfileFromAnswers(answers, DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE, {
    id: command.profileId,
    capturedAt,
  });

  const mapping = {
    constructedAt: instant,
    changedBy,
    ...(command.bifId === undefined ? {} : { bifId: command.bifId }),
  };

  if (command.mode === 'produceOnly') {
    // No connection is opened, so no `PrismaClient` is constructed and no
    // credential is needed. Refusing to write is always available and always
    // safe (D6 condition 4).
    const result = await new BusinessDiscoveryScoredBifCaptureOrchestrator().execute({
      mode: 'produceOnly',
      clientContext,
      profile,
      mapping,
    });

    return {
      exitCode: ONBOARDING_EXIT_CODES.ok,
      stdout: [...echoed, ...summarize(result), 'capture:         not requested'],
      stderr: [],
    };
  }

  const connection = await runtime.openLocalCaptureOrchestrator();

  let result: BusinessDiscoveryCaptureResult;
  try {
    result = await new BusinessDiscoveryScoredBifCaptureOrchestrator(
      connection.orchestrator,
    ).execute({
      mode: 'produceAndCapture',
      clientContext,
      profile,
      mapping,
      snapshotId: command.snapshotIdOverride ?? runtime.newSnapshotId(),
      capturedAt: command.capturedAtOverride ?? capturedAt,
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
      ONBOARDING_EXIT_CODES.captureFailed,
      [...echoed, ...summarize(result)],
      [`Capture failed: ${detail}`],
    );
  }

  const receipt = result.capture.receipt;

  return {
    exitCode: ONBOARDING_EXIT_CODES.ok,
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
