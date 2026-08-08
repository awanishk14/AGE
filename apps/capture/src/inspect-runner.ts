import type {
  ScoredBifSnapshotKey,
  ScoredBifSnapshotRecord,
  ScoredBifSnapshotSeriesKey,
} from '@age/business-discovery-contracts';
import type { ClientContext } from '@age/capability-kit';
import { loadClientRecordFile, requireClientRecord, toClientContext } from '@age/client-registry';

import { parseInspectArguments, type InspectCommand } from './inspect-arguments';

/**
 * The inspect run — the first code path in AGE that reads a stored row back
 * (ADR-0055 D1–D5).
 *
 * WHAT IT IS FOR. Every surface AGE has ever had was fed by a fixture or by the
 * artefact of the run it was part of. Nothing had ever loaded a row that a
 * previous invocation wrote, which means the append-only store had never once
 * been shown to round-trip against real data. ADR-0054 D7's success criterion —
 * a stored profile the operator can look at — needed this half.
 *
 * PURE, BY INJECTION — the same seam as `capture-runner.ts` and
 * `onboarding-runner.ts`. This module reads no clock, mints no id, opens no
 * file, touches no `process`, constructs no `PrismaClient` and prints nothing.
 * It takes an `argv` tail and an `InspectRuntime` of effects and returns an exit
 * code and lines.
 *
 * ⚠️ ORDER IS LOAD-BEARING, AND FOR A DIFFERENT REASON THAN IN `onboard`. There
 * the record is resolved first because a run with no scope has no business
 * opening the operator's answer file. Here it is resolved first because a run
 * with no scope has no business opening a DATABASE CONNECTION: an unknown
 * client id must cost nothing and reach nothing.
 *
 * 🚫 IT CANNOT WRITE, AND NOT BECAUSE IT DECLINES TO. `InspectRuntime` offers a
 * `SnapshotReadConnection`, which carries two reads and a close. There is no
 * `append` on it to call, no orchestrator to hand a record to, and no branch
 * that could acquire one. ADR-0046 D7 is not repealed outside ADR-0054 D6's five
 * conditions, and a read command holding a live append handle is a
 * `produceAndCapture` waiting to happen (ADR-0055 D2).
 *
 * 🚫 NO READINESS REPORT (D4). The architect lens recommended rendering the
 * stored context through `buildContextReadinessReport`; the ADR rejected it on
 * that lens's own reasoning. This command prints what was stored and stops.
 */

/** The two reads, and the means to shut the connection down again. */
export interface SnapshotReadConnection {
  readonly findBySnapshotId: (key: ScoredBifSnapshotKey) => Promise<ScoredBifSnapshotRecord | null>;
  readonly findLatest: (key: ScoredBifSnapshotSeriesKey) => Promise<ScoredBifSnapshotRecord | null>;
  readonly close: () => Promise<void>;
}

/** The effects the run needs, none of which it performs itself. */
export interface InspectRuntime {
  /**
   * Reads an operator-authored file as text. THROWS when the path cannot be
   * read — a real failure with an external cause, reported as one and never
   * defaulted into an empty document.
   */
  readonly readOperatorFileText: (path: string) => string;
  /**
   * Opens a read-only connection to a LOCAL database, on demand.
   *
   * A function, not a value, for the same reason `onboard` takes one: an
   * invalid argument list or an unknown client must not have opened a
   * connection, which means the connection cannot exist before those checks
   * have run.
   */
  readonly openSnapshotReadConnection: () => Promise<SnapshotReadConnection>;
}

export interface InspectRunResult {
  readonly exitCode: number;
  readonly stdout: readonly string[];
  readonly stderr: readonly string[];
}

/**
 * Distinct codes, so a wrapper script can tell "your record file is wrong" from
 * "that scope holds no such snapshot" without parsing English.
 *
 * ⚠️ `snapshotNotFound` IS ITS OWN CODE (D5). Reporting a miss as `ok` with an
 * empty report would read as "this client has nothing", which is a claim about
 * the business. What actually happened is that nothing was found — a claim about
 * the query.
 */
export const INSPECT_EXIT_CODES = {
  ok: 0,
  invalidArguments: 2,
  clientRecordRefused: 3,
  snapshotNotFound: 6,
} as const;

const failure = (exitCode: number, stdout: readonly string[], errors: readonly string[]) => ({
  exitCode,
  stdout,
  stderr: errors,
});

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * The echoed scope, as in both writing commands.
 *
 * 🚫 The client's display name is NOT echoed. This CLI's output is the thing
 * most likely to end up pasted into an issue or a chat log, and the record file
 * holds a real business's name.
 *
 * ⚠️ The organization is shown as derived, not as given — an operator reading
 * this must be able to see that AGE did not take their word for the scope.
 */
const echoScope = (command: InspectCommand, organizationId: string): readonly string[] => [
  `clientId:        ${command.clientId}`,
  `organizationId:  ${organizationId} (from client record, not typed)`,
  `bifId:           ${command.bifId}`,
  `asked for:       ${command.snapshotId === undefined ? 'the latest snapshot in this series' : command.snapshotId}`,
];

