'use client';

import { useState } from 'react';

import {
  BOTH_INTAKE_CHANNELS_READ,
  type ContradictionPreconditionView,
  type ContradictionsView,
} from '@age/studio-shell';

import { StateChip } from './state-chip';

/**
 * Where does AGE disagree with itself?
 *
 * 🛑 IT DOES NOT KNOW, AND THIS SCREEN EXISTS TO SAY SO PRECISELY.
 *
 * ⚠️ THE TRAP THIS SCREEN IS BUILT AROUND: `detectContradictions` is real and
 * works. It would run and return an empty set, because it compares evidence
 * records and AGE holds none. Rendering that as "no contradictions" would tell
 * the operator AGE checked a real business and found it sound. 🚫 That sentence
 * must never appear here.
 *
 * ⚠️ NOTHING HAPPENS UNTIL THE OPERATOR PRESSES — no effect on mount, no
 * refresh, no retry. Class 2 requires that a human initiated this specific act.
 *
 * 🚫 NO COUNT OF CONTRADICTIONS, no "0 found", no green tick, no clean-bill
 * summary anywhere on the surface.
 */

export interface ContradictionsPanelProps {
  readonly clientId: string;
  readonly report: (clientId: string, changedBy: string) => Promise<ContradictionsOutcomeLike>;
}

/**
 * ⚠️ Structurally re-declared rather than imported from the server module: a
 * client component that imported `operator-environment` would pull `node:fs`
 * into the browser bundle.
 */
export type ContradictionsOutcomeLike =
  | {
      readonly kind: 'reported';
      readonly view: ContradictionsView;
      readonly organizationId: string;
    }
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'no-answer-file' }
  | { readonly kind: 'refused'; readonly reason: string };

export function ContradictionsPanel({ clientId, report }: ContradictionsPanelProps) {
  const [changedBy, setChangedBy] = useState('');
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<ContradictionsOutcomeLike | undefined>(undefined);

  // ⚠️ No default principal, ever (ADR-0053 D4).
  const ready = changedBy.trim().length > 0 && !running;

  return (
    <section className="mt-6">
      <div className="rounded border border-[hsl(var(--age-border))] p-4">
        <h2 className="text-sm font-semibold">Report what stands in the way</h2>
        <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
          {BOTH_INTAKE_CHANNELS_READ}, then reports what the contradiction detector would need from
          them. It does not run the detector, and it does not compare anything.
        </p>
        <p className="mt-2 text-xs text-[hsl(var(--age-text-muted))]">
          A result would be empty for a reason that has nothing to do with this business, so no
          result is produced.
        </p>

        <label className="mt-4 block text-xs font-medium" htmlFor="contradictions-changed-by">
          Recorded by
        </label>
        <input
          id="contradictions-changed-by"
          name="changedBy"
          value={changedBy}
          placeholder="operator:your-handle"
          onChange={(event) => setChangedBy(event.target.value)}
          className="mt-1 w-full max-w-sm rounded border border-[hsl(var(--age-border))] bg-transparent px-2 py-1 font-mono text-sm"
        />
        <p className="mt-1 text-xs text-[hsl(var(--age-text-muted))]">
          Your session says which account signed in. It does not say who is accountable for this
          attribution, so it records the name you give here and nothing else — never the session’s
          account, and never guessed.
        </p>

        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            setRunning(true);
            void report(clientId, changedBy.trim())
              .then((result) => setOutcome(result))
              .catch(() =>
                setOutcome({
                  kind: 'refused',
                  reason: 'The request did not complete. Nothing was reported.',
                }),
              )
              .finally(() => setRunning(false));
          }}
          className="mt-4 rounded border border-[hsl(var(--age-border))] px-3 py-1.5 text-sm font-medium disabled:opacity-40"
        >
          {running ? 'Reading…' : 'Report what is missing'}
        </button>
      </div>

      {outcome === undefined ? (
        <p className="mt-4 text-sm text-[hsl(var(--age-text-muted))]">
          Nothing has been reported in this session. That is not a statement about this business.
        </p>
      ) : null}

      {outcome?.kind === 'no-answer-file' ? (
        <section className="mt-4 rounded border border-[hsl(var(--age-unknown))] p-4">
          <h3 className="text-sm font-semibold">Discovery has not been submitted</h3>
          <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
            There is no answer file for this business yet, so there is nothing recorded that could
            disagree with anything else.
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

      {outcome?.kind === 'reported' ? <Report view={outcome.view} /> : null}
    </section>
  );
}

function Report({ view }: { readonly view: ContradictionsView }) {
  return (
    <div className="mt-6">
      {/*
        ⚠️ THE REFUSAL COMES FIRST AND IS NOT COLLAPSIBLE. Anything below it is
        detail about why nothing was checked — never a result.
      */}
      <section className="rounded border border-[hsl(var(--age-border))] p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">The detector was not run</h2>
          <StateChip state="not-assessed" />
        </div>
        <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">{view.outcomeBecause}</p>
      </section>

      {/*
        ⚠️ Two counts, deliberately kept apart. "Sources recorded" is real work
        the operator did. "Sources the detector could read" is what is missing.
        🚫 Showing only the second would say the operator recorded nothing.
      */}
      <section className="mt-6 rounded border border-[hsl(var(--age-border))] p-4">
        <h2 className="text-sm font-semibold">What the capture holds</h2>
        <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-[hsl(var(--age-text-muted))]">Sources recorded</dt>
            <dd className="font-mono">{view.namedSourceCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-[hsl(var(--age-text-muted))]">
              Of those, readable by the detector
            </dt>
            <dd className="font-mono">{view.signalCarryingSourceCount}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-[hsl(var(--age-text-muted))]">
          Discovery records a source as text. Nothing extracts a position from that text, and
          nothing attaches it to a competitor, product or market — so there is no pair of statements
          that could oppose one another.
        </p>
      </section>

      <h2 className="mt-6 text-sm font-semibold">What the detector would need</h2>
      <ul className="mt-2 space-y-3">
        {view.preconditions.map((precondition) => (
          <Precondition key={precondition.requirement} precondition={precondition} />
        ))}
      </ul>

      <h2 className="mt-6 text-sm font-semibold">What AGE has not looked at</h2>
      <ul className="mt-2 space-y-3">
        {view.notAssessed.map((facet) => (
          <li key={facet.facet} className="rounded border border-[hsl(var(--age-border))] p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{facet.facet}</span>
              <StateChip state={facet.state} />
            </div>
            <p className="mt-1 text-sm text-[hsl(var(--age-text-muted))]">{facet.because}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * ⚠️ `unmet` and `unevaluable` get different words on purpose. "Not present" is
 * something AGE measured; "could not be checked" is something it never reached.
 * 🚫 One label for both would present the second as the first.
 */
function Precondition({ precondition }: { readonly precondition: ContradictionPreconditionView }) {
  const label =
    precondition.status === 'met'
      ? 'Present'
      : precondition.status === 'unmet'
        ? 'Not present'
        : 'Could not be checked';

  return (
    <li className="rounded border border-[hsl(var(--age-border))] p-3">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm">{precondition.requirement}</span>
        <span className="shrink-0 text-xs font-medium text-[hsl(var(--age-text-muted))]">
          {label}
        </span>
      </div>
      <p className="mt-1 text-sm text-[hsl(var(--age-text-muted))]">{precondition.observed}</p>
    </li>
  );
}
