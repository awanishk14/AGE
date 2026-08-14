'use client';

import { useState } from 'react';

import type { ClientContextProjectionView } from '@age/studio-shell';

/**
 * What AGE WOULD TELL A PEER about this business (ADR-0069 deliverable 7).
 *
 * 🛑 **THE OPERATOR SEES THE PEER'S OWN ANSWER, 🚫 NOT A DESCRIPTION OF IT.**
 * Every sentence rendered here was authored by `projectClientContext` — the same
 * function the peer-facing tool will call — and carried through unchanged. 🚫 A
 * friendlier console wording growing beside it would leave the operator
 * auditing a rendering rather than the thing itself.
 *
 * 🛑 **NO PEER CAN ACTUALLY ASK YET, AND THIS PANEL SAYS SO, ABOVE THE ANSWER.**
 * The tool is blocked on token verification (ADR-0068 §0.1b). 🚫 Do not soften
 * that sentence, move it below the fold, or close the gap with a session, a
 * token, a default organization or a route.
 *
 * 🛑 **THIS IS THE FIRST ANSWER OF THE THREE, AND IT STAYS SEPARATE.** It is
 * what the BUSINESS stated. What a source system reported is the panel below it;
 * what AGE concludes is a rule's answer on the Intelligence screen. 🚫 The three
 * are never merged, and this panel claims nothing about the other two.
 *
 * ⚠️ **NOTHING HAPPENS UNTIL THE OPERATOR PRESSES.** Opening the screen must not
 * open a database connection.
 *
 * 🚫 **THE BIF ID IS TYPED, NEVER DERIVED** (ADR-0055 §5 item 1).
 *
 * 🚫 **THIS PANEL DECIDES NOTHING.** It counts nothing, re-orders nothing,
 * filters nothing and hides no kind — every subject kind the projection carried
 * is rendered, including the silent ones, and the two silent states stay apart.
 */

/**
 * ⚠️ Structurally typed rather than imported from the server module — a client
 * component that imported `operator-environment` would pull `node:fs` and the
 * capture composition into the browser bundle.
 */
export type ClientContextProjectionOutcomeLike =
  | {
      readonly kind: 'projected';
      readonly view: ClientContextProjectionView;
      readonly organizationId: string;
    }
  | { readonly kind: 'no-context'; readonly reason: string }
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'refused'; readonly reason: string };

export interface ClientContextProjectionPanelProps {
  readonly clientId: string;
  readonly read: (clientId: string, bifId: string) => Promise<ClientContextProjectionOutcomeLike>;
}

export function ClientContextProjectionPanel({
  clientId,
  read,
}: ClientContextProjectionPanelProps) {
  const [bifId, setBifId] = useState('');
  const [reading, setReading] = useState(false);
  const [outcome, setOutcome] = useState<ClientContextProjectionOutcomeLike | undefined>(undefined);

  const ready = bifId.trim().length > 0 && !reading;

  return (
    <section className="mt-8">
      <div className="rounded border border-[hsl(var(--age-border))] p-4">
        <h2 className="text-sm font-semibold">What AGE would tell a peer product</h2>
        <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
          The subjects AGE models for this business, as the business itself stated them. This is
          what makes an observation admissible: a source system can only report on a subject listed
          here.
        </p>

        <label
          className="mt-4 block text-xs font-medium"
          htmlFor="client-context-projection-bif-id"
        >
          BIF id
        </label>
        <input
          id="client-context-projection-bif-id"
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
                  reason: 'The request did not complete. Nothing was projected.',
                }),
              )
              .finally(() => setReading(false));
          }}
          className="mt-4 rounded border border-[hsl(var(--age-border))] px-3 py-1.5 text-sm font-medium disabled:opacity-40"
        >
          {reading ? 'Projecting…' : 'Show the peer’s answer'}
        </button>
      </div>

      {outcome === undefined ? (
        <p className="mt-4 text-sm text-[hsl(var(--age-text-muted))]">
          Nothing has been projected in this session. That is not a statement about this business —
          the projection has not been run.
        </p>
      ) : null}

      {/*
        🛑 ITS OWN STATE, NEVER AN EMPTY SUBJECT LIST. AGE holding no context
        means there is no model to project; rendering that as a projection with
        no subjects would tell a reader AGE models nothing about this business.
      */}
      {outcome?.kind === 'no-context' ? (
        <section className="mt-4 rounded border border-[hsl(var(--age-unknown))] p-4">
          <h3 className="text-sm font-semibold">There is nothing to project</h3>
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

      {outcome?.kind === 'projected' ? (
        <PeerAnswer view={outcome.view} organizationId={outcome.organizationId} />
      ) : null}
    </section>
  );
}

