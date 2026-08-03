import Link from 'next/link';

import {
  areaHref,
  areasForLevel,
  countBusinesses,
  type BusinessesView,
  type OrganizationBand,
} from '@age/studio-shell';

import { StateChip } from './state-chip';

/**
 * S2 — Businesses. The first Studio screen that reads something real.
 *
 * ⚠️ It renders FOUR distinct outcomes and never collapses them. "Not
 * configured" is not "no businesses"; "refused" is not "empty". A screen that
 * showed one empty list for all of them would be telling the operator AGE
 * looked, when it did not.
 *
 * 🚫 No count is shown unless something was actually read, and 🚫 no business is
 * invented, sampled or exemplified.
 */
export function BusinessesScreen({ view }: { readonly view: BusinessesView }) {
  const count = countBusinesses(view);

  return (
    <main className="max-w-3xl p-8">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Businesses</h1>
        <StateChip state={STATE_FOR[view.kind]} />
      </div>

      <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
        Which businesses does AGE know, and under what scope?
      </p>

      {/*
        ⚠️ The count appears ONLY when a file was read. When nothing was read
        there is no count — not a zero. A zero here would be a measured-looking
        number nobody measured.
      */}
      {count === undefined ? null : (
        <p className="mt-1 text-xs text-[hsl(var(--age-text-muted))]">
          {count} {count === 1 ? 'business' : 'businesses'} read from the operator record file.
        </p>
      )}

      {/*
        ⚠️ Offered in every state except "not configured", where there is
        nowhere to write and the form would refuse on submit. An action the
        operator cannot complete is worse than one that is absent.
      */}
      {view.kind === 'not-configured' ? null : (
        <p className="mt-4">
          <Link
            href={{ pathname: '/businesses/new' }}
            className="rounded border border-[hsl(var(--age-border))] px-3 py-1.5 text-sm underline-offset-2 hover:underline"
          >
            Create a client
          </Link>
        </p>
      )}

      <div className="mt-6">
        {view.kind === 'not-configured' ? <NotConfigured variable={view.variable} /> : null}
        {view.kind === 'refused' ? <Refused reason={view.reason} /> : null}
        {view.kind === 'none' ? <NoBusinesses /> : null}
        {view.kind === 'listed'
          ? view.bands.map((band) => <Band key={band.organizationId} band={band} />)
          : null}
      </div>
    </main>
  );
}

const STATE_FOR = {
  'not-configured': 'not-assessed',
  refused: 'unknown',
  none: 'unknown',
  listed: 'known',
} as const;

function NotConfigured({ variable }: { readonly variable: string }) {
  return (
    <section className="rounded border border-dotted border-[hsl(var(--age-not-assessed))] p-4">
      <h2 className="text-sm font-semibold">AGE has not looked for your businesses</h2>
      <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
        No client record file has been configured, so nothing has been read.{' '}
        <strong>This is not &ldquo;no businesses&rdquo;.</strong>
      </p>
      <p className="mt-3 text-sm text-[hsl(var(--age-text-muted))]">
        Set <code className="font-mono text-xs">{variable}</code> to the absolute path of your
        record file and restart the console. The file must live outside the repository working tree,
        and its path is never guessed.
      </p>
    </section>
  );
}

function Refused({ reason }: { readonly reason: string }) {
  return (
    <section className="rounded border border-[hsl(var(--age-unknown))] p-4">
      <h2 className="text-sm font-semibold">The record file was refused</h2>
      {/*
        ⚠️ The refusal is shown in full. These messages are written to name a
        POSITION and never a record's contents, so they cannot carry a client
        name onto the screen of a console pointed at the wrong file.
      */}
      <p className="mt-2 whitespace-pre-line text-sm text-[hsl(var(--age-text-muted))]">{reason}</p>
      <p className="mt-3 text-xs text-[hsl(var(--age-text-muted))]">
        Nothing is listed rather than a partial or repaired registry: every later lookup would
        otherwise report a client as unknown for the wrong reason.
      </p>
    </section>
  );
}

function NoBusinesses() {
  return (
    <section className="rounded border border-[hsl(var(--age-unknown))] p-4">
      <h2 className="text-sm font-semibold">AGE looked, and the file names no businesses</h2>
      <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
        This is a result, not a failure, and it is different from not having looked.
      </p>
    </section>
  );
}

/**
 * A derived organization band.
 *
 * 🚫 Not a link, not a level, not selectable. `organizationId` is read off the
 * records and exists here only to group a list — a level you can navigate into
 * is a level you can select, and a selectable scope is a typed scope, which
 * ADR-0054 D2 refuses by name.
 */
function Band({ band }: { readonly band: OrganizationBand }) {
  return (
    <section className="mb-6">
      <h2 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[hsl(var(--age-text-muted))]">
        Organization <span className="font-mono normal-case">{band.organizationId}</span>
      </h2>
      <p className="mt-0.5 text-xs text-[hsl(var(--age-text-muted))]">
        Derived from the records below. It is not a scope you can select.
      </p>

      <ul className="mt-2 divide-y divide-[hsl(var(--age-border))] rounded border border-[hsl(var(--age-border))]">
        {band.clients.map((client) => (
          <li key={client.clientId} className="p-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">{client.displayName}</span>
              <span className="font-mono text-xs text-[hsl(var(--age-text-muted))]">
                {client.clientId}
              </span>
            </div>

            <ExternalRefs refs={client.externalRefs} />

            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {areasForLevel('subject').map((area) => (
                <li key={area.id}>
                  <Link
                    href={{ pathname: areaHref(area, client.clientId) }}
                    className="text-xs text-[hsl(var(--age-text-muted))] underline underline-offset-2 hover:text-[hsl(var(--age-text))]"
                  >
                    {area.label}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * ⚠️ A business with no mapped systems is shown as having none — NOT as an
 * empty row. A business with no Meta ad account is not a business with an empty
 * Meta ad account, and the operator must be able to tell those apart.
 */
function ExternalRefs({ refs }: { readonly refs: Readonly<Record<string, string>> }) {
  const keys = Object.keys(refs).sort();

  if (keys.length === 0) {
    return (
      <p className="mt-1 text-xs text-[hsl(var(--age-text-muted))]">
        No external systems are mapped for this business.
      </p>
    );
  }

  return (
    <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
      {keys.map((key) => (
        <div key={key} className="flex gap-1.5 text-xs">
          <dt className="text-[hsl(var(--age-text-muted))]">{key}</dt>
          <dd className="font-mono">{refs[key]}</dd>
        </div>
      ))}
    </dl>
  );
}
