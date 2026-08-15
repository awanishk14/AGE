import { join } from 'node:path';

import type { DiscoveryAnswer } from '@age/business-discovery-contracts';
import { emptyIntakeDraft, type IntakeDraft } from '@age/intake-draft';
import type { SourceDocument, SourcePassage } from '@age/assisted-intake';
import {
  parseSourceConfirmedAnswers,
  recordPassageForQuestion,
  renderSourceConfirmedAnswers,
  sourceConfirmedFileNameFor,
  SourceConfirmedAnswersError,
  UnsafeClientIdError,
  type DraftStorageState,
  type SourceAcceptanceOutcome,
} from '@age/studio-shell';

import type { OperatorWorkspaceRuntime } from './operator-workspace-runtime';
import { resolveWorkspaceDirectory, STUDIO_QUESTIONNAIRE } from './workspace-directory';

/**
 * ADR-0073 D1 — the confirmations a human accepted from a source, kept in the
 * operator's own workspace so the next one does not start from nothing.
 *
 * ⚠️ **WHY THIS MODULE EXISTS.** Until ADR-0073, `recordPassageForQuestion`
 * recorded into `emptyIntakeDraft()` and returned it, so a second confirmation on
 * the same document had never heard of the first. ADR-0067 had decided that
 * deliberately — and the Product Owner then fired its own named revisit trigger.
 *
 * 🛑 **READ, RECORD, WRITE — IN THAT ORDER, AND THE READ IS LOAD-BEARING.** The
 * new answer is added to what is actually on disk, never to what a screen was
 * showing. Without that, a second console or a hand edit made since the page
 * loaded would be silently overwritten, and the duplicate refusal — the one guard
 * that protects a recorded origin — would never fire.
 *
 * 🚫 **`@age/intake-draft` STILL PERSISTS NOTHING** (D3). The reading and writing
 * are here; the draft package is unchanged and its purity guard still holds.
 *
 * 🚫 **NOTHING HERE IS CANONICAL.** These answers reach the profile only through
 * the same explicit path the Answer File uses, and 🚫 no scorer, capability or
 * persistence module may read this file.
 */

export type SourceConfirmationsOutcome =
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'refused'; readonly reason: string }
  | {
      readonly kind: 'loaded';
      readonly draft: IntakeDraft;
      /**
       * ⚠️ Distinguishes "nobody has confirmed anything yet" from "we could not
       * look". 🚫 An empty draft must never be shown as though a file was read
       * and found to hold nothing.
       */
      readonly everSaved: boolean;
    };

/** Where the confirmations live for one business, or why they cannot. */
function resolveSourceConfirmedPath(
  runtime: OperatorWorkspaceRuntime,
  clientId: string,
):
  | { readonly kind: 'ready'; readonly path: string; readonly directory: string }
  | Exclude<SourceConfirmationsOutcome, { kind: 'loaded' }> {
  const workspace = resolveWorkspaceDirectory(runtime);
  if (workspace.kind !== 'ready') {
    return workspace;
  }

  try {
    return {
      kind: 'ready',
      directory: workspace.directory,
      path: join(workspace.directory, sourceConfirmedFileNameFor(clientId)),
    };
  } catch (error) {
    if (error instanceof UnsafeClientIdError) {
      return { kind: 'refused', reason: error.message };
    }
    throw error;
  }
}

/**
 * Read what has already been confirmed from sources for this business.
 *
 * 🚫 A file that exists and cannot be parsed REFUSES. It does not fall back to an
 * empty draft: starting over would let the next confirmation be written on top of
 * work the operator can still see in that file.
 */
