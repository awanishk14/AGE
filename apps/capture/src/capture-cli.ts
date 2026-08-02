import { runCapture, type CaptureRunResult, type CaptureRuntime } from './capture-runner';
import { runOnboarding, type OnboardingRuntime } from './onboarding-runner';

/**
 * Which of the CLI's two commands was asked for (ADR-0054 D6).
 *
 * WHY A DISPATCHER AND NOT A SECOND BINARY. `age-capture`'s `bin` is a webpack
 * bundle whose build asserts that the Prisma composition root stays a lazily
 * loaded chunk — a two-sided assertion that exists because `produceOnly` must
 * construct no `PrismaClient` at all. A second entry point would mean a second
 * bundle target and a generalised assertion, which is a change to a shipped
 * safety property in a slice that has no business making one. One entry, one
 * bundle, one already-proven split point.
 *
 * WHY THE DISPATCH LIVES HERE AND NOT IN `main.ts`. `main.ts` owns every impure
 * thing and contains no branch on the operator's input: all of the decisions are
 * above it, in pure functions that are tested as such. A subcommand IS a branch
 * on operator input, so it belongs on this side of the seam.
 *
 * 🚫 NO DEFAULT SUBCOMMAND IN THE WRITING DIRECTION. An unrecognised first token
 * is not an error here — it falls through to `age-capture`'s own parser, which
 * refuses positionals by name. What must never happen is the reverse: a
 * mistyped `onbard` silently running something that writes.
 */

/** The effects both commands need. `main.ts` supplies the real ones. */
export type CaptureCliRuntime = CaptureRuntime & OnboardingRuntime;

/** The subcommand that runs the ADR-0054 D6 onboarding flow. */
export const ONBOARDING_SUBCOMMAND = 'onboard';

export async function runCli(
  argv: readonly string[],
  runtime: CaptureCliRuntime,
): Promise<CaptureRunResult> {
  if (argv[0] === ONBOARDING_SUBCOMMAND) {
    return runOnboarding(argv.slice(1), runtime);
  }

  return runCapture(argv, runtime);
}
