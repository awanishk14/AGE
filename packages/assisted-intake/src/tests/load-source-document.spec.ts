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
    readFileText: () => 'We repair kites.\n\nOur customers are coastal schools.',
    ...overrides,
  };
}

describe('loadSourceDocument', () => {
  it('reads the operator-chosen document and proposes its passages', () => {
    const { document, outcome } = loadSourceDocument(options());

    expect(document.kind).toBe('plain-text');
    expect(document.locator).toBe(OUTSIDE);
    expect(outcome.kind === 'passages-proposed' && outcome.passages).toHaveLength(2);
  });

  it('refuses a path inside the repository before opening anything', () => {
    // ⚠️ Order is load-bearing — ADR-0054 D2. The reader must not run at all.
    let opened = false;

    expect(() =>
      loadSourceDocument(
        options({
          path: INSIDE,
          readFileText: () => {
            opened = true;
            return '';
          },
        }),
      ),
    ).toThrow(OperatorFilePathRefusedError);

    expect(opened).toBe(false);
  });

  it('refuses an unreadable file rather than reporting an empty document', () => {
    // 🚫 A file that was never opened and a file with nothing in it are
    // different facts, and only one of them is about the document's contents.
    expect(() =>
      loadSourceDocument(
        options({
          readFileText: () => {
            throw new Error('ENOENT');
          },
        }),
      ),
    ).toThrow(SourceDocumentReadError);
  });

  it('reports the document alongside the outcome when nothing was proposed', () => {
    // ⚠️ ADR-0059 D7 — "sources read" and "facts found" are different counts,
    // so a caller can always say a document WAS read.
    const { document, outcome } = loadSourceDocument(options({ readFileText: () => '   ' }));

    expect(document.label).toBe('Fictional positioning deck');
    expect(outcome).toEqual({
      kind: 'not-extracted',
      sourceId: 'src-fictional-deck',
      reason: 'empty-document',
    });
  });
});
