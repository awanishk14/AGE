/**
 * `@age/capture` — the capture CLI (ADR-0043 D2). THE PURE ENTRY-POINT-FREE
 * SURFACE: argument parsing, profile-document validation, and the run logic
 * that decides what should happen.
 *
 * WHAT IS NOT HERE, AND WHY THE BARREL STAYS THIS WAY. Two modules are
 * deliberately absent:
 *
 *   - `capture-composition.ts` — the ADR-0043 D6 chain and the only production
 *     `new PrismaClient(`. It is reachable as `@age/capture/composition`, a
 *     separate export path, so importing `@age/capture` never drags
 *     `@prisma/client` — or a requirement to have run `prisma generate` — into
 *     a consumer that only wanted to parse arguments.
 *   - `main.ts` — the `bin` target. It owns `process`, `node:fs`, the clock and
 *     the id source (ADR-0043 D5) and is not importable API.
 *
 * Everything exported below is a pure function over its inputs. `runCapture`
 * takes its effects as an injected `CaptureRuntime`, so the whole of the CLI's
 * decision-making is testable without a database and without a filesystem.
 */

export { parseCaptureArguments } from './capture-arguments';
export type { CaptureCommand, ParsedCaptureArguments } from './capture-arguments';

export {
  CAPTURE_DATASOURCE_ENV_VAR,
  OWNER_DATASOURCE_ENV_VAR,
  resolveCaptureDatasourceUrl,
} from './capture-connection-target';
export type {
  CaptureConnectionEnvironment,
  ResolvedCaptureDatasource,
} from './capture-connection-target';

export { parseBusinessDiscoveryProfileDocument } from './capture-profile-input';
export type { ParsedBusinessDiscoveryProfileDocument } from './capture-profile-input';

export { CAPTURE_EXIT_CODES, runCapture } from './capture-runner';
export type { CaptureConnection, CaptureRunResult, CaptureRuntime } from './capture-runner';

export { isCanonicalUtcTimestamp, readStrictValue, tokenize } from './cli-argument-tokens';
export type { Tokens } from './cli-argument-tokens';

export { parseOnboardingArguments } from './onboarding-arguments';
export type { OnboardingCommand, ParsedOnboardingArguments } from './onboarding-arguments';

export { ONBOARDING_EXIT_CODES, runOnboarding } from './onboarding-runner';
export type { OnboardingRunResult, OnboardingRuntime } from './onboarding-runner';

export { parseInspectArguments } from './inspect-arguments';
export type { InspectCommand, ParsedInspectArguments } from './inspect-arguments';

export { INSPECT_EXIT_CODES, runInspect } from './inspect-runner';
export type { InspectRunResult, InspectRuntime, SnapshotReadConnection } from './inspect-runner';

export { ASSESS_EXIT_CODES, runAssess } from './assess-runner';
export type { AssessRunResult, AssessRuntime } from './assess-runner';

export { parseRelayArguments } from './relay-arguments';
export type { ParsedRelayArguments, RelayCommand } from './relay-arguments';

export {
  RELAY_EXIT_CODES,
  RELAY_NOTHING_WAS_APPENDED,
  RELAY_RECORDED_IS_NOT_BELIEVED,
  runRelay,
} from './relay-runner';
export type {
  ObservationAppendConnection,
  RelayContextConnection,
  RelayRunResult,
  RelayRuntime,
} from './relay-runner';

export {
  ASSESS_SUBCOMMAND,
  RELAY_SUBCOMMAND,
  INSPECT_SUBCOMMAND,
  ONBOARDING_SUBCOMMAND,
  runCli,
} from './capture-cli';
export type { CaptureCliRuntime } from './capture-cli';

/**
 * ADR-0054 D6 condition 2. Exported so the rule can be read — and tested —
 * without reaching for the composition root, which imports `@prisma/client`.
 */
export {
  assertLocalDatabaseTarget,
  databaseTargetHost,
  NonLocalDatabaseTargetError,
} from './local-database-target';
