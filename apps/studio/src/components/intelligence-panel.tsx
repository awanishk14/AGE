'use client';

import { useState } from 'react';

import type { CapabilityReadinessRowView, CapabilityReadinessView } from '@age/studio-shell';

import { StateChip } from './state-chip';

/**
 * How far the captured context carries each capability.
 *
 * ⚠️ NOTHING HAPPENS UNTIL THE OPERATOR PRESSES — no effect on mount, no
 * refresh, no retry. Class 2 requires that a human initiated this specific act,
 * now.
 *
 * 🚫 THERE IS NO "RUN" BUTTON AND THERE MUST NOT BE ONE. Executing a capability
 * against a real business is class 3 and is refused, not postponed. This screen
 * asks each capability what it would need; it never asks one to do anything.
 *
 * 🚫 NO OVERALL FIGURE ANYWHERE — no count of ready capabilities, no progress
 * bar, no badge, no ordering by state. The three assessments judge different
 * sets of BIF sections against their own thresholds, so there is no scale in
 * which a combined number could be expressed (ADR-0047 D4).
 */

export interface IntelligencePanelProps {
  readonly clientId: string;
  readonly assess: (clientId: string, changedBy: string) => Promise<CapabilityReadinessOutcomeLike>;
}

/**
 * ⚠️ Structurally typed rather than imported from the server module: a client
 * component that imported `operator-environment` would pull `node:fs` into the
 * browser bundle.
 */
export type CapabilityReadinessOutcomeLike =
  | {
      readonly kind: 'assessed';
      readonly view: CapabilityReadinessView;
      readonly organizationId: string;
    }
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'no-answer-file' }
  | { readonly kind: 'refused'; readonly reason: string };

export function IntelligencePanel({ clientId, assess }: IntelligencePanelProps) {
  const [changedBy, setChangedBy] = useState('');
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<CapabilityReadinessOutcomeLike | undefined>(undefined);

  // ⚠️ No default principal, ever (ADR-0053 D4).
  const ready = changedBy.trim().length > 0 && !running;

  return (
    <section className="mt-6">
      <div className="rounded border border-[hsl(var(--age-border))] p-4">
        <h2 className="text-sm font-semibold">Assess capability readiness</h2>
        <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
          This reads the answer file this console wrote, builds a BIF from it in memory, and asks
          each capability that publishes an assessment how far that context carries it. It happens
          once, when you press — never when the page opens.
        </p>
        <p className="mt-2 text-xs text-[hsl(var(--age-text-muted))]">
          No capability is run. Readiness describes the captured context, never a result, and
          nothing produced here is stored.
        </p>

        <label className="mt-4 block text-xs font-medium" htmlFor="intelligence-changed-by">
          Recorded by
        </label>
        <input
          id="intelligence-changed-by"
          name="changedBy"
          value={changedBy}
          placeholder="operator:your-handle"
          onChange={(event) => setChangedBy(event.target.value)}
          className="mt-1 w-full max-w-sm rounded border border-[hsl(var(--age-border))] bg-transparent px-2 py-1 font-mono text-sm"
        />
        <p className="mt-1 text-xs text-[hsl(var(--age-text-muted))]">
          AGE has no sign-in yet, so it cannot know who you are. It records the name you give here
          and nothing else — it is never guessed.
        </p>

        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            setRunning(true);
            void assess(clientId, changedBy.trim())
              .then((result) => setOutcome(result))
              .catch(() =>
                setOutcome({
                  kind: 'refused',
                  reason: 'The request did not complete. Nothing was assessed.',
                }),
              )
              .finally(() => setRunning(false));
          }}
          className="mt-4 rounded border border-[hsl(var(--age-border))] px-3 py-1.5 text-sm font-medium disabled:opacity-40"
        >
          {running ? 'Assessing…' : 'Assess readiness'}
        </button>
      </div>

      {outcome === undefined ? (
        <p className="mt-4 text-sm text-[hsl(var(--age-text-muted))]">
          No readiness has been assessed in this session. That is not a statement about this
          business — nothing has been assessed.
        </p>
      ) : null}

      {outcome?.kind === 'no-answer-file' ? (
        <section className="mt-4 rounded border border-[hsl(var(--age-unknown))] p-4">
          <h3 className="text-sm font-semibold">Discovery has not been submitted</h3>
          <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
            There is no answer file for this business yet, so there is no context to assess. This is
            not a capability reporting that it lacks what it needs — nothing has been asked.
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

      {outcome?.kind === 'assessed' ? <Readiness view={outcome.view} /> : null}
    </section>
  );
}

