import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * ADR-0070 **D1** guard — the decoder lives at ONE site, and `unpdf` is named in
 * ONE manifest.
 *
 * 🛑 **D1 IS THE STRUCTURAL HALF OF THIS ADR, AND PROSE DOES NOT ENFORCE IT.**
 * `operator-environment.ts` claims in a comment that it is the only importer;
 * a comment is a promise, and this file is the shape. The failure it exists to
 * catch is not malice — it is the reasonable-looking edit: a second surface
 * (an MCP tool, an API route, a script) that "also needs to read a PDF" and
 * imports the decoder directly. That edit would hand a real client's documents
 * to a third party's code from a place nobody decided it could run.
 *
 * 🚫 **A PURE PACKAGE IMPORTING THIS IS THE SAME FAILURE WEARING A SMALLER
 * NAME** — `@age/assisted-intake` gaining the dependency is exactly what D1
 * forbids, and it would arrive looking like a simplification.
 *
 * ⚠️ Comments are stripped before scanning, so the files that EXPLAIN the rule
 * (this one, `mcp-tools.ts`, `source-document.ts`) do not trip it. And the walk
 * asserts it found files first: an empty scan must never read as compliance.
 *
 * It asserts a fact about the source tree, so it reads the source tree. It
 * writes nothing.
 */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

const SEARCH_ROOTS = ['packages', 'apps'];
const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', 'build', 'coverage', '.next', '.nx']);
const SOURCE_EXTENSIONS = ['.ts', '.tsx'];

const DECODER_PACKAGE = '@age/operator-document-decoder';

/** The library itself. 🚫 It must not be importable from anywhere but its own package. */
const DECODER_LIBRARY = 'unpdf';

/**
 * 🛑 **THE ONE SITE.** ADR-0070 D1: the console's single effects module. 🚫 Do
 * not add an entry here to make a failing test pass — a second site is a
 * decision, and the decision is recorded in an ADR, not in this array.
 */
const AUTHORIZED_IMPORT_SITES = ['apps/studio/src/server/operator-environment.ts'];

/** The package that owns the library, and the only manifest allowed to name it. */
const DECODER_PACKAGE_DIRECTORY = 'packages/operator-document-decoder';

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

function repositorySourceFiles(): readonly string[] {
  return SEARCH_ROOTS.flatMap((root) => collectSourceFiles(join(REPO_ROOT, root), []));
}

function repositoryPath(absolute: string): string {
  return relative(REPO_ROOT, absolute).split(sep).join('/');
}

/** ⚠️ A doc comment naming the rule is the documentation the rule wants, not a use of it. */
function executableSource(absolute: string): string {
  return readFileSync(absolute, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
}

/** ⚠️ This spec necessarily names both, in executable code, in order to forbid them. */
const THIS_FILE = fileURLToPath(import.meta.url);

function filesImporting(specifier: string): readonly string[] {
  return repositorySourceFiles()
    .filter((absolute) => absolute !== THIS_FILE)
    .map((absolute) => ({ path: repositoryPath(absolute), source: executableSource(absolute) }))
    .filter(({ source }) => source.includes(`'${specifier}'`) || source.includes(`"${specifier}"`))
    .map(({ path }) => path)
    .sort();
}

describe('ADR-0070 D1 — the decoder has exactly one import site', () => {
  it('finds source files at all, so an empty scan can never be mistaken for a pass', () => {
    const files = repositorySourceFiles().map(repositoryPath);

    expect(files.length).toBeGreaterThan(100);
    // The two files whose contents this guard is actually about.
    expect(files).toContain('apps/studio/src/server/operator-environment.ts');
    expect(files).toContain('packages/operator-document-decoder/src/decode-operator-document.ts');
  });

  it('is imported by the console effects module and by nothing else', () => {
    const importers = filesImporting(DECODER_PACKAGE).filter(
      (path) => !path.startsWith(`${DECODER_PACKAGE_DIRECTORY}/`),
    );

    expect(importers).toEqual(AUTHORIZED_IMPORT_SITES);
  });

  it('keeps `unpdf` inside the package that owns it — no pure package, app or route names it', () => {
    const importers = filesImporting(DECODER_LIBRARY);

    expect(importers).toEqual([`${DECODER_PACKAGE_DIRECTORY}/src/decode-operator-document.ts`]);
  });

  it('declares `unpdf` in exactly one manifest', () => {
    const manifests = SEARCH_ROOTS.flatMap((root) =>
      readdirSync(join(REPO_ROOT, root))
        .map((entry) => join(REPO_ROOT, root, entry, 'package.json'))
        .filter((absolute) => {
          try {
            return statSync(absolute).isFile();
          } catch {
            return false;
          }
        }),
    );

    expect(manifests.length).toBeGreaterThan(10);

    const declaring = manifests
      .filter((absolute) => readFileSync(absolute, 'utf8').includes(`"${DECODER_LIBRARY}"`))
      .map(repositoryPath)
      .sort();

    expect(declaring).toEqual([`${DECODER_PACKAGE_DIRECTORY}/package.json`]);
  });

  it('keeps the decoder out of every pure package — `@age/assisted-intake` above all', () => {
    const pureImporters = filesImporting(DECODER_PACKAGE).filter(
      (path) => path.startsWith('packages/') && !path.startsWith(`${DECODER_PACKAGE_DIRECTORY}/`),
    );

    expect(pureImporters).toEqual([]);
  });
});
