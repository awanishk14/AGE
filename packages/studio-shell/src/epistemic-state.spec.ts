import { describe, expect, it } from 'vitest';

import {
  allEpistemicStatePresentations,
  EPISTEMIC_STATES,
  presentEpistemicState,
} from './epistemic-state';

describe('epistemic states', () => {
  it('has exactly four states', () => {
    // ⚠️ Four, not two. The count is the rule.
    expect(EPISTEMIC_STATES.length).toBe(4);
    expect([...EPISTEMIC_STATES]).toEqual(['known', 'unattributed', 'unknown', 'not-assessed']);
  });

  it('presents every state', () => {
    const presentations = allEpistemicStatePresentations();
    expect(presentations.length).toBe(4);
    for (const p of presentations) {
      expect(p.label.trim()).not.toBe('');
      expect(p.meaning.trim()).not.toBe('');
      expect(p.className).toContain('age-state');
    }
  });

  /**
   * 🚫 The rule from `17_DESIGN_SYSTEM.md` §4: no two states may share a visual
   * treatment. If a future refactor gives two states the same class or the same
   * label, this test is what catches it.
   */
  it('gives every state a distinct class and a distinct label', () => {
    const presentations = allEpistemicStatePresentations();
    expect(new Set(presentations.map((p) => p.className)).size).toBe(4);
    expect(new Set(presentations.map((p) => p.label)).size).toBe(4);
  });

  /**
   * ⚠️ "Unknown" is a correct answer. Its wording must not read as an error, a
   * failure or a missing value — a low or absent result is styled as a result.
   */
  it('describes unknown as a result rather than a failure', () => {
    expect(presentEpistemicState('unknown').meaning).toMatch(/result, not a failure/);
  });

  /** 🚫 "Not assessed" must never be describable as zero or empty. */
  it('describes not-assessed as unlooked-at, not as zero', () => {
    const meaning = presentEpistemicState('not-assessed').meaning;
    expect(meaning).toMatch(/has not looked/);
    expect(meaning).toMatch(/not zero and not empty/);
  });

  it('keeps known and unattributed separate', () => {
    expect(presentEpistemicState('known').label).not.toBe(
      presentEpistemicState('unattributed').label,
    );
    expect(presentEpistemicState('unattributed').meaning).toMatch(/cannot say where/);
  });
});
