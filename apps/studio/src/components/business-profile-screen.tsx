import Link from 'next/link';

import {
  presentBusinessProfile,
  presentEpistemicState,
  type DiscoveryDraftPresence,
} from '@age/studio-shell';

import { readDiscoveryDraft, resolveBusinessScope } from '@/server/operator-environment';

/**
 * S3 · Business Profile — the subject-level landing.
 *
 * ⚠️ THE ORDER IS THE SAME ONE EVERY SUBJECT SCREEN USES: resolve the business
 * FIRST, then look at the workspace. A page rendered before the scope is checked
 * has already told the operator that business exists.
 *
 * 🚫 THIS COMPONENT DECIDES NOTHING. Every state, sentence and route comes from
 * `presentBusinessProfile` in `@age/studio-shell`, so the rules are testable
 * without a browser and 🚫 cannot grow a second copy here.
 *
 * 🚫 It calls NO producer. `generateBifFromAnswerFile` needs an operator
 * principal and ADR-0053 D4 refuses a defaulted one — a page that merely loads
 * has nobody to name, so this page claims nothing about submitted answers.
 * ⚠️ It also adds NO `@age/operator-workspace` operation: ADR-0060 D2 requires
 * its own ADR for that. It calls two operations that already exist.
 */
function presenceOf(outcome: ReturnType<typeof readDiscoveryDraft>): DiscoveryDraftPresence {
  switch (outcome.kind) {
    case 'not-configured':
      return 'not-configured';
    case 'refused':
      return 'refused';
    case 'loaded':
      // ⚠️ `everSaved` is the whole distinction: an empty form that was never
      // saved is 🚫 not a draft that was read and found blank.
      return outcome.everSaved ? 'saved' : 'none-saved';
  }
}

export function BusinessProfileScreen({ clientId }: { readonly clientId: string }) {
  const scope = resolveBusinessScope(clientId);

  if (scope.kind !== 'resolved') {
    return (
      <main className="max-w-3xl p-8">
        <h1 className="text-lg font-semibold tracking-tight">Business</h1>
        <section className="mt-4 rounded border border-[hsl(var(--age-unknown))] p-4">
          <h2 className="text-sm font-semibold">
            {scope.kind === 'unknown-client'
              ? 'No record carries that business'
              : 'The business could not be resolved'}
          </h2>
          <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
            {scope.kind === 'unknown-client'
              ? 'Nothing is shown for an invented business. A profile rendered under an id that ' +
                'names nothing would look like a business AGE knows and has nothing on.'
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

  const view = presentBusinessProfile({
    identity: {
      clientId,
      displayName: scope.client.displayName,
      organizationId: scope.client.organizationId,
    },
    draft: presenceOf(readDiscoveryDraft(clientId)),
  });

  const capture = presentEpistemicState(view.capture.state);

  return (
    <main className="max-w-5xl p-8">
      <p className="text-xs text-[hsl(var(--age-text-muted))]">
        <Link href={{ pathname: '/businesses' }} className="underline underline-offset-2">
          Businesses
        </Link>
      </p>
      <h1 className="mt-2 text-lg font-semibold tracking-tight">{scope.client.displayName}</h1>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        {view.identity.map((fact) => (
          <div key={fact.label} className="rounded border border-[hsl(var(--age-border))] p-3">
            <dt className="text-xs text-[hsl(var(--age-text-muted))]">{fact.label}</dt>
            <dd className="mt-1 text-sm font-medium">{fact.value}</dd>
            <p className="mt-1 text-xs text-[hsl(var(--age-text-muted))]">{fact.detail}</p>
          </div>
        ))}
      </dl>

      <section className="mt-6 rounded border border-[hsl(var(--age-border))] p-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-sm font-semibold">{view.capture.label}</h2>
          <span className={capture.className} title={capture.meaning}>
            {capture.label}
          </span>
        </div>
        <p className="mt-1 text-sm font-medium">{view.capture.value}</p>
        <p className="mt-1 text-xs text-[hsl(var(--age-text-muted))]">{view.capture.detail}</p>
        {view.capture.nextRoute === undefined ? null : (
          <p className="mt-3 text-xs">
            <Link
              href={{ pathname: view.capture.nextRoute }}
              className="underline underline-offset-2"
            >
              Go to Discovery
            </Link>
          </p>
        )}
      </section>

      {/* 🚫 Shown ON the surface, never as a footnote: without it a list of nine
          areas with mixed states reads as a checklist with a score. */}
      <div className="mt-6 space-y-2">
        {view.notice.map((line) => (
          <p key={line} className="text-xs text-[hsl(var(--age-text-muted))]">
            {line}
          </p>
        ))}
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {view.areas.map((area) => {
          const state = presentEpistemicState(area.state);
          return (
            <li key={area.id} className="rounded border border-[hsl(var(--age-border))] p-4">
              <div className="flex flex-wrap items-baseline gap-2">
                <Link
                  href={{ pathname: area.route }}
                  className="text-sm font-semibold underline underline-offset-2"
                >
                  {area.label}
                </Link>
                <span className={state.className} title={state.meaning}>
                  {state.label}
                </span>
              </div>
              <p className="mt-1 text-xs text-[hsl(var(--age-text-muted))]">{area.question}</p>
              {area.notWiredBecause === undefined ? null : (
                <p className="mt-2 text-xs text-[hsl(var(--age-text-muted))]">
                  {area.notWiredBecause}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
