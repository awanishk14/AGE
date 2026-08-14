import { z } from 'zod';

/**
 * ADR-0059 D4 **routes 1 and 2** — a file the operator already has, chosen by
 * them, read from an absolute path outside the repository (ADR-0054 D2).
 *
 * ⚠️ **ROUTE 2 IS NOW OPEN FOR PDF ONLY, AND 🚫 THIS PACKAGE STILL DOES NO
 * DECODING.** ADR-0070 D2 was answered by the Product Owner — option **D**,
 * `unpdf`, PDF only — and D1 puts the library in `@age/operator-document-decoder`
 * at the console's edge, 🚫 never here. So this package gains 🚫 no dependency,
 * 🚫 no `node:fs`, 🚫 no buffer handling and 🚫 no branch on a file extension: it
 * receives TEXT plus a statement of HOW that text was obtained, and it stays the
 * one place extraction *semantics* live.
 *
 * 🚫 **DOCX IS STILL NOT DECODED.** Option B (`mammoth`) was DEFERRED to its own
 * slice, 🚫 not adopted — a DOCX is still `not-plain-text`, refused by name.
 *
 * 🚫 **ROUTE 3 (a website URL) and ROUTE 4 (a widget) are REFUSED.** Nothing in
 * this package fetches, and nothing in it listens.
 *
 * Pure: no clock, no id generation, no randomness, no I/O. The document's text
 * arrives as a string from the caller.
 */

/**
 * How AGE obtained this document's text.
 *
 * 🛑 **THIS IS RECORDED BECAUSE IT IS DIFFERENT INFORMATION, 🚫 NOT BECAUSE IT
 * RANKS.** "AGE read the file's characters" and "AGE ran a decoder over a PDF
 * and used what came out" are different claims about how faithful the text is,
 * and an operator checking a passage against their document needs to know which
 * one they are looking at. 🚫 **IT IS NEVER A QUALITY SIGNAL AND NEVER TOUCHES A
 * SCORE** — provenance alone never changes a score.
 *
 * ⚠️ An explicit union rather than a bare string, so that adding a kind is a
 * visible, reviewable edit in a file that says an ADR is required first.
 */
export const SOURCE_DOCUMENT_KINDS = ['plain-text', 'decoded-pdf'] as const;

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
