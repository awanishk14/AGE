'use client';

import { useState } from 'react';

import type { DiscoveryAnswer } from '@age/business-discovery-contracts';

/**
 * The Sources panel, for one business.
 *
 * ⚠️ NOTHING HAPPENS UNTIL THE OPERATOR PRESSES — no read on mount, no retry,
 * no re-read. Opening this screen must never open a real client's document.
 *
 * 🚫 THERE IS NO "ACCEPT ALL" AND THERE MUST NEVER BE ONE (ADR-0059 D1). Every
 * acceptance is one human, one passage, one question — and 🚫 there is no
 * confidence number anywhere on this screen, because there is none to show
 * (D3).
 *
 * 🛑 **WHAT WAS DONE WITH THE CONFIRMATION IS SAID IN WORDS, AND THE WORDS COME
 * FROM `@age/studio-shell`** (ADR-0073 D7). Since a confirmation is now written
 * to the operator's own workspace, the old fixed "Not stored." heading would be
 * FALSE — and a screen claiming a blocker the architecture has removed is as
 * dishonest as one claiming a capability that does not exist. 🚫 No arm may say
 * saved to AGE, synced, uploaded or shared: it is one file, on this machine.
 */

/**
 * ⚠️ Structurally typed rather than imported from the server module: a client
 * component that imported `operator-environment` would pull `node:fs` into the
 * browser bundle.
 */
export interface PassageLike {
  readonly passageId: string;
  readonly locator: string;
  readonly text: string;
}

export interface DocumentLike {
  readonly sourceId: string;
  readonly label: string;
  // ⚠️ The two kinds that exist, PINNED. 🚫 Not widened to `string`: DOCX has no
  // decoder (ADR-0070 deferred option B) and a web address is ADR-0059 D4.3,
  // refused — so a third kind must not become typeable here before it is real.
  readonly kind: 'plain-text' | 'decoded-pdf';
  readonly locator: string;
  readonly text: string;
}

/**
 * 🛑 **HOW AGE GOT THE TEXT, ON SCREEN — 🚫 NOT A QUALITY BADGE.** ADR-0070: an
 * operator checking a passage against their document needs to know whether they
 * are looking at a file's characters or a decoder's output. 🚫 It ranks nothing
 * and 🚫 changes no score.
 */
const HOW_IT_WAS_READ: Readonly<Record<DocumentLike['kind'], string>> = {
  'plain-text': 'Read as plain text',
  'decoded-pdf': 'Decoded from PDF, on this machine',
};

export type SourceReadOutcomeLike =
  | { readonly kind: 'refused'; readonly reason: string }
  | {
      readonly kind: 'read';
      readonly document: DocumentLike;
      readonly outcome:
        | {
            readonly kind: 'passages-proposed';
            readonly sourceId: string;
            readonly passages: readonly PassageLike[];
          }
        | { readonly kind: 'not-extracted'; readonly sourceId: string; readonly reason: string };
      /**
       * ⚠️ The sentence is DECIDED in `@age/operator-workspace`, so there is
       * exactly one implementation of what an extraction reason means. 🚫 Do not
       * re-word it here: the copy that drifts is the one that starts describing
       * the business rather than the file.
       */
      readonly notice: string;
    };

export type DraftStorageStateLike = 'not-stored' | 'workspace-file';

export type AcceptanceOutcomeLike =
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'refused'; readonly questionId?: string; readonly reason: string }
  | {
      readonly kind: 'recorded';
      readonly answer: DiscoveryAnswer;
      /**
       * ⚠️ EVERY confirmation for this business, including the new one — the
       * accumulation ADR-0073 exists to make real. 🚫 Not a count: the operator
       * has to be able to see WHICH questions are answered from a document.
       */
      readonly draft: { readonly answers: readonly DiscoveryAnswer[] };
      readonly storage: DraftStorageStateLike;
    };

/**
 * 🛑 The two storage headings. 🚫 Neither is softened into "saved", and 🚫 the
 * `workspace-file` one must never be printed for a `not-stored` outcome.
 */
