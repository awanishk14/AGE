'use client';

import { useState } from 'react';

import type { GeneratedBifView } from '@age/studio-shell';

import { StateChip } from './state-chip';

/**
 * Producing and showing a BIF.
 *
 * ⚠️ NOTHING HAPPENS UNTIL THE OPERATOR PRESSES. There is no effect on mount,
 * no refresh, no retry and no recompute when the answers change — all of those
 * are system-initiated and stay class 3 under ADR-0057 D4 whatever their
 * effect. Generating a BIF is class 2, and class 2 requires that a human
 * initiated this specific act, now.
 *
 * 🚫 Nothing produced here is stored. The result lives in this component's
 * state and is gone when the page closes. Writing it down means the operator's
 * own `age-capture onboard --capture --confirm` run against their own local
 * database (ADR-0054 D6), and 🚫 the screen never implies otherwise.
 */

export interface BifPanelProps {
  readonly clientId: string;
  readonly generate: (clientId: string, changedBy: string) => Promise<GenerateBifOutcomeLike>;
}

/**
 * ⚠️ Structurally typed rather than imported from the server module: a client
 * component that imported `operator-environment` would pull `node:fs` into the
 * browser bundle.
 */
export type GenerateBifOutcomeLike =
  | { readonly kind: 'generated'; readonly view: GeneratedBifView; readonly organizationId: string }
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'no-answer-file' }
  | { readonly kind: 'refused'; readonly reason: string };

export function BifPanel({ clientId, generate }: BifPanelProps) {
  const [changedBy, setChangedBy] = useState('');
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<GenerateBifOutcomeLike | undefined>(undefined);

  // ⚠️ The button is disabled until a principal is typed, because the field has
  // no default and never will. 🚫 Do not fill it in from a hostname, a git
  // config or an environment variable — none of those is a person who claimed
  // this act.
  const ready = changedBy.trim().length > 0 && !running;

  return (
    <section className="mt-6">
      <div className="rounded border border-[hsl(var(--age-border))] p-4">
        <h2 className="text-sm font-semibold">Produce a BIF from this business’s answers</h2>
        <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
          This reads the answer file this console wrote and runs the same Discovery → BIF mapping
          and scoring the CLI runs. It happens once, when you press — never when the page opens.
        </p>
        <p className="mt-2 text-xs text-[hsl(var(--age-text-muted))]">
          Nothing is saved. The result below is not written to any database, and closing this page
          discards it.
        </p>

        <label className="mt-4 block text-xs font-medium" htmlFor="changed-by">
          Recorded by
        </label>
        <input
          id="changed-by"
          name="changedBy"
          value={changedBy}
          placeholder="operator:your-handle"
          onChange={(event) => setChangedBy(event.target.value)}
          className="mt-1 w-full max-w-sm rounded border border-[hsl(var(--age-border))] bg-transparent px-2 py-1 font-mono text-sm"
        />
        <p className="mt-1 text-xs text-[hsl(var(--age-text-muted))]">
          AGE has no sign-in yet, so it cannot know who you are. Provenance records the name you
          give here and nothing else — it is never guessed.
        </p>

        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            setRunning(true);
            void generate(clientId, changedBy.trim())
              .then((result) => setOutcome(result))
              .catch(() =>
                setOutcome({
                  kind: 'refused',
                  reason: 'The request did not complete. Nothing was produced.',
                }),
              )
              .finally(() => setRunning(false));
          }}
          className="mt-4 rounded border border-[hsl(var(--age-border))] px-3 py-1.5 text-sm font-medium disabled:opacity-40"
        >
          {running ? 'Producing…' : 'Generate BIF'}
        </button>
      </div>

      {outcome === undefined ? (
        <p className="mt-4 text-sm text-[hsl(var(--age-text-muted))]">
          No BIF has been produced in this session. That is not a statement about this business —
          nothing has been run.
        </p>
      ) : null}

      {outcome?.kind === 'no-answer-file' ? (
        <section className="mt-4 rounded border border-[hsl(var(--age-unknown))] p-4">
          <h3 className="text-sm font-semibold">Discovery has not been submitted</h3>
          <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
            There is no answer file for this business yet. A saved draft is not enough: a draft is
            unfinished by definition, and scoring one would report this business on answers nobody
            finished giving.
          </p>
        </section>
      ) : null}

      {outcome?.kind === 'not-configured' ? (
        <section className="mt-4 rounded border border-[hsl(var(--age-unknown))] p-4">
          <h3 className="text-sm font-semibold">No discovery workspace has been configured</h3>
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

      {outcome?.kind === 'generated' ? <ProducedBif view={outcome.view} /> : null}
    </section>
  );
}

