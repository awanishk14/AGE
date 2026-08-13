import { describe, expect, it } from 'vitest';

import { parseRelayArguments } from '../relay-arguments';

/**
 * ADR-0069 D3/D7 — the argument surface of the only write path into the
 * observation store.
 *
 * ⚠️ EVERY FIXTURE IS CONSPICUOUSLY FICTIONAL (ADR-0053 D3, ADR-0065 D1).
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
  '--observation',
  '/home/operator/private/observation.json',
] as const;

const errorsOf = (argv: readonly string[]): readonly string[] => {
  const parsed = parseRelayArguments(argv);

  expect(parsed.ok).toBe(false);

  return parsed.ok ? [] : parsed.errors;
};

describe('parseRelayArguments', () => {
  it('defaults to assessing and never to writing', () => {
    const parsed = parseRelayArguments(BASE);

    expect(parsed.ok).toBe(true);
    // 🛑 THE DEFAULT IS THE SAFE MODE. A default that appended would make every
    // typo a write.
    expect(parsed.ok && parsed.command.mode).toBe('assessOnly');
  });

  it('appends only when both --append and --confirm are given', () => {
    const parsed = parseRelayArguments([...BASE, '--append', '--confirm']);

    expect(parsed.ok && parsed.command.mode).toBe('appendConfirmed');
  });

  it('refuses --append without --confirm, and --confirm without --append', () => {
    expect(errorsOf([...BASE, '--append']).join(' ')).toContain('--append requires --confirm');
    expect(errorsOf([...BASE, '--confirm']).join(' ')).toContain('it confirms nothing');
  });

  it('refuses --organization-id BY NAME rather than as an unknown flag', () => {
    const errors = errorsOf([...BASE, '--organization-id', 'org-fictional-1']);

    // 🚫 "Unknown flag" would read as a typo. This is a refusal, and it says
    // where the scope really comes from.
    expect(errors.join(' ')).toContain('the organization is read from the client record');
    expect(errors.join(' ')).not.toContain('Unknown flag: --organization-id');
  });

  it('refuses a typed source system, subject, observation id and recorded instant', () => {
    for (const flag of ['--source-system', '--subject', '--observation-id', '--recorded-at']) {
      const errors = errorsOf([...BASE, flag, 'anything']).join(' ');

      expect(errors).toContain(`${flag} is not accepted here`);
    }
  });

  it('refuses a bulk arm by name', () => {
    // 🚫 ONE OBSERVATION PER INVOCATION. A bulk arm is how a data warehouse
    // arrives, and it always arrives looking like a convenience.
    expect(errorsOf([...BASE, '--all']).join(' ')).toContain('there is no bulk arm');
    expect(errorsOf([...BASE, '--directory', '/tmp/obs']).join(' ')).toContain(
      'a bulk arm by another name',
    );
  });

  it('reports every missing required flag, not just the first', () => {
    const errors = errorsOf([]);

    for (const flag of [
      '--records',
      '--repository-root',
      '--client-id',
      '--bif-id',
      '--observation',
    ]) {
      expect(errors).toContain(`${flag} is required.`);
    }
  });

  it('does not accept --capture, so onboarding muscle memory cannot write here', () => {
    // ⚠️ `--capture` writes a snapshot of what the BUSINESS said. This command
    // writes what a SOURCE claimed. They must not be reachable by the same word.
    expect(errorsOf([...BASE, '--capture', '--confirm']).join(' ')).toContain(
      'Unknown flag: --capture',
    );
  });
});
