import type { ScoredBifSnapshotRecord } from '@age/business-discovery-contracts';
import type { ClientContext } from '@age/capability-kit';
import { loadClientRecordFile, requireClientRecord, toClientContext } from '@age/client-registry';
import { deriveModelledSubjects } from '@age/observation-association';
import { describeJsonParseFailure } from '@age/operator-file-policy';
import {
  assessAdmissibility,
  relaySourceObservation,
  type AdmissibilityOutcome,
  type SourceObservationEnvelope,
  type StoredSourceObservation,
} from '@age/source-observation';

import { parseRelayArguments, type RelayCommand } from './relay-arguments';

/**
 * The relay run — the first and only code path in AGE that puts an observation
 * into the store (ADR-0069 D3, D4, D5, D7).
 *
 * WHY IT HAD TO EXIST. `relaySourceObservation` carries and does not keep, and
 * the MCP surface it is reached through opens no database (ADR-0055 D6). Two
 * producers were therefore impossible: nothing could produce anything. D7 says
 * *two producers or the demonstration does not count*, so this is the missing
 * half — 🛑 and it is the OPERATOR'S OWN ACT, out of band, never a listener,
 * never a scheduler, never a poll, never a peer product connecting to AGE.
 *
 * PURE, BY INJECTION — the same seam as `inspect-runner.ts`. This module reads
 * no clock, mints no id, opens no file, touches no `process`, constructs no
 * `PrismaClient` and prints nothing.
 *
 * ⚠️ THE ORDER IS THE ARGUMENT, AND EVERY STEP OF IT IS LOAD-BEARING:
 *
 *   1. arguments        — an invalid list reaches nothing
 *   2. client record    — an unknown client opens NO connection and costs nothing
 *   3. the observation  — read and checked as UNTRUSTED input
 *   4. the scope check  — a source asserting another organisation is refused
 *   5. the stored BIF   — admissibility is BY SUBJECT, so the subjects must be real
 *   6. admissibility    — assessed against what AGE actually models
 *   7. THEN, and only then, an append handle is asked for at all
 *
 * 🛑 **NOTHING BELOW STEP 6 CAN WRITE, AND NOT BECAUSE IT DECLINES TO.** The
 * append connection is a function on the runtime, so a run that refuses earlier
 * never has one. A run that was not given `--append --confirm` never calls it.
 *
 * 🛑 **RELAYED IS NOT BELIEVED** (D5). Appending records that a source said
 * this. 🚫 It moves no BIF field, no status, no score and no completeness
 * figure, and 🚫 nothing here writes to the snapshot store at all.
 *
 * 🚫 **SOURCE-NEUTRAL** (D6). No peer product is named in this module and
 * `sourceSystem` is never branched on — it is carried as data, from the
 * operator's file into the row.
 */

/** The one write, and the means to shut the connection down again. */
export interface ObservationAppendConnection {
  readonly append: (observation: Readonly<StoredSourceObservation>) => Promise<void>;
  readonly close: () => Promise<void>;
}

/** The reads the assessment needs. 🚫 Deliberately carries no `append`. */
export interface RelayContextConnection {
  readonly findLatest: (key: {
    readonly clientId: string;
    readonly organizationId: string;
    readonly bifId: string;
  }) => Promise<ScoredBifSnapshotRecord | null>;
  readonly close: () => Promise<void>;
}

/** The effects the run needs, none of which it performs itself. */
export interface RelayRuntime {
  /** THROWS when the path cannot be read — never defaulted into an empty file. */
  readonly readOperatorFileText: (path: string) => string;
  /** ⚠️ AGE's own identity for the observation. 🚫 Never the source's id. */
  readonly newObservationId: () => string;
  /** When AGE recorded it. 🚫 Never `period.observedAt`, which is the source's. */
  readonly now: () => Date;
  /**
   * Opens the read connection the assessment needs.
   *
   * A function, not a value: an invalid argument list, an unknown client or an
   * unreadable observation must not have opened a connection at all.
   */
  readonly openRelayContextConnection: () => Promise<RelayContextConnection>;
  /**
   * Opens the append connection.
   *
   * ⚠️ SEPARATE FROM THE READ ONE, AND ASKED FOR LAST. A single connection
   * carrying both would mean every refusing run still held a live write handle,
   * and the reason `assessOnly` cannot write would be that it chose not to.
   */
  readonly openObservationAppendConnection: () => Promise<ObservationAppendConnection>;
}

