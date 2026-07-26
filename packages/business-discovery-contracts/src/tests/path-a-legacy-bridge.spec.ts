import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * ADR-0038 (Accepted) guard — Path A is a temporary legacy demo bridge.
 *
 * Path A is `mapBusinessDiscoveryToBifContext` → `BifCompatibleBusinessContext`.
 * Path B is `produceScoredBifContext`, the single sanctioned Discovery → BIF
 * mapping. Path A survives for exactly one reason: the demo still calls it, and
 * moving the demo would require inventing `organizationId`, `constructedAt` and
 * `changedBy`, which ADR-0038 D6 forbids.
 *
 * "Temporary" is a claim that decays silently. A second non-test caller would
 * make Path A load-bearing again and quietly cost nothing at the time it was
 * added. This test is what makes the claim checkable: the moment anything other
 * than the demo reaches for Path A, it fails and names the file.
 *
 * It asserts a fact about the repository, not about a module, so it reads the
 * source tree. It writes nothing and imports nothing under test.
 */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

/** Where Path A is declared, exported and tested. Its own home is not a caller. */
const OWN_PACKAGE = join('packages', 'business-discovery-contracts');

const SEARCH_ROOTS = ['packages', 'apps'];
const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', 'build', 'coverage', '.next', '.nx']);
const SOURCE_EXTENSIONS = ['.ts', '.tsx'];

/** Path A's two exported names. Either one is a use of the path. */
const PATH_A_SYMBOLS = ['mapBusinessDiscoveryToBifContext', 'BifCompatibleBusinessContext'];

/** The one caller ADR-0038 D2 sanctions, for as long as D3 blocks the migration. */
const SANCTIONED_CALLER = join('packages', 'demo-runtime', 'src', 'business-discovery.ts');

function isTestFile(relativePath: string): boolean {
  const segments = relativePath.split(sep);
  return (
    segments.includes('tests') ||
    segments.includes('__tests__') ||
    /\.(spec|test)\.tsx?$/.test(relativePath)
  );
}

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

/** Every non-test file outside Path A's own package that names a Path A symbol. */
function pathAReferences(): string[] {
  return repositorySourceFiles()
    .map((absolute) => ({ absolute, relativePath: relative(REPO_ROOT, absolute) }))
    .filter(({ relativePath }) => !relativePath.startsWith(OWN_PACKAGE))
    .filter(({ relativePath }) => !isTestFile(relativePath))
    .filter(({ absolute }) => {
      const source = readFileSync(absolute, 'utf8');
      return PATH_A_SYMBOLS.some((symbol) => source.includes(symbol));
    })
    .map(({ relativePath }) => relativePath)
    .sort();
}

describe('ADR-0038 — Path A is a temporary legacy demo bridge', () => {
  it('finds source files at all, so an empty result can never be mistaken for a pass', () => {
    const files = repositorySourceFiles();

    expect(files.length).toBeGreaterThan(100);
    expect(files.some((file) => file.endsWith(join('src', 'business-discovery.ts')))).toBe(true);
  });

  it('has exactly one non-test caller outside its own package: the demo', () => {
    expect(pathAReferences()).toEqual([SANCTIONED_CALLER]);
  });

  it('is not reached for by any capability package', () => {
    const fromCapabilities = pathAReferences().filter((file) =>
      file.startsWith(join('packages', 'capabilities')),
    );

    expect(fromCapabilities).toEqual([]);
  });

  it('is not reached for by apps — the demo bridge lives in demo-runtime, not in an app', () => {
    const fromApps = pathAReferences().filter((file) => file.startsWith('apps'));

    expect(fromApps).toEqual([]);
  });

  it('is not reached for by the persistence packages — snapshots store Path B output', () => {
    const fromPersistence = pathAReferences().filter((file) => file.includes('persistence'));

    expect(fromPersistence).toEqual([]);
  });

  it('labels itself as legacy at the source, so the boundary survives without this test', () => {
    const source = readFileSync(
      join(REPO_ROOT, OWN_PACKAGE, 'src', 'business-discovery-bif-mapping.ts'),
      'utf8',
    );

    expect(source).toMatch(/ADR-0038/);
    expect(source).toMatch(/legacy/i);
    expect(source).toMatch(/produceScoredBifContext/);
  });
});
