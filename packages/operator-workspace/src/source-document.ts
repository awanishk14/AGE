import {
  SourceDocumentReadError,
  describeNotExtracted,
  loadSourceDocument,
  type ExtractionOutcome,
  type SourceDocument,
} from '@age/assisted-intake';
import { OperatorFilePathRefusedError } from '@age/operator-file-policy';

import type { OperatorWorkspaceRuntime } from './operator-workspace-runtime';

/**
 * ADR-0066 **D4**, slice 4 — reading ONE operator-named source document.
 *
 * ⚠️ **THIS IS AN OPERATION, ADDED BY AN ADR, 🚫 NOT A WIDENING.** The package
 * note is explicit that adding an operation is a product decision needing its
 * own ADR; ADR-0066 D4 is that ADR, and slice 4 is the slice it names. 🚫 It
 * adds no member to `OperatorWorkspaceRuntime` — `readFileText` already exists
 * because the console already reads the operator's files.
 *
 * 🚫 **NOTHING HERE FETCHES, LISTENS, DECODES OR CALLS A MODEL.** ADR-0059 D4.2
 * (a PDF/DOCX decoder), D4.3 (a website URL) and D5 (the model call) each remain
 * refused pending their own ADR, and a file that is not plain text comes back as
 * `not-extracted` with the reason `not-plain-text` — 🚫 never as a document that
 * happened to contain nothing (D7).
 */

export type SourceDocumentOutcome =
  | { readonly kind: 'refused'; readonly reason: string }
  | {
      readonly kind: 'read';
      readonly document: SourceDocument;
      /**
       * ⚠️ Reported ALONGSIDE the document. "The document was read" and "the
       * document proposed passages" are different facts, and D7 refuses letting
       * the second silently answer for the first.
       */
      readonly outcome: ExtractionOutcome;
      /**
       * The sentence a surface shows about the extraction.
       *
       * ⚠️ COMPOSED HERE SO THERE IS EXACTLY ONE IMPLEMENTATION of what a
       * `not-extracted` reason means. A client component that re-worded these
       * sentences would be a second copy of a rule, and the copy that drifts is
       * always the one that starts describing the BUSINESS rather than the FILE
       * — which is the D7 failure itself.
       *
       * 🚫 It never contains a count as an assessment: how much text was found
       * says nothing whatever about the business.
       */
      readonly notice: string;
    };

export interface ReadOperatorSourceDocumentOptions {
  /** Absolute path the operator named. Required — 🚫 no default, no search. */
  readonly path: string;
  /** Stable identity for this source. Operator-supplied, 🚫 never generated. */
  readonly sourceId: string;
  /** How the operator refers to it. 🚫 Never derived from the document's text. */
  readonly label: string;
}

/**
 * Reads one plain-text source document and proposes its passages.
 *
 * 🚫 Refusals are RETURNED, never thrown at the surface — the console renders
 * them, and a thrown error would reach a framework error page that says nothing
 * the operator can act on.
 */
export function readOperatorSourceDocument(
  runtime: OperatorWorkspaceRuntime,
  options: ReadOperatorSourceDocumentOptions,
): SourceDocumentOutcome {
  const { path, sourceId, label } = options;

  if (sourceId.trim() === '' || label.trim() === '') {
    // ⚠️ Refused HERE rather than at acceptance, so the operator is told before
    // they read a document that the answer it produces could not point back to
    // it. 🚫 Neither field is generated to get past this (ADR-0049 D2).
    return {
      kind: 'refused',
      reason:
        'A source needs both an identifier and a label before it is read. An answer confirmed ' +
        'from a source that cannot be identified could not be checked afterwards, and AGE does ' +
        'not invent either value.',
    };
  }

  try {
    const loaded = loadSourceDocument({
      path,
      repositoryRoot: runtime.repositoryRoot(),
      sourceId,
      label,
      readFileText: (candidate) => runtime.readFileText(candidate),
    });

    return {
      kind: 'read',
      document: loaded.document,
      outcome: loaded.outcome,
      notice:
        loaded.outcome.kind === 'not-extracted'
          ? describeNotExtracted(loaded.outcome)
          : 'AGE read the document and is showing its own sentences, verbatim. It has decided ' +
            'nothing about this business and has matched no sentence to any question.',
    };
  } catch (error) {
    if (error instanceof OperatorFilePathRefusedError) {
      // ⚠️ This message names a POSITION and the path the operator themselves
      // typed on this screen — the same judgement the client-record operations
      // already make.
      return { kind: 'refused', reason: error.message };
    }

    if (error instanceof SourceDocumentReadError) {
      // 🚫 The underlying message is NOT surfaced: it embeds the system error,
      // which embeds the operator's own directory layout.
      return {
        kind: 'refused',
        reason:
          'That source document could not be read. 🚫 This is not the same as the document ' +
          'being empty — nothing was read, so nothing was inferred from it.',
      };
    }

    return {
      kind: 'refused',
      reason: 'The source document could not be used, and the failure was not recognised.',
    };
  }
}
