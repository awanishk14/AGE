'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { cn } from '@age/ui';
import {
  fetchExecutionApprovalStatus,
  submitApprovalDecision,
  submitRejectionDecision,
  getApiBaseUrl,
  DEFAULT_APPROVAL_SCOPE,
  type ExecutionApprovalDecision,
  type ExecutionApprovalStatusResponse,
} from '@/lib/execution-approval';

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: ExecutionApprovalStatusResponse };

type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'error'; message: string }
  | { status: 'success' };

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

/** One approval decision row from history — display only. */
function DecisionRow({ decision }: { decision: ExecutionApprovalDecision }) {
  return (
    <li className="rounded-lg border border-neutral-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Notice ok={decision.outcome === 'approved_for_dry_run'}>{decision.outcome}</Notice>
        <span className="font-mono text-xs text-neutral-500">operatorId={decision.operatorId}</span>
      </div>
      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-neutral-500">decidedAt</dt>
          <dd className="font-mono text-xs">{decision.decidedAt}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">reason</dt>
          <dd className="text-xs">{decision.reason ?? '—'}</dd>
        </div>
      </dl>
    </li>
  );
}

export default function ExecutionApprovalPage() {
  const [executionId, setExecutionId] = useState<string>('');
  const [organizationId, setOrganizationId] = useState<string>(
    DEFAULT_APPROVAL_SCOPE.organizationId,
  );
  const [clientId, setClientId] = useState<string>(DEFAULT_APPROVAL_SCOPE.clientId);
  const [projectId, setProjectId] = useState<string>('');
  const [operatorId, setOperatorId] = useState<string>('');
  const [reason, setReason] = useState<string>('');

  const [appliedExecutionId, setAppliedExecutionId] = useState<string>('');
  const [state, setState] = useState<LoadState>({ status: 'idle' });
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });

  useEffect(() => {
    if (!appliedExecutionId) return;
    const controller = new AbortController();
    setState({ status: 'loading' });
    fetchExecutionApprovalStatus(appliedExecutionId, organizationId, clientId, controller.signal)
      .then((data) => setState({ status: 'success', data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : 'Unknown error';
        setState({ status: 'error', message });
      });
    return () => controller.abort();
  }, [appliedExecutionId, organizationId, clientId, submitState]);

  /** Loading status only ever issues a GET read — never a mutation. */
  function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedExecutionId(executionId);
  }

  async function handleDecision(action: 'approve' | 'reject') {
    if (!executionId || !operatorId || !organizationId || !clientId) return;
    setSubmitState({ status: 'submitting' });
    try {
      const input = {
        organizationId,
        clientId,
        projectId: projectId || undefined,
        operatorId,
        reason: reason || undefined,
      };
      if (action === 'approve') {
        await submitApprovalDecision(executionId, input);
      } else {
        await submitRejectionDecision(executionId, input);
      }
      setSubmitState({ status: 'success' });
      setAppliedExecutionId(executionId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setSubmitState({ status: 'error', message });
    }
  }

  const canSubmit = Boolean(executionId && operatorId && organizationId && clientId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Human approval workflow (dry-run only)</h1>
        <p className="text-neutral-600">
          Record and review human approval decisions for dry-run executions (ADR-0023). Approval
          here authorizes a dry-run / no-op execution record only — it does not execute anything and
          does not authorize real execution. Real execution remains out of scope for this system.
        </p>
        <div className="flex flex-wrap gap-2">
          <Notice ok>Dry-run / no-op only</Notice>
          <Notice ok>Does not execute anything</Notice>
          <Notice ok>Does not authorize real execution</Notice>
        </div>
      </header>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Execution &amp; scope (test-safe / demo only)
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          No finalized auth/tenant mechanism exists yet, so this view uses explicit
          <code className="mx-1">organizationId</code>/<code>clientId</code>/<code>operatorId</code>{' '}
          fields, the same test-safe/demo scoping strategy the API requires (ADR-0023 Slice D2).
          Operator identity is never inferred — an approve or reject decision cannot be submitted
          without an explicit <code>operatorId</code>.
        </p>
        <form onSubmit={handleLookup} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-xs text-neutral-500">executionId</span>
            <input
              type="text"
              value={executionId}
              onChange={(event) => setExecutionId(event.target.value)}
              className="mt-1 rounded border border-neutral-300 px-2 py-1 font-mono text-sm"
            />
          </label>
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
          <label className="text-sm">
            <span className="block text-xs text-neutral-500">projectId (optional)</span>
            <input
              type="text"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="mt-1 rounded border border-neutral-300 px-2 py-1 font-mono text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            View status
          </button>
        </form>
      </section>

      <section className="mt-6 rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Record a decision
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Approving records <code>approved_for_dry_run</code> only. This is not an execute action —
          there is no execute button, run button, or approve-and-execute action anywhere in this
          system. Real execution is out of scope.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-xs text-neutral-500">operatorId (required)</span>
            <input
              type="text"
              value={operatorId}
              onChange={(event) => setOperatorId(event.target.value)}
              className="mt-1 rounded border border-neutral-300 px-2 py-1 font-mono text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-neutral-500">reason (optional)</span>
            <input
              type="text"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-1 rounded border border-neutral-300 px-2 py-1 font-mono text-sm"
            />
          </label>
          <button
            type="button"
            disabled={!canSubmit || submitState.status === 'submitting'}
            onClick={() => handleDecision('approve')}
            className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Approve for dry-run
          </button>
          <button
            type="button"
            disabled={!canSubmit || submitState.status === 'submitting'}
            onClick={() => handleDecision('reject')}
            className="rounded bg-red-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Reject
          </button>
        </div>
        {submitState.status === 'error' && (
          <p className="mt-2 text-xs text-red-600">{submitState.message}</p>
        )}
        {submitState.status === 'success' && (
          <p className="mt-2 text-xs text-emerald-700">Decision recorded.</p>
        )}
      </section>

      {state.status === 'loading' && (
        <p className="mt-6 text-neutral-500">Loading approval status…</p>
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-neutral-600">Current status:</span>
            <Notice ok={state.data.status === 'approved_for_dry_run'}>{state.data.status}</Notice>
          </div>
          <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Decision history
          </h3>
          {state.data.history.length === 0 ? (
            <p className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
              No approval decisions recorded yet for this execution.
            </p>
          ) : (
            <ul className="mt-2 space-y-4">
              {state.data.history.map((decision) => (
                <DecisionRow key={decision.id} decision={decision} />
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="mt-6 text-xs text-neutral-400">
        Dry-run approval only. Nothing on this page can trigger real execution — the underlying data
        source is an in-memory, process-local approval repository with no database persistence yet.
      </p>
    </main>
  );
}
