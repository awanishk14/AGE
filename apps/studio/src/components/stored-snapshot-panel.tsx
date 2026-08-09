'use client';

import { useState } from 'react';

import {
  ANSWER_FILE_PROVENANCE,
  TWO_ANSWERS_NOTICE,
  type StoredSnapshotView,
} from '@age/studio-shell';

/**
 * The OTHER answer — what AGE actually stored (ADR-0064).
 *
 * ⚠️ WHY IT SITS ON THIS SCREEN. The readiness panel above assesses the
 * operator's **answer file**, a document on their disk they can edit after the
 * fact. This panel reports the **immutable stored row**, captured at one instant
 * and never edited. Both answers existed on `main`; no surface said they were
 * different questions, so the two could disagree in silence.
 *
 * 🛑 THEY ARE NEVER MERGED (D3). Not averaged, not diffed, not reconciled, and
 * 🚫 neither is marked stale, out of date or preferred. AGE has no basis for
 * deciding which one the operator means.
 *
 * ⚠️ NOTHING HAPPENS UNTIL THE OPERATOR PRESSES. Opening the screen must not
 * open a database connection.
 *
 * 🚫 THE BIF ID IS TYPED, NEVER DERIVED. It was chosen when the capture ran, and
 * listing snapshots to find it is not authorized (ADR-0055 §5 item 1).
 */

/**
 * ⚠️ Structurally typed rather than imported from the server module — a client
 * component that imported `operator-environment` would pull `node:fs` and the
 * capture composition into the browser bundle.
 */
export type StoredSnapshotOutcomeLike =
  | { readonly kind: 'found'; readonly view: StoredSnapshotView; readonly organizationId: string }
  | { readonly kind: 'no-snapshot'; readonly reason: string }
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'refused'; readonly reason: string };

export interface StoredSnapshotPanelProps {
  readonly clientId: string;
  readonly read: (clientId: string, bifId: string) => Promise<StoredSnapshotOutcomeLike>;
}

export function StoredSnapshotPanel({ clientId, read }: StoredSnapshotPanelProps) {
  const [bifId, setBifId] = useState('');
  const [reading, setReading] = useState(false);
  const [outcome, setOutcome] = useState<StoredSnapshotOutcomeLike | undefined>(undefined);

  const ready = bifId.trim().length > 0 && !reading;

  return (
    <section className="mt-8">
      <div className="rounded border border-[hsl(var(--age-border))] p-4">
        <h2 className="text-sm font-semibold">Read the stored capture</h2>

        {/*
          🛑 THE D3 SENTENCE. Shown above the read, not below the result — a
          notice that only appears once both answers are on screen arrives after
          the operator has already compared them.
        */}
        {TWO_ANSWERS_NOTICE.map((line) => (
          <p key={line} className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
            {line}
          </p>
        ))}

        <p className="mt-2 text-xs text-[hsl(var(--age-text-muted))]">
          The panel above reads: {ANSWER_FILE_PROVENANCE}.
        </p>

        <label className="mt-4 block text-xs font-medium" htmlFor="stored-snapshot-bif-id">
          BIF id
        </label>
        <input
          id="stored-snapshot-bif-id"
          name="bifId"
          value={bifId}
          placeholder="bif-…"
          onChange={(event) => setBifId(event.target.value)}
          className="mt-1 w-full max-w-sm rounded border border-[hsl(var(--age-border))] bg-transparent px-2 py-1 font-mono text-sm"
        />
        <p className="mt-1 text-xs text-[hsl(var(--age-text-muted))]">
          The id the capture was written under. AGE cannot work it out for you: it was chosen when
          the snapshot was captured, and reading across snapshots to find it is not authorized.
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
                  reason: 'The request did not complete. Nothing was read.',
                }),
              )
              .finally(() => setReading(false));
          }}
          className="mt-4 rounded border border-[hsl(var(--age-border))] px-3 py-1.5 text-sm font-medium disabled:opacity-40"
        >
          {reading ? 'Reading…' : 'Read stored capture'}
        </button>
      </div>

      {outcome === undefined ? (
        <p className="mt-4 text-sm text-[hsl(var(--age-text-muted))]">
          The stored capture has not been read in this session. That is not a statement about this
          business — nothing has been looked up.
        </p>
      ) : null}

      {outcome?.kind === 'no-snapshot' ? (
        <section className="mt-4 rounded border border-[hsl(var(--age-unknown))] p-4">
          {/* ⚠️ D5 — a NAMED state carrying its reason. 🚫 Never an empty panel. */}
          <h3 className="text-sm font-semibold">No stored capture under that BIF id</h3>
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

      {outcome?.kind === 'found' ? (
        <StoredSnapshot view={outcome.view} organizationId={outcome.organizationId} />
      ) : null}
    </section>
  );
}