/**
 * What was stored, and nothing else (D4).
 *
 * 🚫 NO AGGREGATE, no ranking, no ordering by state, no badge, no "2 of 3
 * ready", no colour, no capability `run`, no BIF status promotion and no wording
 * that implies one. The scores are printed as four separate lines and are 🚫
 * never combined: `discoveryConfidenceScore` is not BIF confidence and must
 * never be presented as though it were.
 *
 * ⚠️ THE TWO DISCOVERY SCORES ARE NOT IN THE SNAPSHOT, AND THAT IS RENDERED AS A
 * FACT ABOUT THE STORE. D4 asks for "the four scores kept separate", but a
 * `ScoredBifContext` is projected solely from a `BusinessIntelligenceFramework`,
 * and the discovery pair lives on the discovery profile — structurally out of
 * scope for the projection, deliberately, so intake metrics cannot leak into
 * capability-facing context. They are therefore not stored, and 🚫 printing a
 * `0`, a blank or nothing at all would each turn "AGE never kept this" into
 * "AGE kept this and it was empty". The line says which artefact does hold them.
 */
const NOT_STORED = 'not stored in the snapshot (a discovery-profile metric, not a BIF metric)';

const summarize = (record: ScoredBifSnapshotRecord): readonly string[] => {
  const context = record.snapshot.context;

  return [
    '',
    `snapshotId:      ${record.snapshotId}`,
    `capturedAt:      ${record.capturedAt}`,
    `snapshotVersion: ${record.snapshot.snapshotVersion}`,
    `contextVersion:  ${context.contextVersion}`,
    `bifStatus:       ${context.bifStatus}`,
    '',
    `bifConfidenceScore:         ${context.bifConfidenceScore}`,
    `bifCompletenessScore:       ${context.bifCompletenessScore}`,
    `discoveryConfidenceScore:   ${NOT_STORED}`,
    `discoveryCompletenessScore: ${NOT_STORED}`,
    '',
    `sections present (${context.metadata.presentSectionCount} of ${context.metadata.canonicalSectionCount}):`,
    ...context.sections.map((section) => `  - ${section.name} [${section.type}]`),
    // ⚠️ NAMED, NOT COUNTED. ADR-0026 D4: a missing section is a LIMITATION, and
    // a limitation you cannot name is indistinguishable from an absence of one.
    // 🚫 The heading says "omitted", never "missing data" or "incomplete" —
    // absence is never a conclusion about the business.
    `sections omitted (${context.metadata.omittedSectionCount}):`,
    ...context.omittedSections.map((omitted) => `  - ${omitted.name} [${omitted.type}]`),
  ];
};

export async function runInspect(
  argv: readonly string[],
  runtime: InspectRuntime,
): Promise<InspectRunResult> {
  const parsed = parseInspectArguments(argv);

  if (!parsed.ok) {
    return failure(INSPECT_EXIT_CODES.invalidArguments, [], parsed.errors);
  }

  const command = parsed.command;

  let organizationId: string;
  let clientContext: ClientContext;
  try {
    const records = loadClientRecordFile({
      path: command.recordsPath,
      repositoryRoot: command.repositoryRoot,
      readFileText: runtime.readOperatorFileText,
    });
    const record = requireClientRecord(records, command.clientId);

    organizationId = record.organizationId;
    clientContext = toClientContext(record);
  } catch (error: unknown) {
    return failure(INSPECT_EXIT_CODES.clientRecordRefused, [], [messageOf(error)]);
  }

  const echoed = echoScope(command, organizationId);

  const series: ScoredBifSnapshotSeriesKey = {
    clientId: clientContext.clientId,
    organizationId: clientContext.organizationId,
    bifId: command.bifId,
  };

  const connection = await runtime.openSnapshotReadConnection();

  let found: ScoredBifSnapshotRecord | null;
  try {
    // ⚠️ NOT WRAPPED IN A CATCH, DELIBERATELY (D5). A stored row that fails
    // `normalizeScoredBifSnapshotRecord` propagates its throw: stored rows are
    // untrusted input, and this is the first path in AGE that meets that rule
    // against real data. Rendering a partially-valid row would be the one
    // outcome worse than stopping.
    found =
      command.snapshotId === undefined
        ? await connection.findLatest(series)
        : await connection.findBySnapshotId({ ...series, snapshotId: command.snapshotId });
  } finally {
    // Always released, including when the read throws — an unreleased pool keeps
    // the process alive after the run has already ended.
    await connection.close();
  }

  if (found === null) {
    // 🚫 NEVER AN EMPTY REPORT. "No snapshot in this scope" is a statement about
    // the query; an empty report reads as a statement about the client.
    return failure(INSPECT_EXIT_CODES.snapshotNotFound, echoed, [
      command.snapshotId === undefined
        ? 'No snapshot in this scope: the series named by --client-id and --bif-id holds none.'
        : 'No snapshot in this scope: no member of the series named by --client-id and --bif-id carries that --snapshot-id.',
    ]);
  }

  return {
    exitCode: INSPECT_EXIT_CODES.ok,
    stdout: [...echoed, ...summarize(found)],
    stderr: [],
  };
}
