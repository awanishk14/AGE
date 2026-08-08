import { describe, expect, it } from 'vitest';

import { parseInspectArguments } from '../inspect-arguments';

/**
 * ADR-0055 D1 — what the reader will and will not accept.
 *
 * ⚠️ Fixtures are conspicuously fictional (ADR-0053 D3). 🚫 Do not make them
 * more realistic; obvious fictionality IS the guard.
 */

const BASE = [
  '--records',
  '/home/operator/private/clients.json',
  '--repository-root',
  '/home/operator/AGE',
  '--client-id',
  'client-fictional-1',
  '--bif-id',
  'bif-fictional-1',
] as const;

const errorsOf = (argv: readonly string[]): readonly string[] => {
  const parsed = parseInspectArguments(argv);
  if (parsed.ok) throw new Error('expected a refusal');
  return parsed.errors;
};

describe('parseInspectArguments — what it accepts', () => {
  it('accepts the four required flags and leaves snapshotId unset', () => {
    const parsed = parseInspectArguments(BASE);

    expect(parsed).toEqual({
      ok: true,
      command: {
        recordsPath: '/home/operator/private/clients.json',
        repositoryRoot: '/home/operator/AGE',
        clientId: 'client-fictional-1',
        bifId: 'bif-fictional-1',
      },
    });
  });

  it('leaves snapshotId ABSENT rather than null or empty when it was not given', () => {
    // ⚠️ "the latest in this series" is a different question, 🚫 not a default
    // snapshot. A `null` here would read as "the operator asked for nothing".
    const parsed = parseInspectArguments(BASE);
    if (!parsed.ok) throw new Error('expected a command');

    expect('snapshotId' in parsed.command).toBe(false);
  });

  it('carries a pinned snapshot id through verbatim', () => {
    const parsed = parseInspectArguments([...BASE, '--snapshot-id', 'snap-fictional-9']);
    if (!parsed.ok) throw new Error('expected a command');

    expect(parsed.command.snapshotId).toBe('snap-fictional-9');
  });
});

describe('parseInspectArguments — what it refuses', () => {
  it('reports EVERY missing required flag, not just the first', () => {
    // One retry per invocation, not one per flag.
    const errors = errorsOf([]);

    for (const flag of ['--records', '--repository-root', '--client-id', '--bif-id']) {
      expect(errors).toContain(`${flag} is required.`);
    }
  });

  /**
   * 🚫 THE CENTRAL REFUSAL. An operator who types `--organization-id` believes
   * they are choosing the scope. RLS would agree with whatever scope the
   * transaction asked for — it checks coherence, never entitlement — so a typed
   * scope is a read in a scope no record of theirs describes.
   */
  it('refuses --organization-id BY NAME, saying where the scope really comes from', () => {
    const errors = errorsOf([...BASE, '--organization-id', 'org-someone-else']);

    expect(errors).toContain(
      '--organization-id is not accepted here — the organization is read from the client record named by --client-id, never typed.',
    );
    // ⚠️ Not "Unknown flag", which reads as a typo instead of as a refusal.
    expect(errors.join(' ')).not.toContain('Unknown flag: --organization-id.');
  });

  it.each(['--capture', '--confirm'])('refuses %s by name, as having no meaning here', (flag) => {
    // 🚫 The two tokens that authorize a write, refused by the command that must
    // never perform one — and refused with the reason, not as a typo.
    const errors = errorsOf([...BASE, flag]);

    expect(errors.join(' ')).toContain(`${flag} is not accepted here — this command only reads`);
  });

  it('refuses an unknown flag rather than ignoring it', () => {
    expect(errorsOf([...BASE, '--latest'])).toContain('Unknown flag: --latest.');
  });

  it('refuses a repeated flag rather than guessing which value was meant', () => {
    const errors = errorsOf([...BASE, '--client-id', 'client-fictional-2']);

    expect(errors.join(' ')).toContain('was given more than once');
  });

  it('refuses a blank value rather than treating it as absent', () => {
    const errors = errorsOf([
      '--records',
      '   ',
      '--repository-root',
      '/home/operator/AGE',
      '--client-id',
      'client-fictional-1',
      '--bif-id',
      'bif-fictional-1',
    ]);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('refuses a flag given with no value at all', () => {
    expect(errorsOf([...BASE, '--snapshot-id'])).toContain('--snapshot-id requires a value.');
  });
});
