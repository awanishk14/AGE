import { z } from 'zod';

import type { ExtractionOutcome } from './extraction-outcome';
import type { SourceDocument } from './source-document';

/**
 * ADR-0059 **D1** — assisted intake PROPOSES; it never ANSWERS.
 *
 * ⚠️ **AND IT PROPOSES PASSAGES, NOT ANSWERS TO QUESTIONS.** This is the whole
 * design, and it is what D5 already describes: _"a source document plus a human
 * choosing which sentence answers which question is the whole mechanism"_. So a
 * passage is NOT bound to a question here, and nothing in this package decides
 * which question a sentence belongs to.
 *
 * 🚫 That is deliberate, and it is ADR-0050 D2 one level up: guessing that a
 * paragraph answers `bi-model` is an INFERENCE about a real business, made from
 * wording, by AGE. The human makes that judgement. AGE only shows them what the
 * document actually says, and where.
 *
 * ⚠️ The consequence is that this needs **no model at all** — D5 stays refused
 * and nothing here is a step toward it.
 *
 * A passage is a verbatim span of the document. 🚫 It is never rewritten,
 * summarised, normalised or re-cased; the text a human accepts is the text the
 * document contained.
 */

export interface SourcePassage {
  /**
   * Identity of this passage within its source. Derived from the position it
   * was found at, so it is stable for the same bytes and carries no clock.
   */
  readonly passageId: string;
  /**
   * Where in the document this text is, in words a human can check against the
   * file they chose. ⚠️ Opaque to AGE — recorded and displayed, never parsed.
   */
  readonly locator: string;
  /** The document's own words, verbatim. */
  readonly text: string;
}

export const sourcePassageSchema = z.object({
  passageId: z.string().min(1),
  locator: z.string().min(1),
  text: z.string().min(1),
});

/**
 * A byte that no plain-text document contains, and the cheapest honest signal
 * that the operator pointed at a PDF, a DOCX or an image. ⚠️ It is a REFUSAL
 * trigger, not a decoder hint — see `source-document.ts`.
 */
const BINARY_MARKER = '\u0000';

/** A passage must contain at least one letter or digit — see the filter below. */
const HAS_READABLE_CHARACTER = /[\p{L}\p{N}]/u;

/** Paragraphs are separated by a blank line. Nothing subtler is inferred. */
const PARAGRAPH_BREAK = /\r?\n[ \t]*\r?\n/;

function describeLines(firstLine: number, lastLine: number): string {
  return firstLine === lastLine ? `line ${firstLine}` : `lines ${firstLine}–${lastLine}`;
}

/**
 * Splits a source document into the passages a human may choose from.
 *
 * @returns `passages-proposed` when there is text to show, and `not-extracted`
 *          WITH A REASON otherwise — never an empty success (ADR-0059 D7).
 */
export function readSourcePassages(document: SourceDocument): ExtractionOutcome {
  const { sourceId, text } = document;

  if (text.includes(BINARY_MARKER)) {
    return { kind: 'not-extracted', sourceId, reason: 'not-plain-text' };
  }

  if (text.trim() === '') {
    return { kind: 'not-extracted', sourceId, reason: 'empty-document' };
  }

  const passages: SourcePassage[] = [];
  let line = 1;

  for (const block of text.split(PARAGRAPH_BREAK)) {
    const lines = block.split(/\r?\n/);
    const blockFirstLine = line;
    // The separator that was consumed is itself a blank line, so the next block
    // starts two lines on. Counting this out rather than re-scanning keeps the
    // locator checkable against what the operator sees in their editor.
    line = blockFirstLine + lines.length + 1;

    // ⚠️ The locator spans the lines that actually carry text, not the block's
    // outer whitespace. A trailing blank line inside a block would otherwise
    // widen the citation to a line the operator can see is empty.
    const firstIndex = lines.findIndex((entry) => entry.trim() !== '');
    if (firstIndex === -1) continue;
    let lastIndex = lines.length - 1;
    while (lines[lastIndex]?.trim() === '') lastIndex -= 1;

    const firstLine = blockFirstLine + firstIndex;
    const lastLine = blockFirstLine + lastIndex;

    const passageText = block.trim();
    // ⚠️ A block of rules, bullets or `---` separators carries no letter or
    // digit, and offering it as something a human might accept as a business
    // fact is noise dressed as a proposal. 🚫 This is the ONLY content
    // judgement in the module, and it is about TYPOGRAPHY, never about meaning
    // — nothing here reads the words (ADR-0050 D2).
    if (passageText === '' || !HAS_READABLE_CHARACTER.test(passageText)) continue;

    passages.push(
      Object.freeze({
        passageId: `${sourceId}#${String(passages.length + 1)}`,
        locator: describeLines(firstLine, lastLine),
        text: passageText,
      }),
    );
  }

  if (passages.length === 0) {
    return { kind: 'not-extracted', sourceId, reason: 'no-readable-passages' };
  }

  return Object.freeze({ kind: 'passages-proposed', sourceId, passages: Object.freeze(passages) });
}
