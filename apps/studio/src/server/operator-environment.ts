import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE } from '@age/business-discovery-contracts';
import {
  ClientRecordFileError,
  loadClientRecordFile,
  type ClientRecord,
} from '@age/client-registry';
import {
  answerFileNameFor,
  appendClientRecord,
  canSubmit,
  renderClientRecordFile,
  validateClientRecordDraft,
  type ClientRecordDraft,
  DiscoveryDraftError,
  draftFileNameFor,
  emptyDraft,
  parseDiscoveryDraft,
  presentBusinesses,
  renderAnswerFile,
  renderDiscoveryDraft,
  resolveClientRecordSource,
  resolveDiscoveryWorkspace,
  UnsafeClientIdError,
  validateDraft,
  type BusinessesView,
  type DiscoveryDraft,
} from '@age/studio-shell';
import {
  assertOperatorFilePathOutsideRepository,
  OperatorFilePathRefusedError,
} from '@age/operator-file-policy';

/**
 * The ONE module in `apps/studio` that performs an effect.
 *
 * ⚠️ This is the `apps/capture` discipline, deliberately repeated: every
 * DECISION lives in `@age/studio-shell` and every EFFECT lives here, so a purity
 * guard can assert that no other module grew its own clock, filesystem read or
 * environment lookup. 🚫 Do not read `process.env` or open a file anywhere else
 * under `src/`.
 *
 * 🚫 Nothing here caches. A cached registry would keep serving a file the
 * operator has since corrected, and "the screen disagrees with the file" is
 * precisely the failure this console exists to make impossible.
 */

/** The repository working tree, which operator files must live outside of. */
function repositoryRoot(): string {
  // ⚠️ `process.cwd()` is used ONLY to locate the repository the file must be
  // OUTSIDE of — never to find the file itself. That distinction is ADR-0054
  // D2: searching the working directory for an operator's file is the refused
  // behaviour; knowing which tree to exclude is the guard that enforces it.
  return process.cwd();
}

/**
 * Read the operator's client records, or explain why not.
 *
 * ⚠️ Every failure becomes a REFUSED view carrying the reason. 🚫 None becomes
 * an empty list: "nobody told me where to look" and "there are no businesses"
 * must never render the same way.
 */
export function readBusinessesView(): BusinessesView {
  const source = resolveClientRecordSource(process.env);

  if (source.kind === 'not-configured') {
    return { kind: 'not-configured', variable: source.variable };
  }

  try {
    const records = loadClientRecordFile({
      path: source.path,
      repositoryRoot: repositoryRoot(),
      readFileText: (path) => readFileSync(path, 'utf8'),
    });

    return presentBusinesses(records);
  } catch (error) {
    if (error instanceof ClientRecordFileError || error instanceof OperatorFilePathRefusedError) {
      // ⚠️ These messages are already written to name a POSITION and never the
      // record's contents, so surfacing them cannot carry a client's name onto
      // the screen of a console that is showing the wrong file.
      return { kind: 'refused', reason: error.message };
    }

    // 🚫 An unexpected error is NOT flattened into a generic refusal with the
    // underlying message attached — an unrecognised error could carry anything,
    // including file contents from a layer that made no promise about them.
    return {
      kind: 'refused',
      reason:
        'The client record file could not be read, and the failure was not one the console ' +
        'recognises. Nothing is shown rather than a partial or repaired registry.',
    };
  }
}

/**
 * What a subject screen knows about the business named in its URL.
 *
 * ⚠️ Four outcomes again, and the last one is the load-bearing case: a clientId
 * that is not in the operator's record file is REFUSED, never rendered as a
 * business with no data. Continuing would put a scope into circulation that
 * names nothing (ADR-0054 D3).
 */
export type BusinessScope =
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'refused'; readonly reason: string }
  | { readonly kind: 'unknown-client'; readonly clientId: string }
  | { readonly kind: 'resolved'; readonly client: ClientRecord };

/**
 * Resolve the business a subject route names.
 *
 * 🚫 No nearest match, no "did you mean", and 🚫 the refusal does NOT list the
 * known ids — the requested id came from the operator and is already theirs;
 * the others are other clients' names.
 */
export function resolveBusinessScope(clientId: string): BusinessScope {
  const view = readBusinessesView();

  switch (view.kind) {
    case 'not-configured':
      return { kind: 'not-configured', variable: view.variable };
    case 'refused':
      return { kind: 'refused', reason: view.reason };
    case 'none':
      return { kind: 'unknown-client', clientId };
    case 'listed': {
      const client = view.bands
        .flatMap((band) => band.clients)
        .find((candidate) => candidate.clientId === clientId);

      return client === undefined
        ? { kind: 'unknown-client', clientId }
        : { kind: 'resolved', client };
    }
  }
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * CREATING A CLIENT
 *
 * ⚠️ Class 1 (Platform Administration) under ADR-0057 D4, and human-initiated:
 * the operator types their own business's identity and presses a button.
 *
 * 🚫 This does NOT create an organization. No tenant model exists (ADR-0058 D4);
 * `organizationId` is a string the operator supplies, and the Organizations band
 * stays derived from it.
 * ────────────────────────────────────────────────────────────────────────────
 */

export type CreateClientOutcome =
  | { readonly kind: 'created'; readonly clientId: string; readonly firstRecord: boolean }
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'refused'; readonly reason: string; readonly field?: string };

