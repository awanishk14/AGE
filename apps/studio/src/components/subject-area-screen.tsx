import Link from 'next/link';

import { areaHref, areasForLevel, STUDIO_AREAS } from '@age/studio-shell';

import { StateChip } from './state-chip';
import { resolveBusinessScope, type BusinessScope } from '@/server/operator-environment';

/**
 * Every subject-level screen, until its own source is wired.
 *
 * ⚠️ The scope is resolved BEFORE the screen renders anything about the area —
 * the same order `onboard` uses, and for the same reason: a screen that renders
 * a business heading first and validates the id afterwards has already told the
 * operator that business exists.
 *
 * 🚫 An unknown clientId is REFUSED. It is never rendered as a real business
 * that happens to have no data, because those are different facts and the
 * second one is a lie about a business that may not exist.
 */
export function SubjectAreaScreen({
  area: areaId,
  clientId,
}: {
  readonly area: string;
  readonly clientId: string;
}) {
  const area = STUDIO_AREAS.find((candidate) => candidate.id === areaId);
  const scope = resolveBusinessScope(clientId);

  if (area === undefined) {
    return (
      <main className="p-8">
        <h1 className="text-lg font-semibold">Unknown screen</h1>
      </main>
    );
  }

  if (scope.kind !== 'resolved') {
    return (
      <main className="max-w-3xl p-8">
        <h1 className="text-lg font-semibold tracking-tight">{area.label}</h1>
        <UnresolvedScope scope={scope} />
      </main>
    );
  }

  return (
    <main className="max-w-3xl p-8">
      {/*
        ⚠️ The business is named on every subject screen. An operator must never
        have to remember which business they are looking at, and a scope shown
        in the URL but not on the page is a scope that is easy to misread.
      */}
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

      <div className="mt-3 flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">{area.label}</h1>
        <StateChip state="not-assessed" />
      </div>

      <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">{area.question}</p>

      <section className="mt-6 rounded border border-dotted border-[hsl(var(--age-not-assessed))] p-4">
        <h2 className="text-sm font-semibold">This screen is not wired yet</h2>
        <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">{area.notWiredBecause}</p>
        <p className="mt-3 text-xs text-[hsl(var(--age-text-muted))]">
          Nothing is shown here because nothing has been read — not because AGE looked and found
          nothing. Those are different states, and this one is the first.
        </p>
      </section>

      <nav className="mt-6">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[hsl(var(--age-text-muted))]">
          Other areas for this business
        </p>
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {areasForLevel('subject')
            .filter((candidate) => candidate.id !== area.id)
            .map((candidate) => (
              <li key={candidate.id}>
                <Link
                  href={{ pathname: areaHref(candidate, scope.client.clientId) }}
                  className="text-xs text-[hsl(var(--age-text-muted))] underline underline-offset-2 hover:text-[hsl(var(--age-text))]"
                >
                  {candidate.label}
                </Link>
              </li>
            ))}
        </ul>
      </nav>
    </main>
  );
}

function UnresolvedScope({ scope }: { readonly scope: BusinessScope }) {
  if (scope.kind === 'resolved') {
    return null;
  }

  return (
    <section className="mt-4 rounded border border-[hsl(var(--age-unknown))] p-4">
      <h2 className="text-sm font-semibold">
        {scope.kind === 'unknown-client'
          ? 'No record carries that business'
          : 'The business could not be resolved'}
      </h2>

      <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
        {scope.kind === 'unknown-client' ? (
          <>
            No client record carries the clientId{' '}
            <span className="font-mono">{scope.clientId}</span>. The screen is refused rather than
            shown for an invented business — a fabricated record would put a scope into circulation
            that names nothing.
          </>
        ) : null}
        {scope.kind === 'not-configured' ? (
          <>
            No client record file has been configured, so no business can be resolved. Set{' '}
            <code className="font-mono text-xs">{scope.variable}</code> and restart the console.
          </>
        ) : null}
        {scope.kind === 'refused' ? scope.reason : null}
      </p>

      <p className="mt-3 text-xs text-[hsl(var(--age-text-muted))]">
        <Link href={{ pathname: '/businesses' }} className="underline underline-offset-2">
          Back to Businesses
        </Link>
      </p>
    </section>
  );
}