const STORAGE_HEADING: Readonly<Record<DraftStorageStateLike, string>> = {
  'not-stored': 'Not stored.',
  'workspace-file': 'Written to your discovery workspace.',
};

export interface QuestionOption {
  readonly id: string;
  readonly prompt: string;
  readonly kind: string;
}

export interface SourcesPanelProps {
  /** ⚠️ Whose confirmations these are. Required — 🚫 never defaulted. */
  readonly clientId: string;
  /** The questions a passage may be accepted as the answer to. */
  readonly questions: readonly QuestionOption[];
  /**
   * The storage sentences, decided in `@age/studio-shell` — 🚫 never re-worded
   * here, and 🚫 never chosen here either: the outcome names its own arm.
   */
  readonly storageNotices: Readonly<Record<DraftStorageStateLike, string>>;
  /**
   * What this business already has confirmed from documents, read once when the
   * screen was rendered. ⚠️ `undefined` means AGE could not look — 🚫 never
   * rendered as "nothing has been confirmed".
   */
  readonly alreadyConfirmed?: readonly DiscoveryAnswer[];
  readonly read: (options: {
    path: string;
    sourceId: string;
    label: string;
  }) => Promise<SourceReadOutcomeLike>;
  readonly record: (input: {
    clientId: string;
    questionId: string;
    passage: PassageLike;
    source: DocumentLike;
    confirmedBy: string;
  }) => Promise<AcceptanceOutcomeLike>;
}