/**
 * Write a new record into the operator's client record file.
 *
 * ⚠️ THE READ IS LOAD-BEARING AND HAPPENS FIRST. The new record is appended to
 * what is actually on disk, never to what a screen was showing — otherwise a
 * second console, or a hand edit made since this page loaded, would be
 * overwritten by a form that never saw it.
 *
 * ⚠️ THE ONE CASE THAT IS NOT A REFUSAL: the file does not exist yet. The
 * operator has named a path (that is the explicit act ADR-0054 D3 requires) and
 * has no clients, so creating the file is the ordinary first use. 🚫 Every other
 * failure to read — malformed JSON, a bad record, a duplicate id already in the
 * file — REFUSES, because writing over a file that exists and could not be
 * parsed would destroy real client records to make a form succeed.
 */
export function createClientRecord(draft: ClientRecordDraft): CreateClientOutcome {
  const source = resolveClientRecordSource(process.env);
  if (source.kind === 'not-configured') {
    return { kind: 'not-configured', variable: source.variable };
  }

  const validated = validateClientRecordDraft(draft);
  if (validated.kind === 'refused') {
    return { kind: 'refused', reason: validated.reason, field: validated.field };
  }

  // The path is checked before anything is opened, through the single policy
  // implementation — same rule, same function, as every other operator file.
  try {
    assertOperatorFilePathOutsideRepository(source.path, repositoryRoot(), 'client record file');
  } catch (error) {
    return {
      kind: 'refused',
      reason:
        error instanceof OperatorFilePathRefusedError
          ? error.message
          : 'The client record file path could not be used.',
    };
  }

  let existing: readonly ClientRecord[] = [];
  let firstRecord = false;

  if (!existsSync(source.path)) {
    // ⚠️ Distinguished from "unreadable" deliberately. `existsSync` answers a
    // different question than a failed read: a file that exists and cannot be
    // parsed must never take this branch.
    firstRecord = true;
  } else {
    try {
      existing = loadClientRecordFile({
        path: source.path,
        repositoryRoot: repositoryRoot(),
        readFileText: (path) => readFileSync(path, 'utf8'),
      });
    } catch (error) {
      return {
        kind: 'refused',
        reason:
          error instanceof ClientRecordFileError || error instanceof OperatorFilePathRefusedError
            ? `${error.message} No client was created — the existing file is left exactly as it is.`
            : 'The existing client record file could not be read, so nothing was written to it.',
      };
    }
  }

  const appended = appendClientRecord(existing, validated.record);
  if (appended.kind === 'refused') {
    return { kind: 'refused', reason: appended.reason, field: appended.field };
  }

  try {
    writeFileSync(source.path, renderClientRecordFile(appended.records), 'utf8');
  } catch {
    // 🚫 The system error is not surfaced: it carries the full path.
    return { kind: 'refused', reason: 'The client record file could not be written.' };
  }

  return { kind: 'created', clientId: validated.record.clientId, firstRecord };
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * DISCOVERY DRAFTS
 *
 * ⚠️ Autosave is permitted: it preserves what the operator typed and initiates
 * nothing (Product Owner, 2026-08-03 — "not AGE making a business decision;
 * it's simply preserving the operator's draft"). 🚫 It must never grow into
 * something that submits, recomputes or generates on its own — that would be a
 * system-initiated act, which is class 3 even though its effect is internal.
 *
 * 🚫 The draft is stored SERVER-SIDE, in the directory the operator named. No
 * browser-local store, ever: a business's own words must not sit in
 * `localStorage` where nothing in this repo governs their lifetime.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** The questionnaire the console renders. There is exactly one. */
export const STUDIO_QUESTIONNAIRE = DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE;

export type DiscoveryWorkspaceOutcome =
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'refused'; readonly reason: string }
  | { readonly kind: 'ready'; readonly directory: string };

/**
 * Locate the workspace, and refuse it if it is inside the repository.
 *
 * ⚠️ The same fail-closed rule as every other operator file, through the same
 * single implementation (`@age/operator-file-policy`). 🚫 Do not re-implement
 * it here — the copy that gets relaxed still passes its own tests.
 */
function resolveWorkspaceDirectory(): DiscoveryWorkspaceOutcome {
  const workspace = resolveDiscoveryWorkspace(process.env);

  if (workspace.kind === 'not-configured') {
    return { kind: 'not-configured', variable: workspace.variable };
  }

  try {
    assertOperatorFilePathOutsideRepository(
      workspace.directory,
      repositoryRoot(),
      'the discovery workspace directory',
    );
    return { kind: 'ready', directory: workspace.directory };
  } catch (error) {
    if (error instanceof OperatorFilePathRefusedError) {
      return { kind: 'refused', reason: error.message };
    }
    return {
      kind: 'refused',
      reason: 'The discovery workspace could not be used, and the failure was not recognised.',
    };
  }
}

export type DraftOutcome =
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'refused'; readonly reason: string }
  | { readonly kind: 'loaded'; readonly draft: DiscoveryDraft; readonly everSaved: boolean };

