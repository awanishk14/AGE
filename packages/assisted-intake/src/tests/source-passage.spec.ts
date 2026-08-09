import { describe, expect, it } from 'vitest';

import { describeNotExtracted } from '../extraction-outcome';
import { readSourcePassages } from '../source-passage';
import type { SourceDocument } from '../source-document';

function document(text: string): SourceDocument {
  return {
    sourceId: 'src-fictional-deck',
    label: 'Fictional positioning deck',
    kind: 'plain-text',
    locator: '/operator/documents/deck.txt',
    text,
  };
}

describe('readSourcePassages', () => {
  it('proposes each paragraph verbatim, with a checkable position', () => {
    const outcome = readSourcePassages(
      document('We repair kites.\nSince 1998.\n\n  Our customers are coastal schools.  \n'),
    );

    expect(outcome.kind).toBe('passages-proposed');
    if (outcome.kind !== 'passages-proposed') return;

    expect(outcome.passages).toEqual([
      {
        passageId: 'src-fictional-deck#1',
        locator: 'lines 1–2',
        text: 'We repair kites.\nSince 1998.',
      },
      {
        passageId: 'src-fictional-deck#2',
        locator: 'line 4',
        text: 'Our customers are coastal schools.',
      },
    ]);
  });

  it('never rewrites, summarises or re-cases the document text', () => {
    // ⚠️ ADR-0050 D2 one level up. The text a human accepts must be the text
    // the document contained, or "confirmed from source" is not checkable.
    const original = 'we DO not, ever — normalise   this.';
    const outcome = readSourcePassages(document(original));

    expect(outcome.kind === 'passages-proposed' && outcome.passages[0]?.text).toBe(original);
  });

  it('binds no passage to any question', () => {
    // 🚫 ADR-0059 D1. Deciding which question a paragraph answers is an
    // inference about a real business. A `questionId` appearing on a passage
    // would mean AGE had made that decision on the human's behalf.
    const outcome = readSourcePassages(document('Kite repair, mostly.'));

    expect(outcome.kind === 'passages-proposed' && Object.keys(outcome.passages[0] ?? {})).toEqual([
      'passageId',
      'locator',
      'text',
    ]);
  });

  describe('D7 — an empty extraction is not "no information"', () => {
    it.each([
      ['', 'empty-document'],
      ['   \n\n  \t \n', 'empty-document'],
      ['a\u0000b', 'not-plain-text'],
      ['---\n\n===', 'no-readable-passages'],
    ] as const)('refuses %j by name, with the reason %s', (text, reason) => {
      const outcome = readSourcePassages(document(text));

      expect(outcome.kind).toBe('not-extracted');
      expect(outcome.kind === 'not-extracted' && outcome.reason).toBe(reason);
    });

    it('never returns an empty success', () => {
      // 🚫 The failure D7 exists to prevent: a document that proposed nothing
      // rendering as though the business has nothing.
      const outcome = readSourcePassages(document(''));

      expect(outcome).not.toHaveProperty('passages');
    });

    it('says the file is the subject, never the business', () => {
      for (const reason of ['empty-document', 'no-readable-passages', 'not-plain-text'] as const) {
        const sentence = describeNotExtracted({
          kind: 'not-extracted',
          sourceId: 'src-fictional-deck',
          reason,
        });

        expect(sentence.trim().length).toBeGreaterThan(0);
        expect(sentence.toLowerCase()).not.toContain('no offerings');
        expect(sentence).toMatch(/document|file/i);
      }
    });

    it('names the decoder decision rather than pretending a PDF was empty', () => {
      // 🚫 ADR-0059 D4.2 is allowed only "subject to naming the library in a
      // follow-up ADR". Until that ADR exists, silence would read as a finding.
      const sentence = describeNotExtracted({
        kind: 'not-extracted',
        sourceId: 'src-fictional-deck',
        reason: 'not-plain-text',
      });

      expect(sentence).toContain('PDF');
      expect(sentence.toLowerCase()).toContain('decoder');
    });
  });
});
