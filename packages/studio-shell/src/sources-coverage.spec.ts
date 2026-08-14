import { describe, expect, it } from 'vitest';

import { describeSourcesCoverage } from './sources-coverage';

/**
 * ⚠️ WHAT THESE PROVE: that the sentence naming the Sources boundary points at
 * the other area WITHOUT claiming anything about what that area holds.
 */
describe('describeSourcesCoverage', () => {
  it('names the boundary and where the other answer lives', () => {
    const sentence = describeSourcesCoverage();

    expect(sentence).toContain('documents only');
    expect(sentence).toContain('Peer Products');
    // ⚠️ The relay is an ACT, and the sentence must say so rather than
    // implying observations arrive on their own (ADR-0069 D3).
    expect(sentence).toContain('the operator relays it');
  });

  it('🚫 never reports an empty result it did not look for', () => {
    const sentence = describeSourcesCoverage().toLowerCase();

    // 🛑 "AGE has not looked" must never read as "AGE looked and found
    // nothing" (D5). The screen is quiet about the observation store, and the
    // sentence says that quiet means nothing.
    expect(sentence).toContain('has looked at that store');
    for (const forbidden of [
      'no source systems have',
      'none have reported',
      'no observations',
      'nothing has been reported',
    ]) {
      expect(sentence, forbidden).not.toContain(forbidden);
    }
  });
});
