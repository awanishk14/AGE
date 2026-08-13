import Link from 'next/link';

import { RelayedObservationsPanel } from './relayed-observations-panel';
import { SubjectAreaNav } from './subject-area-nav';
import { resolveBusinessScope } from '@/server/operator-environment';
import { readRelayedObservationsAction } from '@/server/peer-products-actions';

/**
 * The Peer Products screen, for one business (ADR-0069 deliverable 6).
 *
 * ⚠️ It answers the area's own question — what each source system reported —
 * and 🚫 it does NOT answer "what does AGE conclude": a conclusion is authored
 * by a deterministic rule (D1) and shown on Intelligence, never assembled by a
 * reader looking at two reports side by side.
 *
 * ⚠️ The scope is resolved FIRST, before anything about this business is named.
 */
export function PeerProductsScreen({ clientId }: { readonly clientId: string }) {
  const scope = resolveBusinessScope(clientId);

  if (scope.kind !== 'resolved') {
    return (
      <main className="max-w-3xl p-8">
        <h1 className="text-lg font-semibold tracking-tight">Peer Products</h1>
        <section className="mt-4 rounded border border-[hsl(var(--age-unknown))] p-4">
          <h2 className="text-sm font-semibold">
            {scope.kind === 'unknown-client'
              ? 'No record carries that business'
              : 'The business could not be resolved'}
          </h2>
          <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
            {scope.kind === 'unknown-client'
              ? 'Reading relayed observations is refused rather than performed for an invented ' +
                'business — the answer it produced would belong to nobody.'
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

      <h1 className="mt-3 text-lg font-semibold tracking-tight">Peer Products</h1>
      <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
        What did each source system report, and what did AGE do with it?
      </p>
      <p className="mt-2 text-xs text-[hsl(var(--age-text-muted))]">
        An observation arriving is not AGE believing it. Nothing here writes a BIF, changes a status
        or produces a score, and where an observation came from never changes a score.
      </p>

      <RelayedObservationsPanel clientId={clientId} read={readRelayedObservationsAction} />
      <SubjectAreaNav clientId={clientId} currentAreaId="peer-products" />
    </main>
  );
}