export interface RelayRunResult {
  readonly exitCode: number;
  readonly stdout: readonly string[];
  readonly stderr: readonly string[];
}

/**
 * Distinct codes, so a wrapper can tell "your record file is wrong" from "that
 * observation names a subject AGE does not model" without parsing English.
 *
 * ⚠️ `contextNotFound` IS ITS OWN CODE AND IS NOT `inadmissible`. AGE holding no
 * stored context for this business means AGE has never looked at its subjects.
 * Reporting that as inadmissible would say the observation failed a check that
 * was never run.
 */
export const RELAY_EXIT_CODES = {
  ok: 0,
  invalidArguments: 2,
  clientRecordRefused: 3,
  observationRefused: 4,
  scopeMismatch: 5,
  contextNotFound: 6,
  inadmissible: 7,
} as const;

const failure = (exitCode: number, stdout: readonly string[], errors: readonly string[]) => ({
  exitCode,
  stdout,
  stderr: errors,
});

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * ⚠️ RECORDED, NOT BELIEVED — printed on every run that appends, and on every
 * run that does not. 🚫 It is never softened into "accepted" or "confirmed".
 */
export const RELAY_RECORDED_IS_NOT_BELIEVED =
  'Recorded is not believed. AGE has stored that a source said this; it has not verified it, no ' +
  'BIF field moved, no status changed and no score moved. Two sources agreeing is still two ' +
  'reports until a rule relates them.';

/** ⚠️ What an assess-only run did NOT do. 🚫 Never reported as a success line. */
export const RELAY_NOTHING_WAS_APPENDED =
  'Nothing was appended. This run assessed the observation and stopped — appending requires ' +
  '--append --confirm, which is a second, separate act.';

/**
 * The echoed scope, as in the other commands.
 *
 * 🚫 The client's display name is NOT echoed: this output is the thing most
 * likely to be pasted into an issue, and the record file holds a real business's
 * name. ⚠️ The organization is shown as derived, not as given.
 */
const echoScope = (command: RelayCommand, organizationId: string): readonly string[] => [
  `clientId:        ${command.clientId}`,
  `organizationId:  ${organizationId} (from client record, not typed)`,
  `bifId:           ${command.bifId}`,
  `mode:            ${command.mode === 'appendConfirmed' ? 'append (confirmed)' : 'assess only'}`,
];

/**
 * What the source said, echoed back before anything is written.
 *
 * ⚠️ THE TWO INSTANTS ARE BOTH SHOWN. A relay lands days after the observation
 * by construction, and an operator confirming a write must be able to see how
 * old the thing they are recording is.
 */
const echoObservation = (envelope: Readonly<SourceObservationEnvelope>): readonly string[] => [
  '',
  `sourceSystem:    ${envelope.provenance.sourceSystem}`,
  `sourceInstance:  ${envelope.provenance.sourceInstance}`,
  `sourceRecordId:  ${envelope.provenance.sourceRecordId}`,
  `claimKind:       ${envelope.claimKind}`,
  `subject:         ${envelope.subject.kind === 'modelled' ? `${envelope.subject.label} [${envelope.subject.subjectKind}]` : `${envelope.subject.topicLabel} [unmapped]`}`,
  `claim:           ${envelope.claim.direction} · ${envelope.claim.materiality}`,
  `observedAt:      ${envelope.period.observedAt}`,
  `window:          ${envelope.period.windowStart} → ${envelope.period.windowEnd}`,
];

