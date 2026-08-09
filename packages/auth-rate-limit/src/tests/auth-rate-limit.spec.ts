import { describe, expect, it } from 'vitest';

import {
  ATTEMPT_WINDOW_SECONDS,
  judgeAuthenticationAttempt,
  MAXIMUM_FAILURES_PER_SOURCE,
  MAXIMUM_FAILURES_PER_SUBJECT,
  type FailedAttempt,
} from '../auth-rate-limit';

const NOW = new Date('2026-08-09T12:00:00.000Z');
const AGO = (seconds: number) => new Date(NOW.getTime() - seconds * 1000).toISOString();

const failures = (
  count: number,
  overrides: Partial<FailedAttempt> = {},
  secondsAgo = 60,
): FailedAttempt[] =>
  Array.from({ length: count }, () => ({
    subjectKey: 'subject-a',
    sourceKey: 'source-a',
    failedAt: AGO(secondsAgo),
    ...overrides,
  }));

const judge = (
  recentFailures: readonly FailedAttempt[],
  overrides: Partial<{ subjectKey: string; sourceKey: string; now: Date }> = {},
) =>
  judgeAuthenticationAttempt({
    recentFailures,
    subjectKey: 'subject-a',
    sourceKey: 'source-a',
    now: NOW,
    ...overrides,
  });

describe('an ordinary attempt proceeds', () => {
  it('allows the first attempt', () => {
    expect(judge([])).toEqual({ allowed: true });
  });

  it('allows the attempt one below the subject limit', () => {
    expect(judge(failures(MAXIMUM_FAILURES_PER_SUBJECT - 1))).toEqual({ allowed: true });
  });

  it('counts only failures, so signing in correctly costs nothing', () => {
    // ⚠️ There is nowhere to record a success: the input is failures only. An
    // operator signing in ten times in a morning is not an attack.
    expect(judge(failures(1))).toEqual({ allowed: true });
  });

  it('ignores failures older than the window', () => {
    expect(judge(failures(50, {}, ATTEMPT_WINDOW_SECONDS + 60))).toEqual({ allowed: true });
  });
});

describe('guessing one account is stopped', () => {
  it('refuses at the subject limit', () => {
    const verdict = judge(failures(MAXIMUM_FAILURES_PER_SUBJECT));

    expect(verdict.allowed).toBe(false);
    if (verdict.allowed) return;
    expect(verdict.reason).toBe('too-many-attempts');
  });

  it('does not count another subject failures against this one', () => {
    expect(judge(failures(MAXIMUM_FAILURES_PER_SUBJECT, { subjectKey: 'subject-b' }))).toEqual({
      allowed: true,
    });
  });

  it('says when to come back, never sooner than a second', () => {
    const verdict = judge(failures(MAXIMUM_FAILURES_PER_SUBJECT, {}, ATTEMPT_WINDOW_SECONDS - 1));

    expect(verdict.allowed).toBe(false);
    if (verdict.allowed) return;
    expect(verdict.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(verdict.retryAfterSeconds).toBeLessThanOrEqual(ATTEMPT_WINDOW_SECONDS);
  });
});

describe('spraying many accounts from one source is stopped', () => {
  it('refuses at the source limit even though no subject is near its own', () => {
    // 🛑 THE LOAD-BEARING ONE. One guess against each of many accounts trips no
    // per-subject counter anywhere — this is why there are two counters.
    const sprayed = Array.from({ length: MAXIMUM_FAILURES_PER_SOURCE }, (_, index) => ({
      subjectKey: `subject-${index}`,
      sourceKey: 'source-a',
      failedAt: AGO(60),
    }));

    expect(judge(sprayed, { subjectKey: 'subject-untouched' })).toMatchObject({ allowed: false });
  });

  it('does not count another source failures against this one', () => {
    const elsewhere = Array.from({ length: MAXIMUM_FAILURES_PER_SOURCE }, (_, index) => ({
      subjectKey: `subject-${index}`,
      sourceKey: 'source-b',
      failedAt: AGO(60),
    }));

    expect(judge(elsewhere, { subjectKey: 'subject-untouched' })).toEqual({ allowed: true });
  });

  it('is looser than the per-subject limit, because an office shares an address', () => {
    expect(MAXIMUM_FAILURES_PER_SOURCE).toBeGreaterThan(MAXIMUM_FAILURES_PER_SUBJECT);
  });
});

describe('the limiter is not an enumeration oracle', () => {
  it('answers identically for an unknown subject and a known one', () => {
    // 🛑 A limiter that answers differently for an account that does not exist
    // has told the attacker who has one — they stop guessing credentials and
    // start harvesting the list.
    const known = judge(failures(MAXIMUM_FAILURES_PER_SUBJECT), { subjectKey: 'subject-a' });
    const unknown = judge(failures(MAXIMUM_FAILURES_PER_SUBJECT, { subjectKey: 'nobody' }), {
      subjectKey: 'nobody',
    });

    expect(unknown).toEqual(known);
  });

  it('says nothing but too-many-attempts', () => {
    const verdict = judge(failures(MAXIMUM_FAILURES_PER_SUBJECT));

    expect(verdict.allowed).toBe(false);
    if (verdict.allowed) return;
    expect(Object.keys(verdict).sort()).toEqual(['allowed', 'reason', 'retryAfterSeconds']);
    expect(JSON.stringify(verdict)).not.toContain('subject-a');
  });
});

describe('a corrupt row buys nothing', () => {
  it('counts an unreadable timestamp rather than discarding it', () => {
    // ⚠️ "I cannot tell when this happened" reads as "recently". Discarding it
    // would make a corrupt row a way to buy attempts.
    const unreadable = failures(MAXIMUM_FAILURES_PER_SUBJECT, { failedAt: 'whenever' });

    expect(judge(unreadable)).toMatchObject({ allowed: false });
  });

  it('still names a retry-after when every timestamp is unreadable', () => {
    const verdict = judge(failures(MAXIMUM_FAILURES_PER_SUBJECT, { failedAt: 'whenever' }));

    expect(verdict.allowed).toBe(false);
    if (verdict.allowed) return;
    expect(verdict.retryAfterSeconds).toBe(ATTEMPT_WINDOW_SECONDS);
  });
});

describe('it reads no clock of its own', () => {
  it('gives two answers for the same failures at two instants', () => {
    const recorded = failures(MAXIMUM_FAILURES_PER_SUBJECT);

    expect(judge(recorded)).toMatchObject({ allowed: false });
    expect(
      judge(recorded, { now: new Date(NOW.getTime() + (ATTEMPT_WINDOW_SECONDS + 120) * 1000) }),
    ).toEqual({ allowed: true });
  });
});
