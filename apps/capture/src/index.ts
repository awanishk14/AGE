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
