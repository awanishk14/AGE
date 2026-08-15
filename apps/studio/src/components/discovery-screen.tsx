import Link from 'next/link';

import {
  areaHref,
  presentEpistemicState,
  presentSourceConfirmedChannel,
  STUDIO_AREAS,
} from '@age/studio-shell';

import { DiscoveryForm } from './discovery-form';
import { SubjectAreaNav } from './subject-area-nav';
import { saveDiscoveryDraftAction, submitDiscoveryAction } from '@/server/discovery-actions';
import {
  readDiscoveryDraft,
  readSourceConfirmations,
  resolveBusinessScope,
  STUDIO_QUESTIONNAIRE,
} from '@/server/operator-environment';

/**
 * Discovery, for one business.
 *
 * ⚠️ The order is load-bearing and is the `onboard` order: resolve the business
 * FIRST, then the workspace, then render the questionnaire. A form rendered
 * before the scope is checked has already told the operator that business
 * exists — and worse, would collect a real business's answers under an id that
 * names nothing.
 */
/**
 * 🛑 **`entitledOrganizationId` COMES FROM THE ROUTE PAGE'S VERIFIED SESSION
 * ROW** (AGE-INV-SEL-1, ADR-0074 §7 slice 3), 🚫 never from the URL. A server
 * component's props are not browser-reachable, so there is nothing here for a
 * caller to forge — and 🚫 there is no default: a page that forgets to say
 * whose data it is rendering does not compile.
 *
 * ⚠️ The `clientId` still comes off the URL, and that is fine. It is a FILTER
 * applied inside the entitlement, 🚫 not the thing that establishes it.
 */
export function DiscoveryScreen({
  entitledOrganizationId,
  clientId,
}: {
  readonly entitledOrganizationId: string;
  readonly clientId: string;
}) {
  const area = STUDIO_AREAS.find((candidate) => candidate.id === 'discovery');
  const scope = resolveBusinessScope(entitledOrganizationId, clientId);

  if (scope.kind !== 'resolved') {
    return (
      <main className="max-w-3xl p-8">
        <h1 className="text-lg font-semibold tracking-tight">Discovery</h1>
        <section className="mt-4 rounded border border-[hsl(var(--age-unknown))] p-4">
          <h2 className="text-sm font-semibold">
            {scope.kind === 'unknown-client'
              ? 'No record carries that business'
              : 'The business could not be resolved'}
          </h2>
          <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
            {scope.kind === 'unknown-client'
              ? 'The questionnaire is refused rather than shown for an invented business — answers ' +
                'collected under an id that names nothing would have to be thrown away.'
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

  const outcome = readDiscoveryDraft(entitledOrganizationId, clientId);

  /**
   * ⚠️ THE OTHER CHANNEL, SAID OUT LOUD ON THIS SCREEN. The form's own count is
   * a count of THIS file — it always was — but this screen asks "what has the
   * operator told AGE", and since ADR-0073 part of that answer lives elsewhere.
   * An operator who confirmed three answers from a document and then read
   * "0 of 17 answered" here would reasonably conclude their work was lost.
   *
   * 🚫 The counts are NOT added together and 🚫 the form's own figure is left
   * exactly as it is: a combined number would be a completeness across two
   * channels that AGE does not compute (ADR-0073 D2/D5).
   */
  const confirmed = readSourceConfirmations(entitledOrganizationId, clientId);
  const confirmedView = presentSourceConfirmedChannel(
    confirmed.kind === 'loaded'
      ? { kind: 'read', questionCount: confirmed.draft.answers.length }
      : { kind: confirmed.kind },
  );
  const confirmedState = presentEpistemicState(confirmedView.state);
  const sourcesArea = STUDIO_AREAS.find((candidate) => candidate.id === 'sources');

  /**
   * ADR-0059 D6 item 5 — the ONLY facts offered, and they are offered, not
   * filled in.
   *
   * 🚫 EXHAUSTIVE. The record states a display name and an organization id and
   * nothing else about the business, so nothing else appears here. 🚫 Never a
   * guess derived from either — no industry from the name, no market from the
   * organization. The `ClientRecord` is deliberately not the ADR-0009 `Client`
   * aggregate and carries no business attributes to mine.
   *
   * ⚠️ The business name is the only question a record fact can answer, because
   * it is the only question whose answer the record literally already holds.
   */
  const recordFacts = [
    {
      questionId: 'bi-name',
      value: scope.client.displayName,
      source: 'the client record you created',
    },
  ];

  return (
    <main className="max-w-6xl p-8">
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

      <h1 className="mt-3 text-lg font-semibold tracking-tight">Discovery</h1>
      <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
        {area?.question ?? 'What do we know about this business, and how do we know it?'}
      </p>

      <section className="mt-4 rounded border border-[hsl(var(--age-border))] p-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-sm font-semibold">{confirmedView.label}</h2>
          <span className={confirmedState.className} title={confirmedState.meaning}>
            {confirmedState.label}
          </span>
          <span className="text-sm font-medium">{confirmedView.value}</span>
        </div>
        <p className="mt-1 text-xs text-[hsl(var(--age-text-muted))]">{confirmedView.detail}</p>
        {sourcesArea === undefined ? null : (
          <p className="mt-2 text-xs">
            <Link
              href={{ pathname: areaHref(sourcesArea, clientId) }}
              className="underline underline-offset-2"
            >
              Go to Sources
            </Link>
          </p>
        )}
      </section>

      {outcome.kind === 'loaded' ? (
        <DiscoveryForm
          clientId={clientId}
          questionnaire={STUDIO_QUESTIONNAIRE}
          initialDraft={outcome.draft}
          everSaved={outcome.everSaved}
          recordFacts={recordFacts}
          save={saveDiscoveryDraftAction}
          submit={submitDiscoveryAction}
        />
      ) : (
        <section className="mt-6 rounded border border-[hsl(var(--age-unknown))] p-4">
          <h2 className="text-sm font-semibold">
            {outcome.kind === 'not-configured'
              ? 'No discovery workspace has been configured'
              : 'The saved draft was refused'}
          </h2>

          <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
            {outcome.kind === 'not-configured' ? (
              <>
                Answers are written to a directory you name, outside this repository. Set{' '}
                <code className="font-mono text-xs">{outcome.variable}</code> and restart the
                console.
              </>
            ) : (
              outcome.reason
            )}
          </p>

          {/*
            🚫 The form is NOT rendered empty over a draft that exists but could
            not be read. The operator would type into it, autosave would
            overwrite the file, and their earlier answers would be gone.
          */}
          <p className="mt-3 text-xs text-[hsl(var(--age-text-muted))]">
            The questionnaire is not shown, because anything typed into it would be saved over a
            draft this console could not read.
          </p>
        </section>
      )}
      <SubjectAreaNav clientId={clientId} currentAreaId="discovery" />
    </main>
  );
}
