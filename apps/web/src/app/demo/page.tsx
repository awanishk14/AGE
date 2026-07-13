'use client';

import { useEffect, useState } from 'react';
import { cn } from '@age/ui';
import {
  fetchCapabilityDemo,
  formatDecisionItem,
  getApiBaseUrl,
  type CapabilityDemoReport,
  type CapabilityDemoResponse,
} from '@/lib/demo';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: CapabilityDemoResponse };

function Notice({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        ok ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800',
      )}
    >
      {children}
    </span>
  );
}

function ItemList({ label, items }: { label: string; items: readonly unknown[] }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {label} ({items.length})
      </p>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-neutral-400">(none)</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {items.map((item, index) => (
            <li
              key={index}
              className="overflow-x-auto rounded bg-neutral-50 px-2 py-1 font-mono text-xs text-neutral-700"
            >
              {formatDecisionItem(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CapabilityCard({ report }: { report: CapabilityDemoReport }) {
  return (
    <section className="rounded-lg border border-neutral-200 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{report.capability}</h3>
        <Notice ok={report.accountingHolds}>
          accounting {report.accountingHolds ? 'OK' : 'MISMATCH'}
        </Notice>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <Stat label="accepted" value={report.acceptedCount} />
        <Stat label="rejected" value={report.rejectedCount} />
        <Stat label="duplicate" value={report.duplicateCount} />
        <Stat label="derived" value={report.derivedCount} />
      </dl>

      <div className="mt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Pending human approval ({report.pendingApproval.length})
        </p>
        {report.pendingApproval.length === 0 ? (
          <p className="mt-1 text-sm text-neutral-400">(nothing to approve)</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {report.pendingApproval.map((ref) => (
              <li key={ref.id} className="text-sm text-neutral-700">
                <span className="mr-2 font-mono text-neutral-400">[ ]</span>
                approve {ref.capability} — {ref.id}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ItemList label="Accepted decision objects" items={report.acceptedItems} />
      <ItemList label="Rejected reasons" items={report.rejectedReasons} />
      <ItemList label="Duplicate references" items={report.duplicateReferences} />
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="font-mono text-base font-semibold">{value}</dd>
    </div>
  );
}

export default function DemoPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    fetchCapabilityDemo(controller.signal)
      .then((data) => setState({ status: 'success', data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : 'Unknown error';
        setState({ status: 'error', message });
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      {state.status === 'loading' && <p className="text-neutral-500">Loading capability demo…</p>}

      {state.status === 'error' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h1 className="text-lg font-semibold text-red-800">Could not reach the AGE API</h1>
          <p className="mt-1 text-sm text-red-700">{state.message}</p>
          <p className="mt-2 text-xs text-red-600">
            Expected the API at <code>{getApiBaseUrl()}</code>. Start it with{' '}
            <code>pnpm --filter @age/api dev</code>, or set <code>NEXT_PUBLIC_API_URL</code>.
          </p>
        </div>
      )}

      {state.status === 'success' && (
        <div className="space-y-6">
          <header className="space-y-2">
            <h1 className="text-3xl font-bold">{state.data.title}</h1>
            <p className="text-neutral-600">{state.data.description}</p>
            <div className="flex flex-wrap gap-2">
              <Notice ok={state.data.humanApprovedExecution}>Human-Approved Execution</Notice>
              <Notice ok={!state.data.sideEffectsPerformed}>
                side effects performed: {String(state.data.sideEffectsPerformed)}
              </Notice>
            </div>
          </header>

          <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Summary
            </h2>
            <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
              <Stat label="capabilities run" value={state.data.summary.capabilitiesRun} />
              <Stat
                label="total pending approvals"
                value={state.data.summary.totalPendingApprovals}
              />
              <div>
                <dt className="text-xs text-neutral-500">accounting invariant</dt>
                <dd className="mt-0.5">
                  <Notice ok={state.data.summary.accountingInvariantHolds}>
                    {state.data.summary.accountingInvariantHolds ? 'OK' : 'MISMATCH'}
                  </Notice>
                </dd>
              </div>
            </dl>
          </section>

          <div className="space-y-4">
            {state.data.reports.map((report) => (
              <CapabilityCard key={report.capability} report={report} />
            ))}
          </div>

          <p className="text-xs text-neutral-400">
            Read-only demo. Nothing here is executed — every accepted item awaits human approval.
          </p>
        </div>
      )}
    </main>
  );
}
