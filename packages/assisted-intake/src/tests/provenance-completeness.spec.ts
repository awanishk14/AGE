import {
  answerProvenanceSchema,
  STATED_ANSWER_PROVENANCE,
  type BusinessDiscoveryQuestionnaireQuestion,
} from '@age/business-discovery-contracts';
import { describe, expect, it } from 'vitest';

import { PassageAcceptanceRefusedError, acceptPassageAsAnswer } from '../accept-passage';
import type { SourceDocument } from '../source-document';
import type { SourcePassage } from '../source-passage';

/**
 * ADR-0066 **D3** — a source-confirmed answer is valid only when its provenance
 * is complete enough to identify the source, locate the originating material,
 * and identify the confirmer (§0.4a — ⚠️ the Product Owner's binding wording:
 * 🚫 never "a source that cannot be named is not a source").
 *
 * ⚠️ Every fixture below is DELIBERATELY FICTIONAL (ADR-0053 D3, ADR-0065 D1).
 */

const SOURCE: SourceDocument = {
  sourceId: 'src-fictional-brief',
  label: 'Fictional onboarding brief',
  kind: 'plain-text',
  locator: '/operator/documents/brief.txt',
  text: 'We repair kites.',
};

const PASSAGE: SourcePassage = {
  passageId: 'src-fictional-brief#1',
  locator: 'lines 4–6',
  text: 'We repair kites for coastal schools.',
};

function question(): BusinessDiscoveryQuestionnaireQuestion {
  return {
    id: 'bi-model',
    sectionId: 'business-identity',
    prompt: 'How does the business make money?',
    required: true,
    kind: 'longText',
  } as BusinessDiscoveryQuestionnaireQuestion;
}

function accept(
  source: SourceDocument,
  passage: SourcePassage = PASSAGE,
  confirmedBy = 'operator:fictional',
) {
  return () => acceptPassageAsAnswer({ question: question(), passage, source, confirmedBy });
}

/**
 * The four components D3 requires, each removed on its own. ⚠️ `the source
 * label` and `the passage locator` are listed separately from `sourceId` and
 * `confirmedBy` because they COMPOSE the `locator` field — see the
 * whitespace-survives-composition case below for why that distinction matters.
 */
const INCOMPLETE_CASES = [
  {
    missing: 'sourceId',
    names: 'sourceId',
    source: { ...SOURCE, sourceId: '' },
    passage: PASSAGE,
    by: 'operator:f',
  },
  {
    missing: 'the source label',
    names: 'the source label',
    source: { ...SOURCE, label: '' },
    passage: PASSAGE,
    by: 'operator:f',
  },
  {
    missing: 'the passage locator',
    names: 'the passage locator',
    source: SOURCE,
    passage: { ...PASSAGE, locator: '' },
    by: 'operator:f',
  },
  {
    missing: 'confirmedBy',
    // ⚠️ This one is refused EARLIER, by the guard ADR-0059 already shipped, and
    // its message is the more specific of the two. D3 asks that the answer be
    // refused and never downgraded — 🚫 not that this module own the refusal.
    // Asserting the shipped wording keeps that guard load-bearing instead of
    // quietly shadowing it with a second check.
    names: 'no accepting person',
    source: SOURCE,
    passage: PASSAGE,
    by: '',
  },
] as const;

