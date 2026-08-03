'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { BusinessDiscoveryQuestionnaire } from '@age/business-discovery-contracts';
import {
  draftFromFormEntries,
  fieldValueOf,
  isListQuestion,
  summarizeDiscoveryProgress,
  type DiscoveryDraft,
} from '@age/studio-shell';

import { StateChip } from './state-chip';

/**
 * The discovery questionnaire, as a form.
 *
 * ⚠️ AUTOSAVE IS PERMITTED and is exactly what it sounds like: the operator's
 * own keystrokes, preserved. The Product Owner, 2026-08-03: "This is not AGE
 * making a business decision; it's simply preserving the operator's draft."
 *
 * 🚫 What autosave must never become: a submit, a BIF generation, a recompute,
 * or anything that reaches outside AGE. Those are system-initiated and remain
 * class 3 (ADR-0057 D4) even when the effect is internal. The Submit button is
 * the only path to the answer file, and a human presses it.
 *
 * 🚫 The draft is stored SERVER-SIDE, in the directory the operator named.
 * There is no browser-local store — a business's own words must not sit in
 * `localStorage`, whose lifetime nothing in this repo governs.
 */

type SaveState = 'never-saved' | 'unsaved' | 'saving' | 'saved' | 'failed';

export interface DiscoveryFormProps {
  readonly clientId: string;
  readonly questionnaire: BusinessDiscoveryQuestionnaire;
  readonly initialDraft: DiscoveryDraft;
  readonly everSaved: boolean;
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

export function DiscoveryForm({
  clientId,
  questionnaire,
  initialDraft,
  everSaved,
  save,
  submit,
}: DiscoveryFormProps) {
  const [draft, setDraft] = useState<DiscoveryDraft>(initialDraft);
  const [saveState, setSaveState] = useState<SaveState>(everSaved ? 'saved' : 'never-saved');
  const [saveError, setSaveError] = useState<string | undefined>(undefined);
  const [submitResult, setSubmitResult] = useState<
    { readonly kind: string; readonly reason?: string; readonly fileName?: string } | undefined
  >(undefined);

  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const progress = summarizeDiscoveryProgress(draft, questionnaire);
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

  const onChange = useCallback(() => {
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
    <form ref={formRef} onChange={onChange} onSubmit={onSubmit} className="mt-6">
      <SaveBanner state={saveState} error={saveError} />

      <p className="mt-4 text-sm text-[hsl(var(--age-text-muted))]">
        {progress.answered} of {progress.total} questions answered · {progress.requiredAnswered} of{' '}
        {progress.requiredTotal} required.
      </p>
      {/*
        ⚠️ This is a COUNT OF FIELDS, never a score. `discoveryCompletenessScore`
        is a different number with a different meaning, computed downstream from
        the profile. 🚫 Do not present this as completeness.
      */}
      <p className="mt-1 text-xs text-[hsl(var(--age-text-muted))]">
        This counts fields you have filled in. It is not a discovery score — nothing here has been
        scored, and an answered question is not a verified one.
      </p>

      {questionnaire.sections.map((section) => (
        <section key={section.id} className="mt-8">
          <h2 className="text-sm font-semibold tracking-tight">{section.name}</h2>
          <div className="mt-3 space-y-5">
            {section.questions.map((question) => (
              <div key={question.id}>
                <label htmlFor={question.id} className="block text-sm">
                  {question.prompt}
                  {question.required ? (
                    <span className="ml-2 text-xs text-[hsl(var(--age-text-muted))]">required</span>
                  ) : null}
                </label>

                {isListQuestion(question) ? (
                  <>
                    <textarea
                      id={question.id}
                      name={question.id}
                      rows={3}
                      defaultValue={fieldValueOf(initialDraft, question.id)}
                      className="mt-1 w-full rounded border border-[hsl(var(--age-border))] bg-transparent p-2 text-sm"
                    />
                    <p className="mt-1 text-xs text-[hsl(var(--age-text-muted))]">
                      One per line. AGE never splits one answer into several — you decide where the
                      boundaries are.
                    </p>
                  </>
                ) : (
                  <textarea
                    id={question.id}
                    name={question.id}
                    rows={question.kind === 'longText' ? 4 : 1}
                    defaultValue={fieldValueOf(initialDraft, question.id)}
                    className="mt-1 w-full rounded border border-[hsl(var(--age-border))] bg-transparent p-2 text-sm"
                  />
                )}

                {question.required && draft.answers[question.id] === undefined ? (
                  <p className="mt-1 text-xs text-[hsl(var(--age-not-assessed))]">
                    Not answered yet. Leaving it blank omits it from the answer file rather than
                    recording an empty answer.
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="mt-10 border-t border-[hsl(var(--age-border))] pt-6">
        <h2 className="text-sm font-semibold">Generate the answer file</h2>
        <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
          This writes the canonical discovery answer file — the same artifact{' '}
          <code>age-capture</code> reads. It does not generate a BIF, run capture or write to a
          database.
        </p>

        {!complete ? (
          <p className="mt-3 text-xs text-[hsl(var(--age-not-assessed))]">
            {progress.missingRequired.length} required question
            {progress.missingRequired.length === 1 ? ' is' : 's are'} still unanswered, so the
            answer file would understate what is known about this business.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!complete}
          className="mt-4 rounded border border-[hsl(var(--age-border))] px-3 py-1.5 text-sm disabled:opacity-40"
        >
          Generate answer file
        </button>

        {submitResult !== undefined ? (
          <p
            className={`mt-3 text-sm ${
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
    </form>
  );
}

function SaveBanner({ state, error }: { readonly state: SaveState; readonly error?: string }) {
  if (state === 'failed') {
    return (
      <div className="rounded border border-[hsl(var(--age-unknown))] p-3">
        <p className="text-sm font-semibold">Not saved</p>
        <p className="mt-1 text-sm text-[hsl(var(--age-text-muted))]">{error}</p>
        <p className="mt-1 text-xs text-[hsl(var(--age-text-muted))]">
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
      <p className="text-xs text-[hsl(var(--age-text-muted))]">{label}</p>
    </div>
  );
}
