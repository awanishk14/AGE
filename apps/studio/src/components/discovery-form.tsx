'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  BusinessDiscoveryQuestionnaire,
  BusinessDiscoveryQuestionnaireQuestion,
} from '@age/business-discovery-contracts';
import {
  draftFromFormEntries,
  fieldValueOf,
  isListQuestion,
  rationaleFor,
  skipReasonOf,
  summarizeDiscoveryProgress,
  summarizeDiscoverySections,
  DISCOVERY_SKIP_FIELD_PREFIX,
  type DiscoveryDraft,
  type DiscoverySkipReason,
} from '@age/studio-shell';

import { StateChip } from './state-chip';

/**
 * The discovery questionnaire, as a form.
 *
 * ⚠️ AUTOSAVE IS PERMITTED and is exactly what it sounds like: the operator's
 * own keystrokes, preserved. The Product Owner, 2026-08-03: "This is not AGE
 * making a business decision; it's simply preserving the operator's draft."
 * ⚠️ ADR-0059 D6 item 4 originally said the opposite; it is an ERRATUM,
 * corrected in that ADR's §0.1c. 🚫 Do not delete autosave on its authority.
 *
 * 🚫 What autosave must never become: a submit, a BIF generation, a recompute,
 * or anything that reaches outside AGE. Those are system-initiated and remain
 * class 3 (ADR-0057 D4) even when the effect is internal. The Submit button is
 * the only path to the answer file, and a human presses it.
 *
 * 🚫 The draft is stored SERVER-SIDE, in the directory the operator named.
 * There is no browser-local store — a business's own words must not sit in
 * `localStorage`, whose lifetime nothing in this repo governs.
 *
 * ─── ADR-0059 D6, and how the screen is laid out ───────────────────────────
 *
 * The Product Owner filled this in once and reported it "too boring and no
 * feels filling it". The five D6 items are all here, and the layout carries
 * one idea:
 *
 * ⚠️ THE OPERATOR WRITES IN THE COLUMN; AGE ANNOTATES IN THE MARGIN, IN THE
 * MONO FACE, BEHIND A RULE (`.age-note`). Whose sentence is whose must be
 * legible at a glance, because this whole product turns on the difference.
 * 🚫 Do not move an AGE annotation into the body face or into the field.
 */

type SaveState = 'never-saved' | 'unsaved' | 'saving' | 'saved' | 'failed';

/**
 * A fact the resolved `ClientRecord` already states (D6 item 5).
 *
 * 🚫 PROPOSED, NEVER FILLED IN. The operator presses "Use this" and the value
 * becomes their answer; until then the field is empty and the question counts
 * as unanswered. Silently pre-filling would put a value into the answer file
 * that no one typed, and every downstream score would count it as stated.
 * ⚠️ This is D1's rule — extraction proposes, never answers — applied to the
 * one source D6 does authorize.
 */
export interface RecordFact {
  readonly questionId: string;
  readonly value: string;
  /** Where it came from, in words the operator can check. */
  readonly source: string;
}

export interface DiscoveryFormProps {
  readonly clientId: string;
  readonly questionnaire: BusinessDiscoveryQuestionnaire;
  readonly initialDraft: DiscoveryDraft;
  readonly everSaved: boolean;
  /** 🚫 Only facts the record ALREADY states. Never a guess from any of them. */
  readonly recordFacts?: readonly RecordFact[];
  readonly save: (
    clientId: string,
    formData: FormData,
  ) => Promise<{ kind: string; reason?: string }>;
  readonly submit: (
    clientId: string,
    formData: FormData,
  ) => Promise<{ kind: string; reason?: string; fileName?: string; questionId?: string }>;
}

/** How long typing settles before the draft is written. */
const AUTOSAVE_DELAY_MS = 1200;

const SKIP_LABELS: Readonly<Record<DiscoverySkipReason, string>> = {
  'not-applicable': "Doesn't apply",
  unknown: "Don't know yet",
};

