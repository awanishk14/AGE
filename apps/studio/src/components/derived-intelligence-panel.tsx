'use client';

import { useState } from 'react';

import type { DerivedIntelligenceView } from '@age/studio-shell';

/**
 * What AGE CONCLUDES, with everything each conclusion rests on
 * (ADR-0069 D1/D2/D7).
 *
 * 🛑 **THE THIRD ANSWER ON THIS SCREEN, AND IT IS NOT A SYNTHESIS OF THE OTHER
 * TWO.** The panels above report what the operator's answer file says and what
 * AGE stored. This one reports what a named deterministic rule concluded by
 * relating recorded observations to the business context — 🚫 and it is never
 * merged with either (ADR-0064 D3 extends here unchanged).
 *
 * 🛑 **NOTHING RENDERS A CONCLUSION WITHOUT ITS CONTRIBUTORS.** Every finding
 * carries the observations that produced it — source system, record id, claim
 * and period — because a headline the operator cannot check is a headline the
 * operator will believe.
 *
 * 🛑 **THE FOUR SILENCES ARE RENDERED AS FOUR DIFFERENT SECTIONS, and none of
 * them is an empty panel.** "AGE concluded nothing" is a labelled state with the
 * sentence that says it is not "no issues found"; a modelled subject nobody
 * reported on is named; a kind AGE does not model is named with WHICH of the two
 * reasons applies. 🚫 AGE MUST NOT IMPLY KNOWLEDGE IT DOES NOT POSSESS.
 *
 * ⚠️ **NOTHING HAPPENS UNTIL THE OPERATOR PRESSES.** Opening the screen must not
 * open a database connection — and this is the one read that would open two.
 *
 * 🚫 **THE BIF ID IS TYPED, NEVER DERIVED** (ADR-0055 §5 item 1).
 *
 * 🚫 **THIS PANEL DECIDES NOTHING.** It re-orders nothing, counts nothing and
 * computes nothing; every string it shows was authored upstream by the rule or
 * by the view. A component that decided anything would be a second rule, and the
 * second copy is the one that gets relaxed.
 */

/**
 * ⚠️ Structurally typed rather than imported from the server module — a client
 * component that imported `operator-environment` would pull `node:fs` and the
 * capture composition into the browser bundle.
 */
export type DerivedIntelligenceOutcomeLike =
  | {
      readonly kind: 'derived';
      readonly view: DerivedIntelligenceView;
      readonly organizationId: string;
    }
  | { readonly kind: 'no-context'; readonly reason: string }
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'refused'; readonly reason: string };

export interface DerivedIntelligencePanelProps {
  readonly clientId: string;
  readonly read: (clientId: string, bifId: string) => Promise<DerivedIntelligenceOutcomeLike>;
}

