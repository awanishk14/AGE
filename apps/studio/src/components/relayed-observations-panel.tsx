'use client';

import { useState } from 'react';

import { presentRelayedObservations, type StoredSourceObservation } from '@age/studio-shell';

/**
 * The Peer Products screen — what each source system relayed, and what AGE
 * cannot say about the systems that did not appear (ADR-0069 D5, D6).
 *
 * ⚠️ **THIS SCREEN'S FIRST HONEST STATE IS ZERO, AND IT HAD TO BE.** The
 * navigation entry that stood here said so: *"This screen must show ZERO peer
 * products honestly before it shows one."* It now reads the real store — and
 * the empty answer it renders is the same shape it will render for a business
 * whose peers have genuinely never relayed anything.
 *
 * 🛑 **AN EMPTY READ IS NOT A FINDING.** `readRelayedObservations` returns a
 * NAMED `none-relayed` carrying its own reason, so an empty list can never be
 * drawn as "this business has no peer activity". And the read underneath is
 * SCOPED: under `FORCE ROW LEVEL SECURITY` an unscoped `SELECT` returns zero
 * rows silently, which would make a plumbing fault indistinguishable from an
 * honest nothing.
 *
 * ⚠️ **NOTHING HAPPENS UNTIL THE OPERATOR PRESSES.** Opening the screen must not
 * open a database connection.
 *
 * 🚫 **NO RELAY FROM HERE.** This surface reads. The relay is a separate act on
 * a separate path, and the façade this screen is handed carries no `append`.
 */

/**
 * ⚠️ Structurally typed rather than imported from the server module — a client
 * component importing `operator-environment` would pull `node:fs` and the
 * capture composition into the browser bundle.
 */
export type RelayedObservationsOutcomeLike =
  | {
      readonly kind: 'read';
      readonly observations: ReadonlyArray<StoredSourceObservation>;
      readonly organizationId: string;
    }
  | { readonly kind: 'none-relayed'; readonly reason: string }
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'refused'; readonly reason: string };

export interface RelayedObservationsPanelProps {
  readonly clientId: string;
  readonly read: (clientId: string) => Promise<RelayedObservationsOutcomeLike>;
}

export function RelayedObservationsPanel({ clientId, read }: RelayedObservationsPanelProps) {
  const [reading, setReading] = useState(false);
  const [outcome, setOutcome] = useState<RelayedObservationsOutcomeLike | undefined>(undefined);

  return (
    <section className="mt-8">
      <div className="rounded border border-[hsl(var(--age-border))] p-4">
        <h2 className="text-sm font-semibold">Read what has been relayed</h2>
        <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
          An observation reaches AGE only when an operator relays it. There is no scheduler, no
          polling and no background sync, so this screen shows what has been handed to AGE and
          nothing more.
        </p>

        <button
          type="button"
          disabled={reading}
          onClick={() => {
            setReading(true);
            void read(clientId)
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
          {reading ? 'Reading…' : 'Read relayed observations'}
        </button>
      </div>

      {outcome === undefined ? (
        <p className="mt-4 text-sm text-[hsl(var(--age-text-muted))]">
          Nothing has been read in this session. That is not a statement about this business — AGE
          has not looked.
        </p>
      ) : null}

      {/* 🛑 A NAMED STATE CARRYING ITS OWN REASON. 🚫 Never an empty list. */}
      {outcome?.kind === 'none-relayed' ? (
        <section className="mt-4 rounded border border-[hsl(var(--age-unknown))] p-4">
          <h3 className="text-sm font-semibold">Nothing has been relayed</h3>
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

      {outcome?.kind === 'read' ? (
        <RelayedObservations
          observations={outcome.observations}
          organizationId={outcome.organizationId}
        />
      ) : null}
    </section>
  );
}

function RelayedObservations({
  observations,
  organizationId,
}: {
  readonly observations: ReadonlyArray<StoredSourceObservation>;
  readonly organizationId: string;
}) {
  const view = presentRelayedObservations(organizationId, observations);

  return (
    <div className="mt-6">
      {/*
        🛑 THE TWO NOTICES SIT ABOVE THE LIST, NOT UNDER IT. A caveat that
        appears below the findings arrives after the operator has read them as
        findings.
      */}
      <section className="rounded border border-[hsl(var(--age-border))] p-4">
        <p className="text-sm text-[hsl(var(--age-text-muted))]">{view.arrivalNotice}</p>
        <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">{view.silenceNotice}</p>
        {view.unmappedNotice === undefined ? null : (
          <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">{view.unmappedNotice}</p>
        )}
        <dl className="mt-3 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 font-mono text-xs">
          <dt className="text-[hsl(var(--age-text-muted))]">organization</dt>
          <dd>{organizationId}</dd>
          <dt className="text-[hsl(var(--age-text-muted))]">source systems relayed</dt>
          <dd>{view.sourceSystemCount}</dd>
          <dt className="text-[hsl(var(--age-text-muted))]">observations relayed</dt>
          <dd>{view.observationCount}</dd>
        </dl>
      </section>

      {view.sourceSystems.map((system) => (
        <section
          key={system.sourceSystem}
          className="mt-6 rounded border border-[hsl(var(--age-border))] p-4"
        >
          <h3 className="text-sm font-semibold">{system.sourceSystem}</h3>
          {/*
            ⚠️ THE LABEL SAYS WHAT THE NUMBER IS. 🚫 Not coverage, not activity,
            not how much this source knows — how much has ARRIVED.
          */}
          <p className="mt-1 text-xs text-[hsl(var(--age-text-muted))]">
            {system.relayedCount} observation{system.relayedCount === 1 ? '' : 's'} relayed to AGE
          </p>

          <ul className="mt-3 space-y-3">
            {system.observations.map((entry) => (
              <li
                key={entry.observationId}
                className="rounded border border-[hsl(var(--age-border))] p-3"
              >
                <div className="text-sm">
                  {entry.subject}{' '}
                  {entry.subjectState === 'unmapped' ? (
                    <span className="text-[hsl(var(--age-unknown))]">unmapped</span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-[hsl(var(--age-text-muted))]">
                  {entry.subjectDetail}
                </p>
                <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 font-mono text-xs">
                  <dt className="text-[hsl(var(--age-text-muted))]">reported</dt>
                  <dd>{entry.claim}</dd>
                  <dt className="text-[hsl(var(--age-text-muted))]">claim kind</dt>
                  <dd>{entry.claimKind}</dd>
                  {/*
                    ⚠️ BOTH INSTANTS, SIDE BY SIDE. A relay lands days after the
                    observation by construction; one date would make a stale
                    observation look fresh.
                  */}
                  <dt className="text-[hsl(var(--age-text-muted))]">observed at</dt>
                  <dd>{entry.observedAt}</dd>
                  <dt className="text-[hsl(var(--age-text-muted))]">relayed to AGE at</dt>
                  <dd>{entry.relayedAt}</dd>
                  <dt className="text-[hsl(var(--age-text-muted))]">window</dt>
                  <dd>{entry.window}</dd>
                  <dt className="text-[hsl(var(--age-text-muted))]">source instance</dt>
                  <dd>{entry.sourceInstance}</dd>
                  <dt className="text-[hsl(var(--age-text-muted))]">source record</dt>
                  <dd>{entry.sourceRecordId}</dd>
                  <dt className="text-[hsl(var(--age-text-muted))]">observation</dt>
                  <dd>{entry.observationId}</dd>
                </dl>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
