import { runAssess, type AssessRuntime } from './assess-runner';
import { runCapture, type CaptureRunResult, type CaptureRuntime } from './capture-runner';
import { runInspect, type InspectRuntime } from './inspect-runner';
import { runOnboarding, type OnboardingRuntime } from './onboarding-runner';
import { runProject } from './project-runner';
import { runRelay, type RelayRuntime } from './relay-runner';

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

/** The effects all five commands need. `main.ts` supplies the real ones. */
export type CaptureCliRuntime = CaptureRuntime &
  OnboardingRuntime &
  InspectRuntime &
  AssessRuntime &
  RelayRuntime;

/** The subcommand that runs the ADR-0054 D6 onboarding flow. */
export const ONBOARDING_SUBCOMMAND = 'onboard';

/**
 * The subcommand that reads one stored snapshot back (ADR-0055 D1).
 *
 * ⚠️ A THIRD BRANCH, NOT A MODE ON EITHER EXISTING ONE. `--read` on
 * `age-capture` would put a read and a write behind the same parser and the same
 * runtime, and the runtime is where the append handle lives. A separate branch
 * is what lets `runInspect` take a runtime that has no way to write at all.
 */
export const INSPECT_SUBCOMMAND = 'inspect';

/**
 * The subcommand that assesses one stored snapshot (ADR-0063 D1).
 *
 * 🚫 A FOURTH BRANCH, AND NOT A FLAG ON `inspect`. ADR-0055 D4 refused readiness
 * inside `inspect`'s printer so that "show me what was stored" could never start
 * editorialising about it; that reasoning is unchanged. A separate command whose
 * whole declared purpose is the assessment does not weaken it — the operator
 * chooses which of the two questions they are asking, and the answer never
 * arrives unasked.
 */
export const ASSESS_SUBCOMMAND = 'assess';

/**
 * The subcommand that records one relayed observation (ADR-0069 D3/D7).
 *
 * 🛑 A FIFTH BRANCH, AND THE ONLY WRITE PATH INTO THE OBSERVATION STORE. It is
 * not a mode on `age-capture`, and not a flag on `inspect`: `age-capture` writes
 * what the business said about itself, and this writes what an external system
 * claimed. Those are two different kinds of statement (ADR-0069's whole premise
 * that BIF, Source Observation and Derived Intelligence stay apart), and putting
 * them behind one parser is how they start being treated as one.
 *
 * 🚫 IT IS STILL NOT A LISTENER. An operator types this, one observation at a
 * time. There is no scheduler, no poll, no queue and no peer product connecting
 * to AGE.
 */
export const RELAY_SUBCOMMAND = 'relay';

/**
 * The subcommand that projects one stored context for a peer product
 * (ADR-0069 deliverable 7, carried under ADR-0071 D1).
 *
 * ⚠️ A SIXTH BRANCH, AND 🚫 NOT A FLAG ON `inspect`. `inspect` prints what was
 * stored for a human to read; this prints a machine document for another
 * product. Same row, different audience — and a flag switching between them
 * would put a peer-facing artefact behind a command whose whole contract is
 * "show me what you kept" (ADR-0055 D4).
 *
 * 🚫 IT IS NOT A LISTENER EITHER. An operator runs it and carries the document.
 * There is nothing for a peer to connect to (ADR-0071 D1/D3).
 */
export const PROJECT_SUBCOMMAND = 'project';

export async function runCli(
  argv: readonly string[],
  runtime: CaptureCliRuntime,
): Promise<CaptureRunResult> {
  if (argv[0] === ONBOARDING_SUBCOMMAND) {
    return runOnboarding(argv.slice(1), runtime);
  }

  if (argv[0] === INSPECT_SUBCOMMAND) {
    return runInspect(argv.slice(1), runtime);
  }

  if (argv[0] === ASSESS_SUBCOMMAND) {
    return runAssess(argv.slice(1), runtime);
  }

  if (argv[0] === RELAY_SUBCOMMAND) {
    return runRelay(argv.slice(1), runtime);
  }

  if (argv[0] === PROJECT_SUBCOMMAND) {
    return runProject(argv.slice(1), runtime);
  }

  return runCapture(argv, runtime);
}
