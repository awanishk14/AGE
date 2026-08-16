'use client';

import { useState } from 'react';

import { BOTH_INTAKE_CHANNELS_READ, type EvidenceView } from '@age/studio-shell';

import { StateChip } from './state-chip';

/**
 * The evidence ledger for one business.
 *
 * ⚠️ NOTHING HAPPENS UNTIL THE OPERATOR PRESSES — no effect on mount, no
 * refresh, no retry. Class 2 requires that a human initiated this specific act,
 * now.
 *
 * 🚫 THERE IS NO "VERIFY" BUTTON AND THERE MUST NOT BE ONE. Opening a document,
 * fetching an address or asking any external system is class 3 and is refused,
 * not postponed. This screen reports what the capture already says.
 */

export interface EvidencePanelProps {
  readonly clientId: string;
  readonly assemble: (clientId: string, changedBy: string) => Promise<EvidenceOutcomeLike>;
}

/**
 * ⚠️ Structurally typed rather than imported from the server module: a client
 * component that imported `operator-environment` would pull `node:fs` into the
 * browser bundle.
 */
export type EvidenceOutcomeLike =
  | { readonly kind: 'assembled'; readonly view: EvidenceView; readonly organizationId: string }
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'no-answer-file' }
  | { readonly kind: 'refused'; readonly reason: string };

export function EvidencePanel({ clientId, assemble }: EvidencePanelProps) {
  const [changedBy, setChangedBy] = useState('');
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<EvidenceOutcomeLike | undefined>(undefined);

  // ⚠️ No default principal, ever (ADR-0053 D4).
  const ready = changedBy.trim().length > 0 && !running;

  return (
    <section className="mt-6">
      <div className="rounded border border-[hsl(var(--age-border))] p-4">
        <h2 className="text-sm font-semibold">Assemble the evidence ledger</h2>
        <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
          {BOTH_INTAKE_CHANNELS_READ}, then reports what the capture supports. It happens once, when
          you press — never when the page opens.
        </p>
        <p className="mt-2 text-xs text-[hsl(var(--age-text-muted))]">
          Nothing is opened, downloaded or contacted. Listed documents and web addresses are text
          this console recorded; AGE has not read any of them.
        </p>

        <label className="mt-4 block text-xs font-medium" htmlFor="evidence-changed-by">
          Recorded by
        </label>
        <input
          id="evidence-changed-by"
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
            void assemble(clientId, changedBy.trim())
              .then((result) => setOutcome(result))
              .catch(() =>
                setOutcome({
                  kind: 'refused',
                  reason: 'The request did not complete. Nothing was assembled.',
                }),
              )
              .finally(() => setRunning(false));
          }}
          className="mt-4 rounded border border-[hsl(var(--age-border))] px-3 py-1.5 text-sm font-medium disabled:opacity-40"
        >
          {running ? 'Assembling…' : 'Assemble evidence'}
        </button>
      </div>

      {outcome === undefined ? (
        <p className="mt-4 text-sm text-[hsl(var(--age-text-muted))]">
          No evidence ledger has been assembled in this session. That is not a statement about this
          business — nothing has been read.
        </p>
      ) : null}

      {outcome?.kind === 'no-answer-file' ? (
        <section className="mt-4 rounded border border-[hsl(var(--age-unknown))] p-4">
          <h3 className="text-sm font-semibold">Discovery has not been submitted</h3>
          <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
            There is no answer file for this business yet, so there is nothing to support and
            nothing to leave unsupported.
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

      {outcome?.kind === 'assembled' ? <Ledger view={outcome.view} /> : null}
    </section>
  );
}

function Ledger({ view }: { readonly view: EvidenceView }) {
  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold">
        Sources this business named ({view.namedEvidence.length})
      </h2>
      {view.namedEvidence.length === 0 ? (
        <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
          The answers named no documents, web references or client statements. The questions were
          asked and left blank — this is what was captured, not a judgement about the business.
        </p>
      ) : (
        <ul className="mt-2 space-y-1">
          {view.namedEvidence.map((source) => (
            <li key={source.id} className="text-sm">
              {/*
                ⚠️ Rendered as TEXT, never as a link. A link is a press away from
                a retrieval, and retrieval is refused.
              */}
              <span>{source.label}</span>{' '}
              <span className="font-mono text-xs text-[hsl(var(--age-text-muted))]">
                {source.kind}
              </span>{' '}
              <StateChip state={source.state} />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-[hsl(var(--age-text-muted))]">
        Named, not verified. AGE has not opened any of these, so none of them makes a belief below a
        checked fact.
      </p>

      {/*
        ⚠️ THE CENTRAL REPORT. Naming sources does not attach them to fields —
        the questionnaire never asks which source backs which field, and 🚫 AGE
        does not guess the link.
      */}
      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--age-text-muted))]">
        Beliefs with independent support ({view.supportedBeliefs.length})
      </h3>
      {view.supportedBeliefs.length === 0 ? (
        <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
          None. Every value in this BIF is the business’s own account of itself, recorded by AGE and
          checked by nothing. That is the correct result for a first discovery run.
        </p>
      ) : (
        <ul className="mt-2 space-y-1">
          {view.supportedBeliefs.map((belief) => (
            <li key={`${belief.sectionName}:${belief.fieldKey}`} className="text-sm">
              <span className="font-mono text-xs">{belief.fieldKey}</span>{' '}
              <span className="text-[hsl(var(--age-text-muted))]">{belief.sectionName}</span>{' '}
              <StateChip state={belief.state} />
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--age-text-muted))]">
        Beliefs nothing independently supports ({view.unsupportedBeliefs.length})
      </h3>
      <ul className="mt-2 space-y-1">
        {view.unsupportedBeliefs.map((belief) => (
          <li key={`${belief.sectionName}:${belief.fieldKey}`} className="text-sm">
            <span className="font-mono text-xs">{belief.fieldKey}</span>{' '}
            <span className="text-[hsl(var(--age-text-muted))]">{belief.sectionName}</span>{' '}
            <StateChip state={belief.state} />{' '}
            <span className="font-mono text-[0.6875rem] text-[hsl(var(--age-text-muted))]">
              {belief.confidence} · {belief.source}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-[hsl(var(--age-text-muted))]">
        Unsupported is not doubted. These are claims AGE recorded faithfully and has not
        corroborated — 🚫 nothing here counts against the business.
      </p>

      {view.recordedAnswers.length > 0 ? (
        <>
          <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--age-text-muted))]">
            Answers AGE recorded but does not reason over ({view.recordedAnswers.length})
          </h3>
          <ul className="mt-2 space-y-2">
            {view.recordedAnswers.map((entry) => (
              <li key={entry.questionId} className="text-sm">
                <div className="text-[hsl(var(--age-text-muted))]">{entry.prompt}</div>
                <div>{entry.value}</div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[hsl(var(--age-text-muted))]">
            Kept word for word and used by nothing. Turning prose into a structured assumption would
            be AGE deciding what the business meant.
          </p>
        </>
      ) : null}

      {view.unmappedFields.length > 0 ? (
        <>
          <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--age-text-muted))]">
            Captured material no BIF field carries ({view.unmappedFields.length})
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

      {/*
        ⚠️ `not-assessed`, never zero. An unlooked-at absence rendered as a
        measured zero is the failure the design system forbids by name.
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