export function readSourceConfirmations(
  runtime: OperatorWorkspaceRuntime,
  clientId: string,
): SourceConfirmationsOutcome {
  const located = resolveSourceConfirmedPath(runtime, clientId);
  if (located.kind !== 'ready') {
    return located;
  }

  if (!runtime.fileExists(located.path)) {
    // ⚠️ The ordinary state of a business nobody has read a document for.
    return { kind: 'loaded', draft: emptyIntakeDraft(), everSaved: false };
  }

  let rawText: string;
  try {
    rawText = runtime.readFileText(located.path);
  } catch {
    // 🚫 The system error is not surfaced: it embeds the full path. And 🚫 this
    // is NOT the no-file branch — the file is there and could not be opened.
    return {
      kind: 'refused',
      reason:
        'The source confirmations for this business could not be read. Nothing is shown rather ' +
        'than an empty list, which would look exactly like a business nobody has read a document ' +
        'for.',
    };
  }

  try {
    return {
      kind: 'loaded',
      draft: { answers: parseSourceConfirmedAnswers(rawText, STUDIO_QUESTIONNAIRE) },
      everSaved: true,
    };
  } catch (error) {
    if (error instanceof SourceConfirmedAnswersError) {
      return { kind: 'refused', reason: error.message };
    }
    return { kind: 'refused', reason: 'The source confirmations could not be read.' };
  }
}

export interface RecordSourceConfirmationOptions {
  readonly questionId: string;
  /** Exactly one passage. 🚫 There is no bulk arm — ADR-0059 D1, ADR-0073 D6. */
  readonly passage: SourcePassage;
  readonly source: SourceDocument;
  /** Who accepted it. Required, never defaulted or inferred (ADR-0053 D4). */
  readonly confirmedBy: string;
}

export type RecordSourceConfirmationOutcome =
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'refused'; readonly questionId?: string; readonly reason: string }
  | {
      readonly kind: 'recorded';
      readonly answer: DiscoveryAnswer;
      /** Every confirmation for this business, including the new one. */
      readonly draft: IntakeDraft;
      readonly storage: DraftStorageState;
    };

/**
 * Record one human's acceptance of one passage, durably.
 *
 * 🛑 **THE WRITE IS THE LAST STEP, AND A FAILED WRITE IS REPORTED AS A REFUSAL**
 * (ADR-0073 D7). 🚫 It is never swallowed and 🚫 never reported as a recorded
 * acceptance: an operator who believes a confirmation is durable when it is not
 * would lose work without ever being told, which is worse than the evaporating
 * draft this replaces.
 */
export function recordSourceConfirmation(
  runtime: OperatorWorkspaceRuntime,
  clientId: string,
  options: RecordSourceConfirmationOptions,
): RecordSourceConfirmationOutcome {
  const located = resolveSourceConfirmedPath(runtime, clientId);
  if (located.kind !== 'ready') {
    return located;
  }

  // ⚠️ READ FIRST. See the module note — this is what makes the duplicate
  // refusal real rather than per-request.
  const existing = readSourceConfirmations(runtime, clientId);
  if (existing.kind !== 'loaded') {
    return existing;
  }

  const outcome: SourceAcceptanceOutcome = recordPassageForQuestion({
    draft: existing.draft,
    questionnaire: STUDIO_QUESTIONNAIRE,
    questionId: options.questionId,
    passage: options.passage,
    source: options.source,
    confirmedBy: options.confirmedBy,
  });

  if (outcome.kind === 'refused') {
    return { kind: 'refused', questionId: outcome.questionId, reason: outcome.reason };
  }

  try {
    runtime.ensureDirectory(located.directory);
    runtime.writeFileText(
      located.path,
      renderSourceConfirmedAnswers(outcome.draft.answers, STUDIO_QUESTIONNAIRE),
    );
  } catch (error) {
    if (error instanceof UnsafeClientIdError) {
      return { kind: 'refused', reason: error.message };
    }
    // 🚫 The system error is not surfaced: it carries the full path.
    return {
      kind: 'refused',
      questionId: options.questionId,
      reason:
        'The confirmation could not be written to the discovery workspace, so it was NOT ' +
        'recorded. Nothing on disk changed — confirm it again once the workspace is writable.',
    };
  }

  return {
    kind: 'recorded',
    answer: outcome.answer,
    draft: outcome.draft,
    // ⚠️ Widened HERE and only here — after the write returned (ADR-0073 D7).
    storage: 'workspace-file',
  };
}
