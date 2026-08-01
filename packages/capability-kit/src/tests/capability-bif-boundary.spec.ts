import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Repo-wide guard for the standing boundary "capability packages must never
 * import `@age/bif`".
 *
 * The ban already had per-package guards in `intelligence`, `market-discovery`
 * and `revenue` — the three ADR-0027 adopters. `growth`, `authority` and
 * `operations` had none, so half the capabilities could have taken the import
 * with every suite still green.
 *
 * This guard is deliberately written against the CAPABILITIES DIRECTORY rather
 * than a hard-coded list, so a seventh capability added tomorrow is covered on
 * the day it is created rather than on the day someone remembers to add it.
 *
 * ⚠️ It does NOT replace the three per-package blocks. Those assert further
 * things (engine/API/Web/persistence surfaces, the `run` boundary) that are
 * specific to their capability. Deleting them is not made safe by this file.
 *
 * Why the ban exists: a live `BusinessIntelligenceFramework` carries `Date`s,
 * per-field version history and audit actors. ADR-0026 requires capabilities to
 * be pure over the scope-free `ScoredBifContext` projection. An `@age/bif`
 * import would pull mutable framework state and audit actors into a package
 * whose purity nothing else checks, and would open a `bif.status` write path
 * that the "never promote BIF status" tests do not watch.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const CAPABILITIES_ROOT = join(HERE, '..', '..', '..', 'capabilities');

const FORBIDDEN = '@age/bif';

/**
 * The lower bound is the six capabilities that exist today. It is an
 * AT-LEAST assertion, not an equality: adding a seventh must not fail this
 * test, but losing the walk entirely must.
 */
const KNOWN_CAPABILITY_COUNT = 6;

/** Strip block and line comments, so prose about the rule cannot satisfy it. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function importedSpecifiers(source: string): string[] {
  return [...stripComments(source).matchAll(/(?:from|require\()\s*['"]([^'"]+)['"]/g)].map(
    (match) => match[1] ?? '',
  );
}

/** Every capability package directory, discovered rather than listed. */
function capabilityPackages(): string[] {
  return readdirSync(CAPABILITIES_ROOT)
    .map((entry) => join(CAPABILITIES_ROOT, entry))
    .filter((full) => statSync(full).isDirectory());
}

/**
 * A package's own `.ts` sources. `dist/` is excluded because it is build output
 * — gitignored, frequently stale, and its presence or absence would otherwise
 * change what this guard examines.
 */
function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    if (entry === 'node_modules' || entry === 'dist') return [];
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

describe('capability packages never import @age/bif (repo-wide)', () => {
  it('finds every capability package before asserting anything about them', () => {
    const packages = capabilityPackages();

    expect(packages.length).toBeGreaterThanOrEqual(KNOWN_CAPABILITY_COUNT);
    expect(packages.map((full) => full.split(/[\\/]/).pop())).toEqual(
      expect.arrayContaining([
        'intelligence',
        'market-discovery',
        'revenue',
        'growth',
        'authority',
        'operations',
      ]),
    );
  });

  it('declares no @age/bif dependency in any capability manifest', () => {
    let manifestsChecked = 0;

    for (const packageDirectory of capabilityPackages()) {
      const manifest = JSON.parse(readFileSync(join(packageDirectory, 'package.json'), 'utf8')) as {
        name?: string;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };

      const declared = [
        ...Object.keys(manifest.dependencies ?? {}),
        ...Object.keys(manifest.devDependencies ?? {}),
      ];

      expect(declared, `${manifest.name ?? packageDirectory} declares ${FORBIDDEN}`).not.toContain(
        FORBIDDEN,
      );
      manifestsChecked += 1;
    }

    // Asserted AFTER the loop: a walk that found nothing would otherwise report
    // full compliance.
    expect(manifestsChecked).toBeGreaterThanOrEqual(KNOWN_CAPABILITY_COUNT);
  });

  it('imports @age/bif in no capability source file', () => {
    let filesScanned = 0;

    for (const packageDirectory of capabilityPackages()) {
      for (const file of sourceFiles(packageDirectory)) {
        expect(
          importedSpecifiers(readFileSync(file, 'utf8')),
          `${file} imports ${FORBIDDEN}`,
        ).not.toContain(FORBIDDEN);
        filesScanned += 1;
      }
    }

    // The per-package file counts are not uniform, so the total is asserted
    // after the loop rather than per package.
    expect(filesScanned).toBeGreaterThan(50);
  });

  it('scans real source, not comments — the strip is load-bearing', () => {
    // `intelligence` discusses `@age/bif` in prose precisely because it must
    // not import it. Without the comment strip this guard would fail on the
    // file that documents the rule, and would then have been deleted.
    const prose = `// imports from '${FORBIDDEN}' are banned\nimport { x } from '@age/capability-kit';`;

    expect(importedSpecifiers(prose)).toEqual(['@age/capability-kit']);
    expect(importedSpecifiers(`import { B } from '${FORBIDDEN}';`)).toContain(FORBIDDEN);
  });
});
