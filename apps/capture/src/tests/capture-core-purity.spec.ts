import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * ADR-0043 D5, Slice B1.
 *
 * The whole point of splitting the CLI into a pure core (B1) and an entry point
 * (B2) is that the clock, the id source and every filesystem read live in
 * exactly one place. This guard is what stops that from eroding: the moment a
 * convenience `Date.now()` or `readFileSync` appears in the core, the split has
 * silently stopped being true and the modules below stop being testable without
 * the world.
 *
 * Doc comments legitimately NAME the forbidden symbols to explain why they are
 * absent, so comments are stripped before scanning — a known trap from three
 * previous guard tests in this repo.
 */

/**
 * ⚠️ A module added to the CLI core but not to this array is a module the guard
 * does not see. The list is the coverage claim, so it grows with the core.
 */
const CORE_MODULES = [
  'capture-arguments.ts',
  'capture-connection-target.ts',
  'capture-profile-input.ts',
  'cli-argument-tokens.ts',
  'driver-failure-label.ts',
  'onboarding-arguments.ts',
  'onboarding-runner.ts',
  'local-database-target.ts',
  'capture-cli.ts',
  'index.ts',
] as const;

const here = dirname(fileURLToPath(import.meta.url));

const code = (moduleFile: string): string =>
  readFileSync(join(here, '..', moduleFile), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
    .join('\n');

describe('the capture CLI core is pure', () => {
  it('scans the modules it claims to scan', () => {
    // An empty walk must never be able to report compliance.
    expect(CORE_MODULES.length).toBeGreaterThan(0);
    for (const moduleFile of CORE_MODULES) {
      expect(code(moduleFile).length, `${moduleFile} should have been read`).toBeGreaterThan(0);
    }
  });

  it.each(CORE_MODULES)('%s reads no clock and no randomness', (moduleFile) => {
    for (const forbidden of ['new Date(', 'Date.now(', 'Math.random(', 'performance.now(']) {
      expect(
        code(moduleFile).includes(forbidden),
        `${moduleFile} must not contain ${forbidden}`,
      ).toBe(false);
    }
  });

  it.each(CORE_MODULES)('%s performs no I/O and reads no ambient state', (moduleFile) => {
    for (const forbidden of [
      'fetch(',
      'node:fs',
      'node:path',
      'node:url',
      'process.env',
      'process.argv',
      'process.exit',
      'console.',
      'localStorage',
      '@prisma/client',
      '@age/persistence',
      '@age/scored-bif-snapshot-persistence',
    ]) {
      expect(
        code(moduleFile).includes(forbidden),
        `${moduleFile} must not contain ${forbidden}`,
      ).toBe(false);
    }
  });

  it.each(CORE_MODULES)('%s never promotes a BIF status', (moduleFile) => {
    expect(code(moduleFile).includes('BIFStatus.Active')).toBe(false);
    expect(code(moduleFile).includes("'Active'")).toBe(false);
  });
});

/**
 * `capture-runner.ts` is held to a deliberately different standard (Slice B2).
 *
 * It is not in `CORE_MODULES` because it legitimately NAMES the persistence
 * package — `CaptureConnection.orchestrator` is a
 * `ScoredBifSnapshotCaptureOrchestrator`, and a run that could not say so would
 * have to type its own collaborator as `unknown`. That is a type import, which
 * costs nothing at runtime and drags in no client.
 *
 * What still binds is everything that would make the run untestable or
 * non-deterministic: it must read no clock, mint no id, open no file, touch no
 * `process`, and construct no `PrismaClient`. All of those arrive through the
 * injected `CaptureRuntime`, which is the entire reason the seam exists.
 */
describe('the capture run logic performs no effects of its own', () => {
  const RUNNER = 'capture-runner.ts';

  it('was read', () => {
    expect(code(RUNNER).length).toBeGreaterThan(0);
  });

  it.each([
    'new Date(',
    'Date.now(',
    'Math.random(',
    'performance.now(',
    'randomUUID',
    'fetch(',
    'node:fs',
    'node:crypto',
    'process.',
    'console.',
    'new PrismaClient(',
    '@prisma/client',
  ])('does not contain %s', (forbidden) => {
    expect(code(RUNNER).includes(forbidden), `${RUNNER} must not contain ${forbidden}`).toBe(false);
  });

  it('never promotes a BIF status', () => {
    expect(code(RUNNER).includes("'Active'")).toBe(false);
  });
});

/**
 * The other half of the same claim, and the one that actually keeps ADR-0043 D5
 * true: the effects are not merely absent from the core, they are concentrated
 * in ONE module. A guard that only checks absence passes just as happily when a
 * second entry point quietly grows its own clock.
 */
describe('the entry point is the sole owner of the effects', () => {
  const SOURCE_FILES = [...CORE_MODULES, 'capture-runner.ts', 'capture-composition.ts', 'main.ts'];

  it.each(['process.argv', 'node:fs', 'node:crypto', 'process.exitCode'])(
    '%s appears only in main.ts',
    (effect) => {
      const owners = SOURCE_FILES.filter((moduleFile) => code(moduleFile).includes(effect));

      expect(owners).toEqual(['main.ts']);
    },
  );

  /**
   * 🚫 NO STACK IS EVER PRINTED, in any module of this CLI. A stack renders
   * framed values, and the frames reachable from the onboarding path hold the
   * operator's connection string and the client's serialized context. The
   * error's NAME says what went wrong without saying what was being written.
   *
   * ⚠️ Nor is a driver's MESSAGE printed: Prisma's validation class renders the
   * whole `data` argument. The one place `.message` is still read is where this
   * repository wrote the refusal itself and governs its wording.
   */
  it('never reads .stack anywhere in the CLI, entry point included', () => {
    const owners = SOURCE_FILES.filter((moduleFile) => /\.stack\b/.test(code(moduleFile)));

    expect(owners).toEqual([]);
  });

  it('constructs a PrismaClient only in the composition root', () => {
    const owners = SOURCE_FILES.filter((moduleFile) =>
      code(moduleFile).includes('new PrismaClient('),
    );

    expect(owners).toEqual(['capture-composition.ts']);
  });

  /**
   * ADR-0046 D4, Slice 2. Reading the environment is an effect, and it now has
   * exactly one owner too. The decision it feeds — which identity may be
   * connected as — is a pure function in `capture-connection-target.ts`, so the
   * root reads `process.env` and decides nothing.
   */
  it('reads process.env only in the composition root', () => {
    const owners = SOURCE_FILES.filter((moduleFile) => code(moduleFile).includes('process.env'));

    expect(owners).toEqual(['capture-composition.ts']);
  });

  it('keeps the connection-target decision out of the composition root', () => {
    // The root wires; it does not choose. A literal env var name here would
    // mean the rule had started living in two places.
    expect(code('capture-composition.ts').includes('DATABASE_URL')).toBe(false);
  });

  it('leaves the composition root free of the clock, the id source and the filesystem', () => {
    for (const forbidden of ['new Date(', 'Date.now(', 'randomUUID', 'node:fs', 'process.argv']) {
      expect(
        code('capture-composition.ts').includes(forbidden),
        `capture-composition.ts must not contain ${forbidden}`,
      ).toBe(false);
    }
  });
});
