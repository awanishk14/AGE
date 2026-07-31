'use client';

import { useEffect, useState } from 'react';
import { cn } from '@age/ui';
import {
  fetchCapabilityDemo,
  formatDecisionItem,
  getApiBaseUrl,
  type BusinessDiscoveryDemoSummary,
  type CapabilityDemoReport,
  type CapabilityDemoResponse,
  type ContextReadinessDemoEntry,
  type ContextReadinessDemoReport,
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

/**
 * The upstream Business Discovery intake, rendered as context.
 *
 * Deliberately NOT styled as a capability card: there is no approval row and no
 * accepted/rejected accounting, because intake produces no decision objects.
 *
 * Two rules govern the presentation. First, the intake pair and the BIF pair are
 * labelled as separate measurements and never summed, averaged or shown as one
 * headline number. Second, omitted sections are rendered as neutral limitations
 * — never as warnings, never as negative evidence about the business.
 */
function DiscoveryCard({ discovery }: { discovery: BusinessDiscoveryDemoSummary }) {
  return (
    <section className="rounded-lg border border-neutral-200 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Business Discovery — intake{' '}
          <span className="font-normal text-neutral-500">(upstream, not a capability)</span>
        </h2>
        <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
          BIF status: {discovery.bifStatus}
        </span>
      </div>

      <p className="mt-2 text-sm text-neutral-600">
        {discovery.businessName} · profile <code>{discovery.profileId}</code> · questionnaire{' '}
        <code>
          {discovery.questionnaireId} v{discovery.questionnaireVersion}
        </code>
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded border border-neutral-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Intake — properties of the interview
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <Stat label="completeness" value={discovery.discoveryCompletenessScore} />
            <Stat label="confidence" value={discovery.discoveryConfidenceScore} />
          </dl>
        </div>
        <div className="rounded border border-neutral-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Draft BIF — properties of what was produced
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <Stat label="completeness" value={discovery.bifCompletenessScore} />
            <Stat label="confidence" value={discovery.bifConfidenceScore} />
          </dl>
        </div>
      </div>

      <p className="mt-2 text-xs text-neutral-500">
        Four distinct measurements — never interchangeable. A well-captured interview still yields a
        sparse Draft BIF, because discovery covers only part of the BIF surface. These scores are
        reported, never acted on.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <SectionList
          label={`Populated canonical sections (${discovery.presentSectionTypes.length})`}
          types={discovery.presentSectionTypes}
        />
        <SectionList
          label={`Sections discovery could not populate (${discovery.omittedSectionTypes.length})`}
          types={discovery.omittedSectionTypes}
          note="Limitations of the intake — not findings about the business."
        />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <Stat label="segments" value={discovery.customerSegmentCount} />
        <Stat label="offerings" value={discovery.offeringCount} />
        <Stat label="competitors" value={discovery.competitorCount} />
        <Stat label="goals" value={discovery.goalCount} />
        <Stat label="evidence refs" value={discovery.evidenceReferenceCount} />
        <Stat label="assumptions" value={discovery.assumptionCount} />
        <Stat label="missing required" value={discovery.missingRequiredCount} />
        <Stat label="critical gaps" value={discovery.criticalGapCount} />
      </dl>
    </section>
  );
}

/**
 * One capability's readiness row.
 *
 * ⚠️ The state is rendered as PLAIN NEUTRAL TEXT, never through `Notice`.
 * `Notice` renders an emerald/amber pair off a boolean; pointing it at a
 * readiness state would paint three incommensurable measurements onto one
 * good/bad axis — the exact ordinal colour scale ADR-0047 D4 forbids, arrived
 * at by component reuse rather than by anyone deciding to. It would also render
 * "insufficient context" as a fault, when insufficient context is a valid
 * successful outcome and a limitation of the intake, never negative evidence
 * about the business (ADR-0026 D4).
 *
 * ⚠️ The state is always rendered ADJACENT to this capability's own denominator
 * and its own thresholds. A state shown on its own is what invites the
 * cross-capability comparison the notice denies.
 *
 * ⚠️ A non-adopter renders its declaration and NOTHING ELSE — no dash, no
 * "N/A", no empty state chip, no greyed-out row. Non-adoption is a declared
 * property of the capability, and any placeholder publishes it as a deficiency
 * (ADR-0047 D5).
 */
function ReadinessRow({ entry }: { entry: ContextReadinessDemoEntry }) {
  return (
    <div className="rounded border border-neutral-200 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{entry.capabilityName}</h3>
        {entry.state !== undefined && (
          <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs text-neutral-700">
            {entry.state}
          </span>
        )}
      </div>

      <p className="mt-1 text-sm text-neutral-600">{entry.declaration}</p>

      {entry.denominator !== undefined && (
        <p className="mt-2 text-xs text-neutral-500">
          <span className="font-semibold uppercase tracking-wide">Denominator</span> —{' '}
          {entry.denominator}
        </p>
      )}

      {entry.requiredSectionTypes !== undefined && (
        <p className="mt-1 font-mono text-xs text-neutral-500">
          requires: {entry.requiredSectionTypes.join(', ')}
        </p>
      )}

      {entry.thresholds !== undefined && (
        <p className="mt-1 font-mono text-xs text-neutral-500">
          {/* This capability's OWN thresholds, displayed beside its own state.
              Never merged with another capability's and never compared. */}
          own thresholds:{' '}
          {Object.entries(entry.thresholds)
            .map(([key, value]) => `${key}=${value}`)
            .join(' · ')}
        </p>
      )}

      <ReasonList label="Reasons" reasons={entry.reasons} />
      <ReasonList label="Limitations of the context" reasons={entry.limitations} />
      <ReasonList label="What would raise readiness" reasons={entry.improvementHints} />
    </div>
  );
}

/** A named list of sentences, rendered only when the capability supplied one. */
function ReasonList({ label, reasons }: { label: string; reasons?: readonly string[] }) {
  // ⚠️ Absent stays absent — an empty list is not rendered as "(none)" here,
  // because for a non-adopter there is nothing to report rather than nothing
  // found, and the two must not look the same.
  if (reasons === undefined || reasons.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <ul className="mt-1 space-y-0.5">
        {reasons.map((reason) => (
          <li key={reason} className="text-xs text-neutral-600">
            {reason}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Stage two of the pipeline, rendered between intake and the capability runs.
 *
 * ⚠️ `entries` is rendered in the order the API supplied — fixed registry
 * order, the same six names in the same order as the run cards below. It is
 * never sorted, filtered or grouped by state: grouping the assessing
 * capabilities together *is* what sorting by state looks like once the labels
 * are stripped.
 *
 * ⚠️ Nothing is computed across the rows. No "3 of 6 ready", no overall state,
 * no progress bar — the three states differ in what they measure, so any figure
 * across them would be expressed in a scale that does not exist.
 *
 * ⚠️ The incommensurability notice is rendered ABOVE the rows and is not
 * collapsible: a reader who never opens it is exactly the reader who would read
 * three states as a ranking.
 */
function ContextReadinessSection({ readiness }: { readiness: ContextReadinessDemoReport }) {
  return (
    <section className="rounded-lg border border-neutral-200 p-4 shadow-sm">
      <h2 className="text-lg font-semibold">
        Context readiness{' '}
        <span className="font-normal text-neutral-500">
          (assessed before the runs, and never a gate on them)
        </span>
      </h2>

      <div className="mt-3 space-y-1 rounded border border-neutral-200 bg-neutral-50 p-3">
        {readiness.incommensurabilityNotice.map((line) => (
          <p key={line} className="text-xs text-neutral-600">
            {line}
          </p>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {readiness.entries.map((entry) => (
          <ReadinessRow key={entry.capabilityName} entry={entry} />
        ))}
      </div>
    </section>
  );
}

function SectionList({
  label,
  types,
  note,
}: {
  label: string;
  types: readonly string[];
  note?: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      {types.length === 0 ? (
        <p className="mt-1 text-sm text-neutral-400">(none)</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {types.map((type) => (
            <li key={type} className="font-mono text-xs text-neutral-700">
              {type}
            </li>
          ))}
        </ul>
      )}
      {note && <p className="mt-1 text-xs text-neutral-400">{note}</p>}
    </div>
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

          <DiscoveryCard discovery={state.data.businessDiscovery} />

          {/* intake → context readiness → capability runs. Rendered between the
              two stages it sits between, and never as a gate on the runs below. */}
          <ContextReadinessSection readiness={state.data.contextReadiness} />

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