/**
 * Read the operator's saved draft, or say why there is none.
 *
 * ⚠️ `everSaved` distinguishes "nothing has been typed yet" from "we could not
 * look" — 🚫 an empty form must never be shown as though it were a draft that
 * was read and found blank.
 */
export function readDiscoveryDraft(clientId: string): DraftOutcome {
  const workspace = resolveWorkspaceDirectory();
  if (workspace.kind !== 'ready') {
    return workspace;
  }

  let path: string;
  try {
    path = join(workspace.directory, draftFileNameFor(clientId));
  } catch (error) {
    if (error instanceof UnsafeClientIdError) {
      return { kind: 'refused', reason: error.message };
    }
    throw error;
  }

  let rawText: string;
  try {
    rawText = readFileSync(path, 'utf8');
  } catch {
    // ⚠️ No file yet is the ordinary state of a business nobody has started.
    // 🚫 The underlying error is not surfaced: it embeds the path, and the path
    // is the operator's own directory layout.
    return { kind: 'loaded', draft: emptyDraft(STUDIO_QUESTIONNAIRE), everSaved: false };
  }

  try {
    return {
      kind: 'loaded',
      draft: parseDiscoveryDraft(rawText, STUDIO_QUESTIONNAIRE),
      everSaved: true,
    };
  } catch (error) {
    if (error instanceof DiscoveryDraftError) {
      // 🚫 Refused, never discarded and never started over. The operator's
      // typing is still in that file; overwriting it with a fresh empty draft
      // would destroy work to make a screen render.
      return { kind: 'refused', reason: error.message };
    }
    return { kind: 'refused', reason: 'The saved draft could not be read.' };
  }
}

export type SaveOutcome =
  | { readonly kind: 'saved' }
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'refused'; readonly reason: string };

/** Persist the draft. Called by autosave and by an explicit Save. */
export function writeDiscoveryDraft(clientId: string, draft: DiscoveryDraft): SaveOutcome {
  const workspace = resolveWorkspaceDirectory();
  if (workspace.kind !== 'ready') {
    return workspace;
  }

  try {
    mkdirSync(workspace.directory, { recursive: true });
    writeFileSync(
      join(workspace.directory, draftFileNameFor(clientId)),
      renderDiscoveryDraft(draft, STUDIO_QUESTIONNAIRE),
      'utf8',
    );
    return { kind: 'saved' };
  } catch (error) {
    if (error instanceof UnsafeClientIdError) {
      return { kind: 'refused', reason: error.message };
    }
    // 🚫 The system error is not surfaced: it carries the full path.
    return {
      kind: 'refused',
      reason: 'The draft could not be written to the discovery workspace.',
    };
  }
}

export type SubmitOutcome =
  | { readonly kind: 'written'; readonly fileName: string }
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'refused'; readonly reason: string; readonly questionId?: string };

/**
 * Write the canonical Answer File.
 *
 * ⚠️ This is the operator's explicit act (ADR-0057 D4 class 2 — knowledge
 * authoring), never a consequence of typing. 🚫 It does NOT generate a BIF, run
 * capture or touch a database: it writes the same artifact `age-capture onboard`
 * already consumes, so the console becomes the author and the CLI the consumer
 * without either inventing a second format.
 */
export function submitDiscoveryAnswers(clientId: string, draft: DiscoveryDraft): SubmitOutcome {
  const workspace = resolveWorkspaceDirectory();
  if (workspace.kind !== 'ready') {
    return workspace;
  }

  const validation = validateDraft(draft, STUDIO_QUESTIONNAIRE);
  if (validation.kind === 'refused') {
    return { kind: 'refused', reason: validation.reason, questionId: validation.questionId };
  }

  if (!canSubmit(draft, STUDIO_QUESTIONNAIRE)) {
    return {
      kind: 'refused',
      reason:
        'Some required questions are still unanswered. An unanswered question is omitted from ' +
        'the answer file rather than filled in, so submitting now would understate what is known ' +
        'about this business.',
    };
  }

  try {
    const fileName = answerFileNameFor(clientId);
    mkdirSync(workspace.directory, { recursive: true });
    writeFileSync(
      join(workspace.directory, fileName),
      renderAnswerFile(draft, STUDIO_QUESTIONNAIRE),
      'utf8',
    );
    return { kind: 'written', fileName };
  } catch (error) {
    if (error instanceof UnsafeClientIdError) {
      return { kind: 'refused', reason: error.message };
    }
    return {
      kind: 'refused',
      reason: 'The answer file could not be written to the discovery workspace.',
    };
  }
}

/** The host the console was started on. Reported as a fact, never as a promise. */
export function boundHost(): string {
  return process.env.AGE_STUDIO_HOST ?? '127.0.0.1';
}

/** The port the console was started on. */
export function boundPort(): number {
  const raw = process.env.PORT ?? process.env.AGE_STUDIO_PORT;
  const parsed = raw === undefined ? Number.NaN : Number.parseInt(raw, 10);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 3100;
}
