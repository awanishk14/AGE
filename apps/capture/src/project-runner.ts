import type {
  ScoredBifSnapshotRecord,
  ScoredBifSnapshotSeriesKey,
} from '@age/business-discovery-contracts';
import type { ClientContext } from '@age/capability-kit';
import { asPeerContextDocument, projectClientContext } from '@age/client-context-projection';
import { loadClientRecordFile, requireClientRecord, toClientContext } from '@age/client-registry';

import { parseInspectArguments } from './inspect-arguments';
import { INSPECT_EXIT_CODES, type InspectRuntime } from './inspect-runner';

/**
 * The project run — the first path by which AGE's client-context projection can
 * leave AGE (ADR-0069 deliverable 7, carried under ADR-0071 **D1**).
 *
 * 🛑 **WHY THIS EXISTS AT ALL.** `projectClientContext` has been shipped and
 * correct for several slices, and its only consumers were a Studio component and
 * a Studio test. A peer product cannot open a browser. Without this command the
 * outbound half of every peer integration is a screen a human reads, which means
 * the loop can be demonstrated to a person and 🚫 never to a program.
 *
 * 🛑 **IT IS STILL OPERATOR-MEDIATED, AND THAT IS THE WHOLE POINT** (ADR-0071
 * D1). An operator runs this and hands the document on. 🚫 There is no peer
 * credential, 🚫 no principal, 🚫 no session, 🚫 no new `Authentication` arm,
 * 🚫 no listener, 🚫 no route and 🚫 nothing a peer can connect to. ADR-0071 D3
 * left the authenticated peer protocol explicitly unresolved, and 🚫 this is not
 * it arriving quietly through a CLI.
 *
 * 🚫 **IT CANNOT WRITE.** It takes `InspectRuntime`, whose connection carries two
 * reads and a close. There is no `append` to call and no branch that could
 * acquire one — the same structural argument `inspect` makes (ADR-0055 D2).
 *
 * ⚠️ **IT REUSES `inspect`'s PARSER RATHER THAN GROWING A SECOND ONE.** The
 * flags are identical because the question is identical — which stored row —
 * and two parsers over one question is how `--organization-id` gets accepted by
 * one of them a year from now.
 *
 * 🚫 **AND IT IS NOT A MODE ON `inspect`.** `inspect` prints what was stored, for
 * a human, and ADR-0055 D4 spent a decision keeping editorial content out of it.
 * This prints a machine document for another product. Same row, different
 * audience, and a flag that switched between them would put a peer-facing
 * artefact behind a command whose contract is "show me what you kept".
 *
 * Pure by injection: no clock, no ids, no filesystem, no `process`, no
 * `PrismaClient`, and it prints nothing itself.
 */

/**
 * ⚠️ **THE SAME CODES AS `inspect`, ON PURPOSE.** Both commands ask one question
 * of one series, and a wrapper script that learned two numbering schemes for
 * "that scope holds no such snapshot" would eventually treat one of them as
 * success.
 */
export const PROJECT_EXIT_CODES = INSPECT_EXIT_CODES;

export interface ProjectRunResult {
  readonly exitCode: number;
  readonly stdout: readonly string[];
  readonly stderr: readonly string[];
}

const failure = (exitCode: number, errors: readonly string[]): ProjectRunResult => ({
  exitCode,
  stdout: [],
  stderr: errors,
});

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export async function runProject(
  argv: readonly string[],
  runtime: InspectRuntime,
): Promise<ProjectRunResult> {
  const parsed = parseInspectArguments(argv);

  if (!parsed.ok) {
    return failure(PROJECT_EXIT_CODES.invalidArguments, parsed.errors);
  }

  const command = parsed.command;

  let clientContext: ClientContext;
  try {
    // ⚠️ RESOLVED BEFORE ANY CONNECTION, as in `inspect`: an unknown client id
    // must cost nothing and reach nothing.
    const records = loadClientRecordFile({
      path: command.recordsPath,
      repositoryRoot: command.repositoryRoot,
      readFileText: runtime.readOperatorFileText,
    });

    clientContext = toClientContext(requireClientRecord(records, command.clientId));
  } catch (error: unknown) {
    return failure(PROJECT_EXIT_CODES.clientRecordRefused, [messageOf(error)]);
  }

  const series: ScoredBifSnapshotSeriesKey = {
    clientId: clientContext.clientId,
    organizationId: clientContext.organizationId,
    bifId: command.bifId,
  };

  const connection = await runtime.openSnapshotReadConnection();

  let found: ScoredBifSnapshotRecord | null;
  try {
    // 🚫 NOT WRAPPED IN A CATCH, deliberately — stored rows are untrusted input
    // and a row that fails normalization must stop the run, never be projected
    // to a peer in whatever state it parsed to.
    found =
      command.snapshotId === undefined
        ? await connection.findLatest(series)
        : await connection.findBySnapshotId({ ...series, snapshotId: command.snapshotId });
  } finally {
    await connection.close();
  }

  if (found === null) {
    // 🚫 NEVER AN EMPTY DOCUMENT. A projection with every kind `never-captured`
    // is a statement about a business AGE holds; "no snapshot in this scope" is
    // a statement about the query, and a peer receiving the first when the
    // second is true would act on a business that was never asked.
    return failure(PROJECT_EXIT_CODES.snapshotNotFound, [
      command.snapshotId === undefined
        ? 'No snapshot in this scope: the series named by --client-id and --bif-id holds none. Nothing was projected — this says nothing about the business.'
        : 'No snapshot in this scope: no member of the series named by --client-id and --bif-id carries that --snapshot-id. Nothing was projected — this says nothing about the business.',
    ]);
  }

  const document = asPeerContextDocument(
    projectClientContext({
      context: found.snapshot.context,
      // ⚠️ THE STORED ROW'S CAPTURE TIME, 🚫 NEVER A CLOCK. Stamping the moment
      // of projection would tell a peer this context is as fresh as the command
      // they just ran.
      asOf: found.capturedAt,
    }),
  );

  return {
    // ⚠️ STDOUT CARRIES THE DOCUMENT AND NOTHING ELSE — 🚫 no echoed scope, no
    // banner, no reassurance. A peer redirects this to a file, and a human
    // sentence in it would make the file unparseable for the only consumer it
    // has. 🚫 The client's display name is not echoed anywhere (ADR-0053 D3).
    exitCode: PROJECT_EXIT_CODES.ok,
    stdout: [JSON.stringify(document, null, 2)],
    stderr: [],
  };
}
