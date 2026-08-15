import Link from 'next/link';

import { describeDraftStorage, describeSourcesCoverage } from '@age/studio-shell';

import { SourcesPanel } from './sources-panel';
import { SubjectAreaNav } from './subject-area-nav';
import {
  readSourceConfirmations,
  resolveBusinessScope,
  STUDIO_QUESTIONNAIRE,
} from '@/server/operator-environment';
import { readSourceDocumentAction, recordPassageAction } from '@/server/sources-actions';

/**
 * The Sources screen, for one business (ADR-0066 D4, slice 4).
 *
 * ⚠️ It answers the area's own question — what a document actually said, and
 * who confirmed which sentence answers what. 🚫 It does NOT answer "what does
 * AGE now believe": arrival from a source is evidence that the source supplied
 * a candidate, never that AGE believes it (ADR-0066 D5).
 *
 * ⚠️ The scope is resolved FIRST, before anything about this business is named.
 */
export function SourcesScreen({ clientId }: { readonly clientId: string }) {
  const scope = resolveBusinessScope(clientId);

  if (scope.kind !== 'resolved') {
    return (
      <main className="max-w-3xl p-8">
        <h1 className="text-lg font-semibold tracking-tight">Sources</h1>
        <section className="mt-4 rounded border border-[hsl(var(--age-unknown))] p-4">
          <h2 className="text-sm font-semibold">
            {scope.kind === 'unknown-client'
              ? 'No record carries that business'
              : 'The business could not be resolved'}
          </h2>
          <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
            {scope.kind === 'unknown-client'
              ? 'Reading a document is refused rather than performed for an invented business — ' +
                'the answer it produced would belong to nobody.'
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

  const confirmations = readSourceConfirmations(clientId);

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

      <h1 className="mt-3 text-lg font-semibold tracking-tight">Sources</h1>
      <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
        What did a document actually say, and who confirmed which sentence answers what?
      </p>
      <p className="mt-2 text-xs text-[hsl(var(--age-text-muted))]">
        A document supplying a candidate answer is not AGE believing it. Nothing here writes a BIF,
        changes a status or produces a score, and where an answer came from never changes a score.
      </p>
      {/*
        ⚠️ THE AREA NAMES ITS OWN BOUNDARY. Since ADR-0069 a document is not the
        only input AGE receives, and an operator reading this screen alone would
        otherwise take one document for the whole of what AGE has been given.
        🚫 The sentence is a POINTER, never a second copy of the other answer,
        and 🚫 it claims nothing about what the observation store holds — from
        here AGE has not looked.
      */}
      <p className="mt-2 text-xs text-[hsl(var(--age-text-muted))]">{describeSourcesCoverage()}</p>

      {/*
        ⚠️ Read once, here — the operator's OWN workspace file, 🚫 not a client
        document. Reading it on open is what lets the screen show that earlier
        confirmations survived (ADR-0073 D1); reading a client's DOCUMENT on open
        stays refused, and still requires a press.
      */}
      {confirmations.kind !== 'loaded' ? (
        <p className="mt-3 rounded border border-[hsl(var(--age-unknown))] p-3 text-xs">
          {confirmations.kind === 'not-configured'
            ? `No discovery workspace has been configured (${confirmations.variable}), so AGE cannot ` +
              'show what has already been confirmed from documents, and cannot keep a new ' +
              'confirmation either.'
            : confirmations.reason}
        </p>
      ) : undefined}

      <SourcesPanel
        clientId={clientId}
        alreadyConfirmed={confirmations.kind === 'loaded' ? confirmations.draft.answers : undefined}
        questions={STUDIO_QUESTIONNAIRE.sections
          .flatMap((section) => section.questions)
          .map((question) => ({
            id: question.id,
            prompt: question.prompt,
            kind: question.kind,
          }))}
        storageNotices={{
          'not-stored': describeDraftStorage('not-stored'),
          'workspace-file': describeDraftStorage('workspace-file'),
        }}
        read={readSourceDocumentAction}
        record={recordPassageAction}
      />
      <SubjectAreaNav clientId={clientId} currentAreaId="sources" />
    </main>
  );
}
