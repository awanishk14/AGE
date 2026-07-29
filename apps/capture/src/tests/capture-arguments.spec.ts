import { describe, expect, it } from 'vitest';
import { parseCaptureArguments } from '../capture-arguments';

/**
 * ADR-0043 D4/D5/D7, Slice B1.
 *
 * Every one of these is a fat-finger case. The table this CLI writes to is
 * append-only with `GRANT SELECT, INSERT` only, so a wrong well-formed write
 * cannot be corrected or removed through the application at all, and under
 * `FORCE ROW LEVEL SECURITY` it is not readily discoverable afterwards under
 * the scope that should have received it. A rejected parse costs nothing.
 */

const REQUIRED = [
  '--profile',
  './profile.json',
  '--client-id',
  'client-1',
  '--organization-id',
  'org-1',
  '--changed-by',
  'operator@example.com',
];

const expectOk = (argv: readonly string[]) => {
  const parsed = parseCaptureArguments(argv);
  if (!parsed.ok) {
    throw new Error(`expected a successful parse, got: ${parsed.errors.join('; ')}`);
  }
  return parsed.command;
};

const expectErrors = (argv: readonly string[]): readonly string[] => {
  const parsed = parseCaptureArguments(argv);
  if (parsed.ok) {
    throw new Error('expected the parse to fail');
  }
  return parsed.errors;
};

describe('parseCaptureArguments — the produce-only default', () => {
  it('accepts the minimal invocation and does not request capture', () => {
    const command = expectOk(REQUIRED);

    expect(command.mode).toBe('produceOnly');
    expect(command.profilePath).toBe('./profile.json');
    expect(command.clientId).toBe('client-1');
    expect(command.organizationId).toBe('org-1');
    expect(command.changedBy).toBe('operator@example.com');
  });

  it('leaves the optional mapper values unset rather than inventing them', () => {
    const command = expectOk(REQUIRED);

    expect(command.bifId).toBeUndefined();
  });

  it('carries an explicit --bif-id through', () => {
    const command = expectOk([...REQUIRED, '--bif-id', 'bif-7']);

    expect(command.bifId).toBe('bif-7');
  });
});

describe('parseCaptureArguments — capture is opt-in and must be confirmed (D4, D7)', () => {
  it('requests capture only when both --capture and --confirm are present', () => {
    const command = expectOk([...REQUIRED, '--capture', '--confirm']);

    expect(command.mode).toBe('produceAndCapture');
  });

  it('rejects --capture without --confirm rather than writing', () => {
    expect(expectErrors([...REQUIRED, '--capture']).join('; ')).toMatch(/--confirm/);
  });

  it('rejects --confirm without --capture, because it confirms nothing', () => {
    expect(expectErrors([...REQUIRED, '--confirm']).join('; ')).toMatch(/--capture/);
  });

  it('rejects --snapshot-id when capture was not requested', () => {
    expect(expectErrors([...REQUIRED, '--snapshot-id', 'snap-1']).join('; ')).toMatch(
      /--snapshot-id/,
    );
  });

  it('rejects --captured-at when capture was not requested', () => {
    expect(
      expectErrors([...REQUIRED, '--captured-at', '2026-07-30T00:00:00.000Z']).join('; '),
    ).toMatch(/--captured-at/);
  });
});

describe('parseCaptureArguments — the deterministic overrides (D5)', () => {
  const CAPTURING = [...REQUIRED, '--capture', '--confirm'];

  it('leaves both overrides unset by default, so the entry point supplies them', () => {
    const command = expectOk(CAPTURING);

    expect(command.snapshotIdOverride).toBeUndefined();
    expect(command.capturedAtOverride).toBeUndefined();
  });

  it('accepts a canonical --captured-at', () => {
    const command = expectOk([...CAPTURING, '--captured-at', '2026-07-30T12:34:56.789Z']);

    expect(command.capturedAtOverride).toBe('2026-07-30T12:34:56.789Z');
  });

  it('accepts a --snapshot-id override', () => {
    const command = expectOk([...CAPTURING, '--snapshot-id', 'snap-1']);

    expect(command.snapshotIdOverride).toBe('snap-1');
  });

  it.each([
    ['2026-07-30T12:34:56Z', 'missing milliseconds'],
    ['2026-07-30T12:34:56.789+01:00', 'an offset rather than Z'],
    ['2026-07-30', 'a date with no time'],
    ['not-a-time', 'not a timestamp at all'],
  ])('rejects --captured-at %s (%s)', (value) => {
    expect(expectErrors([...CAPTURING, '--captured-at', value]).join('; ')).toMatch(
      /--captured-at/,
    );
  });

  it('rejects a blank --snapshot-id', () => {
    expect(expectErrors([...CAPTURING, '--snapshot-id', '   ']).join('; ')).toMatch(
      /--snapshot-id/,
    );
  });
});

