import type { BusinessDiscoveryQuestionnaireQuestion } from '@age/business-discovery-contracts';
import { describe, expect, it } from 'vitest';

import { PassageAcceptanceRefusedError, acceptPassageAsAnswer } from '../accept-passage';
import type { SourceDocument } from '../source-document';
import type { SourcePassage } from '../source-passage';

const SOURCE: SourceDocument = {
  sourceId: 'src-fictional-deck',
  label: 'Fictional positioning deck',
  kind: 'plain-text',
  locator: '/operator/documents/deck.txt',
  text: 'We repair kites.',
};

const PASSAGE: SourcePassage = {
  passageId: 'src-fictional-deck#1',
  locator: 'lines 1–2',
  text: 'We repair kites for coastal schools.',
};

function question(
  overrides: Partial<BusinessDiscoveryQuestionnaireQuestion> = {},
): BusinessDiscoveryQuestionnaireQuestion {
  return {
    id: 'bi-model',
    sectionId: 'business-identity',
    prompt: 'How does the business make money?',
    required: true,
    kind: 'longText',
    ...overrides,
  } as BusinessDiscoveryQuestionnaireQuestion;
}

describe('acceptPassageAsAnswer', () => {
  it('records the source, the position and the person who accepted it', () => {
    const answer = acceptPassageAsAnswer({
      question: question(),
      passage: PASSAGE,
      source: SOURCE,
      confirmedBy: 'operator:fictional',
    });

    expect(answer).toEqual({
      questionId: 'bi-model',
      value: 'We repair kites for coastal schools.',
      provenance: {
        kind: 'confirmed-from-source',
        sourceId: 'src-fictional-deck',
        locator: 'Fictional positioning deck (lines 1–2)',
        confirmedBy: 'operator:fictional',
      },
    });
  });

  it("never puts the operator's local path into the answer", () => {
    // ⚠️ The answer travels further than the machine that produced it. The
    // label plus the passage position is what makes the claim checkable.
    const answer = acceptPassageAsAnswer({
      question: question(),
      passage: PASSAGE,
      source: SOURCE,
      confirmedBy: 'operator:fictional',
    });

    expect(JSON.stringify(answer)).not.toContain('/operator/documents');
  });

  it('transcribes the passage verbatim', () => {
    const passage = { ...PASSAGE, text: 'we DO not, ever — normalise   this.' };
    const answer = acceptPassageAsAnswer({
      question: question(),
      passage,
      source: SOURCE,
      confirmedBy: 'operator:fictional',
    });

    expect(answer.value).toBe(passage.text);
  });

  it('adds exactly one entry to a list question', () => {
    // 🚫 ADR-0050 D2 — one acceptance is one entry. Splitting a passage into
    // several would be AGE deciding where one fact ends and the next begins.
    const answer = acceptPassageAsAnswer({
      question: question({ id: 'ci-segments', kind: 'list' }),
      passage: { ...PASSAGE, text: 'Coastal schools; surf clubs; two festivals' },
      source: SOURCE,
      confirmedBy: 'operator:fictional',
    });

    expect(answer.value).toEqual(['Coastal schools; surf clubs; two festivals']);
  });

  it('refuses a choice question rather than picking the nearest choice', () => {
    // 🚫 ADR-0051 — the enum is on the QUESTION, never on the answer.
    expect(() =>
      acceptPassageAsAnswer({
        question: question({ id: 'bi-kind', kind: 'choice', choices: ['product', 'service'] }),
        passage: { ...PASSAGE, text: 'We are very much a service business.' },
        source: SOURCE,
        confirmedBy: 'operator:fictional',
      }),
    ).toThrow(PassageAcceptanceRefusedError);
  });

  it('refuses an acceptance with nobody accepting it', () => {
    // 🚫 ADR-0053 D4 — never defaulted, generated or inferred.
    for (const confirmedBy of ['', '   ']) {
      expect(() =>
        acceptPassageAsAnswer({
          question: question(),
          passage: PASSAGE,
          source: SOURCE,
          confirmedBy,
        }),
      ).toThrow(/accepting person/);
    }
  });

  it('refuses an empty passage', () => {
    expect(() =>
      acceptPassageAsAnswer({
        question: question(),
        passage: { ...PASSAGE, text: '   ' },
        source: SOURCE,
        confirmedBy: 'operator:fictional',
      }),
    ).toThrow(PassageAcceptanceRefusedError);
  });

  it('never echoes the passage text in a refusal', () => {
    // 🚫 A refusal must not carry a real business's words into a log.
    const secret = 'Fictional Kite Repair bills 40% of revenue to one client.';
    try {
      acceptPassageAsAnswer({
        question: question({ id: 'bi-kind', kind: 'choice', choices: ['product'] }),
        passage: { ...PASSAGE, text: secret },
        source: SOURCE,
        confirmedBy: 'operator:fictional',
      });
      expect.unreachable('the choice question should have been refused');
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
      expect((error as Error).message).toContain('bi-kind');
    }
  });
});