function StoredSnapshot({
  view,
  organizationId,
}: {
  readonly view: StoredSnapshotView;
  readonly organizationId: string;
}) {
  return (
    <div className="mt-6">
      <section className="rounded border border-[hsl(var(--age-border))] p-4">
        <h3 className="text-sm font-semibold">{view.provenance}</h3>
        <dl className="mt-3 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 font-mono text-xs">
          <dt className="text-[hsl(var(--age-text-muted))]">snapshot</dt>
          <dd>{view.snapshotId}</dd>
          <dt className="text-[hsl(var(--age-text-muted))]">bif</dt>
          <dd>{view.bifId}</dd>
          <dt className="text-[hsl(var(--age-text-muted))]">organization</dt>
          <dd>{organizationId}</dd>
          {/* 🚫 Verbatim. Never "2 days ago" — a relative time is a claim about now. */}
          <dt className="text-[hsl(var(--age-text-muted))]">captured at</dt>
          <dd>{view.capturedAt}</dd>
          <dt className="text-[hsl(var(--age-text-muted))]">snapshot version</dt>
          <dd>{view.snapshotVersion}</dd>
          <dt className="text-[hsl(var(--age-text-muted))]">context version</dt>
          <dd>{view.contextVersion}</dd>
          <dt className="text-[hsl(var(--age-text-muted))]">BIF status</dt>
          <dd>{view.bifStatus}</dd>
        </dl>

        {/* ⚠️ D4 — stated, not inferred from an empty list. */}
        <p className="mt-3 text-xs text-[hsl(var(--age-text-muted))]">{view.singularity}</p>
      </section>

      {/*
        🚫 D6 — two numbers, each named for what it measures, side by side and
        never combined. There is no scale in which their average would mean
        anything.
      */}
      <h3 className="mt-6 text-sm font-semibold">What the row scored</h3>
      <ul className="mt-2 space-y-2">
        <li className="rounded border border-[hsl(var(--age-border))] p-3 text-sm">
          BIF confidence <span className="font-mono">{view.bifConfidenceScore}</span>
        </li>
        <li className="rounded border border-[hsl(var(--age-border))] p-3 text-sm">
          BIF completeness <span className="font-mono">{view.bifCompletenessScore}</span>
        </li>
      </ul>

      {/*
        ⚠️ ABSENT, NOT ZERO. A `0` here would turn "AGE never kept this" into
        "AGE kept this and it was empty".
      */}
      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--age-text-muted))]">
        What the snapshot does not carry
      </h3>
      <ul className="mt-2 space-y-2">
        {view.notStored.map((entry) => (
          <li key={entry.label} className="rounded border border-[hsl(var(--age-border))] p-3">
            <div className="font-mono text-sm">
              {entry.label} <span className="text-[hsl(var(--age-unknown))]">not stored</span>
            </div>
            <p className="mt-1 text-sm text-[hsl(var(--age-text-muted))]">{entry.detail}</p>
          </li>
        ))}
      </ul>

      <h3 className="mt-6 text-sm font-semibold">
        Sections in the stored context ({view.presentSectionCount} of {view.canonicalSectionCount})
      </h3>
      <ul className="mt-2 space-y-1">
        {view.sections.map((section) => (
          <li key={section.name} className="text-sm">
            {section.name}{' '}
            <span className="font-mono text-xs text-[hsl(var(--age-text-muted))]">
              {section.type}
            </span>
          </li>
        ))}
      </ul>

      {/*
        ⚠️ NAMED, NOT COUNTED, and headed "omitted" — an omitted section is a
        LIMITATION of the capture, never a finding about the business.
      */}
      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--age-text-muted))]">
        Sections the capture omitted ({view.omittedSectionCount})
      </h3>
      <ul className="mt-2 space-y-1">
        {view.omittedSections.map((omitted) => (
          <li key={omitted.name} className="text-sm text-[hsl(var(--age-text-muted))]">
            {omitted.name} <span className="font-mono text-xs">{omitted.type}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
