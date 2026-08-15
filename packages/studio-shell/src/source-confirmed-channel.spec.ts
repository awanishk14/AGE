import { describe, expect, it } from 'vitest';

import {
  BOTH_INTAKE_CHANNELS_READ,
  presentSourceConfirmedChannel,
  SOURCE_CONFIRMED_LABEL,
  SOURCE_CONFIRMED_SEPARATION_NOTE,
} from './source-confirmed-channel';

/**
 * ⚠️ These tests are about SENTENCES, not formatting. Each one pins a thing the
 * console must not be able to say again once ADR-0073 gave source-confirmed
 * answers a channel of their own.
 */
describe('presentSourceConfirmedChannel', () => {
  it('says nothing has looked when no workspace is configured', () => {
    const view = presentSourceConfirmedChannel({ kind: 'not-configured' });

    expect(view.label).toBe(SOURCE_CONFIRMED_LABEL);
    expect(view.state).toBe('not-assessed');
    expect(view.detail).toContain('nothing has looked');
    // 🚫 The one thing it must never be read as.
    expect(view.value).not.toMatch(/none/i);
  });

  it('keeps a refusal a refusal', () => {
    const view = presentSourceConfirmedChannel({ kind: 'refused' });

    expect(view.value).toBe('Refused');
    expect(view.state).toBe('unknown');
    // 🚫 No partial or repaired file stands in for the one it could not read.
    expect(view.detail).toContain('No partial or repaired file');
  });

  it('gives zero its own sentence, distinct from never having looked', () => {
    const zero = presentSourceConfirmedChannel({ kind: 'read', questionCount: 0 });
    const never = presentSourceConfirmedChannel({ kind: 'not-configured' });

    expect(zero.value).toBe('None yet');
    expect(zero.state).toBe('unknown');
    expect(zero.value).not.toBe(never.value);
    expect(zero.detail).not.toBe(never.detail);
    // 🚫 Never a claim about the business itself.
    expect(zero.detail).toContain('not about the business');
  });

  it('counts one confirmed answer in the singular', () => {
    const view = presentSourceConfirmedChannel({ kind: 'read', questionCount: 1 });

    expect(view.value).toBe('1 question answered from a document');
    expect(view.state).toBe('known');
  });

  it('counts several, and says out loud that they are never added to the typed draft', () => {
    const view = presentSourceConfirmedChannel({ kind: 'read', questionCount: 3 });

    expect(view.value).toBe('3 questions answered from a document');
    expect(view.state).toBe('known');
    expect(view.detail).toContain(SOURCE_CONFIRMED_SEPARATION_NOTE);
  });

  it('never expresses the count as a share, a score or a completeness', () => {
    for (const questionCount of [0, 1, 3, 17]) {
      const view = presentSourceConfirmedChannel({ kind: 'read', questionCount });
      expect(view.value).not.toMatch(/%|\bof\s+\d|score|complete/i);
    }
  });

  it('returns frozen views so no caller can edit a sentence in place', () => {
    expect(Object.isFrozen(presentSourceConfirmedChannel({ kind: 'refused' }))).toBe(true);
  });
});

describe('BOTH_INTAKE_CHANNELS_READ', () => {
  /**
   * ⚠️ The panels understated their input before ADR-0073 D5. This pins the
   * replacement: it must name BOTH channels and must not claim the console
   * wrote everything it reads.
   */
  it('names both channels and keeps their origins apart', () => {
    expect(BOTH_INTAKE_CHANNELS_READ).toContain('the answers you typed');
    expect(BOTH_INTAKE_CHANNELS_READ).toContain('confirmed from documents');
    expect(BOTH_INTAKE_CHANNELS_READ).toContain('keeps their origins apart');
    expect(BOTH_INTAKE_CHANNELS_READ).not.toContain('this console wrote');
  });
});