describe('ADR-0066 D3 — an incomplete provenance is REFUSED, never downgraded', () => {
  it('accepts a complete provenance, so the refusals below are about completeness and nothing else', () => {
    const answer = accept(SOURCE)();

    expect(answer.provenance).toEqual({
      kind: 'confirmed-from-source',
      sourceId: 'src-fictional-brief',
      locator: 'Fictional onboarding brief (lines 4–6)',
      confirmedBy: 'operator:fictional',
    });
    expect(answerProvenanceSchema.safeParse(answer.provenance).success).toBe(true);
  });

  it.each(INCOMPLETE_CASES)('refuses when $missing is absent', ({ names, source, passage, by }) => {
    expect(accept(source, passage, by)).toThrow(PassageAcceptanceRefusedError);
    expect(accept(source, passage, by)).toThrow(names);
  });

  it('examined every component D3 requires', () => {
    // ⚠️ Sentinel: a rewrite that empties the case table must fail here rather
    // than report four passing refusals it never ran.
    expect(INCOMPLETE_CASES).toHaveLength(4);
  });

  it.each(INCOMPLETE_CASES)(
    '🚫 does NOT downgrade to `stated` when $missing is absent',
    ({ source, passage, by }) => {
      // ⚠️ THE CORE OF D3 (§0.4c). `stated` means "the client told AGE this".
      // Producing one here would rewrite the history of how the fact entered
      // AGE, and nothing downstream could detect it. 🚫 No answer at all is the
      // correct outcome — not an answer with a repaired or substituted origin.
      let produced: unknown;
      try {
        produced = accept(source, passage, by)();
      } catch {
        produced = undefined;
      }

      expect(produced).toBeUndefined();
    },
  );

  it('🚫 whitespace does not satisfy a component, even though it survives composition', () => {
    // ⚠️ THE CASE A SCHEMA CHECK ALONE WOULD MISS. `locator` is composed as
    // `label (passage locator)`, so a blank label still yields " (lines 4–6)" —
    // a NON-EMPTY string that satisfies `.min(1)` while locating nothing. This
    // is why the components are checked, not only the composed value.
    const blankLabel = { ...SOURCE, label: '   ' };
    const composed = `${blankLabel.label} (${PASSAGE.locator})`;

    expect(composed.length).toBeGreaterThan(1);
    expect(
      answerProvenanceSchema.safeParse({
        kind: 'confirmed-from-source',
        sourceId: blankLabel.sourceId,
        locator: composed,
        confirmedBy: 'operator:fictional',
      }).success,
    ).toBe(true);

    expect(accept(blankLabel)).toThrow('the source label');
  });

  it('🚫 the refusal names the FIELD and never echoes a value', () => {
    // ⚠️ ADR-0065 D1 — a name in prose is client data, and a `sourceId` or a
    // label routinely carries one. ADR-0054 D3's rule applied here: name a
    // position, never contents.
    const named = {
      ...SOURCE,
      sourceId: 'src-northwind-kites-ltd',
      label: 'Northwind Kites Ltd internal brief',
    };
    const passage = { ...PASSAGE, locator: '' };

    let message = '';
    try {
      accept(named, passage)();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('the passage locator');
    expect(message).not.toContain('Northwind');
    expect(message).not.toContain('src-northwind-kites-ltd');
    expect(message).not.toContain(PASSAGE.text);
    expect(message).not.toContain(SOURCE.locator);
  });

  it('🚫 no path in the module falls back to a stated provenance', () => {
    // ⚠️ A static guard, because the runtime cases above can only prove the
    // paths they walk. A helper added later that repairs a missing component
    // would pass every test above and defeat D3 silently.
    const source = readAcceptPassageSource();

    expect(source).not.toContain('STATED_ANSWER_PROVENANCE');
    expect(source).not.toContain(`kind: 'stated'`);
    expect(source.length).toBeGreaterThan(200);
  });

  it('the stated provenance is still a real value elsewhere, so the guard above is about THIS module', () => {
    // ⚠️ Guards against the scan passing because the constant vanished from the
    // codebase rather than because this module refuses to reach for it.
    expect(STATED_ANSWER_PROVENANCE.kind).toBe('stated');
  });
});

function readAcceptPassageSource(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require('node:fs') as typeof import('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { fileURLToPath } = require('node:url') as typeof import('node:url');
  const modulePath = fileURLToPath(new URL('../accept-passage.ts', import.meta.url));
  const source = readFileSync(modulePath, 'utf8');

  // ⚠️ Comments are stripped before scanning: this module's own explanation of
  // the rule names `STATED_ANSWER_PROVENANCE`, and a scan that matched its
  // documentation would fail for the opposite of the right reason.
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}
