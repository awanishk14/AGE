import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { STATED_ANSWER_PROVENANCE } from '@age/business-discovery-contracts';
import { describe, expect, it } from 'vitest';

/**
 * ADR-0066 **D4 as clarified** (§0.5a) — *"The Answer File remains stated-only
 * and its parser remains untouched."*
 *
 * ⚠️ **WHY THE ANSWER FILE MAY NEVER CARRY PROVENANCE:** it is hand-edited.
 * Provenance recorded there would be a **claim anyone can type**, and a typed
 * claim of "confirmed from a source" is exactly the assertion ADR-0066 D3 spent
 * a slice refusing. In the draft, a `confirmed-from-source` answer can only
 * arrive from the acceptance path, which already proves its provenance complete.
 *
 * 🚫 The obvious "improvement" this guard exists to stop: adding a provenance
 * column to the Answer File so an operator can record where an answer came from.
 * That is not a feature — it is provenance becoming an assertion.
 */

const PARSER = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'discovery-answer-file',
  'src',
  'parse-discovery-answer-file.ts',
);

function parserSource(): string {
  const source = readFileSync(PARSER, 'utf8');

  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('ADR-0066 §0.5a — the Answer File stays stated-only', () => {
  it('read the real parser, so the assertions below are about live code', () => {
    const source = parserSource();

    expect(source.length).toBeGreaterThan(200);
    expect(source).toContain('STATED_ANSWER_PROVENANCE');
  });

  it('🚫 the parser knows nothing of a source-confirmed answer', () => {
    const source = parserSource();

    expect(source).not.toContain('confirmed-from-source');
    expect(source).not.toContain('sourceId');
    expect(source).not.toContain('confirmedBy');
    expect(source).not.toContain('@age/intake-draft');
  });

  it('the stated provenance it hard-codes really is `stated`', () => {
    // ⚠️ Guards against the scan above passing because the constant changed
    // meaning rather than because the parser still reaches for the right one.
    expect(STATED_ANSWER_PROVENANCE.kind).toBe('stated');
  });
});
