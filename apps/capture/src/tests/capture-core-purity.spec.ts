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

const CORE_MODULES = ['capture-arguments.ts', 'capture-profile-input.ts', 'index.ts'] as const;

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
