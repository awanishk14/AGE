/**
 * `@age/assisted-intake` — ADR-0059 **D1, D2, D4 routes 1 and D7**.
 *
 * 🛑 **WHAT THIS PACKAGE MUST NEVER GROW:**
 * - 🚫 A fetch of any kind (D4.3 — refused pending its own ADR, with its own
 *   allow-list decision; an SSRF surface in a process that reads the operator's
 *   local filesystem).
 * - 🚫 An inbound endpoint of any kind (D4.4 — refused, not "later").
 * - 🚫 A model call (D5 — refused; sending a real client's documents to a
 *   vendor is a wider disclosure than a commit, which ADR-0053 D3 already
 *   refuses).
 * - 🚫 A PDF or DOCX decoder (D4.2 — allowed only "subject to naming the
 *   library in a follow-up ADR"; until then such a file is refused BY NAME).
 * - 🚫 An "accept all", a bulk apply, or any confidence threshold (D1).
 * - 🚫 Any number expressing certainty (D3).
 */

export {
  SOURCE_DOCUMENT_KINDS,
  sourceDocumentKindSchema,
  sourceDocumentSchema,
} from './source-document';
export type { SourceDocument, SourceDocumentKind } from './source-document';

export { readSourcePassages, sourcePassageSchema } from './source-passage';
export type { SourcePassage } from './source-passage';

export {
  NOT_EXTRACTED_REASONS,
  describeNotExtracted,
  extractionOutcomeSchema,
  notExtractedReasonSchema,
} from './extraction-outcome';
export type {
  ExtractionOutcome,
  NotExtractedOutcome,
  NotExtractedReason,
  PassagesProposedOutcome,
} from './extraction-outcome';

export { PassageAcceptanceRefusedError, acceptPassageAsAnswer } from './accept-passage';
export type { AcceptPassageAsAnswerOptions } from './accept-passage';

export { SourceDocumentReadError, loadSourceDocument } from './load-source-document';
export type {
  LoadSourceDocumentOptions,
  LoadedSourceDocument,
  SourceFileReader,
} from './load-source-document';

/**
 * ⚠️ Re-exported so a caller of this package still reaches the path refusal
 * rather than writing a second copy of it — ADR-0054 D3 has exactly ONE
 * implementation, in `@age/operator-file-policy`.
 */
export {
  OperatorFilePathRefusedError,
  assertOperatorFilePathOutsideRepository,
} from '@age/operator-file-policy';
