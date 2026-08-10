'use server';

import {
  recordPassageForQuestion,
  type SourceAcceptanceOutcome,
  type SourceDocument,
  type SourcePassage,
} from '@age/studio-shell';

import {
  readOperatorSourceDocument,
  STUDIO_QUESTIONNAIRE,
  type ReadOperatorSourceDocumentOptions,
  type SourceDocumentOutcome,
} from './operator-environment';

/**
 * The two things the operator can do on the Sources screen (ADR-0066 D4).
 *
 * ⚠️ BOTH ARE ACTIONS, never page data. Reading a document on open would make
 * opening a screen the act of reading a real client's file, and an acceptance
 * must be something a named human did, now.
 *
 * 🛑 **NOTHING IS PERSISTED, AND THE SCREEN SAYS SO.** `@age/intake-draft`
 * persists nothing, and durable draft storage is a **separate decision** the
 * Product Owner kept out of D4 (ADR-0066 §0.5a). ⚠️ The consequence is visible
 * and deliberate: each acceptance starts from an EMPTY draft, because there is
 * no draft to carry between requests. 🚫 Do not "fix" that by writing one — the
 * fix is an ADR, not a file.
 */

export async function readSourceDocumentAction(
  options: ReadOperatorSourceDocumentOptions,
): Promise<SourceDocumentOutcome> {
  return readOperatorSourceDocument(options);
}

export interface RecordPassageInput {
  readonly questionId: string;
  readonly passage: SourcePassage;
  readonly source: SourceDocument;
  readonly confirmedBy: string;
}

export async function recordPassageAction(
  input: RecordPassageInput,
): Promise<SourceAcceptanceOutcome> {
  return recordPassageForQuestion({
    questionnaire: STUDIO_QUESTIONNAIRE,
    questionId: input.questionId,
    passage: input.passage,
    source: input.source,
    confirmedBy: input.confirmedBy,
  });
}
