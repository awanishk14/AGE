import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * ADR-0066 **D4 as clarified** (§0.5a) — *"the draft must not become a second
 * canonical source of truth for the business."*
 *
 * ⚠️ **`Draft → everything` ARRIVES BY DRIFT, NEVER BY DECISION.** No slice will
 * ever propose "make the draft canonical". What happens instead is a reader that
 * finds the draft closer than the Answer File, a screen that renders it because
 * it is richer, a capability that takes it because it is already loaded. Each is
 * locally reasonable; the sum is a shadow database nobody chose.
 *
 * 🚫 A review comment cannot catch that, because each step is defensible on its
 * own. This guard is structural: it fails the build the moment a scoring, BIF,
 * capability or persistence module imports this package at all.
 */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

const PACKAGE_NAME = '@age/intake-draft';

/**
 * The areas that produce or store the canonical record. ⚠️ A draft reaching any
 * of these is the failure §0.5a names — 🚫 do not add an exception here; the
 * acceptance path passes `draftAnswers(draft)`, which is a plain
 * `DiscoveryAnswer[]` and carries no draft type with it.
 */
const CANONICAL_AREAS = [
  join('packages', 'bif'),
  join('packages', 'business-discovery-capture'),
  join('packages', 'business-discovery-contracts'),
  join('packages', 'capabilities'),
  join('packages', 'persistence'),
  join('packages', 'scored-bif-snapshot-persistence'),
  join('packages', 'demo-runtime'),
  join('apps', 'capture'),
  join('apps', 'demo'),
] as const;

const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', '.turbo', '.nx', 'coverage']);

function sourceFilesUnder(directory: string): readonly string[] {
  let entries: readonly string[];

  try {
    entries = readdirSync(directory);
  } catch {
    // ⚠️ A missing area is reported by the sentinel below, never swallowed here
    // as "nothing to check".
    return [];
  }

  return entries.flatMap((entry) => {
    if (SKIP_DIRECTORIES.has(entry)) {
      return [];
    }

    const full = join(directory, entry);

    if (statSync(full).isDirectory()) {
      return sourceFilesUnder(full);
    }

    return entry.endsWith('.ts') || entry.endsWith('.tsx') ? [full] : [];
  });
}

describe('ADR-0066 §0.5a — the draft is a working artifact, never canonical', () => {
  it('walked every canonical area and actually found source files', () => {
    // ⚠️ Sentinel FIRST: a walk that finds nothing would report perfect
    // compliance. A renamed package must fail here, loudly, rather than silently
    // stop guarding.
    for (const area of CANONICAL_AREAS) {
      const found = sourceFilesUnder(join(REPO_ROOT, area));

      expect(found.length, `${area} must contain source files to scan`).toBeGreaterThan(0);
    }

    expect(CANONICAL_AREAS).toHaveLength(9);
  });

  it('🚫 no scoring, BIF, capability or persistence module imports the draft', () => {
    const offenders = CANONICAL_AREAS.flatMap((area) =>
      sourceFilesUnder(join(REPO_ROOT, area)).filter((file) =>
        readFileSync(file, 'utf8').includes(PACKAGE_NAME),
      ),
    ).map((file) => file.slice(REPO_ROOT.length).split(sep).join('/'));

    expect(offenders).toEqual([]);
  });

  it('🚫 the package declares no dependency on persistence or the BIF', () => {
    // ⚠️ The import scan above looks outward. This looks inward: a dependency
    // added here is the other direction the same drift can take.
    const manifest = JSON.parse(
      readFileSync(join(REPO_ROOT, 'packages', 'intake-draft', 'package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };
    const declared = Object.keys(manifest.dependencies ?? {});

    expect(declared.length).toBeGreaterThan(0);
    expect(declared).not.toContain('@age/bif');
    expect(declared).not.toContain('@age/persistence');
    expect(declared).not.toContain('@age/scored-bif-snapshot-persistence');
    expect(declared).not.toContain('@prisma/client');
  });
});
