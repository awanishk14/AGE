'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { cn } from '@age/ui';
import {
  fetchExecutionAuditHistory,
  formatResultSnapshot,
  getApiBaseUrl,
  DEFAULT_AUDIT_SCOPE,
  type ExecutionAuditListResponse,
  type ExecutionAuditRecord,
} from '@/lib/execution-audit';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: ExecutionAuditListResponse };

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

/** One dry-run audit record row. Display only — no approval or execution action. */
function AuditRecordRow({ record }: { record: ExecutionAuditRecord }) {
  return (
    <li className="rounded-lg border border-neutral-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold">{record.executionId}</span>
        <Notice ok>mode: {record.mode}</Notice>
        <Notice ok={!record.sideEffectsPerformed}>
          side effects performed: {String(record.sideEffectsPerformed)}
        </Notice>
        <span className="text-xs text-neutral-500">status={record.status}</span>
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-neutral-500">createdAt</dt>
          <dd className="font-mono text-xs">{record.createdAt}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">decidedAt</dt>
          <dd className="font-mono text-xs">{record.decidedAt}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">executedAt</dt>
          <dd className="font-mono text-xs">{record.executedAt ?? '—'}</dd>
        </div>
      </dl>

      <p className="mt-2 text-xs text-neutral-500">traceability: {record.traceability}</p>

      <div className="mt-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Dry-run result snapshot
        </p>
        <p className="mt-1 overflow-x-auto rounded bg-neutral-50 px-2 py-1 font-mono text-xs text-neutral-700">
          {formatResultSnapshot(record.dryRunResultSnapshot)}
        </p>
      </div>
    </li>
  );
}

export default function ExecutionAuditPage() {
  const [organizationId, setOrganizationId] = useState<string>(DEFAULT_AUDIT_SCOPE.organizationId);
  const [clientId, setClientId] = useState<string>(DEFAULT_AUDIT_SCOPE.clientId);
  const [appliedScope, setAppliedScope] = useState<{ organizationId: string; clientId: string }>(
    DEFAULT_AUDIT_SCOPE,
  );
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    fetchExecutionAuditHistory(
      appliedScope.organizationId,
      appliedScope.clientId,
      controller.signal,
    )
      .then((data) => setState({ status: 'success', data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : 'Unknown error';
        setState({ status: 'error', message });
      });
    return () => controller.abort();
  }, [appliedScope]);

  /** Applying the scope only triggers a re-read (GET) — never a mutation. */
  function handleApplyScope(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedScope({ organizationId, clientId });
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Execution audit history</h1>
        <p className="text-neutral-600">
          Dry-run execution audit records (ADR-0022). Read-only — no approval or execution action of
          any kind is available on this page.
        </p>
        <div className="flex flex-wrap gap-2">
          <Notice ok>Read-only</Notice>
          <Notice ok>Dry-run only</Notice>
          <Notice ok>Side effects performed: false</Notice>
        </div>
      </header>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Scope (test-safe / demo only)
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          No finalized auth/tenant mechanism exists yet, so this history is read using explicit
          <code className="mx-1">organizationId</code>/<code>clientId</code> query parameters, the
          same test-safe/demo scoping strategy the API requires (ADR-0022 Slice B). Changing these
          fields only re-reads history for that scope — it never submits a mutation.
        </p>
        <form onSubmit={handleApplyScope} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-xs text-neutral-500">organizationId</span>
            <input
              type="text"
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
              className="mt-1 rounded border border-neutral-300 px-2 py-1 font-mono text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-neutral-500">clientId</span>
            <input
              type="text"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              className="mt-1 rounded border border-neutral-300 px-2 py-1 font-mono text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            View history
          </button>
        </form>
      </section>

      {state.status === 'loading' && (
        <p className="mt-6 text-neutral-500">Loading execution audit history…</p>
      )}

      {state.status === 'error' && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <h2 className="text-lg font-semibold text-red-800">Could not reach the AGE API</h2>
          <p className="mt-1 text-sm text-red-700">{state.message}</p>
          <p className="mt-2 text-xs text-red-600">
            Expected the API at <code>{getApiBaseUrl()}</code>. Start it with{' '}
            <code>pnpm --filter @age/api dev</code>, or set <code>NEXT_PUBLIC_API_URL</code>.
          </p>
        </div>
      )}

      {state.status === 'success' && (
        <div className="mt-6">
          {state.data.records.length === 0 ? (
            <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
              No dry-run audit records found for this scope.
            </p>
          ) : (
            <ul className="space-y-4">
              {state.data.records.map((record) => (
                <AuditRecordRow key={record.executionId} record={record} />
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="mt-6 text-xs text-neutral-400">
        Read-only view. Nothing here can be approved or executed — the underlying data source is an
        in-memory, process-local audit repository with no database persistence yet.
      </p>
    </main>
  );
}
