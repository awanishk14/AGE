import type { StatusFacet } from '@age/studio-shell';

import { StateChip } from './state-chip';

/**
 * S13 — the console's account of itself (ADR-0058 D6).
 *
 * ⚠️ There is deliberately no overall health light. A single green dot would
 * have to average "bound correctly" together with "identity does not exist",
 * and the second of those is not a degraded version of the first — it is a
 * different kind of fact.
 */
export function SystemStatusPanel({ facets }: { readonly facets: readonly StatusFacet[] }) {
  return (
    <dl className="divide-y divide-[hsl(var(--age-border))] rounded border border-[hsl(var(--age-border))]">
      {facets.map((facet) => (
        <div key={facet.id} className="p-3">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-sm font-medium">{facet.label}</dt>
            <dd className="flex items-center gap-2">
              <span className="font-mono text-xs">{facet.value}</span>
              <StateChip state={facet.state} />
            </dd>
          </div>
          {/*
            🚫 The detail is not a tooltip. Every one of these sentences exists
            because the value alone reads as a health check, and the operator
            must be able to see WHY without hovering.
          */}
          <p className="mt-1.5 text-xs text-[hsl(var(--age-text-muted))]">{facet.detail}</p>
        </div>
      ))}
    </dl>
  );
}
