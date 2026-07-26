import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { produceScoredBifContext, SAMPLE_BUSINESS_DISCOVERY_PROFILE } from '../index';

/**
 * ADR-0038 / ADR-0039 guard — there is exactly ONE Discovery -> BIF mapping.
 *
 * Legacy Path A (`mapBusinessDiscoveryToBifContext` -> `BifCompatibleBusinessContext`)
 * is retired: its modules, barrel exports and specs were deleted once ADR-0039
 * gave the demo a legitimate metadata source and the last caller went away.
 *
 * Deletion is not self-enforcing. The retired names could be reintroduced by a
 * revert, a copy-paste from history, or a well-meaning "compatibility shim" —
 * and a shim is a third path wearing a smaller name. This test replaces the old
 * caller-counting guard (`path-a-legacy-bridge.spec.ts`) with the stronger
 * claim the retirement earned: the names are gone from the repository entirely,
 * including from this package.
 *
 * It asserts a fact about the source tree, so it reads the source tree. It
 * writes nothing.
 */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

const SEARCH_ROOTS = ['packages', 'apps'];
const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', 'build', 'coverage', '.next', '.nx']);
const SOURCE_EXTENSIONS = ['.ts', '.tsx'];

/** The retired Path A names. Any of them reappearing is a regression. */
const RETIRED_SYMBOLS = [
  'mapBusinessDiscoveryToBifContext',
  'BifCompatibleBusinessContext',
  'BifCompatibleSectionKey',
  'BIF_COMPATIBLE_SECTION_KEYS',
  'bifCompatibleBusinessContextSchema',
];

/** This spec necessarily names them in order to forbid them. */
const THIS_FILE = fileURLToPath(import.meta.url);

function collectSourceFiles(directory: string, found: string[]): string[] {
  for (const entry of readdirSync(directory)) {
    if (SKIP_DIRECTORIES.has(entry)) continue;

    const absolute = join(directory, entry);

    if (statSync(absolute).isDirectory()) {
      collectSourceFiles(absolute, found);
      continue;
    }

    if (SOURCE_EXTENSIONS.some((extension) => entry.endsWith(extension))) {
      found.push(absolute);
    }
  }

  return found;
}

function repositorySourceFiles(): string[] {
  return SEARCH_ROOTS.flatMap((root) => collectSourceFiles(join(REPO_ROOT, root), []));
}

/**
 * Every file that names a retired symbol in executable code. Comments are
 * stripped: a doc comment saying "Path A was retired" is the documentation this
 * decision wants, not a use of it.
 */
function retiredSymbolReferences(): string[] {
  return repositorySourceFiles()
    .filter((absolute) => absolute !== THIS_FILE)
    .filter((absolute) => {
      const executable = readFileSync(absolute, 'utf8').replace(/\/\*\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      return RETIRED_SYMBOLS.some((symbol) => executable.includes(symbol));
    })
    .map((absolute) => relative(REPO_ROOT, absolute).split(sep).join('/'))
    .sort();
}

describe('ADR-0039 — legacy Path A is retired, not merely unused', () => {
  it('finds source files at all, so an empty result can never be mistaken for a pass', () => {
    const files = repositorySourceFiles();

    expect(files.length).toBeGreaterThan(100);
    expect(files.some((file) => file.endsWith(join('src', 'business-discovery.ts')))).toBe(true);
  });

  it('has no executable reference to any retired Path A name anywhere in the repository', () => {
    expect(retiredSymbolReferences()).toEqual([]);
  });

  it('no longer ships the Path A modules', () => {
    const packageSource = join(REPO_ROOT, 'packages', 'business-discovery-contracts', 'src');

    expect(() => statSync(join(packageSource, 'bif-compatible-context.ts'))).toThrow();
    expect(() => statSync(join(packageSource, 'business-discovery-bif-mapping.ts'))).toThrow();
  });

  it('still exposes canonical Path B, which is what makes the deletion safe', () => {
    const { context } = produceScoredBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE, {
      organizationId: 'retirement-guard-organization',
      constructedAt: new Date('2026-01-01T00:00:00.000Z'),
      changedBy: 'retirement-guard-operator',
    });

    expect(context.sections.length).toBeGreaterThan(0);
    // Mapping never promotes the BIF (ADR-0025).
    expect(context.bifStatus).toBe('Draft');
  });
});
