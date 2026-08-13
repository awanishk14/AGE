import Link from 'next/link';

import { ANSWER_FILE_PROVENANCE, STORED_SNAPSHOT_PROVENANCE } from '@age/studio-shell';

import { DerivedIntelligencePanel } from './derived-intelligence-panel';
import { IntelligencePanel } from './intelligence-panel';
import { StoredSnapshotPanel } from './stored-snapshot-panel';
import { SubjectAreaNav } from './subject-area-nav';
import { assessCapabilityReadinessAction } from '@/server/intelligence-actions';
import { readDerivedIntelligenceAction } from '@/server/derived-intelligence-actions';
import { readStoredSnapshotAction } from '@/server/snapshot-actions';
import { resolveBusinessScope } from '@/server/operator-environment';

/**
 * The Intelligence screen, for one business.
 *
 * ⚠️ THE AREA ASKS TWO QUESTIONS AND ONLY ONE HAS AN ANSWER — "what did the
 * capabilities produce, and were they ready to run?" Nothing has been produced,
 * because no capability has ever been run for a real business. What CAN be
 * answered is the second half, and it is answered by the capabilities
 * themselves: three of the six publish an ADR-0027 readiness assessment over a
 * context this console builds from the answer file it wrote.
 *
 * 🚫 The half that has an answer must never be presented as though it settled
 * the half that does not. The produced-output facet is stated on the screen as
 * `not-assessed`, above nothing that could be mistaken for a result.
 *
 * ⚠️ The scope is resolved FIRST, before anything about this business is named.
 */
export function IntelligenceScreen({ clientId }: { readonly clientId: string }) {
  const scope = resolveBusinessScope(clientId);

  if (scope.kind !== 'resolved') {
    return (
      <main className="max-w-3xl p-8">
        <h1 className="text-lg font-semibold tracking-tight">Intelligence</h1>
        <section className="mt-4 rounded border border-[hsl(var(--age-unknown))] p-4">
          <h2 className="text-sm font-semibold">
            {scope.kind === 'unknown-client'
              ? 'No record carries that business'
              : 'The business could not be resolved'}
          </h2>
          <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
            {scope.kind === 'unknown-client'
              ? 'Readiness is refused rather than assessed for an invented business — it would be ' +
                'readiness to act on nobody.'
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

      <h1 className="mt-3 text-lg font-semibold tracking-tight">Intelligence</h1>
      <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
        What did the capabilities produce, and were they ready to run?
      </p>
      {/*
        ⚠️ NARROWED BY ADR-0069, NOT REPEALED. "Nothing has been produced" was
        true of the CAPABILITIES and still is — 🚫 no capability has ever been
        run against a real client, and that is refused, not pending. What AGE
        now also has is a conclusion drawn by a deterministic rule over relayed
        observations, which is 🚫 not a capability output and must never be
        presented as one.
      */}
      <p className="mt-2 text-xs text-[hsl(var(--age-text-muted))]">
        No capability has ever been run against a real client — that is refused, not pending. What
        this screen can report is what each capability says it would need, and, separately, what a
        named rule concludes from the observations source systems have relayed.
      </p>

      {/*
        ⚠️ THE ANSWER FILE'S PROVENANCE IS NAMED ON THE PANEL THAT READS IT, and
        the stored row's on the panel below. Before ADR-0064 both answers were
        called "readiness" and neither said which document it came from.
      */}
      <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--age-text-muted))]">
        {ANSWER_FILE_PROVENANCE}
      </p>
      <IntelligencePanel clientId={clientId} assess={assessCapabilityReadinessAction} />

      {/*
        🛑 SHOWN SEPARATELY, NEVER MERGED (ADR-0064 D3). The two panels are two
        questions; nothing between them reconciles, diffs or prefers one.
      */}
      <p className="mt-10 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--age-text-muted))]">
        {STORED_SNAPSHOT_PROVENANCE}
      </p>
      <StoredSnapshotPanel clientId={clientId} read={readStoredSnapshotAction} />

      {/*
        🛑 A THIRD ANSWER, AND IT IS NOT A SYNTHESIS OF THE OTHER TWO (ADR-0069
        D1). It comes from a different question entirely — what external systems
        OBSERVED, related to what the business SAYS — and 🚫 nothing between
        these panels reconciles, diffs, ranks or prefers one over another.
      */}
      <p className="mt-10 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--age-text-muted))]">
        What AGE concludes by relating relayed observations to the business context
      </p>
      <DerivedIntelligencePanel clientId={clientId} read={readDerivedIntelligenceAction} />

      <SubjectAreaNav clientId={clientId} currentAreaId="intelligence" />
    </main>
  );
}
