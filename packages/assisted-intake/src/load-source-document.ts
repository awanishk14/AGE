import { assertOperatorFilePathOutsideRepository } from '@age/operator-file-policy';

import type { ExtractionOutcome } from './extraction-outcome';
import { readSourcePassages } from './source-passage';
import type { SourceDocument } from './source-document';

/**
 * ADR-0059 D4 route 1, wired to ADR-0054 D2 — the path policy runs BEFORE
 * anything is read, and only then is the document split into passages.
 *
 * ⚠️ This package performs NO I/O. The read is INJECTED, exactly as
 * `@age/discovery-answer-file` injects its reader: every DECISION here is pure,
 * and the single EFFECT lives at the caller's edge.
 *
 * 🚫 The only capability handed in is a READER — there is no writer, no fetcher
 * and no client. The answer file cannot be modified from this path, and 🚫 a
 * `fetch` here would be ADR-0059 D4.3, which is refused pending its own ADR.
 *
 * 🚫 No default path and no default reader (ADR-0049 D2).
 */

/** Reads a file's text. Injected — this package never touches the filesystem. */
export type SourceFileReader = (path: string) => string;

/** Raised when the source file itself could not be read. */
export class SourceDocumentReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceDocumentReadError';
  }
}

export interface LoadSourceDocumentOptions {
  /** Absolute path to the operator's document. Required, no default. */
  readonly path: string;
  /** Absolute path to the repository working tree the file must live outside. */
  readonly repositoryRoot: string;
  /** Stable identity for this source. Caller-supplied; never generated here. */
  readonly sourceId: string;
  /** How the operator refers to the document. Never derived from its text. */
  readonly label: string;
  /** The injected read effect. Required, no default. */
  readonly readFileText: SourceFileReader;
}

export interface LoadedSourceDocument {
  readonly document: SourceDocument;
  /**
   * ⚠️ Reported ALONGSIDE the document, never in place of it. D7: "sources
   * read" and "facts found" are different counts, so a caller can always say
   * that a document WAS read even when it proposed nothing.
   */
  readonly outcome: ExtractionOutcome;
}

/**
 * Reads one operator-chosen plain-text document and proposes its passages.
 *
 * @throws {OperatorFilePathRefusedError} if the path is blank, relative or
 *         inside the repository working tree — raised before any read.
 * @throws {SourceDocumentReadError} if the file could not be read at all.
 *         🚫 Never degraded to "the document was empty": a file that was never
 *         opened and a file with nothing in it are different facts.
 */
export function loadSourceDocument(options: LoadSourceDocumentOptions): LoadedSourceDocument {
  const { path, repositoryRoot, sourceId, label, readFileText } = options;

  // Order is load-bearing: a refused path must never be opened.
  assertOperatorFilePathOutsideRepository(path, repositoryRoot, 'source document');

  let text: string;
  try {
    text = readFileText(path);
  } catch (error) {
    throw new SourceDocumentReadError(
      `The source document could not be read: ${(error as Error).message}`,
    );
  }

  const document: SourceDocument = Object.freeze({
    sourceId,
    label,
    kind: 'plain-text',
    locator: path,
    text,
  });

  return Object.freeze({ document, outcome: readSourcePassages(document) });
}
