import { join } from 'node:path';

import {
  buildProfileAndFieldProvenanceFromAnswers,
  buildProfileFromAnswers,
  produceScoredBifContext,
  type DiscoveryAnswer,
} from '@age/business-discovery-contracts';
import {
  ClientRecordFileError,
  loadClientRecordFile,
  parseOperatorPrincipal,
  type ClientRecord,
} from '@age/client-registry';
import { loadDiscoveryAnswerFile } from '@age/discovery-answer-file';
import {
  answerFileNameFor,
  presentCapabilityReadiness,
  presentContradictions,
  presentEvidence,
  presentBifFieldSources,
  presentGeneratedBif,
  type CapabilityReadinessView,
  type ContradictionsView,
  type EvidenceView,
  type BifSectionSourceView,
  type GeneratedBifView,
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
  UnsafeClientIdError,
  validateDraft,
  type BusinessesView,
  type DiscoveryDraft,
} from '@age/studio-shell';
import {
  assertOperatorFilePathOutsideRepository,
  OperatorFilePathRefusedError,
} from '@age/operator-file-policy';
import { ClientContext } from '@age/capability-kit';
// ⚠️ The SUBPATH, deliberately. `@age/demo-runtime`'s index also exports
// `runAllCapabilities` and the demo fixtures; 🚫 neither may become reachable
// from the console, and a source guard enforces the distinction.
import { buildContextReadinessReport } from '@age/demo-runtime/context-readiness';

import type { OperatorWorkspaceRuntime } from './operator-workspace-runtime';
import { resolveWorkspaceDirectory, STUDIO_QUESTIONNAIRE } from './workspace-directory';
import { readSourceConfirmations } from './source-confirmed-draft';

/**
 * The nine operations the operator console performs, pure over an injected
 * runtime (ADR-0060 D2).
 *
 * ⚠️ THIS PACKAGE PERFORMS NO EFFECT. Every filesystem read, every write, every
 * environment lookup and the clock arrive through `OperatorWorkspaceRuntime`,
 * supplied by whichever surface is calling — `apps/studio` today, `apps/mcp`
 * next. A purity guard asserts it, so a second surface cannot quietly grow its
 * own clock or open its own file here.
 *
 * 🚫 THERE IS EXACTLY ONE IMPLEMENTATION OF THESE OPERATIONS, and a guard
 * asserts that too. ADR-0060 D2 refuses duplicating them per surface for the
 * repo's standing reason: the copy that gets relaxed still passes its own tests.
 *
 * ⚠️ Every DECISION still lives in `@age/studio-shell`; this module is the
 * orchestration between those decisions and the operator's files.
 *
 * 🚫 Nothing here caches. A cached registry would keep serving a file the
 * operator has since corrected, and "the screen disagrees with the file" is
 * precisely the failure this console exists to make impossible.
 */

/**
 * Read the operator's client records, or explain why not.
 *
 * ⚠️ Every failure becomes a REFUSED view carrying the reason. 🚫 None becomes
 * an empty list: "nobody told me where to look" and "there are no businesses"
 * must never render the same way.
 */
