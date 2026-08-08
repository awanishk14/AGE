import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import {
  assembleEvidence as assembleEvidenceIn,
  assessCapabilityReadiness as assessCapabilityReadinessIn,
  createClientRecord as createClientRecordIn,
  generateBifFromAnswerFile as generateBifFromAnswerFileIn,
  readBusinessesView as readBusinessesViewIn,
  readDiscoveryDraft as readDiscoveryDraftIn,
  reportContradictions as reportContradictionsIn,
  resolveBusinessScope as resolveBusinessScopeIn,
  submitDiscoveryAnswers as submitDiscoveryAnswersIn,
  writeDiscoveryDraft as writeDiscoveryDraftIn,
  type OperatorWorkspaceRuntime,
} from '@age/operator-workspace';
import {
  assertLoopbackBindHost,
  DEFAULT_STUDIO_BIND_HOST,
  type ClientRecordDraft,
  type DiscoveryDraft,
} from '@age/studio-shell';

/**
 * The ONE module in `apps/studio` that performs an effect.
 *
 * ⚠️ This is the `apps/capture` discipline, deliberately repeated: every
 * DECISION lives in `@age/studio-shell`, every ORCHESTRATION lives in
 * `@age/operator-workspace` (ADR-0060 D2), and every EFFECT lives here — so a
 * purity guard can assert that no other module grew its own clock, filesystem
 * read or environment lookup. 🚫 Do not read `process.env` or open a file
 * anywhere else under `src/`.
 *
 * ⚠️ THE NINE OPERATIONS ARE RE-EXPORTED WITH THEIR ORIGINAL SIGNATURES, on
 * purpose. The extraction was a MOVE: the console's screens are unchanged, and
 * their tests are what proves the move changed no behaviour.
 *
 * 🚫 Nothing here caches. A cached registry would keep serving a file the
 * operator has since corrected, and "the screen disagrees with the file" is
 * precisely the failure this console exists to make impossible.
 */

/**
 * The console's own effects, named once.
 *
 * 🚫 THIS IS THE ONLY `OperatorWorkspaceRuntime` IN `apps/studio`, and 🚫 it is
 * never exported. A second one would be a second place the console touches the
 * operator's machine, which is exactly what the purity guard exists to prevent.
 */
const CONSOLE_RUNTIME: OperatorWorkspaceRuntime = {
  env: process.env,

  // ⚠️ `process.cwd()` is used ONLY to locate the repository the file must be
  // OUTSIDE of — never to find the file itself. That distinction is ADR-0054
  // D2: searching the working directory for an operator's file is the refused
  // behaviour; knowing which tree to exclude is the guard that enforces it.
  repositoryRoot: () => process.cwd(),

  now: () => new Date(),
  fileExists: (path) => existsSync(path),
  readFileText: (path) => readFileSync(path, 'utf8'),
  writeFileText: (path, contents) => writeFileSync(path, contents, 'utf8'),
  ensureDirectory: (path) => mkdirSync(path, { recursive: true }),
};

export {
  STUDIO_QUESTIONNAIRE,
  type BusinessScope,
  type CapabilityReadinessOutcome,
  type ContradictionsOutcome,
  type CreateClientOutcome,
  type DiscoveryWorkspaceOutcome,
  type DraftOutcome,
  type EvidenceOutcome,
  type GenerateBifOutcome,
  type SaveOutcome,
  type SubmitOutcome,
} from '@age/operator-workspace';

export function readBusinessesView() {
  return readBusinessesViewIn(CONSOLE_RUNTIME);
}

export function resolveBusinessScope(clientId: string) {
  return resolveBusinessScopeIn(CONSOLE_RUNTIME, clientId);
}

export function createClientRecord(draft: ClientRecordDraft) {
  return createClientRecordIn(CONSOLE_RUNTIME, draft);
}

export function readDiscoveryDraft(clientId: string) {
  return readDiscoveryDraftIn(CONSOLE_RUNTIME, clientId);
}

export function writeDiscoveryDraft(clientId: string, draft: DiscoveryDraft) {
  return writeDiscoveryDraftIn(CONSOLE_RUNTIME, clientId, draft);
}

export function submitDiscoveryAnswers(clientId: string, draft: DiscoveryDraft) {
  return submitDiscoveryAnswersIn(CONSOLE_RUNTIME, clientId, draft);
}

export function generateBifFromAnswerFile(clientId: string, changedBy: string) {
  return generateBifFromAnswerFileIn(CONSOLE_RUNTIME, clientId, changedBy);
}

export function assembleEvidence(clientId: string, changedBy: string) {
  return assembleEvidenceIn(CONSOLE_RUNTIME, clientId, changedBy);
}

export function reportContradictions(clientId: string, changedBy: string) {
  return reportContradictionsIn(CONSOLE_RUNTIME, clientId, changedBy);
}

export function assessCapabilityReadiness(clientId: string, changedBy: string) {
  return assessCapabilityReadinessIn(CONSOLE_RUNTIME, clientId, changedBy);
}

/**
 * The host the console is CONFIGURED to bind. 🚫 Not the socket it actually
 * bound — nothing here can observe that, and this function must never be
 * described as if it could.
 *
 * 🛑 THIS READ `process.env.AGE_STUDIO_HOST ?? '127.0.0.1'` AND THAT WAS A
 * DEFECT ON `main`, in two compounding ways:
 *
 *   1. It was an **environment override of the bind host**, which ADR-0057 D2
 *      refuses by name ("no flag, no environment override"). The guard that
 *      enforces D2 scanned `package.json` and `project.json` only, so an env
 *      read in this file was its blind spot and reached `main` unseen.
 *   2. The value is what the console DISPLAYS as "Bound to". An unchecked
 *      override therefore let the console **report a host no policy had
 *      accepted** — and the System Status detail beside it asserted a refusal
 *      that no code performed.
 *
 * ⚠️ It is now derived from the ONE policy: the same pinned constant the start
 * commands use, passed through the same assertion that guards them. 🚫 Do not
 * reintroduce a parameter, a flag or an environment read here — a reported
 * value that the policy never saw is the whole defect.
 */
export function boundHost(): string {
  return assertLoopbackBindHost(DEFAULT_STUDIO_BIND_HOST);
}

/** The port the console was started on. */
export function boundPort(): number {
  const raw = process.env.PORT ?? process.env.AGE_STUDIO_PORT;
  const parsed = raw === undefined ? Number.NaN : Number.parseInt(raw, 10);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 3100;
}
