import Link from 'next/link';

import { EvidencePanel } from './evidence-panel';
import { SubjectAreaNav } from './subject-area-nav';
import { assembleEvidenceAction } from '@/server/evidence-actions';
import { resolveBusinessScope } from '@/server/operator-environment';

/**
 * The Evidence screen, for one business.
 *
 * ⚠️ It answers the area's own question — what supports each belief, and which
 * beliefs are unsupported — and the honest answer today is "nothing supports
 * any of them, and here is exactly why". 🚫 That is not a defect to design
 * around: a first discovery run is the business's own account of itself, and a
 * screen that made it look corroborated would be the fabrication this console
 * exists to prevent.
 *
 * ⚠️ The scope is resolved FIRST, before anything about this business is named.
 */
export function EvidenceScreen({ clientId }: { readonly clientId: string }) {
  const scope = resolveBusinessScope(clientId);

  if (scope.kind !== 'resolved') {
    return (
      <main className="max-w-3xl p-8">
        <h1 className="text-lg font-semibold tracking-tight">Evidence</h1>
        <section className="mt-4 rounded border border-[hsl(var(--age-unknown))] p-4">
          <h2 className="text-sm font-semibold">
            {scope.kind === 'unknown-client'
              ? 'No record carries that business'
              : 'The business could not be resolved'}
          </h2>
          <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
            {scope.kind === 'unknown-client'
              ? 'Evidence is refused rather than assembled for an invented business — it would be ' +
                'evidence about nothing.'
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

      <h1 className="mt-3 text-lg font-semibold tracking-tight">Evidence</h1>
      <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
        What supports each belief, and which beliefs are unsupported?
      </p>
      <p className="mt-2 text-xs text-[hsl(var(--age-text-muted))]">
        This screen reads and reports. It attaches no file, opens nothing and contacts no external
        system — those are refused, not pending.
      </p>

      <EvidencePanel clientId={clientId} assemble={assembleEvidenceAction} />
      <SubjectAreaNav clientId={clientId} currentAreaId="evidence" />
    </main>
  );
}
