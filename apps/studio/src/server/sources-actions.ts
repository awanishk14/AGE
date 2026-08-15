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
import { requireVerifiedSession } from './session-boundary';

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
 *
 * 🛑 **EVERY ONE OF THEM ESTABLISHES ITS OWN ENTITLEMENT** (AGE-INV-SEL-1,
 * ADR-0074 §7 slice 3). A `'use server'` function is a BROWSER-REACHABLE
 * ENDPOINT; the boundary on the page that renders the screen protects the PAGE
 * and 🚫 nothing else.
 */

/**
 * ⚠️ **THIS ONE NAMES NO BUSINESS, AND THE SESSION CHECK IS STILL REQUIRED.**
 * It opens a file on the operator's own machine by PATH. There is no
 * `clientId` to narrow, so 🚫 there is nothing here for AGE-INV-SEL-1 to filter
 * — but an unauthenticated caller must not be able to read an operator's
 * filesystem through it, so the door is closed on the session alone.
 */
export async function readSourceDocumentAction(
  options: ReadOperatorSourceDocumentOptions,
): Promise<SourceDocumentOutcome> {
  await requireVerifiedSession();

  return readOperatorSourceDocument(options);
}

export async function readSourceConfirmationsAction(
  clientId: string,
): Promise<SourceConfirmationsOutcome> {
  const session = await requireVerifiedSession();

  return readSourceConfirmations(session.organizationId, clientId);
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
  const session = await requireVerifiedSession();

  return recordSourceConfirmation(session.organizationId, input.clientId, {
    questionId: input.questionId,
    passage: input.passage,
    source: input.source,
    confirmedBy: input.confirmedBy,
  });
}
