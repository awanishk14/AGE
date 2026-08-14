import { z } from 'zod';

import { sourcePassageSchema, type SourcePassage } from './source-passage';

/**
 * ADR-0059 **D7** — an empty extraction is NOT "no information".
 *
 * The failure this whole track invites: a source is read, nothing matches, and
 * the screen renders as though the business has no offerings. So reading a
 * document does not return a list that may happen to be empty. It returns one
 * of two outcomes, and the empty one has to say WHY, by name.
 *
 * 🚫 **NO COUNT IS AN ASSESSMENT.** `passages.length` says how much text was
 * found; it says nothing whatever about the business, and a caller that renders
 * it as a score has made the mistake D7 exists to prevent.
 *
 * 🚫 **NO NUMBER EXPRESSES CERTAINTY** (D3). There is no extraction confidence
 * anywhere in this package — not on a passage, not on an outcome. An extractor's
 * certainty is a property of a parser, and one refactor from being scored beside
 * `discoveryConfidenceScore`, which measures the interview.
 */

/**
 * Why nothing could be proposed. Each value is a statement about the DOCUMENT,
 * never about the business it describes.
 */
export const NOT_EXTRACTED_REASONS = [
  'empty-document',
  'no-readable-passages',
  'not-plain-text',
  'could-not-decode',
  'decoded-no-text',
] as const;

export type NotExtractedReason = (typeof NOT_EXTRACTED_REASONS)[number];

export const notExtractedReasonSchema = z.enum(NOT_EXTRACTED_REASONS);

export interface PassagesProposedOutcome {
  readonly kind: 'passages-proposed';
  readonly sourceId: string;
  readonly passages: readonly SourcePassage[];
}

export interface NotExtractedOutcome {
  readonly kind: 'not-extracted';
  readonly sourceId: string;
  readonly reason: NotExtractedReason;
}

export type ExtractionOutcome = PassagesProposedOutcome | NotExtractedOutcome;

export const extractionOutcomeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('passages-proposed'),
    sourceId: z.string().min(1),
    // ⚠️ Non-empty by construction: "proposed nothing" is `not-extracted` with
    // a reason, so an empty list here would be the very state D7 refuses,
    // wearing the successful arm's name.
    passages: z.array(sourcePassageSchema).min(1),
  }),
  z.object({
    kind: z.literal('not-extracted'),
    sourceId: z.string().min(1),
    reason: notExtractedReasonSchema,
  }),
]);

/** The sentence a surface shows. Never blank, and never a number. */
export function describeNotExtracted(outcome: NotExtractedOutcome): string {
  switch (outcome.reason) {
    case 'empty-document':
      return 'That document is empty, so nothing was proposed from it. This is a statement about the file, not about the business.';
    case 'no-readable-passages':
      return 'That document contains no readable text passages, so nothing was proposed from it. This is a statement about the file, not about the business.';
    case 'not-plain-text':
      return 'That file is not plain text and is not a PDF, so AGE did not read it. AGE decodes PDF only; DOCX needs a second decoder, and adopting one is a decision that has not been made — nothing was inferred from the bytes.';
    case 'could-not-decode':
      // 🛑 ADR-0070 D3. 🚫 NOT "the document was empty" and 🚫 NOT a fallback to
      // showing raw bytes: AGE was handed a PDF, could not open it, and says so.
      return 'That file says it is a PDF, and AGE could not open it — it may be damaged or password-protected. Nothing was read and nothing was inferred from the bytes. This is a statement about the file, not about the business.';
    case 'decoded-no-text':
      // ⚠️ Kept apart from `empty-document` ON PURPOSE. A scan has words a human
      // can see and AGE cannot; reading them would be OCR, refused by name
      // (ADR-0070 D4). Telling the operator "this document is empty" would be
      // false, and would send them looking for a different document.
      return 'AGE opened that PDF and it contains no text layer — this is what a scanned or photographed document looks like. AGE does not read images of text, so nothing was proposed. This is a statement about the file, not about the business, and the document may well be full of writing.';
  }
}
