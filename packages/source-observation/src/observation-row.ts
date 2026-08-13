/**
 * A stored observation row, re-validated on the way OUT of the database.
 *
 * 🛑 **A ROW IS UNTRUSTED INPUT.** The same rule the snapshot store and the
 * session store live under (`normalizeScoredBifSnapshotRecord`,
 * `normalizeSessionRecord`): what a query returns is a shape the database
 * happened to hold, not a fact this process established. A column added,
 * renamed or nulled by a migration nobody re-read arrives here as an object
 * that still type-checks.
 *
 * 🚫 **IT DEFAULTS, GENERATES AND INFERS NOTHING.** An unreadable row is
 * refused, 🚫 never repaired. In particular a `modelled` row missing its
 * `subjectKind` does not become `unmapped`, and an `unmapped` row does not
 * acquire a kind: either coercion would turn "AGE could not relate this" into
 * "AGE related this", which is the one lie this store exists to prevent.
 *
 * 🚫 **IT REACHES NO CONCLUSION.** It has no clock, compares no periods, ranks
 * no sources and scores nothing. It decides only whether there is a readable
 * observation here at all — relating is a later, separate step, and believing
 * is not a step AGE has at all (ADR-0069 D5).
 *
 * Pure: no clock, no ids, no randomness, no I/O.
 */

import { type ObservationClaim, CLAIM_DIRECTIONS, MATERIALITY_BANDS } from './observation-claim';
import { type ObservationPeriod, isParseableInstant, isWindowOrdered } from './observation-period';
import { type ClaimKind, CLAIM_KINDS } from './observation-provenance';
import { type ObservationSubject, OBSERVATION_SUBJECT_KINDS } from './observation-subject';

/** Raised when a stored row cannot be read as an observation. */
export class StoredObservationRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoredObservationRefusedError';
  }
}

/**
 * One row of `source_observations`, as AGE reads it back.
 *
 * ⚠️ This is deliberately NOT a `SourceObservationEnvelope`. The envelope
 * carries `provenance.organizationScope` — the scope the SOURCE asserted — and
 * the row does not store it separately, because at record time it was checked
 * against the organisation the observation was recorded under. Rebuilding an
 * envelope from a row would mean inventing that field back, so the read shape
 * says only what the row actually holds.
 */
export interface StoredSourceObservation {
  /** AGE's identity for this observation. 🚫 Never the source's own id. */
  readonly observationId: string;
  /** The tenant (ADR-0062 D1). 🚫 There is no client here, by shape. */
  readonly organizationId: string;
  readonly sourceSystem: string;
  readonly sourceInstance: string;
  /** A REFERENCE back into the source system. 🚫 Never the corpus itself. */
  readonly sourceRecordId: string;
  readonly subject: ObservationSubject;
  readonly claim: ObservationClaim;
  readonly period: ObservationPeriod;
  readonly claimKind: ClaimKind;
  /**
   * When AGE recorded it. ⚠️ 🚫 NOT `period.observedAt`: an operator-mediated
   * relay happens days after the observation, by construction, and a reader who
   * cannot see the gap cannot judge how stale the observation is.
   */
  readonly recordedAt: string;
}

function refuse(column: string, requirement: string): never {
  // ⚠️ The message names a POSITION and a RULE (ADR-0054 D3). 🚫 It never
  // repeats the value: a stored row belongs to a tenant, and a value in a log is
  // that tenant's data in a log.
  throw new StoredObservationRefusedError(
    `A stored observation row is unreadable: \`${column}\` ${requirement}. The row is refused ` +
      'rather than repaired — an observation that cannot be read is one AGE must not relate.',
  );
}

function requiredText(row: Record<string, unknown>, column: string): string {
  const value = row[column];

  if (typeof value !== 'string' || value.trim() === '') {
    refuse(column, 'must be present and non-blank');
  }

  return value;
}

function oneOf<T extends string>(
  row: Record<string, unknown>,
  column: string,
  permitted: readonly T[],
): T {
  const value = requiredText(row, column);

  if (!(permitted as readonly string[]).includes(value)) {
    // 🚫 The permitted set is named, the rejected value is not. A reader who
    // needs to fix the row has the rule; a reader who should not see the data
    // does not get it echoed back.
    refuse(column, `must be one of: ${permitted.join(', ')}`);
  }

  return value as T;
}

function requiredInstant(row: Record<string, unknown>, column: string): string {
  const value = requiredText(row, column);

  if (!isParseableInstant(value)) {
    refuse(column, 'must be a parseable ISO-8601 instant');
  }

  return value;
}

/**
 * 🛑 The subject is TWO SHAPES, and the row is refused unless it is exactly one
 * of them. The CHECK constraint in the migration enforces the same rule in
 * PostgreSQL; this is the second lock, because a row could also arrive from a
 * hand-run migration, a restore, or a query that selected the wrong columns.
 */
function readSubject(row: Record<string, unknown>): ObservationSubject {
  const disposition = oneOf(row, 'subjectDisposition', ['modelled', 'unmapped'] as const);
  const label = requiredText(row, 'subjectLabel');
  const kind = row['subjectKind'];

  if (disposition === 'unmapped') {
    // 🚫 `undefined` lands here on purpose. "The column was not read" must never
    // become "AGE could not relate this" — nor its opposite.
    if (kind !== null) {
      refuse('subjectKind', 'must be exactly `null` when the subject is unmapped');
    }

    return { kind: 'unmapped', topicLabel: label };
  }

  return {
    kind: 'modelled',
    subjectKind: oneOf(row, 'subjectKind', OBSERVATION_SUBJECT_KINDS),
    label,
  };
}

function readPeriod(row: Record<string, unknown>): ObservationPeriod {
  const period: ObservationPeriod = {
    observedAt: requiredInstant(row, 'observedAt'),
    windowStart: requiredInstant(row, 'windowStart'),
    windowEnd: requiredInstant(row, 'windowEnd'),
  };

  if (!isWindowOrdered(period)) {
    refuse('windowEnd', 'must not precede `windowStart`');
  }

  return period;
}

/**
 * @throws {StoredObservationRefusedError} naming the column, 🚫 never its
 *         contents.
 */
export function normalizeStoredObservation(row: unknown): StoredSourceObservation {
  if (typeof row !== 'object' || row === null || Array.isArray(row)) {
    throw new StoredObservationRefusedError(
      'A stored observation row must be an object with the observation columns on it. The row is ' +
        'refused rather than repaired.',
    );
  }

  const source = row as Record<string, unknown>;

  return {
    observationId: requiredText(source, 'observationId'),
    organizationId: requiredText(source, 'organizationId'),
    sourceSystem: requiredText(source, 'sourceSystem'),
    sourceInstance: requiredText(source, 'sourceInstance'),
    sourceRecordId: requiredText(source, 'sourceRecordId'),
    subject: readSubject(source),
    claim: {
      direction: oneOf(source, 'claimDirection', CLAIM_DIRECTIONS),
      materiality: oneOf(source, 'claimMateriality', MATERIALITY_BANDS),
    },
    period: readPeriod(source),
    claimKind: oneOf(source, 'claimKind', CLAIM_KINDS),
    recordedAt: requiredInstant(source, 'recordedAt'),
  };
}