export function DerivedIntelligencePanel({ clientId, read }: DerivedIntelligencePanelProps) {
  const [bifId, setBifId] = useState('');
  const [reading, setReading] = useState(false);
  const [outcome, setOutcome] = useState<DerivedIntelligenceOutcomeLike | undefined>(undefined);

  const ready = bifId.trim().length > 0 && !reading;

  return (
    <section className="mt-8">
      <div className="rounded border border-[hsl(var(--age-border))] p-4">
        <h2 className="text-sm font-semibold">Derive what AGE concludes</h2>
        <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
          AGE relates the observations source systems have relayed to the subjects the business
          context models, and reports what a named rule concludes from them. It concludes nothing
          from a single source: one system&apos;s report restated is not a finding.
        </p>

        <label className="mt-4 block text-xs font-medium" htmlFor="derived-intelligence-bif-id">
          BIF id
        </label>
        <input
          id="derived-intelligence-bif-id"
          name="bifId"
          value={bifId}
          placeholder="bif-…"
          onChange={(event) => setBifId(event.target.value)}
          className="mt-1 w-full max-w-sm rounded border border-[hsl(var(--age-border))] bg-transparent px-2 py-1 font-mono text-sm"
        />
        <p className="mt-1 text-xs text-[hsl(var(--age-text-muted))]">
          The id the business context was captured under. AGE cannot work it out for you.
        </p>

        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            setReading(true);
            void read(clientId, bifId.trim())
              .then((result) => setOutcome(result))
              .catch(() =>
                setOutcome({
                  kind: 'refused',
                  reason: 'The request did not complete. Nothing was derived.',
                }),
              )
              .finally(() => setReading(false));
          }}
          className="mt-4 rounded border border-[hsl(var(--age-border))] px-3 py-1.5 text-sm font-medium disabled:opacity-40"
        >
          {reading ? 'Deriving…' : 'Derive intelligence'}
        </button>
      </div>

      {outcome === undefined ? (
        <p className="mt-4 text-sm text-[hsl(var(--age-text-muted))]">
          Nothing has been derived in this session. That is not a statement about this business —
          the rule has not been run.
        </p>
      ) : null}

      {/*
        🛑 ITS OWN STATE, NEVER AN EMPTY RESULT. AGE holding no context means the
        derivation NEVER RAN; rendering that as "nothing concluded" would claim a
        check happened.
      */}
      {outcome?.kind === 'no-context' ? (
        <section className="mt-4 rounded border border-[hsl(var(--age-unknown))] p-4">
          <h3 className="text-sm font-semibold">The derivation did not run</h3>
          <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">{outcome.reason}</p>
        </section>
      ) : null}

      {outcome?.kind === 'not-configured' ? (
        <section className="mt-4 rounded border border-[hsl(var(--age-unknown))] p-4">
          <h3 className="text-sm font-semibold">Nothing has been configured</h3>
          <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
            Set <code className="font-mono text-xs">{outcome.variable}</code> and restart the
            console.
          </p>
        </section>
      ) : null}

      {outcome?.kind === 'refused' ? (
        <section className="mt-4 rounded border border-[hsl(var(--age-unknown))] p-4">
          <h3 className="text-sm font-semibold">Refused</h3>
          <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">{outcome.reason}</p>
        </section>
      ) : null}

      {outcome?.kind === 'derived' ? (
        <DerivedIntelligence view={outcome.view} organizationId={outcome.organizationId} />
      ) : null}
    </section>
  );
}

function Contributors({
  contributors,
}: {
  readonly contributors: DerivedIntelligenceView['conclusions'][number]['contributors'];
}) {
  return (
    <ul className="mt-3 space-y-2">
      {contributors.map((contributor) => (
        <li
          key={`${contributor.sourceSystem}:${contributor.sourceRecordId}`}
          className="rounded border border-[hsl(var(--age-border))] p-3 font-mono text-xs"
        >
          <div>{contributor.sourceSystem}</div>
          <div className="text-[hsl(var(--age-text-muted))]">
            {contributor.sourceInstance} · {contributor.sourceRecordId}
          </div>
          <div className="mt-1">{contributor.claim}</div>
          {/* 🚫 Verbatim. Never "3 days ago" — a relative time is a claim about now. */}
          <div className="text-[hsl(var(--age-text-muted))]">
            observed {contributor.observedAt} · window {contributor.window}
          </div>
        </li>
      ))}
    </ul>
  );
}

