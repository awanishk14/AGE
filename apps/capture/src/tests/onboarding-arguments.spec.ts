import { describe, expect, it } from 'vitest';

import { parseOnboardingArguments } from '../onboarding-arguments';

/**
 * ADR-0054 D6 — what the onboarding command will and will not accept.
 *
 * The rule under test throughout is that ambiguity is an error rather than a
 * guess: the table this command reaches is append-only and grants only SELECT
 * and INSERT, so a well-formed write of the wrong data cannot be withdrawn
 * through the application at all.
 */

const BASE = [
  '--answers',
  '/home/operator/private/answers.json',
  '--records',
  '/home/operator/private/clients.json',
  '--repository-root',
  '/home/operator/AGE',
  '--client-id',
  'client-fictional-1',
  '--changed-by',
  'operator:awanish',
  '--profile-id',
  'profile-fictional-1',
] as const;

const parse = (extra: readonly string[] = []) => parseOnboardingArguments([...BASE, ...extra]);

const errorsOf = (result: ReturnType<typeof parseOnboardingArguments>): readonly string[] =>
  result.ok ? [] : result.errors;

describe('parseOnboardingArguments', () => {
  it('defaults to produceOnly when nothing is asked for', () => {
    const result = parse();

    expect(result.ok).toBe(true);
    expect(result.ok && result.command.mode).toBe('produceOnly');
  });

  it('captures only when --capture and --confirm are BOTH given', () => {
    const capturing = parse(['--capture', '--confirm']);
    expect(capturing.ok).toBe(true);
    expect(capturing.ok && capturing.command.mode).toBe('produceAndCapture');

    // 🚫 `--capture` alone never writes. The confirmation is a second act.
    expect(errorsOf(parse(['--capture']))).toContain(
      '--capture requires --confirm, which acknowledges the echoed scope before writing.',
    );
    expect(errorsOf(parse(['--confirm']))).toContain(
      '--confirm was given without --capture, so it confirms nothing.',
    );
  });

  it('requires every input, naming all of the missing ones at once', () => {
    const errors = errorsOf(parseOnboardingArguments([]));

    for (const flag of [
      '--answers',
      '--records',
      '--repository-root',
      '--client-id',
      '--changed-by',
      '--profile-id',
    ]) {
      expect(errors).toContain(`${flag} is required.`);
    }
  });

  it('refuses --organization-id rather than ignoring it', () => {
    // ⚠️ D6 condition 1: the scope comes from the loaded record, never
    // fabricated. An operator who types this flag believes they are choosing
    // the scope, and silently dropping it would leave them believing it.
    const errors = errorsOf(parse(['--organization-id', 'org-typed-by-hand']));

    expect(errors.some((error) => error.startsWith('--organization-id is not accepted here'))).toBe(
      true,
    );
    expect(errors).not.toContain('Unknown flag: --organization-id.');
  });

  it('refuses --profile, because this command builds one from the answers', () => {
    const errors = errorsOf(parse(['--profile', '/tmp/profile.json']));

    expect(errors.some((error) => error.startsWith('--profile is not accepted here'))).toBe(true);
  });

  it('refuses unknown flags, positionals and repeats', () => {
    expect(errorsOf(parse(['--nope', 'x']))).toContain('Unknown flag: --nope.');
    expect(errorsOf(parse(['stray']))).toContain(
      'Unexpected positional argument: stray. Every input is a named flag.',
    );
    expect(errorsOf(parse(['--client-id', 'client-other']))).toContain(
      '--client-id was given more than once. Refusing to guess which value was meant.',
    );
  });

  it('refuses padding rather than trimming it into a different id', () => {
    // Everything except `--answers`, which is supplied padded.
    const withoutAnswers = BASE.slice(2);
    const errors = errorsOf(
      parseOnboardingArguments([...withoutAnswers, '--answers', ' /x.json ']),
    );

    expect(
      errors.some((error) => error.includes('Refusing to trim it into a different value')),
    ).toBe(true);
  });

  it('refuses capture-only flags when capture was not requested', () => {
    expect(errorsOf(parse(['--snapshot-id', 'snap-1']))).toContain(
      '--snapshot-id is only meaningful when capture is requested with --capture --confirm.',
    );
    expect(errorsOf(parse(['--captured-at', '2026-08-02T00:00:00.000Z']))).toContain(
      '--captured-at is only meaningful when capture is requested with --capture --confirm.',
    );
  });

  it('refuses a --captured-at that is not a canonical UTC instant', () => {
    const errors = errorsOf(
      parse(['--capture', '--confirm', '--captured-at', '2026-08-02T00:00:00+05:30']),
    );

    expect(errors.some((error) => error.startsWith('--captured-at must be'))).toBe(true);
  });

  it('carries the optional values through only when they were given', () => {
    const bare = parse();
    expect(bare.ok && 'bifId' in bare.command).toBe(false);
    expect(bare.ok && 'snapshotIdOverride' in bare.command).toBe(false);

    const full = parse([
      '--capture',
      '--confirm',
      '--bif-id',
      'bif-fictional-1',
      '--snapshot-id',
      'snap-1',
      '--captured-at',
      '2026-08-02T09:08:07.006Z',
    ]);

    expect(full.ok && full.command.bifId).toBe('bif-fictional-1');
    expect(full.ok && full.command.snapshotIdOverride).toBe('snap-1');
    expect(full.ok && full.command.capturedAtOverride).toBe('2026-08-02T09:08:07.006Z');
  });
});
