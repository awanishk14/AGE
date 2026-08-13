import { type StoredSourceObservation, normalizeStoredObservation } from '@age/source-observation';

import type { SourceObservationRow } from './source-observation-delegate';

/**
 * The two directions between an observation and its row.
 *
 * 🛑 **READING IS NOT A MAPPING, IT IS A RE-VALIDATION.** `fromSourceObservationRow`
 * is `normalizeStoredObservation` and nothing else: a stored row is untrusted
 * input, and a row that cannot be read is REFUSED rather than repaired. 🚫 Do
 * not add a lenient path here "so the screen still renders" — a partially-read
 * observation is the one outcome worse than stopping.
 *
 * 🚫 **THERE IS EXACTLY ONE READ RULE IN THIS REPOSITORY**, and it lives in
 * `@age/source-observation`. This module re-exports it under a storage-shaped
 * name; 🚫 it must never grow a second, more forgiving copy.
 *
 * ⚠️ Writing carries the subject's TWO SHAPES across faithfully: a `modelled`
 * subject writes its kind, an `unmapped` one writes `null`. 🚫 Neither is
 * defaulted into the other — that coercion would turn "AGE could not relate
 * this" into "AGE related this", which is the lie the store exists to prevent.
 *
 * Pure: no clock, no ids, no randomness, no I/O. `observationId` and
 * `recordedAt` are caller-supplied.
 */

export function toSourceObservationRow(
  observation: Readonly<StoredSourceObservation>,
): SourceObservationRow {
  const { subject } = observation;

  return {
    observationId: observation.observationId,
    organizationId: observation.organizationId,
    sourceSystem: observation.sourceSystem,
    sourceInstance: observation.sourceInstance,
    sourceRecordId: observation.sourceRecordId,
    subjectDisposition: subject.kind,
    // 🛑 `null` on the unmapped arm, explicitly. The CHECK constraint in the
    // migration enforces the same pairing in PostgreSQL.
    subjectKind: subject.kind === 'modelled' ? subject.subjectKind : null,
    subjectLabel: subject.kind === 'modelled' ? subject.label : subject.topicLabel,
    claimDirection: observation.claim.direction,
    claimMateriality: observation.claim.materiality,
    claimKind: observation.claimKind,
    observedAt: observation.period.observedAt,
    windowStart: observation.period.windowStart,
    windowEnd: observation.period.windowEnd,
    recordedAt: observation.recordedAt,
  };
}

/**
 * @throws {StoredObservationRefusedError} naming the column, 🚫 never its
 *         contents.
 */
export function fromSourceObservationRow(row: unknown): StoredSourceObservation {
  return normalizeStoredObservation(row);
}
