import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Repository-wide guard: EVERY vitest config merges the shared base config, and
 * the base config actually caps concurrent workers.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY A GUARD AND NOT JUST THE BASE FILE.
 *
 * Before the base config existed, no `pool`, `maxWorkers`, `maxThreads` or
 * `maxForks` setting existed in ANY of the repository's vitest configs. Each
 * vitest process defaulted to one worker per core and Nx ran several of those
 * at once; a single `pnpm test` was measured at **93 node processes** and
 * ~**8,900 MB** on a 16-core / 15.3 GB machine.
 *
 * That state is trivially reachable again, and it is INVISIBLE when it returns:
 * a config that stops merging the base still passes its own tests, still lints,
 * still typechecks, and simply runs unbounded. Nothing else in the repository
 * would notice. This test is the only thing that does.
 *
 * ⚠️ A new package's `vitest.config.ts` must merge `vitestBaseConfig`. If this
 * test fails for a config you just added, add the merge — do not add the file
 * to an exemption list, because an exempt config is exactly an uncapped one.
 */

const MODULE_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = join(MODULE_DIRECTORY, '..', '..', '..', '..');

/** Directories that never contain first-party source. */
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', '.git', '.nx', 'coverage', 'build']);

/** Strip block and line comments, so prose about a rule cannot satisfy it. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** Every `vitest*.config.ts` in the repository, excluding the base itself. */
function collectVitestConfigs(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectVitestConfigs(full));
    } else if (
      entry.isFile() &&
      entry.name.startsWith('vitest') &&
      entry.name.endsWith('.config.ts') &&
      entry.name !== 'vitest.base.config.ts'
    ) {
      found.push(full);
    }
  }
  return found;
}

const CONFIGS = collectVitestConfigs(REPOSITORY_ROOT);
const BASE_CONFIG_PATH = join(REPOSITORY_ROOT, 'vitest.base.config.ts');
const BASE_CONFIG_SOURCE = readFileSync(BASE_CONFIG_PATH, 'utf8');

describe('vitest worker cap (repository-wide)', () => {
  it('finds the vitest configs at all', () => {
    // ⚠️ ASSERTED FIRST, ALWAYS. A walk that found nothing would let every
    // assertion below pass vacuously and report perfect compliance — the exact
    // failure mode this repository's guard-test convention exists to prevent.
    expect(CONFIGS.length).toBeGreaterThan(20);
  });

  it('caps concurrent workers in the shared base config', () => {
    // The cap itself. Stated as a bound rather than an exact number so raising
    // it slightly is not a test edit, but removing it is.
    const maxForks = BASE_CONFIG_SOURCE.match(/maxForks:\s*(\d+)/);
    expect(maxForks, 'vitest.base.config.ts must set poolOptions.forks.maxForks').not.toBeNull();
    expect(Number(maxForks?.[1])).toBeGreaterThan(0);
    expect(Number(maxForks?.[1])).toBeLessThanOrEqual(4);

    // ⚠️ The pool must be named EXPLICITLY. `poolOptions` is keyed by pool name,
    // so a vitest release changing its default pool would silently strip the cap
    // while leaving the config looking as though it still applied.
    expect(BASE_CONFIG_SOURCE).toMatch(/pool:\s*'forks'/);
  });

  it('sets no per-worker heap ceiling below measured demand', () => {
    // ⚠️ NOT AN OVERSIGHT — a recorded decision. The measured peak single worker
    // in this repository is 2,298 MB. A `--max-old-space-size` below real demand
    // does not bound a suite; it aborts it having run ZERO tests, which reports
    // as a broken build rather than as the memory problem it is. If one is ever
    // added, it must be measured first and this test updated deliberately.
    // ⚠️ Comments are stripped first: the base config EXPLAINS this decision in
    // prose, and a scan of raw source would match its own rationale and fail.
    expect(withoutComments(BASE_CONFIG_SOURCE)).not.toMatch(/max-old-space-size/);
    expect(withoutComments(BASE_CONFIG_SOURCE)).not.toMatch(/execArgv/);
  });

  it('has every vitest config merge the shared base', () => {
    const offenders: string[] = [];
    for (const config of CONFIGS) {
      const source = readFileSync(config, 'utf8');
      const merges = source.includes('vitestBaseConfig') && source.includes('mergeConfig(');
      if (!merges) offenders.push(relative(REPOSITORY_ROOT, config).split('\\').join('/'));
    }
    expect(offenders, 'these vitest configs run uncapped').toEqual([]);
  });

  it('has no config override the cap back off', () => {
    // Merging the base is not enough on its own: a config could merge it and
    // then re-raise the ceiling in its own object, which reads as compliant.
    const offenders: string[] = [];
    for (const config of CONFIGS) {
      const source = readFileSync(config, 'utf8');
      if (/maxForks|maxThreads|maxWorkers|poolOptions/.test(withoutComments(source))) {
        offenders.push(relative(REPOSITORY_ROOT, config).split('\\').join('/'));
      }
    }
    expect(offenders, 'the worker cap belongs in the base config alone').toEqual([]);
  });
});
