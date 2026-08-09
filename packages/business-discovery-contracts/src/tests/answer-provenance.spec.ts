import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  answerProvenanceSchema,
  describeAnswerProvenance,
  STATED_ANSWER_PROVENANCE,
  type AnswerProvenance,
} from '../answer-provenance';
import { discoveryAnswerSchema } from '../discovery-answer';

/**
 * ADR-0059 D2 and D3, asserted rather than assumed.
 *
 * ⚠️ MADE TO FAIL BEFORE THEY WERE TRUSTED: adding a `confidence: z.number()` to
 * the confirmed-from-source schema fails the D3 guard by name; adding
 * `.default(STATED_ANSWER_PROVENANCE)` to the answer schema fails the D2 guard;
 * adding a third arm fails the D1 guard.
 */

// ⚠️ Anchored to the package root rather than to `import.meta.url` — under this
// vitest config the module URL is not a `file:` URL and cannot be resolved.
const MODULE_SOURCE = readFileSync(resolve(process.cwd(), 'src', 'answer-provenance.ts'), 'utf8');

/**
 * ⚠️ Comments are stripped before scanning. This module's own explanation of why
 * it carries no number contains the word, and a guard that fails on its own
 * documentation gets deleted rather than fixed.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('AnswerProvenance', () => {
  it('accepts a stated answer with no further properties', () => {
    expect(answerProvenanceSchema.parse({ kind: 'stated' })).toEqual({ kind: 'stated' });
    expect(STATED_ANSWER_PROVENANCE).toEqual({ kind: 'stated' });
    expect(Object.isFrozen(STATED_ANSWER_PROVENANCE)).toBe(true);
  });

  it('requires the source, the location and the human on a confirmed answer', () => {
    // 🚫 An accepted candidate that cannot say where it came from or who
    // accepted it is indistinguishable from a fabricated answer.
    for (const missing of ['sourceId', 'locator', 'confirmedBy']) {
      const candidate: Record<string, unknown> = {
        kind: 'confirmed-from-source',
        sourceId: 'source-fictional',
        locator: 'page 2',
        confirmedBy: 'operator:fictional',
      };
      delete candidate[missing];

      expect(answerProvenanceSchema.safeParse(candidate).success).toBe(false);
    }
  });

  it('has exactly two arms, and neither means "extracted"', () => {
    // 🚫 ADR-0059 D1 — assisted intake PROPOSES; it never ANSWERS. A third arm
    // here would be an unconfirmed extraction wearing an answer's clothes.
    const source = withoutComments(MODULE_SOURCE);
    const kinds = [...source.matchAll(/z\.literal\('([a-z-]+)'\)/g)].map((match) => match[1]);

    expect(kinds).toEqual(['stated', 'confirmed-from-source']);
    expect(source).not.toContain("'extracted'");
    expect(source).not.toContain("'proposed'");
  });

  it('carries no number of any kind (D3)', () => {
    // 🚫 An extractor's certainty is a property of a parser. Give it a home on
    // the answer and it is one refactor away from being scored alongside
    // `discoveryConfidenceScore`, which measures the interview.
    const source = withoutComments(MODULE_SOURCE);

    expect(source).not.toContain('z.number(');
    expect(source.toLowerCase()).not.toContain('confidence');
    expect(source.toLowerCase()).not.toContain('score');
  });

  it('supplies no default, on the provenance or on the answer that carries it', () => {
    // 🚫 ADR-0049 D2 — a default makes the distinction unfalsifiable behind a
    // field that only LOOKS recorded.
    expect(withoutComments(MODULE_SOURCE)).not.toContain('.default(');

    const withoutProvenance = { questionId: 'bi-name', value: 'Fictional Kite Repair' };
    expect(discoveryAnswerSchema.safeParse(withoutProvenance).success).toBe(false);

    expect(
      discoveryAnswerSchema.safeParse({ ...withoutProvenance, provenance: { kind: 'stated' } })
        .success,
    ).toBe(true);
  });

  it('describes every arm in words, and never as blank or unknown', () => {
    const arms: readonly AnswerProvenance[] = [
      STATED_ANSWER_PROVENANCE,
      {
        kind: 'confirmed-from-source',
        sourceId: 'source-fictional',
        locator: 'page 2',
        confirmedBy: 'operator:fictional',
      },
    ];

    for (const arm of arms) {
      const described = describeAnswerProvenance(arm);
      expect(described.trim().length).toBeGreaterThan(0);
      expect(described.toLowerCase()).not.toContain('unknown');
    }

    // ⚠️ The confirmed arm names all three facts — a description that dropped
    // one would render an accepted candidate as though it had no origin.
    const confirmed = describeAnswerProvenance(arms[1]!);
    expect(confirmed).toContain('source-fictional');
    expect(confirmed).toContain('page 2');
    expect(confirmed).toContain('operator:fictional');
  });
});
