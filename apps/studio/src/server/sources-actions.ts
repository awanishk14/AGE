'use server';

import type { SourceDocument, SourcePassage } from '@age/studio-shell';

import {
  readOperatorSourceDocument,
  readSourceConfirmations,
  recordSourceConfirmation,
  type ReadOperatorSourceDocumentOptions,
  type RecordSourceConfirmationOutcome,
  type SourceConfirmationsOutcome,
  type SourceDocumentOutcome,
} from './operator-environment';

/**
 * The things the operator can do on the Sources screen (ADR-0066 D4, ADR-0073).
 *
 * ⚠️ READING A DOCUMENT AND ACCEPTING A PASSAGE ARE BOTH ACTIONS, never page
 * data. Reading a document on open would make opening a screen the act of
 * reading a real client's file, and an acceptance must be something a named
 * human did, now.
 *
 * 🛑 **AN ACCEPTANCE IS NOW KEPT — IN THE OPERATOR'S OWN WORKSPACE, AND NOWHERE
 * ELSE** (ADR-0073 D1). Until ADR-0073 each acceptance started from an EMPTY
 * draft, so the second confirmation on one document erased the first; the
 * Product Owner fired ADR-0067's own named revisit trigger and that decision was
 * reopened. 🚫 Nothing reaches a database, AGE or a peer, 🚫 the answer file is
 * untouched, and 🚫 a failed write is reported as a refusal rather than
 * swallowed (D7).
 */

export async function readSourceDocumentAction(
  options: ReadOperatorSourceDocumentOptions,
): Promise<SourceDocumentOutcome> {
  return readOperatorSourceDocument(options);
}

export async function readSourceConfirmationsAction(
  clientId: string,
): Promise<SourceConfirmationsOutcome> {
  return readSourceConfirmations(clientId);
}

export interface RecordPassageInput {
  /** ⚠️ Required. A confirmation belongs to ONE business — 🚫 never defaulted. */
  readonly clientId: string;
  readonly questionId: string;
  readonly passage: SourcePassage;
  readonly source: SourceDocument;
  readonly confirmedBy: string;
}

export async function recordPassageAction(
  input: RecordPassageInput,
): Promise<RecordSourceConfirmationOutcome> {
  return recordSourceConfirmation(input.clientId, {
    questionId: input.questionId,
    passage: input.passage,
    source: input.source,
    confirmedBy: input.confirmedBy,
  });
}