export function SourcesPanel({
  clientId,
  questions,
  storageNotices,
  alreadyConfirmed,
  read,
  record,
}: SourcesPanelProps) {
  const [path, setPath] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [label, setLabel] = useState('');
  const [confirmedBy, setConfirmedBy] = useState('');
  const [reading, setReading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [readOutcome, setReadOutcome] = useState<SourceReadOutcomeLike | undefined>(undefined);
  const [acceptance, setAcceptance] = useState<AcceptanceOutcomeLike | undefined>(undefined);
  const [questionFor, setQuestionFor] = useState<Record<string, string>>({});

  const canRead =
    path.trim().length > 0 &&
    sourceId.trim().length > 0 &&
    label.trim().length > 0 &&
    !reading &&
    !recording;

  // ⚠️ No default acceptor, ever (ADR-0053 D4). A `confirmed-from-source`
  // answer whose acceptor is unknown is indistinguishable from one nobody
  // reviewed.
  const canRecord = confirmedBy.trim().length > 0 && !recording && !reading;

  return (
    <section className="mt-6 space-y-6">
      {/*
        ⚠️ What is already on disk, so the operator can see that earlier
        confirmations SURVIVED. 🚫 Absent when AGE could not look — that is a
        different thing from nobody having confirmed anything.
      */}
      {alreadyConfirmed !== undefined && alreadyConfirmed.length > 0 ? (
        <div className="rounded border border-[hsl(var(--age-border))] p-4">
          <h2 className="text-sm font-semibold">
            Already confirmed from documents — {alreadyConfirmed.length} question
            {alreadyConfirmed.length === 1 ? '' : 's'}
          </h2>
          <ul className="mt-2 space-y-1 text-xs text-[hsl(var(--age-text-muted))]">
            {alreadyConfirmed.map((answer) => (
              <li key={answer.questionId}>
                <span className="font-mono">{answer.questionId}</span>
                {answer.provenance.kind === 'confirmed-from-source'
                  ? ` — ${answer.provenance.locator}, confirmed by ${answer.provenance.confirmedBy}`
                  : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : undefined}

      <div className="rounded border border-[hsl(var(--age-border))] p-4">
        <h2 className="text-sm font-semibold">Read a source document</h2>
        <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
          AGE reads one file you name, on your machine, outside this repository, and shows you its
          own sentences verbatim. It happens once, when you press.
        </p>
        <p className="mt-2 text-xs text-[hsl(var(--age-text-muted))]">
          Plain text and PDF. A PDF is decoded here, on this machine — nothing is fetched,
          downloaded, uploaded or contacted, and no document is ever sent anywhere to be read. AGE
          does not read images of text, so a scanned PDF with no text layer will say so rather than
          be guessed at. DOCX is not decoded at all: a second decoder is a decision that has not
          been made.
        </p>

        <label className="mt-4 block text-xs font-medium" htmlFor="source-path">
          Absolute path to the document
        </label>
        <input
          id="source-path"
          className="mt-1 w-full rounded border border-[hsl(var(--age-border))] bg-transparent px-2 py-1 text-sm"
          value={path}
          onChange={(event) => setPath(event.target.value)}
        />

        <label className="mt-3 block text-xs font-medium" htmlFor="source-id">
          Source identifier
        </label>
        <input
          id="source-id"
          className="mt-1 w-full rounded border border-[hsl(var(--age-border))] bg-transparent px-2 py-1 text-sm"
          value={sourceId}
          onChange={(event) => setSourceId(event.target.value)}
        />

        <label className="mt-3 block text-xs font-medium" htmlFor="source-label">
          How you refer to this document
        </label>
        <input
          id="source-label"
          className="mt-1 w-full rounded border border-[hsl(var(--age-border))] bg-transparent px-2 py-1 text-sm"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />

        <button
          type="button"
          className="mt-4 rounded border border-[hsl(var(--age-border))] px-3 py-1 text-sm disabled:opacity-50"
          disabled={!canRead}
          onClick={() => {
            setReading(true);
            setAcceptance(undefined);
            void read({ path, sourceId, label })
              .then(setReadOutcome)
              .finally(() => setReading(false));
          }}
        >
          {reading ? 'Reading…' : 'Read this document'}
        </button>
      </div>

      {readOutcome?.kind === 'refused' ? (
        <div className="rounded border border-[hsl(var(--age-unknown))] p-4">
          <h3 className="text-sm font-semibold">The document was not read</h3>
          <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">{readOutcome.reason}</p>
        </div>
      ) : undefined}

      {readOutcome?.kind === 'read' && readOutcome.outcome.kind === 'not-extracted' ? (
        <div className="rounded border border-[hsl(var(--age-unknown))] p-4">
          <h3 className="text-sm font-semibold">The document was read, and proposed nothing</h3>
          <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">{readOutcome.notice}</p>
        </div>
      ) : undefined}

      {readOutcome?.kind === 'read' && readOutcome.outcome.kind === 'passages-proposed' ? (
        <div className="rounded border border-[hsl(var(--age-border))] p-4">
          <h3 className="text-sm font-semibold">
            What the document says — {readOutcome.outcome.passages.length} passage
            {readOutcome.outcome.passages.length === 1 ? '' : 's'}
          </h3>
          {/*
            ⚠️ Shown ONLY where a decode actually succeeded. On a `not-extracted`
            outcome the document is still a PDF but its text never arrived, and a
            badge reading "Decoded from PDF" beside "proposed nothing" would claim
            a step that did not finish. There the notice says what happened instead.
          */}
          <p className="mt-2 text-xs text-[hsl(var(--age-text-muted))]">
            {HOW_IT_WAS_READ[readOutcome.document.kind]}
          </p>
          <p className="mt-2 text-xs text-[hsl(var(--age-text-muted))]">
            These are the document&apos;s own words. AGE did not decide which of them answers which
            question. {readOutcome.notice} That judgement is yours, one passage at a time.
          </p>

          <label className="mt-4 block text-xs font-medium" htmlFor="source-confirmed-by">
            Confirmed by
          </label>
          <input
            id="source-confirmed-by"
            className="mt-1 w-full rounded border border-[hsl(var(--age-border))] bg-transparent px-2 py-1 text-sm"
            value={confirmedBy}
            onChange={(event) => setConfirmedBy(event.target.value)}
          />

          <ul className="mt-4 space-y-3">
            {readOutcome.outcome.passages.map((passage) => (
              <li
                key={passage.passageId}
                className="rounded border border-[hsl(var(--age-border))] p-3"
              >
                <p className="text-xs text-[hsl(var(--age-text-muted))]">{passage.locator}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{passage.text}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="text-xs" htmlFor={`question-${passage.passageId}`}>
                    Answers
                  </label>
                  <select
                    id={`question-${passage.passageId}`}
                    className="rounded border border-[hsl(var(--age-border))] bg-transparent px-2 py-1 text-xs"
                    value={questionFor[passage.passageId] ?? ''}
                    onChange={(event) =>
                      setQuestionFor((current) => ({
                        ...current,
                        [passage.passageId]: event.target.value,
                      }))
                    }
                  >
                    <option value="">Choose a question…</option>
                    {questions.map((question) => (
                      <option key={question.id} value={question.id}>
                        {question.prompt}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    className="rounded border border-[hsl(var(--age-border))] px-2 py-1 text-xs disabled:opacity-50"
                    disabled={!canRecord || (questionFor[passage.passageId] ?? '') === ''}
                    onClick={() => {
                      const questionId = questionFor[passage.passageId] ?? '';
                      const source = readOutcome.kind === 'read' ? readOutcome.document : undefined;
                      if (source === undefined) return;

                      setRecording(true);
                      void record({ clientId, questionId, passage, source, confirmedBy })
                        .then(setAcceptance)
                        .finally(() => setRecording(false));
                    }}
                  >
                    Record this passage as the answer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : undefined}

      {acceptance?.kind === 'not-configured' ? (
        <div className="rounded border border-[hsl(var(--age-unknown))] p-4">
          <h3 className="text-sm font-semibold">The confirmation was not recorded</h3>
          <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
            No discovery workspace has been configured ({acceptance.variable}), so there is nowhere
            on this machine to keep the confirmation. It was not recorded.
          </p>
        </div>
      ) : undefined}

      {acceptance?.kind === 'refused' ? (
        <div className="rounded border border-[hsl(var(--age-unknown))] p-4">
          <h3 className="text-sm font-semibold">The answer was refused, not recorded</h3>
          <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">{acceptance.reason}</p>
        </div>
      ) : undefined}

      {acceptance?.kind === 'recorded' ? (
        <div className="rounded border border-[hsl(var(--age-border))] p-4">
          <h3 className="text-sm font-semibold">Recorded against {acceptance.answer.questionId}</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm">
            {Array.isArray(acceptance.answer.value)
              ? acceptance.answer.value.join('\n')
              : acceptance.answer.value}
          </p>
          <dl className="mt-3 space-y-1 text-xs text-[hsl(var(--age-text-muted))]">
            <div>
              <dt className="inline font-medium">How it entered AGE: </dt>
              <dd className="inline">{acceptance.answer.provenance.kind}</dd>
            </div>
            {acceptance.answer.provenance.kind === 'confirmed-from-source' ? (
              <>
                <div>
                  <dt className="inline font-medium">Source: </dt>
                  <dd className="inline font-mono">{acceptance.answer.provenance.sourceId}</dd>
                </div>
                <div>
                  <dt className="inline font-medium">Where: </dt>
                  <dd className="inline">{acceptance.answer.provenance.locator}</dd>
                </div>
                <div>
                  <dt className="inline font-medium">Confirmed by: </dt>
                  <dd className="inline">{acceptance.answer.provenance.confirmedBy}</dd>
                </div>
              </>
            ) : undefined}
          </dl>

          {/* 🛑 The storage state, in words, CHOSEN BY THE OUTCOME. 🚫 Never a fixed heading. */}
          <p className="mt-3 rounded border border-[hsl(var(--age-unknown))] p-3 text-xs">
            <span className="font-semibold">{STORAGE_HEADING[acceptance.storage]} </span>
            {storageNotices[acceptance.storage]}
          </p>
          <p className="mt-2 text-xs text-[hsl(var(--age-text-muted))]">
            Confirmed from documents so far: {acceptance.draft.answers.length}
            {acceptance.draft.answers.length === 1 ? ' question' : ' questions'} —{' '}
            <span className="font-mono">
              {acceptance.draft.answers.map((answer) => answer.questionId).join(', ')}
            </span>
            . Confirming another passage adds to this list; it does not replace it.
          </p>
          <p className="mt-2 text-xs text-[hsl(var(--age-text-muted))]">
            Where an answer came from never changes a score. Provenance alone never changes a score
            — it records how a fact entered AGE, and nothing more.
          </p>
        </div>
      ) : undefined}
    </section>
  );
}