/**
 * ⚠️ `admissible-unmapped` IS KEPT, AND STAYS UNMAPPED. AGE not modelling the
 * subject is itself the finding — AGE's model is incomplete — so the
 * observation is recorded and 🚫 never quietly promoted to a modelled subject
 * near it.
 */
type AdmittedOutcome = Exclude<AdmissibilityOutcome, { readonly outcome: 'inadmissible' }>;

const describeAdmissibility = (outcome: AdmittedOutcome): readonly string[] =>
  outcome.outcome === 'admissible'
    ? [
        '',
        `admissibility:   admissible — the subject resolves to ${outcome.resolvedLabel} [${outcome.subjectKind}], which AGE models for this business`,
      ]
    : [
        '',
        'admissibility:   admissible as UNMAPPED — AGE does not model this subject, so the ' +
          'observation is kept and cannot be related to anything AGE holds. That is a limit of ' +
          'what AGE models, not a fault in the observation.',
      ];

/**
 * The row AGE will hold.
 *
 * ⚠️ AGE'S OWN LABEL WINS on a modelled match, so two sources spelling the same
 * service differently resolve to ONE subject. 🚫 The source's spelling is not
 * kept as a second name — that would be a second source of truth.
 *
 * 🚫 `provenance.organizationScope` IS NOT STORED. The scope on the row is the
 * one from the operator's client record, checked against the source's assertion
 * before we ever get here; storing the source's copy as well would leave two
 * scopes on one row, and a later reader with no way to know which one bound it.
 */
const toStoredObservation = (
  envelope: Readonly<SourceObservationEnvelope>,
  admissibility: AdmittedOutcome,
  organizationId: string,
  observationId: string,
  recordedAt: string,
): StoredSourceObservation => ({
  observationId,
  organizationId,
  sourceSystem: envelope.provenance.sourceSystem,
  sourceInstance: envelope.provenance.sourceInstance,
  sourceRecordId: envelope.provenance.sourceRecordId,
  subject:
    admissibility.outcome === 'admissible'
      ? {
          kind: 'modelled',
          subjectKind: admissibility.subjectKind,
          label: admissibility.resolvedLabel,
        }
      : { kind: 'unmapped', topicLabel: admissibility.topicLabel },
  claim: envelope.claim,
  period: envelope.period,
  claimKind: envelope.claimKind,
  recordedAt,
});

