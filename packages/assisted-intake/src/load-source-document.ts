import { assertOperatorFilePathOutsideRepository } from '@age/operator-file-policy';

import type { ExtractionOutcome, NotExtractedReason } from './extraction-outcome';
import { readSourcePassages } from './source-passage';
import type { SourceDocument, SourceDocumentKind } from './source-document';

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

/**
 * What the caller's reader came back with.
 *
 * 🛑 **TEXT NEVER ARRIVES WITHOUT A STATEMENT OF HOW IT WAS OBTAINED**, and a
 * decode failure never arrives as text at all (ADR-0070 D3). That is why this is
 * a union rather than a `string`: a reader that could only return a string would
 * have to signal "I could not decode this" by returning `''`, and an empty
 * string is indistinguishable from an empty document — the exact collapse
 * ADR-0059 D7 exists to prevent.
 */
export type SourceTextRead =
  | {
      readonly kind: 'text';
      /** ⚠️ How it was obtained. 🚫 Never a quality signal, 🚫 never scored. */
      readonly documentKind: SourceDocumentKind;
      readonly text: string;
    }
  | {
      /**
       * 🛑 The caller HAS the document and could not turn it into text. 🚫 This
       * is never degraded to empty text, and 🚫 never to raw bytes as text.
       */
      readonly kind: 'not-extracted';
      readonly documentKind: SourceDocumentKind;
      readonly reason: Extract<NotExtractedReason, 'could-not-decode' | 'decoded-no-text'>;
    };

/**
 * Reads a file's text. Injected — 🚫 this package never touches the filesystem,
 * and 🚫 never decides what format a file is: the caller does both, at the edge
 * where the decoder lives (ADR-0070 D1).
 */
export type SourceFileReader = (path: string) => Promise<SourceTextRead>;

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
export async function loadSourceDocument(
  options: LoadSourceDocumentOptions,
): Promise<LoadedSourceDocument> {
  const { path, repositoryRoot, sourceId, label, readFileText } = options;

  // 🛑 ORDER IS THE PROOF, 🚫 not a promise: a refused path must never be
  // opened, so the policy runs BEFORE the await and before any read. ⚠️ Making
  // this function async did not move it — 🚫 do not reorder it behind a decode.
  assertOperatorFilePathOutsideRepository(path, repositoryRoot, 'source document');

  let read: SourceTextRead;
  try {
    read = await readFileText(path);
  } catch (error) {
    throw new SourceDocumentReadError(
      `The source document could not be read: ${(error as Error).message}`,
    );
  }

  if (read.kind === 'not-extracted') {
    // ⚠️ The document is still REPORTED — the operator named a file and AGE
    // holds it. 🚫 Its `text` is empty because there is none, and the outcome
    // beside it says why in its own words, so 🚫 no surface can render this as a
    // document that happened to contain nothing (D7).
    const document: SourceDocument = Object.freeze({
      sourceId,
      label,
      kind: read.documentKind,
      locator: path,
      text: '',
    });

    return Object.freeze({
      document,
      outcome: Object.freeze({ kind: 'not-extracted', sourceId, reason: read.reason }),
    });
  }

  const document: SourceDocument = Object.freeze({
    sourceId,
    label,
    kind: read.documentKind,
    locator: path,
    text: read.text,
  });

  return Object.freeze({ document, outcome: readSourcePassages(document) });
}