export function readBusinessesView(runtime: OperatorWorkspaceRuntime): BusinessesView {
  const source = resolveClientRecordSource(runtime.env);

  if (source.kind === 'not-configured') {
    return { kind: 'not-configured', variable: source.variable };
  }

  try {
    const records = loadClientRecordFile({
      path: source.path,
      repositoryRoot: runtime.repositoryRoot(),
      readFileText: (path) => runtime.readFileText(path),
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
export function resolveBusinessScope(
  runtime: OperatorWorkspaceRuntime,
  clientId: string,
): BusinessScope {
  const view = readBusinessesView(runtime);

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
export function createClientRecord(
  runtime: OperatorWorkspaceRuntime,
  draft: ClientRecordDraft,
): CreateClientOutcome {
  const source = resolveClientRecordSource(runtime.env);
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
    assertOperatorFilePathOutsideRepository(
      source.path,
      runtime.repositoryRoot(),
      'client record file',
    );
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

  if (!runtime.fileExists(source.path)) {
    // ⚠️ Distinguished from "unreadable" deliberately. `fileExists` answers a
    // different question than a failed read: a file that exists and cannot be
    // parsed must never take this branch.
    firstRecord = true;
  } else {
    try {
      existing = loadClientRecordFile({
        path: source.path,
        repositoryRoot: runtime.repositoryRoot(),
        readFileText: (path) => runtime.readFileText(path),
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
    runtime.writeFileText(source.path, renderClientRecordFile(appended.records));
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

// ⚠️ The workspace lookup and the questionnaire live in `workspace-directory`
// so the source-confirmation operations can share the SINGLE implementation
// rather than each module importing the other (ADR-0073). Re-exported here
// because every existing caller names them through this module.
export {
  resolveWorkspaceDirectory,
  STUDIO_QUESTIONNAIRE,
  type DiscoveryWorkspaceOutcome,
} from './workspace-directory';

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
export function readDiscoveryDraft(
  runtime: OperatorWorkspaceRuntime,
  clientId: string,
): DraftOutcome {
  const workspace = resolveWorkspaceDirectory(runtime);
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
    rawText = runtime.readFileText(path);
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
export function writeDiscoveryDraft(
  runtime: OperatorWorkspaceRuntime,
  clientId: string,
  draft: DiscoveryDraft,
): SaveOutcome {
  const workspace = resolveWorkspaceDirectory(runtime);
  if (workspace.kind !== 'ready') {
    return workspace;
  }

  try {
    runtime.ensureDirectory(workspace.directory);
    runtime.writeFileText(
      join(workspace.directory, draftFileNameFor(clientId)),
      renderDiscoveryDraft(draft, STUDIO_QUESTIONNAIRE),
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
export function submitDiscoveryAnswers(
  runtime: OperatorWorkspaceRuntime,
  clientId: string,
  draft: DiscoveryDraft,
): SubmitOutcome {
  const workspace = resolveWorkspaceDirectory(runtime);
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
    runtime.ensureDirectory(workspace.directory);
    runtime.writeFileText(
      join(workspace.directory, fileName),
      renderAnswerFile(draft, STUDIO_QUESTIONNAIRE),
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

/**
 * ────────────────────────────────────────────────────────────────────────────
 * GENERATING A BIF
 *
 * ⚠️ Class 2 (Knowledge Authoring) under ADR-0057 D4, which names "generate BIF"
 * explicitly — and human-initiated, which is the half that matters. The operator
 * presses a button and the chain runs once, in the foreground.
 *
 * 🚫 IT MUST NEVER RUN ON PAGE LOAD. A recompute-on-open is class 3 even though
 * its effect is entirely internal, and it is the exact case CLAUDE.md names as
 * the one that gets argued away. The viewer therefore renders "no BIF has been
 * generated" until a press, and 🚫 no route may call this from a server
 * component's render path.
 *
 * 🚫 NOTHING IS PERSISTED, AND NOTHING HERE CAN PERSIST. This calls the pure
 * `produceScoredBifContext` — the same function the CLI's `produceOnly` mode
 * calls, reached without the capture orchestrator, so there is no import path to
 * `@age/business-discovery-capture` or `@age/persistence` at all.
 * `produceAndCapture` is unreachable from the console, ADR-0054 D6's five
 * conditions are untouched, and ADR-0046 D7 is not repealed. Storing a snapshot
 * remains the operator's own `age-capture onboard --capture --confirm` run
 * against their own local database.
 *
 * ⚠️ IT READS THE ANSWER FILE, NOT THE DRAFT. A draft is unfinished by
 * definition; scoring one would report a business on answers the operator had
 * not finished giving. If Discovery has not been submitted, this refuses.
 * ────────────────────────────────────────────────────────────────────────────
 */

/**
 * The message of a thrown value, without assuming there was one.
 *
 * 🚫 Never `String(error)`: for a non-Error that prints `[object Object]`, which
 * a screen would show the operator as though it were a reason.
 */
function messageOf(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : 'The request could not be completed, and the failure was not recognised.';
}

/**
 * Compose the two intake channels into the one list the canonical path takes
 * (ADR-0073 D5).
 *
 * 🛑 **A QUESTION ANSWERED IN BOTH CHANNELS IS REFUSED, 🚫 NEVER MERGED, AND
 * 🚫 NEITHER CHANNEL WINS.** Preferring the answer file would discard a
 * confirmation whose origin a human recorded; preferring the confirmation would
 * discard what the business itself stated. Merging would invent an answer nobody
 * gave. The operator resolves it by removing one — that is a decision only they
 * can make.
 *
 * ⚠️ **AGE-INV-PROV-1 IS UNTOUCHED.** Provenance travels beside each answer and
 * reaches the field-source view; 🚫 it reaches no scorer, and it decides nothing
 * about ordering here either — the answer file's entries come first only because
 * a deterministic order is needed, 🚫 not because they rank above a confirmation.
 */
export type ComposedIntake =
  | { readonly kind: 'refused'; readonly reason: string }
  | { readonly kind: 'composed'; readonly answers: readonly DiscoveryAnswer[] };

export function composeIntakeChannels(
  statedAnswers: readonly DiscoveryAnswer[],
  confirmedAnswers: readonly DiscoveryAnswer[],
): ComposedIntake {
  const stated = new Set(statedAnswers.map((answer) => answer.questionId));
  const overlapping = confirmedAnswers
    .filter((answer) => stated.has(answer.questionId))
    .map((answer) => answer.questionId);

  if (overlapping.length > 0) {
    return {
      kind: 'refused',
      reason:
        `${overlapping.join(', ')} — ${overlapping.length === 1 ? 'this question is' : 'these questions are'} ` +
        'answered both in the answer file and by a confirmation from a source. AGE refuses rather ' +
        'than choosing one or combining them, because either would discard an answer someone ' +
        'gave. Remove the one that should not stand and generate again.',
    };
  }

  return { kind: 'composed', answers: [...statedAnswers, ...confirmedAnswers] };
}

/**
 * The whole intake for one business — both channels, composed (ADR-0073 D5).
 *
 * ⚠️ **ONE READER, DELIBERATELY.** Every screen that reasons from the intake —
 * the BIF, the evidence assembly, the capability readiness — reads through this
 * function, so 🚫 none of them can quietly see a different set of answers than
 * another. A second reader would drift, and the drifted one is the screen the
 * operator happens to be looking at.
 */
type IntakeOutcome =
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'refused'; readonly reason: string }
  | { readonly kind: 'no-answer-file' }
  | { readonly kind: 'loaded'; readonly answers: readonly DiscoveryAnswer[] };

function loadComposedIntake(runtime: OperatorWorkspaceRuntime, clientId: string): IntakeOutcome {
  const workspace = resolveWorkspaceDirectory(runtime);
  if (workspace.kind !== 'ready') {
    return workspace;
  }

  let answerFilePath: string;
  try {
    answerFilePath = join(workspace.directory, answerFileNameFor(clientId));
  } catch (error) {
    if (error instanceof UnsafeClientIdError) {
      return { kind: 'refused', reason: error.message };
    }
    throw error;
  }

  // ⚠️ The confirmations are read FIRST, because whether there is anything to
  // reason from now depends on BOTH channels (ADR-0073 D5).
  const confirmations = readSourceConfirmations(runtime, clientId);
  if (confirmations.kind !== 'loaded') {
    return confirmations;
  }
  const confirmedAnswers = confirmations.draft.answers;

  const hasAnswerFile = runtime.fileExists(answerFilePath);

  // ⚠️ A distinct state, not a refusal and not an empty result: Discovery has
  // simply not been submitted yet. 🚫 Degrading to "no answers" would produce a
  // BIF that merely looks sparse, hiding that nothing was read at all.
  //
  // ⚠️ Unless a human has confirmed answers from a source — those are a real
  // intake too, and refusing to reason from them would tell an operator who has
  // done work that nothing exists.
  if (!hasAnswerFile && confirmedAnswers.length === 0) {
    return { kind: 'no-answer-file' };
  }

  let statedAnswers: readonly DiscoveryAnswer[];
  try {
    // ⚠️ The SAME loader the CLI uses, including its outside-the-repository
    // check. 🚫 A second reader would drift.
    statedAnswers = hasAnswerFile
      ? loadDiscoveryAnswerFile({
          path: answerFilePath,
          repositoryRoot: runtime.repositoryRoot(),
          questionnaire: STUDIO_QUESTIONNAIRE,
          // 🚫 The system error is swallowed and replaced. Node's read failures
          // embed the full path, and the loader puts the message it is given
          // into a refusal the screen shows — that would print the operator's
          // own directory layout onto a page.
          readFileText: (path: string) => {
            try {
              return runtime.readFileText(path);
            } catch {
              throw new Error('the file could not be opened');
            }
          },
        })
      : // ⚠️ Confirmations only — a partial intake, which produces a `Draft`
        // BIF with sections OMITTED. 🚫 Nothing is placeholder-filled, and a low
        // score is a CORRECT result (ADR-0054 D7).
        [];
  } catch (error) {
    return { kind: 'refused', reason: messageOf(error) };
  }

  const composed = composeIntakeChannels(statedAnswers, confirmedAnswers);
  if (composed.kind === 'refused') {
    return { kind: 'refused', reason: composed.reason };
  }

  return { kind: 'loaded', answers: composed.answers };
}

export type GenerateBifOutcome =
  | {
      readonly kind: 'generated';
      readonly view: GeneratedBifView;
      /**
       * Where each BIF field's value came from (ADR-0066 D6, slice 5).
       *
       * ⚠️ A SECOND VALUE ALONGSIDE THE VIEW, never a property inside it. The
       * view is what the BIF says; this is how each of those facts entered AGE,
       * and folding one into the other is how a number eventually starts
       * depending on an origin (AGE-INV-PROV-1).
       */
      readonly fieldSources: readonly BifSectionSourceView[];
      /** Echoed back so the operator can see the scope was DERIVED, not typed. */
      readonly organizationId: string;
    }
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'no-answer-file' }
  | { readonly kind: 'refused'; readonly reason: string };

/**
 * Produce a scored BIF from the answer file this console wrote.
 *
 * ⚠️ `changedBy` is a required parameter with NO default. ADR-0053 D4: an
 * `OperatorPrincipal` is never defaulted, generated or inferred — there is no
 * `SYSTEM_PRINCIPAL` to fall back to, and a generated one would put a name into
 * provenance that nobody claimed.
 *
 * ⚠️ Scope comes from the client RECORD, never from the URL or a form. The
 * `clientId` in the path selects a record; the `organizationId` is read off that
 * record, which is D6 condition 1 and the reason there is no field to type one
 * into.
 */
export function generateBifFromAnswerFile(
  runtime: OperatorWorkspaceRuntime,
  clientId: string,
  changedBy: string,
): GenerateBifOutcome {
  let principal: string;
  try {
    // 🚫 Parsed, never coerced. "who to record", not "who may act" — this is not
    // an authorization decision and must never become one.
    principal = parseOperatorPrincipal(changedBy);
  } catch (error) {
    return { kind: 'refused', reason: messageOf(error) };
  }

  const scope = resolveBusinessScope(runtime, clientId);
  if (scope.kind === 'not-configured') {
    return { kind: 'not-configured', variable: scope.variable };
  }
  if (scope.kind === 'refused') {
    return { kind: 'refused', reason: scope.reason };
  }
  if (scope.kind === 'unknown-client') {
    return {
      kind: 'refused',
      reason:
        'That business is not in the client record file, so there is no scope to produce a BIF ' +
        'under. Nothing is guessed and no organization is inferred.',
    };
  }

  const intake = loadComposedIntake(runtime, clientId);
  if (intake.kind !== 'loaded') {
    return intake;
  }

  // ⚠️ ONE INSTANT, NOT TWO — the CLI's rule, repeated. The profile's
  // `capturedAt` and the mapper's `constructedAt` come from a single read of the
  // clock, so no artefact of one press can claim to precede another.
  const instant = runtime.now();

  try {
    // 🚫 TRANSCRIPTION ONLY. The mapper copies answer text verbatim, omits every
    // field it has no answer for and infers nothing (ADR-0050 D2). A low score
    // for a first real client is a CORRECT result (ADR-0054 D7) — 🚫 nothing
    // here may reach for a cap, a weight or a predicate to improve it.
    // ⚠️ TWO VALUES, NEVER ONE. The profile is what every scorer sees; the
    // channel is asked for BY NAME and never reaches them, so identical facts
    // with different provenance still score byte-identically (AGE-INV-PROV-1).
    const { profile, fieldProvenance } = buildProfileAndFieldProvenanceFromAnswers(
      intake.answers,
      STUDIO_QUESTIONNAIRE,
      {
        id: `${clientId}-discovery`,
        capturedAt: instant.toISOString(),
      },
    );

    const { context, mappingMetadata, scoringMetadata } = produceScoredBifContext(profile, {
      // The single authoritative source, read off the record.
      organizationId: scope.client.organizationId,
      constructedAt: instant,
      changedBy: principal,
      questionnaire: STUDIO_QUESTIONNAIRE,
    });

    const view = presentGeneratedBif(context, mappingMetadata, scoringMetadata);

    return {
      kind: 'generated',
      view,
      // 🚫 Read for its field KEYS only — no value, confidence or score crosses
      // into the origin view, so it cannot restate a number.
      fieldSources: presentBifFieldSources(view.sections, fieldProvenance),
      organizationId: scope.client.organizationId,
    };
  } catch (error) {
    return { kind: 'refused', reason: messageOf(error) };
  }
}

export type EvidenceOutcome =
  | {
      readonly kind: 'assembled';
      readonly view: EvidenceView;
      /** Echoed back so the operator can see the scope was DERIVED, not typed. */
      readonly organizationId: string;
    }
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'no-answer-file' }
  | { readonly kind: 'refused'; readonly reason: string };

/**
 * Assemble the evidence ledger for a business.
 *
 * ⚠️ It runs the SAME chain as the BIF screen rather than reading a BIF from
 * anywhere: nothing has read the capture store (ADR-0055 D7), so there is no
 * stored BIF to attach evidence to, and 🚫 no row is seeded to give it one.
 *
 * ⚠️ Like the BIF screen this is an ACTION, never page data. Producing on open
 * would make opening the screen the act, and a recompute-on-open is class 3
 * under ADR-0057 D4 even though its effect is entirely internal.
 *
 * 🚫 NOTHING IS RETRIEVED. No listed document is opened, no address is fetched
 * and no external system is contacted — those are class 3 twice over, and the
 * screen states that as a refusal rather than as a pending feature.
 */
export function assembleEvidence(
  runtime: OperatorWorkspaceRuntime,
  clientId: string,
  changedBy: string,
): EvidenceOutcome {
  let principal: string;
  try {
    principal = parseOperatorPrincipal(changedBy);
  } catch (error) {
    return { kind: 'refused', reason: messageOf(error) };
  }

  const scope = resolveBusinessScope(runtime, clientId);
  if (scope.kind === 'not-configured') {
    return { kind: 'not-configured', variable: scope.variable };
  }
  if (scope.kind === 'refused') {
    return { kind: 'refused', reason: scope.reason };
  }
  if (scope.kind === 'unknown-client') {
    return {
      kind: 'refused',
      reason:
        'That business is not in the client record file, so there is no scope to assemble evidence ' +
        'under. Nothing is guessed and no organization is inferred.',
    };
  }

  // ⚠️ BOTH channels, through the one reader (ADR-0073 D5) — the evidence a
  // screen shows must be the evidence the BIF was produced from, or the two
  // pages disagree about what AGE was told.
  const intake = loadComposedIntake(runtime, clientId);
  if (intake.kind !== 'loaded') {
    return intake;
  }

  const instant = runtime.now();

  try {
    const profile = buildProfileFromAnswers(intake.answers, STUDIO_QUESTIONNAIRE, {
      id: `${clientId}-discovery`,
      capturedAt: instant.toISOString(),
    });

    const { context, mappingMetadata } = produceScoredBifContext(profile, {
      organizationId: scope.client.organizationId,
      constructedAt: instant,
      changedBy: principal,
      questionnaire: STUDIO_QUESTIONNAIRE,
    });

    return {
      kind: 'assembled',
      view: presentEvidence(profile, context, mappingMetadata, STUDIO_QUESTIONNAIRE),
      organizationId: scope.client.organizationId,
    };
  } catch (error) {
    return { kind: 'refused', reason: messageOf(error) };
  }
}

export type ContradictionsOutcome =
  | {
      readonly kind: 'reported';
      readonly view: ContradictionsView;
      /** Echoed back so the operator can see the scope was DERIVED, not typed. */
      readonly organizationId: string;
    }
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'no-answer-file' }
  | { readonly kind: 'refused'; readonly reason: string };

/**
 * Report why AGE cannot yet say whether it disagrees with itself.
 *
 * 🛑 THE DETECTOR IS NOT RUN AND THIS FUNCTION CANNOT RUN IT.
 * `detectContradictions` is real and would return an empty set over an empty
 * evidence list; showing that as a result would tell the operator AGE checked a
 * real business and found nothing wrong with it. Nothing checked it.
 *
 * ⚠️ It composes the EVIDENCE account rather than building a second one — a
 * second answer to an answered question is a second answer that can disagree.
 * Every refusal, missing-file and unconfigured branch is therefore the evidence
 * screen's, unchanged.
 *
 * ⚠️ An ACTION, never page data, for the same reason as the screens above: a
 * recompute-on-open is class 3 under ADR-0057 D4 even though its effect is
 * entirely internal.
 */
export function reportContradictions(
  runtime: OperatorWorkspaceRuntime,
  clientId: string,
  changedBy: string,
): ContradictionsOutcome {
  const evidence = assembleEvidence(runtime, clientId, changedBy);

  if (evidence.kind !== 'assembled') {
    return evidence;
  }

  return {
    kind: 'reported',
    view: presentContradictions(evidence.view),
    organizationId: evidence.organizationId,
  };
}

export type CapabilityReadinessOutcome =
  | {
      readonly kind: 'assessed';
      readonly view: CapabilityReadinessView;
      /** Echoed back so the operator can see the scope was DERIVED, not typed. */
      readonly organizationId: string;
    }
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'no-answer-file' }
  | { readonly kind: 'refused'; readonly reason: string };

/**
 * Assess how far the captured context carries each capability.
 *
 * ⚠️ IT ASSESSES; IT DOES NOT RUN. `buildContextReadinessReport` calls the three
 * ADR-0027 assessors and nothing else — 🚫 `runAllCapabilities` is not imported,
 * not reachable, and not merely unused. Running a capability against a real
 * business is a decision nobody has taken, and readiness has never gated `run`
 * in either direction (ADR-0047).
 *
 * ⚠️ Like the BIF and Evidence screens this is an ACTION, never page data. A
 * recompute-on-open is class 3 under ADR-0057 D4 even though its effect is
 * entirely internal, and a test asserts the action is not called on mount.
 *
 * ⚠️ It runs the SAME chain over the SAME answer file as those two screens
 * rather than reading a stored BIF: nothing has read the capture store
 * (ADR-0055 D7), and 🚫 no row is seeded to give it one. The context assessed
 * here is built in memory and discarded, which the screen states.
 */
export function assessCapabilityReadiness(
  runtime: OperatorWorkspaceRuntime,
  clientId: string,
  changedBy: string,
): CapabilityReadinessOutcome {
  let principal: string;
  try {
    principal = parseOperatorPrincipal(changedBy);
  } catch (error) {
    return { kind: 'refused', reason: messageOf(error) };
  }

  const scope = resolveBusinessScope(runtime, clientId);
  if (scope.kind === 'not-configured') {
    return { kind: 'not-configured', variable: scope.variable };
  }
  if (scope.kind === 'refused') {
    return { kind: 'refused', reason: scope.reason };
  }
  if (scope.kind === 'unknown-client') {
    return {
      kind: 'refused',
      reason:
        'That business is not in the client record file, so there is no scope to assess readiness ' +
        'under. Nothing is guessed and no organization is inferred.',
    };
  }

  // ⚠️ BOTH channels, through the one reader (ADR-0073 D5). Readiness assessed
  // over a narrower intake than the BIF was built from would report a business
  // as less ready than the answers AGE actually holds.
  const intake = loadComposedIntake(runtime, clientId);
  if (intake.kind !== 'loaded') {
    return intake;
  }

  const instant = runtime.now();

  try {
    const profile = buildProfileFromAnswers(intake.answers, STUDIO_QUESTIONNAIRE, {
      id: `${clientId}-discovery`,
      capturedAt: instant.toISOString(),
    });

    const { context } = produceScoredBifContext(profile, {
      organizationId: scope.client.organizationId,
      constructedAt: instant,
      changedBy: principal,
      questionnaire: STUDIO_QUESTIONNAIRE,
    });

    const report = buildContextReadinessReport(context, {
      producedAt: instant,
      // ⚠️ Both components come off the resolved record. 🚫 Neither is typed by
      // the operator and neither is defaulted — ADR-0054 D2 refuses a typed
      // scope by name.
      clientContext: new ClientContext(scope.client.clientId, scope.client.organizationId),
    });

    return {
      kind: 'assessed',
      view: presentCapabilityReadiness(report),
      organizationId: scope.client.organizationId,
    };
  } catch (error) {
    return { kind: 'refused', reason: messageOf(error) };
  }
}