function ProducedBif({ view }: { readonly view: GeneratedBifView }) {
  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold">Produced BIF</h2>
        <span className="rounded border border-[hsl(var(--age-border))] px-1.5 py-0.5 font-mono text-xs">
          {view.bifStatus}
        </span>
        <span className="font-mono text-xs text-[hsl(var(--age-text-muted))]">{view.bifId}</span>
      </div>

      <p className="mt-2 text-xs text-[hsl(var(--age-text-muted))]">
        Produced in memory from the answer file. It is not a stored snapshot, and no history of it
        exists.
      </p>

      {/*
        ⚠️ FOUR SCORES, SHOWN AS FOUR. 🚫 No average, no headline number: intake
        completeness measures how fully the interview was captured, BIF
        completeness measures how much of the canonical BIF this draft
        populates, and combining them would hide exactly the gap between them.
      */}
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Score label="Intake completeness" value={view.scores.discoveryCompletenessScore} />
        <Score label="Intake confidence" value={view.scores.discoveryConfidenceScore} />
        <Score label="BIF completeness" value={view.scores.bifCompletenessScore} />
        <Score label="BIF confidence" value={view.scores.bifConfidenceScore} />
      </dl>
      <p className="mt-2 text-xs text-[hsl(var(--age-text-muted))]">
        These four measure different things and are never combined. A thorough interview still
        yields a sparse BIF, because discovery covers only part of the BIF. Scoring version{' '}
        <span className="font-mono">{view.scoringVersion}</span>.
      </p>

      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--age-text-muted))]">
        Populated sections ({view.presentSectionCount})
      </h3>
      <ul className="mt-2 space-y-4">
        {view.sections.map((section) => (
          <li key={section.id} className="rounded border border-[hsl(var(--age-border))] p-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <h4 className="text-sm font-medium">{section.name}</h4>
              <span className="text-xs text-[hsl(var(--age-text-muted))]">
                completeness {section.completenessScore} · confidence {section.confidenceScore}
              </span>
            </div>
            <ul className="mt-2 space-y-1">
              {section.fields.map((field) => (
                <li key={field.key} className="text-sm">
                  {/*
                    ⚠️ The field's own key, verbatim. 🚫 No prettified label is
                    invented — the operator must be able to match what they see
                    here to what the CLI prints.
                  */}
                  <span className="font-mono text-xs text-[hsl(var(--age-text-muted))]">
                    {field.key}:{' '}
                  </span>
                  <span>{field.value}</span> <StateChip state={field.state} />{' '}
                  <span className="font-mono text-[0.6875rem] text-[hsl(var(--age-text-muted))]">
                    {field.confidence} · {field.source}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {/*
        ⚠️ Omitted sections are `unknown`, not `not-assessed`: the answers WERE
        read and said nothing about them. 🚫 They are never negative evidence
        about the business (ADR-0026 D4), and 🚫 never placeholder-filled so the
        grid looks complete.
      */}
      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--age-text-muted))]">
        Sections this BIF does not carry ({view.omittedSectionCount})
      </h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {view.omittedSections.map((section) => (
          <li
            key={section.type}
            className="flex items-center gap-2 rounded border border-dotted border-[hsl(var(--age-border))] px-2 py-1 text-sm"
          >
            {section.name} <StateChip state={section.state} />
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-[hsl(var(--age-text-muted))]">
        Discovery said nothing about these. That is a limit of what was captured, not a finding
        about the business — nothing here counts against it.
      </p>

      {view.unmappedFields.length > 0 ? (
        <>
          <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--age-text-muted))]">
            Answers no BIF field carries ({view.unmappedFields.length})
          </h3>
          <ul className="mt-2 space-y-1">
            {view.unmappedFields.map((entry) => (
              <li key={entry.field} className="text-sm">
                <span className="font-mono text-xs">{entry.field}</span>{' '}
                <span className="text-[hsl(var(--age-text-muted))]">— {entry.reason}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function Score({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="rounded border border-[hsl(var(--age-border))] p-2">
      <dt className="text-[0.6875rem] uppercase tracking-wider text-[hsl(var(--age-text-muted))]">
        {label}
      </dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
