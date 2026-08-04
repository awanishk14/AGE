import Link from 'next/link';

import { storedHistoryFacets } from '@age/studio-shell';

import { BifPanel } from './bif-panel';
import { StateChip } from './state-chip';
import { generateBifAction } from '@/server/bif-actions';
import { resolveBusinessScope } from '@/server/operator-environment';

/**
 * The BIF screen, for one business.
 *
 * ⚠️ IT SHOWS TWO DIFFERENT THINGS AND NEVER LETS THEM READ AS ONE. Above: a
 * BIF this console can PRODUCE, on demand, from the answer file it wrote.
 * Below: what AGE knows about STORED BIFs for this business — which is
 * nothing, because nothing has ever read the capture store (ADR-0055 D7).
 *
 * 🚫 The second half is never rendered as "0 snapshots" or "last captured:
 * never". Those are measured zeros, and this is an unlooked-at absence.
 *
 * ⚠️ The scope is resolved FIRST, before anything about this business is named
 * on the page — the same order `onboard` and Discovery use.
 */
export function BifScreen({ clientId }: { readonly clientId: string }) {
  const scope = resolveBusinessScope(clientId);

  if (scope.kind !== 'resolved') {
    return (
      <main className="max-w-3xl p-8">
        <h1 className="text-lg font-semibold tracking-tight">Business Information Framework</h1>
        <section className="mt-4 rounded border border-[hsl(var(--age-unknown))] p-4">
          <h2 className="text-sm font-semibold">
            {scope.kind === 'unknown-client'
              ? 'No record carries that business'
              : 'The business could not be resolved'}
          </h2>
          <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
            {scope.kind === 'unknown-client'
              ? 'A BIF is refused rather than produced for an invented business — it would carry a ' +
                'scope that names nothing.'
              : scope.kind === 'not-configured'
                ? `No client record file has been configured (${scope.variable}), so no business can be resolved.`
                : scope.reason}
          </p>
          <p className="mt-3 text-xs">
            <Link href={{ pathname: '/businesses' }} className="underline underline-offset-2">
              Back to Businesses
            </Link>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="max-w-3xl p-8">
      <p className="text-xs text-[hsl(var(--age-text-muted))]">
        <Link href={{ pathname: '/businesses' }} className="underline underline-offset-2">
          Businesses
        </Link>
        {' / '}
        <span className="font-medium text-[hsl(var(--age-text))]">
          {scope.client.displayName}
        </span>{' '}
        <span className="font-mono">({scope.client.clientId})</span>
        {' · organization '}
        <span className="font-mono">{scope.client.organizationId}</span>
      </p>

      <h1 className="mt-3 text-lg font-semibold tracking-tight">Business Information Framework</h1>
      <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
        What do we know about this business, and how do we know it?
      </p>

      {/*
        ⚠️ The scope is DERIVED from the client record and shown as such. 🚫 There
        is no field to type an organization into: a typed scope is the thing
        ADR-0054 D2 refuses by name.
      */}
      <p className="mt-2 text-xs text-[hsl(var(--age-text-muted))]">
        Any BIF produced here is scoped to{' '}
        <span className="font-mono">{scope.client.organizationId}</span>, read from the client
        record. It is never typed and never inferred.
      </p>

      <BifPanel clientId={clientId} generate={generateBifAction} />

      <section className="mt-10 border-t border-[hsl(var(--age-border))] pt-6">
        <h2 className="text-sm font-semibold">Stored BIFs for this business</h2>
        <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
          The console does not read or write the capture store. Storing a BIF is still the
          operator’s own <code className="font-mono text-xs">age-capture onboard</code> run against
          their own local database.
        </p>
        <ul className="mt-3 space-y-2">
          {storedHistoryFacets().map((facet) => (
            <li key={facet.label} className="flex flex-wrap items-baseline gap-2 text-sm">
              <span className="font-medium">{facet.label}</span>
              <StateChip state={facet.state} />
              <span className="text-[hsl(var(--age-text-muted))]">{facet.detail}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
