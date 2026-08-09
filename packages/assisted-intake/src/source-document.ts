import { z } from 'zod';

/**
 * ADR-0059 D4 **route 1** — a plain-text file the operator already has, chosen
 * by them, read from an absolute path outside the repository (ADR-0054 D2).
 *
 * 🚫 **ROUTE 2 (PDF / DOCX) IS NOT IMPLEMENTED HERE, AND MUST NOT BE ADDED
 * WITHOUT ITS OWN ADR.** D4 allows it "subject to naming the library in a
 * follow-up ADR" — a decoder is a dependency that runs over a real client's
 * documents, and which one it is is the decision. Until that ADR exists, a file
 * that is not text is REFUSED BY NAME (`not-plain-text`), never silently
 * decoded and never rendered as a document containing nothing (D7).
 *
 * 🚫 **ROUTE 3 (a website URL) and ROUTE 4 (a widget) are REFUSED.** Nothing in
 * this package fetches, and nothing in it listens.
 *
 * Pure: no clock, no id generation, no randomness, no I/O. The document's bytes
 * arrive as a string from the caller.
 */

/**
 * The only source kind this package can read.
 *
 * ⚠️ A single-member union rather than a bare string, so that adding a kind is
 * a visible, reviewable edit in a file that says an ADR is required first.
 */
export const SOURCE_DOCUMENT_KINDS = ['plain-text'] as const;

export type SourceDocumentKind = (typeof SOURCE_DOCUMENT_KINDS)[number];

export const sourceDocumentKindSchema = z.enum(SOURCE_DOCUMENT_KINDS);

export interface SourceDocument {
  /**
   * Stable identity of this source, supplied by the caller. It is what a
   * `confirmed-from-source` provenance points back to, so it is never
   * generated here (ADR-0049 D2 — a generated id is an unfalsifiable one).
   */
  readonly sourceId: string;
  /** How the operator refers to this document. Never derived from its text. */
  readonly label: string;
  readonly kind: SourceDocumentKind;
  /** Where the document came from, recorded verbatim and never parsed. */
  readonly locator: string;
  /** The document's text. */
  readonly text: string;
}

export const sourceDocumentSchema = z.object({
  sourceId: z.string().min(1),
  label: z.string().min(1),
  kind: sourceDocumentKindSchema,
  locator: z.string().min(1),
  text: z.string(),
});
