import type {
  ScoredBifContext,
  ScoredBifSnapshotRecord,
  ScoredBifSnapshotSeriesKey,
} from '@age/business-discovery-contracts';
import type { CapabilitySufficiency, ClientContext } from '@age/capability-kit';
import { Capability } from '@age/capability-kit';
import { assessScoredBifContext } from '@age/capability-intelligence';
import { assessMarketContextReadiness } from '@age/capability-market-discovery';
import { assessRevenueContextReadiness } from '@age/capability-revenue';
import { loadClientRecordFile, requireClientRecord, toClientContext } from '@age/client-registry';

import { parseInspectArguments, type InspectCommand } from './inspect-arguments';
import type { SnapshotReadConnection } from './inspect-runner';

/**
 * The assess run — the first code path in AGE that REASONS over a stored row
 * (ADR-0063).
 *
 * WHAT IT IS FOR. `inspect` (ADR-0055) proved the store round-trips; it prints
 * what was kept and stops. Every capability assessment AGE has ever produced, in
 * the entire history of this repository, ran on a fixture. ADR-0055 D8 fixed
 * this slice: feed a capability from a real stored context instead — _"even if
 * the honest result is zero signals."_
 *
 * ⚠️ IT CALLS THE THREE ASSESSORS, NOT `run`, AND THAT IS NOT A SHORTFALL.
 * No capability's `run` accepts a `ScoredBifContext` — all six take domain input
 * contracts (`EvidencePackage`, `RevenueInput`, …). An adapter from a stored
 * context to one of those would have to INVENT the fields the context does not
 * carry, which §3's "never fabricate" boundary forbids and which ADR-0055 D8
 * independently refuses as "a new engine". Three capabilities expose a named
 * context assessor — the ADR-0027 shape, readiness as an entry point and 🚫
 * never a gate on `run` — and those are the only honest consumers a stored
 * context has (ADR-0063 §1.2, D3).
 *
 * 🚫 IT DOES NOT CALL `buildContextReadinessReport` (D2). That function composes
 * these same three assessors — and it lives in `@age/demo-runtime`. ADR-0054 D7
 * requires the demo baseline to stay byte-identical *because* the two paths must
 * not entangle; an import is entanglement whether or not the bytes move today.
 * A guard asserts `@age/demo-runtime` appears nowhere in this app.
 *
 * 🚫 IT CANNOT WRITE. It reuses the ADR-0055 D2 read façade unchanged — two
 * reads and a close, with the `append`-bearing repository never escaping the
 * composition function. 🚫 No new connection, and ADR-0046 D7 is not repealed.
 *
 * PURE, BY INJECTION — the same seam as the other three runners. No clock (the
 * assessors' `producedAt` arrives through the runtime, D8), no id, no file, no
 * `process`, no `PrismaClient`, and it prints nothing.
 */

/** The effects the run needs, none of which it performs itself. */
export interface AssessRuntime {
  /** Reads an operator-authored file as text. THROWS when it cannot be read. */
  readonly readOperatorFileText: (path: string) => string;
  /**
   * The single instant of this invocation, passed to the assessors as
   * `producedAt` (ADR-0026 D2, ADR-0063 D8). Supplied, never read in here: the
   * assessors are deterministic given a fixed timestamp and this run must not
   * be the thing that breaks that.
   */
  readonly now: () => Date;
  /**
   * Opens a read-only connection to a LOCAL database, on demand — a function,
   * not a value, so an invalid argument list or an unknown client cannot have
   * opened one.
   */
  readonly openSnapshotReadConnection: () => Promise<SnapshotReadConnection>;
}

export interface AssessRunResult {
  readonly exitCode: number;
  readonly stdout: readonly string[];
  readonly stderr: readonly string[];
}

/**
 * The same codes as `inspect`, for the same reasons — a wrapper script must be
 * able to tell "your record file is wrong" from "that scope holds no such
 * snapshot" without parsing English.
 *
 * ⚠️ There is deliberately NO code for "the context was insufficient".
 * `insufficient` is a SUCCESSFUL outcome (§3, ADR-0026): a capability that
 * declines to conclude from thin context has worked correctly, and a non-zero
 * exit would teach every future caller to treat honesty as failure.
 */
