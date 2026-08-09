import { describe, expect, it } from 'vitest';

import {
  MAXIMUM_SESSION_LIFETIME_SECONDS,
  MINIMUM_SESSION_LIFETIME_SECONDS,
  sessionExpiryFrom,
} from '../session-lifetime';
import { SessionStoreRefusedError } from '../session-record';

const ISSUED = new Date('2026-08-09T09:00:00.000Z');

describe('a session has an absolute ceiling', () => {
  it('adds the lifetime to the issuing instant', () => {
    expect(sessionExpiryFrom(ISSUED, 3600)).toBe('2026-08-09T10:00:00.000Z');
  });

  it('permits exactly the ceiling', () => {
    expect(sessionExpiryFrom(ISSUED, MAXIMUM_SESSION_LIFETIME_SECONDS)).toBe(
      '2026-08-09T21:00:00.000Z',
    );
  });

  it.each([
    ['a year', 365 * 24 * 60 * 60],
    ['one second past the ceiling', MAXIMUM_SESSION_LIFETIME_SECONDS + 1],
    ['below the floor', MINIMUM_SESSION_LIFETIME_SECONDS - 1],
    ['zero', 0],
    ['negative', -60],
    ['fractional', 3600.5],
    ['not a number', Number.NaN],
    ['infinite', Number.POSITIVE_INFINITY],
  ])('refuses %s', (_case, lifetime) => {
    expect(() => sessionExpiryFrom(ISSUED, lifetime)).toThrow(SessionStoreRefusedError);
  });

  it('refuses an unreadable issuing instant', () => {
    expect(() => sessionExpiryFrom(new Date('nonsense'), 3600)).toThrow(SessionStoreRefusedError);
  });

  it('states a ceiling a person would actually accept', () => {
    // ⚠️ A ceiling nobody can work under is a ceiling somebody raises. Twelve
    // hours is a working day; the test pins the intent, not just the number.
    expect(MAXIMUM_SESSION_LIFETIME_SECONDS).toBe(12 * 60 * 60);
  });
});
