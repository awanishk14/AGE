import type { DashboardView, StatusFacet } from '@age/studio-shell';

import { StateChip } from './state-chip';
import { SystemStatusPanel } from './system-status-panel';

/**
 * S1 — the Dashboard.
 *
 * ⚠️ This screen renders a view it was HANDED. It fetches nothing, computes
 * nothing about a business and calls no producer: a dashboard that recomputes
 * when you open it makes opening the page the act, and a system-initiated
 * recompute is class 3 under ADR-0057 D4 even though its effect is entirely
 * internal. The BIF and Evidence screens are button-pressed for that reason, and
 * the front page must not quietly undo it.
 *
 * 🚫 No panel is rendered as a number when nothing was measured, and 🚫 there is
 * no overall health light — a single dot would have to average "two businesses
 * read from a file" with "nothing has ever read the capture store", and the
 * second is not a degraded version of the first.
 */
export function DashboardScreen({
  view,
  facets,
}: {
  readonly view: DashboardView;
  readonly facets: readonly StatusFacet[];
}) {
  return (
    <main className="max-w-3xl p-8">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
        {/*
          ⚠️ The screen's own chip is `not-assessed`, not `known`. One panel has
          a real source; the rest are questions AGE has not looked at, and the
          headline must describe the weaker half honestly.
        */}
        <StateChip state="not-assessed" />
      </div>

      <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
        What changed, what is waiting, and what is broken?
      </p>

      <section className="mt-6">
        <h2 className="text-sm font-semibold">System status</h2>
        <div className="mt-2">
          <SystemStatusPanel facets={facets} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold">Panels</h2>
        <dl className="mt-2 divide-y divide-[hsl(var(--age-border))] rounded border border-[hsl(var(--age-border))]">
          {view.panels.map((panel) => (
            <div key={panel.id} className="p-3">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-sm font-medium">{panel.title}</dt>
                <dd className="flex items-center gap-2">
                  <span className="font-mono text-xs">{panel.value}</span>
                  <StateChip state={panel.state} />
                </dd>
              </div>
              <p className="mt-1 text-xs text-[hsl(var(--age-text-muted))]">{panel.question}</p>
              {/*
                🚫 The detail is not optional and not a tooltip. "Not assessed"
                on its own reads as a missing feature; the sentence saying WHY
                nobody has looked is the part that keeps it honest.
              */}
              <p className="mt-1.5 text-xs text-[hsl(var(--age-text-muted))]">{panel.detail}</p>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold">What this console can answer today</h2>
        {/*
          ⚠️ Counts of AREAS, never of anything about a business — and stated as
          a fraction of a table that lives in this repository. 🚫 No percentage
          and no progress bar: "50% complete" is a claim about a roadmap nobody
          has measured.
        */}
        <p className="mt-1 text-xs text-[hsl(var(--age-text-muted))]">
          {view.wiredAreaCount} of {view.totalAreaCount} areas read a real source. The rest are
          listed with the reason they do not, so an empty screen is never mistaken for an empty
          answer.
        </p>

        <ul className="mt-3 divide-y divide-[hsl(var(--age-border))] rounded border border-[hsl(var(--age-border))]">
          {view.coverage.map((row) => (
            <li key={row.id} className="p-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">{row.label}</span>
                {/*
                  ⚠️ `wired` is rendered as `known` and unwired as
                  `not-assessed` — 🚫 never as `unknown`, which would say AGE
                  looked at that area and found nothing.
                */}
                <StateChip state={row.wiring === 'wired' ? 'known' : 'not-assessed'} />
              </div>
              <p className="mt-1 text-xs text-[hsl(var(--age-text-muted))]">{row.note}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
