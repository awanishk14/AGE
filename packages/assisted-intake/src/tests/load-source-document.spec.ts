import { describe, expect, it } from 'vitest';

import { OperatorFilePathRefusedError } from '@age/operator-file-policy';

import { SourceDocumentReadError, loadSourceDocument } from '../load-source-document';

const REPOSITORY_ROOT = process.platform === 'win32' ? 'C:\\work\\AGE' : '/home/operator/work/AGE';
const OUTSIDE =
  process.platform === 'win32' ? 'C:\\documents\\deck.txt' : '/home/operator/documents/deck.txt';
const INSIDE =
  process.platform === 'win32' ? 'C:\\work\\AGE\\deck.txt' : '/home/operator/work/AGE/deck.txt';

function options(overrides: Partial<Parameters<typeof loadSourceDocument>[0]> = {}) {
  return {
    path: OUTSIDE,
    repositoryRoot: REPOSITORY_ROOT,
    sourceId: 'src-fictional-deck',
    label: 'Fictional positioning deck',
    readFileText: async () => ({
      kind: 'text' as const,
      documentKind: 'plain-text' as const,
      text: 'We repair kites.\n\nOur customers are coastal schools.',
    }),
    ...overrides,
  };
}

describe('loadSourceDocument', () => {
  it('reads the operator-chosen document and proposes its passages', async () => {
    const { document, outcome } = await loadSourceDocument(options());

    expect(document.kind).toBe('plain-text');
    expect(document.locator).toBe(OUTSIDE);
    expect(outcome.kind === 'passages-proposed' && outcome.passages).toHaveLength(2);
  });

  it('carries the kind the reader reported rather than assuming plain text', async () => {
    // ⚠️ ADR-0070 — how AGE got the characters is RECORDED because it is
    // different information. 🚫 It is not a quality signal and touches no score.
    const { document, outcome } = await loadSourceDocument(
      options({
        readFileText: async () => ({
          kind: 'text' as const,
          documentKind: 'decoded-pdf' as const,
          text: 'We repair kites.\n\nOur customers are coastal schools.',
        }),
      }),
    );

    expect(document.kind).toBe('decoded-pdf');
    expect(outcome.kind === 'passages-proposed' && outcome.passages).toHaveLength(2);
  });

  it('refuses a path inside the repository before opening anything', async () => {
    // ⚠️ Order is load-bearing — ADR-0054 D2. The reader must not run at all,
    // and 🚫 making this function async did not move the policy behind a decode.
    let opened = false;

    await expect(
      loadSourceDocument(
        options({
          path: INSIDE,
          readFileText: async () => {
            opened = true;
            return { kind: 'text' as const, documentKind: 'plain-text' as const, text: '' };
          },
        }),
      ),
    ).rejects.toThrow(OperatorFilePathRefusedError);

    expect(opened).toBe(false);
  });

  it('refuses an unreadable file rather than reporting an empty document', async () => {
    // 🚫 A file that was never opened and a file with nothing in it are
    // different facts, and only one of them is about the document's contents.
    await expect(
      loadSourceDocument(
        options({
          readFileText: async () => {
            throw new Error('ENOENT');
          },
        }),
      ),
    ).rejects.toThrow(SourceDocumentReadError);
  });

  it('reports the document alongside the outcome when nothing was proposed', async () => {
    // ⚠️ ADR-0059 D7 — "sources read" and "facts found" are different counts,
    // so a caller can always say a document WAS read.
    const { document, outcome } = await loadSourceDocument(
      options({
        readFileText: async () => ({
          kind: 'text' as const,
          documentKind: 'plain-text' as const,
          text: '   ',
        }),
      }),
    );

    expect(document.label).toBe('Fictional positioning deck');
    expect(outcome).toEqual({
      kind: 'not-extracted',
      sourceId: 'src-fictional-deck',
      reason: 'empty-document',
    });
  });

  it('keeps a PDF that could not be decoded apart from a PDF that was empty', async () => {
    // 🛑 ADR-0070 D3 + ADR-0059 D7. These are three DIFFERENT facts about the
    // file — 🚫 none of them is a fact about the business — and collapsing any
    // two of them into "the document contained nothing" is the refused move.
    const undecodable = await loadSourceDocument(
      options({
        readFileText: async () => ({
          kind: 'not-extracted' as const,
          documentKind: 'decoded-pdf' as const,
          reason: 'could-not-decode' as const,
        }),
      }),
    );
    const scanned = await loadSourceDocument(
      options({
        readFileText: async () => ({
          kind: 'not-extracted' as const,
          documentKind: 'decoded-pdf' as const,
          reason: 'decoded-no-text' as const,
        }),
      }),
    );

    expect(undecodable.outcome).toEqual({
      kind: 'not-extracted',
      sourceId: 'src-fictional-deck',
      reason: 'could-not-decode',
    });
    expect(scanned.outcome).toEqual({
      kind: 'not-extracted',
      sourceId: 'src-fictional-deck',
      reason: 'decoded-no-text',
    });

    // ⚠️ The document is still REPORTED in both cases: AGE looked at it. What
    // it could not do is read it, and 🚫 that is never told as an emptiness.
    expect(undecodable.document.kind).toBe('decoded-pdf');
    expect(undecodable.document.text).toBe('');
    expect(scanned.document.locator).toBe(OUTSIDE);
  });
});