function DerivedIntelligence({
  view,
  organizationId,
}: {
  readonly view: DerivedIntelligenceView;
  readonly organizationId: string;
}) {
  return (
    <div className="mt-6">
      <p className="font-mono text-xs text-[hsl(var(--age-text-muted))]">
        bif {view.bifId} · organization {organizationId}
      </p>

      {/* 🛑 D1 and D2, above the result rather than beneath it. */}
      <p className="mt-3 text-xs text-[hsl(var(--age-text-muted))]">{view.derivationNotice}</p>
      <p className="mt-2 text-xs text-[hsl(var(--age-text-muted))]">{view.persistenceNotice}</p>

      {/*
        🛑 THE SENTENCE THAT STOPS AN EMPTY LIST READING AS A CLEAN BILL. It is
        present exactly when nothing was concluded, and 🚫 it is never softened.
      */}
      {view.nothingConcludedNotice === undefined ? null : (
        <section className="mt-4 rounded border border-[hsl(var(--age-unknown))] p-4">
          <h3 className="text-sm font-semibold">AGE concluded nothing</h3>
          <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
            {view.nothingConcludedNotice}
          </p>
        </section>
      )}

      {view.conclusions.length > 0 ? (
        <>
          <h3 className="mt-6 text-sm font-semibold">What AGE concludes</h3>
          <ul className="mt-2 space-y-4">
            {view.conclusions.map((conclusion) => (
              <li
                key={`${conclusion.subjectKind}:${conclusion.subject}`}
                className="rounded border border-[hsl(var(--age-border))] p-4"
              >
                <div className="text-sm font-semibold">
                  {conclusion.subject}{' '}
                  <span className="font-mono text-xs text-[hsl(var(--age-text-muted))]">
                    {conclusion.subjectKind}
                  </span>
                </div>
                <p className="mt-2 text-sm">{conclusion.statement}</p>
                {/* 🛑 What the conclusion is NOT, shown with it — never below the fold. */}
                <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
                  {conclusion.limitation}
                </p>
                <p className="mt-2 font-mono text-xs text-[hsl(var(--age-text-muted))]">
                  rule {conclusion.rule} · as of {conclusion.asOf} · {conclusion.producerCount}{' '}
                  source systems
                </p>
                <Contributors contributors={conclusion.contributors} />
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {/* 🛑 SILENCE 1 AND 2 — refused WITH the evidence for the refusal. */}
      <h3 className="mt-8 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--age-text-muted))]">
        What AGE will not conclude ({view.unconcluded.length})
      </h3>
      <ul className="mt-2 space-y-4">
        {view.unconcluded.map((entry) => (
          <li
            key={`${entry.subjectKind}:${entry.subject}`}
            className="rounded border border-[hsl(var(--age-border))] p-4"
          >
            <div className="text-sm font-semibold">
              {entry.subject}{' '}
              <span className="font-mono text-xs text-[hsl(var(--age-unknown))]">
                {entry.reason}
              </span>
            </div>
            <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">{entry.explanation}</p>
            <Contributors contributors={entry.contributors} />
          </li>
        ))}
      </ul>

      {/* 🛑 SILENCE 3 — 🚫 never "unchanged", 🚫 never "stable", 🚫 never a zero. */}
      <h3 className="mt-8 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--age-text-muted))]">
        Subjects nobody has reported on ({view.unobservedSubjects.length})
      </h3>
      <ul className="mt-2 space-y-2">
        {view.unobservedSubjects.map((subject) => (
          <li
            key={`${subject.subjectKind}:${subject.subject}`}
            className="rounded border border-[hsl(var(--age-border))] p-3"
          >
            <div className="text-sm">
              {subject.subject}{' '}
              <span className="font-mono text-xs text-[hsl(var(--age-text-muted))]">
                {subject.subjectKind}
              </span>
            </div>
            <p className="mt-1 text-sm text-[hsl(var(--age-text-muted))]">{subject.explanation}</p>
          </li>
        ))}
      </ul>

      {/*
        🛑 SILENCE 4 — and the TWO reasons stay apart. "AGE never looked" and
        "AGE looked and the business said nothing" lead to different next acts.
      */}
      <h3 className="mt-8 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--age-text-muted))]">
        What AGE does not model ({view.unmodelledKinds.length})
      </h3>
      <ul className="mt-2 space-y-2">
        {view.unmodelledKinds.map((kind) => (
          <li key={kind.subjectKind} className="rounded border border-[hsl(var(--age-border))] p-3">
            <div className="font-mono text-sm">{kind.subjectKind}</div>
            <p className="mt-1 text-sm text-[hsl(var(--age-text-muted))]">{kind.explanation}</p>
          </li>
        ))}
      </ul>

      {/* 🛑 KEPT, NEVER DROPPED — the gap is in what AGE models. */}
      <h3 className="mt-8 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--age-text-muted))]">
        Observations AGE could not relate ({view.unrelated.length})
      </h3>
      <ul className="mt-2 space-y-2">
        {view.unrelated.map((entry) => (
          <li
            key={`${entry.sourceSystem}:${entry.sourceRecordId}`}
            className="rounded border border-[hsl(var(--age-border))] p-3"
          >
            <div className="font-mono text-xs">
              {entry.sourceSystem} · {entry.sourceRecordId}
            </div>
            <div className="mt-1 font-mono text-xs">
              {entry.claim} · observed {entry.observedAt}
            </div>
            <p className="mt-1 text-sm text-[hsl(var(--age-text-muted))]">{entry.explanation}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