describe('parseCaptureArguments — scope id format validation (D4 mitigation 1)', () => {
  it.each([
    ['--client-id', ''],
    ['--client-id', '   '],
    ['--organization-id', ''],
    ['--organization-id', '\t'],
  ])('rejects a blank %s', (flag, value) => {
    const patched = [...REQUIRED];
    patched[patched.indexOf(flag) + 1] = value;

    expect(expectErrors(patched).join('; ')).toContain(flag);
  });

  /**
   * `scoredBifSnapshotScopeSchema` uses `z.string().trim()`, which SILENTLY
   * REWRITES a padded id into a different one. For a value that becomes part of
   * an append-only primary key that is exactly the wrong behaviour: the
   * operator would see `' client-1 '` in their shell history and the database
   * would hold `client-1`. Rejecting is the only honest option — the CLI is not
   * entitled to decide which id the operator meant.
   */
  it.each([['--client-id'], ['--organization-id']])(
    'rejects a padded %s rather than silently trimming it into a different id',
    (flag) => {
      const patched = [...REQUIRED];
      patched[patched.indexOf(flag) + 1] = ' client-1 ';

      expect(expectErrors(patched).join('; ')).toContain(flag);
    },
  );
});

describe('parseCaptureArguments — malformed invocations', () => {
  it.each([['--profile'], ['--client-id'], ['--organization-id'], ['--changed-by']])(
    'reports a missing required %s',
    (flag) => {
      const at = REQUIRED.indexOf(flag);
      const without = [...REQUIRED.slice(0, at), ...REQUIRED.slice(at + 2)];

      expect(expectErrors(without).join('; ')).toContain(flag);
    },
  );

  it('reports every missing required flag at once, not just the first', () => {
    const errors = expectErrors([]);

    expect(errors.join('; ')).toContain('--profile');
    expect(errors.join('; ')).toContain('--client-id');
    expect(errors.join('; ')).toContain('--organization-id');
    expect(errors.join('; ')).toContain('--changed-by');
  });

  it('rejects an unknown flag rather than ignoring it', () => {
    expect(expectErrors([...REQUIRED, '--dry-run']).join('; ')).toContain('--dry-run');
  });

  it('rejects a positional argument', () => {
    expect(expectErrors([...REQUIRED, 'profile.json']).join('; ')).toContain('profile.json');
  });

  it('rejects a repeated flag instead of quietly taking the last value', () => {
    expect(expectErrors([...REQUIRED, '--client-id', 'client-2']).join('; ')).toContain(
      '--client-id',
    );
  });

  it('rejects a value-taking flag with no value', () => {
    expect(expectErrors([...REQUIRED, '--bif-id']).join('; ')).toContain('--bif-id');
  });

  it('does not treat the next flag as the previous flag’s value', () => {
    const errors = expectErrors([
      '--profile',
      '--client-id',
      'client-1',
      '--organization-id',
      'org-1',
      '--changed-by',
      'operator',
    ]);

    expect(errors.join('; ')).toContain('--profile');
  });
});

describe('parseCaptureArguments — purity', () => {
  it('returns the same result for the same argv', () => {
    expect(parseCaptureArguments(REQUIRED)).toEqual(parseCaptureArguments(REQUIRED));
  });

  it('does not mutate the argv it was given', () => {
    const argv = [...REQUIRED];
    parseCaptureArguments(argv);

    expect(argv).toEqual(REQUIRED);
  });
});