function Readiness({ view }: { readonly view: CapabilityReadinessView }) {
  return (
    <div className="mt-6">
      {/*
        ⚠️ THE NOTICE COMES FIRST AND IS NOT COLLAPSIBLE. Without it, six states
        in one list read as a scale — which is the comparison three ADRs
        declined to create.
      */}
      <section className="rounded border border-[hsl(var(--age-border))] p-4">
        <h2 className="text-sm font-semibold">These states are not comparable</h2>
        {view.incommensurabilityNotice.map((line) => (
          <p key={line} className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
            {line}
          </p>
        ))}
      </section>

      {/*
        🚫 Rendered in the report order and never sorted by state. Ordering by
        state is itself a ranking.
      */}
      <h2 className="mt-6 text-sm font-semibold">Each capability, on its own terms</h2>
      <ul className="mt-2 space-y-3">
        {view.rows.map((row) => (
          <CapabilityRow key={row.capabilityName} row={row} />
        ))}
      </ul>

      {/*
        ⚠️ `not-assessed`, never zero. Readiness is not production, and the half
        of the question this screen cannot answer is stated rather than left to
        look answered.
      */}
      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--age-text-muted))]">
        What AGE has not looked at
      </h3>
      <ul className="mt-2 space-y-2">
        {view.notAssessed.map((facet) => (
          <li key={facet.label} className="rounded border border-[hsl(var(--age-border))] p-3">
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
              {facet.label} <StateChip state={facet.state} />
            </div>
            <p className="mt-1 text-sm text-[hsl(var(--age-text-muted))]">{facet.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CapabilityRow({ row }: { readonly row: CapabilityReadinessRowView }) {
  return (
    <li className="rounded border border-[hsl(var(--age-border))] p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
        {row.capabilityName} <StateChip state={row.state} />
        {row.assessedState === undefined ? null : (
          <span className="font-mono text-xs text-[hsl(var(--age-text-muted))]">
            {row.assessedState}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-[hsl(var(--age-text-muted))]">{row.declaration}</p>

      {/*
        ⚠️ A non-adopter says so in words. 🚫 Never "not ready", never a blank
        cell — it has not judged this business at all.
      */}
      {row.notAssessedBecause === undefined ? null : (
        <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">{row.notAssessedBecause}</p>
      )}

      {/*
        ⚠️ THE DENOMINATOR SITS BESIDE THE STATE, always. A state shown without
        what it measured invites the comparison ADR-0027 D2 refused.
      */}
      {row.denominator === undefined ? null : (
        <p className="mt-2 text-xs text-[hsl(var(--age-text-muted))]">
          Judged against: {row.denominator}
        </p>
      )}
      {row.requiredSectionTypes === undefined ? null : (
        <p className="mt-1 font-mono text-[0.6875rem] text-[hsl(var(--age-text-muted))]">
          {row.requiredSectionTypes.join(' · ')}
        </p>
      )}
      {row.thresholds.length === 0 ? null : (
        <p className="mt-1 font-mono text-[0.6875rem] text-[hsl(var(--age-text-muted))]">
          {row.thresholds.map((threshold) => `${threshold.label} ${threshold.value}`).join(' · ')}
        </p>
      )}

      {row.reasons.length === 0 ? null : (
        <ul className="mt-3 space-y-1">
          {row.reasons.map((reason) => (
            <li key={reason} className="text-sm text-[hsl(var(--age-text-muted))]">
              {reason}
            </li>
          ))}
        </ul>
      )}

      {row.limitations.length === 0 ? null : (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium">
            What limits this assessment ({row.limitations.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {row.limitations.map((limitation) => (
              <li key={limitation} className="text-sm text-[hsl(var(--age-text-muted))]">
                {limitation}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/*
        ⚠️ Hints name CONTEXT TO CAPTURE, never a conclusion to draw and never an
        action to take — ADR-0027 D1 forbids an assessment to hint at a plan.
      */}
      {row.improvementHints.length === 0 ? null : (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium">
            What would raise it ({row.improvementHints.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {row.improvementHints.map((hint) => (
              <li key={hint} className="text-sm text-[hsl(var(--age-text-muted))]">
                {hint}
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}