export async function runRelay(
  argv: readonly string[],
  runtime: RelayRuntime,
): Promise<RelayRunResult> {
  const parsed = parseRelayArguments(argv);

  if (!parsed.ok) {
    return failure(RELAY_EXIT_CODES.invalidArguments, [], parsed.errors);
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
    return failure(RELAY_EXIT_CODES.clientRecordRefused, [], [messageOf(error)]);
  }

  const echoed = echoScope(command, organizationId);

  let observationInput: unknown;
  try {
    observationInput = JSON.parse(runtime.readOperatorFileText(command.observationPath));
  } catch (error: unknown) {
    // 🚫 THE FILE'S CONTENTS ARE NOT ECHOED BACK, not even the offending
    // fragment: the file holds a real business's data, and
    // `describeJsonParseFailure` is the one shared description that says what
    // went wrong without repeating what was in it.
    return failure(RELAY_EXIT_CODES.observationRefused, echoed, [
      `The observation file could not be read (${describeJsonParseFailure(error)}).`,
    ]);
  }

  // ⚠️ THE SAME CHECK THE MCP RELAY RUNS, and deliberately the same function.
  // Two implementations of "is this a well-formed observation" is how the two
  // paths start disagreeing about what AGE accepts.
  const relayed = relaySourceObservation(observationInput);

  if (relayed.kind === 'refused') {
    return failure(RELAY_EXIT_CODES.observationRefused, echoed, [
      `The observation is refused: ${relayed.reason} at ${relayed.position}.`,
    ]);
  }

  const envelope = relayed.envelope;
  const observed = echoObservation(envelope);

  // 🛑 THE SOURCE'S ASSERTED SCOPE IS CHECKED, NEVER TRUSTED AND NEVER USED. A
  // source claiming to speak about another organisation is a refusal, not a
  // reason to write the row under the scope the operator typed — that is how an
  // observation about one business ends up filed under another.
  if (envelope.provenance.organizationScope !== organizationId) {
    return failure(
      RELAY_EXIT_CODES.scopeMismatch,
      [...echoed, ...observed],
      [
        'The observation asserts a different organization than the client record names. It is ' +
          'refused rather than recorded under the record’s scope — an observation filed under a ' +
          'business it does not describe is worse than one that was never relayed.',
      ],
    );
  }

  const contextConnection = await runtime.openRelayContextConnection();

  let found: ScoredBifSnapshotRecord | null;
  try {
    // ⚠️ NOT WRAPPED IN A CATCH, DELIBERATELY. A stored row that fails
    // normalization propagates its throw: stored rows are untrusted input, and
    // assessing an observation against a partially-readable context would be
    // the one outcome worse than stopping.
    found = await contextConnection.findLatest({
      clientId: clientContext.clientId,
      organizationId: clientContext.organizationId,
      bifId: command.bifId,
    });
  } finally {
    await contextConnection.close();
  }

  if (found === null) {
    // 🛑 "AGE HAS NEVER LOOKED", NOT "AGE LOOKED AND FOUND NOTHING". With no
    // stored context there are no modelled subjects to assess against, and
    // running the check over an empty list would report every observation as
    // inadmissible for a reason that is really about AGE, not about the source.
    return failure(
      RELAY_EXIT_CODES.contextNotFound,
      [...echoed, ...observed],
      [
        'No stored context in this scope: the series named by --client-id and --bif-id holds no ' +
          'snapshot, so AGE models no subjects to assess this observation against. This is not a ' +
          'finding that the observation is inadmissible — the check was never run.',
      ],
    );
  }

  const derivation = deriveModelledSubjects(found.snapshot.context);
  const admissibility = assessAdmissibility(envelope, derivation.subjects);

  if (admissibility.outcome === 'inadmissible') {
    // 🛑 THE RULE THAT KEEPS AGE FROM BECOMING A DATA WAREHOUSE (D4). An
    // observation about a subject AGE does not model is refused, not stored
    // "just in case" — and the message says the check ran, over how many
    // subjects, so that an empty model cannot masquerade as a verdict.
    return failure(
      RELAY_EXIT_CODES.inadmissible,
      [...echoed, ...observed],
      [
        `The observation is inadmissible: ${admissibility.reason} at ${admissibility.position}. It ` +
          `names a subject AGE does not model for this business. AGE holds ` +
          `${derivation.subjects.length} modelled subject(s) in this context, and the observation ` +
          'matched none of them.',
      ],
    );
  }

  const assessed = [...echoed, ...observed, ...describeAdmissibility(admissibility)];

  if (command.mode === 'assessOnly') {
    return {
      exitCode: RELAY_EXIT_CODES.ok,
      stdout: [...assessed, '', RELAY_NOTHING_WAS_APPENDED],
      stderr: [],
    };
  }

  const observationId = runtime.newObservationId();
  const recordedAt = runtime.now().toISOString();
  const stored = toStoredObservation(
    envelope,
    admissibility,
    organizationId,
    observationId,
    recordedAt,
  );

  const appendConnection = await runtime.openObservationAppendConnection();

  try {
    await appendConnection.append(stored);
  } finally {
    // Always released, including when the append throws — an unreleased pool
    // keeps the process alive after the run has already ended.
    await appendConnection.close();
  }

  return {
    exitCode: RELAY_EXIT_CODES.ok,
    stdout: [
      ...assessed,
      '',
      `observationId:   ${observationId} (minted by AGE, not the source)`,
      `recordedAt:      ${recordedAt} (when AGE recorded it, not when it was observed)`,
      '',
      RELAY_RECORDED_IS_NOT_BELIEVED,
    ],
    stderr: [],
  };
}
