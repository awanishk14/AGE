import {
  SourceDocumentReadError,
  describeNotExtracted,
  loadSourceDocument,
  type ExtractionOutcome,
  type SourceDocument,
  type SourceDocumentKind,
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
 * 🚫 **NOTHING HERE FETCHES, LISTENS OR CALLS A MODEL.** ADR-0059 D4.3 (a
 * website URL), D4.4 (a widget) and D5 (the model call) each remain refused, and
 * ADR-0070 D4 refuses OCR by name.
 *
 * ⚠️ **DECODING IS NOW POSSIBLE, AND 🚫 THIS MODULE STILL DOES NONE OF IT.** The
 * decoder is handed in by the surface (ADR-0070 D1) — this module only composes
 * it with the runtime's reads and hands the result to the pure loader. 🚫 Do not
 * import a decoder here: which library touches a real client's documents is the
 * Product Owner's decision, and a package that imports one has taken it.
 *
 * 🛑 **A FILE AGE CANNOT TURN INTO TEXT COMES BACK AS `not-extracted` WITH A
 * REASON** — 🚫 never as a document that happened to contain nothing (D7), and
 * 🚫 never as raw bytes rendered as though the business had written them
 * (ADR-0070 D3).
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

/**
 * The decoder, as this package sees it (ADR-0070 D1).
 *
 * 🛑 **STRUCTURALLY TYPED, 🚫 NOT IMPORTED.** `@age/operator-workspace` must not
 * depend on `@age/operator-document-decoder`, because a dependency here would
 * put `unpdf` behind every surface that binds this package — including
 * `apps/mcp`, which is authorized to decode nothing. The console supplies it;
 * this package only names the shape it needs.
 */
export type OperatorDocumentDecoder = (
  bytes: Uint8Array,
) => Promise<
  | { readonly kind: 'decoded'; readonly documentKind: SourceDocumentKind; readonly text: string }
  | { readonly kind: 'decoded-no-text'; readonly documentKind: SourceDocumentKind }
  | { readonly kind: 'could-not-decode'; readonly documentKind: SourceDocumentKind }
  | { readonly kind: 'no-decoder' }
>;

export interface ReadOperatorSourceDocumentOptions {
  /** Absolute path the operator named. Required — 🚫 no default, no search. */
  readonly path: string;
  /** Stable identity for this source. Operator-supplied, 🚫 never generated. */
  readonly sourceId: string;
  /** How the operator refers to it. 🚫 Never derived from the document's text. */
  readonly label: string;
}

/**
 * How AGE obtained this document's text, in words (ADR-0070).
 *
 * ⚠️ **EXACTLY ONE IMPLEMENTATION, HERE**, for the same reason
 * `describeNotExtracted` has one: a client component that re-worded these would
 * be a second copy of a rule, and the copy that drifts is always the one that
 * starts describing the BUSINESS rather than the FILE.
 *
 * 🚫 **NEITHER SENTENCE RANKS THE OTHER.** A decoded PDF is not "lower quality"
 * evidence — provenance alone never changes a score. What differs is what the
 * operator should check: with a decode, whether the extraction matches the page.
 */
function describeHowItWasRead(kind: SourceDocumentKind): string {
  switch (kind) {
    case 'plain-text':
      return 'AGE read the file’s characters directly and is showing its own sentences, verbatim.';
    case 'decoded-pdf':
      return (
        'AGE decoded this PDF on your machine and is showing the text that came out, verbatim. ' +
        'Nothing was sent anywhere to decode it. Check the passages against the page before you ' +
        'accept one: a decoder reports the text a PDF carries, which is not always the order or ' +
        'the wording a reader sees.'
      );
  }
}

/**
 * Reads one operator-named source document and proposes its passages.
 *
 * 🚫 Refusals are RETURNED, never thrown at the surface — the console renders
 * them, and a thrown error would reach a framework error page that says nothing
 * the operator can act on.
 */
export async function readOperatorSourceDocument(
  runtime: OperatorWorkspaceRuntime,
  decode: OperatorDocumentDecoder,
  options: ReadOperatorSourceDocumentOptions,
): Promise<SourceDocumentOutcome> {
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
    const loaded = await loadSourceDocument({
      path,
      repositoryRoot: runtime.repositoryRoot(),
      sourceId,
      label,
      readFileText: async (candidate) => {
        // ⚠️ BYTES FIRST, ALWAYS. The document's own header decides what it is
        // — 🚫 never the extension the operator happened to type.
        const decoded = await decode(runtime.readFileBytes(candidate));

        switch (decoded.kind) {
          case 'decoded':
            return { kind: 'text', documentKind: decoded.documentKind, text: decoded.text };
          case 'decoded-no-text':
            return {
              kind: 'not-extracted',
              documentKind: decoded.documentKind,
              reason: 'decoded-no-text',
            };
          case 'could-not-decode':
            return {
              kind: 'not-extracted',
              documentKind: decoded.documentKind,
              reason: 'could-not-decode',
            };
          case 'no-decoder':
            // ⚠️ 🚫 NOT a failure — this is the ORIGINAL route-1 path, unchanged.
            // The file is re-read as characters rather than decoding the bytes
            // here, so 🚫 no second implementation of "bytes to text" grows in
            // this package. ⚠️ The cost is one extra read of a local file; the
            // benefit is that the runtime stays the only thing that decodes
            // characters, which is what the effect-isolation guard checks.
            return {
              kind: 'text',
              documentKind: 'plain-text',
              text: runtime.readFileText(candidate),
            };
        }
      },
    });

    return {
      kind: 'read',
      document: loaded.document,
      outcome: loaded.outcome,
      notice:
        loaded.outcome.kind === 'not-extracted'
          ? describeNotExtracted(loaded.outcome)
          : `${describeHowItWasRead(loaded.document.kind)} It has decided nothing about this ` +
            'business and has matched no sentence to any question.',
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
