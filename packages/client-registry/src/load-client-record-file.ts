import { assertOperatorFilePathOutsideRepository } from '@age/operator-file-policy';

import { type ClientRecord, findClientRecord, parseClientRecord } from './client-record';

/**
 * ADR-0054 D3 — the real `ClientRecord` is loaded from a local file, by the
 * same rules as the answer file (D2): caller-supplied path, outside the repo,
 * fail-closed parsing, no default.
 *
 * ⚠️ This is a LOADER, not new fixtures. 🚫 Client names and external account
 * ids never enter the repository — not in a fixture, not in a test, not in a
 * commit message, not redacted or masked (ADR-0053 D3). The fictional fixtures
 * stay obviously fictional; that obviousness IS the guard, so nothing here is
 * made "more realistic".
 *
 * ⚠️ This package remains a lookup that performs no I/O. The read is INJECTED,
 * exactly as `@age/discovery-answer-file` and `apps/capture` inject theirs:
 * every DECISION here is pure and the single EFFECT lives at the caller's edge.
 *
 * ⚠️ The record file is UNTRUSTED INPUT and is validated at the boundary
 * (`parseClientRecord`), not trusted because of where it came from.
 */

/** Refusal raised when a client record file cannot be accepted. */
export class ClientRecordFileError extends Error {
  /** The offending clientId, when the refusal is attributable to one. */
  readonly clientId?: string;

  constructor(message: string, clientId?: string) {
    super(message);
    this.name = 'ClientRecordFileError';
    this.clientId = clientId;
  }
}

/** Reads a file's text. Injected — this package never touches the filesystem. */
export type ClientRecordFileReader = (path: string) => string;

export interface LoadClientRecordFileOptions {
  /** Absolute path to the operator-authored file. Required, no default. */
  readonly path: string;
  /** Absolute path to the repository working tree the file must live outside. */
  readonly repositoryRoot: string;
  /** The injected read effect. Required, no default. */
  readonly readFileText: ClientRecordFileReader;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Loads and validates an operator-authored client record file.
 *
 * The file is a JSON object with a `records` array. It is an ARRAY because the
 * operator has more than one client and a per-client file multiplies the number
 * of paths that must each stay outside the repository.
 *
 * 🚫 A duplicate `clientId` is REFUSED rather than resolved. Accepting one of
 * them would mean silently choosing which client a later lookup names — and
 * under D6 that choice reaches a database as a scope.
 *
 * @throws {OperatorFilePathRefusedError} if the path is blank, relative, or
 *         inside the repository working tree — raised before any read.
 * @throws {ClientRecordFileError} if the file cannot be read or parsed, or if a
 *         record is malformed or duplicated.
 */
export function loadClientRecordFile(
  options: LoadClientRecordFileOptions,
): readonly ClientRecord[] {
  const { path, repositoryRoot, readFileText } = options;

  // Order is load-bearing: a refused path must never be opened.
  assertOperatorFilePathOutsideRepository(path, repositoryRoot, 'client record file');

  let rawText: string;
  try {
    rawText = readFileText(path);
  } catch (error) {
    // 🚫 A missing or unreadable file is a REFUSAL, never an empty registry.
    // Degrading to "no records" would turn every subsequent lookup into an
    // "unknown client", hiding the fact that nothing was read at all.
    throw new ClientRecordFileError(
      `The client record file could not be read: ${(error as Error).message}`,
    );
  }

  let document: unknown;
  try {
    document = JSON.parse(rawText) as unknown;
  } catch (error) {
    throw new ClientRecordFileError(
      `The client record file is not valid JSON: ${(error as Error).message}`,
    );
  }

  if (!isPlainObject(document) || !Array.isArray(document.records)) {
    throw new ClientRecordFileError(
      'The client record file must contain a JSON object with a "records" array.',
    );
  }

  if (document.records.length === 0) {
    throw new ClientRecordFileError(
      'The client record file contains no records. An empty file is refused rather than ' +
        'accepted as an empty registry, because every later lookup would then report the ' +
        'client as unknown for the wrong reason.',
    );
  }

  const seen = new Set<string>();

  const records = document.records.map((entry, position): ClientRecord => {
    let record: ClientRecord;
    try {
      record = parseClientRecord(entry);
    } catch (error) {
      // ⚠️ The position is named, NOT the record's contents: a refusal message
      // that echoed the file back could carry a real client name into a log.
      throw new ClientRecordFileError(
        `The record at position ${position} is not a valid ClientRecord: ${(error as Error).message}`,
      );
    }

    if (seen.has(record.clientId)) {
      throw new ClientRecordFileError(
        `clientId "${record.clientId}" appears more than once in the client record file. ` +
          'Accepting one of them would mean choosing silently which client a lookup names.',
        record.clientId,
      );
    }
    seen.add(record.clientId);

    return record;
  });

  return Object.freeze(records);
}

/**
 * Resolve a clientId to its record, or REFUSE.
 *
 * ⚠️ `findClientRecord` returns `undefined` for an unknown id and never invents
 * a record. This is the caller-facing half of that rule: the run REFUSES rather
 * than continuing with a fabricated record, because a fabricated record
 * produces a scope that names nothing — and under ADR-0054 D6 that scope
 * reaches a database, where a mis-scoped row is uncorrectable and invisible to
 * the tenant that should have received it.
 *
 * 🚫 The refusal does NOT list the known ids. The requested id came from the
 * operator and is already theirs; the others are other clients' names.
 *
 * @throws {ClientRecordFileError} if no record carries that clientId.
 */
export function requireClientRecord(
  records: readonly ClientRecord[],
  clientId: string,
): ClientRecord {
  const record = findClientRecord(records, clientId);

  if (record === undefined) {
    throw new ClientRecordFileError(
      `No client record carries the clientId "${clientId}". The run is refused rather than ` +
        'continued with an invented record: a fabricated record would put a scope into ' +
        'circulation that names nothing.',
      clientId,
    );
  }

  return record;
}