export const ASSESS_EXIT_CODES = {
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
 * 🚫 The client's display name is NOT echoed, and the organization is shown as
 * derived — both as in `inspect`, and for the same two reasons: this output is
 * the thing most likely to be pasted into an issue, and an operator must be able
 * to see that AGE did not take their word for the scope.
 */
const echoScope = (command: InspectCommand, organizationId: string): readonly string[] => [
  `clientId:        ${command.clientId}`,
  `organizationId:  ${organizationId} (from client record, not typed)`,
  `bifId:           ${command.bifId}`,
  `asked for:       ${command.snapshotId === undefined ? 'the latest snapshot in this series' : command.snapshotId}`,
];

/**
 * Why a capability has no state, when it has none.
 *
 * 🚫 THE THREE CAPABILITIES WITHOUT AN ASSESSOR ARE NAMED, NOT OMITTED (D4).
 * Authority, Growth and Operations expose no context assessor at all. Printing
 * only the three that were assessed — or any wording implying the other three
 * are fine — is the `detectContradictions` failure in a new place: a surface
 * that silently drops what it never examined turns "AGE has never looked" into
 * "AGE looked and found nothing wrong".
 */
const NO_ASSESSOR = 'not-assessed — this capability exposes no context assessor';

/**
 * 🚫 AN ABSENT SUFFICIENCY IS NOT `ready` (D5). `CapabilityOutput.sufficiency`
 * is optional on the shared envelope, and §5 of the non-negotiable semantics is
 * explicit: omitted stays undefined, never defaulted. The absence is rendered as
 * an absence.
 */
const NOT_STATED = 'not-stated — the assessor returned no sufficiency for this run';

/** One capability's assessed disposition, or the reason it has none. */
interface AssessedCapability {
  readonly capability: Capability;
  readonly sufficiency?: CapabilitySufficiency;
  readonly unavailable?: string;
}

/**
 * ⚠️ ALL SIX, IN REGISTRY ORDER, ALWAYS. The list is the coverage claim: a
 * capability missing from it is a capability the operator cannot tell was never
 * examined.
 */
const assessAll = (
  clientContext: ClientContext,
  context: ScoredBifContext,
  producedAt: Date,
): readonly AssessedCapability[] => [
  {
    capability: Capability.MarketDiscovery,
    sufficiency: assessMarketContextReadiness(clientContext, context, { producedAt }).output
      .sufficiency,
  },
  {
    capability: Capability.Intelligence,
    sufficiency: assessScoredBifContext(clientContext, context, { producedAt }).output.sufficiency,
  },
  { capability: Capability.Growth, unavailable: NO_ASSESSOR },
  { capability: Capability.Authority, unavailable: NO_ASSESSOR },
  { capability: Capability.Operations, unavailable: NO_ASSESSOR },
  {
    capability: Capability.Revenue,
    sufficiency: assessRevenueContextReadiness(clientContext, context, { producedAt }).output
      .sufficiency,
  },
];

/**
 * What each capability made of the stored context.
 *
 * 🚫 NO AGGREGATE (D6). No score, no band, no "2 of 3 ready", no count of ready
 * capabilities, no ordering by state, no overall verdict. An aggregate over
 * three assessed and three not-assessed capabilities is arithmetic over a value
 * that does not exist, and it would read as a measurement of the business.
 *
 * ⚠️ REASONS ARE PRINTED VERBATIM, FROM THE ASSESSOR. The state alone is the
 * least useful half: "insufficient" without "the pricing section is absent" is a
 * verdict the operator cannot act on or contest.
 */
const renderCapability = (assessed: AssessedCapability): readonly string[] => {
  if (assessed.unavailable !== undefined) {
    return ['', `${assessed.capability}`, `  ${assessed.unavailable}`];
  }

  const sufficiency = assessed.sufficiency;

  if (sufficiency === undefined) {
    return ['', `${assessed.capability}`, `  ${NOT_STATED}`];
  }

  return [
    '',
    `${assessed.capability}`,
    `  state:    ${sufficiency.state}`,
    '  reasons:',
    ...sufficiency.reasons.map((reason) => `    - ${reason}`),
    // ⚠️ Warnings and context-quality notes are printed when present and the
    // heading is omitted when they are empty. 🚫 An empty "warnings:" heading
    // reads as a clean bill of health that nothing asserted.
    ...(sufficiency.warnings.length === 0
      ? []
      : ['  warnings:', ...sufficiency.warnings.map((warning) => `    - ${warning}`)]),
    ...(sufficiency.contextQualityNotes === undefined ||
    sufficiency.contextQualityNotes.length === 0
      ? []
      : [
          '  context quality notes:',
          ...sufficiency.contextQualityNotes.map((note) => `    - ${note}`),
        ]),
  ];
};

const summarize = (
  record: ScoredBifSnapshotRecord,
  assessedAt: Date,
  assessed: readonly AssessedCapability[],
): readonly string[] => {
  const context = record.snapshot.context;

  return [
    '',
    `snapshotId:      ${record.snapshotId}`,
    `capturedAt:      ${record.capturedAt}`,
    `assessedAt:      ${assessedAt.toISOString()}`,
    `bifStatus:       ${context.bifStatus}`,
    // ⚠️ The two BIF scores are carried through so the states below can be read
    // against the context that produced them. 🚫 They are NOT combined with each
    // other and 🚫 not combined with any state — see D6.
    `bifConfidenceScore:   ${context.bifConfidenceScore}`,
    `bifCompletenessScore: ${context.bifCompletenessScore}`,
    `sections present:     ${context.metadata.presentSectionCount} of ${context.metadata.canonicalSectionCount}`,
    '',
    // ⚠️ THE HEADING CARRIES NO SUMMARY WORD, AND NOT ONLY BY TASTE. The D6
    // guard scans this output for aggregate wording; a heading that had to be
    // special-cased out of that scan is a guard with a hole in it.
    'capability assessments (all six named; each stands on its own):',
    ...assessed.flatMap(renderCapability),
  ];
};

export async function runAssess(
  argv: readonly string[],
  runtime: AssessRuntime,
): Promise<AssessRunResult> {
  // ⚠️ THE SAME PARSER AS `inspect`, DELIBERATELY REUSED. The two commands ask
  // for the identical scope, and a second copy is how a refusal drifts: the copy
  // that quietly gains an `--organization-id` still passes its own tests.
  const parsed = parseInspectArguments(argv);

  if (!parsed.ok) {
    return failure(ASSESS_EXIT_CODES.invalidArguments, [], parsed.errors);
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
    return failure(ASSESS_EXIT_CODES.clientRecordRefused, [], [messageOf(error)]);
  }

  const echoed = echoScope(command, organizationId);

  const series: ScoredBifSnapshotSeriesKey = {
    clientId: clientContext.clientId,
    organizationId: clientContext.organizationId,
    bifId: command.bifId,
  };

  // ⚠️ ORDER IS LOAD-BEARING, as in `inspect`: a run with no scope must not
  // reach a database at all. An unknown client id costs nothing and opens
  // nothing.
  const connection = await runtime.openSnapshotReadConnection();

  let found: ScoredBifSnapshotRecord | null;
  try {
    // ⚠️ NOT WRAPPED IN A CATCH, DELIBERATELY. A stored row that fails
    // `normalizeScoredBifSnapshotRecord` propagates its throw: stored rows are
    // untrusted input, and assessing a partially-valid row would be strictly
    // worse than stopping — the assessment would look exactly as authoritative
    // as an honest one.
    found =
      command.snapshotId === undefined
        ? await connection.findLatest(series)
        : await connection.findBySnapshotId({ ...series, snapshotId: command.snapshotId });
  } finally {
    await connection.close();
  }

  if (found === null) {
    // 🚫 NEVER AN EMPTY ASSESSMENT. "No snapshot in this scope" is a statement
    // about the query; six capabilities reported over nothing would be a
    // statement about the client.
    return failure(ASSESS_EXIT_CODES.snapshotNotFound, echoed, [
      command.snapshotId === undefined
        ? 'No snapshot in this scope: the series named by --client-id and --bif-id holds none.'
        : 'No snapshot in this scope: no member of the series named by --client-id and --bif-id carries that --snapshot-id.',
    ]);
  }

  const assessedAt = runtime.now();
  const assessed = assessAll(clientContext, found.snapshot.context, assessedAt);

  return {
    exitCode: ASSESS_EXIT_CODES.ok,
    stdout: [...echoed, ...summarize(found, assessedAt, assessed)],
    stderr: [],
  };
}