export function DiscoveryForm({
  clientId,
  questionnaire,
  initialDraft,
  everSaved,
  recordFacts = [],
  save,
  submit,
}: DiscoveryFormProps) {
  const [draft, setDraft] = useState<DiscoveryDraft>(initialDraft);
  const [skips, setSkips] = useState<Readonly<Record<string, DiscoverySkipReason>>>(
    initialDraft.skips,
  );
  const [saveState, setSaveState] = useState<SaveState>(everSaved ? 'saved' : 'never-saved');
  const [saveError, setSaveError] = useState<string | undefined>(undefined);
  const [submitResult, setSubmitResult] = useState<
    { readonly kind: string; readonly reason?: string; readonly fileName?: string } | undefined
  >(undefined);

  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const progress = summarizeDiscoveryProgress(draft, questionnaire);
  const sections = summarizeDiscoverySections(draft, questionnaire);
  const complete = progress.missingRequired.length === 0;

  const persist = useCallback(async () => {
    const form = formRef.current;
    if (form === null) return;

    setSaveState('saving');
    const outcome = await save(clientId, new FormData(form));

    if (outcome.kind === 'saved') {
      setSaveState('saved');
      setSaveError(undefined);
      return;
    }

    // 🚫 A failed save never reports success and never clears the form. The
    // operator's typing is still on screen and still unsaved, and the banner
    // says so.
    setSaveState('failed');
    setSaveError(outcome.reason ?? 'The draft could not be saved.');
  }, [clientId, save]);

  const reread = useCallback(() => {
    const form = formRef.current;
    if (form === null) return;

    const entries: Record<string, string> = {};
    for (const [key, value] of new FormData(form).entries()) {
      if (typeof value === 'string') entries[key] = value;
    }
    setDraft(draftFromFormEntries(entries, questionnaire));
    setSaveState('unsaved');

    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void persist();
    }, AUTOSAVE_DELAY_MS);
  }, [persist, questionnaire]);

  /**
   * Toggling a skip clears the field, because the two states are mutually
   * exclusive in the draft and the screen must not show otherwise.
   * ⚠️ `reread` runs after the DOM settles so the form is the single source of
   * truth for both — there is no second place holding what the operator meant.
   */
  const toggleSkip = useCallback(
    (question: BusinessDiscoveryQuestionnaireQuestion, reason: DiscoverySkipReason) => {
      setSkips((current) => {
        const next = { ...current };
        if (next[question.id] === reason) {
          delete next[question.id];
        } else {
          next[question.id] = reason;
          const field = formRef.current?.elements.namedItem(question.id);
          if (field instanceof HTMLTextAreaElement) field.value = '';
        }
        return next;
      });
      queueMicrotask(reread);
    },
    [reread],
  );

  const acceptFact = useCallback(
    (fact: RecordFact) => {
      const field = formRef.current?.elements.namedItem(fact.questionId);
      if (field instanceof HTMLTextAreaElement) {
        field.value = fact.value;
        reread();
      }
    },
    [reread],
  );

  useEffect(
    () => () => {
      if (timer.current !== undefined) clearTimeout(timer.current);
    },
    [],
  );

  const onSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = formRef.current;
      if (form === null) return;

      if (timer.current !== undefined) clearTimeout(timer.current);
      const outcome = await submit(clientId, new FormData(form));
      setSubmitResult(outcome);
      if (outcome.kind === 'written') {
        setSaveState('saved');
      }
    },
    [clientId, submit],
  );

  return (
    <form ref={formRef} onChange={reread} onSubmit={onSubmit} className="mt-8">
      <div className="grid gap-10 lg:grid-cols-[13rem_minmax(0,42rem)]">
        {/*
          The section index. ⚠️ It is a WHERE-AM-I, not a wizard: every section
          is on this one page and reachable in any order. 🚫 It offers no "next"
          and implies no sequence — the questionnaire declares none.
        */}
        <nav aria-label="Sections" className="order-2 lg:sticky lg:top-8 lg:order-1 lg:self-start">
          <p className="age-eyebrow">Sections</p>
          <ol className="mt-3 space-y-2">
            {sections.map((section) => (
              <li key={section.sectionId}>
                <a
                  href={`#section-${section.sectionId}`}
                  className="block rounded-sm py-0.5 text-xs underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {section.name}
                  <span className="age-eyebrow ml-2">
                    {section.answered}/{section.total}
                    {section.skipped > 0 ? ` · ${section.skipped} passed` : ''}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="order-1 lg:order-2">
          <SaveBanner state={saveState} error={saveError} />

          <section className="mt-5" aria-label="Progress">
            <div className="age-tally" role="img" aria-label={tallyLabel(progress)}>
              {questionnaire.sections
                .flatMap((section) => section.questions)
                .map((question) => (
                  <span
                    key={question.id}
                    className="age-tally-cell"
                    data-cell={cellStateOf(draft, question.id)}
                  />
                ))}
            </div>

            <p className="mt-3 text-sm">
              <strong className="font-semibold">{progress.answered}</strong> of {progress.total}{' '}
              answered
              {progress.skipped > 0 ? ` · ${progress.skipped} passed over` : ''} ·{' '}
              {progress.requiredAnswered} of {progress.requiredTotal} required.
            </p>
            {/*
              ⚠️ This is a COUNT OF FIELDS, never a score. `discoveryCompletenessScore`
              is a different number with a different meaning, computed downstream from
              the profile. 🚫 Do not present this as completeness.
            */}
            <p className="age-note mt-2">
              This counts fields you filled in. It is not a discovery score — nothing here has been
              scored, and an answered question is not a verified one.
            </p>
          </section>

          {questionnaire.sections.map((section, index) => {
            const counted = sections[index];

            return (
              <section
                key={section.id}
                id={`section-${section.id}`}
                className="mt-12 scroll-mt-8 border-t border-[hsl(var(--age-border))] pt-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 className="text-base font-semibold tracking-tight">{section.name}</h2>
                  <p className="age-eyebrow">
                    {counted?.answered ?? 0} of {counted?.total ?? 0} answered
                  </p>
                </div>

                <div className="mt-6 space-y-9">
                  {section.questions.map((question) => (
                    <Question
                      key={question.id}
                      question={question}
                      draft={draft}
                      skip={skips[question.id]}
                      fact={recordFacts.find((candidate) => candidate.questionId === question.id)}
                      onToggleSkip={toggleSkip}
                      onAcceptFact={acceptFact}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          <section className="mt-14 border-t border-[hsl(var(--age-border))] pt-6">
            <p className="age-eyebrow">Answer file</p>
            <h2 className="mt-2 text-base font-semibold tracking-tight">
              Generate the answer file
            </h2>
            <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
              This writes the canonical discovery answer file — the same artifact{' '}
              <code className="font-mono text-xs">age-capture</code> reads. It does not generate a
              BIF, run capture or write to a database.
            </p>

            {!complete ? (
              <p className="age-note mt-4">
                <strong>
                  {progress.missingRequired.length} required question
                  {progress.missingRequired.length === 1 ? '' : 's'}
                </strong>{' '}
                still unanswered, so the answer file would understate what is known about this
                business. Passing a question over does not fill it in.
              </p>
            ) : null}

            <button
              type="submit"
              disabled={!complete}
              className="mt-5 rounded border border-[hsl(var(--age-text))] px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:border-[hsl(var(--age-border))] disabled:opacity-40"
            >
              Generate answer file
            </button>

            {submitResult !== undefined ? (
              <p
                className={`mt-4 text-sm ${
                  submitResult.kind === 'written'
                    ? 'text-[hsl(var(--age-text))]'
                    : 'text-[hsl(var(--age-unknown))]'
                }`}
              >
                {submitResult.kind === 'written'
                  ? `Written to ${submitResult.fileName} in your discovery workspace.`
                  : (submitResult.reason ?? 'The answer file was not written.')}
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </form>
  );
}

/** One question: the operator's column, then AGE's margin, then the skips. */
function Question({
  question,
  draft,
  skip,
  fact,
  onToggleSkip,
  onAcceptFact,
}: {
  readonly question: BusinessDiscoveryQuestionnaireQuestion;
  readonly draft: DiscoveryDraft;
  readonly skip?: DiscoverySkipReason;
  readonly fact?: RecordFact;
  readonly onToggleSkip: (
    question: BusinessDiscoveryQuestionnaireQuestion,
    reason: DiscoverySkipReason,
  ) => void;
  readonly onAcceptFact: (fact: RecordFact) => void;
}) {
  const rationale = rationaleFor(question);
  const answered = draft.answers[question.id] !== undefined;
  const skipped = skipReasonOf(draft, question.id) !== undefined;

  return (
    <div>
      <label htmlFor={question.id} className="block text-[0.9375rem] font-medium leading-snug">
        {question.prompt}
        {question.required ? <span className="age-eyebrow ml-2">required</span> : null}
      </label>

      <textarea
        id={question.id}
        name={question.id}
        rows={isListQuestion(question) ? 3 : question.kind === 'longText' ? 2 : 1}
        defaultValue={fieldValueOf(draft, question.id)}
        disabled={skip !== undefined}
        aria-describedby={rationale !== undefined ? `${question.id}-why` : undefined}
        placeholder={skip !== undefined ? SKIP_LABELS[skip] : undefined}
        className="age-field mt-2 disabled:opacity-50"
      />

      {/*
        🚫 The skip field is the ONLY thing that carries the skip to the server.
        Its value is validated there against the declared reasons; an
        unrecognised one is ignored rather than coerced.
      */}
      {skip !== undefined ? (
        <input type="hidden" name={`${DISCOVERY_SKIP_FIELD_PREFIX}${question.id}`} value={skip} />
      ) : null}

      {/* AGE's margin. Never the operator's words, never inside the field. */}
      <div className="age-note mt-3 space-y-1" id={`${question.id}-why`}>
        {rationale !== undefined ? (
          <>
            <p>
              <strong>Why</strong> {rationale.feeds} Becomes{' '}
              <span className="font-semibold">{rationale.profileField}</span>.
            </p>
            {!answered ? (
              <p>
                <strong>If blank</strong> {rationale.ifBlank}
              </p>
            ) : null}
          </>
        ) : (
          /*
            🚫 No invented explanation. This question declares no route into the
            profile, so there is nothing true to say about what it feeds — and a
            plausible sentence here would be exactly the confident falsehood
            this product exists to refuse.
          */
          <p>
            <strong>Why</strong> Recorded with your answers. It populates no structured profile
            field, so nothing downstream reasons over it.
          </p>
        )}

        {isListQuestion(question) ? (
          <p>
            <strong>Format</strong> One per line. AGE never splits one answer into several — you
            decide where the boundaries are.
          </p>
        ) : null}

        {skipped && question.required ? (
          <p>
            <strong>Still required</strong> Passing it over is your note to yourself. The answer
            file cannot be generated until it is answered.
          </p>
        ) : null}
      </div>

      {fact !== undefined && !answered && skip === undefined ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/*
            D6 item 5 — PROPOSED, never filled in. Until the operator presses
            this, the question is unanswered and counts as unanswered.
          */}
          <button type="button" onClick={() => onAcceptFact(fact)} className="age-chip">
            Use “{fact.value}”
          </button>
          <span className="age-eyebrow">from {fact.source}</span>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {(Object.keys(SKIP_LABELS) as DiscoverySkipReason[]).map((reason) => (
          <button
            key={reason}
            type="button"
            aria-pressed={skip === reason}
            onClick={() => onToggleSkip(question, reason)}
            className="age-chip"
          >
            {SKIP_LABELS[reason]}
          </button>
        ))}
      </div>
    </div>
  );
}

function cellStateOf(draft: DiscoveryDraft, questionId: string): 'answered' | 'skipped' | 'open' {
  if (draft.answers[questionId] !== undefined) return 'answered';
  return skipReasonOf(draft, questionId) !== undefined ? 'skipped' : 'open';
}

/**
 * ⚠️ The tally is decorative to a screen reader unless it is labelled, and the
 * label must carry the same three counts the sighted reader gets — 🚫 not a
 * percentage, which the tally deliberately cannot express.
 */
function tallyLabel(progress: {
  readonly answered: number;
  readonly skipped: number;
  readonly open: number;
  readonly total: number;
}): string {
  return (
    `${progress.answered} of ${progress.total} questions answered, ` +
    `${progress.skipped} passed over, ${progress.open} not yet reached`
  );
}

function SaveBanner({ state, error }: { readonly state: SaveState; readonly error?: string }) {
  if (state === 'failed') {
    return (
      <div className="rounded border border-[hsl(var(--age-unknown))] p-3">
        <p className="text-sm font-semibold">Not saved</p>
        <p className="mt-1 text-sm text-[hsl(var(--age-text-muted))]">{error}</p>
        <p className="age-note mt-2">
          What you typed is still on this screen. Do not close the tab until it saves.
        </p>
      </div>
    );
  }

  const label =
    state === 'saving'
      ? 'Saving…'
      : state === 'saved'
        ? 'Draft saved'
        : state === 'unsaved'
          ? 'Unsaved changes'
          : 'Nothing saved yet';

  return (
    <div className="flex items-center gap-2">
      <StateChip state={state === 'never-saved' ? 'not-assessed' : 'known'} />
      <p className="age-eyebrow">{label}</p>
    </div>
  );
}