function PeerAnswer({
  view,
  organizationId,
}: {
  readonly view: ClientContextProjectionView;
  readonly organizationId: string;
}) {
  return (
    <div className="mt-6">
      {/*
        🛑 ABOVE THE ANSWER, NEVER BENEATH IT. An operator who read the subject
        list first and this second would already have concluded peers are served.
      */}
      <section className="rounded border border-[hsl(var(--age-unknown))] p-4">
        <h3 className="text-sm font-semibold">No peer can ask for this yet</h3>
        <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">{view.noPeerCanAskNotice}</p>
      </section>

      <p className="mt-4 font-mono text-xs text-[hsl(var(--age-text-muted))]">
        {/* 🚫 The capture time, verbatim. Never "3 days ago", never "now". */}
        bif {view.bifId} · organization {organizationId} · as of {view.asOf}
      </p>

      {/* 🚫 A screen cannot drop these; they are what the answer is NOT. */}
      <ul className="mt-3 space-y-2">
        {view.notices.map((notice) => (
          <li key={notice} className="text-xs text-[hsl(var(--age-text-muted))]">
            {notice}
          </li>
        ))}
      </ul>

      {/*
        🛑 EVERY KIND, ALWAYS — including the two silent states, each with its
        own reason. 🚫 No kind is hidden for being empty: an absent kind would
        let a reader take silence for an answer.
      */}
      <h3 className="mt-8 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--age-text-muted))]">
        Subjects a peer may name ({view.subjectKinds.length} kinds)
      </h3>
      <ul className="mt-2 space-y-3">
        {view.subjectKinds.map((kind) => (
          <li key={kind.subjectKind} className="rounded border border-[hsl(var(--age-border))] p-4">
            <div className="font-mono text-sm">
              {kind.subjectKind}{' '}
              <span
                className={
                  kind.state === 'modelled'
                    ? 'text-xs text-[hsl(var(--age-text-muted))]'
                    : 'text-xs text-[hsl(var(--age-unknown))]'
                }
              >
                {kind.state}
              </span>
            </div>
            {kind.labels.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {kind.labels.map((label) => (
                  <li key={label} className="font-mono text-xs">
                    {label}
                  </li>
                ))}
              </ul>
            ) : null}
            {/* 🛑 The projection's own reason, verbatim. 🚫 Never re-worded. */}
            <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">{kind.because}</p>
            {/* 🛑 Held and unnameable — 🚫 never dropped silently. */}
            {kind.unreadableEntryCount > 0 ? (
              <p className="mt-2 text-xs text-[hsl(var(--age-unknown))]">
                AGE holds {kind.unreadableEntryCount} entry(ies) of this kind it could not read a
                label from. They are counted rather than discarded.
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {/* ⚠️ Limitations, 🚫 never negative evidence about the business. */}
      <h3 className="mt-8 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--age-text-muted))]">
        Sections AGE holds nothing for ({view.notCaptured.length})
      </h3>
      <ul className="mt-2 space-y-1">
        {view.notCaptured.map((section) => (
          <li key={section} className="font-mono text-xs">
            {section}
          </li>
        ))}
      </ul>
    </div>
  );
}
