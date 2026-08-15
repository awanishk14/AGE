import Link from 'next/link';

import { ContradictionsPanel } from './contradictions-panel';
import { SubjectAreaNav } from './subject-area-nav';
import { reportContradictionsAction } from '@/server/contradictions-actions';
import { resolveBusinessScope } from '@/server/operator-environment';

/**
 * The Contradictions screen, for one business.
 *
 * 🛑 THE AREA ASKS "WHERE DOES AGE DISAGREE WITH ITSELF?" AND THE HONEST ANSWER
 * IS THAT IT HAS NOT LOOKED. The detector exists and would run; over an empty
 * evidence list it returns an empty set, and an empty set shown here would read
 * as a clean bill of health for a real business.
 *
 * ⚠️ The scope is resolved FIRST, before anything about this business is named.
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
export function ContradictionsScreen({
  entitledOrganizationId,
  clientId,
}: {
  readonly entitledOrganizationId: string;
  readonly clientId: string;
}) {
  const scope = resolveBusinessScope(entitledOrganizationId, clientId);

  if (scope.kind !== 'resolved') {
    return (
      <main className="max-w-3xl p-8">
        <h1 className="text-lg font-semibold tracking-tight">Contradictions</h1>
        <section className="mt-4 rounded border border-[hsl(var(--age-unknown))] p-4">
          <h2 className="text-sm font-semibold">
            {scope.kind === 'unknown-client'
              ? 'No record carries that business'
              : 'The business could not be resolved'}
          </h2>
          <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
            {scope.kind === 'unknown-client'
              ? 'There is nothing to check for consistency, because there is no business here to be ' +
                'inconsistent about.'
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

      <h1 className="mt-3 text-lg font-semibold tracking-tight">Contradictions</h1>
      <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
        Where does AGE disagree with itself?
      </p>
      <p className="mt-2 text-xs text-[hsl(var(--age-text-muted))]">
        AGE has not looked. It can compare two recorded positions that oppose one another, and it
        holds no positions for this business — only text the operator typed. This screen reports
        exactly what is missing rather than showing you an empty list of conflicts.
      </p>

      <ContradictionsPanel clientId={clientId} report={reportContradictionsAction} />
      <SubjectAreaNav clientId={clientId} currentAreaId="contradictions" />
    </main>
  );
}
